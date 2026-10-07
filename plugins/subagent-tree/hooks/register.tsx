import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentStats } from '../types'
import { buildRows, formatTokens, liveCount } from './tree'

const PANE = 'subagent-tree'
const stats = atom({ plugin: 'subagent-tree', key: 'stats' } as const, {})
const tick = atom({ plugin: 'subagent-tree', key: 'tick' } as const, 0)

const blank = (now: number): AgentStats => ({
  tools: 0,
  steps: 0,
  tokensOut: 0,
  tokensIn: 0,
  startedAt: now,
})

async function touch(
  $: EngineInterface,
  id: string,
  change: (s: AgentStats) => AgentStats,
) {
  const now = await $.clock.now()
  await update($, stats, all => {
    const current = all[id] ?? blank(now)
    return { ...all, [id]: change({ ...current, endedAt: undefined }) }
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
      await touch($, e.agentId, s => ({ ...s, tools: s.tools + 1, lastTool: e.tool }))
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
      const usage = e.usage
      await update($, stats, all => {
        const current = all[id] ?? blank(now - e.durationMs)
        return {
          ...all,
          [id]: {
            ...current,
            endedAt: now,
            tokensOut: current.tokensOut + (usage?.output_tokens ?? 0),
            tokensIn:
              current.tokensIn +
              (usage
                ? usage.input_tokens +
                  usage.cache_read_input_tokens +
                  usage.cache_creation_input_tokens
                : 0),
          },
        }
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
    const tokens = Object.values(all).reduce((sum, s) => sum + s.tokensOut, 0)

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
