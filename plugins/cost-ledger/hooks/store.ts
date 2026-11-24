// The mod's store: the keys it keeps there, reading the ledger's entries out
// of it, saving one, and the housekeeping that keeps it small.

import type { EngineInterface } from 'claude-code'

import { keepTopTurns, turnsWorthKeeping } from './insights'
import {
  dayKey,
  daysFrom,
  exportCsv,
  forgetFolds,
  isFoldForgettable,
  isSettled,
  markFolded,
  mergeEntries,
  pruneDays,
  sessionsToFoldEarly,
  shouldArchive,
  UNKNOWN_PROJECT,
  weekStartKey,
} from './ledger'
import type { SessionEntry } from './ledger'

export const SESSION_PREFIX = 'session:'
export const ARCHIVE_PREFIX = 'archive:'
export const LEARNED_TTL_KEY = 'learnedCacheTtl'
export const HEADLESS_TTL_KEY = 'learnedCacheTtlHeadless'
export const SHARED_PREFIX_KEY = 'sharedPrefixTokens'
export const LEARNED_PRICING_KEY = 'learnedPricing'
export const UNPRICED_MODELS_KEY = 'unpricedModels'
export const WRITE_QUOTES_KEY = 'writeQuotes'
export const BUDGET_PREFIX = 'budget:'

// An entry another process removed between the listing and the read comes
// back undefined and is left out.
export async function loadEntries($: EngineInterface): Promise<[string, SessionEntry][]> {
  const keys = (await $.store.keys()).filter(key => key.startsWith(SESSION_PREFIX) || key.startsWith(ARCHIVE_PREFIX))
  const read = await Promise.all(keys.map(async key => [key, await $.store.get(key)] as const))
  return read.filter((pair): pair is [string, SessionEntry] => pair[1] !== undefined)
}

// The entries as the ledger counts them. A session an archive has taken in
// counts only for the days it has added since, whether or not its own entry
// has been removed yet, so an interrupted fold is not counted twice.
export function countedEntries(all: readonly (readonly [string, SessionEntry])[]): SessionEntry[] {
  const foldedAt = new Map(all.flatMap(([, entry]) => Object.entries(entry.folded ?? {})))
  return all.flatMap(([key, entry]) => {
    const at = foldedAt.get(key)
    const counted = at === undefined ? entry : daysFrom(entry, dayKey(at))
    return counted === undefined ? [] : [counted]
  })
}

export async function ledgerEntries($: EngineInterface): Promise<SessionEntry[]> {
  return countedEntries(await loadEntries($))
}

export async function pruneBudgetKeys($: EngineInterface, now: number) {
  const today = dayKey(now)
  const current = [`day:${today}:`, `week:${weekStartKey(now)}:`, `month:${today.slice(0, 7)}:`]
  const isCurrent = (period: string) => current.some(prefix => period.startsWith(prefix))
  for (const key of await $.store.keys()) {
    if (key.startsWith(BUDGET_PREFIX) && !isCurrent(key.slice(BUDGET_PREFIX.length))) await $.store.delete(key)
  }
}

export async function writeExport($: EngineInterface): Promise<string> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  if (home === undefined) return 'Could not find a home folder to write the export to.'

  const csv = exportCsv(await ledgerEntries($))
  const path = `${home}/claude-costs/claude-costs-${dayKey(await $.clock.now())}.csv`
  await $.fs.write(path, csv)
  return `Wrote ${csv.trimEnd().split('\n').length - 1} rows to ${path}`
}

// What the mod keeps besides the ledger is a convenience: a figure it learned,
// a notice it has already given. Losing one costs a repeated notice or a
// figure learned again, never spend, so a store that refuses it must not stop
// the hook that asked. False when it was not kept.
export async function remember($: EngineInterface, key: string, value: unknown): Promise<boolean> {
  try {
    await $.store.set(key, value)
    return true
  } catch {
    return false
  }
}

export async function forget($: EngineInterface, key: string): Promise<boolean> {
  try {
    await $.store.delete(key)
    return true
  } catch {
    return false
  }
}

