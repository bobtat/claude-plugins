import { expect, test } from 'claude-code/testing'
import type { ModelCompleteResult, On } from 'claude-code'
import type { DecisionRecord } from '../types'
import { DENY_TEXT } from './note'
import { USAGE, index, input, isDenied, recordIds, records, report, routeA2, spawner, until, world, written } from './test-support'

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

// The engine's type gives the started arm `deny?: undefined`, so the key may be present with no refusal in it.
const startedWithDenyKey = (w: ReturnType<typeof world>) => (e: { model?: string | null }) =>
  ({ model: e.model ?? w.startModel, agentId: `a${w.seen.length}`, deny: undefined }) as never

test('a start whose answer carries deny: undefined teaches the baseline in observe mode', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.mode = 'observe'
  w.answer = startedWithDenyKey(w)

  await spawn()
  expect(records(w)[0]).toEqual(expect.objectContaining({ outcome: 'unchanged', started: 'claude-opus-5-5', agentId: 'a1' }))
  expect(written(w, 'baseline').map((s) => s.value)).toEqual(['claude-opus-5-5'])
})

test('a routed start whose answer carries deny: undefined is marked routed and shown', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.answer = startedWithDenyKey(w)

  await spawn()
  await spawn()
  expect(written(w, 'routed').map((s) => s.id)).toEqual(['a2'])
  expect(w.lines).toEqual([expect.stringContaining('Routed to haiku')])
  expect(await spawn({ parentAgentId: 'a2' })).toEqual({ deny: DENY_TEXT })
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

test('a routed start on the baseline family turns the route off even when it lists cheaper than the baseline', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.startModel = 'claude-opus-4-8'
  const older = { parentModel: 'claude-opus-4-8' }
  await spawn(older)

  w.answer = () => ({ model: 'claude-opus-5-5', agentId: `a${w.seen.length}` })
  await spawn(older)
  expect(w.seen[1]?.model).toBe('haiku')
  expect(written(w, 'routed')).toEqual([])
  expect(written(w, 'routeOff').map((s) => s.id)).toEqual(['locating'])
  expect(w.lines).toEqual([expect.stringContaining('Asked for haiku; the locating route is off for this session; started on claude-opus-5-5')])

  w.answer = w.start
  await spawn(older)
  expect(w.seen[2]?.model).toBe(undefined)
  expect(records(w)[2]?.reason).toBe('no-route-applies')
})

for (const started of ['arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123', 'fast']) {
  test(`a routed start on a model whose family cannot be read (${started.slice(0, 12)}) is kept routed and turns the route off`, async ($, on) => {
    const w = world(on)
    const spawn = spawner($)
    await spawn()

    w.answer = () => ({ model: started, agentId: `a${w.seen.length}` })
    await spawn()
    expect(w.seen[1]?.model).toBe('haiku')
    expect(written(w, 'routed').map((s) => s.id)).toEqual(['a2'])
    expect(w.lines.length).toBe(1)
    expect(w.lines[0]?.startsWith(`Asked for haiku; the locating route is off for this session; started on ${started}`)).toBe(true)

    w.answer = w.start
    expect(await spawn({ parentAgentId: 'a2', subagentType: 'general-purpose' })).toEqual({ deny: DENY_TEXT })
    await spawn()
    expect(w.seen.at(-1)?.model).toBe(undefined)
    expect(records(w).at(-1)?.reason).toBe('no-route-applies')
  })
}

test('a routed start confirmed cheaper by listed price keeps the route on', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.routes = { readingRoute: 'sonnet' }
  w.kinds = ['reading']
  await spawn()

  w.answer = (e) => ({ model: e.model === 'sonnet' ? 'claude-sonnet-5-5' : w.startModel, agentId: `a${w.seen.length}` })
  await spawn()
  await spawn()
  expect(w.seen.map((s) => s.model)).toEqual([undefined, 'sonnet', 'sonnet'])
  expect(w.lines.every((line) => line.startsWith('Routed to sonnet'))).toBe(true)
  expect(written(w, 'routeOff')).toEqual([])
})

test('listed prices overrule family rank: an Opus 4.8 start under a Fable 5.2 baseline turns the route off', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.routes = { locatingRoute: 'opus' }
  w.startModel = 'claude-fable-5-2'
  const fable = { parentModel: 'claude-fable-5-2' }
  await spawn(fable)

  w.answer = (e) => ({ model: e.model === 'opus' ? 'claude-opus-4-8' : w.startModel, agentId: `a${w.seen.length}` })
  await spawn(fable)
  expect(w.seen[1]?.model).toBe('opus')
  expect(written(w, 'routeOff').map((s) => s.id)).toEqual(['locating'])
  expect(w.lines).toEqual([expect.stringContaining('Asked for opus; the locating route is off for this session; started on claude-opus-4-8')])
})

