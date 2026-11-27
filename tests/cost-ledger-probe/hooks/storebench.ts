import type { EngineInterface } from 'claude-code'

// Times the engine's plugin store at the sizes cost-ledger's own store
// reaches. cost-ledger reads and writes its session's entry on every tool call
// and model request and rereads every entry at each cost measurement, so what
// those cost is what the mod adds to a session.

export const BENCH_PREFIX = 'bench:'

// About what one session's entry weighs in cost-ledger's store.
const ENTRY_BYTES = 8_000

const key = (i: number) => `${BENCH_PREFIX}session-${i}`

const entry = (i: number) => ({ project: 'C:/work/billing-api', updatedAt: i, days: { '2026-10-06': 1.25 }, filler: 'x'.repeat(ENTRY_BYTES) })

type Timing = { mean: number; worst: number }

async function timed(times: number, task: () => Promise<unknown>): Promise<Timing> {
  let worst = 0
  const began = performance.now()
  for (let i = 0; i < times; i++) {
    const at = performance.now()
    await task()
    worst = Math.max(worst, performance.now() - at)
  }
  return { mean: (performance.now() - began) / times, worst }
}

const ms = (t: Timing) => `${t.mean.toFixed(2)} ms mean, ${t.worst.toFixed(1)} ms worst`

async function benchAt($: EngineInterface, sessions: number): Promise<string[]> {
  for (let i = 0; i < sessions; i++) await $.store.set(key(i), entry(i))
  const get = await timed(200, () => $.store.get(key(0)))
  const set = await timed(100, () => $.store.set(key(0), entry(0)))
  const getSet = await timed(100, async () => {
    const got = (await $.store.get(key(0))) as ReturnType<typeof entry>
    await $.store.set(key(0), { ...got, updatedAt: 1 })
  })
  const everyEntry = await timed(20, async () => {
    const keys = (await $.store.keys()).filter(k => k.startsWith(BENCH_PREFIX))
    await Promise.all(keys.map(k => $.store.get(k)))
  })
  return [
    `${sessions} sessions (~${Math.round((sessions * ENTRY_BYTES) / 1024)} KiB):`,
    `  get one entry            ${ms(get)}`,
    `  set one entry            ${ms(set)}`,
    `  get then set             ${ms(getSet)}`,
    `  keys + get every entry   ${ms(everyEntry)}`,
  ]
}

// Fills the store to each size in turn, smallest first, and removes what it
// wrote whether or not the run finishes. A store that refuses a write ends the
// run with what was timed up to then.
export async function storeBench($: EngineInterface, sizes: readonly number[]): Promise<string> {
  const lines: string[] = []
  try {
    for (const sessions of [...sizes].sort((a, b) => a - b)) lines.push(...(await benchAt($, sessions)))
  } catch (error) {
    lines.push(`Stopped: ${String(error)}`)
  } finally {
    for (const k of await $.store.keys()) if (k.startsWith(BENCH_PREFIX)) await $.store.delete(k)
  }
  return lines.join('\n')
}
