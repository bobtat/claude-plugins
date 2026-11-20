export type Family = 'haiku' | 'sonnet' | 'opus' | 'fable'
export type Kind = 'locating' | 'reading' | 'other'
export type Mode = 'observe' | 'route' | 'off'
export type Route = Family | 'parent'
export type PickReason = 'answered' | 'unparseable' | 'timeout' | 'aborted' | 'error' | 'empty-prompt' | 'too-long'
export type PickResult = { kind: Kind; reason: PickReason; ms: number }
export type Settings = { mode: Mode; routes: { locating: Route; reading: Route }; standingDown: string | null; notes: string[] }
export type Outcome = 'routed' | 'would-route' | 'unchanged' | 'refused' | 'not-started'
export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type DecisionRecord = {
  v: 1; at: number; agentType: string; description: string
  kind: Kind | null; outcome: Outcome; reason: string; target: Family | null
  overridden: boolean          // routed, but the model that started is not the target
  started: string | null       // model the spawn result named
  ran: string | null           // model of the last turn that reported usage
  agentId: string | null; tokens: Tokens | null; usd: number | null
  partial?: true               // usd leaves out turns whose model had no listed price; absent: not known to be partial
}
export type RoutedEntry = { v: 1; target: Family; baseline: string }
export type Index = { v: 1; ids: string[]; outOfScope: number; wouldRefuse: number }

declare module 'claude-code' {
  interface PluginState {
    'subagent-router': {
      decision: StateFamily<DecisionRecord>
      index: Index
      byAgent: StateFamily<string>
      baseline: StateFamily<string>
      routed: StateFamily<RoutedEntry>
      observed: StateFamily<{ v: 1 }>
      routeOff: StateFamily<true>
      pickerOff: boolean
      checkStartedAt: number
    }
  }
}
