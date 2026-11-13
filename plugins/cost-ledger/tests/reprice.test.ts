import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { repricedWrites } from '../hooks/keepalive'
import { dayKey } from '../hooks/ledger'
import type { SessionEntry } from '../hooks/ledger'
import { rateTable, ratesFor } from '../hooks/pricing'
import { complete, engine, measure, memoryStore, NOW, PANE, ROOT, runStep, usage } from './support'

// Each request writes 100,000 tokens to the cache on Opus 5.5, which Claude
// Code charges $0.80 for on the one-hour cache and $0.50 on the five-minute one.
const WRITE = usage(0, 100_000)
const AT_1H = 0.8
const AT_5M = 0.5
const TODAY = dayKey(NOW)

function sessionEngine(on: On, stored: Record<string, unknown> = {}) {
  mock.clock(on, { now: NOW })
  const store = memoryStore(on, stored)
  const session = { usd: 0 }
  const toasts = engine(on, Array.from({ length: 8 }, () => WRITE), 'claude-opus-5-5', session)
  const entry = () => store.get('session:s1') as SessionEntry
  const micro = (usd: number | undefined) => Math.round((usd ?? Number.NaN) * 1e6)
  return {
    session,
    toasts,
    // What the session's stored breakdown has for cache writes, in millionths of a dollar.
    storedWrites: () => micro(entry().cache?.[TODAY]?.usd.cacheWrite),
    turnEstimate: () => micro(entry().inTurns?.[TODAY]?.estimatedUsd),
    turnRecords: () => (entry().turns ?? []).map(turn => micro(turn.usage.usd.cacheWrite)),
    storedTtl: () => store.get('learnedCacheTtl'),
  }
}

// One turn of `requests` requests, each of which moves Claude Code's total by `chargedEach`.
async function turn($: Engine, session: { usd: number }, turnId: string, requests: number, chargedEach: number) {
  await $.turn.start({ turnId, text: 'read the billing module' })
  for (let i = 0; i < requests; i++) {
    session.usd += chargedEach
    await runStep($, turnId)
  }
  await $.turn.complete(complete(turnId))
}

test('writes recorded at the wrong lifetime are re-priced by what was added or taken', async () => {
  const opus = ratesFor(rateTable(''), 'claude-opus-5-5', 0)
  if (opus === undefined) throw new Error('no rate for Opus 5.5')

  const micro = (usd: number) => Math.round(usd * 1e6)
  const at5m = { tokens: 100_000, rates: opus, ttl: '5m' } as const
  const at1h = { tokens: 100_000, rates: opus, ttl: '1h' } as const

  expect(micro(repricedWrites([at5m], '1h'))).toBe(300_000)
  expect(micro(repricedWrites([at1h], '5m'))).toBe(-300_000)
  expect(repricedWrites([at1h], '1h')).toBe(0)
  expect(micro(repricedWrites([at5m, at1h], '1h'))).toBe(300_000)
  expect(repricedWrites([], '1h')).toBe(0)
})

test("a session's first turn, priced at five minutes as it ran, is put right once its total shows the one-hour rate", async ($, on) => {
  const { session, storedWrites, turnEstimate, turnRecords, storedTtl } = sessionEngine(on)
  // A first measurement brings up the totals the pane draws from.
  await $.session.measure(measure(0))

  await turn($, session, 't1', 2, AT_1H)

  expect(storedWrites()).toBe(1_600_000)
  expect(turnEstimate()).toBe(1_600_000)
  expect(turnRecords()).toEqual([1_600_000])
  expect(storedTtl()).toBe('1h')
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ text: /^Cache write\s+200k\s+\$1\.60/ })).toBeDefined()
})

test('writes priced at the one-hour rate come down when the turn was charged at five minutes', async ($, on) => {
  const { session, storedWrites, turnEstimate, turnRecords } = sessionEngine(on, { learnedCacheTtl: '1h' })

  await turn($, session, 't1', 2, AT_5M)

  expect(storedWrites()).toBe(1_000_000)
  expect(turnEstimate()).toBe(1_000_000)
  expect(turnRecords()).toEqual([1_000_000])
})

test('the turn after is priced right as it runs and corrected no further', async ($, on) => {
  const { session, storedWrites, turnEstimate, turnRecords } = sessionEngine(on)
  await turn($, session, 't1', 2, AT_1H)

  await turn($, session, 't2', 1, AT_1H)

  expect(storedWrites()).toBe(2_400_000)
  expect(turnEstimate()).toBe(2_400_000)
  expect(turnRecords().sort()).toEqual([1_600_000, 800_000])
})

test('a turn whose total fits neither lifetime is left as it was priced', async ($, on) => {
  const { session, storedWrites, storedTtl } = sessionEngine(on)

  await turn($, session, 't1', 2, 0.65)

  expect(storedWrites()).toBe(1_000_000)
  expect(storedTtl()).toBeUndefined()
})

test('a turn a subagent made a request in is left as it was priced', async ($, on) => {
  const { session, storedWrites } = sessionEngine(on)

  // The conversation's write is charged at five minutes, as it was priced.
  // With the subagent's $0.30 the turn moves the total by exactly what the
  // conversation's write would cost at the one-hour rate.
  await $.turn.start({ turnId: 't1', text: 'read the billing module' })
  session.usd += AT_5M
  await runStep($, 't1')
  session.usd += AT_1H - AT_5M
  await runStep($, 'a1', 'agent-1')
  await $.turn.complete(complete('t1'))

  expect(storedWrites()).toBe(1_000_000)
})

test('a turn cut across by a /clear is left as it was priced', async ($, on) => {
  const { session, storedWrites } = sessionEngine(on)
  on('classic.SessionStart', () => ({}))

  await $.turn.start({ turnId: 't1', text: 'read the billing module' })
  session.usd += AT_1H
  await runStep($, 't1')
  await $.classic.SessionStart({ source: 'clear', session_id: 's1', transcript_path: '', cwd: ROOT })
  await $.turn.complete(complete('t1'))

  expect(storedWrites()).toBe(500_000)
})

test('the cacheTtl setting is not overruled by what a turn was charged', { options: { cacheTtl: '5m' } }, async ($, on) => {
  const { session, storedWrites } = sessionEngine(on)

  await turn($, session, 't1', 2, AT_1H)

  expect(storedWrites()).toBe(1_000_000)
})

test('a prompt is judged expensive by what it cost once re-priced', async ($, on) => {
  const { session, toasts } = sessionEngine(on)

  await turn($, session, 't1', 3, AT_1H)

  expect(toasts.filter(t => t.startsWith('That prompt cost'))).toHaveLength(1)
  expect(toasts.find(t => t.startsWith('That prompt cost'))).toMatch(/≈ \$2\.40 \(3 requests\)/)
})

test(
  'under your own rates the writes are re-priced at your rate for the lifetime charged',
  { options: { rates: '{"opus-5-5": {"cacheWrite5m": 5.5, "cacheWrite1h": 9}}' } },
  async ($, on) => {
    const { session, storedWrites } = sessionEngine(on)

    await turn($, session, 't1', 2, AT_1H)

    expect(storedWrites()).toBe(1_800_000)
  },
)
