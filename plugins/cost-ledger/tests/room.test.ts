import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { addSpend, addTools, addTurn, addTurnMoves, addUsage, dayKey, isSettled, sessionsToFoldEarly, summarize } from '../hooks/ledger'
import type { SessionEntry } from '../hooks/ledger'
import { DAY, measure, NOW, ROOT } from './support'

const HOUR = 60 * 60 * 1000
const STORE_LIMIT = 4 * 1024 * 1024
const PROJECTS = [ROOT, 'C:/work/web', 'C:/work/infra']
const TOOLS = ['Bash', 'Read', 'Edit', 'Grep', 'Glob', 'Write', 'Agent', 'WebFetch', 'mcp__github__get_file_contents', 'mcp__github__list_commits']

// Amounts that add up exactly in binary, so a sum does not depend on the
// order its parts were added in.
const usage = (usd: number, tokens: number) => ({
  tokens: { input: tokens, output: tokens, cacheRead: tokens * 64, cacheWrite: tokens * 8 },
  usd: { input: usd / 8, output: usd / 8, cacheRead: usd / 2, cacheWrite: usd / 4 },
  unpricedTokens: 0,
})

// A session as a working day leaves it: its spend, its requests' breakdown
// with a subagent's share, ten prompts and the tools it used.
function session(n: number, at: number): SessionEntry {
  const project = PROJECTS[n % PROJECTS.length] ?? ROOT
  let entry = addSpend(undefined, at, 1 + (n % 4) / 4, project)
  entry = addUsage(entry, at, usage(1, 4096 + n), project, false)
  entry = addUsage(entry, at, usage(0.25, 1024 + n), project, true)
  for (let turn = 0; turn < 10; turn++) {
    entry = addTurn(entry, at, {
      at: at - turn * 60_000,
      prompt: `prompt ${turn} of session ${n}: look at the failing test and say why it fails before changing it`.slice(0, 80),
      project,
      steps: 12 + turn,
      subagentSteps: turn,
      // No two prompts cost the same, so which ten a month keeps is settled.
      usage: usage((n * 16 + turn) / 1024, 8192),
      subagentUsage: usage(turn / 32, 2048),
    })
  }
  const tools = Object.fromEntries(TOOLS.map((tool, i) => [tool, { calls: i + 1, tokens: 4096 * (i + 1), writeUsd: (i + 1) / 64, rereadUsd: (i + 1) / 16 }]))
  entry = addTools(entry, at, tools)
  return addTurnMoves(entry, at, 1, 1)
}

// Sessions spread over the days before `newestDaysAgo`, `perDay` to a day.
function sessions(count: number, perDay: number, newestDaysAgo = 2): Record<string, SessionEntry> {
  const stored: Record<string, SessionEntry> = {}
  for (let n = 0; n < count; n++) stored[`session:s${n}`] = session(n, NOW - (newestDaysAgo + Math.floor(n / perDay)) * DAY - (n % perDay) * 60_000)
  return stored
}

// The store's JSON text, as Claude Code counts it against the limit.
const sizeOf = (store: Map<string, unknown>) => JSON.stringify(Object.fromEntries(store)).length
const sizeOfPair = (key: string, value: unknown) => JSON.stringify(key).length + 1 + JSON.stringify(value).length + 1

// Recent sessions enough to fill the store to within a few characters of its
// limit: the last is padded to take up what room the others leave.
function fullStore(): Record<string, SessionEntry> {
  const stored = sessions(587, 13)
  const padded = (length: number) => {
    const at = NOW - 3 * DAY
    const turn = { at, prompt: 'x'.repeat(length), project: ROOT, steps: 1, subagentSteps: 0, usage: usage(0.5, 1024), subagentUsage: usage(0, 0) }
    return { ...stored, 'session:padded': addTurn(addSpend(undefined, at, 1, ROOT), at, turn) }
  }
  const room = STORE_LIMIT - JSON.stringify(padded(0)).length
  return padded(room - 8)
}

type StoreOptions = {
  // A write another process overwrote: reported as made, never stored.
  loses?: (key: string) => boolean
  refuses?: (key: string) => boolean
}

// The engine beneath the plugin, with a store that holds 4 MiB of JSON text
// and refuses a write past it, as Claude Code's does.
function engine(on: On, stored: Record<string, unknown>, opts: StoreOptions = {}) {
  const store = new Map<string, unknown>(Object.entries(stored))
  let size = sizeOf(store)
  const session = { usd: 0 }
  const toasts: string[] = []
  const weigh = (key: string) => (store.has(key) ? sizeOfPair(key, store.get(key)) : 0)
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.set', (_$, e) => {
    const next = size - weigh(e.key) + sizeOfPair(e.key, e.value)
    if (next > STORE_LIMIT) return { deny: 'the store would be over 4 MiB' }
    if (opts.refuses?.(e.key)) return { deny: 'the store file is locked' }
    if (opts.loses?.(e.key)) return { value: undefined }
    store.set(e.key, e.value)
    size = next
    return { value: undefined }
  })
  on('store.delete', (_$, e) => {
    size -= weigh(e.key)
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

// A store at its limit holds nearly six hundred sessions, and a start reads
// each of them several times through the test kit.
const FULL_STORE = { timeoutMs: 60_000 }

const start = ($: Engine) => $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })

