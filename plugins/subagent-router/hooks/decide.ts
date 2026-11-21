import type { AgentSpawnInput, Origin } from 'claude-code'
import type { Family, Kind, Mode, Route } from '../types'
import { familyOf, ranksBelow } from './model-rank'

export type Precheck = 'deny' | 'pass' | 'explicit' | 'pick'

export type SpawnFacts = {
  mode: Mode
  standingDown: boolean
  spawnerWasRouted: boolean
  isFork: boolean
  isResume: boolean
  isTeammate: boolean
  isWorkflow: boolean
  byOtherPlugin: boolean
  isBuiltIn: boolean
  subagentType: string
  hasExplicitModel: boolean
}

const IN_SCOPE_TYPES: readonly string[] = ['Explore', 'general-purpose']

export type SpawnEvent = Pick<AgentSpawnInput, 'subagentType' | 'fork' | 'resume' | 'isTeammate' | 'workflow' | 'provider' | 'model'>

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

// Every field is read as if it could be missing or of the wrong type, because at run time it can be.
export function factsOf(
  e: SpawnEvent,
  origin: Origin,
  known: { mode: Mode; standingDown: boolean; spawnerWasRouted: boolean },
): SpawnFacts {
  return {
    ...known,
    isFork: e.fork === true,
    // A resume lets a routed agent's spawn through, so only the documented shape counts as one.
    isResume: isRecord(e.resume) && typeof e.resume.agentId === 'string' && e.resume.agentId !== '',
    isTeammate: e.isTeammate === true,
    isWorkflow: e.workflow !== undefined,
    // A plugin's spawn arrives exactly like an engine one (probe Q13); only the origin tells them apart.
    byOtherPlugin: origin?.plugin !== 'engine' && origin?.plugin !== 'subagent-router',
    isBuiltIn: e.provider?.plugin === 'engine' && e.provider?.tier === 'core',
    subagentType: typeof e.subagentType === 'string' ? e.subagentType : '',
    // The key is present even when unset (probe), and an unset value may come as null.
    hasExplicitModel: e.model != null,
  }
}

export function precheck(f: SpawnFacts): Precheck {
  // Checked before the mode so that a routed agent cannot spawn further agents
  // even when the router is off or standing down.
  if (f.spawnerWasRouted) return f.isFork || f.isResume ? 'pass' : 'deny'
  if (f.mode === 'off' || f.standingDown) return 'pass'
  if (f.isFork || f.isResume || f.isTeammate || f.isWorkflow || f.byOtherPlugin || !f.isBuiltIn) return 'pass'
  if (!IN_SCOPE_TYPES.includes(f.subagentType)) return 'pass'
  if (f.hasExplicitModel) return 'explicit'
  return 'pick'
}

export type Resolution =
  | { action: 'route'; target: Family }
  | { action: 'unchanged'; reason: 'other' | 'route-off' | 'not-cheaper' | 'baseline-unknown' | 'baseline-unrecognised' }

type Routes = { locating: Route; reading: Route }

export function resolve(kind: Kind, routes: Routes, baseline: string | undefined): Resolution {
  if (kind === 'other') return { action: 'unchanged', reason: 'other' }
  const target = routes[kind]
  if (target === 'parent') return { action: 'unchanged', reason: 'route-off' }
  if (baseline === undefined) return { action: 'unchanged', reason: 'baseline-unknown' }
  // Learned, but not a model the router can rank: a reason of its own, so the report does not count it as a baseline
  // still being learned.
  if (familyOf(baseline) === undefined) return { action: 'unchanged', reason: 'baseline-unrecognised' }
  if (!ranksBelow(target, baseline)) return { action: 'unchanged', reason: 'not-cheaper' }
  return { action: 'route', target }
}

export function anyRouteApplies(routes: Routes, baseline: string | undefined): boolean {
  return resolve('locating', routes, baseline).action === 'route' || resolve('reading', routes, baseline).action === 'route'
}
