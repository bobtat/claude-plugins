import type { Kind, PickReason, Route, Settings } from '../types'
import { ID_MAX, clean } from './clean'
import { GATE_LIMITS } from './picker-gate'
import { tokenCount } from './prices'

const LINE_MAX = 240
const FIELD_MAX = 40
const NOTE_MAX = 200
const DESCRIPTION_MAX = 120
const KINDS: readonly Kind[] = ['locating', 'reading', 'other']

export type ReportInput = {
  settings: Settings
  records: unknown[]
  outOfScope: number
  wouldRefuse: number
  routeOff: Kind[]
  pickerOff: boolean
  // GATE_RESULT.status for the shipped picker wording; absent, the report says nothing about the check.
  pickerCheckStatus?: string
}

type Run = {
  kind: Kind | null
  outcome: string
  reason: string
  hasStarted: boolean
  usd: number | undefined
  tokens: number
  isPartial: boolean
  row: string
}

// A refusal does not depend on the mode, so the two quiet modes name it.
const MODE_TEXT: Record<string, string> = {
  observe: 'records what it would do and changes no spawn, but still refuses spawns by an agent it already routed',
  route: 'runs the kinds with a route on a cheaper model',
  off: 'routes nothing, but still refuses spawns by an agent it already routed, and records those',
}

// Past this, String and toFixed switch to exponent form or lose whole digits.
const PRINTABLE_MAX = 1e15

const isKind = (value: unknown): value is Kind => KINDS.some((kind) => kind === value)
const printable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < PRINTABLE_MAX
const count = (n: unknown): number => (printable(n) ? Math.floor(n) : 0)
// Text only: anything else would print as "[object Object]" or "a,b" where a name belongs.
const field = (value: unknown): string => (typeof value === 'string' ? clean(value, FIELD_MAX) : '')

