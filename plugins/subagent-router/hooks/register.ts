import type { AgentSpawnInput, AgentSpawnResult, EngineInterface, Next as NextOf, NextResult, Register, TurnCompleteInput } from 'claude-code'
import type { DecisionRecord, Family, Kind, Outcome, PickResult, Route, Settings } from '../types'
import { clean } from './clean'
import { anyRouteApplies, factsOf, precheck, resolve } from './decide'
import { familyOf, ranksBelow } from './model-rank'
import { DENY_TEXT, NO_RESUME, endsWithMarker, routerNote } from './note'
import { pickKind } from './picker'
import { estimateUsd, priceOf, tokenCount } from './prices'
import { bump, newRecord, readRecord, saveRecord } from './records'
import { readSettings } from './settings'

const ROUTED = { plugin: 'subagent-router', key: 'routed' } as const
const OBSERVED = { plugin: 'subagent-router', key: 'observed' } as const
const BASELINE = { plugin: 'subagent-router', key: 'baseline' } as const
const ROUTE_OFF = { plugin: 'subagent-router', key: 'routeOff' } as const
const BY_AGENT = { plugin: 'subagent-router', key: 'byAgent' } as const
const PICKER_OFF = { plugin: 'subagent-router', key: 'pickerOff' } as const

const DESCRIPTION_MAX = 120
const ID_MAX = 80
const LINE_MAX = 160
const MAX_ROWS = 4096
const FAILURES_TO_SWITCH_OFF = 3

type $ = EngineInterface
type Next = NextOf<'agent.spawn'>
type Answer = NextResult<'agent.spawn'>
type Started = AgentSpawnResult & { agentId: string }
type Spawner = { wasRouted: boolean; entry: unknown; isObserved: boolean }
type Routes = { locating: Route; reading: Route }
type Choice = { kind: Kind | null; target: Family | null; reason: string }
type Settled = { done: DecisionRecord; routeTurnedOff: boolean }

// Picker failures in a row. Ticks order call starts and ends, so failures whose calls overlap count once.
let failuresInARow = 0
let tick = 0
let lastCountedFailureEnded = -1

function isStarted(result: Answer): result is Started {
  return typeof result === 'object' && result !== null && !('deny' in result) && typeof result.agentId === 'string' && result.agentId !== ''
}

const modelOf = (result: Answer): string | undefined =>
  typeof result === 'object' && result !== null && 'model' in result && typeof result.model === 'string' && result.model !== ''
    ? result.model
    : undefined

const cleanId = (value: unknown): string | null => clean(value, ID_MAX) || null

function log($: $, line: string): void {
  try {
    $.ui.log(clean(line, LINE_MAX))
  } catch {
    // A line that cannot be shown changes nothing about the spawn.
  }
}

async function draft($: $, e: AgentSpawnInput, fields: { kind: Kind | null; outcome: Outcome; reason: string; target: Family | null }): Promise<DecisionRecord> {
  return {
    v: 1,
    at: await $.clock.now(),
    agentType: clean(e.subagentType, ID_MAX),
    description: clean(e.description, DESCRIPTION_MAX),
    ...fields,
    overridden: false,
    started: null,
    ran: null,
    agentId: null,
    tokens: null,
    usd: null,
  }
}

// For a spawner the session's state does not know, as after a session is closed and reopened.
async function looksRouted($: $, e: AgentSpawnInput): Promise<boolean> {
  try {
    if (typeof e.parentAgentId !== 'string') return false
    // A spawner on the main model's family or dearer was not moved; this keeps the read off the common path.
    if (!ranksBelow(e.parentModel, await $.session.model())) return false
    const rows = await $.session.messages({ agentId: e.parentAgentId })
    // A full page is the newest rows, so its first row is not the agent's first message.
    if (!Array.isArray(rows) || rows.length === 0 || rows.length >= MAX_ROWS) return false
    return endsWithMarker(rows[0]?.text ?? '')
  } catch {
    return false
  }
}

async function spawnerOf($: $, e: AgentSpawnInput): Promise<Spawner> {
  const none = { wasRouted: false, entry: undefined, isObserved: false }
  if (typeof e.parentAgentId !== 'string') return none
  // An unreadable entry counts as one state does not know, so the marker check still decides, as after a resume;
  // letting the read fail the hook would pass a routed agent's child on.
  const unknown = () => undefined
  const routed = await $.state.get({ ...ROUTED, id: e.parentAgentId }).then((read) => read.value, unknown)
  if (routed !== undefined) return { wasRouted: true, entry: routed, isObserved: false }
  const observed = await $.state.get({ ...OBSERVED, id: e.parentAgentId }).then((read) => read.value, unknown)
  if (observed !== undefined) return { ...none, isObserved: true }
  return { ...none, wasRouted: await looksRouted($, e) }
}

