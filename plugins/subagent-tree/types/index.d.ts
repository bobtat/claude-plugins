export type AgentStats = {
  /** Tool calls the agent's loop has made. */
  tools: number
  /** Model requests its loop has made. */
  steps: number
  /** The tool it called last. */
  lastTool?: string
  /** Output tokens summed over its finished turns. */
  tokensOut: number
  /** Milliseconds its finished runs were active, idle gaps between runs left out. */
  activeMs: number
  /** Milliseconds since the epoch when the run in progress began; unset between runs. */
  runStartedAt?: number
  /** Milliseconds since the epoch of the latest event seen from it. */
  lastEventAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'subagent-tree': {
      stats: Shaped<Record<string, AgentStats>>
    }
  }
}
