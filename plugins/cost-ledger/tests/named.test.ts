import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { impliedTtl } from '../hooks/keepalive'
import type { SessionEntry } from '../hooks/ledger'
import { namedLifetime, priceUsage, rateTable, ratesFor } from '../hooks/pricing'
import { complete, engine, memoryStore, measure, NOW, PANE, runStep, usage } from './support'

// Opus 5.5 writes to the cache at $5 a million tokens for five minutes and $8
// for an hour.
const OPUS = ratesFor(rateTable(''), 'claude-opus-5-5', 0)
if (OPUS === undefined) throw new Error('no rate for Opus 5.5')

// A request that wrote `fiveMinutes` and `oneHour` tokens to the cache and
// said so, as the API's responses do; `unnamed` more that it did not name.
const named = (fiveMinutes: number, oneHour: number, unnamed = 0, cacheRead = 0) => ({
  ...usage(cacheRead, fiveMinutes + oneHour + unnamed),
  ephemeral_5m_input_tokens: fiveMinutes,
  ephemeral_1h_input_tokens: oneHour,
})

const micro = (usd: number) => Math.round(usd * 1e6)

const costs = async ($: Engine, args: string) => {
  const result = await $.command.run({ command: 'costs', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  return 'text' in result ? String(result.text) : ''
}

function sessionEngine(on: On, steps: ReturnType<typeof usage>[], stored: Record<string, unknown> = {}) {
  mock.clock(on, { now: NOW })
  const store = memoryStore(on, stored)
  const session = { usd: 0 }
  const toasts = engine(on, steps, 'claude-opus-5-5', session)
  const writes = () => toasts.filter(toast => toast.includes('to the prompt cache'))
  const storedWrites = () => {
    const entry = store.get('session:s1') as SessionEntry | undefined
    return micro(Object.values(entry?.cache ?? {}).reduce((sum, day) => sum + day.usd.cacheWrite, 0))
  }
  return { store, session, toasts, writes, storedWrites }
}

test('writes a response names are priced at the lifetime it names, whatever is assumed', async () => {
  expect(micro(priceUsage(named(40_000, 60_000), OPUS, '5m').usd.cacheWrite)).toBe(680_000)
  expect(micro(priceUsage(named(40_000, 60_000), OPUS, '1h').usd.cacheWrite)).toBe(680_000)
  expect(micro(priceUsage(named(0, 100_000), OPUS, '5m').usd.cacheWrite)).toBe(800_000)
  expect(micro(priceUsage(named(100_000, 0), OPUS, '1h').usd.cacheWrite)).toBe(500_000)
  expect(priceUsage(named(40_000, 60_000), OPUS, '5m').tokens.cacheWrite).toBe(100_000)
})

test('writes a response names no lifetime for are priced at the one assumed', async () => {
  expect(micro(priceUsage(usage(0, 100_000), OPUS, '5m').usd.cacheWrite)).toBe(500_000)
  expect(micro(priceUsage(usage(0, 100_000), OPUS, '1h').usd.cacheWrite)).toBe(800_000)
})

test('what a naming response leaves unnamed is priced at five minutes, as Claude Code prices it', async () => {
  // 20k for five minutes, 30k for an hour, and 50k it gave no lifetime for.
  expect(micro(priceUsage(named(20_000, 30_000, 50_000), OPUS, '1h').usd.cacheWrite)).toBe(100_000 + 240_000 + 250_000)
})

test('a count that is no number is read as naming nothing', async () => {
  const odd = { ...usage(0, 100_000), ephemeral_5m_input_tokens: Number.NaN, ephemeral_1h_input_tokens: 100_000 }
  const half = { ...usage(0, 100_000), ephemeral_1h_input_tokens: 100_000 }

  // Priced at whichever lifetime is assumed, as a response with no counts is.
  for (const unnamed of [odd, half]) {
    expect(micro(priceUsage(unnamed, OPUS, '5m').usd.cacheWrite)).toBe(500_000)
    expect(micro(priceUsage(unnamed, OPUS, '1h').usd.cacheWrite)).toBe(800_000)
    expect(namedLifetime(unnamed)).toBeUndefined()
  }
})

test('counts that come to more than was written are held to what was written, and tell no lifetime', async () => {
  const over = { ...usage(0, 100_000), ephemeral_5m_input_tokens: 80_000, ephemeral_1h_input_tokens: 80_000 }
  const overAtFive = { ...usage(0, 100_000), ephemeral_5m_input_tokens: 100_000, ephemeral_1h_input_tokens: 20_000 }

  // The hour's share first, the rest of the whole at five minutes.
  expect(micro(priceUsage(over, OPUS, '5m').usd.cacheWrite)).toBe(640_000 + 100_000)
  expect(micro(priceUsage(overAtFive, OPUS, '5m').usd.cacheWrite)).toBe(160_000 + 400_000)
  // Part of it is priced at the hour, so it does not show five minutes.
  expect(namedLifetime(over)).toBeUndefined()
  expect(namedLifetime(overAtFive)).toBeUndefined()
})

test('a request tells the lifetime only when all it wrote was named for the one', async () => {
  expect(namedLifetime(named(0, 100_000))).toBe('1h')
  expect(namedLifetime(named(100_000, 0))).toBe('5m')
  expect(namedLifetime(named(40_000, 60_000))).toBeUndefined()
  expect(namedLifetime(named(0, 50_000, 50_000))).toBeUndefined()
  expect(namedLifetime(named(0, 0))).toBeUndefined()
  expect(namedLifetime(usage(0, 100_000))).toBeUndefined()
})

test('a turn tells the lifetime of its unnamed writes with its named ones taken as known', async () => {
  const withNames = { usage: named(0, 100_000, 0, 50_000), rates: OPUS }
  const without = { usage: usage(0, 10_000), rates: OPUS }
  const known = 0.8 + 0.01

  expect(impliedTtl(known + 0.08, [withNames, without])).toBe('1h')
  expect(impliedTtl(known + 0.05, [withNames, without])).toBe('5m')
  // Every write named: the turn's total has nothing left to tell.
  expect(impliedTtl(known, [withNames])).toBeUndefined()
})

test("a session's first request is priced at the hour it names, and the session is on the one-hour cache from then", async ($, on) => {
  const { writes, storedWrites, store } = sessionEngine(on, [named(0, 100_000)])
  await $.session.measure(measure(0))

  await $.turn.start({ turnId: 't1', text: 'read the billing module' })
  await runStep($, 't1')

  // Before the turn has ended, so before its total could have shown anything.
  expect(writes()).toHaveLength(1)
  expect(writes()[0]).toMatch(/wrote 100k tokens .*≈ \$0\.80 on/)
  expect(storedWrites()).toBe(800_000)
  expect(store.get('learnedCacheTtl')).toBe('1h')
  expect(await costs($, 'keepalive')).toMatch(/cache lifetime 1h/)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ text: /cache warm 60m/ })).toBeDefined()
})

