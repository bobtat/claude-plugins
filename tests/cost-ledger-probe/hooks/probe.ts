// The probe's records and the arithmetic over them, free of engine calls so the
// tests can check it directly. Each record is one line of the JSONL log.

import { ratesFor } from './pricing'

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = { costUsd: number | null; rateLimits: Limit[] }

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

export type ProbeRecord = { at: number } & (
  | { kind: 'session'; sessionId: string; version: string }
  // costUsd is Claude Code's running total as the turn starts and ends, so a
  // turn's cost can be set against its tokens; absent from older logs.
  | { kind: 'turn'; phase: 'start' | 'end'; turnId: string; costUsd?: number | null }
  | { kind: 'step'; turnId: string; agentId?: string; model: string; startedAt: number; tokens: Tokens }
  | { kind: 'measure'; snapshot: Snapshot }
  | {
      kind: 'fork'
      label: string
      startedAt: number
      contextTokens: number | null
      result: 'answered' | string
      status?: number | null
      tokens?: Tokens
      before: Snapshot
      after: Snapshot
    }
  | { kind: 'skip'; label: string; why: string }
  | { kind: 'ttl'; source: string; ttl: string }
  | { kind: 'resume'; source: string; secondsSinceLastResponse?: number; contextTokens?: number; likelyExpired?: boolean; estimatedCacheWriteUsd?: number }
  | { kind: 'mark'; text: string }
)

// Short, tool-free and asking for one word, so each ping's output stays small;
// the output tokens it still costs are one of the things being measured.
export const PING_PROMPT =
  'This is an automated prompt-cache keep-alive check, not a request from the user. ' +
  'Do not use any tools. Reply with exactly: ok'

export type Command =
  | { kind: 'ping' }
  | { kind: 'schedule'; minutes: number[] }
  | { kind: 'burst'; count: number; seconds: number }
  | { kind: 'mark'; text: string }
  | { kind: 'report' }
  | { kind: 'help'; error?: string }

export const USAGE =
  'Usage: /probe ping | schedule <minutes...> | burst <count> <seconds> | mark <text> | report'

const isPositive = (n: number) => Number.isFinite(n) && n > 0

export function parseCommand(args: string): Command {
  const [verb = '', ...rest] = args.trim().split(/\s+/).filter(Boolean)
  switch (verb) {
    case 'ping':
      return { kind: 'ping' }
    case 'schedule': {
      const minutes = rest.map(Number)
      if (minutes.length === 0 || !minutes.every(isPositive)) {
        return { kind: 'help', error: 'schedule takes one or more positive minute offsets, e.g. schedule 4 8 12' }
      }
      return { kind: 'schedule', minutes: [...minutes].sort((a, b) => a - b) }
    }
    case 'burst': {
      const [count, seconds] = rest.map(Number)
      if (count === undefined || seconds === undefined || !Number.isInteger(count) || !isPositive(count) || !isPositive(seconds)) {
        return { kind: 'help', error: 'burst takes a whole count and a spacing in seconds, e.g. burst 20 30' }
      }
      return { kind: 'burst', count, seconds }
    }
    case 'mark': {
      const text = rest.join(' ')
      return text === '' ? { kind: 'help', error: 'mark takes a label, e.g. mark control start' } : { kind: 'mark', text }
    }
    case 'report':
    case '':
      return { kind: 'report' }
    default:
      return { kind: 'help', error: `unknown subcommand "${verb}"` }
  }
}

// The context the next request sends, counted as cost-ledger counts it: the
// last response's input, cache read, cache write and output together.
export const contextOf = (t: Tokens) => t.input + t.cacheRead + t.cacheWrite + t.output

export function dayKey(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const logFileName = (ms: number, sessionId: string) => `probe-${dayKey(ms)}-${sessionId.slice(0, 8)}.jsonl`

export const toJsonl = (records: readonly ProbeRecord[]) => records.map(r => JSON.stringify(r)).join('\n') + '\n'

export function fromJsonl(text: string): ProbeRecord[] {
  const records: ProbeRecord[] = []
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    try {
      records.push(JSON.parse(line) as ProbeRecord)
    } catch {
      // a line cut short by a crash mid-write is dropped, not fatal
    }
  }
  return records
}

// Delays for `schedule`: each offset counts from the end of the last main
// turn. Offsets already past are reported rather than fired late, since a late
// ping would measure a different idle gap from the one asked for.
export function scheduleDelays(anchor: number, now: number, minutes: readonly number[]) {
  return minutes.map(m => ({ minutes: m, delayMs: anchor + m * 60_000 - now }))
}