// Module scope on purpose: one notice per load of the mod is enough.
let hasWarnedSaveFailure = false

export async function saveEntry($: EngineInterface, key: string, entry: SessionEntry): Promise<boolean> {
  try {
    await $.store.set(key, entry)
    return true
  } catch (error) {
    if (!hasWarnedSaveFailure) {
      hasWarnedSaveFailure = true
      $.ui.toast(`cost-ledger could not save spend, so totals will fall behind: ${String(error)}`, {
        timeoutMs: 15_000,
      })
    }
    return false
  }
}

export const STORE_LIMIT_BYTES = 4 * 1024 * 1024
// A first start with a store full of small sessions would otherwise spend
// minutes folding them: the rest wait for the starts that follow.
const EARLY_FOLDS_PER_START = 100

// Sessions untouched for 60 days are folded into one archive entry per
// project, and days past retention are dropped. Sixty days of sessions can
// still be more than the store holds, about 8 kB each against its 4 MiB, and
// a store at its limit refuses every write, so the ledger would stop
// recording. So the sessions past the hundred most recently used, or past a
// mebibyte of entries, are folded as soon as they are settled.
export async function compactStore($: EngineInterface, now: number) {
  const sessions = (await loadEntries($)).filter(([key]) => key.startsWith(SESSION_PREFIX))
  await foldSessions($, sessions.filter(([, entry]) => shouldArchive(entry, now)), now, shouldArchive)

  const recent = sessions.filter(([, entry]) => !shouldArchive(entry, now))
  const sized = recent.map(([key, entry]) => ({ key, entry, bytes: JSON.stringify(entry).length }))
  const early = new Set(sessionsToFoldEarly(sized, now).slice(0, EARLY_FOLDS_PER_START))
  await foldSessions($, recent.filter(([key]) => early.has(key)), now, isSettled)

  await finishFolds($, now)
  for (const [key, entry] of await loadEntries($)) {
    const pruned = pruneDays(entry, now)
    if (pruned === undefined) await $.store.delete(key)
    else if (dayCount(pruned) !== dayCount(entry)) await saveEntry($, key, pruned)
  }
}

const dayCount = (e: SessionEntry) =>
  [e.days, e.cache, e.subagentCache, e.tools].reduce((sum, days) => sum + Object.keys(days ?? {}).length, 0) + (e.turns?.length ?? 0)

const archiveKeyOf = (entry: SessionEntry) => ARCHIVE_PREFIX + (entry.project ?? UNKNOWN_PROJECT)

type MayFold = (entry: SessionEntry, now: number) => boolean
type Fold = { archiveKey: string; now: number; mayFold: MayFold }

async function foldSessions($: EngineInterface, sessions: readonly [string, SessionEntry][], now: number, mayFold: MayFold) {
  const byArchive = new Map<string, string[]>()
  for (const [key, entry] of sessions) byArchive.set(archiveKeyOf(entry), [...(byArchive.get(archiveKeyOf(entry)) ?? []), key])
  for (const [archiveKey, keys] of byArchive) await foldInto($, { archiveKey, now, mayFold }, keys)
}

// The sessions as they stand now that may still go into this archive: the
// scan's copy of one may be from before another process dealt with it, or
// before the session was resumed.
async function dueSessions($: EngineInterface, fold: Fold, keys: readonly string[]): Promise<[string, SessionEntry][]> {
  const due: [string, SessionEntry][] = []
  for (const key of keys) {
    const entry = (await $.store.get(key)) as SessionEntry | undefined
    if (entry !== undefined && fold.mayFold(entry, fold.now) && archiveKeyOf(entry) === fold.archiveKey) due.push([key, entry])
  }
  return due
}

