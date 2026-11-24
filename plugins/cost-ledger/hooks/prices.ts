// What the mod says and remembers about prices: a model it has no rate for,
// a rate Claude Code quotes differently, and whether the breakdown and the
// total are priced on the same basis at all.

import type { EngineInterface } from 'claude-code'

import { judgeQuote, keptQuotes, rateText, withQuote } from './pricecheck'
import type { QuoteVerdict, WriteQuote } from './pricecheck'
import { ratesFor, sameRates } from './pricing'
import { LIST_TABLE } from './settings'
import type { Settings } from './settings'
import { LEARNED_PRICING_KEY, remember, UNPRICED_MODELS_KEY, WRITE_QUOTES_KEY } from './store'

// The breakdown can be held to the total only where both are at list prices:
// the rates setting reprices the breakdown, and an organisation's managed
// pricing the total. Says how they differ, or nothing where they should agree.
export async function pricedApart($: EngineInterface, settings: Settings): Promise<string | undefined> {
  if (settings.hasCustomRates) return "it is priced at your rates and the total at Claude Code's"
  if ((await $.store.get(LEARNED_PRICING_KEY)) === 'configured') return "it is priced at list rates and the total at your organisation's"
  return undefined
}

// Said once per model, the first time any session meets it: a model released
// after this table was written would otherwise drop out of the breakdown
// with nothing to show for it but a line in the pane.
// Module scope: what this load of the mod has already said, for a store that
// cannot keep it. Without it the notice would come with every request. For a
// quote, whether the last one the store did not keep agreed with the list.
const namedHere = new Set<string>()
const unkeptQuotes = new Map<string, boolean>()

// A load starts with nothing said.
export function forgetNotices() {
  namedHere.clear()
  unkeptQuotes.clear()
}

export async function noteUnpricedModel($: EngineInterface, model: string) {
  const seen = ((await $.store.get(UNPRICED_MODELS_KEY)) as string[] | undefined) ?? []
  if (seen.includes(model) || namedHere.has(model)) return
  namedHere.add(model)
  await remember($, UNPRICED_MODELS_KEY, [...seen, model].slice(-20))
  $.ui.toast(
    `cost-ledger has no price for ${model}, so its tokens are left out of the cost breakdown; the totals are not affected. ` +
      'Update the plugin, or name the model in the rates setting.',
    { timeoutMs: 15_000 },
  )
}

// Claude Code quotes at list prices, so its quote is held to the list. A model
// the rates setting reprices is meant to differ from it and is not judged.
export function quoteVerdict(settings: Settings, quote: WriteQuote): QuoteVerdict | undefined {
  const listed = ratesFor(LIST_TABLE, quote.model, quote.tokens)
  const used = ratesFor(settings.table, quote.model, quote.tokens)
  if (listed === undefined || used === undefined || !sameRates(listed, used)) return undefined
  return judgeQuote(LIST_TABLE, quote)
}

// Only a quote that can be judged is kept, so one too small to say anything
// does not displace what an earlier one showed. A difference is said when it
// first appears for a model, not at every switch after: the quote before it
// for the model already differing means it has been said. That quote is the
// kept one, or the last the store would not keep.
export async function noteWriteQuote($: EngineInterface, settings: Settings, quote: WriteQuote | undefined) {
  if (quote === undefined) return
  const verdict = quoteVerdict(settings, quote)
  if (verdict === undefined) return
  const stored = await $.store.get(WRITE_QUOTES_KEY)
  const kept = keptQuotes(stored, quote.at).find(before => before.model === quote.model)
  const lastAgreed = unkeptQuotes.get(quote.model) ?? (kept === undefined ? undefined : quoteVerdict(settings, kept)?.isAgreed)
  if (await remember($, WRITE_QUOTES_KEY, withQuote(stored, quote))) unkeptQuotes.delete(quote.model)
  else unkeptQuotes.set(quote.model, verdict.isAgreed)
  if (verdict.isAgreed || lastAgreed === false) return
  $.ui.toast(
    `Claude Code prices cache writes on ${quote.model} at ${rateText(verdict.quotedPerMillion)} per million tokens and ` +
      `cost-ledger's price list has ${rateText(verdict.listedPerMillion)}, so the cost breakdown for that model is off; ` +
      "the totals are not affected. Update the plugin, or give the model's rates in the rates setting.",
    { timeoutMs: 15_000 },
  )
}
