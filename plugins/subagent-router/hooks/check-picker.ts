import type { CommandRunInput, CommandRunResult, EngineInterface } from 'claude-code'
import type { Kind } from '../types'
import { clean, jsonOf } from './clean'
import { GATE_LIMITS, GATE_SET_DIGEST } from './picker-gate'
import { MAX_PROMPT, PICKER_SYSTEM, REPLY_MAX_TOKENS, buildUserMessage, pickKind, unpickable } from './picker'
import { priceOf } from './prices'
import { offenders, renderCheck, scoreRun, setDigest, sizesOf, wrongSizesOf } from './report'

const CHECK_STARTED_AT = { plugin: 'subagent-router', key: 'checkStartedAt' } as const

const LINE_MAX = 160
const NAME_MAX = 40
const ERROR_MAX = 80
const AT_ONCE = 6
const STALE_MS = 10 * 60 * 1000
const PREFIX = 'subagent-router check-picker:'
const CONFIRM = '/subagent-router check-picker confirm'
const EXPECTED = new Map<unknown, Kind>([['haiku', 'locating'], ['sonnet', 'reading'], ['inherit', 'other']])

type $ = EngineInterface
export type PickerItem = { id: string; sid: string; prompt: string; expected: Kind; injected: boolean }
type PickerSet = { items: PickerItem[] } | { problem: string }

// The run in this load, beside checkStartedAt for runs in other loads. It expires by the same ten-minute rule, so a
// run whose model calls never settle cannot block the check for the rest of the load.
let running: { since: number } | undefined

const isRecent = (since: number, now: number) => now - since >= 0 && now - since <= STALE_MS

const say = (text: string): CommandRunResult => ({ text, isTextDisplayOnly: true })
const line = (text: string) => clean(`${PREFIX} ${text}`, LINE_MAX)
const named = (value: unknown) => clean(value, NAME_MAX)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isName = (value: unknown): value is string => typeof value === 'string' && value !== ''

function rowsOf(text: string, file: string): unknown[] | string {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return `${file} is not JSON`
  }
  return Array.isArray(value) && value.length > 0 ? value : `${file} is not a list of rows`
}

// pickKind answers such a prompt with no model call, so scoring it would count a result the picker never gave.
function unpickedProblem(id: string, prompt: string): string | undefined {
  const why = unpickable(prompt)
  if (why === undefined) return undefined
  const what = why === 'too-long' ? `is over ${MAX_PROMPT} code points` : 'is empty once hidden characters are removed'
  return `prompt ${named(id)} ${what}, so the picker is never asked about it`
}

// Any row that breaks a rule rejects the whole set: a partial set would score as a smaller gate that still passes.
export function parsePickerSet(texts: { scenarios: string; prompts: string; injection: string }): PickerSet {
  const scenarios = rowsOf(texts.scenarios, 'scenarios.json')
  if (typeof scenarios === 'string') return { problem: scenarios }
  const expectedOf = new Map<string, Kind>()
  for (const [i, s] of scenarios.entries()) {
    if (!isRecord(s) || !isName(s.id)) return { problem: `scenarios.json row ${i + 1} has no id` }
    const expected = EXPECTED.get(s.expected)
    if (expected === undefined) {
      const shown = typeof s.expected === 'string' ? s.expected : jsonOf(s.expected)
      return { problem: `scenario ${named(s.id)} expects ${named(shown)}, not haiku, sonnet or inherit` }
    }
    if (expectedOf.has(s.id)) return { problem: `scenario ${named(s.id)} appears twice in scenarios.json` }
    expectedOf.set(s.id, expected)
  }

  const prompts = rowsOf(texts.prompts, 'prompts.json')
  if (typeof prompts === 'string') return { problem: prompts }
  const items: PickerItem[] = []
  // A duplicate id would let a set keep every size while one prompt is scored twice; a prompt whose text changed under
  // the same id is caught by the set's digest instead.
  const pids = new Set<string>()
  for (const [i, p] of prompts.entries()) {
    if (!isRecord(p) || !isName(p.pid) || !isName(p.sid) || typeof p.prompt !== 'string') return { problem: `prompts.json row ${i + 1} lacks a pid, sid or prompt` }
    if (pids.has(p.pid)) return { problem: `prompt ${named(p.pid)} appears twice in prompts.json` }
    pids.add(p.pid)
    const expected = expectedOf.get(p.sid)
    if (expected === undefined) return { problem: `prompt ${named(p.pid)} names scenario ${named(p.sid)}, which scenarios.json does not have` }
    const skipped = unpickedProblem(p.pid, p.prompt)
    if (skipped !== undefined) return { problem: skipped }
    items.push({ id: p.pid, sid: p.sid, prompt: p.prompt, expected, injected: false })
  }

  const injection = rowsOf(texts.injection, 'injection.json')
  if (typeof injection === 'string') return { problem: injection }
  const injectionIds = new Set<string>()
  for (const [i, p] of injection.entries()) {
    if (!isRecord(p) || !isName(p.id) || typeof p.prompt !== 'string') return { problem: `injection.json row ${i + 1} lacks an id or prompt` }
    if (injectionIds.has(p.id)) return { problem: `injection ${named(p.id)} appears twice in injection.json` }
    injectionIds.add(p.id)
    const skipped = unpickedProblem(p.id, p.prompt)
    if (skipped !== undefined) return { problem: skipped }
    items.push({ id: p.id, sid: p.id, prompt: p.prompt, expected: 'other', injected: true })
  }
  return { items }
}

