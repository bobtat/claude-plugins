import type { TurnUsage } from 'claude-code'
import type { Family } from '../types'
import { familyOf, ranksBelow } from './model-rank'

export type Price = { input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }

// Dollars per million tokens, read on 2026-11-18 from the bundled claude-api skill: shared/models.md for input,
// output and cache reads, shared/prompt-caching.md for cache writes (1.25 times input for five minutes, 2 times for
// one hour). Haiku 5.5 costs five times as much for a prompt over 100,000 tokens; this table uses the base rate.
// A model that is not listed is unpriced, never guessed from a neighbour.
// Older versions, read on 2026-11-19 from the same files: Fable 5.1 and Mythos 5.1 at $10/$50 with cache reads at
// $0.25 (models.md); Opus 4.8 at $5/$25 (models.md, "Opus 4.8's pricing ($5/$25 per MTok)") with cache reads at 0.1
// times input (prompt-caching.md, "0.1x elsewhere"). Opus 5, Sonnet 5 and Fable 5 are listed there too but left out:
// their keys (opus-5) would also claim an unlisted later minor version such as opus-5-50.
// A key is never listed after a shorter key it contains, and an id that two keys claim has no price.
export const PRICES: readonly [string, Price][] = [
  ['haiku-5-5', { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 }],
  ['sonnet-5-5', { input: 2, output: 10, cacheRead: 0.1, cacheWrite5m: 2.5, cacheWrite1h: 4 }],
  ['opus-5-5', { input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5, cacheWrite1h: 8 }],
  ['opus-4-8', { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 }],
  ['fable-5-2', { input: 8, output: 40, cacheRead: 0.2, cacheWrite5m: 10, cacheWrite1h: 16 }],
  ['mythos-5-2', { input: 8, output: 40, cacheRead: 0.2, cacheWrite5m: 10, cacheWrite1h: 16 }],
  ['fable-5-1', { input: 10, output: 50, cacheRead: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20 }],
  ['mythos-5-1', { input: 10, output: 50, cacheRead: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20 }],
]

// Family rank is not a price rank across generations: an alias pinned to an older Opus can cost more than a newer
// Fable. So where both are listed the prices decide, and every one of them: subagent runs are mostly cache reads, so
// lower input and output with a dearer cache read can still cost more. Haiku is the cheapest family in every
// generation, so a Haiku start alone may be confirmed by rank when a price is missing; any other unlisted start
// cannot be confirmed. A start whose family cannot be read is never confirmed, so it always turns the route off.
export function isConfirmedCheaper(
  started: string | undefined,
  baseline: string,
  target: Family,
  price: (modelId: string) => Price | undefined = priceOf,
): boolean {
  if (started === undefined) return false
  const startedPrice = price(started)
  const baselinePrice = price(baseline)
  if (startedPrice !== undefined && baselinePrice !== undefined) {
    return (
      familyOf(started) !== undefined &&
      startedPrice.input < baselinePrice.input &&
      startedPrice.output < baselinePrice.output &&
      startedPrice.cacheRead <= baselinePrice.cacheRead &&
      startedPrice.cacheWrite5m <= baselinePrice.cacheWrite5m &&
      startedPrice.cacheWrite1h <= baselinePrice.cacheWrite1h
    )
  }
  return target === 'haiku' && familyOf(started) === 'haiku' && ranksBelow(started, baseline)
}

export function priceOf(modelId: string): Price | undefined {
  if (typeof modelId !== 'string') return undefined
  const claimed = PRICES.filter(([key]) => containsVersion(modelId, key))
  return claimed.length === 1 ? claimed[0]?.[1] : undefined
}

// A key must begin where the id does or after a character that is not a letter or digit, and end where the id does or
// at such a character, so opus-5-5 claims neither opus-5-50 nor xopus-5-5, and fable-5-1 does not claim affable-5-1.
function containsVersion(modelId: string, key: string): boolean {
  for (let at = modelId.indexOf(key); at !== -1; at = modelId.indexOf(key, at + 1)) {
    const startsWord = at === 0 || !/[A-Za-z0-9]/.test(modelId.charAt(at - 1))
    if (startsWord && !/^[A-Za-z0-9]/.test(modelId.slice(at + key.length))) return true
  }
  return false
}

export function tokenCount(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

export function estimateUsd(u: TurnUsage, p: Price): number {
  const written = tokenCount(u.cache_creation_input_tokens)
  const w5m = tokenCount(u.ephemeral_5m_input_tokens)
  const w1h = tokenCount(u.ephemeral_1h_input_tokens)
  // Writes whose lifetime was not named are priced as five-minute writes, as /cost does.
  const unnamed = Math.max(0, written - w5m - w1h)
  const dollars =
    tokenCount(u.input_tokens) * p.input +
    tokenCount(u.output_tokens) * p.output +
    tokenCount(u.cache_read_input_tokens) * p.cacheRead +
    (w5m + unnamed) * p.cacheWrite5m +
    w1h * p.cacheWrite1h
  return dollars / 1_000_000
}
