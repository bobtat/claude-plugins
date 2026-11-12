import { expect, mock, test } from 'claude-code/testing'

import { priceUsage, promptTokens, rateTable, ratesFor } from '../hooks/pricing'
import { engine, measure, NOW, runStep, usage } from './support'

const LIST = rateTable('')

// USD per million tokens as the pricing page lists them: input, output, cache
// read, five-minute write, one-hour write.
const PUBLISHED: [string, number, number, number, number, number][] = [
  ['claude-fable-5-2', 8, 40, 0.2, 10, 16],
  ['claude-mythos-5-2', 8, 40, 0.2, 10, 16],
  ['claude-fable-5-1', 10, 50, 0.25, 12.5, 20],
  ['claude-fable-5', 10, 50, 1, 12.5, 20],
  ['claude-opus-5-5', 4, 20, 0.2, 5, 8],
  ['claude-opus-5', 5, 25, 0.5, 6.25, 10],
  ['claude-opus-4-5', 5, 25, 0.5, 6.25, 10],
  ['claude-opus-4-1', 15, 75, 1.5, 18.75, 30],
  ['claude-opus-4', 15, 75, 1.5, 18.75, 30],
  ['claude-sonnet-5-5', 2, 10, 0.1, 2.5, 4],
  ['claude-sonnet-5', 2, 10, 0.2, 2.5, 4],
  ['claude-sonnet-4-5', 3, 15, 0.3, 3.75, 6],
  ['claude-sonnet-4', 3, 15, 0.3, 3.75, 6],
  ['claude-haiku-4-5', 1, 5, 0.1, 1.25, 2],
]

test('each model is priced as the pricing page lists it', async () => {
  for (const [model, input, output, cacheRead, cacheWrite5m, cacheWrite1h] of PUBLISHED) {
    expect([model, ratesFor(LIST, model, 0)]).toEqual([model, { input, output, cacheRead, cacheWrite5m, cacheWrite1h }])
  }
})

test('a dated or Bedrock id of an older model finds its own version, not a later one', async () => {
  expect(ratesFor(LIST, 'claude-opus-4-20250514', 0)?.input).toBe(15)
  expect(ratesFor(LIST, 'claude-opus-4-1-20250805', 0)?.input).toBe(15)
  expect(ratesFor(LIST, 'claude-opus-4-5-20251101', 0)?.input).toBe(5)
  expect(ratesFor(LIST, 'us.anthropic.claude-sonnet-4-20250514-v1:0', 0)?.input).toBe(3)
  expect(ratesFor(LIST, 'us.anthropic.claude-fable-5-2-v1:0', 0)?.input).toBe(8)
})

test('a version the table does not know is not priced as its neighbour', async () => {
  expect(ratesFor(LIST, 'claude-fable-5-3', 0)).toBeUndefined()
  expect(ratesFor(LIST, 'claude-haiku-5', 0)).toBeUndefined()
  expect(ratesFor(LIST, 'claude-opus-6', 0)).toBeUndefined()
})

test('Haiku 5.5 is priced on the card its prompt length selects', async () => {
  const short = { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 }
  const long = { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite5m: 0.625, cacheWrite1h: 1 }

  expect(ratesFor(LIST, 'claude-haiku-5-5', 0)).toEqual(short)
  expect(ratesFor(LIST, 'claude-haiku-5-5', 100_000)).toEqual(short)
  expect(ratesFor(LIST, 'claude-haiku-5-5', 100_001)).toEqual(long)
  expect(ratesFor(LIST, 'anthropic.claude-haiku-5-5', 900_000)).toEqual(long)
})

test('a prompt is its input, cache reads and cache writes together, and the long card prices the whole request', async () => {
  const request = { input_tokens: 1_000, output_tokens: 2_000, cache_read_input_tokens: 60_000, cache_creation_input_tokens: 40_000 }
  expect(promptTokens(request)).toBe(101_000)

  const priced = priceUsage(request, ratesFor(LIST, 'claude-haiku-5-5', promptTokens(request)), '5m')

  const microUsd = (usd: number) => Math.round(usd * 1e6)
  expect(microUsd(priced.usd.input)).toBe(500)
  expect(microUsd(priced.usd.output)).toBe(5_000)
  expect(microUsd(priced.usd.cacheRead)).toBe(3_000)
  expect(microUsd(priced.usd.cacheWrite)).toBe(25_000)
  expect(priced.unpricedTokens).toBe(0)
})

test('a model priced at one rate keeps it at any prompt length', async () => {
  expect(ratesFor(LIST, 'claude-fable-5-2', 900_000)?.input).toBe(8)
})

test('an override names a card: plain fields the usual one, longPrompt the one for long prompts', async () => {
  const usual = rateTable('{"haiku-5-5": {"input": 0.2}}')
  expect(usual.error).toBeUndefined()
  expect(ratesFor(usual, 'claude-haiku-5-5', 1)?.input).toBe(0.2)
  expect(ratesFor(usual, 'claude-haiku-5-5', 1)?.cacheRead).toBe(0.01)
  expect(ratesFor(usual, 'claude-haiku-5-5', 200_000)?.input).toBe(0.5)

  const long = rateTable('{"haiku-5-5": {"longPrompt": {"input": 0.6}}}')
  expect(long.error).toBeUndefined()
  expect(ratesFor(long, 'claude-haiku-5-5', 100_000)?.input).toBe(0.1)
  expect(ratesFor(long, 'claude-haiku-5-5', 100_001)?.input).toBe(0.6)
  expect(ratesFor(long, 'claude-haiku-5-5', 100_001)?.cacheRead).toBe(0.05)

  const moved = rateTable('{"haiku-5-5": {"longPrompt": {"above": 150000}}}')
  expect(ratesFor(moved, 'claude-haiku-5-5', 150_000)?.input).toBe(0.1)
  expect(ratesFor(moved, 'claude-haiku-5-5', 150_001)?.input).toBe(0.5)
})

