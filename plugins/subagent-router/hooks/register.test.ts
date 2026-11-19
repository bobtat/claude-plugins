import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { AgentSpawnInput, CommandRunInput, CommandSpec, ModelCompleteRequest, ModelCompleteResult, On, SessionMessage } from 'claude-code'
import type { DecisionRecord, Index } from '../types'
import { DENY_TEXT, MARKER, routerNote } from './note'
import { estimateUsd, priceOf } from './prices'

// The kit has setTimeout, though the engine's typings omit it.
declare const setTimeout: (run: () => void, ms: number) => unknown

const USAGE = { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const PROMPT = 'find callers of ParseMap'
const ENGINE = { plugin: 'engine', tier: 'core' } as const
const FAILED: ModelCompleteResult = { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: USAGE }

type Started = { model: string; agentId?: string } | { deny: string }
type Write = { key: string; id?: string; value: unknown }

type World = {
  mode: string
  routes: Record<string, string>
  kinds: string[]
  startModel: string
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
function world(on: On): World {
  const w: World = {
    mode: 'route',
    routes: {},
    kinds: ['locating'],
    startModel: 'claude-opus-5-5',
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
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
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
function records(w: World): DecisionRecord[] {
  const latest = new Map<string, DecisionRecord>()
  for (const s of w.sets) if (s.key === 'decision' && s.id !== undefined) latest.set(s.id, s.value as DecisionRecord)
  return [...latest.values()]
}

const recordIds = (w: World): string[] => [...new Set(w.sets.flatMap((s) => (s.key === 'decision' && s.id !== undefined ? [s.id] : [])))]

const index = (w: World): Index | undefined => w.sets.filter((s) => s.key === 'index').at(-1)?.value as Index | undefined
const written = (w: World, key: string, from = 0) => w.sets.slice(from).filter((s) => s.key === key)

function spawner($: Engine) {
  let n = 0
  return (extra: Partial<AgentSpawnInput> = {}) =>
    $.agent.spawn(input({ tool_use_id: `toolu_${++n}`, ...extra })) as Promise<Started>
}

const input = (extra: Partial<AgentSpawnInput> = {}): AgentSpawnInput => ({
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

const isDenied = (r: Started) => 'deny' in r

async function until(holds: () => boolean): Promise<void> {
  for (let i = 0; i < 1000 && !holds(); i++) await new Promise<void>((resolve) => setTimeout(resolve, 2))
  if (!holds()) throw new Error('timed out waiting')
}

const first = (text: string) => () => [{ role: 'user' as const, text, toolUses: [] }]

const RUN: CommandRunInput = { command: 'subagent-router', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } }
const report = async ($: Engine) => (await $.command.run(RUN)).text ?? ''

// --- routing ---

test('route mode: the first spawn teaches the baseline and the second is routed', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)

  await spawn()
  expect(w.seen[0]?.model).toBe(undefined)
  expect(w.seen[0]?.prompt).toBe(PROMPT)
  expect(w.picks.length).toBe(0)
  expect(records(w)[0]?.reason).toBe('baseline-unknown')

  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a2' })
  expect(w.seen[1]?.model).toBe('haiku')
  expect(w.seen[1]?.prompt.startsWith(PROMPT + '\n\n')).toBe(true)
  expect(w.seen[1]?.prompt.endsWith(MARKER)).toBe(true)
  expect(records(w)[1]).toEqual(expect.objectContaining({
    outcome: 'routed', kind: 'locating', target: 'haiku', started: 'haiku', agentId: 'a2', overridden: false,
  }))
  expect(w.lines.filter((line) => line.includes('haiku')).length).toBe(1)
})

test('observe mode changes nothing and records what it would do', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.mode = 'observe'

  await spawn()
  await spawn()
  expect(w.seen.map((s) => s.model)).toEqual([undefined, undefined])
  expect(w.seen.map((s) => s.prompt)).toEqual([PROMPT, PROMPT])
  expect(w.picks.length).toBe(2)
  expect(records(w)[1]?.outcome).toBe('would-route')
  expect(w.lines).toEqual([])

  const third = await spawn({ parentAgentId: 'a2', subagentType: 'feature-dev:code-explorer' })
  expect(isDenied(third)).toBe(false)
  expect(index(w)?.wouldRefuse).toBe(1)
})

test('a reading task with the reading route off is recorded with its kind and left alone', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.mode = 'observe'
  w.kinds = ['reading']

  await spawn()
  expect(records(w)[0]).toEqual(expect.objectContaining({ kind: 'reading', outcome: 'unchanged', reason: 'route-off' }))
  expect(w.seen[0]?.model).toBe(undefined)
})

test('the baseline is kept per agent type and parent model, and an explicit model never teaches it', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)

  await spawn({ model: 'opus' })
  await spawn()
  expect(records(w)[1]?.reason).toBe('baseline-unknown')
  await spawn({ parentModel: 'claude-haiku-5-5' })
  expect(w.seen[2]?.model).toBe(undefined)
  expect(records(w)[2]?.reason).toBe('baseline-unknown')
  await spawn({ subagentType: 'general-purpose' })
  expect(records(w)[3]?.reason).toBe('baseline-unknown')
  await spawn()
  expect(records(w)[4]?.outcome).toBe('routed')

  // Only the caller's own model and one below the learned Opus baseline were ever set.
  expect(w.seen.map((s) => s.model)).toEqual(['opus', undefined, undefined, undefined, 'haiku'])
})

