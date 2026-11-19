import type { StateDollar } from 'claude-code'
import type { DecisionRecord, Index } from '../types'

const INDEX = { plugin: 'subagent-router', key: 'index' } as const
const DECISION = { plugin: 'subagent-router', key: 'decision' } as const

// Once loaded, the index lives here while the module does, and nothing reads it back from state to change it:
// spawns of one turn interleave, and a read-change-write of a shared list would lose entries.
let held: Index | undefined
// What was gathered while no load had succeeded. It is never written on its own, so a stored index is never
// replaced by a partial one; a successful load merges it in.
let gathered: Index = empty()
let loading: Promise<Index | undefined> | undefined
let writes: Promise<void> = Promise.resolve()

function empty(): Index {
  return { v: 1, ids: [], outOfScope: 0, wouldRefuse: 0 }
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0

function asIndex(value: unknown): Index {
  if (typeof value !== 'object' || value === null) return empty()
  const v = value as Partial<Index>
  if (v.v !== 1 || !Array.isArray(v.ids)) return empty()
  return {
    v: 1,
    ids: v.ids.filter((id): id is string => typeof id === 'string'),
    outOfScope: isCount(v.outOfScope) ? v.outOfScope : 0,
    wouldRefuse: isCount(v.wouldRefuse) ? v.wouldRefuse : 0,
  }
}

function merged(stored: Index, extra: Index): Index {
  return {
    v: 1,
    ids: [...stored.ids, ...extra.ids.filter((id) => !stored.ids.includes(id))],
    outOfScope: stored.outOfScope + extra.outOfScope,
    wouldRefuse: stored.wouldRefuse + extra.wouldRefuse,
  }
}

// A hot reload keeps state and resets the module, so the index is read from state until one read succeeds.
// A failed read is not cached: it says nothing about what is stored.
async function loaded($: StateDollar): Promise<Index | undefined> {
  if (held !== undefined) return held
  const read = (loading ??= $.state.get(INDEX).then(
    (r) => asIndex(r.value),
    () => undefined,
  ))
  const stored = await read
  if (loading === read) loading = undefined
  if (stored === undefined || held !== undefined) return held
  const hadGathered = gathered.ids.length > 0 || gathered.outOfScope > 0 || gathered.wouldRefuse > 0
  held = merged(stored, gathered)
  gathered = empty()
  if (hadGathered) await persist($)
  return held
}

// Each write carries the whole index as it stands when the write runs. The writes are chained so they land in
// order, and each link swallows its own failure so one refused write does not stop the ones after it.
function persist($: StateDollar): Promise<void> {
  writes = writes
    .then(() => {
      if (held === undefined) return undefined
      return $.state.set(INDEX, { ...held, ids: [...held.ids] })
    })
    .then(
      () => undefined,
      () => undefined,
    )
  return writes
}

async function change($: StateDollar, apply: (index: Index) => void): Promise<void> {
  await loaded($)
  // Read again after the await: another hook's load may have succeeded meanwhile and merged what was gathered.
  apply(held ?? gathered)
  if (held !== undefined) await persist($)
}

export async function newRecord($: StateDollar, rec: DecisionRecord): Promise<string> {
  const id = crypto.randomUUID()
  await $.state.set({ ...DECISION, id }, rec)
  await change($, (index) => index.ids.push(id))
  return id
}

export async function saveRecord($: StateDollar, id: string, rec: DecisionRecord): Promise<void> {
  await $.state.set({ ...DECISION, id }, rec)
}

export async function readRecord($: StateDollar, id: string): Promise<DecisionRecord | undefined> {
  const { value } = await $.state.get({ ...DECISION, id })
  return typeof value === 'object' && value !== null && value.v === 1 ? value : undefined
}

export async function bump($: StateDollar, field: 'outOfScope' | 'wouldRefuse'): Promise<void> {
  await change($, (index) => {
    index[field] += 1
  })
}

export async function snapshot($: StateDollar): Promise<{ records: unknown[]; outOfScope: number; wouldRefuse: number }> {
  await loaded($)
  const index = held ?? gathered
  const records = await Promise.all(index.ids.map(async (id) => (await $.state.get({ ...DECISION, id })).value))
  return { records, outOfScope: index.outOfScope, wouldRefuse: index.wouldRefuse }
}
