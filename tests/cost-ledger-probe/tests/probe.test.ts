import { expect, mock, test } from 'claude-code/testing'

import { contextOf, fromJsonl, parseCommand, report, scheduleDelays, turnCosts, unattributedSpend } from '../hooks/probe'
import type { ProbeRecord } from '../hooks/probe'
import { engine, LOG, MIN, NOW, probe, turn, usage } from './support'

test('subcommands parse, and bad arguments say what was expected', async () => {
  expect(parseCommand('schedule 8 4 12')).toEqual({ kind: 'schedule', minutes: [4, 8, 12] })
  expect(parseCommand(' burst 20 30 ')).toEqual({ kind: 'burst', count: 20, seconds: 30 })
  expect(parseCommand('')).toEqual({ kind: 'report' })
  expect(parseCommand('mark control start')).toEqual({ kind: 'mark', text: 'control start' })
  expect(parseCommand('schedule 4 x').kind).toBe('help')
  expect(parseCommand('burst 2.5 30').kind).toBe('help')
  expect(parseCommand('burst 20').kind).toBe('help')
  expect(parseCommand('pong').kind).toBe('help')
})

test('the context is the last response counted whole, as cost-ledger counts it', async () => {
  expect(contextOf({ input: 10, cacheRead: 90_000, cacheWrite: 9_000, output: 990 })).toBe(100_000)
})

test('schedule offsets count from the end of the last turn, past ones show as not positive', async () => {
  const delays = scheduleDelays(NOW, NOW + 5 * MIN, [4, 8])
  expect(delays).toEqual([
    { minutes: 4, delayMs: -1 * MIN },
    { minutes: 8, delayMs: 3 * MIN },
  ])
})

test('a line cut short mid-write is dropped and the rest of the log kept', async () => {
  const text = '{"at":1,"kind":"mark","text":"a"}\n{"at":2,"kind":"ma\n{"at":3,"kind":"mark","text":"b"}\n'
  expect(fromJsonl(text).map(r => r.at)).toEqual([1, 3])
})

test('the report gives each fork its hit rate and the idle gap since the last request', async () => {
  const snap = { costUsd: 1, rateLimits: [] }
  const records: ProbeRecord[] = [
    { at: NOW, kind: 'turn', phase: 'start', turnId: 't1' },
    { at: NOW + 1000, kind: 'step', turnId: 't1', model: 'm', startedAt: NOW, tokens: { input: 0, cacheRead: 0, cacheWrite: 100_000, output: 0 } },
    {
      at: NOW + 4 * MIN,
      kind: 'fork',
      label: '+4m',
      startedAt: NOW + 4 * MIN,
      contextTokens: 100_000,
      result: 'answered',
      tokens: { input: 40, cacheRead: 95_000, cacheWrite: 0, output: 3 },
      before: snap,
      after: { costUsd: 1.02, rateLimits: [] },
    },
  ]
  const text = report(records)
  expect(text).toMatch(/\+4m\s+idle\s+4\.0m\s+ctx\s+100000\s+read\s+95000 \(95%\)/)
  expect(text).toMatch(/Δcost \$0\.0200/)
})

test('a ping forks the transcript and logs the fork beside the context it was meant to serve', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const { files } = engine(on, clock)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await turn($, 't1')

  await probe($, 'ping')
  await clock.settle()

  const fork = fromJsonl(files.get(LOG) ?? '').find(r => r.kind === 'fork')
  expect(fork).toMatchObject({
    kind: 'fork',
    label: 'ping',
    contextTokens: 100_000,
    result: 'answered',
    tokens: { input: 40, cacheRead: 100_000, cacheWrite: 0, output: 3 },
    before: { costUsd: 1, rateLimits: [{ kind: 'five_hour', percentUsed: 12.5 }] },
  })
  expect(fork?.kind === 'fork' ? Math.round((fork.after.costUsd ?? 0) * 100) : 0).toBe(101)
})

test('scheduled pings fire at their offsets after the turn, and a new prompt cancels the rest', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const { forked, files } = engine(on, clock)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await turn($, 't1')
  const turnEnd = clock.now()

  await clock.advance(1 * MIN)
  expect(await probe($, 'schedule 4 8 12')).toMatch(/\+4m: in 3\.0 min/)
  await clock.advance(8 * MIN)
  await turn($, 't2')
  await clock.advance(10 * MIN)

  expect(forked).toEqual([turnEnd + 4 * MIN, turnEnd + 8 * MIN])
  expect(files.get(LOG)).toMatch(/1 pending ping\(s\) cancelled/)
})

