import { expect, test } from 'claude-code/testing'
import type { AgentSpawnInput } from 'claude-code'
import { anyRouteApplies, factsOf, precheck, resolve } from './decide'

const base = { mode: 'route', standingDown: false, spawnerWasRouted: false, isFork: false, isResume: false,
  isTeammate: false, isWorkflow: false, byOtherPlugin: false, isBuiltIn: true, subagentType: 'Explore', hasExplicitModel: false } as const

test('an in-scope spawn goes to the picker', async () => {
  expect(precheck(base)).toBe('pick')
  expect(precheck({ ...base, subagentType: 'general-purpose' })).toBe('pick')
  expect(precheck({ ...base, mode: 'observe' })).toBe('pick')
})

test('a spawn under a routed agent is refused whatever the mode, except a fork or a resume', async () => {
  for (const mode of ['route', 'observe', 'off'] as const)
    expect(precheck({ ...base, mode, spawnerWasRouted: true })).toBe('deny')
  expect(precheck({ ...base, standingDown: true, spawnerWasRouted: true })).toBe('deny')
  expect(precheck({ ...base, spawnerWasRouted: true, subagentType: 'feature-dev:code-explorer', isBuiltIn: false })).toBe('deny')
  expect(precheck({ ...base, spawnerWasRouted: true, hasExplicitModel: true })).toBe('deny')
  for (const k of ['isTeammate', 'isWorkflow', 'byOtherPlugin'] as const) expect(precheck({ ...base, spawnerWasRouted: true, [k]: true })).toBe('deny')
  expect(precheck({ ...base, spawnerWasRouted: true, isFork: true })).toBe('pass')
  expect(precheck({ ...base, spawnerWasRouted: true, isResume: true })).toBe('pass')
})

test('everything out of scope passes through', async () => {
  expect(precheck({ ...base, mode: 'off' })).toBe('pass')
  expect(precheck({ ...base, standingDown: true })).toBe('pass')
  for (const k of ['isFork', 'isResume', 'isTeammate', 'isWorkflow', 'byOtherPlugin'] as const)
    expect(precheck({ ...base, [k]: true })).toBe('pass')
  expect(precheck({ ...base, isBuiltIn: false })).toBe('pass')
  expect(precheck({ ...base, subagentType: 'Plan' })).toBe('pass')
})

test('an explicit model is left alone', async () => {
  expect(precheck({ ...base, hasExplicitModel: true })).toBe('explicit')
})

const routes = { locating: 'haiku', reading: 'parent' } as const
const both = { locating: 'haiku', reading: 'sonnet' } as const

test('locating is routed below an Opus baseline', async () => {
  expect(resolve('locating', routes, 'claude-opus-5-5')).toEqual({ action: 'route', target: 'haiku' })
})

test('other never routes, and a route set to parent is off', async () => {
  expect(resolve('other', routes, 'claude-opus-5-5')).toEqual({ action: 'unchanged', reason: 'other' })
  expect(resolve('reading', routes, 'claude-opus-5-5')).toEqual({ action: 'unchanged', reason: 'route-off' })
  expect(resolve('reading', both, 'claude-opus-5-5')).toEqual({ action: 'route', target: 'sonnet' })
})

test('nothing routes without a baseline, or at or above it', async () => {
  expect(resolve('locating', routes, undefined)).toEqual({ action: 'unchanged', reason: 'baseline-unknown' })
  expect(resolve('locating', routes, 'some-new-model')).toEqual({ action: 'unchanged', reason: 'baseline-unrecognised' })
  expect(resolve('locating', routes, 'claude-haiku-5-5')).toEqual({ action: 'unchanged', reason: 'not-cheaper' })
  expect(resolve('reading', both, 'claude-sonnet-5-5')).toEqual({ action: 'unchanged', reason: 'not-cheaper' })
  expect(resolve('reading', both, 'claude-haiku-5-5')).toEqual({ action: 'unchanged', reason: 'not-cheaper' })
})

test('the kind and the route are checked before the baseline', async () => {
  expect(resolve('other', routes, undefined)).toEqual({ action: 'unchanged', reason: 'other' })
  expect(resolve('reading', routes, undefined)).toEqual({ action: 'unchanged', reason: 'route-off' })
})

