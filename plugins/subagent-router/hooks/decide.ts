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
  | { action: 'unchanged'; reason: 'other' | 'route-off' | 'not-cheaper' | 'baseline-unknown' }

type Routes = { locating: Route; reading: Route }

export function resolve(kind: Kind, routes: Routes, baseline: string | undefined): Resolution {
  if (kind === 'other') return { action: 'unchanged', reason: 'other' }
  const target = routes[kind]
  if (target === 'parent') return { action: 'unchanged', reason: 'route-off' }
  if (baseline === undefined || familyOf(baseline) === undefined) return { action: 'unchanged', reason: 'baseline-unknown' }
  if (!ranksBelow(target, baseline)) return { action: 'unchanged', reason: 'not-cheaper' }
  return { action: 'route', target }
}

export function anyRouteApplies(routes: Routes, baseline: string | undefined): boolean {
  return resolve('locating', routes, baseline).action === 'route' || resolve('reading', routes, baseline).action === 'route'
}
