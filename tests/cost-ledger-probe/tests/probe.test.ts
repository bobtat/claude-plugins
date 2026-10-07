import { expect, mock, test } from 'claude-code/testing'

import { contextOf, fromJsonl, parseCommand, report, scheduleDelays } from '../hooks/probe'
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
