import { expect, test } from 'claude-code/testing'
import { familyOf, ranksBelow } from './model-rank'

test('family is read from aliases and full ids', async () => {
  expect(familyOf('haiku')).toBe('haiku')
  expect(familyOf('Sonnet')).toBe('sonnet')
  expect(familyOf('claude-sonnet-5-5')).toBe('sonnet')
  expect(familyOf('us.anthropic.claude-opus-5-5-v1:0')).toBe('opus')
  expect(familyOf('claude-fable-5-2[1m]')).toBe('fable')
  expect(familyOf('claude-mythos-5-2')).toBe('fable')
  expect(familyOf('gpt-9')).toBe(undefined)
  expect(familyOf('')).toBe(undefined)
})

test('an id naming two families is not recognised', async () => {
  expect(familyOf('sonnet-via-opus-gateway')).toBe(undefined)
})

test('a model id that is not a string is not recognised', async () => {
  expect(familyOf(undefined as never)).toBe(undefined)
  expect(familyOf(7 as never)).toBe(undefined)
  expect(familyOf(null as never)).toBe(undefined)
})

test('cheaper-than is strict and needs both sides recognised', async () => {
  expect(ranksBelow('haiku', 'claude-opus-5-5')).toBe(true)
  expect(ranksBelow('sonnet', 'claude-sonnet-5-5')).toBe(false)
  expect(ranksBelow('opus', 'sonnet')).toBe(false)
  expect(ranksBelow('haiku', 'mystery-model')).toBe(false)
  expect(ranksBelow('mystery-model', 'opus')).toBe(false)
  expect(ranksBelow(undefined, 'opus')).toBe(false)
  expect(ranksBelow('haiku', undefined)).toBe(false)
})
