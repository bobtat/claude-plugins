import { expect, test } from 'claude-code/testing'
import { parseSettings, pickOptions, readSettings } from './settings'
import type { SettingsHost } from './settings'

test('defaults: observe, locating to haiku, reading off', async () => {
  expect(parseSettings({}, undefined)).toEqual(
    { mode: 'observe', routes: { locating: 'haiku', reading: 'parent' }, standingDown: null, notes: [] })
})

test('names are read without regard to case, and a route accepts a full model id', async () => {
  const s = parseSettings({ mode: ' Route ', locatingRoute: 'Sonnet', readingRoute: 'claude-sonnet-5-5' }, undefined)
  expect(s.mode).toBe('route')
  expect(s.routes).toEqual({ locating: 'sonnet', reading: 'sonnet' })
  expect(s.notes).toEqual([])
})

test('a value that is not recognised never makes routing more active', async () => {
  const s = parseSettings({ mode: 'turbo', locatingRoute: 'off', readingRoute: 'gpt' }, undefined)
  expect(s.mode).toBe('off')
  expect(s.routes).toEqual({ locating: 'parent', reading: 'parent' })
  expect(s.notes.length).toBe(3)
})

test('a route value with a space in it, or a family word inside another word, is not recognised', async () => {
  const s = parseSettings({ locatingRoute: 'not haiku', readingRoute: 'affable' }, undefined)
  expect(s.routes).toEqual({ locating: 'parent', reading: 'parent' })
  expect(s.notes.length).toBe(2)
  expect(s.notes.some(n => n.includes('locatingRoute') && n.includes('not haiku'))).toBe(true)
  expect(s.notes.some(n => n.includes('readingRoute') && n.includes('affable'))).toBe(true)
})

test('values of the wrong type are handled the same way and nothing throws', async () => {
  for (const bad of [true, [], 7, null, { a: 1 }]) {
    const s = parseSettings({ mode: bad, locatingRoute: bad, readingRoute: bad }, undefined)
    expect(s.mode).toBe('off')
    expect(s.routes).toEqual({ locating: 'parent', reading: 'parent' })
  }
  expect(parseSettings(null, undefined).mode).toBe('observe')
  expect(parseSettings('x', undefined).mode).toBe('observe')
})

test('a note shows the bad value cleaned', async () => {
  const s = parseSettings({ mode: 'tur\u001b[2Jbo\nx' }, undefined)
  expect(s.notes[0]!.includes('\u001b')).toBe(false)
  expect(s.notes[0]!.includes('\n')).toBe(false)
})

test('a note on a value that held hidden characters says they were removed from what it shows', async () => {
  const s = parseSettings({ mode: 'route\u200B', locatingRoute: 'hai\u202Eku' }, undefined)
  expect(s.mode).toBe('off')
  expect(s.routes.locating).toBe('parent')
  expect(s.notes.length).toBe(2)
  for (const note of s.notes) expect(note.includes('hidden characters')).toBe(true)
  expect(parseSettings({ mode: 'turbo' }, undefined).notes[0]!.includes('hidden')).toBe(false)
})

test('a tab, newline or carriage return alone is ordinary whitespace, so the note does not say hidden characters were removed', async () => {
  // Trimmed, this is a valid mode, so no note at all.
  expect(parseSettings({ mode: 'route\n' }, undefined)).toEqual(expect.objectContaining({ mode: 'route', notes: [] }))
  for (const mode of ['ro\tute', 'ro\nute', 'ro\r\nute', 'turbo\n']) {
    const s = parseSettings({ mode }, undefined)
    expect(s.notes.length).toBe(1)
    expect(s.notes[0]!.includes('hidden')).toBe(false)
  }
  const s = parseSettings({ mode: 'route' + String.fromCodePoint(0x200B) }, undefined)
  expect(s.notes[0]!.includes('(hidden characters removed)')).toBe(true)
})

test('a forced subagent model makes the router stand down', async () => {
  for (const v of ['1', 'true', 'yes'])
    expect(parseSettings({ mode: 'route' }, v).standingDown).toBe('CLAUDE_CODE_SUBAGENT_MODEL_FORCE is set')
  for (const v of [undefined, '', '0', 'false'])
    expect(parseSettings({ mode: 'route' }, v).standingDown).toBe(null)
})

