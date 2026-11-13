import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { addSpend, daysFrom, dayKey, markFolded, mergeEntries } from '../hooks/ledger'
import type { SessionEntry } from '../hooks/ledger'
import { DAY, measure, NOW, ROOT } from './support'

const ARCHIVE = `archive:${ROOT}`
const OLD_A = addSpend(undefined, NOW - 90 * DAY, 3, ROOT)
const OLD_B = addSpend(undefined, NOW - 120 * DAY, 4, ROOT)
const RECENT = addSpend(undefined, NOW - DAY, 1, ROOT)

const total = (entry: unknown) => Object.values((entry as SessionEntry | undefined)?.days ?? {}).reduce((sum, usd) => sum + usd, 0)

type StoreOptions = {
  // A write another process overwrote: reported as made, never stored.
  loses?: (key: string) => boolean
  refusesDelete?: (key: string) => boolean
  // Keys the store lists but no longer holds: removed by another process
  // between the listing and the read.
  vanished?: string[]
}

// The engine beneath the plugin, with a store the test fills and reads.
function engine(on: On, stored: Record<string, unknown>, opts: StoreOptions = {}) {
  const store = new Map<string, unknown>(Object.entries(stored))
  const session = { usd: 0 }
  const toasts: string[] = []
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.keys', () => ({ value: [...store.keys(), ...(opts.vanished ?? [])] }))
  on('store.set', (_$, e) => {
    if (!opts.loses?.(e.key)) store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_$, e) => {
    if (opts.refusesDelete?.(e.key)) return { deny: 'the store file is locked' }
    store.delete(e.key)
    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('session.id', () => ({ value: 'now' }))
  on('session.root', () => ({ value: ROOT }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: [], cost: { usd: session.usd } } }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  return { store, session, toasts }
}

const start = ($: Engine) => $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })

test('sessions untouched for 60 days are folded into their project archive and removed', async ($, on) => {
  mock.clock(on, { now: NOW })
  const { store } = engine(on, { 'session:a': OLD_A, 'session:b': OLD_B, 'session:c': RECENT })

  await start($)

  expect([...store.keys()].filter(key => key.startsWith('session:'))).toEqual(['session:c'])
  expect(total(store.get(ARCHIVE))).toBe(7)
})

test('a session that is still there after its fold is removed, not folded a second time', async ($, on) => {
  mock.clock(on, { now: NOW })
  const { store } = engine(on, { 'session:a': OLD_A, 'session:b': OLD_B })
  await start($)

  // Another process that read the store before the fold writes the session
  // back, or the first one stopped before removing it.
  store.set('session:a', OLD_A)
  await start($)

  expect(total(store.get(ARCHIVE))).toBe(7)
  expect(store.has('session:a')).toBe(false)
})

test('a fold whose archive did not keep it leaves the session in place', async ($, on) => {
  mock.clock(on, { now: NOW })
  const { store } = engine(on, { 'session:a': OLD_A }, { loses: key => key === ARCHIVE })

  await start($)

  expect(total(store.get('session:a'))).toBe(3)
})

test('a session resumed after its fold keeps what it has spent since, and only that', async ($, on) => {
  mock.clock(on, { now: NOW })
  const folded = markFolded(mergeEntries(undefined, OLD_A), 'session:a', NOW - 2 * 60 * 60 * 1000)
  const resumed = addSpend(OLD_A, NOW - 60 * 60 * 1000, 2, ROOT)
  const { store } = engine(on, { [ARCHIVE]: folded, 'session:a': resumed })

  await start($)

  expect((store.get('session:a') as SessionEntry).days).toEqual({ [dayKey(NOW)]: 2 })
  expect(total(store.get(ARCHIVE))).toBe(3)
})

test('an archive forgets a fold a day after it, once the session is gone', async ($, on) => {
  mock.clock(on, { now: NOW })
  const archive = markFolded(markFolded(mergeEntries(undefined, OLD_A), 'session:a', NOW - 2 * DAY), 'session:b', NOW - 60_000)
  const { store } = engine(on, { [ARCHIVE]: archive })

  await start($)

  expect(Object.keys((store.get(ARCHIVE) as SessionEntry).folded ?? {})).toEqual(['session:b'])
  expect(total(store.get(ARCHIVE))).toBe(3)
})

test('a folded session that has not been removed yet is counted once, with what it has spent since', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.env(on, { USERPROFILE: 'C:\\Users\\someone' })
  const folded = markFolded(mergeEntries(undefined, OLD_A), 'session:a', NOW - 2 * 60 * 60 * 1000)
  engine(on, { [ARCHIVE]: folded, 'session:a': addSpend(OLD_A, NOW - 60 * 60 * 1000, 2, ROOT) })
  const written: string[] = []
  on('fs.write', (_$, e) => {
    written.push(e.text)
    return { value: undefined }
  })

  await $.command.run({ command: 'costs', args: 'export', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })

  const rows = (written[0] ?? '').trimEnd().split('\n').slice(1).map(row => row.split(',').slice(0, 3).join(','))
  expect(rows).toEqual([`${dayKey(NOW - 90 * DAY)},${ROOT},3.0000`, `${dayKey(NOW)},${ROOT},2.0000`])
})

test('an archive carries its folds through a merge, and a session keeps only the days from a given one', async () => {
  const archive = markFolded(mergeEntries(undefined, OLD_A), 'session:a', NOW)
  expect(mergeEntries(archive, OLD_B).folded).toEqual({ 'session:a': NOW })

  const both = addSpend(OLD_A, NOW, 2, ROOT)
  expect(daysFrom(both, dayKey(NOW))?.days).toEqual({ [dayKey(NOW)]: 2 })
  expect(daysFrom(OLD_A, dayKey(NOW))).toBeUndefined()
})
