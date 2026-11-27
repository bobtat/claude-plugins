import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { judgeQuote, keptQuotes, rateText, withQuote, writeQuote } from '../hooks/pricecheck'
import type { WriteQuote } from '../hooks/pricecheck'
import { LIST_RATES, rateTable, ratesFor, writeRate } from '../hooks/pricing'
import type { CacheTtl } from '../hooks/pricing'
import { DAY, engine, NOW, ROOT } from './support'

const LIST = rateTable('')
const TTLS: CacheTtl[] = ['5m', '1h']
const PROMPTS = [1_000, 37_911, 150_000, 987_654]

// Claude Code's quote for a write at the given rate: rounded to a hundredth
// of a cent, as it rounds.
const quoted = (tokens: number, perMillion: number) => Math.round(((tokens * perMillion) / 1_000_000) * 1e4) / 1e4

const quote = (model: string, tokens: number, usd: number, ttl: CacheTtl = '1h', at = NOW): WriteQuote => ({ model, at, tokens, usd, ttl })

// Every listed model at every prompt length and lifetime, with the rate the
// list charges for it.
function listedWrites(): { model: string; tokens: number; ttl: CacheTtl; perMillion: number }[] {
  return LIST_RATES.flatMap(([family]) =>
    PROMPTS.flatMap(tokens =>
      TTLS.flatMap(ttl => {
        const model = `claude-${family}`
        const rates = ratesFor(LIST, model, tokens)
        return rates === undefined ? [] : [{ model, tokens, ttl, perMillion: writeRate(rates, ttl) }]
      }),
    ),
  )
}

test('a quote at the listed rate, rounded as Claude Code rounds it, never reads as a difference', async () => {
  const writes = listedWrites()
  const differing = writes.filter(w => judgeQuote(LIST, quote(w.model, w.tokens, quoted(w.tokens, w.perMillion), w.ttl))?.isAgreed === false)

  expect(writes.length).toBe(LIST_RATES.length * PROMPTS.length * TTLS.length)
  expect(differing).toEqual([])
})

test('a rate five percent off the list is caught on any quote of a cent or more', async () => {
  const sizeable = listedWrites().filter(w => (w.tokens * w.perMillion) / 1_000_000 >= 0.01)
  const missed = sizeable.filter(w => judgeQuote(LIST, quote(w.model, w.tokens, quoted(w.tokens, w.perMillion * 1.05), w.ttl))?.isAgreed !== false)

  expect(sizeable.length).toBeGreaterThan(100)
  expect(missed).toEqual([])
})

test('a differing quote reports both rates per million tokens', async () => {
  const verdict = judgeQuote(LIST, quote('claude-fable-5-2', 50_000, 1, '1h'))

  expect(verdict?.isAgreed).toBe(false)
  expect(rateText(verdict?.quotedPerMillion ?? 0)).toBe('$20')
  expect(rateText(verdict?.listedPerMillion ?? 0)).toBe('$16')
})

test('a quote is held to the lifetime it was priced at', async () => {
  // $0.50 is the five-minute price of 50,000 tokens on Fable 5.2, not the one-hour price.
  expect(judgeQuote(LIST, quote('claude-fable-5-2', 50_000, 0.5, '5m'))?.isAgreed).toBe(true)
  expect(judgeQuote(LIST, quote('claude-fable-5-2', 50_000, 0.5, '1h'))?.isAgreed).toBe(false)
})

test('a quote for a long prompt is held to the long-prompt card', async () => {
  expect(judgeQuote(LIST, quote('claude-haiku-5-5', 400_000, 0.25, '5m'))?.isAgreed).toBe(true)
  // $0.05 is what the short-prompt card would charge for the same write.
  expect(judgeQuote(LIST, quote('claude-haiku-5-5', 400_000, 0.05, '5m'))?.isAgreed).toBe(false)
})

test('no verdict is given on an amount too small to show the rate, or a model with no rate', async () => {
  expect(judgeQuote(LIST, quote('claude-fable-5-2', 100, 0.0016))).toBeUndefined()
  expect(judgeQuote(LIST, quote('claude-fable-5-2', 100, 0.002))).toBeUndefined()
  expect(judgeQuote(LIST, quote('claude-opus-9', 50_000, 1))).toBeUndefined()
})

test('a small listed amount is still judged against a large quote', async () => {
  expect(judgeQuote(LIST, quote('claude-haiku-5-5', 10_000, 0.02, '1h'))?.isAgreed).toBe(false)
})

test('rates read to the four figures list prices run to', async () => {
  expect(rateText(18.75)).toBe('$18.75')
  expect(rateText(0.125)).toBe('$0.125')
  expect(rateText(16.000028)).toBe('$16')
})

test('figures that are not a quote are not kept as one', async () => {
  expect(writeQuote('claude-fable-5-2', NOW, 50_000, 0.8, '1h')).toEqual(quote('claude-fable-5-2', 50_000, 0.8))
  expect(writeQuote('claude-fable-5-2', NOW, 0, 0, '1h')).toBeUndefined()
  expect(writeQuote('claude-fable-5-2', NOW, 50_000, Number.NaN, '1h')).toBeUndefined()
  expect(writeQuote('claude-fable-5-2', NOW, 50_000, -1, '1h')).toBeUndefined()
  expect(writeQuote('claude-fable-5-2', NOW, Number.POSITIVE_INFINITY, 1, '1h')).toBeUndefined()
  expect(writeQuote('', NOW, 50_000, 0.8, '1h')).toBeUndefined()
})

