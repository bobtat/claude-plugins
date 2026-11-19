import type { EngineInterface, TurnCompleteInput } from 'claude-code'
import { estimateUsd, priceOf, tokenCount } from './prices'
import { readRecord, saveRecord } from './records'
import { cleanId } from './spawn'

const BY_AGENT = { plugin: 'subagent-router', key: 'byAgent' } as const

type $ = EngineInterface

export async function addUsage($: $, e: TurnCompleteInput): Promise<void> {
  const usage = e.usage
  if (typeof e.agentId !== 'string' || typeof usage !== 'object' || usage === null) return
  const id = (await $.state.get({ ...BY_AGENT, id: e.agentId })).value
  if (typeof id !== 'string') return
  const rec = await readRecord($, id)
  if (rec === undefined) return
  const had = rec.tokens ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  const price = priceOf(usage.model)
  await saveRecord($, id, {
    ...rec,
    tokens: {
      input: had.input + tokenCount(usage.input_tokens),
      output: had.output + tokenCount(usage.output_tokens),
      cacheRead: had.cacheRead + tokenCount(usage.cache_read_input_tokens),
      cacheWrite: had.cacheWrite + tokenCount(usage.cache_creation_input_tokens),
    },
    ran: cleanId(usage.model),
    usd: price === undefined ? rec.usd : (rec.usd ?? 0) + estimateUsd(usage, price),
  })
}
