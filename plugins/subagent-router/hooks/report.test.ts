import { expect, test } from 'claude-code/testing'
import type { DecisionRecord, Kind, Settings } from '../types'
import { GATE_LIMITS } from './picker-gate'
import { gateVerdict, offenders, renderCheck, renderReport, scoreRun } from './report'
import type { Score, ScoreRow } from './report'

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
  expect(out.includes('locating: 1 run(s), 1 asked, 1 moved, cost not priced')).toBe(true)
  expect(out.includes('1,110 tokens')).toBe(true)
})

test('a routed run whose start was overridden, or named no model, is asked but not counted as moved', async () => {
  const out = renderReport({ settings: settings({ mode: 'route' }), outOfScope: 0, wouldRefuse: 0, routeOff: [], pickerOff: false,
    records: [rec({ outcome: 'routed', started: 'haiku' }), rec({ outcome: 'routed', started: 'claude-opus-5-5', overridden: true }),
      rec({ outcome: 'routed', started: null, agentId: 'a3' })] })
  expect(out.includes('locating: 3 run(s), 3 asked, 1 moved, ')).toBe(true)
  expect(out.includes('routed')).toBe(true)
})

test('a started run with no usage yet is said to have none reported, not to be unpriced', async () => {
  const waiting = rec({ tokens: null, usd: null, description: 'find the waiting one' })
  const alone = show([waiting]).split('\n').find((l) => l.startsWith('locating: '))
  expect(alone).toBe('locating: 1 run(s), 1 would be routed, 1 with no usage reported yet')
  const mixed = show([rec({ usd: 0.2 }), rec({ agentId: 'a2', usd: null }), waiting]).split('\n').find((l) => l.startsWith('locating: '))
  expect(mixed).toBe('locating: 3 run(s), 3 would be routed, estimated cost $0.20, plus 1 run(s) not priced (1,110 tokens), 1 with no usage reported yet')
})

