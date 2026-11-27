import type { AgentStats } from '../types'

/** The part of `$.agent.list()`'s entries the tree reads. */
export type AgentLike = {
  id: string
  description: string
  type: string
  status: string
  parentId?: string
  name?: string
}

export type Row = {
  id: string
  depth: number
  glyph: string
  label: string
  detail: string
  isLive: boolean
}

const LIVE = new Set(['pending', 'running', 'waiting'])

const GLYPHS: Record<string, string> = {
  pending: '·',
  running: '●',
  waiting: '◐',
  idle: '○',
  completed: '✓',
  failed: '✗',
  killed: '✗',
}

export const isLive = (status: string): boolean => LIVE.has(status)

export const formatElapsed = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`

  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
}

export const formatTokens = (tokens: number): string =>
  tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(1)}M`
    : tokens >= 1_000
      ? `${Math.round(tokens / 1_000)}k`
      : String(tokens)

/**
 * How long the agent has been active: its finished runs, plus the run in
 * progress. A run left open by an agent that is no longer live stops at its
 * last event, so a killed or failed agent's clock does not keep moving.
 */
export const elapsedMs = (stats: AgentStats, status: string, now: number): number => {
  if (stats.runStartedAt === undefined) return stats.activeMs
  const end = isLive(status) ? now : stats.lastEventAt

  return stats.activeMs + Math.max(0, end - stats.runStartedAt)
}

const PRUNE_AFTER_MS = 10 * 60 * 1000
const PRUNE_CAP = 200

/**
 * Drops the stats of ids the agent list does not show once they have been
 * idle for ten minutes, and past 200 entries drops unlisted ones first, oldest
 * first. A listed agent's stats are never dropped.
 */
export const prune = (
  stats: Record<string, AgentStats>,
  listed: Set<string>,
  now: number,
): Record<string, AgentStats> => {
  const kept = Object.entries(stats).filter(
    ([id, s]) => listed.has(id) || now - s.lastEventAt < PRUNE_AFTER_MS,
  )
  if (kept.length <= PRUNE_CAP) return Object.fromEntries(kept)

  const rank = ([id, s]: [string, AgentStats]) => (listed.has(id) ? Infinity : s.lastEventAt)
  const newest = [...kept].sort((a, b) => rank(b) - rank(a)).slice(0, PRUNE_CAP)

  return Object.fromEntries(newest)
}

const detailOf = (agent: AgentLike, stats: AgentStats | undefined, now: number): string => {
  if (!stats) return agent.status
  const parts = [
    agent.status,
    formatElapsed(elapsedMs(stats, agent.status, now)),
    `${stats.tools} tool${stats.tools === 1 ? '' : 's'}`,
    `${stats.steps} step${stats.steps === 1 ? '' : 's'}`,
  ]
  if (isLive(agent.status) && stats.lastTool) parts.push(`on ${stats.lastTool}`)
  if (stats.tokensOut > 0) parts.push(`${formatTokens(stats.tokensOut)} out`)

  return parts.join(' · ')
}

/**
 * Flattens the agents into display rows, children under their parent in the
 * order the list gives them. An agent whose parent is not in the list (or is
 * the main loop) is a root; a cycle in the list cannot loop forever.
 */
export const buildRows = (
  agents: AgentLike[],
  stats: Record<string, AgentStats>,
  now: number,
): Row[] => {
  const ids = new Set(agents.map(agent => agent.id))
  const children = new Map<string, AgentLike[]>()
  const roots: AgentLike[] = []

  for (const agent of agents) {
    if (agent.parentId && ids.has(agent.parentId) && agent.parentId !== agent.id) {
      children.set(agent.parentId, [...(children.get(agent.parentId) ?? []), agent])
    } else {
      roots.push(agent)
    }
  }

  const rows: Row[] = []
  const seen = new Set<string>()
  const visit = (agent: AgentLike, depth: number) => {
    if (seen.has(agent.id)) return
    seen.add(agent.id)
    const title = agent.description || agent.name || agent.id
    rows.push({
      id: agent.id,
      depth,
      glyph: GLYPHS[agent.status] ?? '?',
      label: `${agent.type}: ${title}`,
      detail: detailOf(agent, stats[agent.id], now),
      isLive: isLive(agent.status),
    })
    for (const child of children.get(agent.id) ?? []) visit(child, depth + 1)
  }
  for (const root of roots) visit(root, 0)
  // Agents left over are in a parent cycle: show them rather than hide them.
  for (const agent of agents) visit(agent, 0)

  return rows
}

export const liveCount = (agents: AgentLike[]): number =>
  agents.filter(agent => isLive(agent.status)).length
