import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { register } from './register'

// The inline plugins below own state of their own; this types it for them.
declare module 'claude-code' {
  interface PluginState {
    kit: { value: number; answered: number; passed: number }
  }
}

// A spawn as the engine raises it for the Agent tool.
const SPAWN = {
  tool_use_id: 'toolu_1',
  prompt: 'Find where the README mentions hooks.',
  description: 'Find hooks',
  subagentType: 'Explore',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'claude-opus-5-5',
  background: false,
  fork: false,
} as const

const NOTE = '\n\nEnd your reply with the word PROBE-OK.\n[subagent-router:routed v1]'

// Inline plugins report back by rewriting turn.start's text, since their
// register closes over nothing of this file.
function reports(on: On) {
  const texts: string[] = []
  on('turn.start', (_$, e) => {
    texts.push(e.text)
    return { turnId: e.turnId }
  })
  return texts
}

const reported = (texts: string[]) => texts.map((text) => JSON.parse(text) as unknown)

// What the probe build calls on $ for a spawn, answered; its records parsed.
function probeStandIns(on: On, data: string, env: Record<string, string> = {}) {
  const paths: string[] = []
  const records: Record<string, unknown>[] = []
  on('fs.write', (_$, e) => {
    paths.push(e.path)
    records.push(JSON.parse(e.text) as Record<string, unknown>)
    return { value: undefined }
  })
  on('process.hookEnv', () => ({ value: { CLAUDE_PLUGIN_DATA: data } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  mock.env(on, env)
  return { paths, records }
}

function spawnsAt(on: On, answer: { model: string; agentId: string } | { deny: string } = { model: 'claude-haiku-4-5', agentId: 'agent-1' }) {
  const spawns: { e: unknown; origin: unknown }[] = []
  on('agent.spawn', (_$, e, next) => {
    spawns.push({ e, origin: next.origin })
    return answer
  })
  return spawns
}

// The self-spawn runs after session.start has answered, so the awaited
// $.session.start resolves before it; nothing else signals its end. It lands
// within a few milliseconds, so this real-time wait has a wide margin. The
// kit's environment has setTimeout, though the engine's typings omit it.
declare const setTimeout: (run: () => void, ms: number) => unknown
const selfSpawnSettled = () => new Promise<void>((resolve) => setTimeout(resolve, 100))

function logsAt(on: On) {
  const logs: string[] = []
  on('ui.log', (_$, e) => {
    logs.push(e.text)
    return { value: undefined }
  })
  return logs
}

describe('K1: the probe build', () => {
  test('its agent.spawn hook passes the spawn on unchanged and records it before and after', async ($, on) => {
    const { paths, records } = probeStandIns(on, 'data')
    const spawns = spawnsAt(on)

    const result = await $.agent.spawn(SPAWN)

    expect(spawns.map((s) => s.e)).toEqual([SPAWN])
    expect(result).toEqual({ model: 'claude-haiku-4-5', agentId: 'agent-1' })
    expect(records).toEqual([
      {
        ev: 'spawn',
        keys: ['background', 'description', 'fork', 'parentModel', 'prompt', 'provider', 'subagentType', 'tool_use_id'],
        subagentType: 'Explore',
        provider: { plugin: 'engine', tier: 'core' },
        model: null,
        parentModel: 'claude-opus-5-5',
        parentAgentId: null,
        fork: false,
        resume: null,
        workflow: null,
        isTeammate: null,
        origin: { plugin: 'engine', tier: 'core' },
        promptChars: SPAWN.prompt.length,
        toolUseId: 'toolu_1',
        sessionModel: 'claude-opus-5-5',
      },
      { ev: 'started', toolUseId: 'toolu_1', result: { model: 'claude-haiku-4-5', agentId: 'agent-1' } },
      { ev: 'q6', mine: 'toolu_1', seen: 'toolu_1', seenBefore: null },
    ])
    for (const path of paths) expect(path).toMatch(/[\\/]data[\\/]probe[\\/]\d+-[0-9a-f-]{36}\.json$/)
  })

  test('with the probe variables set, an Explore spawn gets the model and every spawn the note', async ($, on) => {
    probeStandIns(on, 'data', { SUBAGENT_ROUTER_PROBE_MODEL: 'haiku', SUBAGENT_ROUTER_PROBE_NOTE: '1' })
    const spawns = spawnsAt(on)

    await $.agent.spawn(SPAWN)
    await $.agent.spawn({ ...SPAWN, subagentType: 'general-purpose' })

    expect(spawns.map((s) => s.e)).toEqual([
      { ...SPAWN, model: 'haiku', prompt: SPAWN.prompt + NOTE },
      { ...SPAWN, subagentType: 'general-purpose', prompt: SPAWN.prompt + NOTE },
    ])
  })

  test("Q6: two overlapping spawns each record lastSpawn as read before their write and after their next", async ($, on) => {
    const { records } = probeStandIns(on, 'data')
    // Holds each spawn until both hooks have written lastSpawn, as two spawns
    // of one turn overlap in a session.
    let release = () => {}
    const bothArrived = new Promise<void>((resolve) => {
      release = resolve
    })
    let firstArrived = () => {}
    const firstIsWaiting = new Promise<void>((resolve) => {
      firstArrived = resolve
    })
    let arrived = 0
    on('agent.spawn', async (_$, e) => {
      arrived += 1
      if (arrived === 1) firstArrived()
      if (arrived === 2) release()
      await bothArrived
      return { model: 'claude-haiku-4-5', agentId: `agent-${e.tool_use_id}` }
    })

    const first = $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_a' })
    await firstIsWaiting
    await Promise.all([first, $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_b' })])

    // Under the kit the second spawn's hook reads the first's write, but the
    // first, reading again after its next, still reads its own: the write the
    // second made meanwhile does not reach it. Run A says what a session does.
    expect(records.filter((r) => r.ev === 'q6')).toEqual([
      { ev: 'q6', mine: 'toolu_a', seen: 'toolu_a', seenBefore: null },
      { ev: 'q6', mine: 'toolu_b', seen: 'toolu_b', seenBefore: 'toolu_a' },
    ])
  })

  test("a nested spawn also records the parent's first message", async ($, on) => {
    const { records } = probeStandIns(on, 'data')
    on('session.messages', (_$, e) => ({
      value: e.agentId === 'parent-1' ? [{ role: 'user', text: `${'x'.repeat(400)}tail`, toolUses: [] }] : { deny: 'no such agent' },
    }))
    spawnsAt(on)

    await $.agent.spawn({ ...SPAWN, parentAgentId: 'parent-1' })

    expect(records.at(-1)).toEqual({ ev: 'parent-messages', result: { rows: 1, firstTail: `${'x'.repeat(296)}tail` } })
  })

  test("a failed write leaves the spawn and its answer as they were", async ($, on) => {
    on('fs.write', () => {
      throw new Error('disk full')
    })
    on('process.hookEnv', () => ({ value: { CLAUDE_PLUGIN_DATA: 'data' } }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    mock.env(on, {})
    const spawns = spawnsAt(on)

    expect(await $.agent.spawn(SPAWN)).toEqual({ model: 'claude-haiku-4-5', agentId: 'agent-1' })
    expect(spawns.map((s) => s.e)).toEqual([SPAWN])
  })

  test("an agent's turn.complete records its end", async ($, on) => {
    const { records } = probeStandIns(on, 'data')
    on('session.messages', () => ({ value: [{ role: 'user', text: 'Find hooks.', toolUses: [] }] }))
    on('turn.complete', () => ({ text: '' }))
    const usage = { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4, model: 'claude-haiku-4-5' }

    await $.turn.complete({ answer: `${'a'.repeat(100)}PROBE-OK`, durationMs: 1, isAborted: false, turnId: 't1', agentId: 'agent-1', reason: 'answer', usage })
    await $.turn.complete({ answer: 'main', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer' })

    expect(records).toEqual([
      { ev: 'end', agentId: 'agent-1', reason: 'answer', usage, answerTail: `${'a'.repeat(72)}PROBE-OK`, firstTail: { rows: 1, firstTail: 'Find hooks.' } },
    ])
  })

  test('session.start records the settings and the canary, sets the canary and registers the command', async ($, on) => {
    const { records } = probeStandIns(on, 'data', { CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet' })
    on('settings.read', (_$, e) => ({
      value: e.source === 'user' ? { pluginConfigs: { 'subagent-router@inline': { options: { mode: 'route' } }, other: {} } } : {},
    }))
    const commands: unknown[] = []
    on('command.register', (_$, e) => {
      commands.push(e)
      return { value: { command: e.name } }
    })
    const logs = logsAt(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    on('command.run', () => ({ text: 'engine' }))

    await $.session.start({ cwd: '/', surface: null, isInteractive: false })
    await $.session.start({ cwd: '/', surface: null, isInteractive: false })
    const run = await $.command.run({ command: 'subagent-router-probe', args: '' } as never)

    const session = {
      ev: 'session',
      options: { mode: 'observe', locatingRoute: 'haiku', readingRoute: 'parent' },
      sub: 'sonnet',
      force: null,
      user: { keys: ['subagent-router@inline', 'other'], entries: { 'subagent-router@inline': { options: { mode: 'route' } } } },
      policy: { keys: [], entries: {} },
    }
    expect(records).toEqual([
      { ...session, stateCanary: null },
      { ...session, stateCanary: expect.any(Number) },
    ])
    expect(commands).toEqual([
      { name: 'subagent-router-probe', description: 'Shows that the subagent-router probe build is loaded' },
      { name: 'subagent-router-probe', description: 'Shows that the subagent-router probe build is loaded' },
    ])
    expect(logs).toEqual(['subagent-router probe files: data/probe', 'subagent-router probe files: data/probe'])
    expect(run).toEqual({ text: 'probe command alive', ref: undefined, isTextDisplayOnly: true })
  })

  test('with SUBAGENT_ROUTER_PROBE_SELFSPAWN=1 the probe raises one spawn of its own per load and records it', async ($, on) => {
    const { records } = probeStandIns(on, 'data', { SUBAGENT_ROUTER_PROBE_SELFSPAWN: '1' })
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    const spawns = spawnsAt(on)

    await $.session.start({ cwd: '/', surface: null, isInteractive: false })
    await $.session.start({ cwd: '/', surface: null, isInteractive: false })
    await selfSpawnSettled()

    expect(spawns).toEqual([
      {
        e: { tool: 'Agent', prompt: 'Reply with the single word OK.', description: 'probe self-spawn', run_in_background: true, subagent_type: 'Explore' },
        origin: { plugin: 'subagent-router', tier: 'user' },
      },
    ])
    // A plugin's own agent.spawn hook does not hear its own $.agent.spawn, so
    // the probe writes no spawn or started record for it.
    expect(records.filter((r) => r.ev !== 'session')).toEqual([{ ev: 'self-spawn', result: { model: 'inherit' } }])
  })

  test('with SUBAGENT_ROUTER_PROBE_SELFSPAWN unset the probe raises no spawn', async ($, on) => {
    const { records } = probeStandIns(on, 'data')
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    const spawns = spawnsAt(on)

    await $.session.start({ cwd: '/', surface: null, isInteractive: false })
    await selfSpawnSettled()

    expect(spawns).toEqual([])
    expect(records.map((r) => r.ev)).toEqual(['session'])
  })
})

test(
  "K2: a state.set hook sees a plugin's writes, and the plugin reads them back in the same hook and in a later event",
  {
    plugins: [
      {
        name: 'kit',
        register(on) {
          on('turn.start', async ($, e, next) => {
            const value = { plugin: 'kit', key: 'value' } as const
            const before = await $.state.get(value)
            await $.state.set(value, (before.value ?? 0) + 7)
            const after = await $.state.get(value)
            return next({ ...e, text: JSON.stringify({ before, after }) })
          })
        },
      },
    ],
  },
  async ($, on) => {
    const sets: unknown[] = []
    on('state.set', (_$, e, next) => {
      sets.push(e)
      return next(e)
    })
    const texts = reports(on)

    await $.turn.start({ text: '', turnId: 't1' })
    await $.turn.start({ text: '', turnId: 't2' })

    expect(sets).toEqual([
      { plugin: 'kit', key: 'value', value: 7, previous: undefined },
      { plugin: 'kit', key: 'value', value: 14, previous: 7 },
    ])
    // A value's first write in a test lands one past the highest version any
    // earlier test in the file reached, so only versions within a test compare.
    const rounds = reported(texts) as { after: { version: number } }[]
    const firstVersion = rounds[0]?.after.version ?? Number.NaN
    expect(rounds).toEqual([
      { before: { version: 0 }, after: { value: 7, version: firstVersion } },
      { before: { value: 7, version: firstVersion }, after: { value: 14, version: firstVersion + 1 } },
    ])
  },
)

test(
  'K3: a state.get hook under a plugin-and-key matcher answers that key, and every other key goes on to the kit',
  {
    plugins: [
      {
        name: 'kit',
        register(on) {
          on('turn.start', async ($, e, next) => {
            await $.state.set({ plugin: 'kit', key: 'passed' }, 2)
            const answered = await $.state.get({ plugin: 'kit', key: 'answered' })
            const passed = await $.state.get({ plugin: 'kit', key: 'passed' })
            return next({ ...e, text: JSON.stringify({ answered, passed }) })
          })
        },
      },
    ],
  },
  async ($, on) => {
    on('state.get', { plugin: 'kit', key: 'answered' }, () => ({ value: { value: 41, version: 1 } }))
    const texts = reports(on)

    await $.turn.start({ text: '', turnId: 't1' })

    expect(reported(texts)).toEqual([{ answered: { value: 41, version: 1 }, passed: { value: 2, version: expect.any(Number) } }])
  },
)

test(
  "K4: stand-ins answer model.complete, settings.read, session.model, session.messages, env.get and clock.now",
  {
    plugins: [
      {
        name: 'kit',
        register(on) {
          on('turn.start', async ($, e, next) => {
            const answers = {
              complete: await $.model.complete({ model: 'haiku', prompt: 'hi' }),
              settings: await $.settings.read({ source: 'user' }),
              model: await $.session.model(),
              messages: await $.session.messages({ agentId: 'agent-1' }),
              set: await $.env.get('SET'),
              unset: (await $.env.get('UNSET')) ?? 'unset',
              now: await $.clock.now(),
            }
            return next({ ...e, text: JSON.stringify(answers) })
          })
        },
      },
    ],
  },
  async ($, on) => {
    const usage = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    on('model.complete', () => ({ value: { isAnswered: true, text: 'hello', usage } }))
    on('settings.read', (_$, e) => ({ value: { pluginConfigs: { source: e.source } } }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.messages', (_$, e) => ({ value: [{ role: 'user', text: `first of ${e.agentId}`, toolUses: [] }] }))
    mock.env(on, { SET: 'yes' })
    mock.clock(on, { now: 1234 })
    const texts = reports(on)

    await $.turn.start({ text: '', turnId: 't1' })

    expect(reported(texts)).toEqual([
      {
        complete: { isAnswered: true, text: 'hello', usage },
        settings: { pluginConfigs: { source: 'user' } },
        model: 'claude-opus-5-5',
        messages: [{ role: 'user', text: 'first of agent-1', toolUses: [] }],
        set: 'yes',
        unset: 'unset',
        now: 1234,
      },
    ])
  },
)

test(
  'K5: a $ call nothing answers rejects, naming the event',
  {
    plugins: [
      {
        name: 'kit',
        register(on) {
          on('turn.start', async ($, e, next) => {
            const error = await $.session.id().then(
              () => 'resolved',
              (thrown: unknown) => String(thrown),
            )
            return next({ ...e, text: JSON.stringify(error) })
          })
        },
      },
    ],
  },
  async ($, on) => {
    const texts = reports(on)

    await $.turn.start({ text: '', turnId: 't1' })

    expect(reported(texts)).toEqual(['HooksError: no implementation for session.id'])
  },
)

test(
  'K5: a hook whose unanswered $ call throws out of it is skipped, and the test goes on',
  {
    plugins: [
      {
        name: 'kit',
        register(on) {
          on('turn.start', async ($, e, next) => {
            await $.session.id()
            return next({ ...e, text: 'rewritten' })
          })
        },
      },
    ],
  },
  async ($, on) => {
    const texts = reports(on)

    expect(await $.turn.start({ text: 'as sent', turnId: 't1' })).toEqual({ turnId: 't1' })
    expect(texts).toEqual(['as sent'])
  },
)

test('K6: a hooks file imports its sibling with no extension', () => {
  expect(typeof register).toBe('function')
})

test(
  "K7: an inline plugin's $.agent.spawn reaches the hooks in the Agent tool's shape, with origin naming the plugin",
  {
    plugins: [
      {
        name: 'other',
        register(on) {
          on('turn.start', async ($, e, next) => {
            const result = await $.agent.spawn({ prompt: 'Find the LICENSE file.', subagentType: 'Explore', description: 'Find licence' })
            return next({ ...e, text: JSON.stringify(result) })
          })
        },
      },
    ],
  },
  async ($, on) => {
    const spawns = spawnsAt(on)
    const texts = reports(on)

    await $.turn.start({ text: '', turnId: 't1' })

    expect(spawns).toEqual([
      {
        e: { tool: 'Agent', prompt: 'Find the LICENSE file.', description: 'Find licence', run_in_background: true, subagent_type: 'Explore' },
        origin: { plugin: 'other', tier: 'user' },
      },
    ])
    expect(reported(texts)).toEqual([{ model: 'inherit' }])
  },
)

test(
  "K7: the plugin under test sees the inline plugin's spawn with the same origin",
  {
    plugins: [
      {
        name: 'other',
        register(on) {
          on('turn.start', async ($, e, next) => {
            await $.agent.spawn({ prompt: 'Find the LICENSE file.', subagentType: 'Explore', description: 'Find licence' })
            return next(e)
          })
        },
      },
    ],
  },
  async ($, on) => {
    const { records } = probeStandIns(on, 'data')
    spawnsAt(on)
    reports(on)

    await $.turn.start({ text: '', turnId: 't1' })

    expect(records[0]).toEqual({
      ev: 'spawn',
      keys: ['description', 'prompt', 'run_in_background', 'subagent_type', 'tool'],
      model: null,
      parentAgentId: null,
      resume: null,
      workflow: null,
      isTeammate: null,
      origin: { plugin: 'other', tier: 'user' },
      promptChars: 'Find the LICENSE file.'.length,
      sessionModel: 'claude-opus-5-5',
    })
  },
)

// The probe keeps its data folder in module memory; these two tests answer
// hookEnv differently, so the second sees which folder its module holds.
test('K8 (1 of 2): module memory is filled in one test', async ($, on) => {
  const { paths } = probeStandIns(on, 'data-first')
  spawnsAt(on)

  await $.agent.spawn(SPAWN)

  expect(paths[0]).toMatch(/[\\/]data-first[\\/]probe[\\/]/)
})

test('K8 (2 of 2): module memory starts fresh in the next test of the file', async ($, on) => {
  const { paths } = probeStandIns(on, 'data-second')
  spawnsAt(on)

  await $.agent.spawn(SPAWN)

  expect(paths[0]).toMatch(/[\\/]data-second[\\/]probe[\\/]/)
})

test(
  "K9: a stand-in that throws is skipped, so the plugin's call rejects as unanswered, and the test goes on",
  {
    plugins: [
      {
        name: 'kit',
        register(on) {
          on('turn.start', async ($, e, next) => {
            const error = await $.session.id().then(
              () => 'resolved',
              (thrown: unknown) => String(thrown),
            )
            return next({ ...e, text: JSON.stringify(error) })
          })
        },
      },
    ],
  },
  async ($, on) => {
    on('session.id', () => {
      throw new Error('stand-in broke')
    })
    const texts = reports(on)

    await $.turn.start({ text: '', turnId: 't1' })

    expect(reported(texts)).toEqual(['HooksError: no implementation for session.id'])
  },
)

test(
  'K10: ui.log lines a spawn hook makes before and after next have reached the stand-in when the spawn resolves',
  {
    plugins: [
      {
        name: 'logger',
        register(on) {
          on('agent.spawn', async ($, e, next) => {
            $.ui.log('before next')
            const result = await next(e)
            $.ui.log('after next')
            return result
          })
        },
      },
    ],
  },
  async ($, on) => {
    const logs = logsAt(on)
    spawnsAt(on)

    await $.agent.spawn(SPAWN)

    expect(logs).toEqual(['before next', 'after next'])
  },
)

test(
  "K11: an inline plugin's $.config.set reaches config.set as key and value only, its caller in next.origin",
  {
    plugins: [
      {
        name: 'other',
        register(on) {
          on('turn.start', async ($, e, next) => {
            const result = await $.config.set({ key: 'subagent-router.mode', value: 'route' })
            return next({ ...e, text: JSON.stringify(result) })
          })
        },
      },
    ],
  },
  async ($, on) => {
    const sets: { e: unknown; origin: unknown }[] = []
    on('config.set', (_$, e, next) => {
      sets.push({ e, origin: next.origin })
      return { value: e.value }
    })
    const texts = reports(on)

    await $.turn.start({ text: '', turnId: 't1' })

    expect(sets).toEqual([{ e: { key: 'subagent-router.mode', value: 'route' }, origin: { plugin: 'other', tier: 'user' } }])
    expect(reported(texts)).toEqual([{ value: 'route' }])
  },
)

test(
  "K11: the plugin under test's config.set hook hears it, with no origin on the event",
  {
    plugins: [
      {
        name: 'other',
        register(on) {
          on('turn.start', async ($, e, next) => {
            await $.config.set({ key: 'subagent-router.mode', value: 'route' })
            return next(e)
          })
        },
      },
    ],
  },
  async ($, on) => {
    const { records } = probeStandIns(on, 'data')
    on('config.set', (_$, e) => ({ value: e.value }))
    reports(on)

    await $.turn.start({ text: '', turnId: 't1' })

    expect(records).toEqual([{ ev: 'config', key: 'subagent-router.mode', caller: { plugin: 'other', tier: 'user' } }])
  },
)

test(
  'K12: a hook that returns the deny its own next answered is accepted, and the spawn resolves to it',
  {
    plugins: [
      {
        name: 'passer',
        register(on) {
          on('agent.spawn', async ($, e, next) => {
            const result = await next(e)
            return result
          }).catch(($, e, next) => {
            $.ui.log('passer failed')
            return next(e)
          })
        },
      },
    ],
  },
  async ($, on) => {
    const logs = logsAt(on)
    spawnsAt(on, { deny: 'refused beneath' })

    expect(await $.agent.spawn(SPAWN)).toEqual({ deny: 'refused beneath' })
    expect(logs).toEqual([])
  },
)

test(
  'K12: a hook that returns a deny of its own after next answered fails, and its .catch is asked',
  {
    plugins: [
      {
        name: 'denier',
        register(on) {
          on('agent.spawn', async ($, e, next) => {
            await next(e)
            return { deny: 'too late' }
          }).catch(($, e, next) => {
            $.ui.log('denier failed')
            return next(e)
          })
        },
      },
    ],
  },
  async ($, on) => {
    const logs = logsAt(on)
    spawnsAt(on)

    expect(await $.agent.spawn(SPAWN)).toEqual({ model: 'claude-haiku-4-5', agentId: 'agent-1' })
    expect(logs).toEqual(['denier failed'])
  },
)
