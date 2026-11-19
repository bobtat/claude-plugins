import type { EngineInterface, TurnCompleteInput } from 'claude-code'
import type { Tokens } from '../types'
import { cleanId } from './clean'
import { estimateUsd, priceOf, tokenCount } from './prices'
import { readRecord, saveRecord } from './records'

const BY_AGENT = { plugin: 'subagent-router', key: 'byAgent' } as const

type $ = EngineInterface

export async function addUsage($: $, e: TurnCompleteInput): Promise<void> {
  const usage = e.usage
  if (typeof e.agentId !== 'string' || typeof usage !== 'object' || usage === null) return
  const id = (await $.state.get({ ...BY_AGENT, id: e.agentId })).value
  if (typeof id !== 'string') return
  const rec = await readRecord($, id)
  if (rec === undefined) return
  // State can hold what another plugin or version wrote, and a string here would concatenate rather than add.
  const had: Partial<Record<keyof Tokens, unknown>> = typeof rec.tokens === 'object' && rec.tokens !== null ? rec.tokens : {}
  const hadUsd = typeof rec.usd === 'number' && Number.isFinite(rec.usd) ? rec.usd : null
  const price = priceOf(usage.model)
  await saveRecord($, id, {
    ...rec,
    tokens: {
      input: tokenCount(had.input) + tokenCount(usage.input_tokens),
      output: tokenCount(had.output) + tokenCount(usage.output_tokens),
      cacheRead: tokenCount(had.cacheRead) + tokenCount(usage.cache_read_input_tokens),
      cacheWrite: tokenCount(had.cacheWrite) + tokenCount(usage.cache_creation_input_tokens),
    },
    ran: cleanId(usage.model),
    usd: price === undefined ? hadUsd : (hadUsd ?? 0) + estimateUsd(usage, price),
  })
}