const ledgerOf = (store: Map<string, unknown>) =>
  [...store].filter(([key]) => key.startsWith('session:') || key.startsWith('archive:')).map(([, entry]) => entry as SessionEntry)

const sessionKeys = (store: Map<string, unknown>) => [...store.keys()].filter(key => key.startsWith('session:'))

// Everything the pane, the status line and the export are drawn from.
function shown(entries: readonly SessionEntry[]) {
  const { turns, ...totals } = summarize(entries, NOW)
  const byCost = [...turns].sort((a, b) => a.at - b.at || a.prompt.localeCompare(b.prompt))
  return { ...totals, turns: byCost }
}

test('a session is settled once it has been idle a day and last recorded on an earlier day', async () => {
  const at = (ms: number) => addSpend(undefined, ms, 1, ROOT)

  expect(isSettled(at(NOW - 2 * DAY), NOW)).toBe(true)
  expect(isSettled(at(NOW - DAY - HOUR), NOW)).toBe(true)
  expect(isSettled(at(NOW - DAY + HOUR), NOW)).toBe(false)
  expect(isSettled(at(NOW - HOUR), NOW)).toBe(false)
  expect(isSettled(at(NOW), NOW)).toBe(false)
})

test('past a hundred sessions the longest idle are the ones to fold, and no others', async () => {
  const stored = Object.entries(sessions(130, 10)).map(([key, entry]) => ({ key, entry, bytes: 1000 }))

  const early = sessionsToFoldEarly(stored, NOW)

  expect(early).toHaveLength(30)
  const kept = stored.filter(s => !early.includes(s.key))
  const newestFolded = Math.max(...stored.filter(s => early.includes(s.key)).map(s => s.entry.updatedAt))
  expect(kept.every(s => s.entry.updatedAt > newestFolded)).toBe(true)
  expect(sessionsToFoldEarly(stored.slice(0, 100), NOW)).toEqual([])
})

test('sessions that together pass a mebibyte make room the same way, however few they are', async () => {
  const stored = Object.entries(sessions(20, 1)).map(([key, entry]) => ({ key, entry, bytes: 100 * 1024 }))

  const early = sessionsToFoldEarly(stored, NOW)

  expect(early).toHaveLength(10)
  expect(early).toContain('session:s19')
  expect(early).not.toContain('session:s0')
})

test('a session used within the last day is never folded early, however many there are', async () => {
  const recent = Object.fromEntries(Array.from({ length: 150 }, (_, n) => [`session:r${n}`, session(n, NOW - n * 60_000)]))
  const stored = Object.entries(recent).map(([key, entry]) => ({ key, entry, bytes: 20_000 }))

  expect(sessionsToFoldEarly(stored, NOW)).toEqual([])
})

test('a store filled with recent sessions is given room at the start, and goes on recording', FULL_STORE, async ($, on) => {
  mock.clock(on, { now: NOW })
  const stored = fullStore()
  const { store, session, toasts } = engine(on, stored)
  // The premise: every session is younger than the 60 days after which one is
  // archived, and together they have filled the store.
  expect(Object.values(stored).every(entry => NOW - entry.updatedAt < 60 * DAY)).toBe(true)
  expect(STORE_LIMIT - sizeOf(store)).toBeGreaterThanOrEqual(0)
  expect(STORE_LIMIT - sizeOf(store)).toBeLessThan(16)
  const before = shown(ledgerOf(store))
  session.usd = 5

  await start($)
  session.usd = 5.5
  await $.session.measure(measure(5.5))

  expect(toasts).toEqual([])
  expect((store.get('session:now') as SessionEntry | undefined)?.days).toEqual({ [dayKey(NOW)]: 0.5 })
  expect(sessionKeys(store)).toHaveLength(Object.keys(stored).length - 100 + 1)
  expect(STORE_LIMIT - sizeOf(store)).toBeGreaterThan(500_000)
  const { [dayKey(NOW)]: _today, ...earlierDays } = shown(ledgerOf(store)).days
  expect(earlierDays).toEqual(before.days)
})

