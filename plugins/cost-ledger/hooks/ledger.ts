import { keepTopTurns, mergeToolMaps } from './insights'
import { addBreakdown, CATEGORIES, emptyBreakdown } from './pricing'
import type { Breakdown, ProjectDay, ToolUse, Totals, TurnRecord } from '../types'

export type SessionEntry = {
  project?: string
  days: Record<string, number>
  cache?: Record<string, Breakdown>
  subagentCache?: Record<string, Breakdown>
  turns?: TurnRecord[]
  tools?: Record<string, Record<string, ToolUse>>
  updatedAt: number
}

export type Summary = {
  today: number
  week: number
  month: number
  weekStart: string
  days: Record<string, number>
  cacheDays: Record<string, Breakdown>
  subagentDays: Record<string, Breakdown>
  projectDays: Record<string, Record<string, ProjectDay>>
  turns: TurnRecord[]
  toolDays: Record<string, Record<string, ToolUse>>
}

export type MonthView = { key: string; name: string; weeks: (number | null)[][] }

const DAY_MS = 24 * 60 * 60 * 1000
const RETENTION_MS = 400 * DAY_MS
const ARCHIVE_AFTER_MS = 60 * DAY_MS
export const OLDEST_MONTH_OFFSET = -13
export const UNKNOWN_PROJECT = '(unknown)'
export const BUDGET_THRESHOLDS = [0.8, 1] as const

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function weekStartKey(ms: number): string {
  const d = new Date(ms)
  const sinceMonday = (d.getDay() + 6) % 7
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday).getTime())
}

// The engine's figure is a running total that a /clear may reset to zero, so a
// drop means a fresh total rather than a refund.
export function spendSince(previous: number | null, usd: number): number {
  if (previous === null || usd < previous) return usd
  return usd - previous
}

export function addSpend(
  entry: SessionEntry | undefined,
  now: number,
  usd: number,
  project: string,
): SessionEntry {
  const day = dayKey(now)
  const days = { ...entry?.days }
  days[day] = (days[day] ?? 0) + usd
  return { ...entry, project, days, updatedAt: now }
}

export function addUsage(
  entry: SessionEntry | undefined,
  now: number,
  usage: Breakdown,
  project: string,
  isSubagent: boolean,
): SessionEntry {
  const day = dayKey(now)
  const cache = { ...entry?.cache }
  cache[day] = addBreakdown(cache[day], usage)
  const subagentCache = { ...entry?.subagentCache }
  if (isSubagent) subagentCache[day] = addBreakdown(subagentCache[day], usage)
  return { days: {}, ...entry, project, cache, subagentCache, updatedAt: now }
}

export function addTurn(entry: SessionEntry | undefined, now: number, turn: TurnRecord): SessionEntry {
  return { days: {}, ...entry, turns: keepTopTurns([...(entry?.turns ?? []), turn]), updatedAt: now }
}

export function addTools(entry: SessionEntry | undefined, now: number, tools: Record<string, ToolUse>): SessionEntry {
  const day = dayKey(now)
  const all = { ...entry?.tools }
  all[day] = mergeToolMaps(all[day], tools)
  return { days: {}, ...entry, tools: all, updatedAt: now }
}

export function shouldArchive(entry: SessionEntry, now: number): boolean {
  return now - entry.updatedAt > ARCHIVE_AFTER_MS
}

function mergeDays<T>(a: Record<string, T> | undefined, b: Record<string, T> | undefined, add: (x: T, y: T) => T) {
  const merged = { ...a }
  for (const [day, value] of Object.entries(b ?? {})) {
    const existing = merged[day]
    merged[day] = existing === undefined ? value : add(existing, value)
  }
  return merged
}

// Folds a finished session into its project's archive entry, so the store
// holds one entry per project for old history instead of one per session.
export function mergeEntries(archive: SessionEntry | undefined, entry: SessionEntry): SessionEntry {
  return {
    project: entry.project ?? archive?.project,
    days: mergeDays(archive?.days, entry.days, (x, y) => x + y),
    cache: mergeDays(archive?.cache, entry.cache, addBreakdown),
    subagentCache: mergeDays(archive?.subagentCache, entry.subagentCache, addBreakdown),
    turns: keepTopTurns([...(archive?.turns ?? []), ...(entry.turns ?? [])]),
    tools: mergeDays(archive?.tools, entry.tools, mergeToolMaps),
    updatedAt: Math.max(archive?.updatedAt ?? 0, entry.updatedAt),
  }
}

