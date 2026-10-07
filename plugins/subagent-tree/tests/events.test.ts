import { expect, mock, test } from 'claude-code/testing'

import { done, PANE, runStep, SURFACES, subagent } from './support'
import type { Listed } from './support'

const T0 = 1_000_000

// The engine beneath the plugin: the agents it lists, and the steps and turns
// it answers as the API would.
function engine(on: Parameters<Parameters<typeof test>[1]>[1], agents: Listed[] | (() => Listed[])) {
  on('agent.list', () => ({ value: typeof agents === 'function' ? agents() : agents }))
  on('tool.call', () => ({ result: {}, text: '' }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' }
  })
  on('turn.complete', (_$, e) => ({ text: e.answer, usage: e.usage }))
}

for (const surface of SURFACES) {
  test(`${surface}: steps, tokens, nesting and the footer come from the agents' own events`, async ($, on) => {
    const clock = mock.clock(on, { now: T0 })
    engine(on, [subagent('a'), subagent('b', 'completed', { parentId: 'a' })])

    await runStep($, 'a')
    await $.tool.call({ tool: 'Read', agentId: 'a' })
    await clock.advance(5_000)
    await $.turn.complete(done('b', 5_000, 2_000))

    const ui = await $.ui.mount(PANE(surface))
    expect(await ui.find({ text: /Explore: task a/ })).toBeDefined()
    expect(await ui.find({ text: /running · 5s · 1 tool · 1 step · on Read/ })).toBeDefined()
    expect(await ui.find({ text: /completed · 5s · 0 tools · 0 steps · 2k out/ })).toBeDefined()
    expect(await ui.find({ text: /2 agents · 1 active · 2k tokens out/ })).toBeDefined()
  })

  test(`${surface}: an event from an id the list does not show changes neither rows nor footer`, async ($, on) => {
    mock.clock(on, { now: T0 })
    engine(on, [subagent('a')])

    await $.turn.complete(done('fork-1', 1_000, 90_000))
    await $.turn.complete(done('a', 1_000, 500))

    const ui = await $.ui.mount(PANE(surface))
    expect(await ui.find({ text: /1 agents · 1 active · 500 tokens out/ })).toBeDefined()
    expect(await ui.find({ text: /fork-1/ })).toBeUndefined()
  })
}

test('a completed agent keeps its time as the clock moves on', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  engine(on, [subagent('a', 'completed')])

  await runStep($, 'a')
  await clock.advance(12_000)
  await $.turn.complete(done('a', 12_000, 1))
  await clock.advance(600_000)

  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /completed · 12s/ })).toBeDefined()
})

test('a teammate that ran twice with an idle gap counts only its active time', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  engine(on, [subagent('mate', 'idle', { type: 'teammate' })])

  await runStep($, 'mate')
  await clock.advance(10_000)
  await $.turn.complete(done('mate', 10_000, 1))
  await clock.advance(300_000)
  await runStep($, 'mate')
  await clock.advance(10_000)
  await $.turn.complete(done('mate', 10_000, 1))

  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /idle · 20s · 0 tools · 2 steps/ })).toBeDefined()
})

test('a run already open when the mod loaded takes its start from the turn length', async ($, on) => {
  mock.clock(on, { now: T0 })
  engine(on, [subagent('a', 'completed')])

  await $.turn.complete(done('a', 7_000, 1))

  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /completed · 7s/ })).toBeDefined()
})

test('a turn that ended without usage adds no tokens', async ($, on) => {
  mock.clock(on, { now: T0 })
  engine(on, [subagent('a', 'failed')])

  await $.turn.complete({ answer: '', durationMs: 1_000, isAborted: true, turnId: 't-a', agentId: 'a', reason: 'aborted' })

  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /failed · 1s/ })).toBeDefined()
  expect(await ui.find({ text: /0 tokens out/ })).toBeDefined()
})

for (const surface of SURFACES) {
  test(`${surface}: a long list is drawn whole, for the pane to scroll`, async ($, on) => {
    mock.clock(on, { now: T0 })
    engine(
      on,
      Array.from({ length: 60 }, (_, i) => subagent(`a${i}`, 'completed')),
    )

    const ui = await $.ui.mount(PANE(surface))
    expect(await ui.find({ text: /Explore: task a0$/ })).toBeDefined()
    expect(await ui.find({ text: /Explore: task a59$/ })).toBeDefined()
    expect(await ui.find({ text: /more/ })).toBeUndefined()
  })
}