test('under a Sonnet parent, locating goes to haiku and a Sonnet reading route does nothing', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.routes = { readingRoute: 'sonnet' }
  w.startModel = 'claude-sonnet-5-5'
  w.kinds = ['locating', 'reading']
  const sonnet = { parentModel: 'claude-sonnet-5-5' }

  await spawn(sonnet)
  await spawn(sonnet)
  expect(w.seen[1]?.model).toBe('haiku')
  await spawn(sonnet)
  expect(w.seen[2]?.model).toBe(undefined)
  expect(records(w)[2]?.reason).toBe('not-cheaper')
})

test('a picker failure is recorded with its own reason, and three in a row switch the picker off', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.mode = 'observe'
  w.reply = () => FAILED

  await spawn()
  await spawn()
  await spawn()
  expect(records(w).map((r) => r.reason)).toEqual(['error', 'error', 'error'])
  await spawn()
  expect(records(w)[3]?.reason).toBe('picker-off')
  expect(w.picks.length).toBe(3)
})

test('picker failures that begin together count once', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.mode = 'observe'
  let release = () => {}
  const allAsked = new Promise<void>((resolve) => {
    release = resolve
  })
  w.reply = async () => {
    if (w.picks.length >= 3) release()
    await allAsked
    return FAILED
  }

  await Promise.all([spawn(), spawn(), spawn()])
  await spawn()
  expect(w.picks.length).toBe(4)
  expect(records(w).map((r) => r.reason)).toEqual(['error', 'error', 'error', 'error'])
})

test('an Escape on the picker is recorded as aborted and never switches it off', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.mode = 'observe'
  w.reply = () => ({ isAnswered: false, reason: 'aborted', usage: USAGE })

  for (let i = 0; i < 5; i++) await spawn()
  expect(records(w).map((r) => r.reason)).toEqual(['aborted', 'aborted', 'aborted', 'aborted', 'aborted'])
  await spawn()
  expect(w.picks.length).toBe(6)
})

// --- what is never touched ---

test('out-of-scope spawns are passed on untouched, with no picker call and no record', async ($, on) => {
  const w = world(on)
  const cases: Partial<AgentSpawnInput>[] = [
    { fork: true },
    { resume: { agentId: 'a9' } },
    { isTeammate: true },
    { workflow: { runId: 'wf_1', agentIndex: 1 } },
    { provider: { plugin: 'x', tier: 'user' }, subagentType: 'general-purpose' },
    { subagentType: 'Plan' },
  ]

  for (const [i, extra] of cases.entries()) {
    const sent = input({ tool_use_id: `toolu_${i}`, ...extra })
    await $.agent.spawn(sent)
    expect(w.seen[i]).toEqual(sent)
  }
  expect(w.picks.length).toBe(0)
  expect(records(w)).toEqual([])
  expect(index(w)?.outOfScope).toBe(cases.length)
})

