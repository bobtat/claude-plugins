import { expect, mock, test } from 'claude-code/testing'

import { priceUsage, rateTable, ratesFor } from '../hooks/pricing'

const NOW = new Date(2026, 9, 6, 12).getTime()

const usage = (cacheRead: number, cacheWrite: number) => ({
  input_tokens: 1_000,
  output_tokens: 2_000,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: cacheWrite,
})

test('a Bedrock model id finds its family, not a shorter one it contains', async () => {
  const table = rateTable('')
  expect(ratesFor(table, 'us.anthropic.claude-opus-5-5-v1:0')?.cacheRead).toBe(0.2)
  expect(ratesFor(table, 'anthropic.claude-opus-5')?.cacheRead).toBe(0.5)
  expect(ratesFor(table, 'some-other-model')).toBeUndefined()
})

test('cache writes are priced at the rate of the cache lifetime', async () => {
  const rates = ratesFor(rateTable(''), 'claude-opus-5-5')
  const fiveMinutes = priceUsage(usage(0, 1_000_000), rates, '5m')
  const oneHour = priceUsage(usage(0, 1_000_000), rates, '1h')

  expect(Math.round(fiveMinutes.usd.cacheWrite * 100) / 100).toBe(5)
  expect(Math.round(oneHour.usd.cacheWrite * 100) / 100).toBe(8)
})

test('overridden rates replace only the fields given', async () => {
  const table = rateTable('{"opus-5-5": {"cacheRead": 0.22}}')
  const rates = ratesFor(table, 'claude-opus-5-5')

  expect(rates?.cacheRead).toBe(0.22)
  expect(rates?.input).toBe(4)
})

test('rates that are not JSON fall back to list prices and say so', async () => {
  const table = rateTable('{opus')

  expect(table.error).toBeDefined()
  expect(ratesFor(table, 'claude-opus-5-5')?.input).toBe(4)
})

test('a large cache write and a prompt after the cache expired each raise a toast', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('session.id', () => ({ value: 'test-session' }))
  on('session.root', () => ({ value: 'C:/work/billing-api' }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { ...usage(0, 150_000), model: 'claude-opus-5-5' },
    }
  })
  on('prompt.submit', (_$, e) => ({ text: e.text }))

  const step = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
  for await (const _ of step) {
    // the response's chunks are not under test
  }
  await step.result

  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toMatch(/150k tokens .*\$0\.75/)

  await clock.advance(4 * 60_000)
  await $.prompt.submit({ text: 'still warm', wait: false, origin: { kind: 'composer' } })
  expect(toasts).toHaveLength(1)

  await clock.advance(8 * 60_000)
  await $.prompt.submit({ text: 'gone cold', wait: false, origin: { kind: 'composer' } })
  expect(toasts).toHaveLength(2)
  expect(toasts[1]).toMatch(/idle 12 min, 5m cache.*153k tokens/)
})
