import type { Engine } from 'claude-code/testing'

export const PANE = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: 'subagent-tree',
    surface,
    component: 'Pane',
    requestId: 'subagent-tree',
    props: {
      title: 'Subagents',
      isFocused: true,
      bodyColumns: 80,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  }) as const

export const SURFACES = ['terminal', 'desktop'] as const

export type Listed = { id: string; description: string; type: string; status: string; parentId?: string }

export const subagent = (id: string, status = 'running', over: Partial<Listed> = {}): Listed => ({
  id,
  description: `task ${id}`,
  type: 'Explore',
  status,
  ...over,
})

export async function runStep($: Engine, agentId: string, index = 0) {
  const stream = $.turn.step({ turnId: `t-${agentId}`, index, model: 'claude-opus-5-5', messageCount: 1, agentId })
  for await (const _ of stream) {
    // the response's chunks are not under test
  }
}

export const done = (agentId: string, durationMs: number, outputTokens: number) =>
  ({
    answer: '',
    durationMs,
    isAborted: false,
    turnId: `t-${agentId}`,
    agentId,
    reason: 'answer',
    usage: {
      input_tokens: 10,
      output_tokens: outputTokens,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      model: 'claude-opus-5-5',
    },
  }) as const
