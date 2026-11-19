import { expect, test } from 'claude-code/testing'
import type { AgentSpawnInput, On } from 'claude-code'
import { DENY_TEXT, MARKER, routerNote } from './note'
import type { Started } from './test-support'
import { first, input, isDenied, records, routeA2, spawner, world, written } from './test-support'

// --- the no-spawn rule ---

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