// Resolves whether the write landed; a failed write never stops the ones after it.
async function attempt(write: () => Promise<unknown>): Promise<boolean> {
  try {
    await write()
    return true
  } catch {
    return false
  }
}

// The refusal is returned even when recording it fails: the rule must hold whatever state can be written.
async function refuse($: $, e: AgentSpawnInput): Promise<{ deny: string }> {
  await attempt(async () => {
    const rec = await draft($, e, { kind: null, outcome: 'refused', reason: 'spawner-routed', target: null })
    await newRecord($, rec)
  })
  // A refusal is an action the router takes, so it is shown in every mode, observe included.
  log($, `Refused a spawn by an agent subagent-router moved to a cheaper model: ${clean(e.description, DESCRIPTION_MAX)}`)
  return { deny: DENY_TEXT }
}

async function passOn($: $, e: AgentSpawnInput, next: Next, settings: Settings, spawner: Spawner): Promise<Answer> {
  if (settings.mode !== 'off' && settings.standingDown === null) await bump($, 'outOfScope')
  const result = await next(e)
  if (e.fork === true && spawner.wasRouted && isStarted(result)) {
    // A fork is the routed agent continuing, so its own spawns must be refused too. A spawner known only by
    // its marker has no entry to copy, so one is built: refusing must not depend on what state remembered.
    const entry = spawner.entry ?? { v: 1, target: familyOf(e.parentModel) ?? 'haiku', baseline: '' }
    await attempt(() => $.state.set({ ...ROUTED, id: result.agentId }, entry as never))
  }
  return result
}

async function leaveExplicit($: $, e: AgentSpawnInput, next: Next): Promise<Answer> {
  const rec = await draft($, e, { kind: null, outcome: 'unchanged', reason: 'explicit', target: null })
  const id = await newRecord($, rec)
  const result = await next(e)
  if (!isStarted(result)) {
    await attempt(() => saveRecord($, id, { ...rec, outcome: 'not-started' }))
    return result
  }
  const agentId = result.agentId
  if (await attempt(() => saveRecord($, id, { ...rec, started: cleanId(modelOf(result)), agentId }))) {
    await attempt(() => $.state.set({ ...BY_AGENT, id: agentId }, id))
  }
  return result
}

async function routesNow($: $, settings: Settings): Promise<Routes> {
  const [locating, reading] = await Promise.all([
    $.state.get({ ...ROUTE_OFF, id: 'locating' }),
    $.state.get({ ...ROUTE_OFF, id: 'reading' }),
  ])
  return {
    locating: locating.value === undefined ? settings.routes.locating : 'parent',
    reading: reading.value === undefined ? settings.routes.reading : 'parent',
  }
}

// Only failures whose call began after the last counted one ended count, so spawns that fail together count once.
async function pickCounted($: $, prompt: string): Promise<PickResult> {
  const began = ++tick
  const pick = await pickKind((request) => $.model.complete(request), prompt)
  const ended = ++tick
  if (pick.reason === 'timeout' || pick.reason === 'error') {
    if (began > lastCountedFailureEnded) {
      failuresInARow += 1
      lastCountedFailureEnded = ended
      if (failuresInARow >= FAILURES_TO_SWITCH_OFF) await $.state.set(PICKER_OFF, true).catch(() => undefined)
    }
  } else if (pick.reason !== 'aborted') {
    // An abort is the person pressing Escape, which says nothing about the picker.
    failuresInARow = 0
  }
  return pick
}

async function choose($: $, e: AgentSpawnInput, mode: Settings['mode'], routes: Routes, baseline: string | undefined): Promise<Choice> {
  if (mode === 'route' && !anyRouteApplies(routes, baseline)) {
    const known = baseline !== undefined && familyOf(baseline) !== undefined
    return { kind: null, target: null, reason: known ? 'no-route-applies' : 'baseline-unknown' }
  }
  if ((await $.state.get(PICKER_OFF)).value === true) return { kind: null, target: null, reason: 'picker-off' }
  const pick = await pickCounted($, e.prompt)
  const resolution = resolve(pick.kind, routes, baseline)
  const target = resolution.action === 'route' ? resolution.target : null
  const reason = pick.reason !== 'answered' ? pick.reason : resolution.action === 'route' ? pick.kind : resolution.reason
  return { kind: pick.kind, target, reason }
}

