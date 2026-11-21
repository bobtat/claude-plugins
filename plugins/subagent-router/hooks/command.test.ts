import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { GATE_RESULT } from './picker-gate'
import { RUN, spawner, until, world } from './test-support'

// The kit has setTimeout, though the engine's typings omit it.
declare const setTimeout: (run: () => void, ms: number) => unknown

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

test('the report says when the shipped picker wording has not passed its check', async ($, on) => {
  world(on)
  const text = (await $.command.run(RUN)).text ?? ''
  const passed = GATE_RESULT.status === ('passed' as string)
  expect(text.includes('This version shipped without a passed picker check')).toBe(!passed)
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