// Below this many tokens written, a turn's other charges swamp the write and
// the implied rate says nothing.
const MIN_WRITE_FOR_RATE = 1_000
// Spend under this is rounding in Claude Code's total, not a request.
const MIN_UNATTRIBUTED_USD = 0.0005

export type TurnCost = {
  turnId: string
  startedAt: number
  endedAt: number
  deltaUsd: number
  writeTokens: number
  // The turn's tokens priced at list rates, with writes at each lifetime.
  at5m: number
  at1h: number
  // What one written million tokens must have cost for the rest to add up.
  impliedWriteRate: number | null
  matches: '5m' | '1h' | '?'
  hasUnpriced: boolean
}

// Each turn whose start and end both carry Claude Code's running total, its
// cost set against its requests (subagents' included) priced both ways: the
// lifetime whose write rate makes them add up is the one Claude Code charged.
export function turnCosts(records: readonly ProbeRecord[]): TurnCost[] {
  const turns: TurnCost[] = []
  let open: { turnId: string; at: number; costUsd: number; steps: Tokens[]; models: string[] } | undefined
  for (const r of records) {
    if (r.kind === 'turn' && r.phase === 'start') {
      open = typeof r.costUsd === 'number' ? { turnId: r.turnId, at: r.at, costUsd: r.costUsd, steps: [], models: [] } : undefined
    } else if (r.kind === 'step' && open && r.turnId === open.turnId) {
      open.steps.push(r.tokens)
      open.models.push(r.model)
    } else if (r.kind === 'turn' && r.phase === 'end' && open && r.turnId === open.turnId) {
      if (typeof r.costUsd === 'number') {
        let base = 0
        let w5 = 0
        let w1 = 0
        let writeTokens = 0
        let hasUnpriced = false
        open.steps.forEach((t, i) => {
          const rates = ratesFor(open?.models[i] ?? '')
          if (rates === undefined) {
            hasUnpriced = true
            return
          }
          base += (t.input * rates.input + t.cacheRead * rates.cacheRead + t.output * rates.output) / 1e6
          w5 += (t.cacheWrite * rates.cacheWrite5m) / 1e6
          w1 += (t.cacheWrite * rates.cacheWrite1h) / 1e6
          writeTokens += t.cacheWrite
        })
        const deltaUsd = r.costUsd - open.costUsd
        const at5m = base + w5
        const at1h = base + w1
        const impliedWriteRate = writeTokens >= MIN_WRITE_FOR_RATE && !hasUnpriced ? ((deltaUsd - base) / writeTokens) * 1e6 : null
        const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.0005, Math.abs(b) * 0.02)
        const matches = impliedWriteRate === null ? '?' : near(deltaUsd, at1h) ? '1h' : near(deltaUsd, at5m) ? '5m' : '?'
        turns.push({ turnId: open.turnId, startedAt: open.at, endedAt: r.at, deltaUsd, writeTokens, at5m, at1h, impliedWriteRate, matches, hasUnpriced })
      }
      open = undefined
    }
  }
  return turns
}

export type Unattributed = { from: number; to: number; usd: number }

// Spend between one known total and the next that no logged request explains:
// the totals come from turn starts and ends and from either side of each fork,
// so whatever the running total gained between them was spent by something
// else (a background request Claude Code made on its own).
export function unattributedSpend(records: readonly ProbeRecord[]): Unattributed[] {
  const found: Unattributed[] = []
  let last: { at: number; costUsd: number } | undefined
  const reach = (at: number, costUsd: number | null | undefined) => {
    if (typeof costUsd !== 'number') return
    if (last && costUsd - last.costUsd >= MIN_UNATTRIBUTED_USD) found.push({ from: last.at, to: at, usd: costUsd - last.costUsd })
    last = { at, costUsd }
  }
  for (const r of records) {
    if (r.kind === 'turn' && r.phase === 'start') reach(r.at, r.costUsd)
    else if (r.kind === 'turn' && r.phase === 'end') last = typeof r.costUsd === 'number' ? { at: r.at, costUsd: r.costUsd } : undefined
    else if (r.kind === 'fork') {
      reach(r.startedAt, r.before.costUsd)
      last = typeof r.after.costUsd === 'number' ? { at: r.at, costUsd: r.after.costUsd } : undefined
    }
  }
  return found
}

const time = (ms: number) => new Date(ms).toTimeString().slice(0, 8)
const minutes = (ms: number) => `${(ms / 60_000).toFixed(1)}m`
const pct = (part: number, whole: number | null) => (whole ? `${Math.round((part / whole) * 100)}%` : '?')
const usd = (n: number | null) => (n === null ? '?' : `$${n.toFixed(4)}`)

function costDelta(before: Snapshot, after: Snapshot): string {
  if (before.costUsd === null || after.costUsd === null) return '?'
  return usd(after.costUsd - before.costUsd)
}