test('the starts that follow bring a full store down to a hundred sessions, with every total as it was', FULL_STORE, async ($, on) => {
  mock.clock(on, { now: NOW })
  const { store, toasts } = engine(on, fullStore())
  const before = shown(ledgerOf(store))

  for (let starts = 0; starts < 5; starts++) await start($)

  expect(toasts).toEqual([])
  expect(sessionKeys(store)).toHaveLength(100)
  expect(sizeOf(store)).toBeLessThan(STORE_LIMIT / 2)
  expect(shown(ledgerOf(store))).toEqual(before)
})

test('folding sessions early changes nothing the pane or the export shows', async ($, on) => {
  mock.clock(on, { now: NOW })
  const { store } = engine(on, sessions(180, 8))
  const before = shown(ledgerOf(store))

  await start($)

  expect(sessionKeys(store)).toHaveLength(100)
  expect([...store.keys()].filter(key => key.startsWith('archive:')).sort()).toEqual(PROJECTS.map(p => `archive:${p}`).sort())
  expect(shown(ledgerOf(store))).toEqual(before)
})

test('one start folds a hundred sessions early and leaves the rest for the next', async ($, on) => {
  mock.clock(on, { now: NOW })
  const { store } = engine(on, sessions(260, 8))
  const before = shown(ledgerOf(store))

  await start($)
  expect(sessionKeys(store)).toHaveLength(160)
  // The longest idle went first.
  expect(store.has('session:s259')).toBe(false)
  expect(store.has('session:s100')).toBe(true)

  await start($)
  expect(sessionKeys(store)).toHaveLength(100)
  expect(shown(ledgerOf(store))).toEqual(before)
})

test('once the sessions are within bounds another start folds nothing and moves no total', async ($, on) => {
  mock.clock(on, { now: NOW })
  const { store } = engine(on, sessions(180, 8))
  await start($)
  const once = shown(ledgerOf(store))
  const keys = [...store.keys()].sort()

  await start($)

  expect([...store.keys()].sort()).toEqual(keys)
  expect(shown(ledgerOf(store))).toEqual(once)
})

test('a session folded early and then resumed keeps what it has spent since, and only that', async ($, on) => {
  mock.clock(on, { now: NOW })
  const { store } = engine(on, sessions(130, 10))
  await start($)
  expect(store.has('session:s129')).toBe(false)
  const before = shown(ledgerOf(store))

  // The session is resumed by a process that still holds its old entry, and
  // writes it back with today's spend added.
  store.set('session:s129', addSpend(session(129, NOW - 14 * DAY - 9 * 60_000), NOW, 2, PROJECTS[0] ?? ROOT))
  await start($)

  expect((store.get('session:s129') as SessionEntry).days).toEqual({ [dayKey(NOW)]: 2 })
  const after = shown(ledgerOf(store))
  expect(after.today).toBe(before.today + 2)
  expect(after.month).toBe(before.month + 2)
})

test('sessions old enough to archive are folded first, and do not count toward the hundred', async ($, on) => {
  mock.clock(on, { now: NOW })
  const old = Object.fromEntries(Array.from({ length: 30 }, (_, n) => [`session:old${n}`, session(n, NOW - (70 + n) * DAY)]))
  const { store } = engine(on, { ...old, ...sessions(100, 10) })
  const before = shown(ledgerOf(store))

  await start($)

  expect(sessionKeys(store).sort()).toEqual(Object.keys(sessions(100, 10)).sort())
  expect(shown(ledgerOf(store))).toEqual(before)
})

test('with room in the store, a session is removed only once its archive is seen to hold it', async ($, on) => {
  mock.clock(on, { now: NOW })
  const stored = sessions(130, 10)
  const { store } = engine(on, stored, { loses: key => key.startsWith('archive:') })

  await start($)

  expect(sessionKeys(store).sort()).toEqual(Object.keys(stored).sort())
})

test('a full store whose archives cannot be written keeps every session it had', FULL_STORE, async ($, on) => {
  mock.clock(on, { now: NOW })
  const stored = fullStore()
  const { store } = engine(on, stored, { refuses: key => key.startsWith('archive:') })
  const before = shown(ledgerOf(store))

  await start($)

  expect(sessionKeys(store).sort()).toEqual(Object.keys(stored).sort())
  expect(shown(ledgerOf(store))).toEqual(before)
})

test('a full store whose archive write another process overwrote keeps every session it had', FULL_STORE, async ($, on) => {
  mock.clock(on, { now: NOW })
  const stored = fullStore()
  const { store } = engine(on, stored, { loses: key => key.startsWith('archive:') })
  const before = shown(ledgerOf(store))

  await start($)

  expect(sessionKeys(store).sort()).toEqual(Object.keys(stored).sort())
  expect(shown(ledgerOf(store))).toEqual(before)
})