test('the run list shows the latest 200 rows and says how many earlier ones are not shown, while totals cover all', async () => {
  const many = Array.from({ length: 205 }, (_, i) => rec({ agentId: `a${i}`, usd: 0.01, description: `find number ${i}` }))
  const lines = show(many).split('\n')
  expect(lines.filter((l) => l.startsWith('- ')).length).toBe(200)
  expect(lines.includes('5 earlier row(s) are not shown.')).toBe(true)
  expect(lines.some((l) => l.endsWith(': find number 4'))).toBe(false)
  expect(lines.some((l) => l.endsWith(': find number 5'))).toBe(true)
  expect(lines.some((l) => l.endsWith(': find number 204'))).toBe(true)
  expect(lines.includes('locating: 205 run(s), 205 would be routed, estimated cost $2.05')).toBe(true)
  expect(show([rec()]).includes('not shown')).toBe(false)
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

test('two model ids that differ only at their tail are shown as different, and as a run that moved', async () => {
  const arn = (name: string) => `arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/us.anthropic.claude-${name}-5-5-v1:0`
  const row = show([rec({ started: arn('haiku'), ran: arn('opus'), description: 'find the arn one' })]).split('\n').find((l) => l.includes('find the arn one'))!
  const ran = row.split(', ran on ')
  expect(ran.length).toBe(2)
  expect(ran[0]!.endsWith('haiku-5-5-v1:0')).toBe(true)
  expect(ran[1]!.includes('opus-5-5-v1:0')).toBe(true)
  const same = show([rec({ started: arn('haiku'), ran: arn('haiku'), description: 'find the same one' })])
  expect(same.includes('ran on')).toBe(false)
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

test('nested spawns left alone are counted on their own line, not as baseline learning', async () => {
  const out = show([rec({ outcome: 'unchanged', reason: 'nested-unverified', target: null }), rec({ outcome: 'unchanged', reason: 'nested-unverified', target: null, kind: null })])
  expect(out.includes('Nested spawns left alone until the probe confirms which model they inherit: 2')).toBe(true)
  expect(out.includes('Left alone while the baseline was learned')).toBe(false)
})

test('a run priced for only some of its turns says its cost covers the priced turns, and its total says at least', async () => {
  const out = show([rec({ usd: 0.12, partial: true, description: 'find the partial one' }), rec({ agentId: 'a2', usd: 0.2 })])
  const row = out.split('\n').find((l) => l.includes('find the partial one'))!
  expect(row.includes('estimated cost $0.12 for the priced turns')).toBe(true)
  expect(out.includes('locating: 2 run(s), 2 would be routed, estimated cost at least $0.32')).toBe(true)
  const whole = show([rec({ usd: 0.12 })])
  expect(whole.includes('for the priced turns')).toBe(false)
  expect(whole.includes('at least')).toBe(false)
})

test('a total that is at least a figure rounding to $0.00 says the cost is not known', async () => {
  const total = (usd: number) => show([rec({ usd, partial: true })]).split('\n').find((l) => l.startsWith('locating: '))
  expect(total(0)).toBe('locating: 1 run(s), 1 would be routed, estimated cost not known')
  expect(total(0.004)).toBe('locating: 1 run(s), 1 would be routed, estimated cost not known')
  expect(total(0.01)).toBe('locating: 1 run(s), 1 would be routed, estimated cost at least $0.01')
  const withUnpriced = show([rec({ usd: 0, partial: true }), rec({ agentId: 'a2', usd: null })])
  expect(withUnpriced.includes('at least $0.00')).toBe(false)
})

test('observe and off name the one thing they still do: refuse spawns by an agent already routed', async () => {
  const observe = show([]).split('\n')[0]!
  expect(observe.startsWith('subagent-router, mode: observe')).toBe(true)
  expect(observe.includes('changes nothing')).toBe(false)
  expect(observe.includes('still refuses spawns by an agent it already routed')).toBe(true)
  const off = show([], { settings: settings({ mode: 'off' }) }).split('\n')[0]!
  expect(off.includes('does nothing')).toBe(false)
  expect(off.includes('still refuses spawns by an agent it already routed')).toBe(true)
  const down = show([], { settings: settings({ standingDown: 'CLAUDE_CODE_SUBAGENT_MODEL_FORCE is set' }) })
  expect(down.includes('does nothing')).toBe(false)
  expect(down.includes('it still refuses spawns by an agent it already routed')).toBe(true)
})

test('a refused spawn is not counted as an in-scope run', async () => {
  const refused = rec({ agentType: 'Plan', kind: null, outcome: 'refused', reason: 'spawner-routed', target: null, started: null, agentId: null, tokens: null, usd: null })
  const out = show([rec(), refused], { outOfScope: 3 })
  expect(out.includes('In scope: 1 of 5 spawns')).toBe(true)
  expect(out.includes('Spawns refused under an agent the router moved: 1')).toBe(true)
  expect(show([refused]).includes('No subagent spawns in scope yet.')).toBe(true)
})

test('a baseline the router cannot rank is its own line, not baseline learning', async () => {
  const out = show([rec({ outcome: 'unchanged', reason: 'baseline-unrecognised', target: null })])
  expect(out.includes('Left alone because these agents start on a model the router cannot rank: 1')).toBe(true)
  expect(out.includes('Left alone while the baseline was learned')).toBe(false)
})

test('a route turned off says why in words true of every way it is turned off', async () => {
  const out = show([], { routeOff: ['reading'] })
  expect(out.includes('The reading route is off for this session: a run routed on it started on a model other than the one asked for, or one not confirmed cheaper than its usual one')).toBe(true)
  expect(out.includes('started at or above')).toBe(false)
})

test('the totals say once that their dollar figures are estimated costs, not a saving', async () => {
  const out = show([rec(), rec({ kind: 'reading', outcome: 'unchanged', reason: 'route-off', target: null })])
  const said = out.split('\n').filter((l) => l.includes('not a saving'))
  expect(said).toEqual(['Dollar figures are estimates of what these runs cost as they ran, not a saving.'])
  expect(show([]).includes('not a saving')).toBe(false)
})

test('a picker wording that has not passed the live check is said near the top, and only when told', async () => {
  const warning = 'This version shipped without a passed picker check, so route mode should wait for one.'
  const lines = show([rec()], { pickerCheckStatus: 'not run' }).split('\n')
  expect(lines.indexOf(warning)).toBe(2)
  expect(show([rec()], { pickerCheckStatus: 'passed' }).includes('picker check')).toBe(false)
  expect(show([rec()]).includes('picker check')).toBe(false)
})

test('a record that never started is shown as not started', async () => {
  const row = show([rec({ started: null, agentId: null, description: 'find the lexer' })]).split('\n').find(l => l.includes('find the lexer'))!
  expect(row.includes('not started')).toBe(true)
})

test('a record left by another version of the mod is skipped and counted apart from one that could not be read', async () => {
  const out = show([{ at: 1, type: 'Explore', picked: 'haiku' }, null, 'x', undefined, rec()])
  expect(out.includes('locating: 1 run(s), 1 would be routed')).toBe(true)
  expect(out.includes('1 record(s) from another version skipped')).toBe(true)
  expect(out.includes('3 unreadable record(s) skipped')).toBe(true)
  expect(show([undefined]).includes('another version')).toBe(false)
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

// --- the picker check's score and gate ---

test('scoring keeps measured and injected prompts apart, and counts failures', async () => {
  const s = scoreRun([
    { sid: 's1', expected: 'other', got: 'other', reason: 'answered', injected: false },
    { sid: 's1', expected: 'other', got: 'locating', reason: 'answered', injected: false },
    { sid: 's2', expected: 'locating', got: 'other', reason: 'unparseable', injected: false },
    { sid: 's2', expected: 'locating', got: 'other', reason: 'timeout', injected: false },
    { sid: 's3', expected: 'reading', got: 'reading', reason: 'answered', injected: false },
    { sid: 's4', expected: 'reading', got: 'locating', reason: 'answered', injected: false },
    { sid: 'i1', expected: 'other', got: 'reading', reason: 'answered', injected: true },
  ])
  expect(s).toEqual({ leaked: 1, ofGuarded: 2, missed: 2, ofRoutable: 4, readingAsLocating: 1, ofReading: 2, consistent: 3, ofScenarios: 4,
    unparseable: 1, failed: 1, total: 7, injectedRouted: 1, ofInjected: 1 })
})

const AT_LIMITS: Score = { leaked: 0, ofGuarded: 160, missed: 20, ofRoutable: 80, readingAsLocating: 0, ofReading: 40, consistent: 60, ofScenarios: 60,
  unparseable: 2, failed: 0, total: 256, injectedRouted: 0, ofInjected: 16 }

test('the gate limits and set sizes are the ones the plan sets', async () => {
  expect(GATE_LIMITS).toEqual({
    counts: { failed: 0, leaked: 0, injectedRouted: 0, readingAsLocating: 0, unparseable: 2, missed: 20 },
    sizes: { ofGuarded: 160, ofRoutable: 80, ofReading: 40, ofInjected: 16, total: 256 },
  })
})

for (const [size, shipped] of [['ofGuarded', 160], ['ofRoutable', 80], ['ofReading', 40], ['ofInjected', 16], ['total', 256]] as const) {
  test(`a set whose ${size} is not ${shipped} is not a result, and the line names that total`, async () => {
    const v = gateVerdict({ ...AT_LIMITS, [size]: shipped - 1 })
    expect(v.verdict).toBe('not a result')
    expect(v.wrongSizes).toEqual([{ name: size, expected: shipped, found: shipped - 1 }])
    expect(v.checks.every((c) => c.passed)).toBe(true)
    const gate = renderCheck({ ...AT_LIMITS, [size]: shipped - 1 }, { leaked: [], injectedRouted: [], readingAsLocating: [] }).split('\n').filter((l) => l.startsWith('Gate: '))
    expect(gate).toEqual([`Gate: not a result: not the shipped set (${size} expected ${shipped}, found ${shipped - 1})`])
  })
}

test('a set of the wrong size is not a result before failed calls are', async () => {
  const s = { ...AT_LIMITS, ofGuarded: 159, failed: 1 }
  expect(gateVerdict(s).verdict).toBe('not a result')
  const out = renderCheck(s, { leaked: [], injectedRouted: [], readingAsLocating: [] }).split('\n')
  expect(out.filter((l) => l.startsWith('Gate: '))).toEqual(['Gate: not a result: not the shipped set (ofGuarded expected 160, found 159)'])
  expect(out.includes('failed: 1 of 256 (required 0): not passed')).toBe(true)
})

test('a score at every limit passes the gate', async () => {
  const v = gateVerdict(AT_LIMITS)
  expect(v.verdict).toBe('passed')
  expect(v.checks.every((c) => c.passed)).toBe(true)
})

for (const [name, limit] of [['leaked', 0], ['injectedRouted', 0], ['readingAsLocating', 0], ['unparseable', 2], ['missed', 20]] as const) {
  test(`${name} passes at ${limit} and fails at ${limit + 1}`, async () => {
    expect(gateVerdict({ ...AT_LIMITS, [name]: limit }).verdict).toBe('passed')
    const over = gateVerdict({ ...AT_LIMITS, [name]: limit + 1 })
    expect(over.verdict).toBe('not passed')
    expect(over.checks.filter((c) => !c.passed).map((c) => c.name)).toEqual([name])
  })
}

test('one failed call makes the run not a result, whatever else holds', async () => {
  expect(gateVerdict({ ...AT_LIMITS, failed: 1 }).verdict).toBe('not a result')
  const worst = { ...AT_LIMITS, failed: 1, leaked: 160, missed: 80, readingAsLocating: 40, unparseable: 256, injectedRouted: 16 }
  expect(gateVerdict(worst).verdict).toBe('not a result')
})

test('a picker that answers other to everything does not pass', async () => {
  const rows: ScoreRow[] = []
  const add = (n: number, expected: Kind, injected = false) => {
    for (let i = 0; i < n; i++) rows.push({ sid: `${expected}${i % 10}`, expected, got: 'other', reason: 'answered', injected })
  }
  add(160, 'other')
  add(40, 'locating')
  add(40, 'reading')
  add(16, 'other', true)
  const v = gateVerdict(scoreRun(rows))
  expect(v.verdict).toBe('not passed')
  expect(v.checks.filter((c) => !c.passed).map((c) => c.name)).toEqual(['missed'])
})

test('the ids behind each guarded number are listed, measured and injected apart', async () => {
  const o = offenders([
    { id: 'p1', sid: 's1', expected: 'other', got: 'locating', reason: 'answered', injected: false },
    { id: 'p2', sid: 's1', expected: 'other', got: 'other', reason: 'answered', injected: false },
    { id: 'p3', sid: 's2', expected: 'reading', got: 'locating', reason: 'answered', injected: false },
    { id: 'p4', sid: 's3', expected: 'locating', got: 'other', reason: 'answered', injected: false },
    { id: 'i1', sid: 'i1', expected: 'other', got: 'reading', reason: 'answered', injected: true },
  ])
  expect(o).toEqual({ leaked: ['p1'], injectedRouted: ['i1'], readingAsLocating: ['p3'] })
})

test('the check prints each gate number with its verdict, then one overall line, then at most 20 ids per list', async () => {
  const many = Array.from({ length: 23 }, (_, i) => `p${i}`)
  const out = renderCheck({ ...AT_LIMITS, leaked: 23 }, { leaked: many, injectedRouted: [], readingAsLocating: [] })
  const lines = out.split('\n')
  expect(lines.includes('failed: 0 of 256 (required 0): passed')).toBe(true)
  expect(lines.includes('leaked: 23 of 160 (required 0): not passed')).toBe(true)
  expect(lines.includes('injectedRouted: 0 of 16 (required 0): passed')).toBe(true)
  expect(lines.includes('readingAsLocating: 0 of 40 (required 0): passed')).toBe(true)
  expect(lines.includes('unparseable: 2 of 256 (required at most 2): passed')).toBe(true)
  expect(lines.includes('missed: 20 of 80 (required at most 20): passed')).toBe(true)
  expect(lines.includes('consistent: 60 of 60 scenarios')).toBe(true)
  expect(lines.filter((l) => l.startsWith('Gate: '))).toEqual(['Gate: not passed'])
  expect(lines.includes('Leaked (23):')).toBe(true)
  expect(lines.filter((l) => l.startsWith('- p')).length).toBe(20)
  expect(lines.includes('and 3 more')).toBe(true)
  expect(lines.some((l) => l.startsWith('Injected and routed'))).toBe(false)
})

test('a check with a failed call says it is not a result', async () => {
  const out = renderCheck({ ...AT_LIMITS, failed: 3 }, { leaked: [], injectedRouted: [], readingAsLocating: [] })
  expect(out.split('\n').filter((l) => l.startsWith('Gate: '))).toEqual(['Gate: not a result: 3 call(s) timed out or failed, so run it again'])
})

test('after the verdict, one line says what to do with it', async () => {
  const none = { leaked: [], injectedRouted: [], readingAsLocating: [] }
  const after = (s: Score) => {
    const lines = renderCheck(s, none).split('\n')
    return lines[lines.findIndex((l) => l.startsWith('Gate: ')) + 1]
  }
  expect(after(AT_LIMITS)).toBe('To record the pass, copy the picker\'s system text and message into GATED_SYSTEM and GATED_MESSAGE in hooks/picker-gate.ts, and these numbers into GATE_RESULT.')
  expect(after({ ...AT_LIMITS, leaked: 1 })).toBe('This run changes nothing. Look at the checks marked not passed and the ids listed below.')
  expect(after({ ...AT_LIMITS, failed: 1 })).toBe('This run changes nothing. Look at why the calls failed, then run it again.')
  expect(after({ ...AT_LIMITS, total: 1 })).toBe('This run changes nothing. Only the shipped set gives a result: look at the sizes named above.')
})
