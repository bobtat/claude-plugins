import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { checkPing, coldEstimate, impliedTtl, pingDelay, pingHit } from '../hooks/keepalive'
import { rateTable, ratesFor } from '../hooks/pricing'
import { NOW, ROOT } from './support'

// Figures from the probe runs on a Pro account (tests/cost-ledger-probe).
const OPUS = ratesFor(rateTable(''), 'claude-opus-5-5')!
const MIN = 60_000
const usage = (input: number, cacheRead: number, cacheWrite: number, output: number) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: cacheWrite,
})
// The 11:50 turn of 2026-10-10: Claude Code's total moved $0.07121.
const TURN = usage(2, 61_084, 5_398, 790)
const TURN_DELTA = 0.49003549 - 0.41882669
// The 55-minute ping of 2026-10-11, and the cold request 7.3 hours later.
const WARM_PING = usage(49, 62_139, 1_446, 4)
const COLD = usage(2, 29_130, 41_919, 40)

test('a turn that adds up only at $8/M writes was charged the one-hour cache', async () => {
  expect(impliedTtl(TURN_DELTA, [{ usage: TURN, rates: OPUS }])).toBe('1h')
  expect(impliedTtl(0.341986, [{ usage: COLD, rates: OPUS }])).toBe('1h')
})

test('a request that adds up at $5/M writes was charged the five-minute cache', async () => {
  // The first ping of 2026-10-10: $0.0374 with its 4,981 written tokens at $5/M.
  expect(impliedTtl(0.0374, [{ usage: usage(49, 61_084, 4_981, 4), rates: OPUS }])).toBe('5m')
})

test('a turn that writes too little, or adds up neither way, says nothing about the lifetime', async () => {
  expect(impliedTtl(0.03, [{ usage: usage(2, 67_272, 265, 680), rates: OPUS }])).toBeUndefined()
  expect(impliedTtl(TURN_DELTA + 0.02, [{ usage: TURN, rates: OPUS }])).toBeUndefined()
})

test('a cold resume costs the conversation; the whole context is the worst case', async () => {
  const cold = coldEstimate(71_051, 29_130, OPUS.cacheWrite1h)
  expect(cold.likelyTokens).toBe(41_921)
  expect(Math.round(cold.likelyUsd * 100) / 100).toBe(0.34)
  expect(Math.round(cold.worstUsd * 100) / 100).toBe(0.57)
  expect(coldEstimate(10_000, 0, OPUS.cacheWrite1h).likelyTokens).toBe(10_000)
  expect(coldEstimate(10_000, 30_000, OPUS.cacheWrite1h).likelyTokens).toBe(0)
})

test('a ping is due at nine tenths of the lifetime after the cache was last used', async () => {
  expect(pingDelay(NOW, '1h', NOW)).toBe(54 * MIN)
  expect(pingDelay(NOW, '5m', NOW)).toBe(4.5 * MIN)
  expect(pingDelay(NOW, '1h', NOW + 2 * 60 * MIN)).toBe(0)
})

test('no ping goes out while off, mid-turn, for a small context or past the idle limit', async () => {
  const base = { isOn: true, isTurnRunning: false, contextTokens: 60_000, minContextTokens: 20_000, idleSince: NOW, maxIdleMs: 180 * MIN, now: NOW + 54 * MIN }
  expect(checkPing(base)).toEqual({ isDue: true })
  expect(checkPing({ ...base, isOn: false })).toEqual({ isDue: false, why: 'off' })
  expect(checkPing({ ...base, isTurnRunning: true })).toEqual({ isDue: false, why: 'turn running' })
  expect(checkPing({ ...base, contextTokens: 10_000 })).toEqual({ isDue: false, why: 'small context' })
  expect(checkPing({ ...base, now: NOW + 180 * MIN })).toEqual({ isDue: false, why: 'idle too long' })
})

test('a ping that wrote only the tail kept the cache; one that wrote the conversation found it cold', async () => {
  expect(pingHit(WARM_PING, 1_446)).toBe(true)
  expect(pingHit(usage(49, 67_272, 0, 4), 790)).toBe(true)
  expect(pingHit(COLD, 1_446)).toBe(false)
  expect(pingHit(WARM_PING)).toBe(true)
  expect(pingHit(COLD)).toBe(false)
})

// The engine beneath the plugin: Claude Code's running total grows by each
// request's list price at the given write rate, and every fork answers with
// the next of `forks`.
function engine(on: On, clock: MockClock, opts: { step?: ReturnType<typeof usage>; forks?: ReturnType<typeof usage>[] } = {}) {
  const session = { usd: 0 }
  const toasts: string[] = []
  const forked: number[] = []
  const price = (u: ReturnType<typeof usage>, write: number) =>
    (u.input_tokens * OPUS.input + u.cache_read_input_tokens * OPUS.cacheRead + u.output_tokens * OPUS.output + u.cache_creation_input_tokens * write) / 1e6
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.root', () => ({ value: ROOT }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 1_000_000 }, rateLimits: [], cost: { usd: session.usd } } }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.step', async function* (_$, e) {
    const u = opts.step ?? TURN
    session.usd += price(u, OPUS.cacheWrite1h)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { ...u, model: 'claude-opus-5-5' } }
  })
  on('model.fork', () => {
    forked.push(clock.now())
    const u = opts.forks?.shift() ?? WARM_PING
    session.usd += price(u, OPUS.cacheWrite5m)
    return { value: { isAnswered: true, text: 'ok', usage: u } }
  })
  return { session, toasts, forked }
}