// After next has answered. The writes that carry a decision forward (routed, routeOff, baseline, observed) come
// first and each stands alone, so no failure of bookkeeping can release a routed agent or keep a failed route on.
// The record follows, and byAgent only once the record is saved, so the cost hook finds only a finished record.
async function settle($: $, a: { id: string; rec: DecisionRecord; result: Answer; rewrote: boolean; baseline: string; baselineId: string }): Promise<Settled> {
  const { id, rec, result, rewrote, baseline, baselineId } = a
  if (!isStarted(result)) {
    const notStarted: DecisionRecord = { ...rec, outcome: 'not-started' }
    await attempt(() => saveRecord($, id, notStarted))
    return { done: notStarted, routeTurnedOff: false }
  }
  const agentId = result.agentId
  let routeTurnedOff = false
  const model = modelOf(result)
  const target = rec.target
  const overridden = rewrote && model !== undefined && familyOf(model) !== target
  if (!rewrote) {
    if (model !== undefined) await attempt(() => $.state.set({ ...BASELINE, id: baselineId }, model))
    if (rec.outcome === 'would-route') await attempt(() => $.state.set({ ...OBSERVED, id: agentId }, { v: 1 }))
  } else if (target !== null && rec.kind !== null) {
    const kind = rec.kind
    // A start that names no model cannot show the move failed, so the agent is kept as routed and the route is
    // turned off: both are the cautious reading.
    if (model === undefined || ranksBelow(model, baseline)) {
      await attempt(() => $.state.set({ ...ROUTED, id: agentId }, { v: 1, target, baseline }))
    }
    if (!ranksBelow(model, baseline)) routeTurnedOff = await attempt(() => $.state.set({ ...ROUTE_OFF, id: kind }, true))
  }
  const done: DecisionRecord = { ...rec, started: cleanId(model), agentId, overridden }
  if (await attempt(() => saveRecord($, id, done))) await attempt(() => $.state.set({ ...BY_AGENT, id: agentId }, id))
  return { done, routeTurnedOff }
}

// The line never says an agent was routed to a model it is not on.
function routedLine(done: DecisionRecord, routeTurnedOff: boolean): string {
  if (done.started !== null && !done.overridden) return `Routed to ${done.target} as a ${done.kind} task: ${done.description}`
  const started = done.started ?? 'a model the start did not name'
  const off = routeTurnedOff ? `; the ${done.kind} route is off for this session` : ''
  return `Asked for ${done.target}, but the agent started on ${started}${off}: ${done.description}`
}

async function pickAndRoute($: $, e: AgentSpawnInput, next: Next, settings: Settings): Promise<Answer> {
  const baselineId = `${e.subagentType}|${e.parentModel}`
  const stored = (await $.state.get({ ...BASELINE, id: baselineId })).value
  const baseline = typeof stored === 'string' ? stored : undefined
  const routes = await routesNow($, settings)
  const choice = await choose($, e, settings.mode, routes, baseline)
  const rewrites = settings.mode === 'route' && choice.target !== null
  const outcome: Outcome = choice.target === null ? 'unchanged' : rewrites ? 'routed' : 'would-route'
  const rec = await draft($, e, { kind: choice.kind, outcome, reason: choice.reason, target: choice.target })
  // Written before next, so a spawn whose hook fails later still has a row saying what was intended.
  const id = await newRecord($, rec)

  const result = await next(
    rewrites && choice.target !== null && choice.kind !== null
      ? { ...e, model: choice.target, prompt: e.prompt + '\n\n' + routerNote({ target: choice.target, baseline: baseline ?? '', kind: choice.kind, noResume: NO_RESUME }) }
      : e,
  )
  try {
    const { done, routeTurnedOff } = await settle($, { id, rec, result, rewrote: rewrites, baseline: baseline ?? '', baselineId })
    if (done.outcome === 'routed') log($, routedLine(done, routeTurnedOff))
  } catch {
    // The spawn has started; nothing here may start it again.
  }
  return result
}

async function onSpawn($: $, e: AgentSpawnInput, next: Next): Promise<Answer> {
  const settings = await readSettings($)
  const spawner = await spawnerOf($, e)
  const facts = factsOf(e, next.origin, { mode: settings.mode, standingDown: settings.standingDown !== null, spawnerWasRouted: spawner.wasRouted })
  const verdict = precheck(facts)
  if (verdict === 'deny') return refuse($, e)
  if (spawner.isObserved && !facts.isFork && !facts.isResume && settings.mode !== 'off' && settings.standingDown === null) {
    await bump($, 'wouldRefuse')
  }
  if (verdict === 'pass') return passOn($, e, next, settings, spawner)
  if (verdict === 'explicit') return leaveExplicit($, e, next)
  return pickAndRoute($, e, next, settings)
}

async function addUsage($: $, e: TurnCompleteInput): Promise<void> {
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

export const register: Register = (on) => {
  // Before next was called this passes the spawn on unchanged; after, next(e) replays what that call settled
  // to (next.called), so a failure never starts a second agent.
  on('agent.spawn', onSpawn).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    try {
      await addUsage($, e)
    } catch {
      // A cost that cannot be recorded changes nothing about the turn.
    }
    return next(e)
  }).catch(($, e, next) => next(e))
}