test(
  "another plugin's spawn of a built-in agent is passed on untouched",
  {
    plugins: [
      {
        name: 'other',
        register(on) {
          on('session.start', async ($, e, next) => {
            await $.agent.spawn({ prompt: 'find callers of ParseMap', description: 'find callers', subagentType: 'Explore' })
            return next(e)
          })
        },
      },
    ],
  },
  async ($, on) => {
    const w = world(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    const spawn = spawner($)

    await spawn()
    await $.session.start({ cwd: '/', surface: null, isInteractive: false })
    // Under the kit this spawn also has no provider (K7), so it is out of scope twice over; the origin is
    // what tells it apart in a session (Q13), and decide.test.ts pins that through factsOf.
    expect(w.picks.length).toBe(0)
    expect(w.seen[1]?.model).toBe(undefined)
    expect(w.seen[1]?.prompt).toBe(PROMPT)

    await spawn()
    expect(w.picks.length).toBe(1)
    expect(w.seen[2]?.model).toBe('haiku')
  },
)

test('an explicit model is left alone and recorded', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)

  await spawn({ model: 'sonnet' })
  expect(w.picks.length).toBe(0)
  expect(w.seen[0]?.model).toBe('sonnet')
  expect(records(w)[0]).toEqual(expect.objectContaining({ outcome: 'unchanged', reason: 'explicit', started: 'sonnet' }))

  w.answer = () => ({ deny: 'limit' })
  expect(await spawn({ model: 'sonnet' })).toEqual({ deny: 'limit' })
  expect(records(w)[1]?.outcome).toBe('not-started')
})

test('mode off and standing down do nothing at all', async ($, on) => {
  const w = world(on)
  w.mode = 'off'

  const off = input({ tool_use_id: 'toolu_1' })
  await $.agent.spawn(off)
  expect(w.picks.length).toBe(0)
  expect(records(w)).toEqual([])
  expect(w.sets).toEqual([])
  expect(w.seen[0]).toEqual(off)

  w.mode = 'route'
  w.env = { CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1' }
  const forced = input({ tool_use_id: 'toolu_2' })
  await $.agent.spawn(forced)
  expect(w.picks.length).toBe(0)
  expect(w.sets).toEqual([])
  expect(w.seen[1]).toEqual(forced)
})

test('a value set only in the project, local or flag source is ignored', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  const ours = (options: object) => ({ pluginConfigs: { 'subagent-router': { options } } })

  w.settings = (source) => (['project', 'local', 'flag'].includes(source ?? '') ? ours({ mode: 'route' }) : {})
  await spawn()
  await spawn()
  expect(w.seen[1]?.model).toBe(undefined)

  const before = records(w).length
  w.settings = (source) => (source === 'policy' ? ours({ mode: 'off' }) : source === 'user' ? ours({ mode: 'route' }) : {})
  await spawn()
  await spawn()
  expect(w.seen[3]?.model).toBe(undefined)
  expect(records(w).length).toBe(before)
})

// --- the no-spawn rule ---

async function routeA2(spawn: ReturnType<typeof spawner>) {
  await spawn()
  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a2' })
}

test('a spawn under a routed agent is refused, and stays refused after the mode is changed', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await routeA2(spawn)
  const child = { parentAgentId: 'a2', subagentType: 'general-purpose' }

  expect(await spawn(child)).toEqual({ deny: DENY_TEXT })
  expect(records(w).at(-1)).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'spawner-routed' }))
  expect(w.lines.filter((line) => line.includes('Refused')).length).toBe(1)
  expect(w.seen.length).toBe(2)

  w.mode = 'observe'
  expect(await spawn(child)).toEqual({ deny: DENY_TEXT })
  w.mode = 'off'
  expect(await spawn(child)).toEqual({ deny: DENY_TEXT })
  expect(w.seen.length).toBe(2)

  expect(isDenied(await spawn({ parentAgentId: 'a2', fork: true }))).toBe(false)
})

test('a fork of a routed agent is itself treated as routed', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await routeA2(spawn)

  expect(await spawn({ parentAgentId: 'a2', fork: true })).toEqual({ model: 'claude-opus-5-5', agentId: 'a3' })
  expect(written(w, 'routed').some((s) => s.id === 'a3')).toBe(true)
  expect(await spawn({ parentAgentId: 'a3', subagentType: 'general-purpose' })).toEqual({ deny: DENY_TEXT })
})