test("this plugin's values are found under its name, with or without a source suffix", async () => {
  const at = (key: string) => ({ pluginConfigs: { [key]: { options: { mode: 'route' } }, other: { options: { mode: 'off' } } } })
  for (const key of ['subagent-router', 'subagent-router@inline', 'subagent-router@bobtat-plugins'])
    expect(pickOptions(at(key)).options).toEqual({ mode: 'route' })
  expect(pickOptions({}).options).toEqual({})
  expect(pickOptions(null).options).toEqual({})
  expect(pickOptions({ pluginConfigs: { 'subagent-router-extra': { options: { mode: 'route' } } } }).options).toEqual({})
})

test('two entries that disagree on a field leave that field unset, with a note', async () => {
  const got = pickOptions({ pluginConfigs: {
    'subagent-router': { options: { mode: 'route', locatingRoute: 'haiku' } },
    'subagent-router@inline': { options: { mode: 'observe', locatingRoute: 'haiku' } } } })
  expect(got.options).toEqual({ locatingRoute: 'haiku' })
  expect(typeof got.note).toBe('string')
})

test('pickOptions does not throw on any shape and keeps its note free of control characters', async () => {
  const shapes: unknown[] = [undefined, 7, 'x', [], [1], { pluginConfigs: null }, { pluginConfigs: [] }, { pluginConfigs: 'x' },
    { pluginConfigs: { 'subagent-router': null } }, { pluginConfigs: { 'subagent-router': { options: [] } } },
    { pluginConfigs: { 'subagent-router': { options: 'x' } } }, { pluginConfigs: { 'subagent-router': {} } }]
  for (const shape of shapes) expect(pickOptions(shape).options).toEqual({})
  const got = pickOptions({ pluginConfigs: {
    'subagent-router': { options: { 'a\u001b[2J\nb': 1 } },
    'subagent-router@x': { options: { 'a\u001b[2J\nb': 2 } } } })
  expect(got.options).toEqual({})
  expect(/[\u0000-\u001F\u007F]/.test(got.note ?? '')).toBe(false)
})

type Answer = unknown | (() => unknown)

function fakeHost(answers: Record<string, Answer>, env: Answer = undefined) {
  const asked: string[] = []
  const answer = (a: Answer) => (typeof a === 'function' ? (a as () => unknown)() : a)
  const host: SettingsHost = {
    settings: {
      read: async (args: { source: string }) => {
        asked.push(args.source)
        return answer(answers[args.source])
      },
    },
    env: { get: async () => answer(env) as string | undefined },
  }
  return { host, asked }
}

const withOptions = (options: unknown) => ({ pluginConfigs: { 'subagent-router': { options } } })

test('readSettings reads only the user and policy sources, every call', async () => {
  const { host, asked } = fakeHost({ user: {}, policy: {}, project: withOptions({ mode: 'route' }), local: withOptions({ mode: 'route' }) })
  await readSettings(host)
  await readSettings(host)
  expect(asked).toEqual(['user', 'policy', 'user', 'policy'])
})

test('a field set in policy wins over the user value, field by field', async () => {
  const { host } = fakeHost({
    user: withOptions({ mode: 'route', locatingRoute: 'sonnet' }),
    policy: withOptions({ mode: 'off' }),
  })
  const s = await readSettings(host)
  expect(s.mode).toBe('off')
  expect(s.routes.locating).toBe('sonnet')
})

test('a value present only in the project settings is ignored', async () => {
  const { host } = fakeHost({ user: {}, policy: {}, project: withOptions({ mode: 'route' }) })
  expect(await readSettings(host)).toEqual(
    { mode: 'observe', routes: { locating: 'haiku', reading: 'parent' }, standingDown: null, notes: [] })
})

test('a read that rejects gives mode off with a note and does not throw', async () => {
  for (const failing of ['user', 'policy']) {
    const { host } = fakeHost({
      user: withOptions({ mode: 'route' }), policy: withOptions({ mode: 'route' }),
      [failing]: () => { throw new Error('boom\nline') },
    })
    const s = await readSettings(host)
    expect(s.mode).toBe('off')
    expect(s.notes.length > 0).toBe(true)
    expect(s.notes.every(n => !/[\u0000-\u001F\u007F]/.test(n))).toBe(true)
  }
})

