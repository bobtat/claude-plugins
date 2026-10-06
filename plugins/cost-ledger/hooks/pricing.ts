import type { Breakdown, Category } from '../types'

export type Rates = {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

export type CacheTtl = '5m' | '1h'

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export const CATEGORIES: readonly Category[] = ['input', 'output', 'cacheRead', 'cacheWrite']

const listRates = (input: number, output: number, cacheRead: number): Rates => ({
  input,
  output,
  cacheRead,
  cacheWrite5m: input * 1.25,
  cacheWrite1h: input * 2,
})

// Anthropic list prices in USD per million tokens. Models without a price in
// the bundled reference (Opus 4.5, Opus 4.1, Sonnet 4.5) are left out rather
// than guessed: their tokens are counted as unpriced until the rates setting
// names them.
export const LIST_RATES: readonly [string, Rates][] = [
  ['mythos-5-1', listRates(10, 50, 0.25)],
  ['mythos-5', listRates(10, 50, 1)],
  ['fable-5-1', listRates(10, 50, 0.25)],
  ['fable-5', listRates(10, 50, 1)],
  ['opus-5-5', listRates(4, 20, 0.2)],
  ['opus-5', listRates(5, 25, 0.5)],
  ['opus-4-8', listRates(5, 25, 0.5)],
  ['opus-4-7', listRates(5, 25, 0.5)],
  ['opus-4-6', listRates(5, 25, 0.5)],
  ['sonnet-5-5', listRates(2, 10, 0.2)],
  ['sonnet-5', listRates(2, 10, 0.2)],
  ['sonnet-4-6', listRates(3, 15, 0.3)],
  ['haiku-4-5', listRates(1, 5, 0.1)],
]

const RATE_FIELDS: readonly (keyof Rates)[] = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h']

export type RateTable = { rates: readonly [string, Rates][]; error?: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isRate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

// Overrides are per family and may name only some fields, so an AWS price list
// can be pasted in for the models actually used. A family that has no list
// price must give input, output and cacheRead; anything malformed is skipped
// and named in the error rather than failing the mod.
export function rateTable(overridesJson: string): RateTable {
  if (overridesJson.trim() === '') return { rates: LIST_RATES }

  let overrides: unknown
  try {
    overrides = JSON.parse(overridesJson)
  } catch {
    return { rates: LIST_RATES, error: 'the rates setting is not valid JSON; list prices are used' }
  }
  if (!isRecord(overrides)) {
    return { rates: LIST_RATES, error: 'the rates setting must be a JSON object; list prices are used' }
  }

  const merged = new Map(LIST_RATES)
  const skipped: string[] = []
  for (const [family, value] of Object.entries(overrides)) {
    if (!isRecord(value)) {
      skipped.push(family)
      continue
    }
    const partial: Partial<Rates> = {}
    for (const field of RATE_FIELDS) {
      if (isRate(value[field])) partial[field] = value[field]
    }
    const base = merged.get(family)
    if (base) {
      merged.set(family, { ...base, ...partial })
    } else if (partial.input !== undefined && partial.output !== undefined && partial.cacheRead !== undefined) {
      merged.set(family, { ...listRates(partial.input, partial.output, partial.cacheRead), ...partial })
    } else {
      skipped.push(family)
    }
  }
  const error = skipped.length > 0 ? `rates for ${skipped.join(', ')} were skipped as incomplete or malformed` : undefined
  return { rates: [...merged.entries()], error }
}

// A family matches where the id continues with something other than another
// version number, so "claude-opus-5" does not claim "claude-opus-5-5" while a
// date ("-20250929") or a Bedrock suffix ("-v1:0") still matches.
function matchesFamily(model: string, family: string): boolean {
  let at = model.indexOf(family)
  while (at !== -1) {
    const rest = model.slice(at + family.length)
    if (!/^(\d|-\d{1,2}(?!\d))/.test(rest)) return true
    at = model.indexOf(family, at + 1)
  }
  return false
}

export function ratesFor(table: RateTable, model: string): Rates | undefined {
  let best: [string, Rates] | undefined
  for (const entry of table.rates) {
    if (matchesFamily(model, entry[0]) && (best === undefined || entry[0].length > best[0].length)) best = entry
  }
  return best?.[1]
}

export function writeRate(rates: Rates, ttl: CacheTtl): number {
  return ttl === '1h' ? rates.cacheWrite1h : rates.cacheWrite5m
}

export function emptyBreakdown(): Breakdown {
  return {
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    usd: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    unpricedTokens: 0,
  }
}

export function priceUsage(usage: Usage, rates: Rates | undefined, ttl: CacheTtl): Breakdown {
  const tokens = {
    input: usage.input_tokens,
    output: usage.output_tokens,
    cacheRead: usage.cache_read_input_tokens,
    cacheWrite: usage.cache_creation_input_tokens,
  }
  if (rates === undefined) {
    const unpricedTokens = CATEGORIES.reduce((sum, c) => sum + tokens[c], 0)
    return { tokens, usd: emptyBreakdown().usd, unpricedTokens }
  }
  const perToken = (rate: number) => rate / 1_000_000
  return {
    tokens,
    usd: {
      input: tokens.input * perToken(rates.input),
      output: tokens.output * perToken(rates.output),
      cacheRead: tokens.cacheRead * perToken(rates.cacheRead),
      cacheWrite: tokens.cacheWrite * perToken(writeRate(rates, ttl)),
    },
    unpricedTokens: 0,
  }
}

export function addBreakdown(a: Breakdown | undefined, b: Breakdown): Breakdown {
  const sum = emptyBreakdown()
  for (const c of CATEGORIES) {
    sum.tokens[c] = (a?.tokens[c] ?? 0) + b.tokens[c]
    sum.usd[c] = (a?.usd[c] ?? 0) + b.usd[c]
  }
  sum.unpricedTokens = (a?.unpricedTokens ?? 0) + (b.unpricedTokens ?? 0)
  return sum
}

export function hitRate(b: Breakdown): number {
  const prompt = b.tokens.input + b.tokens.cacheRead + b.tokens.cacheWrite
  return prompt === 0 ? 0 : b.tokens.cacheRead / prompt
}

export function totalUsd(b: Breakdown): number {
  return CATEGORIES.reduce((sum, c) => sum + b.usd[c], 0)
}
