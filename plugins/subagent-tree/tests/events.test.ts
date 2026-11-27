import { expect, mock, test } from 'claude-code/testing'

import { done, PANE, runStep, SURFACES, subagent } from './support'
import type { Listed } from './support'

const T0 = 1_000_000

const OPEN_PANE = { id: 'subagent-tree', title: 'Subagents', isShown: true, isFocused: false, isPlaced: true }

// The engine beneath the plugin: the agents it lists, the plugin's panes it
// lists (the pane is open unless a test says otherwise; null leaves the list
// unanswered, as when the engine cannot say), and the steps and turns it
// answers as the API would.
function engine(
  on: Parameters<Parameters<typeof test>[1]>[1],
  agents: Listed[] | (() => Listed[]),
  panes: (() => (typeof OPEN_PANE)[]) | null = () => [OPEN_PANE],
) {
  on('agent.list', () => ({ value: typeof agents === 'function' ? agents() : agents }))
  if (panes) on('ui.panes', () => ({ value: panes() }))
  on('tool.call', () => ({ result: {}, text: '' }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' }
  })
  on('turn.complete', (_$, e) => ({ text: e.answer, usage: e.usage }))
}

// A pane the engine lists until a close reaches it.
function closable() {
  const state = { isClosed: false }
  return {
    state,
    panes: () => (state.isClosed ? [] : [OPEN_PANE]),
    close: () => {
      state.isClosed = true
      return { value: undefined }
    },
  }
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

  // Idle: a heartbeat every fifth second, not one a second.
  expect(redraws - atEnd).toBeLessThanOrEqual(2)
})

test('a status that changes with no state write still shows, within the heartbeat', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let agents = [subagent('a', 'completed')]
  engine(on, () => agents)
  let pane: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  on('ui.invalidate', async () => {
    await pane?.redraw()
    return { value: undefined }
  })

  pane = await $.ui.mount(PANE('terminal'))
  await clock.advance(20_000)
  agents = [subagent('a', 'running')]
  await clock.advance(6_000)

  expect(await pane.find({ text: /● Explore: task a/ })).toBeDefined()
})

test('a pane that is no longer drawn stops the timer within about thirteen seconds', async ($, on) => {
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
  await clock.advance(20_000)
  const settled = { lists, redraws }
  await clock.advance(60_000)

  expect(settled.redraws).toBeLessThanOrEqual(16)
  expect(lists).toBe(settled.lists)
  expect(redraws).toBe(settled.redraws)
})

test('/agents-tree close closes the pane and stops the timer at once', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let lists = 0
  const door = closable()
  engine(
    on,
    () => {
      lists += 1
      return [subagent('a')]
    },
    door.panes,
  )
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
    return door.close()
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

test('a tick that fails is logged to the debug log and the next draw restarts the timer', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let fail = true
  let lists = 0
  engine(on, () => {
    lists += 1
    if (fail) throw new Error('agent list unavailable')
    return [subagent('a')]
  })
  const logged: string[] = []
  on('ui.log', (_$, e) => {
    logged.push(e.text)
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))

  await $.ui.mount(PANE('terminal')).catch(() => undefined)
  await clock.advance(3_000)
  expect(logged.some(line => /^redraw tick failed: /.test(line))).toBe(true)
  const afterFailure = lists
  await clock.advance(5_000)
  expect(lists).toBe(afterFailure)

  fail = false
  const pane = await $.ui.mount(PANE('terminal'))
  await clock.advance(3_000)
  expect(lists).toBeGreaterThan(afterFailure)
  expect(await pane.find({ text: /Explore: task a/ })).toBeDefined()
})

const run = ($: Parameters<Parameters<typeof test>[1]>[0], args: string) =>
  $.command.run({
    command: 'agents-tree',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })

const text = (result: Awaited<ReturnType<typeof run>>) => ('text' in result ? String(result.text) : '')

test('/agents-tree opens the pane with no argument or "open"', async ($, on) => {
  mock.clock(on, { now: T0 })
  engine(on, [])
  const opened: string[] = []
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })

  expect(text(await run($, ''))).toBe('Subagent tree opened.')
  expect(text(await run($, ' open '))).toBe('Subagent tree opened.')
  expect(opened).toEqual(['subagent-tree', 'subagent-tree'])
})

test('/agents-tree with an unknown argument replies with the usage and opens nothing', async ($, on) => {
  mock.clock(on, { now: T0 })
  engine(on, [])
  let opened = 0
  on('ui.open', () => {
    opened += 1
    return { value: { isPlaced: true } }
  })

  expect(text(await run($, 'closed'))).toBe('Usage: /agents-tree [close]')
  expect(opened).toBe(0)
})

