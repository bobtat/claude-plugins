import { expect, test } from 'claude-code/testing'

import { addSpend, addTurnMoves, dayKey, daysFrom, mergeEntries, turnSplit } from '../hooks/ledger'
import type { SessionEntry } from '../hooks/ledger'
import { DAY, NOW, ROOT, spentSession } from './support'

const TODAY = dayKey(NOW)

test('what the total moved during turns is kept per day, beside what was priced for them', async () => {
  let entry = addSpend(undefined, NOW, 5, ROOT)
  entry = addTurnMoves(entry, NOW, 3, 2.5)
  entry = addTurnMoves(entry, NOW, 1, 1)
  entry = addTurnMoves(entry, NOW + DAY, 2, 0)

  expect(entry.inTurns).toEqual({ [TODAY]: { usd: 4, estimatedUsd: 3.5 }, [dayKey(NOW + DAY)]: { usd: 2, estimatedUsd: 0 } })
  expect(entry.days).toEqual({ [TODAY]: 5 })
})

test('a turn before anything else was recorded starts the session tracked', async () => {
  expect(addTurnMoves(undefined, NOW, 3, 2.5)?.inTurns).toEqual({ [TODAY]: { usd: 3, estimatedUsd: 2.5 } })
})

test('a session an earlier version began is not tracked from part-way through', async () => {
  const begunEarlier: SessionEntry = { project: ROOT, days: { [TODAY]: 5 }, updatedAt: NOW }

  expect(addTurnMoves(begunEarlier, NOW, 3, 2.5)).toBe(begunEarlier)
})

test('the split counts the sessions tracked from their start, for the month asked', async () => {
  const tracked = addTurnMoves(spentSession(10, 6), NOW, 7, 5)
  const { inTurns: _untracked, ...begunEarlier } = spentSession(100, 1)
  const archive = mergeEntries(undefined, tracked)
  const lastMonth = addTurnMoves(addSpend(undefined, NOW - 40 * DAY, 9, ROOT), NOW - 40 * DAY, 9, 9)

  expect(archive.inTurns).toBeUndefined()
  expect(turnSplit([tracked, begunEarlier, archive, lastMonth], TODAY.slice(0, 7))).toEqual({
    totalUsd: 10,
    estimatedUsd: 6,
    turnsUsd: 7,
    turnsEstimatedUsd: 5,
  })
})

test('with no session tracked the split is all zero', async () => {
  const { inTurns: _untracked, ...begunEarlier } = spentSession(100, 1)

  expect(turnSplit([begunEarlier], TODAY.slice(0, 7))).toEqual({ totalUsd: 0, estimatedUsd: 0, turnsUsd: 0, turnsEstimatedUsd: 0 })
})

test("a session trimmed to its recent days keeps only those days' turns", async () => {
  const entry = addTurnMoves(addTurnMoves(addSpend(addSpend(undefined, NOW - 90 * DAY, 3, ROOT), NOW, 2, ROOT), NOW - 90 * DAY, 3, 3), NOW, 2, 1)

  expect(daysFrom(entry, TODAY)?.inTurns).toEqual({ [TODAY]: { usd: 2, estimatedUsd: 1 } })
})
