import { ratesFor, writeRate } from './pricing'
import type { CacheTtl, RateTable } from './pricing'

// What Claude Code said, at a model switch, that writing a prompt of `tokens`
// to the new model's cache would cost at list prices.
export type WriteQuote = { model: string; at: number; tokens: number; usd: number; ttl: CacheTtl }

export type QuoteVerdict = { isAgreed: boolean; quotedPerMillion: number; listedPerMillion: number }

const KEPT_QUOTES = 20
const QUOTE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
// Claude Code rounds its quote to a hundredth of a cent. An amount where that
// rounding is more than a couple of percent says too little about the rate
// behind it, in either direction, to be held against the list.
const ROUNDING_USD = 0.0001
const MIN_TO_JUDGE_USD = 0.005

const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

function isQuote(value: unknown): value is WriteQuote {
  if (typeof value !== 'object' || value === null) return false
  const quote = value as Record<string, unknown>
  return (
    typeof quote.model === 'string' &&
    quote.model !== '' &&
    isAmount(quote.at) &&
    isAmount(quote.tokens) &&
    quote.tokens > 0 &&
    isAmount(quote.usd) &&
    (quote.ttl === '5m' || quote.ttl === '1h')
  )
}

// Undefined where the event's figures are not a quote to keep: no prompt yet,
// or a number that is not one.
export function writeQuote(model: string, at: number, tokens: number, usd: number, ttl: CacheTtl): WriteQuote | undefined {
  const quote = { model, at, tokens, usd, ttl }
  return isQuote(quote) ? quote : undefined
}

// The stored quotes still worth reading. What is stored is taken as untrusted:
// an earlier version, or another program, may have written anything there.
export function keptQuotes(stored: unknown, now: number): WriteQuote[] {
  if (!Array.isArray(stored)) return []
  return stored.filter(isQuote).filter(quote => now - quote.at <= QUOTE_MAX_AGE_MS)
}

// One quote per model, the latest; the oldest models make way past the cap.
export function withQuote(stored: unknown, quote: WriteQuote): WriteQuote[] {
  const others = keptQuotes(stored, quote.at).filter(kept => kept.model !== quote.model)
  return [...others, quote].sort((a, b) => a.at - b.at).slice(-KEPT_QUOTES)
}

// A rate per million tokens, to the four figures list prices run to.
export function rateText(perMillion: number): string {
  return `$${Number(perMillion.toPrecision(4))}`
}

// Whether the table prices that write as Claude Code did. Undefined where it
// cannot say: the table has no rate for the model, or the amount is too small.
export function judgeQuote(table: RateTable, quote: WriteQuote): QuoteVerdict | undefined {
  const rates = ratesFor(table, quote.model, quote.tokens)
  if (rates === undefined) return undefined
  const listedPerMillion = writeRate(rates, quote.ttl)
  const listedUsd = (quote.tokens * listedPerMillion) / 1_000_000
  if (Math.max(listedUsd, quote.usd) < MIN_TO_JUDGE_USD) return undefined
  return {
    isAgreed: Math.abs(listedUsd - quote.usd) <= ROUNDING_USD,
    quotedPerMillion: (quote.usd / quote.tokens) * 1_000_000,
    listedPerMillion,
  }
}
