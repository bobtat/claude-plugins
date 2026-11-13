// The wording of the status line, the band and the cache notices, from
// values already in hand: nothing here reads the session or the store.

import type { Context, KeepAlive, RateLimit, Totals } from '../types'
import { TTL_MS } from './keepalive'
import type { ColdEstimate } from './keepalive'
import { cacheMinutesLeft, formatTokens, formatUsd } from './ledger'
import { ratesFor } from './pricing'
import type { CacheTtl } from './pricing'
import type { Settings } from './settings'

const RATE_LIMIT_NAMES: Record<string, string> = { five_hour: '5h', seven_day: '7d' }

export function rateLimitText(limits: readonly RateLimit[]): string {
  return limits.map(l => `${RATE_LIMIT_NAMES[l.kind] ?? l.kind} ${Math.round(l.percentUsed)}%`).join(' · ')
}

// The context is what the next request sends, so its size is that request's
// prompt length.
export function perStepText(ctx: Context, settings: Settings): string {
  const rates = ratesFor(settings.table, ctx.model, ctx.tokens)
  return rates ? ` ≈${formatUsd((ctx.tokens * rates.cacheRead) / 1_000_000)}/step` : ''
}

export function nudgeText(ctx: Context, settings: Settings): string {
  return settings.contextNudgeTokens > 0 && ctx.tokens >= settings.contextNudgeTokens ? ', consider /compact' : ''
}

// "≈$0.33–$0.57" when part of the context is likely still cached by other
// sessions, else the one figure.
export function coldText(cold: ColdEstimate): string {
  return cold.likelyTokens < cold.worstTokens
    ? `≈${formatUsd(cold.likelyUsd)}–${formatUsd(cold.worstUsd)}`
    : `≈${formatUsd(cold.worstUsd)}`
}

export function cacheText(ctx: Context, ttl: CacheTtl, now: number, ka: KeepAlive, cold: ColdEstimate | undefined): string {
  const left = cacheMinutesLeft(ctx.at, TTL_MS[ttl], now)
  if (left > 0) {
    const kept = ka.pings > 0 && ka.stopped === null ? ` (kept warm: ${ka.pings} ping${ka.pings === 1 ? '' : 's'} ${formatUsd(ka.usd)})` : ''
    return ` · cache warm ${left}m${kept}`
  }
  return ` · cache cold${cold ? ` (re-cache ${coldText(cold)})` : ''}`
}

export function summaryLine(t: Totals, settings: Settings, contextPart: string): string {
  const qualifier = settings.isSubscription ? ' (API-equiv.)' : ''
  const costs = `${formatUsd(t.session)} session · ${formatUsd(t.week)} week · ${formatUsd(t.month)} month${qualifier}`
  const limits = settings.isSubscription && t.rateLimits.length > 0 ? ` · ${rateLimitText(t.rateLimits)}` : ''
  return costs + limits + contextPart
}

export function coldTokens(cold: ColdEstimate): string {
  return cold.likelyTokens < cold.worstTokens
    ? `~${formatTokens(cold.likelyTokens)}–${formatTokens(cold.worstTokens)}`
    : `~${formatTokens(cold.worstTokens)}`
}
