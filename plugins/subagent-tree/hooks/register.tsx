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
let lastRenderAt = 0
let wasLive = false
let idleTicks = 0
// A pane that is drawn is redrawn on every invalidate, and at least every
// IDLE_EVERY ticks even when nothing runs, so a pane not drawn for this long
// is closed or was dropped without ui.close reaching this plugin; the timer
// stops and the next draw restarts it.
const IDLE_EVERY = 5
const STALE_MS = 12_000

function stopTimer() {
  timer?.cancel()
  timer = undefined
  wasLive = false
  idleTicks = 0
}

async function pruneUnlisted($: EngineInterface, agents: { id: string }[], now: number) {
  const listed = new Set(agents.map(agent => agent.id))
  const all = await read($, stats)
  if (Object.keys(prune(all, listed, now)).length !== Object.keys(all).length) {
    await update($, stats, current => prune(current, listed, now))
  }
}

async function redrawTick($: EngineInterface) {
  try {
    const now = await $.clock.now()
    if (now - lastRenderAt > STALE_MS) return stopTimer()

    const agents = await $.agent.list()
    const isLive = liveCount(agents) > 0
    idleTicks = isLive || wasLive ? 0 : idleTicks + 1
    // Every second while something runs, and once more after the last agent
    // finishes so the final frame is not left showing it running. When idle, a
    // slow heartbeat: the draw reads the agent list, so a status that changed
    // with no state write (a pending agent starting) still shows.
    if (isLive || wasLive || idleTicks >= IDLE_EVERY) {
      $.ui.invalidate('ui.render')
      idleTicks = 0
    }
    wasLive = isLive
    await pruneUnlisted($, agents, now)
  } catch (error) {
    // A failed period ends the interval; forget it so the next draw restarts it.
    $.ui.log(`redraw tick failed: ${String(error)}`, { to: 'debug' })
    stopTimer()
  }
}

async function watch($: EngineInterface) {
  lastRenderAt = await $.clock.now()
  // The timer keeps the `$` of the hook that started it, as the types' own
  // example does; a tick that fails stops it and the next draw starts it again.
  timer ??= $.clock.every(1000, () => redrawTick($))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agents-tree',
      description: 'Show the session\'s subagents as a live tree in a pane',
      argumentHint: '[close]',
    })

    return next(e)
  })

  on('command.run', { command: 'agents-tree' }, async ($, e) => {
    const argument = e.args.trim()

    if (argument === 'close') {
      try {
        await $.ui.close({ id: PANE })
      } catch (error) {
        // A hook beneath refused the close.
        return { text: `Subagent tree stays open: ${String(error)}` }
      }
      stopTimer()

      return { text: 'Subagent tree closed.' }
    }
    if (argument !== '' && argument !== 'open') {
      return { text: 'Usage: /agents-tree [close]' }
    }
    await $.ui.open({ id: PANE, title: 'Subagents' })
    await watch($)

    return { text: 'Subagent tree opened.' }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) {
      // Written before the call runs, so the pane shows the tool while it runs;
      // not awaited, so the call is not held up by the write. update() retries
      // on a version miss, so the write is not lost to the turn.step and
      // turn.complete writes; on an interrupt it may be aborted and that call
      // goes uncounted.
      touch($, e.agentId, s => ({ ...s, tools: s.tools + 1, lastTool: e.tool })).catch(
        () => undefined,
      )
    }

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      // A new request means the last tool call has finished.
      await touch($, e.agentId, s => ({ ...s, steps: s.steps + 1, lastTool: undefined }))
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

  on('ui.close', { id: PANE }, async (_$, e, next) => {
    const result = await next(e)
    // A hook beneath may refuse the close and keep the pane open; then the
    // timer must keep running. If one keeps it open some other way, the next
    // draw restarts the timer.
    if (!(result as { deny?: string } | undefined)?.deny) stopTimer()

    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    await watch($)
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
            <Box paddingLeft={2}>
              <Text dimColor wrap="truncate">
                {row.detail}
              </Text>
            </Box>
          </Box>
        ))}
        {rows.length > 0 && (
          <Text dimColor>
            {rows.length} agents · {live} active · {formatTokens(tokens)} tokens out
          </Text>
        )}
      </Box>
    )
  })
}
