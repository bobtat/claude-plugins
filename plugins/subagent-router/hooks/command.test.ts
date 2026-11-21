import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { GATE_RESULT } from './picker-gate'
import { FAILED, RUN, report, spawner, unfenced, until, world } from './test-support'

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
  const body = unfenced(r.text)
  expect(body.startsWith('subagent-router: the report could not be built')).toBe(true)
  expect(body.includes('\n')).toBe(false)
})

// --- the answer is drawn as literal text ---

test('the whole answer is one fenced block longer than any run of backticks in it, so nothing in it is drawn as markdown', async ($, on) => {
  world(on)
  const spawn = spawner($)
  await spawn({ description: '[x](https://e.example) **b** __c__ <d>' })
  await spawn({ description: 'find ```` here' })

  const text = (await $.command.run(RUN)).text ?? ''
  const lines = text.split('\n')
  const fence = lines[0] ?? ''
  const longest = Math.max(...Array.from(text.slice(fence.length, -fence.length).matchAll(/`+/gu), (m) => m[0].length))
  expect(longest).toBe(4)
  expect(/^`+$/u.test(fence)).toBe(true)
  expect(fence.length > longest).toBe(true)
  expect(lines.at(-1)).toBe(fence)
  expect(lines.filter((l) => l === fence).length).toBe(2)
  const body = await report($)
  expect(body.includes('[x](https://e.example) **b** __c__ <d>')).toBe(true)
  expect(body.includes('find ```` here')).toBe(true)
})

test('a usage answer and a check answer are fenced too', async ($, on) => {
  world(on)
  for (const args of ['help', 'check-picker']) {
    const text = (await $.command.run({ ...RUN, args })).text ?? ''
    expect(text.startsWith('```\n')).toBe(true)
    expect(text.endsWith('\n```')).toBe(true)
  }
})

// --- what the report reads from live state and settings ---

test('after three failed picks in a row, the report says the picker is off', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.mode = 'observe'
  w.reply = () => FAILED
  for (let i = 0; i < 3; i++) await spawn()

  expect((await report($)).split('\n').includes('The picker is off for this session after three failures in a row.')).toBe(true)
})

for (const [kind, other] of [['locating', 'reading'], ['reading', 'locating']] as const) {
  test(`a routed ${kind} start that comes back at the baseline makes the report say the ${kind} route is off, and not the ${other} one`, async ($, on) => {
    const w = world(on)
    const spawn = spawner($)
    w.routes = { readingRoute: 'sonnet' }
    w.kinds = [kind]
    await spawn()
    w.answer = () => ({ model: 'claude-opus-5-5', agentId: `a${w.seen.length}` })
    await spawn()

    const text = await report($)
    expect(text.includes(`The ${kind} route is off for this session:`)).toBe(true)
    expect(text.includes(`The ${other} route is off`)).toBe(false)
    expect(text.includes('The picker is off')).toBe(false)
  })
}

test('with the force variable set, the report says the router is standing down', async ($, on) => {
  const w = world(on)
  w.env = { CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1' }

  expect((await report($)).includes('Standing down: CLAUDE_CODE_SUBAGENT_MODEL_FORCE is set, so the router routes nothing')).toBe(true)
  w.env = {}
  expect((await report($)).includes('Standing down')).toBe(false)
})

test('an unrecognised mode makes the report show mode off with its note', async ($, on) => {
  const w = world(on)
  w.mode = 'turbo'

  const lines = (await report($)).split('\n')
  expect(lines[0]?.startsWith('subagent-router, mode: off (')).toBe(true)
  expect(lines.includes('Settings: mode "turbo" is not observe, route or off, so the router is off')).toBe(true)
})
