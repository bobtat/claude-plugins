// The probe's records and the arithmetic over them, free of engine calls so the
// tests can check it directly. Each record is one line of the JSONL log.

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = { costUsd: number | null; rateLimits: Limit[] }

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

export type ProbeRecord = { at: number } & (
  | { kind: 'session'; sessionId: string; version: string }
  | { kind: 'turn'; phase: 'start' | 'end'; turnId: string }
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
  const first = limits[0]
  const last = limits[limits.length - 1]
  lines.push('', `Rate limits: first ${first ? limitsText(first) : 'none reported'}; last ${last ? limitsText(last) : 'none reported'}`)
  lines.push(`Cache lifetime reported: ${ttls.size ? [...ttls].join(', ') : 'not yet'}`)
  if (marks.length) lines.push('', 'Marks', ...marks)
  return lines.join('\n')
}