// Drops the days past retention; undefined once nothing is left.
export function pruneDays(entry: SessionEntry, now: number): SessionEntry | undefined {
  const cutoff = dayKey(now - RETENTION_MS)
  const keep = <T>(days: Record<string, T> | undefined) =>
    Object.fromEntries(Object.entries(days ?? {}).filter(([day]) => day >= cutoff))
  const pruned = {
    ...entry,
    days: keep(entry.days),
    cache: keep(entry.cache),
    subagentCache: keep(entry.subagentCache),
    tools: keep(entry.tools),
    turns: (entry.turns ?? []).filter(turn => dayKey(turn.at) >= cutoff),
  }
  const isEmpty =
    [pruned.days, pruned.cache, pruned.subagentCache, pruned.tools].every(d => Object.keys(d).length === 0) &&
    pruned.turns.length === 0
  return isEmpty ? undefined : pruned
}

// Adds one request's usage to the drawn totals in place of a full store scan,
// which would run on every model response.
export function applyUsage(t: Totals, now: number, usage: Breakdown, project: string, isSubagent: boolean): Totals {
  const day = dayKey(now)
  const projectDays = { ...t.projectDays[project] }
  const projectDay = projectDays[day] ?? { usd: 0, cacheWriteUsd: 0 }
  projectDays[day] = { ...projectDay, cacheWriteUsd: projectDay.cacheWriteUsd + usage.usd.cacheWrite }
  return {
    ...t,
    cacheDays: { ...t.cacheDays, [day]: addBreakdown(t.cacheDays[day], usage) },
    subagentDays: isSubagent ? { ...t.subagentDays, [day]: addBreakdown(t.subagentDays[day], usage) } : t.subagentDays,
    projectDays: { ...t.projectDays, [project]: projectDays },
  }
}

export function applyTurn(t: Totals, turn: TurnRecord): Totals {
  return { ...t, turns: keepTopTurns([...t.turns, turn]) }
}

export function applyTools(t: Totals, now: number, tools: Record<string, ToolUse>): Totals {
  const day = dayKey(now)
  return { ...t, toolDays: { ...t.toolDays, [day]: mergeToolMaps(t.toolDays[day], tools) } }
}

export function summarize(entries: readonly SessionEntry[], now: number): Summary {
  const today = dayKey(now)
  const weekStart = weekStartKey(now)
  const month = today.slice(0, 7)
  const summary: Summary = {
    today: 0,
    week: 0,
    month: 0,
    weekStart,
    days: {},
    cacheDays: {},
    subagentDays: {},
    projectDays: {},
    turns: [],
    toolDays: {},
  }
  const turns: TurnRecord[] = []

  for (const entry of entries) {
    const projectDays = (summary.projectDays[entry.project ?? UNKNOWN_PROJECT] ??= {})
    const projectDay = (day: string) => (projectDays[day] ??= { usd: 0, cacheWriteUsd: 0 })
    for (const [day, usd] of Object.entries(entry.days)) {
      if (day > today) continue
      if (day === today) summary.today += usd
      if (day >= weekStart) summary.week += usd
      if (day.startsWith(month)) summary.month += usd
      summary.days[day] = (summary.days[day] ?? 0) + usd
      projectDay(day).usd += usd
    }
    for (const [day, usage] of Object.entries(entry.cache ?? {})) {
      summary.cacheDays[day] = addBreakdown(summary.cacheDays[day], usage)
      projectDay(day).cacheWriteUsd += usage.usd.cacheWrite
    }
    for (const [day, usage] of Object.entries(entry.subagentCache ?? {})) {
      summary.subagentDays[day] = addBreakdown(summary.subagentDays[day], usage)
    }
    for (const [day, tools] of Object.entries(entry.tools ?? {})) {
      summary.toolDays[day] = mergeToolMaps(summary.toolDays[day], tools)
    }
    turns.push(...(entry.turns ?? []))
  }
  summary.turns = keepTopTurns(turns)
  return summary
}

