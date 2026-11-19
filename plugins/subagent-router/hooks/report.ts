import type { Kind, Route, Settings } from '../types'
import { clean } from './clean'
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
}

type Run = {
  kind: Kind | null
  outcome: string
  reason: string
  hasStarted: boolean
  usd: number | undefined
  tokens: number
  row: string
}

const MODE_TEXT: Record<string, string> = {
  observe: 'records what it would do and changes nothing',
  route: 'runs the kinds with a route on a cheaper model',
  off: 'does nothing',
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

function dollars(usd: number): string | undefined {
  if (!printable(usd)) return undefined
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

function costText(usd: number | undefined, tokens: number): string {
  const shown = tokens > 0 ? grouped(tokens) : undefined
  const parts = shown === undefined ? [] : [`${shown} tokens`]
  const cost = usd === undefined ? undefined : dollars(usd)
  if (cost !== undefined) parts.push(cost)
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
  const reason = field(value.reason)
  const parts = [field(value.agentType) || 'unknown type', kind ?? '-', outcomeText(outcome, hasStarted, field(value.target), value.overridden === true), reason]
  if (hasStarted) parts.push(modelText(started, ran))
  const cost = costText(usd, tokens)
  if (cost !== '') parts.push(cost)
  if (agentId !== '') parts.push(`agent ${agentId}`)
  const row = clean(`- ${parts.join(' | ')}: ${typeof value.description === 'string' ? clean(value.description, DESCRIPTION_MAX) : ''}`, LINE_MAX)
  return { kind, outcome, reason, hasStarted, usd, tokens, row }
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
  const pricedText = dollars(priced)
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
  if (a.settings.standingDown !== null) lines.push(`Standing down: ${clean(a.settings.standingDown, NOTE_MAX)}, so the router does nothing.`)
  for (const note of a.settings.notes) lines.push(`Settings: ${clean(note, NOTE_MAX)}`)
  for (const kind of KINDS) {
    if (a.routeOff.includes(kind)) lines.push(`The ${kind} route is off for this session: a run routed to a cheaper model started at or above its usual model.`)
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

  if (runs.length === 0) lines.push('No subagent spawns in scope yet.')
  for (const kind of KINDS) if (runs.some((r) => r.kind === kind)) lines.push(totalLine(kind, runs, a))
  if (runs.length + outOfScope > 0) lines.push(`In scope: ${runs.length} of ${runs.length + outOfScope} spawns`)
  if (wouldRefuse > 0 || runs.some((r) => r.outcome === 'would-route')) lines.push(`Spawns the no-spawn rule would have refused: ${wouldRefuse}`)
  const refused = runs.filter((r) => r.outcome === 'refused').length
  if (refused > 0) lines.push(`Spawns refused under an agent the router moved: ${refused}`)
  const learning = runs.filter((r) => r.reason === 'baseline-unknown').length
  if (learning > 0) lines.push(`Left alone while the baseline was learned: ${learning}`)
  if (skipped > 0) lines.push(`${skipped} record(s) from another version skipped`)
  if (runs.length > 0) lines.push('', 'Runs (costs are estimates from listed prices):', ...runs.map((r) => r.row))
  return lines.map((line) => clean(line, LINE_MAX)).join('\n')
}