test('every kind of spawn under a routed agent is refused', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await routeA2(spawn)
  const kinds: Partial<AgentSpawnInput>[] = [
    { subagentType: 'Explore' },
    { subagentType: 'general-purpose' },
    { subagentType: 'Plan' },
    { subagentType: 'feature-dev:code-explorer', provider: { plugin: 'feature-dev', tier: 'user' } },
  ]
  const all = [...kinds, ...kinds.map((k) => ({ ...k, model: 'opus' })), ...kinds.map((k) => ({ ...k, isTeammate: true as const }))]

  for (const extra of all) expect(await spawn({ parentAgentId: 'a2', ...extra })).toEqual({ deny: DENY_TEXT })
  expect(w.seen.length).toBe(2)
})

test('the refusal survives a failing record write', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await routeA2(spawn)

  w.failSet = 'decision'
  expect(await spawn({ parentAgentId: 'a2', subagentType: 'general-purpose' })).toEqual({ deny: DENY_TEXT })
  expect(records(w).length).toBe(2)
})

test('a routed entry left by another version still counts as routed', async ($, on) => {
  world(on)
  on('state.get', { plugin: 'subagent-router', key: 'routed' }, (_$, e, next) =>
    e.id === 'old1' ? { value: { value: { target: 'haiku' }, version: 1 } as never } : next(e),
  )
  const spawn = spawner($)

  expect(await spawn({ parentAgentId: 'old1' })).toEqual({ deny: DENY_TEXT })
})

// A failing read is the state.get stand-in answering { deny }: a thrown stand-in is skipped and the kit's own
// state answers in its place (K9), while a deny makes the plugin's $.state.get reject.
function failRead(on: On, key: 'routed' | 'observed') {
  const refuse = () => ({ deny: 'unreadable' }) as never
  if (key === 'routed') on('state.get', { plugin: 'subagent-router', key: 'routed' }, refuse)
  else on('state.get', { plugin: 'subagent-router', key: 'observed' }, refuse)
}

const markedNote = routerNote({ target: 'haiku', baseline: 'claude-opus-5-5', kind: 'locating', noResume: true })

test('an unreadable routed entry leaves the marker to decide, and a marked spawner is refused', async ($, on) => {
  const w = world(on)
  failRead(on, 'routed')
  const spawn = spawner($)
  w.messages = first('find X\n\n' + markedNote)

  expect(await spawn({ parentAgentId: 'u1', parentModel: 'claude-haiku-5-5' })).toEqual({ deny: DENY_TEXT })
  expect(w.seen.length).toBe(0)
})

test('an unreadable routed entry with no marker in the first message lets the spawn through unchanged', async ($, on) => {
  const w = world(on)
  failRead(on, 'routed')
  w.messages = first('find X')

  const sent = input({ tool_use_id: 'toolu_1', parentAgentId: 'u1', parentModel: 'claude-haiku-5-5' })
  expect(isDenied((await $.agent.spawn(sent)) as Started)).toBe(false)
  expect(w.seen).toEqual([sent])
})

test('an unreadable observed entry is not a failure of the hook', async ($, on) => {
  const w = world(on)
  failRead(on, 'observed')
  w.messages = first('find X')

  expect(isDenied(await spawner($)({ parentAgentId: 'u1', parentModel: 'claude-haiku-5-5' }))).toBe(false)
  // The hook went on to record the spawn: a read that failed the hook would have left no record.
  expect(records(w).length).toBe(1)
})

