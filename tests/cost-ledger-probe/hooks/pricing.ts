// List prices in USD per million tokens, copied from cost-ledger's
// hooks/pricing.ts: the probe sits outside that plugin and cannot import it.
// Only what the report needs to compare a turn's cost against its tokens.

export type Rates = { input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }

const listRates = (input: number, output: number, cacheRead: number): Rates => ({
  input,
  output,
  cacheRead,
  cacheWrite5m: input * 1.25,
  cacheWrite1h: input * 2,
})

const LIST_RATES: readonly [string, Rates][] = [
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

// A family matches where the id does not continue with another version
// number, so "opus-5" does not claim "claude-opus-5-5".
function matchesFamily(model: string, family: string): boolean {
  let at = model.indexOf(family)
  while (at !== -1) {
    if (!/^(\d|-\d{1,2}(?!\d))/.test(model.slice(at + family.length))) return true
    at = model.indexOf(family, at + 1)
  }
  return false
}

export function ratesFor(model: string): Rates | undefined {
  let best: [string, Rates] | undefined
  for (const entry of LIST_RATES) {
    if (matchesFamily(model, entry[0]) && (best === undefined || entry[0].length > best[0].length)) best = entry
  }
  return best?.[1]
}
