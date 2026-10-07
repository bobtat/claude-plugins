import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentStats } from '../types'
import { buildRows, formatTokens, liveCount, prune } from './tree'

const PANE = 'subagent-tree'
const stats = atom(
  { plugin: 'subagent-tree', key: 'stats' } as const,
  {},
  { shape: 'stats-v2' },
)
const tick = atom({ plugin: 'subagent-tree', key: 'tick' } as const, 0)

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

export const register: Register = on => {
  let isTicking = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agents-tree',
      description: 'Show the session\'s subagents as a live tree in a pane',
    })

    return next(e)
  })

  on('command.run', { command: 'agents-tree' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Subagents' })

    if (!isTicking) {
      isTicking = true
      // Redraw once a second while anything runs, so elapsed times keep moving.
      $.clock.every(1000, async () => {
        if (liveCount(await $.agent.list()) > 0) await update($, tick, n => n + 1)
      })
    }

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

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    await read($, tick)
    const all = await read($, stats)
    const agents = await $.agent.list()
    const now = await $.clock.now()
    const rows = buildRows(agents, all, now, e.viewport?.columns ?? 60)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 5)
    const shown = rows.slice(0, room)
    const live = liveCount(agents)
    // Only agents the tree shows: forks and workflow agents carry ids no list names.
    const tokens = agents.reduce((sum, agent) => sum + (all[agent.id]?.tokensOut ?? 0), 0)

    return (
      <Box flexDirection="column">
        {rows.length === 0 && <Text dimColor>No subagents yet.</Text>}
        {shown.map(row => (
          <Box key={row.id} flexDirection="column">
            <Text bold={row.isLive} dimColor={!row.isLive}>
              {'  '.repeat(row.depth)}
              {row.glyph} {row.label}
            </Text>
            <Text dimColor>
              {'  '.repeat(row.depth)}  {row.detail}
            </Text>
          </Box>
        ))}
        {rows.length > shown.length && (
          <Text dimColor>… {rows.length - shown.length} more</Text>
        )}
        {rows.length > 0 && (
          <Text dimColor>
            {rows.length} agents · {live} running · {formatTokens(tokens)} tokens out
          </Text>
        )}
      </Box>
    )
  })
}