test('an unrecognised spawner is refused only on the marker and a cheaper model', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.mode = 'observe'
  const note = routerNote({ target: 'haiku', baseline: 'claude-opus-5-5', kind: 'locating', noResume: true })
  const under = (parentModel: string) => ({ parentAgentId: 'u1', parentModel })

  w.messages = first('find X\n\n' + note)
  expect(await spawn(under('claude-haiku-5-5'))).toEqual({ deny: DENY_TEXT })

  const reads = w.messageReads
  expect(isDenied(await spawn(under('claude-opus-5-5')))).toBe(false)
  expect(w.messageReads).toBe(reads)

  w.messages = first(`quoted ${MARKER} here\nfind Y`)
  expect(isDenied(await spawn(under('claude-haiku-5-5')))).toBe(false)

  w.messages = () => ({ deny: 'x' })
  expect(isDenied(await spawn(under('claude-sonnet-5-5')))).toBe(false)

  w.messages = () => {
    throw new Error('unreadable')
  }
  expect(isDenied(await spawn(under('claude-sonnet-5-5')))).toBe(false)

  w.messages = () => []
  expect(isDenied(await spawn(under('claude-haiku-5-5')))).toBe(false)

  // A full page of rows is the newest 4,096, so its first row is not the agent's first message.
  w.messages = () => Array.from({ length: 4096 }, () => ({ role: 'user' as const, text: 'find X\n\n' + note, toolUses: [] }))
  expect(isDenied(await spawn(under('claude-haiku-5-5')))).toBe(false)
})

// --- results and failures ---

test('three spawns resolving out of order are each recorded against their own spawn', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  const tasks = ['one', 'two', 'three'] as const
  const taskOf = (text: string) => tasks.find((t) => text.includes(`task ${t}`))
  const replies = new Map<string, () => void>()
  const starts = new Map<string, () => void>()
  w.reply = (e) => {
    const task = taskOf(typeof e.prompt === 'string' ? e.prompt : '')
    const reply: ModelCompleteResult = { isAnswered: true, text: task === 'two' ? 'locating' : 'other', usage: USAGE }
    if (task === undefined) return reply
    return new Promise((resolve) => replies.set(task, () => resolve(reply)))
  }
  w.answer = (e) => {
    const task = taskOf(e.prompt)
    if (task === undefined) return w.start(e)
    return new Promise((resolve) => starts.set(task, () => resolve({ model: e.model ?? 'claude-opus-5-5', agentId: `agent-${task}` })))
  }

  await spawn()
  const runs = tasks.map((t) => spawn({ description: t, prompt: `task ${t}` }))
  await until(() => replies.size === 3)
  // Released together, so the three hooks' writes before next interleave.
  for (const t of ['three', 'one', 'two']) replies.get(t)?.()
  await until(() => starts.size === 3)
  for (const t of ['two', 'three', 'one']) {
    starts.get(t)?.()
    await runs[tasks.indexOf(t as (typeof tasks)[number])]
  }

  const ids = recordIds(w)
  expect(ids.length).toBe(4)
  expect([...(index(w)?.ids ?? [])].sort()).toEqual([...ids].sort())

  const byTask = new Map(records(w).slice(1).map((r) => [r.description, r]))
  expect(byTask.get('one')).toEqual(expect.objectContaining({ kind: 'other', agentId: 'agent-one', outcome: 'unchanged' }))
  expect(byTask.get('two')).toEqual(expect.objectContaining({ kind: 'locating', agentId: 'agent-two', outcome: 'routed' }))
  expect(byTask.get('three')).toEqual(expect.objectContaining({ kind: 'other', agentId: 'agent-three', outcome: 'unchanged' }))
  // A row ends with its description, so "one" is not found inside some other word.
  const rows = (await report($)).split('\n')
  for (const t of tasks) expect(rows.some((row) => row.endsWith(`: ${t}`))).toBe(true)
  expect(await spawn({ parentAgentId: 'agent-two' })).toEqual({ deny: DENY_TEXT })
  expect(isDenied(await spawn({ parentAgentId: 'agent-one' }))).toBe(false)
  expect(isDenied(await spawn({ parentAgentId: 'agent-three' }))).toBe(false)
})

test('a refused or id-less start writes nothing but its record', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  const sideWrites = (from: number) => ['routed', 'routeOff', 'baseline', 'byAgent'].flatMap((key) => written(w, key, from))
  await spawn()

  let from = w.sets.length
  w.answer = () => ({ deny: 'limit' })
  expect(await spawn()).toEqual({ deny: 'limit' })
  expect(records(w)[1]?.outcome).toBe('not-started')
  expect(sideWrites(from)).toEqual([])
  w.answer = w.start
  expect(((await spawn()) as { model: string }).model).toBe('haiku')

  from = w.sets.length
  w.answer = () => ({ model: 'haiku' })
  expect(await spawn()).toEqual({ model: 'haiku' })
  expect(records(w)[3]?.outcome).toBe('not-started')
  expect(sideWrites(from)).toEqual([])
  w.answer = w.start
  expect(((await spawn()) as { model: string }).model).toBe('haiku')
})

