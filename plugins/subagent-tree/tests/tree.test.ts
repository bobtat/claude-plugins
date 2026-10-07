import { expect, test } from 'claude-code/testing'

import type { AgentStats } from '../types'
import { buildRows, elapsedMs, formatElapsed, formatTokens, liveCount, prune } from '../hooks/tree'

const agent = (id: string, status: string, parentId?: string, description = id) => ({
  id,
  description,
  type: 'general-purpose',
  status,
  parentId,
})

test('elapsed time reads in seconds, minutes and hours', () => {
  expect(formatElapsed(900)).toBe('0s')
  expect(formatElapsed(59_000)).toBe('59s')
  expect(formatElapsed(61_000)).toBe('1m01s')
  expect(formatElapsed(3_661_000)).toBe('1h01m')
  expect(formatElapsed(-5)).toBe('0s')
})

test('token counts abbreviate at thousands and millions', () => {
  expect(formatTokens(999)).toBe('999')
  expect(formatTokens(1_500)).toBe('2k')
  expect(formatTokens(2_400_000)).toBe('2.4M')
})

test('children sit under their parent, one level deeper', () => {
  const rows = buildRows(
    [agent('b', 'running', 'a'), agent('a', 'running'), agent('c', 'completed', 'b'), agent('d', 'idle')],
    {},
    0,
  )

  expect(rows.map(row => [row.id, row.depth])).toEqual([
    ['a', 0],
    ['b', 1],
    ['c', 2],
    ['d', 0],
  ])
})

test('an agent whose parent is not listed is a root, and a cycle shows its agents once', () => {
  const orphan = buildRows([agent('x', 'running', 'gone')], {}, 0)
  expect(orphan.map(row => row.depth)).toEqual([0])

  const cycle = buildRows([agent('a', 'running', 'b'), agent('b', 'running', 'a')], {}, 0)
  expect(cycle.map(row => row.id)).toEqual(['a', 'b'])
})

const stat = (over: Partial<AgentStats> = {}): AgentStats => ({
  tools: 0,
  steps: 0,
  tokensOut: 0,
  activeMs: 0,
  lastEventAt: 0,
  ...over,
})

test('a running agent shows its time, tools, steps and current tool; a finished one stops its clock', () => {
  const stats = {
    a: stat({ tools: 3, steps: 2, lastTool: 'Grep', tokensOut: 1_200, runStartedAt: 1_000, lastEventAt: 60_000 }),
    b: stat({ tools: 1, steps: 1, lastTool: 'Read', activeMs: 3_000, lastEventAt: 4_000 }),
  }
  const rows = buildRows([agent('a', 'running'), agent('b', 'completed')], stats, 66_000)

  expect(rows[0]?.detail).toBe('running · 1m05s · 3 tools · 2 steps · on Grep · 1k out')
  expect(rows[1]?.detail).toBe('completed · 3s · 1 tool · 1 step')
  expect(rows[0]?.glyph).toBe('●')
  expect(rows[1]?.glyph).toBe('✓')
  expect(buildRows([agent('b', 'completed')], stats, 9_000_000)[0]?.detail).toContain('3s')
})

test('time counts the active runs and leaves idle gaps out', () => {
  // two runs of 10s with a 50s idle gap between them, the second still open
  const stats = stat({ activeMs: 10_000, runStartedAt: 70_000, lastEventAt: 75_000 })

  expect(elapsedMs(stats, 'running', 80_000)).toBe(20_000)
  expect(elapsedMs(stats, 'idle', 999_000)).toBe(15_000)
  expect(elapsedMs(stat({ activeMs: 10_000 }), 'idle', 999_000)).toBe(10_000)
})

test('a killed agent with a run still open stops at its last event', () => {
  const stats = stat({ runStartedAt: 1_000, lastEventAt: 6_000 })

  expect(elapsedMs(stats, 'killed', 900_000)).toBe(5_000)
  expect(elapsedMs(stats, 'failed', 900_000)).toBe(5_000)
})

test('stats of unlisted ids are dropped after ten minutes and never the listed ones', () => {
  const minute = 60_000
  const all = {
    listed: stat({ lastEventAt: 0 }),
    fresh: stat({ lastEventAt: 55 * minute }),
    stale: stat({ lastEventAt: 40 * minute }),
  }

  expect(Object.keys(prune(all, new Set(['listed']), 60 * minute)).sort()).toEqual(['fresh', 'listed'])
})

test('past the cap, unlisted entries go first, oldest first', () => {
  const all: Record<string, AgentStats> = { keep: stat({ lastEventAt: 1 }) }
  for (let i = 0; i < 250; i += 1) all[`x${i}`] = stat({ lastEventAt: 1_000 + i })

  const kept = prune(all, new Set(['keep']), 2_000)

  expect(Object.keys(kept)).toHaveLength(200)
  expect(kept.keep).toBeDefined()
  expect(kept.x249).toBeDefined()
  expect(kept.x0).toBeUndefined()
})

test('only pending, running and waiting agents count as live', () => {
  expect(
    liveCount([
      agent('a', 'running'),
      agent('b', 'waiting'),
      agent('c', 'pending'),
      agent('d', 'idle'),
      agent('e', 'completed'),
      agent('f', 'failed'),
    ]),
  ).toBe(3)
})

