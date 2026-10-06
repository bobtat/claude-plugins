export type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

export type Category = 'input' | 'output' | 'cacheRead' | 'cacheWrite'

export type Breakdown = {
  tokens: Record<Category, number>
  usd: Record<Category, number>
  // Tokens from models with no rate; absent in entries written before 0.4.0.
  unpricedTokens?: number
}

export type ProjectDay = { usd: number; cacheWriteUsd: number }

// One prompt's cost, its subagents included, estimated from its requests.
export type TurnRecord = {
  at: number
  prompt: string
  project: string
  steps: number
  subagentSteps: number
  usage: Breakdown
  subagentUsage: Breakdown
}

export type ActiveTurn = Omit<TurnRecord, 'project'> & { turnId: string }

// What one tool's results cost while they sat in context: approximate tokens,
// the cache write when first sent, and every cached re-read after that.
export type ToolUse = { calls: number; tokens: number; writeUsd: number; rereadUsd: number }

// A loop's tool results by tool, in approximate tokens: pending until the next
// request sends them, resident once cached.
export type LoopContext = { pending: Record<string, number>; resident: Record<string, number> }

export type Totals = {
  session: number
  today: number
  week: number
  month: number
  weekStart: string
  days: Record<string, number>
  cacheDays: Record<string, Breakdown>
  subagentDays: Record<string, Breakdown>
  projectDays: Record<string, Record<string, ProjectDay>>
  turns: TurnRecord[]
  toolDays: Record<string, Record<string, ToolUse>>
  rateLimits: RateLimit[]
}

export type Context = { tokens: number; model: string; at: number }

export type Shading = 'total' | 'cacheWrite'

declare module 'claude-code' {
  interface PluginState {
    'cost-ledger': {
      totals: Totals | null
      lastUsd: number | null
      monthOffset: number
      context: Context | null
      shadeBy: Shading
      tick: number
      activeTurn: ActiveTurn | null
      turnPrompts: Record<string, { text: string; at: number }>
      loops: Record<string, LoopContext>
    }
  }
}
