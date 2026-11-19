import type { TurnUsage } from 'claude-code'

export type Price = { input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }

// Dollars per million tokens, read on 2026-11-18 from the bundled claude-api skill: shared/models.md for input,
// output and cache reads, shared/prompt-caching.md for cache writes (1.25 times input for five minutes, 2 times for
// one hour). Haiku 5.5 costs five times as much for a prompt over 100,000 tokens; this table uses the base rate.
// A model that is not listed is unpriced, never guessed from a neighbour.
export const PRICES: readonly [string, Price][] = [
  ['haiku-5-5', { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 }],
  ['sonnet-5-5', { input: 2, output: 10, cacheRead: 0.1, cacheWrite5m: 2.5, cacheWrite1h: 4 }],
  ['opus-5-5', { input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5, cacheWrite1h: 8 }],
  ['fable-5-2', { input: 8, output: 40, cacheRead: 0.2, cacheWrite5m: 10, cacheWrite1h: 16 }],
  ['mythos-5-2', { input: 8, output: 40, cacheRead: 0.2, cacheWrite5m: 10, cacheWrite1h: 16 }],
]

export function priceOf(modelId: string): Price | undefined {
  if (typeof modelId !== 'string') return undefined
  return PRICES.find(([key]) => containsVersion(modelId, key))?.[1]
}

// A key must end where the id does or at a character that is not a letter or digit, so opus-5-5 does not claim opus-5-50.
function containsVersion(modelId: string, key: string): boolean {
  for (let at = modelId.indexOf(key); at !== -1; at = modelId.indexOf(key, at + 1)) {
    if (!/^[A-Za-z0-9]/.test(modelId.slice(at + key.length))) return true
  }
  return false
}

const count = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0)

export function estimateUsd(u: TurnUsage, p: Price): number {
  const written = count(u.cache_creation_input_tokens)
  const w5m = count(u.ephemeral_5m_input_tokens)
  const w1h = count(u.ephemeral_1h_input_tokens)
  // Writes whose lifetime was not named are priced as five-minute writes, as /cost does.
  const unnamed = Math.max(0, written - w5m - w1h)
  const dollars =
    count(u.input_tokens) * p.input +
    count(u.output_tokens) * p.output +
    count(u.cache_read_input_tokens) * p.cacheRead +
    (w5m + unnamed) * p.cacheWrite5m +
    w1h * p.cacheWrite1h
  return dollars / 1_000_000
}