// A fold is the archive's write and then each session's removal, and another
// Claude Code process may be making the same fold from an older view of the
// store. So the archive names each session it has taken in, and a session it
// already names is never added to it again. One project's sessions go into
// its archive in one write, and the archive is read last, straight before
// that write, so that as little as can be is written over. False when the
// store refused the write.
async function foldTogether($: EngineInterface, fold: Fold, keys: readonly string[], isLastTry: boolean): Promise<boolean> {
  const due = await dueSessions($, fold, keys)
  const archive = (await $.store.get(fold.archiveKey)) as SessionEntry | undefined
  let merged = archive
  for (const [key, entry] of due) {
    if (merged?.folded?.[key] === undefined) merged = markFolded(mergeEntries(merged, entry), key, fold.now)
  }
  if (merged === undefined || merged === archive) return true
  if (isLastTry) return saveEntry($, fold.archiveKey, merged)
  try {
    await $.store.set(fold.archiveKey, merged)
    return true
  } catch {
    return false
  }
}

// A store at its limit has no room for an archive beside the sessions it is
// taking in, and records nothing new either until some is made. A session is
// still never removed before its archive is seen to hold it. Room is made in
// the sessions themselves: an archive keeps a month's ten most expensive
// prompts, so the prompts of these sessions that will not be among them are
// dropped now and not at the fold. Then the sessions go in as many at a time
// as there is room for, each lot removed before the next is written.
async function foldInto($: EngineInterface, fold: Fold, keys: readonly string[]) {
  if (await foldTogether($, fold, keys, false)) return
  if (!(await dropOutbidTurns($, fold, keys))) return

  let rest = [...keys]
  let size = rest.length
  while (rest.length > 0) {
    const lot = rest.slice(0, size)
    if (await foldTogether($, fold, lot, size === 1)) {
      await removeFolded($, fold.archiveKey, lot)
      rest = rest.slice(size)
    } else if (size > 1) size = Math.ceil(size / 2)
    else return
  }
}

// Each write here makes its entry smaller, which a full store takes. The
// session is read again straight before it. False when a write was refused,
// which is then not for want of room.
async function dropOutbidTurns($: EngineInterface, fold: Fold, keys: readonly string[]): Promise<boolean> {
  const due = await dueSessions($, fold, keys)
  const archive = (await $.store.get(fold.archiveKey)) as SessionEntry | undefined
  const kept = keepTopTurns([...(archive?.turns ?? []), ...due.flatMap(([, entry]) => entry.turns ?? [])])
  for (const [key, seen] of due) {
    if (turnsWorthKeeping(seen.turns ?? [], kept).length === (seen.turns ?? []).length) continue
    const entry = (await $.store.get(key)) as SessionEntry | undefined
    if (entry === undefined || !fold.mayFold(entry, fold.now)) continue
    if (!(await saveEntry($, key, { ...entry, turns: turnsWorthKeeping(entry.turns ?? [], kept) }))) return false
  }
  return true
}

// Removes a session its archive holds from the day of the fold back: all of
// it, or all but the days a resumed session has added since. False when what
// it keeps could not be saved.
async function removeFoldedSession($: EngineInterface, key: string, at: number): Promise<boolean> {
  const entry = (await $.store.get(key)) as SessionEntry | undefined
  if (entry === undefined) return true
  const since = daysFrom(entry, dayKey(at))
  if (since === undefined) await $.store.delete(key)
  else if (dayCount(since) !== dayCount(entry)) return saveEntry($, key, since)
  return true
}

async function removeFolded($: EngineInterface, archiveKey: string, keys: readonly string[]) {
  const archive = (await $.store.get(archiveKey)) as SessionEntry | undefined
  for (const key of keys) {
    const at = archive?.folded?.[key]
    if (at !== undefined) await removeFoldedSession($, key, at)
  }
}

// Removes each session an archive is seen to hold. The archive is read back
// from the store, not taken from the write, so a fold that another process
// overwrote leaves its session in place to be folded again. A session resumed
// since its fold has added days of its own, which it keeps.
async function finishFolds($: EngineInterface, now: number) {
  for (const [archiveKey, archive] of await loadEntries($)) {
    if (!archiveKey.startsWith(ARCHIVE_PREFIX)) continue
    const settled: string[] = []
    for (const [key, at] of Object.entries(archive.folded ?? {})) {
      if ((await removeFoldedSession($, key, at)) && isFoldForgettable(at, now)) settled.push(key)
    }
    if (settled.length > 0) await saveEntry($, archiveKey, forgetFolds(archive, settled))
  }
}
