// The mod's store: the keys it keeps there, reading the ledger's entries out
// of it, saving one, and the housekeeping that keeps it small.

import type { EngineInterface } from 'claude-code'

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
import type { SessionEntry, StoredSession } from './ledger'

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
export async function ledgerEntries($: EngineInterface): Promise<SessionEntry[]> {
  const all = await loadEntries($)
  const foldedAt = new Map(all.flatMap(([, entry]) => Object.entries(entry.folded ?? {})))
  return all.flatMap(([key, entry]) => {
    const at = foldedAt.get(key)
    const counted = at === undefined ? entry : daysFrom(entry, dayKey(at))
    return counted === undefined ? [] : [counted]
  })
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
// A store this full, counting once more the sessions an archive is about to
// take in, may have no room for that archive beside them.
const TIGHT_ABOVE_BYTES = STORE_LIMIT_BYTES * 0.9
// A first start with a store full of small sessions would otherwise spend
// minutes folding them: the rest wait for the starts that follow.
const EARLY_FOLDS_PER_START = 100
const HELD_AT_ONCE = 4

// Sessions untouched for 60 days are folded into one archive entry per
// project, and days past retention are dropped. Sixty days of sessions can
// still be more than the store holds, about 8 kB each against its 4 MiB, and
// a store at its limit refuses every write, so the ledger would stop
// recording. So the sessions past the hundred most recently used, or past a
// mebibyte of entries, are folded as soon as they are a day idle.
export async function compactStore($: EngineInterface, now: number) {
  const scanned = (await loadEntries($)).map(([key, entry]) => ({ key, entry, bytes: JSON.stringify(entry).length }))
  const storeBytes = scanned.reduce((sum, stored) => sum + stored.key.length + stored.bytes, 0)
  const sessions = scanned.filter(({ key }) => key.startsWith(SESSION_PREFIX))
  await foldSessions($, sessions.filter(({ entry }) => shouldArchive(entry, now)), now, shouldArchive, storeBytes)

  const early = new Set(sessionsToFoldEarly(sessions.filter(({ entry }) => !shouldArchive(entry, now)), now).slice(0, EARLY_FOLDS_PER_START))
  await foldSessions($, sessions.filter(({ key }) => early.has(key)), now, isSettled, storeBytes)

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

async function foldSessions($: EngineInterface, sessions: readonly StoredSession[], now: number, mayFold: MayFold, storeBytes: number) {
  const byArchive = new Map<string, StoredSession[]>()
  for (const session of sessions) byArchive.set(archiveKeyOf(session.entry), [...(byArchive.get(archiveKeyOf(session.entry)) ?? []), session])
  for (const [archiveKey, taken] of byArchive) {
    // An archive is never larger than what it takes in, so with room for the
    // sessions a second time over, a refused write is not for want of room.
    const isTight = storeBytes + taken.reduce((sum, session) => sum + session.bytes, 0) > TIGHT_ABOVE_BYTES
    await foldInto($, archiveKey, taken.map(session => session.key), now, mayFold, isTight)
  }
}

async function setQuietly($: EngineInterface, key: string, entry: SessionEntry): Promise<boolean> {
  try {
    await $.store.set(key, entry)
    return true
  } catch {
    return false
  }
}

// A fold is the archive's write and then each session's removal, and another
// Claude Code process may be making the same fold from an older view of the
// store. So the archive names each session it has taken in, and a session it
// already names is never added to it again. Each session is read afresh: the
// scan's copy may be one another process has since dealt with. The sessions
// of one project go into its archive in one write.
async function foldInto($: EngineInterface, archiveKey: string, keys: readonly string[], now: number, mayFold: MayFold, isTight: boolean) {
  const archive = (await $.store.get(archiveKey)) as SessionEntry | undefined
  const due: [string, SessionEntry][] = []
  let merged = archive
  for (const key of keys) {
    const entry = (await $.store.get(key)) as SessionEntry | undefined
    if (entry === undefined || !mayFold(entry, now) || archiveKeyOf(entry) !== archiveKey) continue
    if (merged?.folded?.[key] !== undefined) continue
    merged = markFolded(mergeEntries(merged, entry), key, now)
    due.push([key, entry])
  }
  if (merged === undefined || due.length === 0) return
  if (!isTight) await saveEntry($, archiveKey, merged)
  else if (!(await setQuietly($, archiveKey, merged))) await foldWithoutRoom($, archiveKey, archive, due, now)
}

// A store at its limit has no room for an archive beside the sessions it is
// taking in, and records nothing new either until some is made. Here alone a
// session is removed before the archive that holds it is written: one at a
// time, a few where one does not free enough, and each is written back if the
// archive is not then seen to hold it.
async function foldWithoutRoom($: EngineInterface, archiveKey: string, archive: SessionEntry | undefined, due: readonly [string, SessionEntry][], now: number) {
  let merged = archive
  let held: [string, SessionEntry][] = []
  for (const [key, entry] of due) {
    await $.store.delete(key)
    held.push([key, entry])
    merged = markFolded(mergeEntries(merged, entry), key, now)
    if (await setQuietly($, archiveKey, merged)) {
      const stored = (await $.store.get(archiveKey)) as SessionEntry | undefined
      if (held.some(([heldKey]) => stored?.folded?.[heldKey] === undefined)) break
      held = []
    } else if (held.length >= HELD_AT_ONCE) break
  }
  for (const [key, entry] of held) await saveEntry($, key, entry)
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
      const entry = (await $.store.get(key)) as SessionEntry | undefined
      const since = entry && daysFrom(entry, dayKey(at))
      if (entry !== undefined && since === undefined) await $.store.delete(key)
      else if (entry !== undefined && since !== undefined && dayCount(since) !== dayCount(entry) && !(await saveEntry($, key, since))) continue
      if (isFoldForgettable(at, now)) settled.push(key)
    }
    if (settled.length > 0) await saveEntry($, archiveKey, forgetFolds(archive, settled))
  }
}
