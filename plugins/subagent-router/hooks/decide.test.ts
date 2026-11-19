import { expect, test } from 'claude-code/testing'
import { anyRouteApplies, precheck, resolve } from './decide'

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
  expect(resolve('locating', routes, 'some-new-model')).toEqual({ action: 'unchanged', reason: 'baseline-unknown' })
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
