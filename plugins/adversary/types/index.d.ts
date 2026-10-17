export type Kind = 'pr' | 'plan' | 'doc'
export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Location = { file: string; line?: number } | { section: string }
export type Decision = 'undecided' | 'send' | 'drop'

export type Finding = {
  id: number
  severity: Severity
  location: Location
  claim: string
  evidence: string
  decision: Decision
  editedClaim?: string
}

export type Unparsed = { raw: string; reason: string }

export type PrRef = { number: number; url: string; headRefOid: string }

export type Review = {
  kind: Kind
  target: string
  briefLabel?: string
  model?: 'opus' | 'sonnet' | 'haiku'
  root: string
  worktree?: string
  pr?: PrRef
  agentId?: string
  status: 'running' | 'done' | 'failed'
  error?: string
  findings: Finding[]
  unparsed: Unparsed[]
  raw: string
  startedAt: number
  // The root holds a link leading outside it; Grep and Glob are refused while true.
  hasOutwardLinks: boolean
}

declare module 'claude-code' {
  interface PluginState {
    adversary: {
      plan: string | null
      planPending: boolean
      review: Review | null
      selected: number
      editing: boolean
    }
  }
}
