import { expect, mock, test } from 'claude-code/testing'

import { engine, measure, NOW, PANE, runStep, usage } from './support'

test(
  "a subagent's cache writes are priced at the five-minute rate while the conversation is on the one-hour cache",
  { options: { cacheTtl: '1h' } },
  async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    const toasts = engine(on, [usage(0, 100_000), usage(0, 100_000)])
    await $.session.measure(measure(1))

    await runStep($, 't1')
    await runStep($, 'a1', 'agent-1')

    expect(toasts[0]).toMatch(/wrote 100k tokens .*≈ \$0\.80 on claude-opus-5-5/)
    expect(toasts[1]).toMatch(/wrote 100k tokens .*≈ \$0\.50 on claude-opus-5-5/)
    const ui = await $.ui.mount(PANE)
    expect(await ui.find({ text: /^Subagents\s+\$0\.50\s.*incl\. \$0\.50 cache writes/ })).toBeDefined()
    expect(await ui.find({ text: /^Cache write\s+200k\s+\$1\.30/ })).toBeDefined()
  },
)

test('a learned one-hour lifetime prices the conversation, not its subagents', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on, { learnedCacheTtl: '1h' })
  const toasts = engine(on, [usage(0, 100_000), usage(0, 100_000)])

  await runStep($, 'a1', 'agent-1')
  await runStep($, 't1')

  expect(toasts[0]).toMatch(/≈ \$0\.50 on/)
  expect(toasts[1]).toMatch(/≈ \$0\.80 on/)
})

test("a subagent's tool result is charged its write at the five-minute rate", { options: { cacheTtl: '1h' } }, async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  engine(on, [usage(0, 100_000), usage(100_000, 0)])
  on('tool.call', () => ({ result: 'file', text: 'x'.repeat(400_000) }))
  await $.session.measure(measure(1))

  await $.tool.call({ tool: 'Read', file_path: 'big.ts', agentId: 'agent-1' })
  await runStep($, 'a1', 'agent-1')
  await runStep($, 'a1', 'agent-1')

  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ text: /^Read\s+1\s+100k\s+\$0\.50\s+\$0\.02$/ })).toBeDefined()
})
