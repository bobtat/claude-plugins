import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Index } from '../types'

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

function spawnsAt(on: On, answer: { model: string; agentId: string } | { deny: string } = { model: 'claude-haiku-4-5', agentId: 'agent-1' }) {
  const spawns: { e: unknown; origin: unknown }[] = []
  on('agent.spawn', (_$, e, next) => {
    spawns.push({ e, origin: next.origin })
    return answer
  })
  return spawns
}

function logsAt(on: On) {
  const logs: string[] = []
  on('ui.log', (_$, e) => {
    logs.push(e.text)
    return { value: undefined }
  })
  return logs
}

const settingsWith = (options: object) => ({ pluginConfigs: { 'subagent-router': { options } } })

// The router's spawn hook runs in every test that raises agent.spawn. With mode off it
// reads its settings and passes the spawn on, so what the test pins is the kit's alone.
function routerOff(on: On) {
  on('settings.read', (_$, e) => ({ value: (e.source === 'user' ? settingsWith({ mode: 'off' }) : {}) as never }))
  mock.env(on, {})
}

// What the router calls on $ for one spawn it records; the index writes it makes, in order.
function routerRecording(on: On) {
  const indexes: Index[] = []
  on('settings.read', (_$, e) => ({ value: (e.source === 'user' ? settingsWith({ mode: 'route' }) : {}) as never }))
  mock.env(on, {})
  mock.clock(on)
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('agent.spawn', (_$, e) => ({ model: e.model ?? 'claude-opus-5-5', agentId: 'agent-1' }))
  on('state.set', (_$, e, next) => {
    if (e.key === 'index') indexes.push(e.value as Index)
    return next(e)
  })
  return indexes
}

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
    routerOff(on)
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

// The router keeps its index in module memory and reads state for it only on the first
// call after a load. The kit's state starts empty in every test (K2), so an index that
// holds more than this test's one id would have come from the previous test's module.
test('K8 (1 of 2): module memory is filled in one test', async ($, on) => {
  const indexes = routerRecording(on)

  await $.agent.spawn(SPAWN)

  expect(indexes.at(-1)?.ids.length).toBe(1)
})

test('K8 (2 of 2): module memory starts fresh in the next test of the file', async ($, on) => {
  const indexes = routerRecording(on)

  await $.agent.spawn({ ...SPAWN, tool_use_id: 'toolu_2' })

  expect(indexes.at(-1)?.ids.length).toBe(1)
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
    routerOff(on)
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
    routerOff(on)
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
    routerOff(on)
    const logs = logsAt(on)
    spawnsAt(on)

    expect(await $.agent.spawn(SPAWN)).toEqual({ model: 'claude-haiku-4-5', agentId: 'agent-1' })
    expect(logs).toEqual(['denier failed'])
  },
)
