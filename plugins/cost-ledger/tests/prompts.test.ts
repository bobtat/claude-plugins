import { expect, mock, test } from 'claude-code/testing'

import { addStepToTurn, finishTurn, keepTopTurns, startTurn } from '../hooks/insights'
import { addSpend, addTurn } from '../hooks/ledger'
import type { SessionEntry } from '../hooks/ledger'
import { priceUsage, rateTable, ratesFor } from '../hooks/pricing'
import { complete, DAY, engine, measure, memoryStore, NOW, PANE, ROOT, runStep, usage } from './support'

const OPUS = ratesFor(rateTable(''), 'claude-opus-5-5', 0)

// A finished prompt that cost `usd`, all of it cache writes at Opus 5.5's $5 a
// million tokens.
const prompt = (usd: number, at = NOW, text = `p${usd}`) =>
  finishTurn(addStepToTurn(startTurn('t', text, at), priceUsage(usage(0, usd * 200_000), OPUS, '5m'), false), ROOT)

// Another session's entry holding these prompts.
const sessionWith = (usds: number[], at = NOW): SessionEntry =>
  usds.reduce((entry, usd) => addTurn(entry, at, prompt(usd, at)), addSpend(undefined, at, 1, ROOT))

test('a long prompt is kept as one shortened line', async () => {
  const turn = startTurn('t', `fix   the\n${'x'.repeat(200)}`, NOW)
  expect(turn.prompt.startsWith('fix the x')).toBe(true)
  expect(turn.prompt.length).toBe(80)
})

test('each month keeps its ten most expensive prompts', async () => {
  const priced = (usd: number) => priceUsage(usage(0, usd * 200_000), OPUS, '5m')
  const turn = (at: number, usd: number) => finishTurn(addStepToTurn(startTurn('t', `p${usd}`, at), priced(usd), false), ROOT)
  const september = Array.from({ length: 12 }, (_, i) => turn(NOW - 20 * DAY, i + 1))
  const october = [turn(NOW, 0.5)]

  const kept = keepTopTurns([...september, ...october])

  expect(kept.filter(t => t.at < NOW).map(t => t.prompt)).toEqual(
    ['p12', 'p11', 'p10', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3'],
  )
  expect(kept.some(t => t.prompt === 'p0.5')).toBe(true)
})

test('a prompt is charged its requests and its subagents, and a costly one raises a toast', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts = engine(on, [usage(0, 300_000), usage(0, 200_000)])
  await $.session.measure(measure(1))

  await $.turn.start({ turnId: 't1', text: 'refactor the billing module' })
  await runStep($, 't1')
  await runStep($, 'sub-t', 'agent-1')
  await $.turn.complete(complete('t1'))

  expect(toasts.some(t => /That prompt cost ≈ \$2\.50 \(1 requests \+ 1 by subagents\): “refactor the billing module”/.test(t))).toBe(true)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ text: /\$2\.50\s+1\+1 req refactor the billing module/ })).toBeDefined()
})

test('a prompt the month\'s ten already outbid is not stored, and one that outbids them is', async ($, on) => {
  mock.clock(on, { now: NOW })
  const store = memoryStore(on, { 'session:other': sessionWith([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) })
  const toasts = engine(on, [usage(0, 500_000), usage(0, 3_000_000)])
  const stored = () => ((store.get('session:s1') as SessionEntry | undefined)?.turns ?? []).map(turn => turn.prompt)
  await $.session.measure(measure(1))

  await $.turn.start({ turnId: 't1', text: 'a cheaper prompt' })
  await runStep($, 't1')
  await $.turn.complete(complete('t1'))

  // $2.50 against a tenth place of $3: it can never be listed, so it is not kept.
  expect(stored()).toEqual([])
  expect(toasts.some(toast => toast.includes('That prompt cost ≈ $2.50'))).toBe(true)

  await $.turn.start({ turnId: 't2', text: 'a dearer prompt' })
  await runStep($, 't2')
  await $.turn.complete(complete('t2'))

  expect(stored()).toEqual(['a dearer prompt'])
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ text: /\$15\.00\s+1 req a dearer prompt/ })).toBeDefined()
  expect(await ui.find({ text: /a cheaper prompt/ })).toBeUndefined()
  // The other session's $3 prompt is tenth no longer, and is off the list.
  expect(await ui.find({ text: /1 req p4$/ })).toBeDefined()
  expect(await ui.find({ text: /1 req p3$/ })).toBeUndefined()
})

test('while a month has fewer than ten prompts every one is stored', async ($, on) => {
  mock.clock(on, { now: NOW })
  const store = memoryStore(on, { 'session:other': sessionWith([3, 4, 5, 6, 7, 8, 9, 10, 11]) })
  engine(on, [usage(0, 2_000)])
  await $.session.measure(measure(1))

  await $.turn.start({ turnId: 't1', text: 'a cent of work' })
  await runStep($, 't1')
  await $.turn.complete(complete('t1'))

  expect((store.get('session:s1') as SessionEntry).turns?.map(turn => turn.prompt)).toEqual(['a cent of work'])
})

test('a session drops its own prompts as the month\'s ten outbid them', async () => {
  const mine = sessionWith([1, 2, 20])
  const known = keepTopTurns([...(sessionWith([3, 4, 5, 6, 7, 8, 9, 10, 11]).turns ?? []), ...(mine.turns ?? [])])
  // The ten known are $3 to $11 and this session's $20: its $1 and $2 are out.
  expect(known).toHaveLength(10)

  const after = addTurn(mine, NOW, prompt(30), known)

  expect(after.turns?.map(turn => turn.prompt).sort()).toEqual(['p20', 'p30'])
  // Last month's prompts are held to last month's ten, of which there are none.
  const lastMonth = addTurn(sessionWith([1], NOW - 20 * DAY), NOW, prompt(30), known)
  expect(lastMonth.turns?.map(turn => turn.prompt).sort()).toEqual(['p1', 'p30'])
})