test('an override can give a long-prompt card to a model that lists none', async () => {
  const table = rateTable('{"sonnet-4-5": {"longPrompt": {"above": 200000, "input": 6, "output": 22.5, "cacheRead": 0.6}}}')

  expect(table.error).toBeUndefined()
  expect(ratesFor(table, 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', 200_000)?.input).toBe(3)
  expect(ratesFor(table, 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', 200_001)).toEqual({
    input: 6,
    output: 22.5,
    cacheRead: 0.6,
    cacheWrite5m: 7.5,
    cacheWrite1h: 12,
  })
})

test('a long-prompt override that cannot be used is named and leaves the rest of the family in place', async () => {
  const broken = [
    '{"haiku-5-5": {"input": 0.2, "longPrompt": 5}}',
    '{"haiku-5-5": {"input": 0.2, "longPrompt": null}}',
    '{"haiku-5-5": {"input": 0.2, "longPrompt": []}}',
    '{"haiku-5-5": {"input": 0.2, "longPrompt": {"above": -1}}}',
    '{"haiku-5-5": {"input": 0.2, "longPrompt": {"above": "100000"}}}',
  ]
  for (const json of broken) {
    const table = rateTable(json)
    expect([json, table.error]).toEqual([json, 'rates for haiku-5-5.longPrompt were skipped as incomplete or malformed'])
    expect(ratesFor(table, 'claude-haiku-5-5', 1)?.input).toBe(0.2)
    expect(ratesFor(table, 'claude-haiku-5-5', 200_000)?.input).toBe(0.5)
  }

  const noThreshold = rateTable('{"opus-5-5": {"longPrompt": {"input": 8, "output": 40, "cacheRead": 0.4}}}')
  expect(noThreshold.error).toMatch(/opus-5-5\.longPrompt/)
  expect(ratesFor(noThreshold, 'claude-opus-5-5', 900_000)?.input).toBe(4)

  const noRates = rateTable('{"opus-5-5": {"longPrompt": {"above": 200000, "input": 8}}}')
  expect(noRates.error).toMatch(/opus-5-5\.longPrompt/)
  expect(ratesFor(noRates, 'claude-opus-5-5', 900_000)?.input).toBe(4)
})

test('a subagent request on Haiku 5.5 is priced on the card for its own prompt length', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts = engine(on, [usage(60_000, 60_000)], 'claude-haiku-5-5')

  await runStep($, 't1', 'agent-1')

  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toMatch(/wrote 60k tokens .*≈ \$0\.04 on claude-haiku-5-5/)
})

const BAND = {
  plugin: 'cost-ledger',
  surface: 'terminal',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 3,
    bodyColumns: 160,
    scroll: { offset: 0, bodyRows: 3 },
    view: {},
  },
} as const

test('the band prices a Fable 5.2 context: each step at the read rate, a cold cache at the write rate', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  engine(on, [usage(500_000, 0)], 'claude-fable-5-2')

  await $.session.measure(measure(1))
  await runStep($, 't1')

  const band = await $.ui.mount(BAND)
  expect(await band.find({ text: /ctx 500k ≈\$0\.10\/step/ })).toBeDefined()

  await clock.advance(6 * 60_000)
  await band.redraw()
  expect(await band.find({ text: /cache cold \(re-cache ≈\$0\.00–\$5\.00\)/ })).toBeDefined()
})

test('the band prices a Haiku 5.5 context past 100k tokens on the long-prompt card, warm and cold', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  engine(on, [usage(400_000, 0)], 'claude-haiku-5-5')

  await $.session.measure(measure(1))
  await runStep($, 't1')

  const band = await $.ui.mount(BAND)
  expect(await band.find({ text: /ctx 400k ≈\$0\.02\/step/ })).toBeDefined()

  await clock.advance(6 * 60_000)
  await band.redraw()
  expect(await band.find({ text: /cache cold \(re-cache ≈\$0\.00–\$0\.25\)/ })).toBeDefined()
})

test('a switch to Haiku 5.5 prices the re-cache on the card for the context it carries over', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts = engine(on)
  on('classic.PreModelSwitch', () => ({}))

  await $.classic.PreModelSwitch({
    session_id: 's1',
    transcript_path: '',
    cwd: 'C:/work/billing-api',
    from_model: 'claude-opus-5-5',
    to_model: 'claude-haiku-5-5',
    requested_model: 'haiku',
    source: 'command',
    context_tokens: 400_000,
    prompt_cache_warm: true,
    cache_ttl: '5m',
    estimated_cache_write_usd: 0,
    pricing: 'catalog',
  })

  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toMatch(/re-writes ~400k tokens ≈ \$0\.25/)
})