export function formatUsd(usd: number): string {
  return `$${usd.toFixed(2)}`
}

export function monthView(now: number, offset: number): MonthView {
  const today = new Date(now)
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const year = first.getFullYear()
  const month = first.getMonth()
  const length = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array((first.getDay() + 6) % 7).fill(null)
  for (let day = 1; day <= length; day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const name = `${MONTH_NAMES[month]} ${year}`
  return { key: `${year}-${pad(month + 1)}`, name, weeks }
}

export function daysIn(days: Record<string, number>, monthKey: string): [string, number][] {
  return Object.entries(days)
    .filter(([day]) => day.startsWith(monthKey))
    .sort(([a], [b]) => a.localeCompare(b))
}

export function heatLevel(usd: number, peak: number): 0 | 1 | 2 | 3 | 4 {
  if (usd <= 0 || peak <= 0) return 0
  return Math.min(4, Math.max(1, Math.ceil((usd / peak) * 4))) as 1 | 2 | 3 | 4
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`
  return String(tokens)
}

export function projectName(root: string): string {
  return root.split(/[\\/]/).filter(Boolean).at(-1) ?? root
}

export function sumMonth<T>(days: Record<string, T>, monthKey: string, add: (sum: T | undefined, day: T) => T) {
  return Object.entries(days)
    .filter(([day]) => day.startsWith(monthKey))
    .reduce<T | undefined>((sum, [, value]) => add(sum, value), undefined)
}

// The highest threshold the spend has reached that has not been announced yet,
// so 80% and 100% are each said once per period.
export function budgetAlert(spent: number, limit: number, announced: number): number | null {
  if (limit <= 0) return null
  const reached = BUDGET_THRESHOLDS.filter(t => spent >= limit * t).at(-1)
  return reached !== undefined && reached > announced ? reached : null
}

export function cacheMinutesLeft(lastRequestAt: number, ttlMs: number, now: number): number {
  return Math.max(0, Math.ceil((lastRequestAt + ttlMs - now) / 60_000))
}

const CSV_HEADER = [
  'date',
  'project',
  'total_usd',
  ...CATEGORIES.map(c => `${c}_tokens`),
  ...CATEGORIES.map(c => `${c}_usd_estimated`),
  'subagent_usd_estimated',
]

const csvField = (value: string | number) => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

type CsvRow = { usd: number; usage: Breakdown; subagent: Breakdown }

export function exportCsv(entries: readonly SessionEntry[]): string {
  const byDay = new Map<string, Map<string, CsvRow>>()
  const row = (day: string, project: string) => {
    const projects = byDay.get(day) ?? new Map<string, CsvRow>()
    byDay.set(day, projects)
    const found = projects.get(project) ?? { usd: 0, usage: emptyBreakdown(), subagent: emptyBreakdown() }
    projects.set(project, found)
    return found
  }

  for (const entry of entries) {
    const project = entry.project ?? UNKNOWN_PROJECT
    for (const [day, usd] of Object.entries(entry.days)) row(day, project).usd += usd
    for (const [day, usage] of Object.entries(entry.cache ?? {})) {
      const r = row(day, project)
      r.usage = addBreakdown(r.usage, usage)
    }
    for (const [day, usage] of Object.entries(entry.subagentCache ?? {})) {
      const r = row(day, project)
      r.subagent = addBreakdown(r.subagent, usage)
    }
  }

  const lines: string[] = [CSV_HEADER.join(',')]
  for (const day of [...byDay.keys()].sort()) {
    const projects = byDay.get(day) ?? new Map<string, CsvRow>()
    for (const project of [...projects.keys()].sort()) {
      const r = projects.get(project)
      if (!r) continue
      const subagentUsd = CATEGORIES.reduce((sum, c) => sum + r.subagent.usd[c], 0)
      const fields = [
        day,
        project,
        r.usd.toFixed(4),
        ...CATEGORIES.map(c => r.usage.tokens[c]),
        ...CATEGORIES.map(c => r.usage.usd[c].toFixed(4)),
        subagentUsd.toFixed(4),
      ]
      lines.push(fields.map(csvField).join(','))
    }
  }
  return lines.join('\n') + '\n'
}