test('a request that names five minutes brings a session down from the hour it had learned', async ($, on) => {
  const { writes } = sessionEngine(on, [named(100_000, 0), usage(0, 100_000)], { learnedCacheTtl: '1h' })
  await $.session.measure(measure(0))

  await runStep($, 't1')
  // The next request names nothing and is priced at what the session now knows.
  await runStep($, 't1')

  expect(writes().map(toast => /≈ (\$\d\.\d\d)/.exec(toast)?.[1])).toEqual(['$0.50', '$0.50'])
  expect(await costs($, 'keepalive')).toMatch(/cache lifetime 5m/)
})

test('a turn whose writes were named is not priced again by what it moved the total', async ($, on) => {
  const { session, storedWrites, store } = sessionEngine(on, [named(100_000, 0), named(100_000, 0)])
  await $.session.measure(measure(0))

  // Two requests at five minutes come to $1.00. The total moves by $1.60, as
  // it would at the one-hour rate: other spend, not a lifetime.
  await $.turn.start({ turnId: 't1', text: 'read the billing module' })
  await runStep($, 't1')
  await runStep($, 't1')
  session.usd += 1.6
  await $.turn.complete(complete('t1'))

  expect(storedWrites()).toBe(1_000_000)
  expect(store.get('learnedCacheTtl')).toBe('5m')
})

test("a subagent's writes are priced as it names them and teach the conversation nothing", async ($, on) => {
  const { writes, store } = sessionEngine(on, [named(0, 100_000), usage(0, 100_000)])
  await $.session.measure(measure(0))

  await runStep($, 'a1', 'agent-1')
  await runStep($, 't1')

  // The subagent named an hour and is priced at it. The conversation's own
  // request names nothing and is still on the five minutes it started from.
  expect(writes().map(toast => /≈ (\$\d\.\d\d)/.exec(toast)?.[1])).toEqual(['$0.80', '$0.50'])
  expect(store.get('learnedCacheTtl')).toBeUndefined()
})

