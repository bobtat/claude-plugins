import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { GUARD_FAILED, SETTINGS_DENIED, SETTINGS_DENIED_BRIDGE, isPersonsChange, namesThisPlugin, settingsGuardFailed } from './guard'
import { ENGINE, change } from './test-support'

// --- the settings guard ---

// The plugin sets the key turn.start's text names and reports the answer back in that text: an inline plugin's
// register closes over nothing of this file.
const SETTER = {
  name: 'other',
  register(on: On) {
    on('turn.start', async ($, e, next) => {
      const result = await $.config.set({ key: e.text, value: 'route' })
      return next({ ...e, text: JSON.stringify(result) })
    })
  },
}

// The engine beneath: it writes every change that reaches it.
function configAt(on: On) {
  const written: string[] = []
  const texts: string[] = []
  on('config.set', (_$, e) => {
    written.push(e.key)
    return { value: e.value }
  })
  on('turn.start', (_$, e) => {
    texts.push(e.text)
    return { turnId: e.turnId }
  })
  const setByPlugin = async ($: Engine, key: string) => {
    await $.turn.start({ text: key, turnId: `t${texts.length}` })
    return JSON.parse(texts.at(-1) ?? 'null') as unknown
  }
  return { written, setByPlugin }
}

test("another plugin's attempt to change a setting is refused", { plugins: [SETTER] }, async ($, on) => {
  const { written, setByPlugin } = configAt(on)

  expect(await setByPlugin($, 'subagent-router.mode')).toEqual({ deny: SETTINGS_DENIED })
  expect(await setByPlugin($, 'pluginConfigs.subagent-router@inline.options.mode')).toEqual({ deny: SETTINGS_DENIED })
  expect(written).toEqual([])
  expect(await setByPlugin($, 'subagent-router-extra.mode')).toEqual({ value: 'route' })
  expect(written).toEqual(['subagent-router-extra.mode'])
})

test('the person changing a setting in /config goes through, and a change marked as from anywhere else is refused', async ($, on) => {
  const { written } = configAt(on)

  expect(await $.config.set(change('subagent-router.mode', { kind: 'composer' }))).toEqual({ value: 'route' })
  expect(await $.config.set(change('subagent-router.mode', { kind: 'plugin', name: 'x' }))).toEqual({ deny: SETTINGS_DENIED })
  expect(await $.config.set(change('subagent-router.mode', { kind: 'bridge' }))).toEqual({ deny: SETTINGS_DENIED_BRIDGE })
  expect(await $.config.set({ ...change('theme', { kind: 'plugin', name: 'x' }), provider: ENGINE })).toEqual({ value: 'route' })
  expect(written).toEqual(['subagent-router.mode', 'theme'])
})

test('a change the engine raises with no origin is refused, for it cannot be shown to be the person\'s', async ($, on) => {
  const { written } = configAt(on)
  const { origin: _, ...unstamped } = change('subagent-router.mode', { kind: 'composer' })

  expect(await $.config.set(unstamped as never)).toEqual({ deny: SETTINGS_DENIED })
  expect(await $.config.set({ ...unstamped, key: 'theme', provider: ENGINE } as never)).toEqual({ value: 'route' })
  expect(written).toEqual(['theme'])
})

test('a row this plugin owns is guarded whatever its key says', async ($, on) => {
  const { written } = configAt(on)
  const ours = change('locatingRoute', { kind: 'plugin', name: 'x' })

  expect(await $.config.set(ours)).toEqual({ deny: SETTINGS_DENIED })
  expect(await $.config.set({ ...ours, origin: { kind: 'bridge' } })).toEqual({ deny: SETTINGS_DENIED_BRIDGE })
  expect(await $.config.set({ ...ours, origin: { kind: 'composer' } })).toEqual({ value: 'route' })
  expect(await $.config.set({ ...ours, provider: { plugin: 'subagent-router-extra', tier: 'user' } })).toEqual({ value: 'route' })
  expect(written).toEqual(['locatingRoute', 'locatingRoute'])

  const caught = Object.assign(async () => ({ value: 'route' }), { called: false }) as never
  expect(await settingsGuardFailed(ours, caught)).toEqual({ deny: GUARD_FAILED })
})

test('a person on the Remote Control bridge is told the change must be made at the terminal', async () => {
  expect(SETTINGS_DENIED_BRIDGE).toBe('subagent-router: its settings can be changed only at the terminal, in /config, not over Remote Control')
  expect(SETTINGS_DENIED.includes('by you')).toBe(true)
})

test('a failure inside the settings guard refuses the change unless next had already answered', async () => {
  const replayed = { value: 'route' } as const
  const caught = (called: boolean) => Object.assign(async () => replayed, { called }) as never
  const e = change('subagent-router.mode', { kind: 'composer' })

  expect(await settingsGuardFailed(e, caught(false))).toEqual({ deny: GUARD_FAILED })
  expect(await settingsGuardFailed(e, caught(true))).toEqual(replayed)
  expect(await settingsGuardFailed({ ...e, key: 'theme', provider: ENGINE }, caught(false))).toEqual(replayed)
})

test('a settings key names this plugin only where subagent-router stands as a whole word', async () => {
  for (const key of ['subagent-router', 'subagent-router.mode', 'subagent-router@inline.mode', 'pluginConfigs.subagent-router@inline.options.mode',
    'pluginConfigs.subagent-router.options', 'x/subagent-router', 'Subagent-Router.mode', 'subagent-router-extra.mode subagent-router.mode']) {
    expect(namesThisPlugin(key)).toBe(true)
  }
  for (const key of ['subagent-router-extra.mode', 'mysubagent-router.x', '-subagent-router.mode', 'subagent-router2.mode', 'subagent_router.mode',
    'theme', '', 'subagent-rout']) {
    expect(namesThisPlugin(key)).toBe(false)
  }
  for (const key of [undefined, null, 7, ['subagent-router.mode'], { key: 'subagent-router.mode' }]) expect(namesThisPlugin(key)).toBe(false)
})

test('only a change the engine raised for the person in /config counts as the person\'s own', async () => {
  const engine = { plugin: 'engine', tier: 'core' }
  expect(isPersonsChange(engine, { kind: 'composer' })).toBe(true)
  expect(isPersonsChange(engine, undefined)).toBe(false)
  expect(isPersonsChange(engine, { kind: 'plugin', name: 'x' })).toBe(false)
  expect(isPersonsChange(engine, { kind: 'bridge' })).toBe(false)
  expect(isPersonsChange(engine, { kind: 'sdk' })).toBe(false)
  expect(isPersonsChange(engine, null)).toBe(false)
  expect(isPersonsChange(engine, 'composer')).toBe(false)
  for (const caller of [{ plugin: 'other', tier: 'user' }, { plugin: 'subagent-router', tier: 'user' }, undefined, null, 'engine']) {
    expect(isPersonsChange(caller, { kind: 'composer' })).toBe(false)
  }
})
