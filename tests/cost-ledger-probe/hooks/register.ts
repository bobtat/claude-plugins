import type { EngineInterface, Register } from 'claude-code'

import type { ProbeRecord, Snapshot, Tokens } from './probe'
import { contextOf, fromJsonl, logFileName, parseCommand, PING_PROMPT, report, scheduleDelays, toJsonl, USAGE } from './probe'

type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const tokensOf = (u: Usage): Tokens => ({
  input: u.input_tokens,
  output: u.output_tokens,
  cacheRead: u.cache_read_input_tokens,
  cacheWrite: u.cache_creation_input_tokens,
})

// Module state starts over on a reload; the log itself is read back from its
// file, so a reload mid-experiment loses only pending timers.
const state = {
  records: [] as ProbeRecord[],
  logPath: undefined as string | undefined,
  runningTurn: null as string | null,
  lastTurnEnd: undefined as number | undefined,
  contextTokens: null as number | null,
  lastMeasured: '',
  pending: [] as { cancel: () => void }[],
  queue: Promise.resolve() as Promise<void>,
}

function serially(task: () => Promise<void>) {
  const run = state.queue.then(task)
  state.queue = run.catch(() => undefined)
  return run
}

async function writeLog($: EngineInterface) {
  const path = state.logPath
  if (path === undefined) return
  try {
    await $.fs.write(path, toJsonl(state.records))
  } catch (err) {
    $.ui.toast(`cost-ledger-probe: could not write ${path}: ${String(err)}`)
  }
}

function add($: EngineInterface, record: ProbeRecord) {
  return serially(async () => {
    state.records.push(record)
    await writeLog($)
  })
}

async function snapshot($: EngineInterface): Promise<Snapshot> {
  const usage = await $.session.usage()
  return { costUsd: usage.cost?.usd ?? null, rateLimits: usage.rateLimits.map(l => ({ ...l })) }
}

async function ping($: EngineInterface, label: string) {
  if (state.runningTurn !== null) {
    await add($, { at: await $.clock.now(), kind: 'skip', label, why: 'a turn is running' })
    return
  }
  const before = await snapshot($)
  const startedAt = await $.clock.now()
  const result = await $.model.fork({ prompt: PING_PROMPT })
  const after = await snapshot($)
  const at = await $.clock.now()
  const common = { at, kind: 'fork' as const, label, startedAt, contextTokens: state.contextTokens, before, after }
  let record: ProbeRecord
  if (result.isAnswered) record = { ...common, result: 'answered', tokens: tokensOf(result.usage) }
  else if (result.reason === 'nothing-to-fork') record = { ...common, result: result.reason }
  else if (result.reason === 'api-error')
    record = { ...common, result: `api-error ${result.error}`, status: result.status, tokens: tokensOf(result.usage) }
  else record = { ...common, result: result.reason, tokens: tokensOf(result.usage) }
  await add($, record)
  const read = record.tokens?.cacheRead ?? 0
  const ctx = state.contextTokens ? ` of ~${state.contextTokens}` : ''
  $.ui.status(`probe ${label}: ${record.result}, cache read ${read}${ctx}`)
}

// A timer's ping has no caller to reject to: a fork the engine refuses is
// logged as a skip instead of surfacing as an unhandled rejection.
async function pingFromTimer($: EngineInterface, label: string) {
  try {
    await ping($, label)
  } catch (err) {
    await add($, { at: await $.clock.now(), kind: 'skip', label, why: String(err) })
  }
}

// A pending timer leaves the list as it fires, so a prompt cancels, and
// reports, only the pings still to come.
function later($: EngineInterface, ms: number, run: () => Promise<void>) {
  const timer = $.clock.after(ms, () => {
    state.pending = state.pending.filter(t => t !== timer)
    void run()
  })
  state.pending.push(timer)
}

// Each fork of a burst starts only after the previous one returned, so slow
// replies stretch the spacing rather than overlapping.
async function burst($: EngineInterface, i: number, count: number, seconds: number) {
  await pingFromTimer($, `burst ${i}/${count}`)
  if (i < count && state.runningTurn === null) {
    later($, seconds * 1000, () => burst($, i + 1, count, seconds))
  }
}

function cancelPending() {
  const n = state.pending.length
  for (const timer of state.pending) timer.cancel()
  state.pending = []
  return n
}