test('the cacheTtl setting keeps the countdown and the unnamed writes; named writes are priced as named', { options: { cacheTtl: '5m' } }, async ($, on) => {
  const { writes, store } = sessionEngine(on, [named(0, 100_000), usage(0, 100_000)])
  await $.session.measure(measure(0))

  await runStep($, 't1')
  await runStep($, 't1')

  expect(writes().map(toast => /≈ (\$\d\.\d\d)/.exec(toast)?.[1])).toEqual(['$0.80', '$0.50'])
  expect(await costs($, 'keepalive')).toMatch(/cache lifetime 5m/)
  expect(store.get('learnedCacheTtl')).toBeUndefined()
})

test('a tool result is charged its write at the rate its request named', async ($, on) => {
  sessionEngine(on, [named(0, 100_000), usage(100_000, 0)])
  on('tool.call', () => ({ result: 'file', text: 'x'.repeat(400_000) }))
  await $.session.measure(measure(1))

  await $.tool.call({ tool: 'Read', file_path: 'big.ts' })
  await runStep($, 't1')
  await runStep($, 't1')

  // 100k tokens written at the hour's $8 a million, then read once at $0.20.
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ text: /^Read\s+1\s+100k\s+\$0\.80\s+\$0\.02$/ })).toBeDefined()
})

test('/costs doctor says the lifetime came from what the requests named', async ($, on) => {
  sessionEngine(on, [named(0, 100_000)])
  mock.env(on, {})
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('fs.list', () => ({ value: [] }))
  await $.session.measure(measure(0))

  await runStep($, 't1')

  expect(await costs($, 'doctor')).toMatch(/ℹ Cache lifetime: using 1h \(setting: auto; this session: 1h, named by its requests' cache writes\)/)
})

test('when a turn shows its unnamed writes at the other lifetime, only those are priced again', async ($, on) => {
  const { session, storedWrites, store } = sessionEngine(on, [named(100_000, 0), usage(0, 100_000)])
  await $.session.measure(measure(0))

  // The first request names five minutes: $0.50, and known. The second names
  // nothing and is priced at five minutes as it runs, but the turn's total
  // shows it was charged at the hour: $0.80.
  await $.turn.start({ turnId: 't1', text: 'read the billing module' })
  await runStep($, 't1')
  await runStep($, 't1')
  session.usd += 0.5 + 0.8
  await $.turn.complete(complete('t1'))

  expect(storedWrites()).toBe(1_300_000)
  // What the first request named stands: a turn's total does not overrule it.
  expect(store.get('learnedCacheTtl')).toBe('5m')
  expect(await costs($, 'keepalive on')).toMatch(/cache lifetime 5m\.\n.*Next ping in 5 min/s)
})

test('an unnamed write priced at a lifetime named earlier in its turn is put right, and the lifetime stays', async ($, on) => {
  const { session, storedWrites, store } = sessionEngine(on, [named(0, 100_000), usage(0, 100_000)])
  await $.session.measure(measure(0))

  // The first request names the hour: $0.80. The second names nothing and is
  // priced at the hour too, but the total shows it at five minutes: $0.50.
  await $.turn.start({ turnId: 't1', text: 'read the billing module' })
  await runStep($, 't1')
  await runStep($, 't1')
  session.usd += 0.8 + 0.5
  await $.turn.complete(complete('t1'))

  expect(storedWrites()).toBe(1_300_000)
  expect(store.get('learnedCacheTtl')).toBe('1h')
})

test('the keep-alive pings at nine tenths of the lifetime a request named', async ($, on) => {
  sessionEngine(on, [named(0, 100_000)])
  await $.session.measure(measure(0))

  await runStep($, 't1')

  expect(await costs($, 'keepalive on')).toMatch(/cache lifetime 1h\.\nNext ping in 54 min/)
})

test('a headless session keeps the lifetime its requests named apart from an interactive one', async ($, on) => {
  const { store } = sessionEngine(on, [named(0, 100_000)])
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: 'C:/work/billing-api', surface: null, isInteractive: false })

  await runStep($, 't1')

  expect(store.get('learnedCacheTtlHeadless')).toBe('1h')
  expect(store.get('learnedCacheTtl')).toBeUndefined()
})

test('a tool result written by a request that wrote to both caches is charged the rate the two came to', async ($, on) => {
  sessionEngine(on, [named(50_000, 50_000)])
  on('tool.call', () => ({ result: 'file', text: 'x'.repeat(400_000) }))
  await $.session.measure(measure(1))

  await $.tool.call({ tool: 'Read', file_path: 'big.ts' })
  await runStep($, 't1')

  // Half at $5 a million and half at $8: $6.50 a million over its 100k tokens.
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ text: /^Read\s+1\s+100k\s+\$0\.65\s+\$0\.00$/ })).toBeDefined()
})