test('env.get failing, by rejection or by throwing, gives mode off with a note', async () => {
  const good = { user: withOptions({ mode: 'route' }), policy: {} }
  const rejecting: SettingsHost = { ...fakeHost(good).host, env: { get: () => Promise.reject(new Error('no')) } }
  const throwing: SettingsHost = { ...fakeHost(good).host, env: { get: () => { throw new Error('no') } } }
  for (const host of [rejecting, throwing]) {
    const s = await readSettings(host)
    expect(s.mode).toBe('off')
    expect(s.notes.length > 0).toBe(true)
  }
})

test('settings.read answering something that is not an object counts as no settings', async () => {
  for (const odd of [null, 'text', [], [withOptions({ mode: 'route' })], 7, undefined]) {
    const { host } = fakeHost({ user: odd, policy: odd })
    const s = await readSettings(host)
    expect(s.mode).toBe('observe')
    expect(s.notes).toEqual([])
  }
})

test('a conflict note reaches the result and names its source', async () => {
  const conflicting = { pluginConfigs: {
    'subagent-router': { options: { mode: 'route' } },
    'subagent-router@inline': { options: { mode: 'off' } } } }
  const { host } = fakeHost({ user: {}, policy: conflicting })
  const s = await readSettings(host)
  expect(s.mode).toBe('off')
  expect(s.notes.length).toBe(1)
  expect(s.notes[0]!.includes('policy')).toBe(true)
  const { host: userHost } = fakeHost({ user: conflicting, policy: {} })
  expect((await readSettings(userHost)).notes[0]!.includes('user')).toBe(true)
})

test('the force variable stands the router down and leaves the configured mode', async () => {
  const { host } = fakeHost({ user: withOptions({ mode: 'route' }), policy: {} }, '1')
  const s = await readSettings(host)
  expect(s.standingDown).toBe('CLAUDE_CODE_SUBAGENT_MODEL_FORCE is set')
  expect(s.mode).toBe('route')
})

const entries = (a: unknown, b: unknown) => ({ pluginConfigs: {
  'subagent-router': { options: a },
  'subagent-router@x': { options: b } } })

test('pickOptions names the fields that conflicted, and none when nothing does', async () => {
  const got = pickOptions({ pluginConfigs: {
    'subagent-router': { options: { mode: 'route', locatingRoute: 'haiku' } },
    'subagent-router@inline': { options: { mode: 'observe', locatingRoute: 'haiku' } } } })
  expect(got.conflicts).toEqual(['mode'])
  expect(pickOptions({}).conflicts).toEqual([])
  expect(pickOptions(withOptions({ mode: 'route' })).conflicts).toEqual([])
})

test('a conflict inside policy is not overridden by the user value', async () => {
  const { host } = fakeHost({
    user: withOptions({ mode: 'route' }),
    policy: entries({ mode: 'off' }, { mode: 'observe' }),
  })
  const s = await readSettings(host)
  expect(s.mode).toBe('off')
  expect(s.notes.some(n => n.includes('mode') && n.includes('policy'))).toBe(true)
})

test('a field that conflicts inside policy and inside user settings gives one note, the policy one', async () => {
  const { host } = fakeHost({ user: entries({ mode: 'route' }, { mode: 'observe' }), policy: entries({ mode: 'off' }, { mode: 'observe' }) })
  const s = await readSettings(host)
  expect(s.mode).toBe('off')
  expect(s.notes.length).toBe(1)
  expect(s.notes[0]!.startsWith('policy:') && s.notes[0]!.includes('mode')).toBe(true)
})

test('a route conflict inside policy gives the parent model whatever the user says', async () => {
  const { host } = fakeHost({
    user: withOptions({ locatingRoute: 'haiku' }),
    policy: entries({ locatingRoute: 'parent' }, { locatingRoute: 'sonnet' }),
  })
  expect((await readSettings(host)).routes.locating).toBe('parent')
})

test('a mode conflict inside user settings, with policy silent, is off and not the default', async () => {
  const { host } = fakeHost({ user: entries({ mode: 'off' }, { mode: 'Off' }), policy: {} })
  const s = await readSettings(host)
  expect(s.mode).toBe('off')
  expect(s.notes.some(n => n.includes('mode') && n.includes('user'))).toBe(true)
})

test('a route conflict inside user settings, with policy silent, is the parent model and not the default', async () => {
  const { host } = fakeHost({ user: entries({ locatingRoute: 'parent' }, { locatingRoute: 'sonnet' }), policy: {} })
  expect((await readSettings(host)).routes.locating).toBe('parent')
})