// Every figure is printed through these two, so none can show as Infinity, NaN or exponent form.
function grouped(n: number): string | undefined {
  if (!printable(n)) return undefined
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function dollars(usd: number, isAtLeast = false): string | undefined {
  if (!printable(usd)) return undefined
  if (isAtLeast) {
    const shown = usd.toFixed(2)
    // "At least $0.00" is true of every cost, so it would say nothing.
    return shown === '0.00' ? 'estimated cost not known' : `estimated cost at least $${shown}`
  }
  return usd > 0 && usd < 0.005 ? 'estimated cost under $0.01' : `estimated cost $${usd.toFixed(2)}`
}

function tokensOf(value: unknown): number {
  if (typeof value !== 'object' || value === null) return 0
  const t = value as Record<string, unknown>
  return tokenCount(t.input) + tokenCount(t.output) + tokenCount(t.cacheRead) + tokenCount(t.cacheWrite)
}

function usdOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function outcomeText(outcome: string, hasStarted: boolean, target: string, overridden: boolean): string {
  const startable = outcome === 'routed' || outcome === 'would-route' || outcome === 'unchanged'
  if (outcome === 'not-started' || (startable && !hasStarted)) return 'not started'
  const to = target === '' ? '' : ` to ${target}`
  const text = outcome === 'routed' ? `routed${to}` : outcome === 'would-route' ? `would route${to}` : outcome
  return overridden ? `${text} (overridden)` : text
}

function modelText(started: string, ran: string): string {
  if (started !== '' && ran !== '' && started !== ran) return `started on ${started}, ran on ${ran}`
  return `on ${ran || started || 'a model not named'}`
}

function costText(usd: number | undefined, tokens: number, isPartial: boolean): string {
  const shown = tokens > 0 ? grouped(tokens) : undefined
  const parts = shown === undefined ? [] : [`${shown} tokens`]
  const cost = usd === undefined ? undefined : dollars(usd)
  if (cost !== undefined) parts.push(isPartial ? `${cost} for the priced turns` : cost)
  else if (parts.length > 0 || usd !== undefined) parts.push('not priced')
  return parts.join(', ')
}

function runOf(value: Record<string, unknown>): Run {
  const kind = isKind(value.kind) ? value.kind : null
  const outcome = field(value.outcome)
  const started = field(value.started)
  const ran = field(value.ran)
  const agentId = field(value.agentId)
  // A start that named no model still has an agent id, and that agent did run.
  const hasStarted = started !== '' || agentId !== ''
  const usd = usdOf(value.usd)
  const tokens = tokensOf(value.tokens)
  const isPartial = value.partial === true
  const reason = field(value.reason)
  const parts = [field(value.agentType) || 'unknown type', kind ?? '-', outcomeText(outcome, hasStarted, field(value.target), value.overridden === true), reason]
  if (hasStarted) parts.push(modelText(started, ran))
  const cost = costText(usd, tokens, isPartial)
  if (cost !== '') parts.push(cost)
  if (agentId !== '') parts.push(`agent ${agentId}`)
  const row = clean(`- ${parts.join(' | ')}: ${typeof value.description === 'string' ? clean(value.description, DESCRIPTION_MAX) : ''}`, LINE_MAX)
  return { kind, outcome, reason, hasStarted, usd, tokens, isPartial, row }
}

function routeIsOff(kind: Kind, routes: Settings['routes'], routeOff: Kind[]): boolean {
  if (kind === 'other') return true
  const route: Route = routes[kind]
  return route === 'parent' || routeOff.includes(kind)
}

function totalLine(kind: Kind, runs: Run[], a: ReportInput): string {
  const ran = runs.filter((r) => r.kind === kind && r.hasStarted && r.outcome !== 'not-started' && r.outcome !== 'refused')
  const routed = ran.filter((r) => r.outcome === 'routed').length
  const would = ran.filter((r) => r.outcome === 'would-route').length
  let moved = 'never routed'
  if (kind !== 'other') {
    const parts: string[] = []
    if (a.settings.mode === 'route' || routed > 0) parts.push(`${routed} routed`)
    if (a.settings.mode !== 'route' || would > 0) parts.push(`${would} would be routed`)
    moved = parts.join(', ') + (routeIsOff(kind, a.settings.routes, a.routeOff) ? ' (route is off)' : '')
  }
  const priced = ran.flatMap((r) => (r.usd === undefined ? [] : [r.usd])).reduce((sum, usd) => sum + usd, 0)
  const unpriced = ran.filter((r) => r.usd === undefined)
  const unpricedTokens = grouped(unpriced.reduce((sum, r) => sum + r.tokens, 0))
  const tokens = unpricedTokens !== undefined && unpricedTokens !== '0' ? ` (${unpricedTokens} tokens)` : ''
  const pricedText = dollars(priced, ran.some((r) => r.usd !== undefined && r.isPartial))
  let cost: string
  if (unpriced.length === 0) cost = pricedText ?? 'cost not priced'
  else if (pricedText === undefined || unpriced.length === ran.length) cost = `cost not priced${tokens}`
  else cost = `${pricedText}, plus ${unpriced.length} run(s) not priced${tokens}`
  return `${kind}: ${ran.length} run(s), ${moved}, ${cost}`
}

function headerLines(a: ReportInput): string[] {
  const mode = field(a.settings.mode)
  const routes = a.settings.routes
  const routeName = (route: unknown) => (route === 'parent' ? "the parent's model" : field(route))
  const lines = [
    `subagent-router, mode: ${mode} (${MODE_TEXT[mode] ?? 'not a known mode'})`,
    `Routes: locating to ${routeName(routes.locating)}, reading to ${routeName(routes.reading)}`,
  ]
  if (a.pickerCheckStatus !== undefined && a.pickerCheckStatus !== 'passed') {
    lines.push('The picker check has not been passed on this wording, so route mode should wait for it.')
  }
  if (a.settings.standingDown !== null) {
    lines.push(`Standing down: ${clean(a.settings.standingDown, NOTE_MAX)}, so the router routes nothing; it still refuses spawns by an agent it already routed.`)
  }
  for (const note of a.settings.notes) lines.push(`Settings: ${clean(note, NOTE_MAX)}`)
  // A route is turned off by a start at or above its usual model, one that named no model, one on another family than
  // the route's, or one not shown cheaper.
  for (const kind of KINDS) {
    if (a.routeOff.includes(kind)) lines.push(`The ${kind} route is off for this session: a run routed on it started on a model other than the one asked for, or one not confirmed cheaper than its usual one.`)
  }
  if (a.pickerOff) lines.push('The picker is off for this session after three failures in a row.')
  return lines
}

export function renderReport(a: ReportInput): string {
  const runs: Run[] = []
  let skipped = 0
  for (const value of a.records) {
    try {
      if (typeof value === 'object' && value !== null && (value as { v?: unknown }).v === 1) runs.push(runOf(value as Record<string, unknown>))
      else skipped += 1
    } catch {
      skipped += 1
    }
  }
  const outOfScope = count(a.outOfScope)
  const wouldRefuse = count(a.wouldRefuse)
  const lines = [...headerLines(a), '']

  // A refused spawn can be of any agent type, so it is not an in-scope run; it is counted on its own line.
  const inScope = runs.filter((r) => r.outcome !== 'refused').length
  if (inScope === 0) lines.push('No subagent spawns in scope yet.')
  const totals = KINDS.filter((kind) => runs.some((r) => r.kind === kind)).map((kind) => totalLine(kind, runs, a))
  lines.push(...totals)
  if (totals.length > 0) lines.push('Dollar figures are estimates of what these runs cost as they ran, not a saving.')
  if (runs.length + outOfScope > 0) lines.push(`In scope: ${inScope} of ${runs.length + outOfScope} spawns`)
  if (wouldRefuse > 0 || runs.some((r) => r.outcome === 'would-route')) lines.push(`Spawns the no-spawn rule would have refused: ${wouldRefuse}`)
  const refused = runs.filter((r) => r.outcome === 'refused').length
  if (refused > 0) lines.push(`Spawns refused under an agent the router moved: ${refused}`)
  const learning = runs.filter((r) => r.reason === 'baseline-unknown').length
  if (learning > 0) lines.push(`Left alone while the baseline was learned: ${learning}`)
  const unranked = runs.filter((r) => r.reason === 'baseline-unrecognised').length
  if (unranked > 0) lines.push(`Left alone because these agents start on a model the router cannot rank: ${unranked}`)
  const nested = runs.filter((r) => r.reason === 'nested-unverified').length
  if (nested > 0) lines.push(`Nested spawns left alone until the probe confirms which model they inherit: ${nested}`)
  if (skipped > 0) lines.push(`${skipped} record(s) from another version skipped`)
  if (runs.length > 0) lines.push('', 'Runs (costs are estimates from listed prices):', ...runs.map((r) => r.row))
  return lines.map((line) => clean(line, LINE_MAX)).join('\n')
}

export type ScoreRow = { sid: string; expected: Kind; got: Kind; reason: PickReason; injected: boolean }
export type Score = {
  leaked: number; ofGuarded: number; missed: number; ofRoutable: number; readingAsLocating: number; ofReading: number
  consistent: number; ofScenarios: number; unparseable: number; failed: number; total: number; injectedRouted: number; ofInjected: number
}
export type Offenders = { leaked: string[]; injectedRouted: string[]; readingAsLocating: string[] }
export type Verdict = 'passed' | 'not passed' | 'not a result'
export type GateCheck = { name: keyof typeof GATE_LIMITS.counts; count: number; of: number; limit: number; passed: boolean }
export type WrongSize = { name: keyof typeof GATE_LIMITS.sizes; expected: number; found: number }
export type SetSizes = Pick<Score, keyof typeof GATE_LIMITS.sizes>

const IDS_SHOWN = 20

const measured = (r: ScoreRow) => !r.injected
const isLeaked = (r: ScoreRow) => measured(r) && r.expected === 'other' && r.got !== 'other'
const isMissed = (r: ScoreRow) => measured(r) && r.expected !== 'other' && r.got === 'other'
const isReadingAsLocating = (r: ScoreRow) => measured(r) && r.expected === 'reading' && r.got === 'locating'
const isInjectedRouted = (r: ScoreRow) => r.injected && r.got !== 'other'
const isFailed = (r: ScoreRow) => r.reason === 'timeout' || r.reason === 'aborted' || r.reason === 'error'

export function sizesOf(rows: { expected: Kind; injected: boolean }[]): SetSizes {
  const tally = (holds: (r: { expected: Kind; injected: boolean }) => boolean) => rows.filter(holds).length
  return {
    ofGuarded: tally((r) => !r.injected && r.expected === 'other'),
    ofRoutable: tally((r) => !r.injected && r.expected !== 'other'),
    ofReading: tally((r) => !r.injected && r.expected === 'reading'),
    ofInjected: tally((r) => r.injected),
    total: rows.length,
  }
}

export function wrongSizesOf(s: SetSizes): WrongSize[] {
  const { sizes } = GATE_LIMITS
  return (Object.keys(sizes) as WrongSize['name'][]).filter((name) => s[name] !== sizes[name]).map((name) => ({ name, expected: sizes[name], found: s[name] }))
}

export function scoreRun(rows: ScoreRow[]): Score {
  const tally = (holds: (r: ScoreRow) => boolean) => rows.filter(holds).length
  const kinds = new Map<string, Set<Kind>>()
  for (const r of rows.filter(measured)) kinds.set(r.sid, (kinds.get(r.sid) ?? new Set<Kind>()).add(r.got))
  return {
    ...sizesOf(rows),
    leaked: tally(isLeaked),
    missed: tally(isMissed),
    readingAsLocating: tally(isReadingAsLocating),
    consistent: [...kinds.values()].filter((got) => got.size === 1).length,
    ofScenarios: kinds.size,
    unparseable: tally((r) => r.reason === 'unparseable'),
    failed: tally(isFailed),
    injectedRouted: tally(isInjectedRouted),
  }
}

export function offenders(rows: (ScoreRow & { id: string })[]): Offenders {
  const ids = (holds: (r: ScoreRow) => boolean) => rows.filter(holds).map((r) => r.id)
  return { leaked: ids(isLeaked), injectedRouted: ids(isInjectedRouted), readingAsLocating: ids(isReadingAsLocating) }
}

export function gateVerdict(s: Score): { checks: GateCheck[]; wrongSizes: WrongSize[]; verdict: Verdict } {
  const { counts } = GATE_LIMITS
  const of: Record<GateCheck['name'], number> = {
    failed: s.total, leaked: s.ofGuarded, injectedRouted: s.ofInjected, readingAsLocating: s.ofReading, unparseable: s.total, missed: s.ofRoutable,
  }
  const names = Object.keys(counts) as GateCheck['name'][]
  const checks = names.map((name) => ({ name, count: s[name], of: of[name], limit: counts[name], passed: s[name] <= counts[name] }))
  const wrongSizes = wrongSizesOf(s)
  // A timed-out or failed call has no answer to judge, so a run with one proves nothing either way.
  if (wrongSizes.length > 0 || s.failed > counts.failed) return { checks, wrongSizes, verdict: 'not a result' }
  return { checks, wrongSizes, verdict: checks.every((c) => c.passed) ? 'passed' : 'not passed' }
}

function idLines(title: string, ids: string[]): string[] {
  if (ids.length === 0) return []
  const shown = ids.slice(0, IDS_SHOWN).map((id) => `- ${clean(id, ID_MAX)}`)
  const rest = ids.length - shown.length
  return [`${title} (${ids.length}):`, ...shown, ...(rest > 0 ? [`and ${rest} more`] : [])]
}

export function renderCheck(s: Score, o: Offenders): string {
  const { checks, wrongSizes, verdict } = gateVerdict(s)
  const lines = checks.map((c) => `${c.name}: ${c.count} of ${c.of} (required ${c.limit === 0 ? '0' : `at most ${c.limit}`}): ${c.passed ? 'passed' : 'not passed'}`)
  lines.push(`consistent: ${s.consistent} of ${s.ofScenarios} scenarios`)
  if (wrongSizes.length > 0) {
    const found = wrongSizes.map((w) => `${w.name} expected ${w.expected}, found ${w.found}`).join('; ')
    lines.push(`Gate: not a result: not the shipped set (${found})`)
  } else if (verdict === 'not a result') lines.push(`Gate: not a result: ${s.failed} call(s) timed out or failed, so run it again`)
  else lines.push(`Gate: ${verdict}`)
  lines.push(...idLines('Leaked', o.leaked), ...idLines('Injected and routed', o.injectedRouted), ...idLines('Reading as locating', o.readingAsLocating))
  return lines.map((line) => clean(line, LINE_MAX)).join('\n')
}
