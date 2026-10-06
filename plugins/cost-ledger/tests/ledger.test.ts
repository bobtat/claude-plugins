import { expect, test } from 'claude-code/testing'

import { addSpend, heatLevel, monthView, spendSince, summarize, weekStartKey } from '../hooks/ledger'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()

test('a week starts on Monday, also across a month boundary', async () => {
  expect(weekStartKey(at(2026, 10, 6))).toBe('2026-10-05')
  expect(weekStartKey(at(2026, 10, 5))).toBe('2026-10-05')
  expect(weekStartKey(at(2026, 10, 4))).toBe('2026-09-28')
  expect(weekStartKey(at(2026, 10, 1))).toBe('2026-09-28')
})

test('spend is the growth of the running total, and a reset counts from zero', async () => {
  expect(spendSince(1.5, 2)).toBe(0.5)
  expect(spendSince(2, 0.25)).toBe(0.25)
  expect(spendSince(null, 0.75)).toBe(0.75)
})

test('a session running past midnight splits its spend between the two days', async () => {
  let entry = addSpend(undefined, at(2026, 9, 30, 23), 1, 'p')
  entry = addSpend(entry, at(2026, 10, 1, 1), 2, 'p')
  expect(entry.days).toEqual({ '2026-09-30': 1, '2026-10-01': 2 })
})

test('week and month totals sum every session over calendar periods', async () => {
  const now = at(2026, 10, 1)
  const a = addSpend(addSpend(undefined, at(2026, 9, 28), 3, 'p'), at(2026, 9, 20), 100, 'p')
  const b = addSpend(addSpend(undefined, now, 2, 'p'), at(2026, 9, 30), 4, 'p')

  const s = summarize([a, b], now)

  expect(s.today).toBe(2)
  expect(s.week).toBe(9)
  expect(s.month).toBe(2)
  expect(s.days).toEqual({ '2026-09-20': 100, '2026-09-28': 3, '2026-09-30': 4, '2026-10-01': 2 })
})

test('a month grid starts on Monday and pads both ends to whole weeks', async () => {
  const october = monthView(at(2026, 10, 6), 0)
  expect(october.name).toBe('October 2026')
  expect(october.weeks[0]).toEqual([null, null, null, 1, 2, 3, 4])
  expect(october.weeks.at(-1)).toEqual([26, 27, 28, 29, 30, 31, null])

  expect(monthView(at(2026, 1, 15), -1).key).toBe('2025-12')
})

test('shading is four steps relative to the busiest day, none for no spend', async () => {
  expect(heatLevel(0, 10)).toBe(0)
  expect(heatLevel(0.1, 10)).toBe(1)
  expect(heatLevel(5, 10)).toBe(2)
  expect(heatLevel(10, 10)).toBe(4)
})
