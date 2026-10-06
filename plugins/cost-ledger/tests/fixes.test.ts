import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { addSpend, mergeEntries, pruneDays, summarize } from '../hooks/ledger'
import type { SessionEntry } from '../hooks/ledger'
import { priceUsage, rateTable, ratesFor } from '../hooks/pricing'

const NOW = new Date(2026, 9, 6, 12).getTime()
const DAY = 24 * 60 * 60 * 1000
const ROOT = 'C:/work/billing-api'

const PANE = {
  plugin: 'cost-ledger',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'cost-ledger',
  props: {
    title: 'Costs',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 80 },
    view: {},
  },
} as const

const measure = (usd: number) => ({
  context: { window: 200_000 },
  rateLimits: [],
  cost: { usd },
  changed: ['cost' as const],
})

// The engine beneath the plugin: a session whose id and running cost the test
// moves, the way /clear and /resume move them.
function engine(on: On) {
  const session = { id: 's1', usd: 0 }
  const toasts: string[] = []
  const statuses: (string | undefined)[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_$, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('session.id', () => ({ value: session.id }))
  on('session.root', () => ({ value: ROOT }))
  on('session.usage', () => ({
    value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: [], cost: { usd: session.usd } },
  }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('classic.PostModelSwitch', () => ({}))
  return { session, toasts, statuses }
}

const classicStart = (source: 'clear' | 'resume' | 'compact', session_id: string) => ({
  source,
  session_id,
  transcript_path: '',
  cwd: ROOT,
})

async function todayShown($: Engine) {
  const ui = await $.ui.mount(PANE)
  const row = await ui.find({ text: /^Today/ })
  await ui.unmount()
  return row?.text
}

test('/clear and /resume inside one process neither lose nor double-count spend', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const { session } = engine(on)

  session.usd = 5
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
  session.usd = 6
  await $.session.measure(measure(6))

  session.usd = 6.4
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
  session.id = 's2'
  session.usd = 0
  await $.classic.SessionStart(classicStart('clear', 's2'))
  session.usd = 0.5
  await $.session.measure(measure(0.5))

  await $.session.end({ reason: 'resume', sessionId: 's2', resume: { id: 's2' } } as never)
  session.id = 's3'
  session.usd = 20
  await $.classic.SessionStart(classicStart('resume', 's3'))
  session.usd = 20.3
  await $.session.measure(measure(20.3))

  expect(await todayShown($)).toMatch(/\$2\.20/)
})

test('/clear forgets the context, so an idle prompt after it raises no cache warning', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  const { toasts } = engine(on)
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        input_tokens: 1_000,
        output_tokens: 1_000,
        cache_read_input_tokens: 150_000,
        cache_creation_input_tokens: 1_000,
        model: 'claude-opus-5-5',
      },
    }
  })
  on('prompt.submit', (_$, e) => ({ text: e.text }))

  const step = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
  for await (const _ of step) {
    // the response's chunks are not under test
  }
  await $.classic.SessionStart(classicStart('clear', 's2'))
  await clock.advance(10 * 60_000)
  await $.prompt.submit({ text: 'fresh start', wait: false, origin: { kind: 'composer' } })

  expect(toasts.filter(t => t.includes('Prompt cache'))).toEqual([])
})

test('a cache lifetime reported after a model switch is used for the idle warning', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  const { toasts } = engine(on)
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 100_000,
        cache_creation_input_tokens: 0,
        model: 'claude-opus-5-5',
      },
    }
  })
  on('prompt.submit', (_$, e) => ({ text: e.text }))

  await $.classic.PostModelSwitch({
    session_id: 's1',
    transcript_path: '',
    cwd: ROOT,
    from_model: 'claude-sonnet-5-5',
    to_model: 'claude-opus-5-5',
    requested_model: 'opus',
    source: 'command',
    context_tokens: 0,
    prompt_cache_warm: false,
    cache_ttl: '1h',
    estimated_cache_write_usd: 0,
    pricing: 'catalog',
  })
  const step = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
  for await (const _ of step) {
    // the response's chunks are not under test
  }
  await clock.advance(20 * 60_000)
  await $.prompt.submit({ text: 'back', wait: false, origin: { kind: 'composer' } })

  expect(toasts.filter(t => t.includes('Prompt cache'))).toEqual([])
})

