import { expect, test } from 'claude-code/testing'
import { PRICES, estimateUsd, priceOf, tokenCount } from './prices'

test('a token count is a finite, positive number, and anything else counts as zero', async () => {
  expect(tokenCount(1234)).toBe(1234)
  for (const n of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, undefined, null, '12']) expect(tokenCount(n)).toBe(0)
})

const P = { input: 10, output: 50, cacheRead: 1, cacheWrite5m: 12, cacheWrite1h: 20 }

test('the estimate prices each kind of token at its own rate', async () => {
  const u = { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 2_000_000,
    cache_creation_input_tokens: 500_000, ephemeral_5m_input_tokens: 300_000, ephemeral_1h_input_tokens: 100_000, model: 'x' }
  // 10 + 5 + 2 + (300k at 12 = 3.6) + (100k at 20 = 2) + (the unnamed 100k as five-minute = 1.2)
  expect(Math.round(estimateUsd(u, P) * 100)).toBe(2380)
})

test('cache writes with no lifetime named are priced as five-minute writes', async () => {
  const u = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 1_000_000, model: 'x' }
  expect(estimateUsd(u, P)).toBe(12)
})

test('a usage object with missing fields still gives a finite estimate', async () => {
  const u = { input_tokens: 1_000_000, model: 'x' } as unknown as Parameters<typeof estimateUsd>[0]
  expect(estimateUsd(u, P)).toBe(10)
})

test('named cache lifetimes that exceed the whole leave no negative remainder', async () => {
  const u = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 100_000,
    ephemeral_5m_input_tokens: 100_000, ephemeral_1h_input_tokens: 100_000, model: 'x' }
  // 100k at 12 + 100k at 20, with nothing taken off for the unnamed remainder
  expect(Math.round(estimateUsd(u, P) * 100)).toBe(320)
})

test('a key does not match inside a longer version number or word', async () => {
  for (const id of ['claude-opus-5-5', 'claude-opus-5-5-20261101', 'us.anthropic.claude-sonnet-5-5-v1:0', 'claude-fable-5-2[1m]']) {
    expect(priceOf(id) !== undefined).toBe(true)
  }
  expect(priceOf('claude-opus-5-50')).toBe(undefined)
  expect(priceOf('claude-opus-5-5b')).toBe(undefined)
})

test('only listed model versions have a price', async () => {
  expect(priceOf('made-up-model')).toBe(undefined)
  expect(priceOf('haiku')).toBe(undefined)
  expect(priceOf('claude-opus-9-9')).toBe(undefined)
  expect(priceOf('claude-opus-5-5')).toEqual({ input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5, cacheWrite1h: 8 })
  expect(priceOf('us.anthropic.claude-sonnet-5-5-v1:0')).toEqual({ input: 2, output: 10, cacheRead: 0.1, cacheWrite5m: 2.5, cacheWrite1h: 4 })
  expect(priceOf('claude-haiku-5-5')).toEqual({ input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 })
  expect(priceOf('claude-mythos-5-2')).toEqual(priceOf('claude-fable-5-2'))
  for (const [, p] of PRICES) {
    for (const v of Object.values(p)) expect(v > 0).toBe(true)
    expect(p.cacheRead < p.input).toBe(true)
  }
})
