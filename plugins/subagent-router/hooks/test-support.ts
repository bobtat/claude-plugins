import { expect, mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { AgentSpawnInput, CommandRunInput, CommandSpec, ConfigSetInput, ModelCompleteRequest, ModelCompleteResult, On, SessionMessage } from 'claude-code'
import type { DecisionRecord, Index } from '../types'

// The stand-ins and helpers the hook tests share. Not a test file and not a hooks module.

// The kit has setTimeout, though the engine's typings omit it.
declare const setTimeout: (run: () => void, ms: number) => unknown

export const USAGE = { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
export const PROMPT = 'find callers of ParseMap'
export const ENGINE = { plugin: 'engine', tier: 'core' } as const
export const FAILED: ModelCompleteResult = { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: USAGE }

export type Started = { model: string; agentId?: string } | { deny: string }
export type Write = { key: string; id?: string; value: unknown }

export type World = {
  mode: string
  routes: Record<string, string>
  kinds: string[]
  startModel: string
  sessionModel: string
  env: Record<string, string>
  settings: ((source: string | undefined) => unknown) | null
  reply: (e: ModelCompleteRequest) => ModelCompleteResult | Promise<ModelCompleteResult>
  answer: (e: AgentSpawnInput) => Started | Promise<Started>
  start: (e: AgentSpawnInput) => Started
  messages: (agentId: string | undefined) => SessionMessage[] | { deny: string }
  failSet: string | null
  onLog: (text: string) => void
  registration: 'answers' | 'refuses' | 'hangs'
  registered: CommandSpec[]
  picks: ModelCompleteRequest[]
  seen: AgentSpawnInput[]
  lines: string[]
  sets: Write[]
  messageReads: number
}

// The stand-ins every hook test registers: one per event, each with a switch the test may set.
export function world(on: On): World {
  const w: World = {
    mode: 'route',
    routes: {},
    kinds: ['locating'],
    startModel: 'claude-opus-5-5',
    sessionModel: 'claude-opus-5-5',
    env: {},
    settings: null,
    reply: () => ({ isAnswered: true, text: w.kinds.length > 1 ? (w.kinds.shift() ?? 'other') : (w.kinds[0] ?? 'other'), usage: USAGE }),
    answer: (e) => w.start(e),
    start: (e) => ({ model: e.model ?? w.startModel, agentId: `a${w.seen.length}` }),
    messages: () => ({ deny: 'not readable' }),
    failSet: null,
    onLog: () => {},
    registration: 'answers',
    registered: [],
    picks: [],
    seen: [],
    lines: [],
    sets: [],
    messageReads: 0,
  }
  const user = () => ({ pluginConfigs: { 'subagent-router': { options: { mode: w.mode, ...w.routes } } } })
  on('settings.read', (_$, e) => ({ value: (w.settings ? w.settings(e.source) : e.source === 'user' ? user() : {}) as never }))
  // A switchable env.get in place of mock.env, which takes one fixed set of variables per test.
  on('env.get', (_$, e) => ({ value: w.env[e.name] }))
  mock.clock(on)
  on('session.model', () => ({ value: w.sessionModel }))
  on('session.messages', (_$, e) => {
    w.messageReads += 1
    return { value: w.messages(e.agentId) as never }
  })
  on('model.complete', async (_$, e) => {
    w.picks.push(e)
    return { value: await w.reply(e) }
  })
  on('agent.spawn', (_$, e) => {
    w.seen.push(e)
    return w.answer(e)
  })
  on('ui.log', (_$, e) => {
    w.lines.push(e.text)
    w.onLog(e.text)
    return { value: undefined }
  })
  // A deny makes the plugin's $.command.register reject, as for state.set below.
  on('command.register', (_$, e) => {
    w.registered.push(e)
    if (w.registration === 'refuses') return { deny: 'refused' } as never
    if (w.registration === 'hangs') return new Promise<never>(() => {})
    return { value: { command: e.name } }
  })
  // A thrown stand-in is skipped and the kit's own state writes anyway; a deny makes the plugin's write reject.
  on('state.set', (_$, e, next) => {
    if (e.key === w.failSet) return { deny: 'refused' } as never
    w.sets.push(e)
    return next(e)
  })
  return w
}

// The latest value written to each decision id, in order of first write.
export function records(w: World): DecisionRecord[] {
  const latest = new Map<string, DecisionRecord>()
  for (const s of w.sets) if (s.key === 'decision' && s.id !== undefined) latest.set(s.id, s.value as DecisionRecord)
  return [...latest.values()]
}

export const recordIds = (w: World): string[] => [...new Set(w.sets.flatMap((s) => (s.key === 'decision' && s.id !== undefined ? [s.id] : [])))]

export const index = (w: World): Index | undefined => w.sets.filter((s) => s.key === 'index').at(-1)?.value as Index | undefined
export const written = (w: World, key: string, from = 0) => w.sets.slice(from).filter((s) => s.key === key)

export function spawner($: Engine) {
  let n = 0
  return (extra: Partial<AgentSpawnInput> = {}) =>
    $.agent.spawn(input({ tool_use_id: `toolu_${++n}`, ...extra })) as Promise<Started>
}

export const input = (extra: Partial<AgentSpawnInput> = {}): AgentSpawnInput => ({
  prompt: PROMPT,
  description: 'find callers',
  subagentType: 'Explore',
  provider: ENGINE,
  parentModel: 'claude-opus-5-5',
  fork: false,
  background: false,
  tool_use_id: 'toolu_0',
  ...extra,
})

export const isDenied = (r: Started) => 'deny' in r

export async function until(holds: () => boolean): Promise<void> {
  for (let i = 0; i < 1000 && !holds(); i++) await new Promise<void>((resolve) => setTimeout(resolve, 2))
  if (!holds()) throw new Error('timed out waiting')
}

export const first = (text: string) => () => [{ role: 'user' as const, text, toolUses: [] }]

export const RUN: CommandRunInput = { command: 'subagent-router', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }
export const report = async ($: Engine) => (await $.command.run(RUN)).text ?? ''

export const change = (key: string, origin: ConfigSetInput['origin']): ConfigSetInput => ({
  key, value: 'route', previous: 'observe', provider: { plugin: 'subagent-router', tier: 'user' }, origin,
})

export async function routeA2(spawn: ReturnType<typeof spawner>) {
  await spawn()
  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a2' })
}
