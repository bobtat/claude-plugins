import type { Breakdown, Category } from '../types'

export type Rates = {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

// A model's rates, and a second set for a request whose prompt is longer than
// `above` tokens where the model is priced by prompt length.
export type RateCards = { base: Rates; longPrompt?: { above: number; rates: Rates } }

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

const flat = (input: number, output: number, cacheRead: number): RateCards => ({ base: listRates(input, output, cacheRead) })

// Anthropic list prices in USD per million tokens, as the pricing page gives
// them. A model that is not here is not guessed at from its neighbours, whose
// prices have differed from one version to the next: its tokens are counted
// as unpriced until this table or the rates setting names it.
export const LIST_RATES: readonly [string, RateCards][] = [
  ['mythos-5-2', flat(8, 40, 0.2)],
  ['mythos-5-1', flat(10, 50, 0.25)],
  ['mythos-5', flat(10, 50, 1)],
  ['fable-5-2', flat(8, 40, 0.2)],
  ['fable-5-1', flat(10, 50, 0.25)],
  ['fable-5', flat(10, 50, 1)],
  ['opus-5-5', flat(4, 20, 0.2)],
  ['opus-5', flat(5, 25, 0.5)],
  ['opus-4-8', flat(5, 25, 0.5)],
  ['opus-4-7', flat(5, 25, 0.5)],
  ['opus-4-6', flat(5, 25, 0.5)],
  ['opus-4-5', flat(5, 25, 0.5)],
  ['opus-4-1', flat(15, 75, 1.5)],
  ['opus-4', flat(15, 75, 1.5)],
  ['sonnet-5-5', flat(2, 10, 0.1)],
  ['sonnet-5', flat(2, 10, 0.2)],
  ['sonnet-4-6', flat(3, 15, 0.3)],
  ['sonnet-4-5', flat(3, 15, 0.3)],
  ['sonnet-4', flat(3, 15, 0.3)],
  ['haiku-5-5', { base: listRates(0.1, 0.5, 0.01), longPrompt: { above: 100_000, rates: listRates(0.5, 2.5, 0.05) } }],
  ['haiku-4-5', flat(1, 5, 0.1)],
]

const RATE_FIELDS: readonly (keyof Rates)[] = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h']

export type RateTable = { rates: readonly [string, RateCards][]; error?: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isRate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

function givenRates(value: Record<string, unknown>): Partial<Rates> {
  const given: Partial<Rates> = {}
  for (const field of RATE_FIELDS) {
    const rate = value[field]
    if (isRate(rate)) given[field] = rate
  }
  return given
}

// The rates an override leaves: laid over the listed ones, or made whole from
// input, output and cacheRead where nothing is listed; undefined when there
// is neither.
function overriddenRates(listed: Rates | undefined, given: Partial<Rates>): Rates | undefined {
  if (listed) return { ...listed, ...given }
  if (given.input === undefined || given.output === undefined || given.cacheRead === undefined) return undefined
  return { ...listRates(given.input, given.output, given.cacheRead), ...given }
}

function overriddenLongPrompt(listed: RateCards['longPrompt'], value: unknown): RateCards['longPrompt'] {
  if (!isRecord(value)) return undefined
  if ('above' in value && !isRate(value.above)) return undefined
  const above = isRate(value.above) ? value.above : listed?.above
  const rates = overriddenRates(listed?.rates, givenRates(value))
  return above === undefined || rates === undefined ? undefined : { above, rates }
}

// Overrides are per family and may name only some fields, so an AWS price list
// can be pasted in for the models actually used. A family that has no list
// price must give input, output and cacheRead. A family's longPrompt object
// overrides its rates for long prompts the same way, and needs `above` where
// none are listed. Anything malformed is skipped and named in the error
// rather than failing the mod.
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
    const listed = merged.get(family)
    const base = overriddenRates(listed?.base, givenRates(value))
    if (base === undefined) {
      skipped.push(family)
      continue
    }
    let longPrompt = listed?.longPrompt
    if ('longPrompt' in value) {
      const overridden = overriddenLongPrompt(longPrompt, value.longPrompt)
      if (overridden === undefined) skipped.push(`${family}.longPrompt`)
      else longPrompt = overridden
    }
    merged.set(family, { base, longPrompt })
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

// A request's prompt is everything it sends: what the cache served and what
// it wrote to the cache count along with the rest of its input.
export function promptTokens(usage: Usage): number {
  return usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
}

// The rates one request of the given prompt length is charged at. A request
// over a model's long-prompt threshold pays the long-prompt rates on all of
// its tokens, not only on those past the threshold.
export function ratesFor(table: RateTable, model: string, requestPromptTokens: number): Rates | undefined {
  let best: readonly [string, RateCards] | undefined
  for (const entry of table.rates) {
    if (matchesFamily(model, entry[0]) && (best === undefined || entry[0].length > best[0].length)) best = entry
  }
  if (best === undefined) return undefined
  const { base, longPrompt } = best[1]
  return longPrompt !== undefined && requestPromptTokens > longPrompt.above ? longPrompt.rates : base
}

export function sameRates(a: Rates, b: Rates): boolean {
  return RATE_FIELDS.every(field => a[field] === b[field])
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
