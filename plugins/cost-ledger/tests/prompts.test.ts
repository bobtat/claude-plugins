import { expect, mock, test } from 'claude-code/testing'

import { addStepToTurn, finishTurn, keepTopTurns, startTurn } from '../hooks/insights'
import { priceUsage, rateTable, ratesFor } from '../hooks/pricing'
import { complete, DAY, engine, measure, NOW, PANE, ROOT, runStep, usage } from './support'

const OPUS = ratesFor(rateTable(''), 'claude-opus-5-5')

test('a long prompt is kept as one shortened line', async () => {
  const turn = startTurn('t', `fix   the\n${'x'.repeat(200)}`, NOW)
  expect(turn.prompt.startsWith('fix the x')).toBe(true)
  expect(turn.prompt.length).toBe(80)
})

test('each month keeps its ten most expensive prompts', async () => {
  const priced = (usd: number) => priceUsage(usage(0, usd * 200_000), OPUS, '5m')
  const turn = (at: number, usd: number) => finishTurn(addStepToTurn(startTurn('t', `p${usd}`, at), priced(usd), false), ROOT)
  const september = Array.from({ length: 12 }, (_, i) => turn(NOW - 20 * DAY, i + 1))
  const october = [turn(NOW, 0.5)]

  const kept = keepTopTurns([...september, ...october])

  expect(kept.filter(t => t.at < NOW).map(t => t.prompt)).toEqual(
    ['p12', 'p11', 'p10', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3'],
  )
  expect(kept.some(t => t.prompt === 'p0.5')).toBe(true)
})

test('a prompt is charged its requests and its subagents, and a costly one raises a toast', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts = engine(on, [usage(0, 300_000), usage(0, 200_000)])
  await $.session.measure(measure(1))

  await $.turn.start({ turnId: 't1', text: 'refactor the billing module' })
  await runStep($, 't1')
  await runStep($, 'sub-t', 'agent-1')
  await $.turn.complete(complete('t1'))

  expect(toasts.some(t => /That prompt cost ≈ \$2\.50 \(1 requests \+ 1 by subagents\): “refactor the billing module”/.test(t))).toBe(true)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ text: /\$2\.50\s+1\+1 req refactor the billing module/ })).toBeDefined()
})