test('a sonnet route whose start lands on haiku turns the route off and still treats the agent as routed', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.routes = { readingRoute: 'sonnet' }
  w.kinds = ['reading']
  await spawn()

  w.answer = (e) => ({ model: e.model === 'sonnet' ? 'claude-haiku-5-5' : w.startModel, agentId: `a${w.seen.length}` })
  await spawn()
  expect(w.seen[1]?.model).toBe('sonnet')
  expect(written(w, 'routeOff').map((s) => s.id)).toEqual(['reading'])
  expect(w.lines).toEqual([expect.stringContaining('Asked for sonnet; the reading route is off for this session; started on claude-haiku-5-5')])
  w.answer = w.start
  expect(await spawn({ parentAgentId: 'a2', subagentType: 'general-purpose' })).toEqual({ deny: DENY_TEXT })
})

test('a haiku route whose start lands on sonnet under an Opus baseline turns the route off', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await spawn()

  w.answer = (e) => ({ model: e.model === 'haiku' ? 'claude-sonnet-5-5' : w.startModel, agentId: `a${w.seen.length}` })
  await spawn()
  expect(written(w, 'routeOff').map((s) => s.id)).toEqual(['locating'])
  expect(w.lines).toEqual([expect.stringContaining('Asked for haiku; the locating route is off for this session; started on claude-sonnet-5-5')])
})

test('a haiku route that starts on an unpriced haiku is confirmed by family and stays on', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await spawn()

  w.answer = (e) => ({ model: e.model === 'haiku' ? 'claude-haiku-4-5' : w.startModel, agentId: `a${w.seen.length}` })
  await spawn()
  await spawn()
  expect(w.seen.map((s) => s.model)).toEqual([undefined, 'haiku', 'haiku'])
  expect(written(w, 'routeOff')).toEqual([])
})

test('a sonnet route that starts on an unpriced sonnet cannot be confirmed cheaper and turns off', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  w.routes = { readingRoute: 'sonnet' }
  w.kinds = ['reading']
  await spawn()

  w.answer = (e) => ({ model: e.model === 'sonnet' ? 'claude-sonnet-4-6' : w.startModel, agentId: `a${w.seen.length}` })
  await spawn()
  expect(w.lines).toEqual([expect.stringContaining('Asked for sonnet; the reading route is off for this session; started on claude-sonnet-4-6')])
  expect(written(w, 'routed').map((s) => s.id)).toEqual(['a2'])
  await spawn()
  expect(w.seen[2]?.model).toBe(undefined)
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

test('a refused routed write does not release the agent: its next spawn is still refused', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await spawn()

  w.failSet = 'routed'
  expect(await spawn()).toEqual({ model: 'haiku', agentId: 'a2' })
  w.failSet = null
  expect(written(w, 'routed')).toEqual([])
  expect(await spawn({ parentAgentId: 'a2', subagentType: 'general-purpose' })).toEqual({ deny: DENY_TEXT })
})

test('a refused routeOff write still keeps the route off for the next spawn', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await spawn()

  w.failSet = 'routeOff'
  w.answer = () => ({ model: 'claude-opus-5-5', agentId: `a${w.seen.length}` })
  await spawn()
  expect(written(w, 'routeOff')).toEqual([])
  w.failSet = null
  w.answer = w.start
  await spawn()
  expect(w.seen[2]?.model).toBe(undefined)
  expect(records(w)[2]?.reason).toBe('no-route-applies')
})

test('a route turned off while another spawn waits at the picker leaves that spawn unchanged', async ($, on) => {
  const w = world(on)
  const spawn = spawner($)
  await spawn()

  let releaseB = () => {}
  const bAsked = new Promise<void>((resolve) => {
    releaseB = resolve
  })
  let bWaiting = false
  w.reply = async (e) => {
    if (typeof e.prompt === 'string' && e.prompt.includes('task B')) {
      bWaiting = true
      await bAsked
    }
    return { isAnswered: true, text: 'locating', usage: USAGE }
  }
  w.answer = (e) => ({ model: e.prompt.includes('task A') ? 'claude-opus-5-5' : (e.model ?? w.startModel), agentId: `a${w.seen.length}` })

  const b = spawn({ description: 'B', prompt: 'task B' })
  await until(() => bWaiting)
  await spawn({ description: 'A', prompt: 'task A' })
  expect(written(w, 'routeOff').map((s) => s.id)).toEqual(['locating'])
  releaseB()
  await b
  const bSeen = w.seen.find((s) => s.prompt.startsWith('task B'))
  expect(bSeen?.model).toBe(undefined)
  expect(bSeen?.prompt).toBe('task B')
  expect(records(w).find((r) => r.description === 'B')).toEqual(expect.objectContaining({ outcome: 'unchanged', target: null, reason: 'no-route-applies' }))
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