test('whether any route can apply', async () => {
  expect(anyRouteApplies(routes, 'claude-opus-5-5')).toBe(true)
  expect(anyRouteApplies(routes, 'claude-haiku-5-5')).toBe(false)
  expect(anyRouteApplies(routes, undefined)).toBe(false)
  expect(anyRouteApplies({ locating: 'parent', reading: 'parent' }, 'claude-opus-5-5')).toBe(false)
  expect(anyRouteApplies({ locating: 'parent', reading: 'sonnet' }, 'claude-opus-5-5')).toBe(true)
})

const ENGINE = { plugin: 'engine', tier: 'core' } as const
// As a session delivers it: model, cwd and name are keys even when unset.
const event: AgentSpawnInput = {
  tool_use_id: 'toolu_1', prompt: 'find callers of ParseMap', description: 'find callers', subagentType: 'Explore',
  provider: ENGINE, parentModel: 'claude-opus-5-5', background: false, fork: false, model: undefined, cwd: undefined, name: undefined,
}
const known = { mode: 'route', standingDown: false, spawnerWasRouted: false } as const

test('an engine spawn of a built-in agent is in scope', async () => {
  const facts = factsOf(event, ENGINE, known)
  expect(facts).toEqual({ ...known, isFork: false, isResume: false, isTeammate: false, isWorkflow: false,
    byOtherPlugin: false, isBuiltIn: true, subagentType: 'Explore', hasExplicitModel: false })
  expect(precheck(facts)).toBe('pick')
})

test('the same spawn raised by another plugin is passed on', async () => {
  const facts = factsOf(event, { plugin: 'other', tier: 'user' }, known)
  expect(facts.byOtherPlugin).toBe(true)
  expect(precheck(facts)).toBe('pass')
})

test("a spawn under the router's own name is not another plugin's", async () => {
  expect(factsOf(event, { plugin: 'subagent-router', tier: 'user' }, known).byOtherPlugin).toBe(false)
})

test('an event with no provider, or an agent type that is not text, is out of scope and nothing throws', async () => {
  const noProvider = factsOf({ ...event, provider: undefined as never }, ENGINE, known)
  expect(noProvider.isBuiltIn).toBe(false)
  expect(precheck(noProvider)).toBe('pass')
  const notText = factsOf({ ...event, subagentType: 7 as never }, ENGINE, known)
  expect(notText.subagentType).toBe('')
  expect(precheck(notText)).toBe('pass')
})

test('resume, workflow, teammate and fork each set their flag', async () => {
  expect(factsOf({ ...event, resume: { agentId: 'a9' } }, ENGINE, known).isResume).toBe(true)
  expect(factsOf({ ...event, workflow: { runId: 'wf_1', agentIndex: 1 } }, ENGINE, known).isWorkflow).toBe(true)
  expect(factsOf({ ...event, isTeammate: true }, ENGINE, known).isTeammate).toBe(true)
  expect(factsOf({ ...event, fork: true }, ENGINE, known).isFork).toBe(true)
  const plain = factsOf(event, ENGINE, known)
  expect([plain.isResume, plain.isWorkflow, plain.isTeammate, plain.isFork]).toEqual([false, false, false, false])
})

test('only a resume naming an agent id is a resume', async () => {
  for (const resume of [null, '', false, {}, { agentId: '' }, { agentId: 7 }, 'a9'])
    expect(factsOf({ ...event, resume: resume as never }, ENGINE, known).isResume).toBe(false)
  expect(factsOf({ ...event, resume: { agentId: 'a9' } }, ENGINE, known).isResume).toBe(true)
})

test('an unset model is not explicit, whether undefined or null, and a named one is', async () => {
  expect(factsOf({ ...event, model: undefined }, ENGINE, known).hasExplicitModel).toBe(false)
  expect(factsOf({ ...event, model: null as never }, ENGINE, known).hasExplicitModel).toBe(false)
  expect(factsOf({ ...event, model: 'sonnet' }, ENGINE, known).hasExplicitModel).toBe(true)
})

test('what the hook already knows is carried through', async () => {
  const facts = factsOf(event, ENGINE, { mode: 'off', standingDown: true, spawnerWasRouted: true })
  expect([facts.mode, facts.standingDown, facts.spawnerWasRouted]).toEqual(['off', true, true])
})
