import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { addSpend, addUsage } from '../hooks/ledger'
import type { SessionEntry } from '../hooks/ledger'

export const NOW = new Date(2026, 9, 6, 12).getTime()
export const DAY = 24 * 60 * 60 * 1000
export const ROOT = 'C:/work/billing-api'

export const usage = (cacheRead: number, cacheWrite: number, output = 0) => ({
  input_tokens: 0,
  output_tokens: output,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: cacheWrite,
})

export const PANE = {
  plugin: 'cost-ledger',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'cost-ledger',
  props: {
    title: 'Costs',
    isFocused: true,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 120 },
    view: {},
  },
} as const

// The engine beneath the plugin. Model requests are answered with the given
// usages in order, as the API would, by the given model; toasts are collected.
// Claude Code's running total is `session.usd`, which a test may move.
export function engine(on: On, steps: ReturnType<typeof usage>[] = [], model = 'claude-opus-5-5', session = { usd: 1 }) {
  const toasts: string[] = []
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { ...(steps.shift() ?? usage(0, 0)), model },
    }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.root', () => ({ value: ROOT }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: [], cost: { usd: session.usd } } }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  return toasts
}

export const measure = (usd: number) => ({
  context: { window: 200_000 },
  rateLimits: [],
  cost: { usd },
  changed: ['cost' as const],
})

export async function runStep($: Engine, turnId: string, agentId?: string) {
  const stream = $.turn.step({ turnId, index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId })
  for await (const _ of stream) {
    // the response's chunks are not under test
  }
}

export const complete = (turnId: string, agentId?: string) =>
  ({ answer: '', durationMs: 0, isAborted: false, turnId, agentId, reason: 'answer' }) as const

// A stored session that Claude Code totalled at `total` today and whose
// requests the mod priced at `estimated`.
export const spentSession = (total: number, estimated: number): SessionEntry =>
  addUsage(
    addSpend(undefined, NOW, total, ROOT),
    NOW,
    { tokens: { input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 0 }, usd: { input: 0, output: 0, cacheRead: estimated, cacheWrite: 0 }, unpricedTokens: 0 },
    ROOT,
    false,
  )

// The plugin's store as a map the test can also read and write, the way
// another session sharing the store file would.
export function memoryStore(on: On, entries: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(entries))
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.delete', (_$, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  return store
}