export const register: Register = on => {
  Object.assign(state, {
    records: [],
    logPath: undefined,
    runningTurn: null,
    lastTurnEnd: undefined,
    contextTokens: null,
    lastMeasured: '',
    pending: [],
    queue: Promise.resolve(),
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'probe',
      description: 'cost-ledger-probe: ping (fork now), schedule <minutes...>, burst <count> <seconds>, mark <text>, report',
      argumentHint: 'ping | schedule <min...> | burst <n> <s> | mark <text> | report',
    })
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
    const sessionId = await $.session.id()
    const now = await $.clock.now()
    if (home !== undefined) {
      const path = `${home}/claude-costs/${logFileName(now, sessionId)}`
      state.logPath = path
      if (await $.fs.exists(path)) state.records = fromJsonl(String(await $.fs.read(path)))
    } else {
      $.ui.toast('cost-ledger-probe: no home folder found; records are kept in memory only')
    }
    await add($, { at: now, kind: 'session', sessionId, version: (await $.session.version()).version })
    return next(e)
  })

  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'resume' || e.source === 'fork' || e.source === 'clear' || e.source === 'compact') {
      await add($, {
        at: await $.clock.now(),
        kind: 'resume',
        source: e.source,
        secondsSinceLastResponse: e.seconds_since_last_response,
        contextTokens: e.context_tokens,
        likelyExpired: e.prompt_cache_likely_expired,
        estimatedCacheWriteUsd: e.estimated_cache_write_usd,
      })
    }
    if (e.source === 'clear' || e.source === 'compact') state.contextTokens = null
    else if (e.context_tokens !== undefined) state.contextTokens = e.context_tokens
    return next(e)
  })

  on('classic.PreModelSwitch', async ($, e, next) => {
    await add($, { at: await $.clock.now(), kind: 'ttl', source: 'PreModelSwitch', ttl: e.cache_ttl })
    return next(e)
  })

  on('classic.PostModelSwitch', async ($, e, next) => {
    await add($, { at: await $.clock.now(), kind: 'ttl', source: 'PostModelSwitch', ttl: e.cache_ttl })
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    state.runningTurn = e.turnId
    // A real prompt ends whatever schedule or burst was waiting: the gap it was
    // meant to measure no longer exists.
    const cancelled = cancelPending()
    const at = await $.clock.now()
    if (cancelled > 0) await add($, { at, kind: 'mark', text: `turn started; ${cancelled} pending ping(s) cancelled` })
    await add($, { at, kind: 'turn', phase: 'start', turnId: e.turnId })
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const startedAt = await $.clock.now()
    const result = yield* next(e)
    const usage = result.usage
    if (usage) {
      const tokens = tokensOf(usage)
      if (e.agentId === undefined) state.contextTokens = contextOf(tokens)
      await add($, {
        at: await $.clock.now(),
        kind: 'step',
        turnId: e.turnId,
        agentId: e.agentId,
        model: usage.model,
        startedAt,
        tokens,
      })
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) {
      state.runningTurn = null
      const at = await $.clock.now()
      state.lastTurnEnd = at
      await add($, { at, kind: 'turn', phase: 'end', turnId: e.turnId })
    }
    return result
  })

  on('session.measure', async ($, e, next) => {
    const snap: Snapshot = { costUsd: e.cost?.usd ?? null, rateLimits: e.rateLimits.map(l => ({ ...l })) }
    const key = JSON.stringify(snap)
    if (key !== state.lastMeasured) {
      state.lastMeasured = key
      await add($, { at: await $.clock.now(), kind: 'measure', snapshot: snap })
    }
    return next(e)
  })

  on('command.run', { command: 'probe' }, async ($, e) => {
    const command = parseCommand(e.args)
    const now = await $.clock.now()
    switch (command.kind) {
      case 'help':
        return { text: `${command.error ? `${command.error}\n` : ''}${USAGE}` }
      case 'report':
        return { text: `${report(state.records)}\n\nLog: ${state.logPath ?? '(memory only)'}` }
      case 'mark':
        await add($, { at: now, kind: 'mark', text: command.text })
        return { text: `Marked: ${command.text}` }
      case 'ping':
        // Not awaited: the command returns at once and the fork's record lands
        // when it finishes, as a scheduled ping's would.
        void pingFromTimer($, 'ping')
        return { text: 'Forking now; /probe report shows the result.' }
      case 'schedule': {
        const anchor = state.lastTurnEnd
        if (anchor === undefined) return { text: 'No turn has finished in this session yet; send a prompt first.' }
        cancelPending()
        const lines: string[] = []
        for (const { minutes, delayMs } of scheduleDelays(anchor, now, command.minutes)) {
          if (delayMs <= 0) {
            lines.push(`  +${minutes}m: already past, skipped`)
            continue
          }
          later($, delayMs, () => pingFromTimer($, `+${minutes}m`))
          lines.push(`  +${minutes}m: in ${(delayMs / 60_000).toFixed(1)} min`)
        }
        await add($, { at: now, kind: 'mark', text: `schedule ${command.minutes.join(' ')} after turn end` })
        return { text: `Pings after the last turn's end:\n${lines.join('\n')}\nA new prompt cancels any still pending.` }
      }
      case 'burst': {
        cancelPending()
        const { count, seconds } = command
        await add($, { at: now, kind: 'mark', text: `burst ${count} x ${seconds}s` })
        void burst($, 1, count, seconds)
        return { text: `Burst of ${count} pings, ${seconds}s apart, started. A new prompt stops it.` }
      }
    }
  })
}