test('whatever else is found in the store is read as no quotes', async () => {
  const good = quote('claude-fable-5-2', 50_000, 0.8)
  const stored = [null, 'claude-fable-5-2', 7, { model: 5 }, { ...good, usd: '0.8' }, { ...good, ttl: '2h' }, { ...good, tokens: -1 }, [good], good]

  expect(keptQuotes(stored, NOW)).toEqual([good])
  expect(keptQuotes('writeQuotes', NOW)).toEqual([])
  expect(keptQuotes({ 0: good, length: 1 }, NOW)).toEqual([])
  expect(keptQuotes(undefined, NOW)).toEqual([])
})

test('a quote is forgotten after thirty days', async () => {
  const stored = [quote('claude-fable-5-2', 50_000, 0.8, '1h', NOW - 31 * DAY), quote('claude-opus-5-5', 50_000, 0.4, '1h', NOW - 29 * DAY)]

  expect(keptQuotes(stored, NOW).map(kept => kept.model)).toEqual(['claude-opus-5-5'])
})

test('the latest quote for a model replaces the one before, and the oldest models make way', async () => {
  const earlier = quote('claude-fable-5-2', 50_000, 1, '1h', NOW - DAY)
  const later = quote('claude-fable-5-2', 60_000, 0.96)
  expect(withQuote([earlier], later)).toEqual([later])

  const many = Array.from({ length: 25 }, (_, i) => quote(`claude-model-${i}`, 50_000, 1, '1h', NOW - (25 - i) * 60_000))
  const kept = withQuote(many, later)
  expect(kept).toHaveLength(20)
  expect(kept.at(-1)).toEqual(later)
  expect(kept.map(k => k.model)).not.toContain('claude-model-0')
})

// A /model switch with a cold cache, so the only toast there can be is the
// price check's.
const switchTo = ($: Engine, to_model: string, context_tokens: number, estimated_cache_write_usd: number, pricing: 'catalog' | 'configured' | 'default' = 'catalog') =>
  $.classic.PreModelSwitch({
    session_id: 's1',
    transcript_path: '',
    cwd: ROOT,
    from_model: 'claude-opus-5-5',
    to_model,
    requested_model: null,
    source: 'command',
    context_tokens,
    prompt_cache_warm: false,
    cache_ttl: '1h',
    estimated_cache_write_usd,
    pricing,
  })

test('a switch where Claude Code prices the write as the list does says nothing', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts = engine(on)
  on('classic.PreModelSwitch', () => ({}))

  await switchTo($, 'claude-fable-5-2', 50_000, 0.8)

  expect(toasts).toEqual([])
})

test('a switch where Claude Code prices the write differently says so once, with both rates', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts = engine(on)
  on('classic.PreModelSwitch', () => ({}))

  await switchTo($, 'claude-fable-5-2', 50_000, 1)
  await switchTo($, 'claude-fable-5-2', 80_000, 1.6)

  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toMatch(/Claude Code prices cache writes on claude-fable-5-2 at \$20 per million tokens and cost-ledger's price list has \$16/)
  expect(toasts[0]).toMatch(/the totals are not affected/)
})

test('a difference is said again once a quote in between agreed', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts = engine(on)
  on('classic.PreModelSwitch', () => ({}))

  await switchTo($, 'claude-fable-5-2', 50_000, 1)
  await switchTo($, 'claude-fable-5-2', 50_000, 0.8)
  await switchTo($, 'claude-fable-5-2', 50_000, 1)

  expect(toasts).toHaveLength(2)
})

test('each model with a different price is named on its own', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts = engine(on)
  on('classic.PreModelSwitch', () => ({}))

  await switchTo($, 'claude-fable-5-2', 50_000, 1)
  await switchTo($, 'claude-opus-5-5', 50_000, 0.5)

  expect(toasts).toHaveLength(2)
  expect(toasts[1]).toMatch(/claude-opus-5-5 at \$10 per million tokens and cost-ledger's price list has \$8/)
})

test('a quote too small to judge does not make a known difference news again', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts = engine(on)
  on('classic.PreModelSwitch', () => ({}))

  await switchTo($, 'claude-fable-5-2', 50_000, 1)
  await switchTo($, 'claude-fable-5-2', 100, 0.002)
  await switchTo($, 'claude-fable-5-2', 50_000, 1)

  expect(toasts).toHaveLength(1)
})

test('a quote that is not at list prices is not held to the list', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts = engine(on)
  on('classic.PreModelSwitch', () => ({}))

  await switchTo($, 'claude-fable-5-2', 50_000, 1, 'configured')
  await switchTo($, 'claude-fable-5-2', 50_000, 1, 'default')

  expect(toasts).toEqual([])
})

test(
  'a model the rates setting reprices is not held to Claude Code',
  { options: { rates: '{"fable-5-2": {"input": 9}}' } },
  async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    const toasts = engine(on)
    on('classic.PreModelSwitch', () => ({}))

    await switchTo($, 'claude-fable-5-2', 50_000, 1)
    await switchTo($, 'claude-opus-5-5', 50_000, 0.5)

    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatch(/claude-opus-5-5/)
  },
)
