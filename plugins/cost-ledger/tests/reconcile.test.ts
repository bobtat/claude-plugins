import { expect, mock, test } from 'claude-code/testing'

import { isOutOfStep, reconcile } from '../hooks/insights'
import { engine, measure, NOW, PANE, spentSession as session } from './support'

test('the estimate is set against the total as a share, once there is enough spend to compare', async () => {
  expect(Math.round((reconcile(200, 195).share ?? 0) * 1000)).toBe(975)
  expect(reconcile(0.99, 0.1).share).toBeNull()
  expect(reconcile(0, 0).share).toBeNull()
  expect(reconcile(1, 0).share).toBe(0)
})

test('an estimate within a tenth of the total is in step with it', async () => {
  expect(isOutOfStep(0.91)).toBe(false)
  expect(isOutOfStep(1.09)).toBe(false)
  expect(isOutOfStep(0.89)).toBe(true)
  expect(isOutOfStep(1.11)).toBe(true)
  expect(isOutOfStep(0)).toBe(true)
})

test('the pane says how much of the month the breakdown accounts for', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on, { 'session:earlier': session(10, 9.5) })
  engine(on)
  await $.session.measure(measure(0))

  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ text: /^The breakdown adds up to \$9\.50, 95% of the month's \$10\.00 total$/ })).toBeDefined()
})

test('the pane points to the doctor when the breakdown is out of step with the total', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on, { 'session:earlier': session(10, 5) })
  engine(on)
  await $.session.measure(measure(0))

  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ text: /^The breakdown adds up to \$5\.00, 50% of the month's \$10\.00 total; \/costs doctor says what can cause the gap$/ })).toBeDefined()
})

test('with too little spend in the month the pane makes no comparison', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on, { 'session:earlier': session(0.4, 0.1) })
  engine(on)
  await $.session.measure(measure(0))

  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ text: /^Cache hit/ })).toBeDefined()
  expect(await ui.find({ text: /The breakdown adds up to/ })).toBeUndefined()
})

test(
  'priced at your own rates, the breakdown is shown against the total without being called out of step',
  { options: { rates: '{"opus-5-5": {"input": 2}}' } },
  async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on, { 'session:earlier': session(10, 5) })
    engine(on)
    await $.session.measure(measure(0))

    const ui = await $.ui.mount(PANE)

    expect(await ui.find({ text: /^The breakdown adds up to \$5\.00, 50% of the month's \$10\.00 total; it is priced at your rates and the total at Claude Code's$/ })).toBeDefined()
  },
)