async function readData($: $, file: string): Promise<string | { problem: string }> {
  try {
    const text = await $.fs.read(`${$.plugin.root}/data/picker-set/${file}`)
    return typeof text === 'string' ? text : { problem: `${file} could not be read` }
  } catch (error) {
    return { problem: `${file} could not be read (${clean(error, ERROR_MAX)})` }
  }
}

async function loadSet($: $): Promise<PickerSet> {
  const [scenarios, prompts, injection] = await Promise.all([readData($, 'scenarios.json'), readData($, 'prompts.json'), readData($, 'injection.json')])
  for (const text of [scenarios, prompts, injection]) if (typeof text !== 'string') return text
  return parsePickerSet({ scenarios: scenarios as string, prompts: prompts as string, injection: injection as string })
}

async function settles(write: () => Promise<unknown>): Promise<boolean> {
  try {
    await write()
    return true
  } catch {
    return false
  }
}

async function eachAtMost<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await work(items[i] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// Each call goes straight to pickKind, not through the spawn hook's counter: a failing check must not switch the
// picker off for the session's spawns.
async function runSet($: $, items: PickerItem[]): Promise<string> {
  const rows = await eachAtMost(items, AT_ONCE, async (item) => {
    const pick = await pickKind((request) => $.model.complete(request), item.prompt)
    return { id: item.id, sid: item.sid, expected: item.expected, got: pick.kind, reason: pick.reason, injected: item.injected }
  })
  return [line(`${rows.length} picker calls made`), renderCheck(scoreRun(rows), offenders(rows), setDigest(items))].join('\n')
}

// The delimiter pickKind draws is twelve characters; any twelve give the same length.
const DELIMITER_LENGTH = 12

// Four characters a token, over the system text and the whole message as sent, so the figures follow the set. The
// output is counted at its cap, so the estimate does not fall short of a run whose replies are one word.
function costOf(items: PickerItem[]): { perCall: number; usd: number | undefined } {
  const delimiter = 'x'.repeat(DELIMITER_LENGTH)
  const input = items.reduce((sum, item) => sum + (PICKER_SYSTEM.length + buildUserMessage(item.prompt, delimiter).length) / 4, 0)
  const perCall = items.length === 0 ? 0 : Math.round(input / items.length / 50) * 50
  const price = priceOf('claude-haiku-5-5')
  const usd = price === undefined ? undefined : (input * price.input + items.length * REPLY_MAX_TOKENS * price.output) / 1_000_000
  return { perCall, usd }
}

function costText(usd: number | undefined): string {
  if (usd === undefined) return 'Estimated cost: not known, as Haiku 5.5 has no listed price.'
  const shown = usd < 0.005 ? 'under $0.01' : `about $${usd.toFixed(2)}`
  return `Estimated cost: ${shown} at the listed Haiku 5.5 price, with each reply counted at its ${REPLY_MAX_TOKENS}-token cap.`
}

async function describe($: $): Promise<CommandRunResult> {
  const set = await loadSet($)
  if ('problem' in set) return say(line(`${set.problem}, so the check cannot run.`))
  const sizes = sizesOf(set.items)
  const shipped = GATE_LIMITS.sizes
  const cost = costOf(set.items)
  const lines = [
    line(`a run makes ${set.items.length} Haiku calls, one per prompt in the regression set, about ${String(cost.perCall).replace(/\B(?=(\d{3})+(?!\d))/gu, ',')} input tokens per call on average.`),
    clean(costText(cost.usd), LINE_MAX),
    clean(`Set sizes: ofGuarded ${sizes.ofGuarded}, ofRoutable ${sizes.ofRoutable}, ofReading ${sizes.ofReading}, ofInjected ${sizes.ofInjected}, total ${sizes.total}`, LINE_MAX),
  ]
  if (wrongSizesOf(sizes).length > 0) {
    const list = `ofGuarded ${shipped.ofGuarded}, ofRoutable ${shipped.ofRoutable}, ofReading ${shipped.ofReading}, ofInjected ${shipped.ofInjected}, total ${shipped.total}`
    lines.push(clean(`This is not the shipped set (shipped: ${list}), so a run on it will not be a result.`, LINE_MAX))
  } else if (setDigest(set.items) !== GATE_SET_DIGEST) {
    lines.push(clean('This is not the shipped set: its sizes match, but its prompts differ from the set hooks/picker-gate.ts names, so a run on it will not be a result.', LINE_MAX))
  }
  lines.push(clean(`To run it, type ${CONFIRM}`, LINE_MAX))
  return say(lines.join('\n'))
}

async function confirmed($: $, now: number): Promise<CommandRunResult> {
  const set = await loadSet($)
  if ('problem' in set) return say(line(`${set.problem}; nothing was run.`))

  try {
    const stored = await $.state.get(CHECK_STARTED_AT)
    if (typeof stored.value === 'number' && stored.value > 0 && isRecent(stored.value, now)) return say(line('a check is already running; nothing more was started.'))
  } catch (error) {
    return say(line(`whether a check is already running could not be read (${clean(error, ERROR_MAX)}); nothing was run.`))
  }
  if (!(await settles(() => $.state.set(CHECK_STARTED_AT, now)))) {
    return say(line('the start of the check could not be recorded; nothing was run.'))
  }

  let text: string
  let isReset = false
  try {
    text = await runSet($, set.items)
  } catch (error) {
    text = line(`the check stopped (${clean(error, ERROR_MAX)})`)
  } finally {
    isReset = await settles(() => $.state.set(CHECK_STARTED_AT, 0))
  }
  return say(isReset ? text : `${text}\n${line('the start time could not be set back to 0, so another check is blocked for ten minutes.')}`)
}

// Display-only and never throws. A confirmed run makes a model call per prompt, so it starts only from the person's
// own Enter at the prompt: never from a plugin, a schedule, the bridge or the SDK.
export async function answerCheckPicker($: $, e: CommandRunInput, isConfirm: boolean): Promise<CommandRunResult> {
  try {
    if (!isConfirm) return await describe($)
    if (e.origin?.kind !== 'composer') return say(line('a run makes a Haiku call per prompt in the set, so it must be typed by a person at the prompt; nothing was run.'))
    const now = await $.clock.now()
    // Checked and set with no await between, so two confirms in one load cannot both pass.
    if (running !== undefined && isRecent(running.since, now)) return say(line('a check is already running; nothing more was started.'))
    const mine = { since: now }
    running = mine
    try {
      return await confirmed($, now)
    } finally {
      if (running === mine) running = undefined
    }
  } catch (error) {
    return say(line(`the check could not run (${clean(error, ERROR_MAX)})`))
  }
}
