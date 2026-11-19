import { expect, test } from 'claude-code/testing'
import { estimateUsd, priceOf } from './prices'
import { records, spawner, world } from './test-support'

// --- cost ---

test('usage reported for a recorded agent is added to its record', async ($, on) => {
  const w = world(on)
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  const spawn = spawner($)
  await spawn()
  const usage = { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' }
  const price = priceOf('claude-opus-5-5')
  const usd = price === undefined ? Number.NaN : estimateUsd(usage, price)

  const end = (agentId: string, turnUsage: typeof usage | undefined) =>
    $.turn.complete({ agentId, turnId: 't1', reason: 'answer', isAborted: false, answer: `done ${agentId}`, durationMs: 1, usage: turnUsage })

  expect((await end('a1', usage)).text).toBe('done a1')
  expect(records(w)[0]).toEqual(expect.objectContaining({
    tokens: { input: 100, output: 10, cacheRead: 1000, cacheWrite: 0 }, ran: 'claude-opus-5-5', usd,
  }))

  await end('a1', usage)
  expect(records(w)[0]).toEqual(expect.objectContaining({ tokens: { input: 200, output: 20, cacheRead: 2000, cacheWrite: 0 }, usd: usd * 2 }))

  await end('a1', { ...usage, model: 'made-up-model' })
  expect(records(w)[0]).toEqual(expect.objectContaining({
    tokens: { input: 300, output: 30, cacheRead: 3000, cacheWrite: 0 }, ran: 'made-up-model', usd: usd * 2,
  }))

  const writes = w.sets.length
  expect((await end('nobody', usage)).text).toBe('done nobody')
  expect((await end('a1', undefined)).text).toBe('done a1')
  expect(w.sets.length).toBe(writes)
})