test('a routed spawn that starts at or above its baseline is marked and turns that route off', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await spawn()

  w.answer = () => ({ model: 'claude-opus-5-5', agentId: `a${w.seen.length}` })
  await spawn()
  expect(w.seen[1]?.model).toBe('haiku')
  expect(records(w)[1]).toEqual(expect.objectContaining({ outcome: 'routed', overridden: true, started: 'claude-opus-5-5' }))
  expect(w.lines.length).toBe(1)
  expect(w.lines[0]?.includes('claude-opus-5-5')).toBe(true)
  expect(w.lines[0]?.includes('Routed to')).toBe(false)
  expect(w.lines[0]?.includes('the locating route is off for this session')).toBe(true)

  w.answer = w.start
  const picks = w.picks.length
  await spawn()
  expect(w.seen[2]?.model).toBe(undefined)
  expect(records(w)[2]?.reason).toBe('no-route-applies')
  expect(w.picks.length).toBe(picks)

  w.routes = { readingRoute: 'sonnet' }
  await spawn()
  expect(w.picks.length).toBe(picks + 1)
  expect(records(w)[3]?.reason).toBe('route-off')

  expect(written(w, 'routed')).toEqual([])
  expect(isDenied(await spawn({ parentAgentId: 'a2', parentModel: 'claude-opus-5-5' }))).toBe(false)
})

test('a failure after the spawn started does not lose the spawn', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await spawn()

  w.failSet = 'routed'
  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a2' })
  expect(w.seen.length).toBe(2)

  w.failSet = null
  const atLog: (DecisionRecord | undefined)[] = []
  w.onLog = () => {
    atLog.push(records(w).at(-1))
    throw new Error('x')
  }
  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a3' })
  expect(w.seen.length).toBe(3)
  expect(atLog).toEqual([expect.objectContaining({ outcome: 'routed', agentId: 'a3', started: 'haiku' })])
})

test('a failed record save after a routed start still marks the agent routed and still logs', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await spawn()

  // The record's first write, before next, must land; only the save after the start fails.
  w.answer = (e) => {
    w.failSet = 'decision'
    return w.start(e)
  }
  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a2' })
  expect(written(w, 'routed').map((s) => s.id)).toEqual(['a2'])
  expect(written(w, 'byAgent').some((s) => s.id === 'a2')).toBe(false)
  expect(w.lines.filter((line) => line.startsWith('Routed to haiku')).length).toBe(1)

  w.answer = w.start
  expect(await spawn({ parentAgentId: 'a2', subagentType: 'general-purpose' })).toEqual({ deny: DENY_TEXT })
})

test('a failed routed write after a routed start leaves the record and byAgent written', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await spawn()

  w.failSet = 'routed'
  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a2' })
  expect(records(w)[1]).toEqual(expect.objectContaining({ outcome: 'routed', started: 'haiku', agentId: 'a2' }))
  expect(written(w, 'byAgent').some((s) => s.id === 'a2')).toBe(true)
  expect(w.lines.filter((line) => line.startsWith('Routed to haiku')).length).toBe(1)
})

test('a failed baseline write after an unchanged start keeps the record and teaches nothing', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)

  w.failSet = 'baseline'
  expect(await spawn()).toEqual({ model: 'claude-opus-5-5', agentId: 'a1' })
  expect(records(w)[0]).toEqual(expect.objectContaining({ outcome: 'unchanged', started: 'claude-opus-5-5', agentId: 'a1' }))
  await spawn()
  expect(records(w)[1]?.reason).toBe('baseline-unknown')
  expect(w.seen[1]?.model).toBe(undefined)
})

