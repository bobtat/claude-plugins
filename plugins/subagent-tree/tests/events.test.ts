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
    expect(await ui.find({ text: /2 agents · 1 running · 2k tokens out/ })).toBeDefined()
  })

  test(`${surface}: an event from an id the list does not show changes neither rows nor footer`, async ($, on) => {
    mock.clock(on, { now: T0 })
    engine(on, [subagent('a')])

    await $.turn.complete(done('fork-1', 1_000, 90_000))
    await $.turn.complete(done('a', 1_000, 500))

    const ui = await $.ui.mount(PANE(surface))
    expect(await ui.find({ text: /1 agents · 1 running · 500 tokens out/ })).toBeDefined()
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

  test(`${surface}: a child of a listed agent is drawn too`, async ($, on) => {
    mock.clock(on, { now: T0 })
    engine(on, [subagent('a'), subagent('b', 'running', { parentId: 'a' })])

    const ui = await $.ui.mount(PANE(surface))
    const parent = await ui.find({ text: /Explore: task a$/ })
    const child = await ui.find({ text: /Explore: task b$/ })
    expect(parent).toBeDefined()
    expect(child).toBeDefined()
  })
}

test('the pane redraws each second while an agent runs, once more when it ends, then stops', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let agents = [subagent('a')]
  engine(on, () => agents)
  let redraws = 0
  on('ui.invalidate', () => {
    redraws += 1
    return { value: undefined }
  })

  await $.ui.mount(PANE('terminal'))
  await clock.advance(3_000)
  expect(redraws).toBeGreaterThanOrEqual(3)

  const beforeEnd = redraws
  agents = [subagent('a', 'completed')]
  await clock.advance(1_000)
  expect(redraws).toBeGreaterThan(beforeEnd)
  const atEnd = redraws
  await clock.advance(10_000)

  expect(redraws).toBe(atEnd)
})
