// The cache-lifetime, cold-resume and keep-alive arithmetic, free of engine
// calls so it can be tested directly. The numbers behind each rule are in
// tests/cost-ledger-probe/README.md.

import type { CacheTtl, Rates, Usage } from './pricing'

export const TTL_MS: Record<CacheTtl, number> = { '5m': 5 * 60_000, '1h': 60 * 60_000 }

// Below this many tokens written, a turn's other charges swamp the write and
// its cost says nothing about which write rate was charged.
const MIN_WRITE_FOR_TTL = 1_000

export type PricedRequest = { usage: Usage; rates: Rates }

// Which cache lifetime Claude Code charged a turn at: its requests priced with
// five-minute and with one-hour writes, set against what its running total
// moved. Undefined when the turn wrote too little to tell or neither adds up
// (a background request landing in the same interval, managed rates).
export function impliedTtl(deltaUsd: number, requests: readonly PricedRequest[]): CacheTtl | undefined {
  let base = 0
  let write5m = 0
  let write1h = 0
  let written = 0
  for (const { usage, rates } of requests) {
    base +=
      (usage.input_tokens * rates.input + usage.cache_read_input_tokens * rates.cacheRead + usage.output_tokens * rates.output) /
      1e6
    write5m += (usage.cache_creation_input_tokens * rates.cacheWrite5m) / 1e6
    write1h += (usage.cache_creation_input_tokens * rates.cacheWrite1h) / 1e6
    written += usage.cache_creation_input_tokens
  }
  if (written < MIN_WRITE_FOR_TTL) return undefined
  const near = (priced: number) => Math.abs(deltaUsd - priced) <= Math.max(0.0005, priced * 0.02)
  if (near(base + write1h)) return '1h'
  if (near(base + write5m)) return '5m'
  return undefined
}

export type ColdEstimate = { likelyTokens: number; likelyUsd: number; worstTokens: number; worstUsd: number }

// What re-caching a context costs once it has gone cold. The opening shared
// with other sessions (system prompt and tools) usually stays cached when any
// other session used it within the hour, so the likely cost is the rest of the
// context; the worst case, nothing else having used it, is the whole context.
export function coldEstimate(contextTokens: number, sharedPrefixTokens: number, writeRate: number): ColdEstimate {
  const likelyTokens = Math.max(0, contextTokens - Math.min(sharedPrefixTokens, contextTokens))
  return {
    likelyTokens,
    likelyUsd: (likelyTokens * writeRate) / 1e6,
    worstTokens: contextTokens,
    worstUsd: (contextTokens * writeRate) / 1e6,
  }
}

// A ping goes out at nine tenths of the lifetime after the last request that
// used the cache: 54 minutes on the one-hour cache, 4.5 on the five-minute
// one, which leaves room for a slow reply before the entry lapses.
export function pingDelay(lastCacheUseAt: number, ttl: CacheTtl, now: number): number {
  return Math.max(0, lastCacheUseAt + TTL_MS[ttl] * 0.9 - now)
}

export type PingCheck = { isDue: true } | { isDue: false; why: 'off' | 'turn running' | 'no context' | 'small context' | 'idle too long' }

export type PingConditions = {
  isOn: boolean
  isTurnRunning: boolean
  contextTokens: number | null
  minContextTokens: number
  idleSince: number
  maxIdleMs: number
  now: number
}

export function checkPing(c: PingConditions): PingCheck {
  if (!c.isOn) return { isDue: false, why: 'off' }
  if (c.isTurnRunning) return { isDue: false, why: 'turn running' }
  if (c.contextTokens === null || c.contextTokens === 0) return { isDue: false, why: 'no context' }
  if (c.contextTokens < c.minContextTokens) return { isDue: false, why: 'small context' }
  if (c.now - c.idleSince >= c.maxIdleMs) return { isDue: false, why: 'idle too long' }
  return { isDue: true }
}

// A ping kept the cache when it wrote no more than the tail: the last answer,
// which the request before it never sent back, and which on the one-hour cache
// is written again by every hourly ping because a fork writes at the
// five-minute rate. A ping that found the conversation cold writes all of it.
// Without a known tail, nearly everything it sent must have been read.
const TAIL_SLACK = 1_000

export function pingHit(usage: Usage, tail?: number): boolean {
  if (tail !== undefined) return usage.cache_creation_input_tokens <= tail + TAIL_SLACK && usage.cache_read_input_tokens > 0
  const sent = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
  return sent > 0 && usage.cache_read_input_tokens / sent >= 0.9
}
