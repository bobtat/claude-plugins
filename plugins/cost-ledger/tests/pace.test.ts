import { expect, mock, test } from 'claude-code/testing'

import { budgetReachDay, monthPace, weekOverWeek } from '../hooks/insights'
import { addSpend } from '../hooks/ledger'
import { engine, measure, NOW, PANE, ROOT } from './support'

const OCT_6_NOON = new Date(2026, 9, 6, 12).getTime()

test('the month pace extrapolates the average day, at least one day elapsed', async () => {
  expect(Math.round(monthPace(55, OCT_6_NOON))).toBe(310)
  expect(Math.round(monthPace(10, new Date(2026, 9, 1, 2).getTime()))).toBe(310)
})

test('a budget gets a reach date only when this month will cross it', async () => {
  expect(budgetReachDay(55, 100, OCT_6_NOON)).toBe('2026-10-11')
  expect(budgetReachDay(55, 1000, OCT_6_NOON)).toBeNull()
  expect(budgetReachDay(120, 100, OCT_6_NOON)).toBeNull()
})

test('week over week compares the same weekdays', async () => {
  const days = {
    '2026-09-28': 10,
    '2026-09-29': 10,
    '2026-09-30': 99,
    '2026-10-05': 15,
    '2026-10-06': 15,
  }

  expect(weekOverWeek(days, NOW)).toEqual({ thisWeek: 30, lastWeek: 20, change: 0.5 })
})

test('the pane shows the change against last week and the month pace', async ($, on) => {
  mock.clock(on, { now: OCT_6_NOON })
  let earlier = addSpend(undefined, new Date(2026, 8, 28, 12).getTime(), 10, ROOT)
  earlier = addSpend(earlier, new Date(2026, 8, 29, 12).getTime(), 10, ROOT)
  let thisWeek = addSpend(undefined, new Date(2026, 9, 5, 12).getTime(), 15, ROOT)
  thisWeek = addSpend(thisWeek, OCT_6_NOON, 15, ROOT)
  mock.store(on, { 'session:earlier': earlier, 'session:this-week': thisWeek })
  engine(on)

  await $.session.measure(measure(0))

  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ text: /This week .*\+50% vs this point last week/ })).toBeDefined()
  expect(await ui.find({ text: /This month .*on pace for \$169\.09/ })).toBeDefined()
})