async function turn($: Engine, turnId: string) {
  await $.turn.start({ turnId, text: 'read the billing module' })
  for await (const _ of $.turn.step({ turnId, index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // the response's chunks are not under test
  }
  await $.turn.complete({ answer: '', durationMs: 0, isAborted: false, turnId, reason: 'answer' })
}

async function costs($: Engine, args: string) {
  const result = await $.command.run({ command: 'costs', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  return 'text' in result ? String(result.text) : ''
}

const start = ($: Engine) => $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })

test("the cache lifetime is learned from Claude Code's pricing of a turn", async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  engine(on, clock)
  await start($)

  expect(await costs($, 'keepalive')).toMatch(/cache lifetime 5m/)

  await turn($, 't1')

  expect(await costs($, 'keepalive')).toMatch(/cache lifetime 1h/)
})

test(
  'keep-alive pings before the cache expires, renews it, and stops past the idle limit',
  { options: { keepAlive: 'on', cacheTtl: '1h', keepAliveMaxIdleMinutes: 120 } },
  async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    mock.store(on)
    const { forked, toasts } = engine(on, clock, { step: usage(2, 61_084, 1_000, 1_446) })
    await start($)
    await turn($, 't1')
    const asked = clock.now()

    await clock.advance(4 * 60 * MIN)

    expect(forked).toEqual([asked + 54 * MIN, asked + 108 * MIN])
    expect(toasts.some(t => /Keep-alive stopped \(idle 162 min\).*re-caches it ≈\$/.test(t))).toBe(true)
    expect(await costs($, 'keepalive')).toMatch(/Keep-alive is on \(the keepAlive setting\); cache lifetime 1h\.\n2 pings this session/)
  },
)

test(
  'a ping that finds the cache cold stops the keep-alive and says so',
  { options: { keepAlive: 'on', cacheTtl: '1h' } },
  async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    mock.store(on)
    const { forked, toasts } = engine(on, clock, { step: usage(2, 61_084, 1_000, 1_446), forks: [COLD] })
    await start($)
    await turn($, 't1')

    await clock.advance(3 * 60 * MIN)

    expect(forked.length).toBe(1)
    expect(toasts.some(t => t.includes('Keep-alive stopped (a ping found the cache already cold)'))).toBe(true)
  },
)

test('keep-alive is off unless turned on, and /costs keepalive on turns it on for the session', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  const { forked } = engine(on, clock)
  await start($)
  await turn($, 't1')

  await clock.advance(2 * 60 * MIN)
  expect(forked).toEqual([])

  await turn($, 't2')
  const asked = clock.now()
  expect(await costs($, 'keepalive on')).toMatch(/Keep-alive is on \(\/costs keepalive for this session\)/)
  await clock.advance(60 * MIN)
  // The turns were priced at the one-hour rate, so that lifetime was learned
  // and the ping waited 54 minutes.
  expect(forked).toEqual([asked + 54 * MIN])
})

test('a prompt sent before a ping is due cancels it', { options: { keepAlive: 'on', cacheTtl: '1h' } }, async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  const { forked } = engine(on, clock)
  await start($)
  await turn($, 't1')

  await clock.advance(30 * MIN)
  await $.turn.start({ turnId: 't2', text: 'and the invoices' })
  await clock.advance(60 * MIN)

  expect(forked).toEqual([])
})

test('the idle warning prices a cold re-cache without the opening other sessions keep warm', { options: { cacheTtl: '1h' } }, async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  // The first request reads only the shared opening; later ones the context.
  const { toasts } = engine(on, clock, { step: usage(2, 29_130, 41_879, 40) })
  await start($)
  await turn($, 't1')

  await clock.advance(2 * 60 * MIN)
  await $.prompt.submit({ text: 'back', wait: false, origin: { kind: 'composer' } })

  expect(toasts.some(t => /idle 120 min, 1h cache\): this prompt re-writes ~42k–71k tokens ≈\$0\.34–\$0\.57/.test(t))).toBe(true)
})

test('a resumed session whose cache has likely expired shows the re-cache cost before any prompt', { options: { cacheTtl: '1h' } }, async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  const { toasts } = engine(on, clock)
  await start($)

  await $.classic.SessionStart({
    source: 'resume',
    session_id: 's2',
    transcript_path: '',
    cwd: ROOT,
    model: 'claude-opus-5-5',
    seconds_since_last_response: 7 * 3600,
    context_tokens: 71_051,
    prompt_cache_likely_expired: true,
  })

  expect(toasts.some(t => /cache has likely expired \(idle 420 min\): the first prompt re-writes ~71k tokens ≈\$0\.57/.test(t))).toBe(true)
})

test(
  'after a stop, the next prompt starts the keep-alive again',
  { options: { keepAlive: 'on', cacheTtl: '1h', keepAliveMaxIdleMinutes: 60 } },
  async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    mock.store(on)
    const { forked } = engine(on, clock, { step: usage(2, 61_084, 1_000, 1_446) })
    await start($)
    await turn($, 't1')
    await clock.advance(3 * 60 * MIN)
    expect(forked.length).toBe(1)
    expect(await costs($, 'keepalive')).toMatch(/Stopped: idle 108 min/)

    await turn($, 't2')
    const asked = clock.now()
    await clock.advance(60 * MIN)

    expect(forked).toEqual([NOW + 54 * MIN, asked + 54 * MIN])
    expect(await costs($, 'keepalive')).not.toMatch(/Stopped/)
  },
)