function limitsText(limits: readonly Limit[]): string {
  return limits.length === 0 ? 'none reported' : limits.map(l => `${l.kind} ${l.percentUsed}%`).join(', ')
}

// What the five Phase 0 questions read from the log: each fork's cache hit and
// cost, the first request of each turn after an idle gap, and how the
// rate-limit readings moved. The raw JSONL holds everything else.
export function report(records: readonly ProbeRecord[]): string {
  const lines: string[] = []
  let lastRequest: number | undefined
  let lastTurnStart: number | undefined
  let awaitingFirstStep = false
  const forks: string[] = []
  const firstSteps: string[] = []
  const limits: Limit[][] = []
  const ttls = new Set<string>()
  const marks: string[] = []

  for (const r of records) {
    switch (r.kind) {
      case 'turn':
        if (r.phase === 'start') {
          lastTurnStart = r.at
          awaitingFirstStep = true
        }
        break
      case 'step': {
        if (r.agentId === undefined && awaitingFirstStep && lastTurnStart !== undefined) {
          const idle = lastRequest === undefined ? '-' : minutes(r.startedAt - lastRequest)
          firstSteps.push(
            `  ${time(r.startedAt)}  idle ${idle.padStart(6)}  read ${String(r.tokens.cacheRead).padStart(8)}` +
              `  write ${String(r.tokens.cacheWrite).padStart(8)}  input ${r.tokens.input}  ${r.model}`,
          )
          awaitingFirstStep = false
        }
        if (r.agentId === undefined) lastRequest = r.startedAt
        break
      }
      case 'fork': {
        const idle = lastRequest === undefined ? '-' : minutes(r.startedAt - lastRequest)
        const t = r.tokens
        forks.push(
          t
            ? `  ${time(r.startedAt)}  ${r.label.padEnd(10)}  idle ${idle.padStart(6)}  ctx ${String(r.contextTokens ?? '?').padStart(8)}` +
                `  read ${String(t.cacheRead).padStart(8)} (${pct(t.cacheRead, r.contextTokens)})  write ${t.cacheWrite}` +
                `  input ${t.input}  output ${t.output}  Δcost ${costDelta(r.before, r.after)}  ${r.result}`
            : `  ${time(r.startedAt)}  ${r.label.padEnd(10)}  ${r.result}${r.status ? ` (${r.status})` : ''}`,
        )
        if (t) lastRequest = r.startedAt
        if (r.after.rateLimits.length > 0) limits.push(r.after.rateLimits)
        break
      }
      case 'measure':
        if (r.snapshot.rateLimits.length > 0) limits.push(r.snapshot.rateLimits)
        break
      case 'ttl':
        ttls.add(`${r.ttl} (${r.source})`)
        break
      case 'mark':
        marks.push(`  ${time(r.at)}  ${r.text}`)
        break
      case 'skip':
        forks.push(`  ${time(r.at)}  ${r.label.padEnd(10)}  skipped: ${r.why}`)
        break
    }
  }

  lines.push(`Forks (${forks.length})`, ...(forks.length ? forks : ['  none yet']))
  lines.push('', 'First request of each turn', ...(firstSteps.length ? firstSteps : ['  none yet']))
  const turns = turnCosts(records)
  lines.push(
    '',
    'Turn cost against its tokens (writes priced at the 5-minute and 1-hour rates)',
    ...(turns.length
      ? turns.map(
          t =>
            `  ${time(t.startedAt)}  write ${String(t.writeTokens).padStart(8)}  Δcost ${usd(t.deltaUsd)}` +
            `  5m ${usd(t.at5m)}  1h ${usd(t.at1h)}` +
            `  implied ${t.impliedWriteRate === null ? '-' : `$${t.impliedWriteRate.toFixed(2)}/M`}  matches ${t.matches}` +
            (t.hasUnpriced ? '  (a model with no list price)' : ''),
        )
      : ['  none recorded (turns logged before this version carry no totals)']),
  )
  const other = unattributedSpend(records)
  lines.push(
    '',
    'Spend no logged request explains',
    ...(other.length ? other.map(u => `  ${time(u.from)} → ${time(u.to)}  ${usd(u.usd)}`) : ['  none']),
  )
  const first = limits[0]
  const last = limits[limits.length - 1]
  lines.push('', `Rate limits: first ${first ? limitsText(first) : 'none reported'}; last ${last ? limitsText(last) : 'none reported'}`)
  lines.push(`Cache lifetime reported: ${ttls.size ? [...ttls].join(', ') : 'not yet'}`)
  if (marks.length) lines.push('', 'Marks', ...marks)
  return lines.join('\n')
}