test('the pane redraws each second while an agent runs, once more when it ends, then stops', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let agents = [subagent('a')]
  engine(on, () => agents)
  let redraws = 0
  // The engine redraws the pane on an invalidate; the test stands in for it.
  let pane: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  on('ui.invalidate', async () => {
    redraws += 1
    await pane?.redraw()
    return { value: undefined }
  })

  pane = await $.ui.mount(PANE('terminal'))
  await clock.advance(10_000)
  expect(redraws).toBeGreaterThanOrEqual(9)

  const beforeEnd = redraws
  agents = [subagent('a', 'completed')]
  await clock.advance(1_000)
  expect(redraws).toBeGreaterThan(beforeEnd)
  const atEnd = redraws
  await clock.advance(10_000)

  expect(redraws).toBe(atEnd)
})

test('a pane that is no longer drawn stops the timer within a few seconds', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let lists = 0
  engine(on, () => {
    lists += 1
    return [subagent('a')]
  })
  let redraws = 0
  // Nothing redraws the pane here, as when it was dropped without ui.close.
  on('ui.invalidate', () => {
    redraws += 1
    return { value: undefined }
  })

  await $.ui.mount(PANE('terminal'))
  await clock.advance(10_000)
  const settled = { lists, redraws }
  await clock.advance(60_000)

  expect(settled.redraws).toBeLessThanOrEqual(4)
  expect(lists).toBe(settled.lists)
  expect(redraws).toBe(settled.redraws)
})

test('/agents-tree close closes the pane and stops the timer at once', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let lists = 0
  engine(on, () => {
    lists += 1
    return [subagent('a')]
  })
  let redraws = 0
  let pane: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  on('ui.invalidate', async () => {
    redraws += 1
    await pane?.redraw()
    return { value: undefined }
  })
  let closed = ''
  on('ui.close', (_$, e) => {
    closed = e.id
    return { value: undefined }
  })

  pane = await $.ui.mount(PANE('terminal'))
  await clock.advance(2_000)
  const result = await $.command.run({
    command: 'agents-tree',
    args: 'close',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })
  const before = { lists, redraws }
  await clock.advance(2_000)

  expect(closed).toBe('subagent-tree')
  expect('text' in result ? result.text : '').toBe('Subagent tree closed.')
  expect(lists).toBe(before.lists)
  expect(redraws).toBe(before.redraws)
})

test('a finished turn drops the stats of stale unlisted ids, so they do not return to the footer', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let agents = [subagent('a')]
  engine(on, () => agents)

  await $.turn.complete(done('ghost', 1_000, 90_000))
  await clock.advance(11 * 60_000)
  await $.turn.complete(done('a', 1_000, 500))
  agents = [subagent('a'), subagent('ghost')]

  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /2 agents · .* · 500 tokens out/ })).toBeDefined()
})

test('while the pane is open, the timer drops stale stats of ids the list does not show', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let agents = [subagent('a')]
  engine(on, () => agents)
  let pane: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  on('ui.invalidate', async () => {
    await pane?.redraw()
    return { value: undefined }
  })

  await $.turn.complete(done('ghost', 1_000, 90_000))
  // Stale before the pane opens, so the timer's first ticks are the only prune.
  await clock.advance(11 * 60_000)
  pane = await $.ui.mount(PANE('terminal'))
  await clock.advance(2_000)
  agents = [subagent('a'), subagent('ghost')]
  await pane.redraw()

  expect(await pane.find({ text: /2 agents · .* · 0 tokens out/ })).toBeDefined()
})

test('the current tool shows between a tool call and the next request, then clears', async ($, on) => {
  mock.clock(on, { now: T0 })
  engine(on, [subagent('a')])

  await $.tool.call({ tool: 'Read', agentId: 'a' })
  const during = await $.ui.mount(PANE('terminal'))
  expect(await during.find({ text: /1 tool · 0 steps · on Read/ })).toBeDefined()
  await during.unmount()

  await runStep($, 'a')
  const after = await $.ui.mount(PANE('terminal'))
  expect(await after.find({ text: /running · .* · 1 tool · 1 step$/ })).toBeDefined()
})

test('an agent that raises no events here, such as a teammate in a terminal pane of its own, shows by status', async ($, on) => {
  mock.clock(on, { now: T0 })
  engine(on, [subagent('mate', 'idle', { type: 'teammate', description: 'review the PR' })])

  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ text: /○ teammate: review the PR/ })).toBeDefined()
  expect(await ui.find({ text: /^idle$/ })).toBeDefined()
})
