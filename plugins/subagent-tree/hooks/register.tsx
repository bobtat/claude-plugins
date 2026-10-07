import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { AgentStats } from '../types'
import { buildRows, formatTokens, liveCount, prune } from './tree'

const PANE = 'subagent-tree'
const stats = atom(
  { plugin: 'subagent-tree', key: 'stats' } as const,
  {},
  { shape: 'stats-v2' },
)

const blank = (now: number): AgentStats => ({
  tools: 0,
  steps: 0,
  tokensOut: 0,
  activeMs: 0,
  lastEventAt: now,
})

async function touch(
  $: EngineInterface,
  id: string,
  change: (s: AgentStats) => AgentStats,
) {
  const now = await $.clock.now()
  await update($, stats, all => {
    const current = all[id] ?? blank(now)
    // A run opens at the agent's first event: subagents raise no turn.start.
    const open = { ...current, runStartedAt: current.runStartedAt ?? now, lastEventAt: now }
    return { ...all, [id]: change(open) }
  })
}

// Module state: a reload starts it over, and the next draw of the pane (a
// reload redraws it) or /agents-tree restores it.
let timer: Timer | undefined
let isOpen = false
let wasLive = false

async function redrawTick($: EngineInterface) {
  if (!isOpen) return
  const isLive = liveCount(await $.agent.list()) > 0
  // One more redraw after the last agent finishes, so the final frame is not
  // left showing it running.
  if (isLive || wasLive) $.ui.invalidate('ui.render')
  wasLive = isLive
}

function ensureTimer($: EngineInterface) {
  isOpen = true
  timer ??= $.clock.every(1000, () => redrawTick($))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agents-tree',
      description: 'Show the session\'s subagents as a live tree in a pane',
    })

    return next(e)
  })

  on('command.run', { command: 'agents-tree' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Subagents' })
    ensureTimer($)

    return { text: 'Subagent tree opened.' }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) {
      // Written before the call runs, so the pane shows the tool while it runs;
      // not awaited, so the call is not held up by the write.
      touch($, e.agentId, s => ({ ...s, tools: s.tools + 1, lastTool: e.tool })).catch(
        () => undefined,
      )
    }

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      await touch($, e.agentId, s => ({ ...s, steps: s.steps + 1 }))
    }

    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) {
      const id = e.agentId
      const now = await $.clock.now()
      const listed = new Set((await $.agent.list()).map(agent => agent.id))
      await update($, stats, all => {
        const current = all[id] ?? blank(now)
        // Loaded mid-run: the run began when the turn's length says it did.
        const began = current.runStartedAt ?? now - e.durationMs
        const updated = {
          ...all,
          [id]: {
            ...current,
            runStartedAt: undefined,
            activeMs: current.activeMs + Math.max(0, now - began),
            lastEventAt: now,
            // No usage on an interrupt or an API error.
            tokensOut: current.tokensOut + (e.usage?.output_tokens ?? 0),
          },
        }

        return prune(updated, listed, now)
      })
    }

    return result
  })

  on('ui.close', { id: PANE }, (_$, e, next) => {
    isOpen = false
    timer?.cancel()
    timer = undefined

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    ensureTimer($)
    const all = await read($, stats)
    const agents = await $.agent.list()
    const now = await $.clock.now()
    const rows = buildRows(agents, all, now)
    const live = liveCount(agents)
    // Only agents the tree shows: forks and workflow agents carry ids no list names.
    const tokens = agents.reduce((sum, agent) => sum + (all[agent.id]?.tokensOut ?? 0), 0)

    return (
      <Box flexDirection="column">
        {rows.length === 0 && <Text dimColor>No subagents yet.</Text>}
        {rows.map(row => (
          <Box key={row.id} flexDirection="column" paddingLeft={row.depth * 2}>
            <Text bold={row.isLive} dimColor={!row.isLive} wrap="truncate">
              {row.glyph} {row.label}
            </Text>
            <Text dimColor wrap="truncate">
              {'  '}
              {row.detail}
            </Text>
          </Box>
        ))}
        {rows.length > 0 && (
          <Text dimColor>
            {rows.length} agents · {live} running · {formatTokens(tokens)} tokens out
          </Text>
        )}
      </Box>
    )
  })
}
