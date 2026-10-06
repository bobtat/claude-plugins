import { expect, mock, test } from 'claude-code/testing'

import { addToolResult, chargeStep, emptyLoop, toolLabel } from '../hooks/insights'
import { engine, measure, NOW, PANE, runStep, usage } from './support'

test('a tool result is charged a cache write once, then a re-read on every later request', async () => {
  let loop = addToolResult(emptyLoop(), 'Read', 100_000)
  const write = 5 / 1_000_000
  const read = 0.2 / 1_000_000

  const first = chargeStep(loop, read, write)
  loop = first.loop
  const second = chargeStep(loop, read, write)

  expect(first.charges.Read).toEqual({ writeUsd: 0.5, rereadUsd: 0 })
  expect(second.charges.Read?.writeUsd).toBe(0)
  expect(Math.round((second.charges.Read?.rereadUsd ?? 0) * 100) / 100).toBe(0.02)
})

test('an MCP tool is labelled by server and tool', async () => {
  expect(toolLabel('mcp__github__get_issue')).toBe('github/get_issue')
  expect(toolLabel('Read')).toBe('Read')
})

test('a tool result shows what its write and re-reads cost', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  engine(on, [usage(0, 100_000), usage(100_000, 0)])
  on('tool.call', () => ({ result: 'file', text: 'x'.repeat(400_000) }))
  await $.session.measure(measure(1))

  await $.tool.call({ tool: 'Read', file_path: 'big.ts' })
  await runStep($, 't1')
  await runStep($, 't1')

  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ text: /^Read\s+1\s+100k\s+\$0\.50\s+\$0\.02$/ })).toBeDefined()
})
