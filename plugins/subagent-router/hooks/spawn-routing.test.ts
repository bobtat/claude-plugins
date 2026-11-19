import { expect, test } from 'claude-code/testing'
import type { AgentSpawnInput } from 'claude-code'
import { MARKER } from './note'
import { FAILED, PROMPT, USAGE, index, input, isDenied, records, spawner, world, written } from './test-support'

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

test('observe mode: a fork of an agent that would have been routed is counted the same way', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.mode = 'observe'

  await spawn()
  await spawn()
  expect(records(w)[1]?.outcome).toBe('would-route')
  expect(isDenied(await spawn({ parentAgentId: 'a2', fork: true }))).toBe(false)
  expect(index(w)?.wouldRefuse ?? 0).toBe(0)
  expect(written(w, 'observed').map((s) => s.id)).toEqual(['a2', 'a3'])

  expect(isDenied(await spawn({ parentAgentId: 'a3', subagentType: 'feature-dev:code-explorer' }))).toBe(false)
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

test('a prompt the picker is never asked about does not reset the count of failures', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.mode = 'observe'
  w.reply = () => FAILED

  await spawn()
  await spawn()
  await spawn({ prompt: 'find ' + 'x'.repeat(16001) })
  await spawn({ prompt: '\u200B' })
  await spawn()
  expect(records(w).map((r) => r.reason)).toEqual(['error', 'error', 'too-long', 'empty-prompt', 'error'])
  await spawn()
  expect(records(w)[5]?.reason).toBe('picker-off')
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