test('/agents-tree close reports a refusal in plain words, and leaves the timer running', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let lists = 0
  engine(on, () => {
    lists += 1
    return [subagent('a')]
  })
  let pane: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  on('ui.invalidate', async () => {
    await pane?.redraw()
    return { value: undefined }
  })
  on('ui.close', () => ({ deny: 'the pane is pinned' }))

  pane = await $.ui.mount(PANE('terminal'))
  const reply = text(await run($, 'close'))
  const before = lists
  await clock.advance(3_000)

  expect(reply).toBe('Could not close the subagent tree: the pane is pinned')
  expect(lists).toBeGreaterThan(before)
})

test('/agents-tree close with no pane open is not an error', async ($, on) => {
  mock.clock(on, { now: T0 })
  engine(on, [], () => [])
  on('ui.close', () => ({ value: undefined }))

  expect(text(await run($, 'close'))).toBe('Subagent tree closed.')
})

test('the timer starts afresh after a close: no stale extra redraw from the last run', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let agents = [subagent('a')]
  const door = closable()
  engine(on, () => agents, door.panes)
  let redraws = 0
  let pane: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  on('ui.invalidate', async () => {
    redraws += 1
    await pane?.redraw()
    return { value: undefined }
  })
  on('ui.close', () => door.close())

  pane = await $.ui.mount(PANE('terminal'))
  await clock.advance(2_000)
  await run($, 'close')
  agents = [subagent('a', 'completed')]
  await pane.unmount()
  door.state.isClosed = false
  pane = await $.ui.mount(PANE('terminal'))
  const before = redraws
  await clock.advance(3_000)

  // Idle now, so no redraw until the fifth second; a leftover wasLive would redraw at once.
  expect(redraws).toBe(before)
})

test('a hook that keeps the pane open without refusing keeps the timer running', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let lists = 0
  engine(on, () => {
    lists += 1
    return [subagent('a')]
  })
  let pane: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  on('ui.invalidate', async () => {
    await pane?.redraw()
    return { value: undefined }
  })
  // Answers the close without closing anything, and the engine still lists the pane.
  on('ui.close', () => ({ value: undefined }))
  pane = await $.ui.mount(PANE('terminal'))
  const reply = text(await run($, 'close'))
  const before = lists
  await clock.advance(3_000)

  expect(reply).toBe('Subagent tree stays open.')
  expect(lists).toBeGreaterThan(before)
})

test('a close the engine carried out stops the timer even when no hook says so', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let lists = 0
  let isClosed = false
  engine(
    on,
    () => {
      lists += 1
      return [subagent('a')]
    },
    () => (isClosed ? [] : [OPEN_PANE]),
  )
  let pane: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  on('ui.invalidate', async () => {
    await pane?.redraw()
    return { value: undefined }
  })
  on('ui.close', () => {
    isClosed = true
    return { value: undefined }
  })

  pane = await $.ui.mount(PANE('terminal'))
  await run($, 'close')
  const before = lists
  await clock.advance(3_000)

  expect(lists).toBe(before)
})

test('a pane the engine no longer lists stops the timer at the next tick, not after the stale limit', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let lists = 0
  let panes: (typeof OPEN_PANE)[] = [OPEN_PANE]
  engine(
    on,
    () => {
      lists += 1
      return [subagent('a')]
    },
    () => panes,
  )
  let pane: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  on('ui.invalidate', async () => {
    await pane?.redraw()
    return { value: undefined }
  })

  pane = await $.ui.mount(PANE('terminal'))
  await clock.advance(2_000)
  panes = []
  await clock.advance(1_000)
  const before = lists
  await clock.advance(3_000)

  expect(lists).toBe(before)
})

test('when the engine cannot list panes, the stale limit still stops a pane nothing draws', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let lists = 0
  engine(
    on,
    () => {
      lists += 1
      return [subagent('a')]
    },
    null,
  )
  on('ui.invalidate', () => ({ value: undefined }))

  await $.ui.mount(PANE('terminal'))
  await clock.advance(20_000)
  const settled = lists
  await clock.advance(30_000)

  expect(lists).toBe(settled)
})

test('when the engine cannot list panes, /agents-tree close still stops the timer', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let lists = 0
  engine(
    on,
    () => {
      lists += 1
      return [subagent('a')]
    },
    null,
  )
  let pane: Awaited<ReturnType<typeof $.ui.mount>> | undefined
  on('ui.invalidate', async () => {
    await pane?.redraw()
    return { value: undefined }
  })
  on('ui.close', () => ({ value: undefined }))

  pane = await $.ui.mount(PANE('terminal'))
  expect(text(await run($, 'close'))).toBe('Subagent tree closed.')
  const before = lists
  await clock.advance(3_000)

  expect(lists).toBe(before)
})
