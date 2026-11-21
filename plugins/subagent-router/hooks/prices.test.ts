import { expect, test } from 'claude-code/testing'
import { PRICES, estimateUsd, isConfirmedCheaper, priceOf, tokenCount } from './prices'

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

test('older versions are priced only where the bundled reference lists them', async () => {
  expect(priceOf('claude-opus-4-8')).toEqual({ input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 })
  expect(priceOf('claude-fable-5-1')).toEqual({ input: 10, output: 50, cacheRead: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20 })
  expect(priceOf('claude-mythos-5-1')).toEqual(priceOf('claude-fable-5-1'))
  for (const unlisted of ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-1-20250805']) expect(priceOf(unlisted)).toBe(undefined)
})

test('no key is listed after a shorter key it contains', async () => {
  const keys = PRICES.map(([key]) => key)
  keys.forEach((key, i) => {
    for (const earlier of keys.slice(0, i)) expect(key.includes(earlier)).toBe(false)
  })
})

test('a start is confirmed cheaper by listed price where both are listed, and by family only for haiku', async () => {
  expect(isConfirmedCheaper('claude-sonnet-5-5', 'claude-opus-5-5', 'sonnet')).toBe(true)
  // Opus 4.8 lists lower input and output than Fable 5.2 but dearer cache reads, which most subagent tokens are.
  expect(isConfirmedCheaper('claude-opus-4-8', 'claude-fable-5-2', 'opus')).toBe(false)
  expect(isConfirmedCheaper('claude-opus-5-5', 'claude-fable-5-2', 'opus')).toBe(true)
  // Priced as Opus 5.5, but naming two families: an unreadable start is never confirmed.
  expect(isConfirmedCheaper('claude-opus-5-5-sonnet', 'claude-fable-5-2', 'opus')).toBe(false)
  expect(isConfirmedCheaper('claude-sonnet-5-5', 'claude-sonnet-5-5', 'sonnet')).toBe(false)
  expect(isConfirmedCheaper('claude-haiku-4-5', 'claude-opus-5-5', 'haiku')).toBe(true)
  expect(isConfirmedCheaper('haiku', 'claude-opus-5-5', 'haiku')).toBe(true)
  expect(isConfirmedCheaper('claude-sonnet-4-6', 'claude-opus-5-5', 'sonnet')).toBe(false)
  expect(isConfirmedCheaper('claude-sonnet-4-6', 'claude-opus-5-5', 'haiku')).toBe(false)
  expect(isConfirmedCheaper('fast', 'claude-opus-5-5', 'haiku')).toBe(false)
  expect(isConfirmedCheaper(undefined, 'claude-opus-5-5', 'haiku')).toBe(false)
  expect(isConfirmedCheaper('claude-haiku-4-5', 'claude-haiku-5-5', 'haiku')).toBe(false)
})

test('where both prices are given, a start is confirmed cheaper only when input and output cost less and no cache price is higher', async () => {
  const at = (input: number, output: number, cache: Partial<{ cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }> = {}) =>
    ({ input, output, cacheRead: 0.1, cacheWrite5m: 1, cacheWrite1h: 2, ...cache })
  const lookup = (table: Record<string, ReturnType<typeof at>>) => (id: string) => table[id]
  const check = (started: ReturnType<typeof at>, baseline: ReturnType<typeof at>) =>
    isConfirmedCheaper('claude-sonnet-x', 'claude-opus-x', 'sonnet', lookup({ 'claude-sonnet-x': started, 'claude-opus-x': baseline }))
  // Sonnet ranks below Opus by family, but these prices make it the dearer of the two.
  expect(check(at(6, 30), at(5, 25))).toBe(false)
  expect(check(at(5, 25), at(5, 25))).toBe(false)
  expect(check(at(4, 30), at(5, 25))).toBe(false)
  expect(check(at(4, 20), at(5, 25))).toBe(true)
  // Equal cache prices still confirm; one dearer cache price alone does not.
  expect(check(at(4, 20, { cacheRead: 0.1, cacheWrite5m: 1, cacheWrite1h: 2 }), at(5, 25))).toBe(true)
  expect(check(at(4, 20, { cacheRead: 0.2 }), at(5, 25))).toBe(false)
  expect(check(at(4, 20, { cacheWrite5m: 1.5 }), at(5, 25))).toBe(false)
  expect(check(at(4, 20, { cacheWrite1h: 3 }), at(5, 25))).toBe(false)
})

test('a key matches only where a word starts in the id', async () => {
  expect(priceOf('xopus-5-5')).toBe(undefined)
  expect(priceOf('claude-opus-affable-5-1')).toBe(undefined)
  const opus55 = PRICES.find(([key]) => key === 'opus-5-5')?.[1]
  expect(opus55 !== undefined).toBe(true)
  for (const id of ['claude-opus-5-5', 'us.anthropic.claude-opus-5-5-v1:0', 'claude-opus-5-5[1m]']) expect(priceOf(id)).toEqual(opus55)
})

test('an id that two listed keys claim has no price', async () => {
  for (const id of ['opus-4-8/claude-haiku-5-5', 'claude-opus-5-5-via-haiku-5-5']) expect(priceOf(id)).toBe(undefined)
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