test('a user conflict on a field policy sets gives way to policy, and is still noted', async () => {
  const { host } = fakeHost({ user: entries({ mode: 'off' }, { mode: 'Off' }), policy: withOptions({ mode: 'observe' }) })
  const s = await readSettings(host)
  expect(s.mode).toBe('observe')
  expect(s.notes.some(n => n.startsWith('user:') && n.includes('mode'))).toBe(true)
})

test('policy values are merged before they are parsed, so a bad policy value is not rescued by the user', async () => {
  const mode = async (policy: unknown) => (await readSettings(fakeHost({ user: withOptions({ mode: 'route' }), policy: withOptions(policy) }).host)).mode
  expect(await mode({ mode: 'turbo' })).toBe('off')
  expect(await mode({ mode: null })).toBe('off')
  const { host } = fakeHost({ user: withOptions({ readingRoute: 'sonnet' }), policy: withOptions({ readingRoute: 'gpt' }) })
  expect((await readSettings(host)).routes.reading).toBe('parent')
})

test('a policy conflict is reported once, by its cause, and not as a null value', async () => {
  const { host } = fakeHost({ user: withOptions({ mode: 'route' }), policy: entries({ mode: 'off' }, { mode: 'observe' }) })
  const s = await readSettings(host)
  expect(s.mode).toBe('off')
  expect(s.notes.length).toBe(1)
  expect(s.notes[0]!.includes('policy') && s.notes[0]!.includes('mode') && s.notes[0]!.includes('the router is off')).toBe(true)
  expect(s.notes.some(n => n.includes('null'))).toBe(false)
})

test('a user conflict with policy silent is reported once and says that route is off', async () => {
  const { host } = fakeHost({ user: entries({ locatingRoute: 'parent' }, { locatingRoute: 'sonnet' }), policy: {} })
  const s = await readSettings(host)
  expect(s.routes.locating).toBe('parent')
  expect(s.notes.length).toBe(1)
  expect(s.notes[0]!.includes('user') && s.notes[0]!.includes('locatingRoute') && s.notes[0]!.includes('that route is off')).toBe(true)
})

test("a user conflict on a field policy sets says policy's value is used, not that anything is off", async () => {
  const { host } = fakeHost({ user: entries({ mode: 'off' }, { mode: 'Off' }), policy: withOptions({ mode: 'observe' }) })
  const s = await readSettings(host)
  expect(s.mode).toBe('observe')
  expect(s.notes.length).toBe(1)
  expect(s.notes[0]!.includes('user') && s.notes[0]!.includes('mode') && s.notes[0]!.includes("policy's value is used")).toBe(true)
  expect(s.notes[0]!.includes('is off')).toBe(false)
})

test('a policy conflict and a bad user value each give their own note', async () => {
  const { host } = fakeHost({ user: withOptions({ readingRoute: 'gpt' }), policy: entries({ mode: 'off' }, { mode: 'observe' }) })
  const s = await readSettings(host)
  expect(s.notes.length).toBe(2)
  expect(s.notes.some(n => n.includes('policy') && n.includes('mode'))).toBe(true)
  expect(s.notes.some(n => n.includes('readingRoute') && n.includes('gpt'))).toBe(true)
})

test('a real null mode keeps its value note and gets no conflict note', async () => {
  const { host } = fakeHost({ user: withOptions({ mode: null }), policy: {} })
  const s = await readSettings(host)
  expect(s.mode).toBe('off')
  expect(s.notes.length).toBe(1)
  expect(s.notes[0]!.includes('mode null is')).toBe(true)
  expect(s.notes[0]!.includes('disagree')).toBe(false)
})

test('conflicts on two fields in one source give one note per field', async () => {
  const { host } = fakeHost({
    user: {},
    policy: entries({ mode: 'off', readingRoute: 'parent' }, { mode: 'route', readingRoute: 'sonnet' }),
  })
  const s = await readSettings(host)
  expect(s.notes.length).toBe(2)
  expect(s.notes.some(n => n.includes('mode'))).toBe(true)
  expect(s.notes.some(n => n.includes('readingRoute'))).toBe(true)
})

test('a null value is shown as null in its note, and not as an empty string', async () => {
  const nullNote = parseSettings({ mode: null }, undefined).notes[0]!
  const emptyNote = parseSettings({ mode: '' }, undefined).notes[0]!
  expect(nullNote.includes('mode null is')).toBe(true)
  expect(emptyNote.includes('mode "" is')).toBe(true)
})
