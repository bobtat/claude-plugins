import { expect, test } from 'claude-code/testing'
import type { DecisionRecord, Settings } from '../types'
import { renderReport } from './report'

const rec = (over: Partial<DecisionRecord> = {}): DecisionRecord => ({ v: 1, at: 1, agentType: 'Explore', description: 'find callers',
  kind: 'locating', outcome: 'would-route', reason: 'locating', target: 'haiku', overridden: false, started: 'claude-opus-5-5',
  ran: 'claude-opus-5-5', agentId: 'a1', tokens: { input: 100, output: 10, cacheRead: 1000, cacheWrite: 0 }, usd: 0.22, ...over })
const settings = (over: Partial<Settings> = {}): Settings => ({ mode: 'observe', routes: { locating: 'haiku', reading: 'parent' }, standingDown: null, notes: [], ...over })
const show = (records: unknown[], over = {}) => renderReport({ settings: settings(), records, outOfScope: 0, wouldRefuse: 0, routeOff: [], pickerOff: false, ...over })

test('an empty session says so and names the mode', async () => {
  const out = show([])
  expect(out.includes('mode: observe')).toBe(true)
  expect(out.includes('No subagent spawns in scope yet.')).toBe(true)
})

test('totals are per picked kind, with runs, routed runs and estimated cost', async () => {
  const out = show([rec(), rec({ agentId: 'a2', usd: 0.20 }),
    rec({ kind: 'reading', outcome: 'unchanged', reason: 'route-off', target: null, usd: 1.10 }),
    rec({ kind: 'other', outcome: 'unchanged', reason: 'other', target: null, usd: 2 }),
    rec({ kind: null, outcome: 'unchanged', reason: 'explicit', target: null, usd: null })], { outOfScope: 7, wouldRefuse: 1 })
  expect(out.includes('locating: 2 run(s), 2 would be routed, estimated cost $0.42')).toBe(true)
  expect(out.includes('reading: 1 run(s), 0 would be routed (route is off), estimated cost $1.10')).toBe(true)
  expect(out.includes('other: 1 run(s), never routed, estimated cost $2.00')).toBe(true)
  expect(out.includes('In scope: 5 of 12 spawns')).toBe(true)
  expect(out.includes('Spawns the no-spawn rule would have refused: 1')).toBe(true)
})

test('route mode says routed, and a run with no price shows tokens', async () => {
  const out = renderReport({ settings: settings({ mode: 'route' }), outOfScope: 0, wouldRefuse: 0, routeOff: [], pickerOff: false,
    records: [rec({ outcome: 'routed', started: 'haiku', ran: 'made-up', usd: null })] })
  expect(out.includes('locating: 1 run(s), 1 routed, cost not priced')).toBe(true)
  expect(out.includes('1,110 tokens')).toBe(true)
})

test('each record is one row with its type, kind, outcome, reason, model and description', async () => {
  const out = show([rec({ outcome: 'routed', started: 'haiku', overridden: true, description: 'find the parser' })])
  const row = out.split('\n').find(l => l.includes('find the parser'))!
  for (const part of ['Explore', 'locating', 'routed', 'haiku', 'overridden']) expect(row.includes(part)).toBe(true)
})

test('nothing a record holds can add a row or a control character', async () => {
  const clean = show([rec()]).split('\n').length
  const out = show([rec({ description: 'x\u001b[2J\ny', agentType: 'x\u001b[2J\ny' as never, started: 'm\u202E\nz', reason: 'r\nq', agentId: 'a\nb' })])
  expect(out.includes('\u001b')).toBe(false)
  expect(out.includes('\u202E')).toBe(false)
  expect(out.split('\n').length).toBe(clean)
  expect(out.includes('x[2J y')).toBe(true)
  const long = show([rec({ description: 'd'.repeat(10000) })])
  expect(long.split('\n').every(l => Array.from(l).length <= 240)).toBe(true)
})

test('standing down, bad settings, a route that turned itself off and a stopped picker are each explained', async () => {
  const out = renderReport({ settings: settings({ mode: 'route', standingDown: 'CLAUDE_CODE_SUBAGENT_MODEL_FORCE is set', notes: ['locatingRoute "off" is not recognised; that route is off'] }),
    records: [], outOfScope: 0, wouldRefuse: 0, routeOff: ['locating'], pickerOff: true })
  expect(out.includes('CLAUDE_CODE_SUBAGENT_MODEL_FORCE is set')).toBe(true)
  expect(out.includes('locatingRoute "off" is not recognised')).toBe(true)
  expect(out.includes('The locating route is off for this session')).toBe(true)
  expect(out.includes('The picker is off for this session')).toBe(true)
})

test('runs left alone while the baseline was being learned are counted', async () => {
  const out = show([rec({ outcome: 'unchanged', reason: 'baseline-unknown', target: null }), rec()])
  expect(out.includes('locating: 2 run(s), 1 would be routed')).toBe(true)
  expect(out.includes('Left alone while the baseline was learned: 1')).toBe(true)
})

test('a record that never started is shown as not started', async () => {
  const row = show([rec({ started: null, agentId: null, description: 'find the lexer' })]).split('\n').find(l => l.includes('find the lexer'))!
  expect(row.includes('not started')).toBe(true)
})

test('a record left by another version of the mod is skipped and counted', async () => {
  const out = show([{ at: 1, type: 'Explore', picked: 'haiku' }, null, 'x', rec()])
  expect(out.includes('locating: 1 run(s), 1 would be routed')).toBe(true)
  expect(out.includes('3 record(s) from another version skipped')).toBe(true)
})

test('a record whose cost or tokens are not numbers prints no NaN and does not throw', async () => {
  const out = show([rec({ usd: Number.NaN as never, tokens: { input: 'x' } as never, description: 'find the bad one' })])
  expect(out.includes('NaN')).toBe(false)
  expect(out.includes('find the bad one')).toBe(true)
  expect(out.includes('locating: 1 run(s), 1 would be routed, cost not priced')).toBe(true)
})

test('a name field holding an object, a list or a number prints nothing in its place', async () => {
  const clean = show([rec()]).split('\n').length
  const out = show([rec({ agentType: { a: 1 } as never, started: ['x', 'y'] as never, reason: 7 as never, agentId: {} as never, description: 'find the odd one' })])
  expect(out.split('\n').length).toBe(clean)
  expect(out.includes('[object Object]')).toBe(false)
  expect(out.includes('x,y')).toBe(false)
  const row = out.split('\n').find(l => l.includes('find the odd one'))!
  expect(row.includes('not started')).toBe(true)
})

test('sums too large to print in plain digits are never shown as Infinity, NaN or exponent form', async () => {
  const out = show([rec({ usd: Number.MAX_VALUE }), rec({ usd: Number.MAX_VALUE }),
    rec({ usd: null, tokens: { input: 1e21, output: 0, cacheRead: 0, cacheWrite: 0 } }), rec({ kind: 'reading', usd: 1e21 })], { outOfScope: 1e21 })
  for (const bad of ['Infinity', 'NaN', 'e+']) expect(out.includes(bad)).toBe(false)
  expect(out.includes('locating: 3 run(s), 3 would be routed, cost not priced')).toBe(true)
})