test('a burst spaces its forks after each returns, and a miss shows in the report', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const { forked } = engine(on, clock, [usage(40, 100_000, 0, 3), usage(100_040, 0, 0, 3), usage(40, 100_000, 0, 3)])
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await turn($, 't1')

  const started = clock.now()
  await probe($, 'burst 3 30')
  await clock.advance(5 * MIN)

  expect(forked).toEqual([started, started + 30_000, started + 60_000])
  expect(await probe($, 'report')).toMatch(/burst 2\/3.*read\s+0 \(0%\)/)
})

test('a ping while a turn runs is logged as skipped, not forked', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const { forked } = engine(on, clock)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await turn($, 't1')
  await $.turn.start({ turnId: 't2', text: 'and the invoices' })

  await probe($, 'ping')
  await clock.settle()

  expect(forked).toEqual([])
  expect(await probe($, 'report')).toMatch(/ping\s+skipped: a turn is running/)
})

// Figures from the first Pro-account run (2026-10-10): Claude Code's running
// total around the 11:50 turn, and that turn's one request.
const PRO_TURN: ProbeRecord[] = [
  { at: NOW, kind: 'turn', phase: 'start', turnId: 't', costUsd: 0.41882669 },
  {
    at: NOW + 11_000,
    kind: 'step',
    turnId: 't',
    model: 'claude-opus-5-5',
    startedAt: NOW,
    tokens: { input: 2, output: 790, cacheRead: 61_084, cacheWrite: 5_398 },
  },
  { at: NOW + 11_100, kind: 'turn', phase: 'end', turnId: 't', costUsd: 0.49003549 },
]

test('a turn whose cost adds up only at $8/M writes is on the one-hour cache', async () => {
  const [turn] = turnCosts(PRO_TURN)
  expect(turn?.matches).toBe('1h')
  expect(Math.round((turn?.impliedWriteRate ?? 0) * 100) / 100).toBe(8)
  expect(Math.round((turn?.at5m ?? 0) * 10_000) / 10_000).toBe(0.055)
})

test('a turn that adds up at $5/M writes is on the five-minute cache', async () => {
  const records = PRO_TURN.map(r => (r.kind === 'turn' && r.phase === 'end' ? { ...r, costUsd: 0.41882669 + 0.0550 } : r))
  expect(turnCosts(records)[0]?.matches).toBe('5m')
})

test('a turn that writes too little to tell, or carries no totals, names no lifetime', async () => {
  const small = PRO_TURN.map(r => (r.kind === 'step' ? { ...r, tokens: { ...r.tokens, cacheWrite: 265 } } : r))
  expect(turnCosts(small)[0]?.matches).toBe('?')
  const old = PRO_TURN.map(r => (r.kind === 'turn' ? { ...r, costUsd: undefined } : r))
  expect(turnCosts(old)).toEqual([])
})

test('spend between a fork and the next turn that nothing logged explains is reported with its window', async () => {
  const snap = (costUsd: number) => ({ costUsd, rateLimits: [] })
  const records: ProbeRecord[] = [
    { at: NOW + 2_000, kind: 'fork', label: '+12m', startedAt: NOW, contextTokens: 67_274, result: 'answered', before: snap(0.5212883), after: snap(0.5350187) },
    { at: NOW + 18 * MIN, kind: 'turn', phase: 'start', turnId: 't', costUsd: 0.5567 },
    { at: NOW + 19 * MIN, kind: 'turn', phase: 'end', turnId: 't', costUsd: 0.5859 },
    { at: NOW + 30 * MIN, kind: 'turn', phase: 'start', turnId: 'u', costUsd: 0.5859 },
  ]
  const found = unattributedSpend(records)
  expect(found.length).toBe(1)
  expect(found[0]?.from).toBe(NOW + 2_000)
  expect(found[0]?.to).toBe(NOW + 18 * MIN)
  expect(Math.round((found[0]?.usd ?? 0) * 10_000) / 10_000).toBe(0.0217)
})

test("each turn logs Claude Code's running total at its start and end", async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const { files } = engine(on, clock)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await turn($, 't1')

  const turns = fromJsonl(files.get(LOG) ?? '').filter(r => r.kind === 'turn')
  expect(turns.map(r => (r.kind === 'turn' ? r.costUsd : null))).toEqual([1, 1])
})
