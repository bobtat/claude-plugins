import { addBreakdown, emptyBreakdown, totalUsd } from './pricing'
import type { ActiveTurn, Breakdown, LoopContext, ToolUse, TurnRecord } from '../types'

const PROMPT_CHARS = 80
export const TURNS_PER_MONTH = 10

const pad = (n: number) => String(n).padStart(2, '0')
const localDay = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ---- Cost per prompt -------------------------------------------------------

export function startTurn(turnId: string, text: string, now: number): ActiveTurn {
  const prompt = text.replace(/\s+/g, ' ').trim()
  return {
    turnId,
    prompt: prompt.length > PROMPT_CHARS ? `${prompt.slice(0, PROMPT_CHARS - 1)}…` : prompt,
    at: now,
    steps: 0,
    subagentSteps: 0,
    usage: emptyBreakdown(),
    subagentUsage: emptyBreakdown(),
  }
}

export function addStepToTurn(turn: ActiveTurn, usage: Breakdown, isSubagent: boolean): ActiveTurn {
  return {
    ...turn,
    steps: turn.steps + (isSubagent ? 0 : 1),
    subagentSteps: turn.subagentSteps + (isSubagent ? 1 : 0),
    usage: addBreakdown(turn.usage, usage),
    subagentUsage: isSubagent ? addBreakdown(turn.subagentUsage, usage) : turn.subagentUsage,
  }
}

export function finishTurn(turn: ActiveTurn, project: string): TurnRecord {
  const { turnId: _turnId, ...record } = turn
  return { ...record, project }
}

export function turnUsd(turn: TurnRecord): number {
  return totalUsd(turn.usage)
}

// Keeps the most expensive prompts of each month, so a month's top list
// survives however many cheap prompts follow it.
export function keepTopTurns(turns: readonly TurnRecord[]): TurnRecord[] {
  const byMonth = new Map<string, TurnRecord[]>()
  for (const turn of turns) {
    const month = localDay(turn.at).slice(0, 7)
    byMonth.set(month, [...(byMonth.get(month) ?? []), turn])
  }
  return [...byMonth.values()].flatMap(month =>
    [...month].sort((a, b) => turnUsd(b) - turnUsd(a)).slice(0, TURNS_PER_MONTH),
  )
}

export function turnsIn(turns: readonly TurnRecord[], fromDay: string, toDay: string): TurnRecord[] {
  return turns
    .filter(turn => {
      const day = localDay(turn.at)
      return day >= fromDay && day <= toDay
    })
    .sort((a, b) => turnUsd(b) - turnUsd(a))
}

// ---- What fills the context --------------------------------------------------

// Tool results are measured in characters; four per token is the usual rough
// ratio for English and code, so these figures are approximate by design.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function toolLabel(tool: string): string {
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool)
  return mcp ? `${mcp[1]}/${mcp[2]}` : tool
}

export function emptyLoop(): LoopContext {
  return { pending: {}, resident: {} }
}

export function addToolResult(loop: LoopContext | undefined, tool: string, tokens: number): LoopContext {
  const current = loop ?? emptyLoop()
  return { ...current, pending: { ...current.pending, [tool]: (current.pending[tool] ?? 0) + tokens } }
}

export type ToolCharges = Record<string, { writeUsd: number; rereadUsd: number }>

// One model request of a loop: results already cached are read again at the
// read rate, and results added since the last request are written at the write
// rate, after which they are cached too.
export function chargeStep(
  loop: LoopContext,
  readPerToken: number,
  writePerToken: number,
): { loop: LoopContext; charges: ToolCharges } {
  const charges: ToolCharges = {}
  const charge = (tool: string) => (charges[tool] ??= { writeUsd: 0, rereadUsd: 0 })
  for (const [tool, tokens] of Object.entries(loop.resident)) charge(tool).rereadUsd += tokens * readPerToken
  const resident = { ...loop.resident }
  for (const [tool, tokens] of Object.entries(loop.pending)) {
    charge(tool).writeUsd += tokens * writePerToken
    resident[tool] = (resident[tool] ?? 0) + tokens
  }
  return { loop: { pending: {}, resident }, charges }
}

const emptyToolUse = (): ToolUse => ({ calls: 0, tokens: 0, writeUsd: 0, rereadUsd: 0 })

export function addToolUse(a: ToolUse | undefined, b: ToolUse): ToolUse {
  const sum = a ?? emptyToolUse()
  return {
    calls: sum.calls + b.calls,
    tokens: sum.tokens + b.tokens,
    writeUsd: sum.writeUsd + b.writeUsd,
    rereadUsd: sum.rereadUsd + b.rereadUsd,
  }
}

export function mergeToolMaps(
  a: Record<string, ToolUse> | undefined,
  b: Record<string, ToolUse> | undefined,
): Record<string, ToolUse> {
  const merged = { ...a }
  for (const [tool, use] of Object.entries(b ?? {})) merged[tool] = addToolUse(merged[tool], use)
  return merged
}

export function chargesAsUse(charges: ToolCharges): Record<string, ToolUse> {
  return Object.fromEntries(
    Object.entries(charges).map(([tool, c]) => [tool, { ...emptyToolUse(), writeUsd: c.writeUsd, rereadUsd: c.rereadUsd }]),
  )
}

export function topTools(
  toolDays: Record<string, Record<string, ToolUse>>,
  fromDay: string,
  toDay: string,
): [string, ToolUse][] {
  let merged: Record<string, ToolUse> = {}
  for (const [day, tools] of Object.entries(toolDays)) {
    if (day >= fromDay && day <= toDay) merged = mergeToolMaps(merged, tools)
  }
  return Object.entries(merged).sort(([, a], [, b]) => b.writeUsd + b.rereadUsd - (a.writeUsd + a.rereadUsd))
}