test('a refusal is shown in observe mode too, as exactly one line', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await routeA2(spawn)
  w.mode = 'observe'

  const before = w.lines.length
  expect(await spawn({ parentAgentId: 'a2', subagentType: 'general-purpose' })).toEqual({ deny: DENY_TEXT })
  expect(w.lines.slice(before)).toEqual([expect.stringContaining('Refused')])
})

// A failing index read is the state.get stand-in answering { deny }, as for the routed and observed reads.
function indexReads(on: On) {
  const read: { stored: unknown; fails: boolean } = { stored: undefined, fails: false }
  on('state.get', { plugin: 'subagent-router', key: 'index' }, () =>
    read.fails ? ({ deny: 'unreadable' } as never) : { value: { value: read.stored as never, version: 1 } },
  )
  return read
}

test('a failed index read is retried, and what was gathered meanwhile is merged into the stored index', async ($, on) => {
  const w = world(on)
  const read = indexReads(on)
  const spawn = spawner($)

  read.fails = true
  await spawn()
  await spawn({ subagentType: 'Plan' })
  await spawn()
  expect(written(w, 'index')).toEqual([])

  read.fails = false
  read.stored = { v: 1, ids: ['old1'], outOfScope: 3, wouldRefuse: 0 }
  await spawn({ subagentType: 'Plan' })
  // The stored 3, the one counted while the read failed and the one counted after the load.
  expect(index(w)).toEqual({ v: 1, ids: ['old1', ...recordIds(w)], outOfScope: 5, wouldRefuse: 0 })
})

test('an index that cannot be read at all is never written, and spawns still go on', async ($, on) => {
  const w = world(on)
  const read = indexReads(on)
  const spawn = spawner($)
  read.fails = true

  await spawn()
  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a2' })
  await spawn({ subagentType: 'Plan' })
  expect(records(w).length).toBe(2)
  expect(written(w, 'index')).toEqual([])
})

test('a stored index of another version counts as empty and is replaced', async ($, on) => {
  const w = world(on)
  const read = indexReads(on)
  read.stored = { v: 2, ids: ['old1'], outOfScope: 3, wouldRefuse: 0 }

  await spawner($)()
  expect(index(w)).toEqual({ v: 1, ids: recordIds(w), outOfScope: 0, wouldRefuse: 0 })
})

test('hostile text in the description reaches the transcript line and the record cleaned', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await spawn()

  await spawn({ description: 'a\u001b[31m\u202Eb\nc' + 'x'.repeat(500) })
  expect(w.lines.length).toBe(1)
  const line = w.lines[0] ?? ''
  expect(line.includes('a[31mb c')).toBe(true)
  expect(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/u.test(line)).toBe(false)
  expect(line.includes('\n')).toBe(false)
  expect(Array.from(records(w)[1]?.description ?? 'x'.repeat(121)).length <= 120).toBe(true)
})

test('a malformed spawn or result is passed on or recorded cleaned, and nothing throws', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)

  // The kit refuses an engine answer whose model is missing or not text, so an empty id stands for "no model".
  w.answer = () => ({ model: '', agentId: `a${w.seen.length}` })
  expect(await spawn({ description: undefined as never })).toEqual({ model: '', agentId: 'a1' })
  expect(records(w)[0]).toEqual(expect.objectContaining({ description: '', started: null, agentId: 'a1' }))
  expect(written(w, 'baseline')).toEqual([])

  w.answer = () => ({ model: 'claude-opus-5-5\u001b]0;x\u0007\n\u202E', agentId: `a${w.seen.length}` })
  await spawn({ subagentType: 'general-purpose\u001b[2J' })
  expect(w.seen[1]?.subagentType).toBe('general-purpose\u001b[2J')
  await spawn()
  expect(records(w)[1]?.reason).toBe('baseline-unknown')
  expect(records(w)[1]?.started).toBe('claude-opus-5-5]0;x')

  const sent = input({ tool_use_id: 'toolu_x', subagentType: 7 as never })
  await $.agent.spawn(sent)
  expect(w.seen[3]).toEqual(sent)
  expect(records(w).length).toBe(2)
})

// --- cost ---