test('a spend that could not be saved is counted by the next measurement', async ($, on) => {
  mock.clock(on, { now: NOW })
  const { toasts } = engine(on)
  const store = new Map<string, unknown>()
  let isFull = true
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.delete', (_$, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.set', (_$, e) => {
    if (isFull && e.key.startsWith('session:')) return { deny: 'store over 4 MiB' }
    store.set(e.key, e.value)
    return { value: undefined }
  })

  await $.session.measure(measure(1))
  expect(toasts.some(t => t.includes('could not save'))).toBe(true)

  isFull = false
  await $.session.measure(measure(1.5))
  expect(await todayShown($)).toMatch(/\$1\.50/)
})

test('raising a budget after it was reached announces the new budget', { options: { weeklyBudget: 20 } }, async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on, { 'budget:week:2026-10-05:10': 1 })
  const { toasts } = engine(on)

  await $.session.measure(measure(17))

  expect(toasts).toContain('Weekly budget at 80%: $17.00 of $20.00.')
})

test('turning the status line off clears it', { options: { statusLine: false } }, async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const { statuses } = engine(on)

  await $.session.measure(measure(1))

  expect(statuses.length).toBeGreaterThan(0)
  expect(statuses.every(s => s === undefined)).toBe(true)
})

test('old sessions fold into one archive per project without changing any total', async () => {
  const old = addSpend(undefined, NOW - 90 * DAY, 3, ROOT)
  const older = addSpend(undefined, NOW - 120 * DAY, 4, ROOT)

  const archive = mergeEntries(mergeEntries(undefined, old), older)

  expect(summarize([archive], NOW).days).toEqual(summarize([old, older], NOW).days)
  expect(archive.project).toBe(ROOT)
})

test('days past retention are dropped, and an entry with none left goes', async () => {
  const entry: SessionEntry = addSpend(addSpend(undefined, NOW - 500 * DAY, 9, ROOT), NOW - 10 * DAY, 1, ROOT)

  expect(Object.values(pruneDays(entry, NOW)?.days ?? {})).toEqual([1])
  expect(pruneDays(addSpend(undefined, NOW - 500 * DAY, 9, ROOT), NOW)).toBeUndefined()
})

test('an override for an older version does not claim a newer one', async () => {
  const table = rateTable('{"claude-opus-5": {"input": 99, "output": 99, "cacheRead": 9}}')

  expect(ratesFor(table, 'claude-opus-5-5')?.input).toBe(4)
  expect(ratesFor(table, 'claude-opus-5')?.input).toBe(99)
  expect(ratesFor(table, 'us.anthropic.claude-opus-5-v1:0')?.input).toBe(99)
})

test('a dated model id still finds its family', async () => {
  expect(ratesFor(rateTable(''), 'claude-sonnet-4-6-20260101')?.input).toBe(3)
})

test('malformed rates never fail the mod and are named in the error', async () => {
  for (const json of ['null', '[]', '"cheap"', '{"opus-6": null}', '{"opus-6": {"input": 1}}']) {
    const table = rateTable(json)
    expect(table.error).toBeDefined()
    expect(ratesFor(table, 'claude-opus-5-5')?.input).toBe(4)
  }
})

test('tokens from a model with no rate are counted as unpriced, not as free', async () => {
  const priced = priceUsage(
    { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 },
    ratesFor(rateTable(''), 'claude-opus-4-5'),
    '5m',
  )

  expect(priced.unpricedTokens).toBe(100)
})
