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

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text

const detailOf = (agent: AgentLike, stats: AgentStats | undefined, now: number): string => {
  if (!stats) return agent.status
  const end = stats.endedAt ?? now
  const parts = [
    agent.status,
    formatElapsed(end - stats.startedAt),
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
  width = 60,
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
      label: truncate(`${agent.type}: ${title}`, Math.max(16, width - depth * 2 - 2)),
      detail: detailOf(agent, stats[agent.id], now),
      isLive: isLive(agent.status),
    })
    for (const child of children.get(agent.id) ?? []) visit(child, depth + 1)
  }
  for (const root of roots) visit(root, 0)

  return rows
}

export const liveCount = (agents: AgentLike[]): number =>
  agents.filter(agent => isLive(agent.status)).length
