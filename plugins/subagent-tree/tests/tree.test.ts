import { expect, mock, test } from 'claude-code/testing'

import { buildRows, formatElapsed, formatTokens, liveCount } from '../hooks/tree'

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

test('an agent whose parent is not listed is a root, and a cycle cannot loop', () => {
  const orphan = buildRows([agent('x', 'running', 'gone')], {}, 0)
  expect(orphan.map(row => row.depth)).toEqual([0])

  const cycle = buildRows([agent('a', 'running', 'b'), agent('b', 'running', 'a')], {}, 0)
  expect(cycle).toEqual([])
})

test('a running agent shows its time, tools, steps and current tool; a finished one stops its clock', () => {
  const stats = {
    a: { tools: 3, steps: 2, lastTool: 'Grep', tokensOut: 1_200, tokensIn: 0, startedAt: 1_000 },
    b: { tools: 1, steps: 1, lastTool: 'Read', tokensOut: 0, tokensIn: 0, startedAt: 1_000, endedAt: 4_000 },
  }
  const rows = buildRows([agent('a', 'running'), agent('b', 'completed')], stats, 66_000)

  expect(rows[0]?.detail).toBe('running · 1m05s · 3 tools · 2 steps · on Grep · 1k out')
  expect(rows[1]?.detail).toBe('completed · 3s · 1 tool · 1 step')
  expect(rows[0]?.glyph).toBe('●')
  expect(rows[1]?.glyph).toBe('✓')
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

test('the pane lists a subagent with the tool it is on', async ($, on) => {
  mock.clock(on, { now: 10_000 })
  on('agent.list', () => ({
    value: [{ id: 'sub1', description: 'scan the repo', type: 'Explore', status: 'running' }],
  }))
  on('tool.call', () => ({ result: {}, text: '' }))

  await $.tool.call({ tool: 'Grep', agentId: 'sub1' })

  const ui = await $.ui.mount({
    plugin: 'subagent-tree',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'subagent-tree',
    props: { title: 'Subagents', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })

  expect(await ui.find({ text: /Explore: scan the repo/ })).toBeDefined()
  expect(await ui.find({ text: /running · .* · 1 tool · 0 steps · on Grep/ })).toBeDefined()
})
