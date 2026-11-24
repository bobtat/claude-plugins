import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { complete, engine, HOME, measure, NOW, ROOT, runStep, usage } from './support'

// A store that reads what it holds and takes nothing new: at its 4 MiB limit,
// or with its file locked.
function refusingStore(on: On, stored: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(stored))
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.set', () => ({ deny: 'the store would be over 4 MiB' }))
  on('store.delete', () => ({ deny: 'the store file is locked' }))
  return store
}

const SWITCH = {
  session_id: 's1',
  transcript_path: '',
  cwd: ROOT,
  from_model: 'claude-sonnet-5-5',
  to_model: 'claude-opus-5-5',
  requested_model: 'opus',
  source: 'command',
  context_tokens: 100_000,
  prompt_cache_warm: true,
  cache_ttl: '1h',
  estimated_cache_write_usd: 0.8,
  pricing: 'catalog',
} as const

const costs = async ($: Engine, args: string) => {
  const result = await $.command.run({ command: 'costs', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  return 'text' in result ? String(result.text) : ''
}

test('a budget is announced once where the store cannot remember that it was', { options: { weeklyBudget: 10 } }, async ($, on) => {
  mock.clock(on, { now: NOW })
  refusingStore(on, { 'session:earlier': { project: ROOT, days: { '2026-10-06': 8.5 }, updatedAt: NOW } })
  const toasts = engine(on)
  const budget = () => toasts.filter(toast => toast.includes('budget'))

  await $.session.measure(measure(1))
  await $.session.measure(measure(1))
  expect(budget()).toEqual(['Weekly budget at 80%: $8.50 of $10.00.'])

  await $.session.measure(measure(1))
  expect(budget()).toHaveLength(1)
})

test('/costs doctor still reports where the store takes no write', async ($, on) => {
  mock.clock(on, { now: NOW })
  refusingStore(on)
  engine(on)
  mock.env(on, { USERPROFILE: HOME })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  // Two store files, one nearly full: without a write that lands in its own,
  // the mod cannot tell which is which and gives the size of each.
  on('fs.list', () => ({
    value: ['cost-ledger_inline-abc.json', 'cost-ledger_marketplace-def.json'].map(name => ({ name, kind: 'file' as const, size: 10, mtimeMs: NOW, isLink: false })),
  }))
  on('fs.read', (_$, e) => ({ value: e.path.includes('inline') ? 'x'.repeat(4 * 1024 * 1000) : 'x'.repeat(100 * 1024) }))

  const report = await costs($, 'doctor')

  expect(report).toMatch(/^cost-ledger self-check/)
  expect(report).toMatch(/⚠ Store file: the store refused a write/)
  expect(report).toMatch(/⚠ Store size: .*cost-ledger_inline-abc\.json: 4000 KiB, 98% of the 4 MiB limit/)
  expect(report).toMatch(/ℹ Store size: .*cost-ledger_marketplace-def\.json: 100 KiB, 2% of the 4 MiB limit/)
  expect(report).toMatch(/Models: every model seen has a rate/)
})

test('a model switch is still warned of, and its cache lifetime kept, where the store takes no write', async ($, on) => {
  mock.clock(on, { now: NOW })
  refusingStore(on)
  const toasts = engine(on)
  on('classic.PreModelSwitch', () => ({}))
  on('classic.PostModelSwitch', () => ({}))

  await $.classic.PreModelSwitch(SWITCH)
  await $.classic.PostModelSwitch(SWITCH)

  expect(toasts.filter(toast => toast.includes('gives up a warm prompt cache'))).toHaveLength(1)
  expect(await costs($, 'keepalive')).toMatch(/cache lifetime 1h/)
})

test('a model with no price is named once, and its request still recorded in the session, where the store takes no write', async ($, on) => {
  mock.clock(on, { now: NOW })
  refusingStore(on)
  const toasts = engine(on, [usage(50_000, 1_000), usage(51_000, 1_000)], 'claude-opus-9')

  await $.session.measure(measure(1))
  await $.turn.start({ turnId: 't1', text: 'first' })
  await runStep($, 't1')
  await runStep($, 't1')
  await $.turn.complete(complete('t1'))

  expect(toasts.filter(toast => toast.includes('no price for claude-opus-9'))).toHaveLength(1)
  // The request reached the session's own state: the keep-alive knows the context.
  expect(await costs($, 'keepalive on')).toMatch(/Next ping in|below keepAliveMinContextTokens/)
})

test('a first request is still recorded in the session where the store cannot keep its shared opening', async ($, on) => {
  mock.clock(on, { now: NOW })
  refusingStore(on)
  engine(on, [usage(30_000, 20_000)])

  await $.session.measure(measure(1))
  await $.turn.start({ turnId: 't1', text: 'first' })
  await runStep($, 't1')
  await $.turn.complete(complete('t1'))

  expect(await costs($, 'keepalive on')).toMatch(/Next ping in/)
})

test('a price Claude Code quotes differently is said once where the store cannot keep the quote', async ($, on) => {
  mock.clock(on, { now: NOW })
  refusingStore(on)
  const toasts = engine(on)
  on('classic.PreModelSwitch', () => ({}))
  // Opus 5.5 writes at $8 a million tokens on the one-hour cache: $0.80 here.
  const apart = { ...SWITCH, prompt_cache_warm: false, estimated_cache_write_usd: 1.6 }
  const said = () => toasts.filter(toast => toast.includes('prices cache writes on claude-opus-5-5'))

  await $.classic.PreModelSwitch(apart)
  await $.classic.PreModelSwitch(apart)
  expect(said()).toHaveLength(1)

  await $.classic.PreModelSwitch({ ...apart, estimated_cache_write_usd: 0.8 })
  await $.classic.PreModelSwitch(apart)
  expect(said()).toHaveLength(2)
})

test('a quote that agrees in between is known of where the store kept the last one that differed', async ($, on) => {
  mock.clock(on, { now: NOW })
  const store = new Map<string, unknown>()
  let isRefusing = false
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.delete', () => ({ value: undefined }))
  on('store.set', (_$, e) => {
    if (isRefusing) return { deny: 'the store would be over 4 MiB' }
    store.set(e.key, e.value)
    return { value: undefined }
  })
  const toasts = engine(on)
  on('classic.PreModelSwitch', () => ({}))
  const apart = { ...SWITCH, prompt_cache_warm: false, estimated_cache_write_usd: 1.6 }
  const said = () => toasts.filter(toast => toast.includes('prices cache writes on claude-opus-5-5'))

  await $.classic.PreModelSwitch(apart)
  expect(said()).toHaveLength(1)

  // The store keeps the differing quote and then takes nothing more.
  isRefusing = true
  await $.classic.PreModelSwitch({ ...apart, estimated_cache_write_usd: 0.8 })
  await $.classic.PreModelSwitch(apart)
  expect(said()).toHaveLength(2)
})

test('a budget raised, or a new week, is announced where the store cannot remember the last', { options: { weeklyBudget: 10 } }, async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const week = 7 * 24 * 60 * 60 * 1000
  refusingStore(on, {
    'session:earlier': { project: ROOT, days: { '2026-10-06': 8.5 }, updatedAt: NOW },
    'session:later': { project: ROOT, days: { '2026-10-13': 9 }, updatedAt: NOW + week },
  })
  const toasts = engine(on)
  const budget = () => toasts.filter(toast => toast.includes('budget'))

  await $.session.measure(measure(1))
  await $.session.measure(measure(1))
  expect(budget()).toEqual(['Weekly budget at 80%: $8.50 of $10.00.'])

  await clock.advance(week)
  await $.session.measure(measure(1))
  await $.session.measure(measure(1))
  expect(budget()).toEqual(['Weekly budget at 80%: $8.50 of $10.00.', 'Weekly budget at 80%: $9.00 of $10.00.'])
})
