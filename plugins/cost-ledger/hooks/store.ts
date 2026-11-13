// The mod's store: the keys it keeps there, reading the ledger's entries out
// of it, saving one, and the housekeeping that keeps it small.

import type { EngineInterface } from 'claude-code'

import {
  dayKey,
  daysFrom,
  exportCsv,
  forgetFolds,
  isFoldForgettable,
  markFolded,
  mergeEntries,
  pruneDays,
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

// Sessions untouched for 60 days are folded into one archive entry per
// project, and days past retention are dropped, which keeps the store far
// below its 4 MiB limit however many sessions run.
export async function compactStore($: EngineInterface, now: number) {
  for (const [key, entry] of await loadEntries($)) {
    if (key.startsWith(SESSION_PREFIX) && shouldArchive(entry, now)) await foldSession($, key, now)
  }
  await finishFolds($, now)
  for (const [key, entry] of await loadEntries($)) {
    const pruned = pruneDays(entry, now)
    if (pruned === undefined) await $.store.delete(key)
    else if (dayCount(pruned) !== dayCount(entry)) await saveEntry($, key, pruned)
  }
}

const dayCount = (e: SessionEntry) =>
  [e.days, e.cache, e.subagentCache, e.tools].reduce((sum, days) => sum + Object.keys(days ?? {}).length, 0) + (e.turns?.length ?? 0)

// A fold is two writes, the archive and then the session's removal, and
// another Claude Code process may be making the same fold from an older view
// of the store. So the archive names each session it has taken in, and a
// session it already names is never added to it again. The session is read
// afresh: the scan's copy may be one another process has since dealt with.
async function foldSession($: EngineInterface, key: string, now: number) {
  const entry = (await $.store.get(key)) as SessionEntry | undefined
  if (entry === undefined || !shouldArchive(entry, now)) return
  const archiveKey = ARCHIVE_PREFIX + (entry.project ?? UNKNOWN_PROJECT)
  const archive = (await $.store.get(archiveKey)) as SessionEntry | undefined
  if (archive?.folded?.[key] !== undefined) return
  await saveEntry($, archiveKey, markFolded(mergeEntries(archive, entry), key, now))
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