test('usage reported for a recorded agent is added to its record', async ($, on) => {
  const w = world(on)
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  const spawn = spawner($)
  await spawn()
  const usage = { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' }
  const price = priceOf('claude-opus-5-5')
  const usd = price === undefined ? Number.NaN : estimateUsd(usage, price)

  const end = (agentId: string, turnUsage: typeof usage | undefined) =>
    $.turn.complete({ agentId, turnId: 't1', reason: 'answer', isAborted: false, answer: `done ${agentId}`, durationMs: 1, usage: turnUsage })

  expect((await end('a1', usage)).text).toBe('done a1')
  expect(records(w)[0]).toEqual(expect.objectContaining({
    tokens: { input: 100, output: 10, cacheRead: 1000, cacheWrite: 0 }, ran: 'claude-opus-5-5', usd,
  }))

  await end('a1', usage)
  expect(records(w)[0]).toEqual(expect.objectContaining({ tokens: { input: 200, output: 20, cacheRead: 2000, cacheWrite: 0 }, usd: usd * 2 }))

  await end('a1', { ...usage, model: 'made-up-model' })
  expect(records(w)[0]).toEqual(expect.objectContaining({
    tokens: { input: 300, output: 30, cacheRead: 3000, cacheWrite: 0 }, ran: 'made-up-model', usd: usd * 2,
  }))

  const writes = w.sets.length
  expect((await end('nobody', usage)).text).toBe('done nobody')
  expect((await end('a1', undefined)).text).toBe('done a1')
  expect(w.sets.length).toBe(writes)
})

// --- the report command ---

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const turnEnd = ($: Engine) =>
  $.turn.complete({ agentId: 'nobody', turnId: 't1', reason: 'answer', isAborted: false, answer: 'done', durationMs: 1, usage: undefined })

test('the command answers display-only text and nothing for the model', async ($, on) => {
  const w = world(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.run', (_$, e) => ({ text: `the engine ran ${e.command}` }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(w.registered.length).toBe(1)
  expect(w.registered[0]?.name).toBe('subagent-router')
  expect(w.registered[0]?.immediate).toBe(undefined)

  const r = await $.command.run(RUN)
  expect(r.isTextDisplayOnly).toBe(true)
  expect(r.text?.includes('mode:')).toBe(true)
  expect(r.context).toBe(undefined)
  expect(await $.command.run({ ...RUN, command: 'other' })).toEqual({ text: 'the engine ran other' })
})

test('with no session start, the first hook after a load registers the command, and only once', async ($, on) => {
  const w = world(on)
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  const spawn = spawner($)

  await spawn()
  await until(() => w.registered.length === 1)
  await spawn()
  await turnEnd($)
  await pause(20)
  expect(w.registered.length).toBe(1)
  expect((await $.command.run(RUN)).isTextDisplayOnly).toBe(true)
})

test('the turn hook registers the command too', async ($, on) => {
  const w = world(on)
  on('turn.complete', (_$, e) => ({ text: e.answer }))

  expect((await turnEnd($)).text).toBe('done')
  await until(() => w.registered.length === 1)
})

test('a refused registration changes nothing about the spawn and is tried again on the next hook', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.registration = 'refuses'

  expect(await spawn()).toEqual({ model: 'claude-opus-5-5', agentId: 'a1' })
  await until(() => w.registered.length === 1)
  await pause(20)
  w.registration = 'answers'
  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a2' })
  await until(() => w.registered.length === 2)
  await pause(20)
  await spawn()
  await pause(20)
  expect(w.registered.length).toBe(2)
})

test('a registration that never answers does not hold up the spawn', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.registration = 'hangs'

  expect(await spawn()).toEqual({ model: 'claude-opus-5-5', agentId: 'a1' })
  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a2' })
  expect(w.registered.length).toBe(1)
})

test('a report that cannot be built answers one display-only line saying so', async ($, on) => {
  world(on)
  on('state.get', { plugin: 'subagent-router', key: 'decision' }, () => ({ deny: 'unreadable' }) as never)
  await spawner($)()

  const r = await $.command.run(RUN)
  expect(r.isTextDisplayOnly).toBe(true)
  expect(r.context).toBe(undefined)
  expect(r.text?.startsWith('subagent-router: the report could not be built')).toBe(true)
  expect(r.text?.includes('\n')).toBe(false)
})
