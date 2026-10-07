import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { MockClock } from 'claude-code/testing'

export const NOW = new Date(2026, 9, 7, 12).getTime()
export const MIN = 60_000
export const LOG = '/home/someone/claude-costs/probe-2026-10-07-session1.jsonl'

export const usage = (input: number, cacheRead: number, cacheWrite: number, output: number) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: cacheWrite,
})

// The engine beneath the probe: each main-thread request answers 100k tokens of
// context, each fork answers with the next of `forks` (a cache hit by
// default), the running cost climbs by a cent per fork, and the log file is
// kept in memory.
export function engine(on: On, clock: MockClock, forks: ReturnType<typeof usage>[] = []) {
  const files = new Map<string, string>()
  const forked: number[] = []
  let costUsd = 1
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/home/someone' : undefined }))
  on('session.id', () => ({ value: 'session1-abcdef' }))
  on('session.version', () => ({ value: { version: '2.1.293' } }))
  on('session.usage', () => ({
    value: { startedAt: NOW, context: { window: 1_000_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 12.5 }], cost: { usd: costUsd } },
  }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('fs.exists', (_$, e) => ({ value: files.has(e.path) }))
  on('fs.read', (_$, e) => ({ value: files.get(e.path) ?? '' }))
  on('fs.write', (_$, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { ...usage(10, 90_000, 9_000, 990), model: 'claude-opus-5-5' },
    }
  })
  on('model.fork', () => {
    forked.push(clock.now())
    costUsd += 0.01
    return { value: { isAnswered: true, text: 'ok', usage: forks.shift() ?? usage(40, 100_000, 0, 3) } }
  })
  return { files, forked }
}

export async function turn($: Engine, turnId: string) {
  await $.turn.start({ turnId, text: 'read the billing module' })
  for await (const _ of $.turn.step({ turnId, index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // the response's chunks are not under test
  }
  await $.turn.complete({ answer: '', durationMs: 0, isAborted: false, turnId, reason: 'answer' })
}

export async function probe($: Engine, args: string) {
  const result = await $.command.run({
    command: 'probe',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })
  return 'text' in result ? String(result.text) : ''
}
