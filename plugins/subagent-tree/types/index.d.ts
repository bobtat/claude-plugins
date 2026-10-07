export type AgentStats = {
  /** Tool calls the agent's loop has made. */
  tools: number
  /** Model requests its loop has made. */
  steps: number
  /** The tool it called last. */
  lastTool?: string
  /** Output tokens summed over its finished turns. */
  tokensOut: number
  /** Input tokens summed over its finished turns, cache reads and writes included. */
  tokensIn: number
  /** Milliseconds since the epoch of the first event seen from it. */
  startedAt: number
  /** When its latest turn completed; unset while a turn runs. */
  endedAt?: number
}

declare module 'claude-code' {
  interface PluginState {
    'subagent-tree': {
      stats: Record<string, AgentStats>
      tick: number
    }
  }
}
