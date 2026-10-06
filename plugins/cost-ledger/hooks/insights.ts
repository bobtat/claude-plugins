import { addBreakdown, emptyBreakdown, totalUsd } from './pricing'
import type { ActiveTurn, Breakdown, TurnRecord } from '../types'

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
