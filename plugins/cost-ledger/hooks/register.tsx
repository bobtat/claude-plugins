import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Breakdown, Context, KeepAlive, LearnedTtl, RateLimit, ToolUse, Totals } from '../types'
import {
  addStepToTurn,
  addToolResult,
  budgetReachDay,
  chargesAsUse,
  chargeStep,
  emptyLoop,
  estimateTokens,
  finishTurn,
  isOutOfStep,
  monthPace,
  reconcile,
  startTurn,
  toolLabel,
  topTools,
  turnsIn,
  turnUsd,
  weekOverWeek,
} from './insights'
import {
  addSpend,
  addTools,
  addTurn,
  addTurnMoves,
  addUsage,
  applyTools,
  applyTurn,
  applyUsage,
  budgetAlert,
  cacheMinutesLeft,
  dayKey,
  daysIn,
  formatTokens,
  formatUsd,
  heatLevel,
  monthView,
  OLDEST_MONTH_OFFSET,
  projectName,
  spendSince,
  summarize,
  sumMonth,
  turnSplit,
} from './ledger'
import type { SessionEntry } from './ledger'
import {
  addBreakdown,
  CATEGORIES,
  emptyBreakdown,
  hitRate,
  priceUsage,
  promptTokens,
  ratesFor,
  totalUsd,
  writeRate,
} from './pricing'
import { keptQuotes, rateText, writeQuote } from './pricecheck'
import type { CacheTtl, Usage } from './pricing'
import { checkPing, coldEstimate, impliedTtl, pingDelay, pingHit, repricedWrites, SUBAGENT_TTL, TTL_MS } from './keepalive'
import type { ColdEstimate, PricedRequest, PricedWrite } from './keepalive'
import { noteUnpricedModel, noteWriteQuote, pricedApart, quoteVerdict } from './prices'
import { isTtlSet, LIST_TABLE, readSettings } from './settings'
import type { Settings } from './settings'
import {
  BUDGET_PREFIX,
  compactStore,
  HEADLESS_TTL_KEY,
  LEARNED_PRICING_KEY,
  LEARNED_TTL_KEY,
  ledgerEntries,
  pruneBudgetKeys,
  saveEntry,
  SESSION_PREFIX,
  SHARED_PREFIX_KEY,
  UNPRICED_MODELS_KEY,
  WRITE_QUOTES_KEY,
  writeExport,
} from './store'

const PANE = 'cost-ledger'
const PROBE_KEY = 'doctorProbe'
const STORE_LIMIT_BYTES = 4 * 1024 * 1024
const SHOWN_TURNS = 10
const SHOWN_TOOLS = 8
const TICK_MS = 30_000
const SHOWN_PROJECTS = 8
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const HEAT = ['', '#0e4429', '#006d32', '#26a641', '#39d353'] as const
const RATE_LIMIT_NAMES: Record<string, string> = { five_hour: '5h', seven_day: '7d' }
const CATEGORY_NAMES = { input: 'Input', output: 'Output', cacheWrite: 'Cache write', cacheRead: 'Cache read' }

const totals = atom({ plugin: 'cost-ledger', key: 'totals' } as const, null)
const lastUsd = atom({ plugin: 'cost-ledger', key: 'lastUsd' } as const, null)
const monthOffset = atom({ plugin: 'cost-ledger', key: 'monthOffset' } as const, 0)
const context = atom({ plugin: 'cost-ledger', key: 'context' } as const, null)
const shadeBy = atom({ plugin: 'cost-ledger', key: 'shadeBy' } as const, 'total')
const tick = atom({ plugin: 'cost-ledger', key: 'tick' } as const, 0)
const activeTurn = atom({ plugin: 'cost-ledger', key: 'activeTurn' } as const, null)
const turnPrompts = atom({ plugin: 'cost-ledger', key: 'turnPrompts' } as const, {})
const loops = atom({ plugin: 'cost-ledger', key: 'loops' } as const, {})
const NO_KEEP_ALIVE: KeepAlive = { override: null, idleSince: null, pings: 0, usd: 0, stopped: null }
const keepAlive = atom({ plugin: 'cost-ledger', key: 'keepAlive' } as const, NO_KEEP_ALIVE)
const sharedPrefix = atom({ plugin: 'cost-ledger', key: 'sharedPrefix' } as const, null)
const learnedTtl = atom({ plugin: 'cost-ledger', key: 'learnedTtl' } as const, null)

// Short, tool-free and asking for one word, so a ping's output stays at a
// handful of tokens.
const PING_PROMPT =
  'This is an automated prompt-cache keep-alive check, not a request from the user. ' +
  'Do not use any tools. Reply with exactly: ok'

// Claude Code picks the lifetime by the kind of session, so what an
// interactive session learned says nothing for a headless one, and the other
// way round: each kind has its own stored lifetime.
const storedTtlKey = () => (isHeadless ? HEADLESS_TTL_KEY : LEARNED_TTL_KEY)

// What this session's own requests showed comes first. Sessions of different
// kinds run side by side on one machine, so the stored lifetime is only where
// a session starts from until it has seen its own.
async function cacheTtl($: EngineInterface, settings: Settings): Promise<CacheTtl> {
  if (isTtlSet(settings)) return settings.ttlSetting
  const own = await read($, learnedTtl)
  if (own !== null) return own.ttl
  return (await $.store.get(storedTtlKey())) === '1h' ? '1h' : '5m'
}

async function noteTtl($: EngineInterface, learned: LearnedTtl) {
  await update($, learnedTtl, () => learned)
  if ((await $.store.get(storedTtlKey())) !== learned.ttl) await $.store.set(storedTtlKey(), learned.ttl)
}

function rateLimitText(limits: readonly RateLimit[]): string {
  return limits.map(l => `${RATE_LIMIT_NAMES[l.kind] ?? l.kind} ${Math.round(l.percentUsed)}%`).join(' · ')
}

// The context is what the next request sends, so its size is that request's
// prompt length.
function perStepText(ctx: Context, settings: Settings): string {
  const rates = ratesFor(settings.table, ctx.model, ctx.tokens)
  return rates ? ` ≈${formatUsd((ctx.tokens * rates.cacheRead) / 1_000_000)}/step` : ''
}

function nudgeText(ctx: Context, settings: Settings): string {
  return settings.contextNudgeTokens > 0 && ctx.tokens >= settings.contextNudgeTokens ? ', consider /compact' : ''
}

// What re-caching the context would cost now that it has gone cold, priced
// at the rates in use; undefined for a model with no rate. The shared opening
// is this session's, else the last one any session measured.
async function coldCost($: EngineInterface, settings: Settings, ctx: Context, ttl: CacheTtl): Promise<ColdEstimate | undefined> {
  const rates = ratesFor(settings.table, ctx.model, ctx.tokens)
  if (rates === undefined) return undefined
  const prefix = (await read($, sharedPrefix)) ?? Number((await $.store.get(SHARED_PREFIX_KEY)) ?? 0)
  return coldEstimate(ctx.tokens, prefix, writeRate(rates, ttl))
}

// "≈$0.33–$0.57" when part of the context is likely still cached by other
// sessions, else the one figure.
function coldText(cold: ColdEstimate): string {
  return cold.likelyTokens < cold.worstTokens
    ? `≈${formatUsd(cold.likelyUsd)}–${formatUsd(cold.worstUsd)}`
    : `≈${formatUsd(cold.worstUsd)}`
}

function cacheText(ctx: Context, ttl: CacheTtl, now: number, ka: KeepAlive, cold: ColdEstimate | undefined): string {
  const left = cacheMinutesLeft(ctx.at, TTL_MS[ttl], now)
  if (left > 0) {
    const kept = ka.pings > 0 && ka.stopped === null ? ` (kept warm: ${ka.pings} ping${ka.pings === 1 ? '' : 's'} ${formatUsd(ka.usd)})` : ''
    return ` · cache warm ${left}m${kept}`
  }
  return ` · cache cold${cold ? ` (re-cache ${coldText(cold)})` : ''}`
}

// The context segment of the status line and band; empty before the first
// main-thread response of the session.
async function contextLine($: EngineInterface, settings: Settings, ctx: Context | null): Promise<string> {
  if (ctx === null || ctx.tokens === 0) return ''
  const ttl = await cacheTtl($, settings)
  const cache = cacheText(ctx, ttl, await $.clock.now(), await read($, keepAlive), await coldCost($, settings, ctx, ttl))
  return ` · ctx ${formatTokens(ctx.tokens)}${perStepText(ctx, settings)}${cache}${nudgeText(ctx, settings)}`
}

function summaryLine(t: Totals, settings: Settings, contextPart: string): string {
  const qualifier = settings.isSubscription ? ' (API-equiv.)' : ''
  const costs = `${formatUsd(t.session)} session · ${formatUsd(t.week)} week · ${formatUsd(t.month)} month${qualifier}`
  const limits = settings.isSubscription && t.rateLimits.length > 0 ? ` · ${rateLimitText(t.rateLimits)}` : ''
  return costs + limits + contextPart
}

async function updateStatus($: EngineInterface, settings: Settings) {
  if (!settings.hasStatusLine) {
    $.ui.status(undefined)
    return
  }
  const t = await read($, totals)
  if (t === null) return
  const ctx = await read($, context)
  $.ui.status(summaryLine(t, settings, await contextLine($, settings, ctx)))
}

async function onTick($: EngineInterface, settings: Settings) {
  const now = await $.clock.now()
  await update($, tick, () => now)
  await updateStatus($, settings)
}

async function checkBudgets($: EngineInterface, settings: Settings, t: Totals) {
  const today = dayKey(await $.clock.now())
  const periods = [
    { name: 'Daily', key: `day:${today}`, spent: t.today, limit: settings.budgets.day },
    { name: 'Weekly', key: `week:${t.weekStart}`, spent: t.week, limit: settings.budgets.week },
    { name: 'Monthly', key: `month:${today.slice(0, 7)}`, spent: t.month, limit: settings.budgets.month },
  ]
  for (const period of periods) {
    const storeKey = `${BUDGET_PREFIX}${period.key}:${period.limit}`
    const announced = Number((await $.store.get(storeKey)) ?? 0)
    const reached = budgetAlert(period.spent, period.limit, announced)
    if (reached === null) continue

    await $.store.set(storeKey, reached)
    const verb = reached >= 1 ? 'reached' : `at ${Math.round(reached * 100)}%`
    $.ui.toast(`${period.name} budget ${verb}: ${formatUsd(period.spent)} of ${formatUsd(period.limit)}.`, {
      timeoutMs: 10_000,
    })
  }
}

async function rebaseline($: EngineInterface) {
  const usage = await $.session.usage()
  const usd = usage.cost?.usd ?? 0
  await update($, lastUsd, () => usd)
}

async function refresh(
  $: EngineInterface,
  settings: Settings,
  sessionUsd?: number,
  rateLimits?: readonly RateLimit[],
) {
  const now = await $.clock.now()
  const previous = await read($, totals)
  const entries = await ledgerEntries($)
  const next: Totals = {
    session: sessionUsd ?? previous?.session ?? 0,
    ...summarize(entries, now),
    rateLimits: [...(rateLimits ?? previous?.rateLimits ?? [])],
  }
  await update($, totals, () => next)
  await updateStatus($, settings)
  await checkBudgets($, settings, next)
}

async function recordSpend($: EngineInterface, usd: number) {
  const spent = spendSince(await read($, lastUsd), usd)
  if (spent > 0) {
    const key = SESSION_PREFIX + (await $.session.id())
    const entry = (await $.store.get(key)) as SessionEntry | undefined
    // The baseline moves only once the spend is saved, so a failed save is
    // counted again by the next measurement instead of being lost.
    if (!(await saveEntry($, key, addSpend(entry, await $.clock.now(), spent, await $.session.root())))) return
  }
  await update($, lastUsd, () => usd)
}

type Step = { turnId: string; agentId?: string; startedAt: number }

async function recordStep($: EngineInterface, settings: Settings, usage: Usage & { model: string }, step: Step) {
  const isMainThread = step.agentId === undefined
  const ttl = isMainThread ? await cacheTtl($, settings) : SUBAGENT_TTL
  const rates = ratesFor(settings.table, usage.model, promptTokens(usage))
  const priced = priceUsage(usage, rates, ttl)
  if (rates === undefined) await noteUnpricedModel($, usage.model)

  // A turn is measured by the conversation's own requests. A subagent's
  // request landing in it moves Claude Code's total by an amount those do not
  // account for, which could pass for the other write rate, so that turn
  // teaches nothing.
  const measured = isMainThread ? turnCosts.get(step.turnId) : runningTurn === null ? undefined : turnCosts.get(runningTurn)
  if (measured !== undefined) {
    const listRates = ratesFor(LIST_TABLE, usage.model, promptTokens(usage))
    if (!isMainThread || listRates === undefined) measured.isSpoiled = true
    else {
      measured.requests.push({ usage, rates: listRates })
      if (rates !== undefined) measured.writes.push({ tokens: usage.cache_creation_input_tokens, rates, ttl })
    }
  }

  const loopId = step.agentId ?? 'main'
  const loopsNow = await read($, loops)
  const charged = chargeStep(
    loopsNow[loopId] ?? emptyLoop(),
    (rates?.cacheRead ?? 0) / 1_000_000,
    (rates ? writeRate(rates, ttl) : 0) / 1_000_000,
  )
  await update($, loops, all => ({ ...all, [loopId]: charged.loop }))
  const toolCosts = chargesAsUse(charged.charges)

  const now = await $.clock.now()
  const project = await $.session.root()
  const key = SESSION_PREFIX + (await $.session.id())
  const entry = (await $.store.get(key)) as SessionEntry | undefined
  await saveEntry($, key, addTools(addUsage(entry, now, priced, project, !isMainThread), now, toolCosts))
  await update($, totals, t => (t === null ? t : applyTools(t, now, toolCosts)))
  await addToActiveTurn($, step, priced, isMainThread, now)
  await update($, totals, t => (t === null ? t : applyUsage(t, now, priced, project, !isMainThread)))

  if (isMainThread) {
    const previous = await read($, context)
    const tokens =
      usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens + usage.output_tokens
    // A conversation's first request, and the first after its cache went
    // cold, reads from the cache only the opening other sessions keep warm.
    if (previous === null || step.startedAt - previous.at > TTL_MS[ttl]) await noteSharedPrefix($, usage.cache_read_input_tokens)
    await update($, context, () => ({ tokens, model: usage.model, at: step.startedAt, tail: usage.output_tokens }))
    // A real request ends any idle stretch, and with it a stop the last one caused.
    await update($, keepAlive, ka => ({ ...ka, idleSince: step.startedAt, stopped: null }))
  }

  const written = usage.cache_creation_input_tokens
  if (settings.largeWriteTokens > 0 && written >= settings.largeWriteTokens) {
    const cost = rates ? `≈ ${formatUsd(priced.usd.cacheWrite)}` : '(no rate for this model)'
    $.ui.toast(`One request wrote ${formatTokens(written)} tokens to the prompt cache ${cost} on ${usage.model}.`, {
      timeoutMs: 8000,
    })
  }

  await updateStatus($, settings)
}

// A turn becomes the prompt's record at its first main-thread request, since
// turn.start does not say which loop it belongs to. Subagent requests made
// while it runs are charged to it.
async function addToActiveTurn(
  $: EngineInterface,
  step: Step,
  priced: Breakdown,
  isMainThread: boolean,
  now: number,
) {
  const current = await read($, activeTurn)
  if (isMainThread && current?.turnId !== step.turnId) {
    const prompt = (await read($, turnPrompts))[step.turnId]
    const started = startTurn(step.turnId, prompt?.text || '(continuation)', prompt?.at ?? now)
    await update($, activeTurn, () => addStepToTurn(started, priced, false))
    return
  }
  if (current !== null) await update($, activeTurn, turn => (turn === null ? turn : addStepToTurn(turn, priced, !isMainThread)))
}

// Closes the prompt's record and answers what its requests were priced at: 0
// for a turn that made none the mod saw.
async function finishActiveTurn($: EngineInterface, settings: Settings, turnId: string): Promise<number> {
  const turn = await read($, activeTurn)
  await update($, turnPrompts, prompts => {
    const { [turnId]: _done, ...rest } = prompts
    return rest
  })
  if (turn === null || turn.turnId !== turnId) return 0
  await update($, activeTurn, () => null)

  const now = await $.clock.now()
  const record = finishTurn(turn, await $.session.root())
  const key = SESSION_PREFIX + (await $.session.id())
  const entry = (await $.store.get(key)) as SessionEntry | undefined
  await saveEntry($, key, addTurn(entry, now, record))
  await update($, totals, t => (t === null ? t : applyTurn(t, record)))

  const usd = turnUsd(record)
  if (settings.expensiveTurnUsd > 0 && usd >= settings.expensiveTurnUsd) {
    const detail = `${record.steps} requests${record.subagentSteps > 0 ? ` + ${record.subagentSteps} by subagents` : ''}`
    $.ui.toast(`That prompt cost ≈ ${formatUsd(usd)} (${detail}): “${record.prompt}”`, { timeoutMs: 10_000 })
  }
  return usd
}

async function recordToolResult($: EngineInterface, tool: string, agentId: string | undefined, text: string) {
  const tokens = estimateTokens(text)
  const loopId = agentId ?? 'main'
  await update($, loops, all => ({ ...all, [loopId]: addToolResult(all[loopId], tool, tokens) }))

  const now = await $.clock.now()
  const use: Record<string, ToolUse> = { [tool]: { calls: 1, tokens, writeUsd: 0, rereadUsd: 0 } }
  const key = SESSION_PREFIX + (await $.session.id())
  const entry = (await $.store.get(key)) as SessionEntry | undefined
  await saveEntry($, key, addTools(entry, now, use))
  await update($, totals, t => (t === null ? t : applyTools(t, now, use)))
}

const localStamp = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const hhmm = `${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  return `${dayKey(ms)} ${pad(d.getHours())}:${pad(d.getMinutes())} ${sign}${hhmm}`
}

async function hostLocalTime($: EngineInterface): Promise<string | undefined> {
  const isWindows = (await $.env.get('OS')) === 'Windows_NT'
  const argv = isWindows
    ? ['powershell', '-NoProfile', '-Command', "Get-Date -Format 'yyyy-MM-dd HH:mm zzz'"]
    : ['date', '+%Y-%m-%d %H:%M %z']
  try {
    const { exitCode, stdout } = await $.process.run(argv, { timeoutMs: 10_000 })
    return exitCode === 0 ? stdout.trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2') : undefined
  } catch {
    return undefined
  }
}

async function readOwnStoreFiles($: EngineInterface): Promise<{ path: string; text: string }[] | undefined> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  const configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? (home && `${home}/.claude`)
  if (!configDir) return undefined
  const dir = `${configDir}/plugins/store`
  try {
    const files = (await $.fs.list(dir)).filter(f => f.kind === 'file' && f.name.startsWith(`${$.plugin.name}_`))
    return Promise.all(files.map(async f => ({ path: `${dir}/${f.name}`, text: (await $.fs.read(`${dir}/${f.name}`)) as string })))
  } catch {
    return undefined
  }
}

function storeKeysOf(text: string): string[] | undefined {
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).sort() : undefined
  } catch {
    return undefined
  }
}

// Each check reports what it saw; nothing here changes the ledger except the
// probe key, which is removed again.
async function runDoctor($: EngineInterface, settings: Settings): Promise<string> {
  const lines = ['cost-ledger self-check', '']
  const say = (isOk: boolean | null, label: string, detail: string) =>
    lines.push(`${isOk === null ? 'ℹ' : isOk ? '✓' : '⚠'} ${label}: ${detail}`)
  const now = await $.clock.now()

  const mine = localStamp(now)
  const host = await hostLocalTime($)
  if (host === undefined) say(null, 'Time zone', `the mod sees ${mine}; the host's clock could not be read to compare`)
  else {
    const isSame = host.slice(0, 13) === mine.slice(0, 13) && host.slice(-6) === mine.slice(-6)
    say(isSame, 'Time zone', isSame ? `day boundaries follow local time (${mine})` : `the mod sees ${mine} but the host says ${host}, so days are split at the wrong hour`)
  }

  const probe = `${now}-${Math.random().toString(36).slice(2)}`
  await $.store.set(PROBE_KEY, probe)
  try {
    const files = await readOwnStoreFiles($)
    const own = files?.find(f => f.text.includes(probe))
    const ownKeys = own && storeKeysOf(own.text)
    if (own === undefined || ownKeys === undefined) {
      say(false, 'Store file', 'a write could not be found on disk, so the checks that compare the file were skipped')
    } else {
      say(true, 'Store file', `writes reach disk at once (${own.path})`)
      const inView = [...(await $.store.keys())].sort()
      const isSameView = ownKeys.join('\n') === inView.join('\n')
      say(
        isSameView,
        'Other sessions',
        isSameView
          ? 'this session sees exactly what is on disk, so writes from other sessions are not being overwritten'
          : `this session sees ${inView.length} keys and the file has ${ownKeys.length}; another session's writes may be lost`,
      )
      const percent = Math.round((own.text.length / STORE_LIMIT_BYTES) * 100)
      say(percent < 75, 'Store size', `${Math.round(own.text.length / 1024)} KiB, ${percent}% of the 4 MiB limit`)
    }
    for (const other of files?.filter(f => f !== own) ?? []) {
      const sessions = storeKeysOf(other.text)?.filter(k => k.startsWith(SESSION_PREFIX)).length
      say(
        null,
        'Another install',
        sessions === undefined
          ? `${other.path} could not be read`
          : `${other.path} holds ${sessions} sessions recorded by a differently installed copy; they are not in these totals`,
      )
    }
  } finally {
    await $.store.delete(PROBE_KEY)
  }

  const pricing = await $.store.get(LEARNED_PRICING_KEY)
  say(
    null,
    'Claude Code pricing',
    pricing === 'configured'
      ? "your organisation's managed modelPricing, so the totals follow your rates"
      : pricing === 'catalog'
        ? 'Anthropic list prices; on Bedrock the totals may differ from your bill'
        : 'not reported yet; Claude Code reports it when you switch models with /model',
  )
  // Each kept quote is judged against the list as it is now, so a warning
  // clears once an updated plugin brings the price into line.
  const judged = keptQuotes(await $.store.get(WRITE_QUOTES_KEY), now).flatMap(quote => {
    const verdict = quoteVerdict(settings, quote)
    return verdict === undefined ? [] : [{ quote, verdict }]
  })
  const mispriced = judged.filter(({ verdict }) => !verdict.isAgreed)
  if (judged.length === 0) {
    say(null, 'Prices', "not compared with Claude Code's yet; it quotes a cache-write price when you switch models with /model")
  } else if (mispriced.length === 0) {
    say(true, 'Prices', `Claude Code prices cache writes as the price list does for ${judged.map(({ quote }) => quote.model).join(', ')}`)
  }
  for (const { quote, verdict } of mispriced) {
    say(
      false,
      'Prices',
      `Claude Code prices cache writes on ${quote.model} at ${rateText(verdict.quotedPerMillion)} per million tokens and the price list has ` +
        `${rateText(verdict.listedPerMillion)}; update the plugin, or give the model's rates in the rates setting`,
    )
  }

  const own = await read($, learnedTtl)
  const stored = await $.store.get(storedTtlKey())
  const kind = isHeadless ? 'headless' : 'interactive'
  const learned =
    own !== null
      ? `this session: ${own.ttl}, ${own.from === 'pricing' ? "from Claude Code's pricing of a turn" : 'reported by Claude Code'}`
      : stored === '5m' || stored === '1h'
        ? `not learned in this session yet; earlier ${kind} sessions: ${stored}`
        : 'not learned yet'
  say(null, 'Cache lifetime', `using ${await cacheTtl($, settings)} (setting: ${settings.ttlSetting}; ${learned})`)
  const prefix = await $.store.get(SHARED_PREFIX_KEY)
  say(
    null,
    'Shared opening',
    typeof prefix === 'number'
      ? `${formatTokens(prefix)} tokens stay cached between sessions; cold-resume estimates leave them out of the likely cost`
      : 'not measured yet; it is read from the first request of a new conversation',
  )
  const ka = await read($, keepAlive)
  say(
    null,
    'Keep-alive',
    `${(await isKeepAliveOn($, settings)) ? 'on' : 'off'}${ka.override === null ? '' : ' for this session'}; ${ka.pings} ping${ka.pings === 1 ? '' : 's'} this session${ka.stopped ? `, stopped: ${ka.stopped}` : ''}`,
  )

  const usd = (await $.session.usage()).cost?.usd ?? 0
  const recorded = await read($, lastUsd)
  if (recorded === null) say(false, 'Baseline', 'not set; spend is recorded from the next measurement')
  else if (recorded > usd + 0.005) say(false, 'Baseline', `recorded up to ${formatUsd(recorded)}, above the session's ${formatUsd(usd)}`)
  else say(true, 'Baseline', `session at ${formatUsd(usd)}, recorded up to ${formatUsd(recorded)}${usd - recorded >= 0.005 ? '; the rest is recorded after the next turn' : ''}`)

  if (settings.table.error) say(false, 'Rates', settings.table.error)
  // The list remembers every model once met without a rate; one that a later
  // version of the table or the rates setting has since priced is no longer news.
  const everUnpriced = ((await $.store.get(UNPRICED_MODELS_KEY)) as string[] | undefined) ?? []
  const unpriced = everUnpriced.filter(model => ratesFor(settings.table, model, 0) === undefined)
  say(
    unpriced.length === 0,
    'Models',
    unpriced.length === 0
      ? 'every model seen has a rate'
      : `no rate for ${unpriced.join(', ')}; update the plugin or add them to the rates setting`,
  )

  const month = dayKey(now).slice(0, 7)
  const summary = summarize(await ledgerEntries($), now)
  const monthCache = sumMonth<Breakdown>(summary.cacheDays, month, addBreakdown)
  const step = reconcile(summary.month, monthCache ? totalUsd(monthCache) : 0)
  if (step.share === null) say(null, 'Breakdown', 'too little spend this month to compare with the total')
  else {
    const percent = Math.round(step.share * 100)
    const figures = `adds up to ${formatUsd(step.estimatedUsd)} against this month's ${formatUsd(step.totalUsd)} total (${percent}%)`
    const apart = await pricedApart($, settings)
    const unpricedTokens = monthCache?.unpricedTokens ?? 0
    if (apart !== undefined) say(null, 'Breakdown', `${figures}; ${apart}`)
    else if (!isOutOfStep(step.share)) say(true, 'Breakdown', `accounts for ${percent}% of this month's ${formatUsd(step.totalUsd)} total`)
    else
      say(
        false,
        'Breakdown',
        `${figures}: ${unpricedTokens > 0 ? `${formatTokens(unpricedTokens)} tokens this month are from models with no rate; beyond that, ` : ''}` +
          'a price that has changed, the cache lifetime, fast mode, US-only inference, web searches, or requests the mod does not see',
      )
  }
  // Where a gap lies says what kind it is: within turns the mod sees every
  // request, so the prices are off; outside them it is spend with no request
  // to show. Only for sessions tracked from their start, and not where the two
  // figures are priced differently on purpose.
  const split = turnSplit(await ledgerEntries($), month)
  if (reconcile(split.totalUsd, split.estimatedUsd).share !== null && (await pricedApart($, settings)) === undefined) {
    say(
      null,
      'Turns',
      `during turns the total moved ${formatUsd(split.turnsUsd)} and the breakdown has ${formatUsd(split.turnsEstimatedUsd)}; ` +
        `outside them, ${formatUsd(split.totalUsd - split.turnsUsd)} against ${formatUsd(split.estimatedUsd - split.turnsEstimatedUsd)}`,
    )
  }

  say(null, 'Resume', 'cannot be checked from here: compare /costs before and after a /resume of a session with known spend')
  return lines.join('\n')
}

async function noteSharedPrefix($: EngineInterface, tokens: number) {
  if (tokens <= 0) return
  await update($, sharedPrefix, () => tokens)
  if ((await $.store.get(SHARED_PREFIX_KEY)) !== tokens) await $.store.set(SHARED_PREFIX_KEY, tokens)
}

// Module scope: the keep-alive timer, the running turn and the turns being
// measured belong to this load of the mod. A reload starts them over, and the
// next turn re-arms the timer.
let keepAliveTimer: { cancel: () => void } | null = null
let runningTurn: string | null = null
let warnedColdAt: number | null = null
let isHeadless = false
type MeasuredTurn = { startUsd: number; requests: PricedRequest[]; writes: PricedWrite[]; isSpoiled: boolean }
const turnCosts = new Map<string, MeasuredTurn>()

// Steps of parallel subagents finish concurrently, and a keep-alive ping can
// land between them; each read-modify-write of this session's store entry
// must see the previous one's result.
let queue: Promise<void> = Promise.resolve()
function serially(task: () => Promise<void>) {
  const run = queue.then(task)
  queue = run.catch(() => undefined)
  return run
}

function resetModuleState() {
  keepAliveTimer?.cancel()
  keepAliveTimer = null
  runningTurn = null
  warnedColdAt = null
  isHeadless = false
  turnCosts.clear()
  queue = Promise.resolve()
}

function cancelKeepAlive() {
  keepAliveTimer?.cancel()
  keepAliveTimer = null
}

async function startTurnCost($: EngineInterface, turnId: string) {
  const usd = (await $.session.usage()).cost?.usd
  if (usd !== undefined) turnCosts.set(turnId, { startUsd: usd, requests: [], writes: [], isSpoiled: false })
}

// Ends a turn. What it moved Claude Code's running total by is read for the
// cache lifetime it was charged at, and kept beside what its requests were
// priced at. A total that fell during the turn was reset by a /clear and says
// nothing.
async function closeTurn($: EngineInterface, settings: Settings, turnId: string) {
  const measured = turnCosts.get(turnId)
  turnCosts.delete(turnId)
  const usd = measured === undefined ? undefined : (await $.session.usage()).cost?.usd
  const moved = measured === undefined || usd === undefined || usd < measured.startUsd ? undefined : usd - measured.startUsd
  const ttl = measured === undefined || moved === undefined ? undefined : await chargedTtl($, measured, moved)

  // Before the turn's record is closed, so that the record carries it too. A
  // lifetime the cacheTtl setting names is the user's to decide and stays. A
  // turn whose record a /clear has dropped belongs to a session that is no
  // longer the current one, and is left alone.
  const isStillOpen = (await read($, activeTurn))?.turnId === turnId
  if (measured !== undefined && ttl !== undefined && !isTtlSet(settings) && isStillOpen) {
    const correction = repricedWrites(measured.writes, ttl)
    if (correction !== 0) await repriceWrites($, turnId, correction)
  }

  const estimatedUsd = await finishActiveTurn($, settings, turnId)
  if (moved !== undefined) {
    const key = SESSION_PREFIX + (await $.session.id())
    const entry = (await $.store.get(key)) as SessionEntry | undefined
    const tracked = addTurnMoves(entry, await $.clock.now(), moved, estimatedUsd)
    if (tracked !== entry) await saveEntry($, key, tracked)
  }
  if (ttl !== undefined) await noteTtl($, { ttl, from: 'pricing' })
}

// The cache lifetime Claude Code charged, read from what one turn moved its
// running total by. Not read under managed rates, which list prices cannot
// match, from a turn a subagent's request landed in, or from one that does
// not add up either way.
async function chargedTtl($: EngineInterface, measured: MeasuredTurn, movedUsd: number): Promise<CacheTtl | undefined> {
  if (measured.isSpoiled) return undefined
  if ((await $.store.get(LEARNED_PRICING_KEY)) === 'configured') return undefined
  return impliedTtl(movedUsd, measured.requests)
}

// A request's writes are priced as it is recorded, at the lifetime believed
// then, which a session's first turn can only assume. Once the turn's own
// total shows they were charged at the other one, the difference is put right
// wherever the requests were added: the turn's record, the session's stored
// breakdown and the totals on show.
async function repriceWrites($: EngineInterface, turnId: string, usd: number) {
  const blank = emptyBreakdown()
  const correction: Breakdown = { ...blank, usd: { ...blank.usd, cacheWrite: usd } }
  await update($, activeTurn, turn => (turn === null || turn.turnId !== turnId ? turn : { ...turn, usage: addBreakdown(turn.usage, correction) }))

  const now = await $.clock.now()
  const project = await $.session.root()
  const key = SESSION_PREFIX + (await $.session.id())
  const entry = (await $.store.get(key)) as SessionEntry | undefined
  await saveEntry($, key, addUsage(entry, now, correction, project, false))
  await update($, totals, t => (t === null ? t : applyUsage(t, now, correction, project, false)))
}

async function isKeepAliveOn($: EngineInterface, settings: Settings): Promise<boolean> {
  const { override } = await read($, keepAlive)
  return override === null ? settings.keepAlive : override === 'on'
}

// One timer at a time, due nine tenths of a cache lifetime after the cache
// was last used.
async function armKeepAlive($: EngineInterface, settings: Settings) {
  cancelKeepAlive()
  if (!(await isKeepAliveOn($, settings))) return
  const ctx = await read($, context)
  if (ctx === null || ctx.tokens === 0) return
  const delay = pingDelay(ctx.at, await cacheTtl($, settings), await $.clock.now())
  keepAliveTimer = $.clock.after(delay, () => void keepAlivePing($, settings))
}

async function stopKeepAlive($: EngineInterface, settings: Settings, ctx: Context, why: string) {
  await update($, keepAlive, ka => ({ ...ka, stopped: why }))
  const cold = await coldCost($, settings, ctx, await cacheTtl($, settings))
  const cost = cold ? ` ${coldText(cold)}` : ''
  $.ui.toast(`Keep-alive stopped (${why}). Once the cache goes cold, the next prompt re-caches it${cost}.`, {
    timeoutMs: 10_000,
  })
}

// One ping: the session's own transcript sent again through $.model.fork,
// which reads it from the cache and so renews the cache's lifetime. Its cost
// is already in Claude Code's running total, so it is added to the category
// breakdown only. A fork's own writes are charged at the five-minute rate.
async function keepAlivePing($: EngineInterface, settings: Settings) {
  keepAliveTimer = null
  const ctx = await read($, context)
  const ka = await read($, keepAlive)
  const now = await $.clock.now()
  const check = checkPing({
    isOn: await isKeepAliveOn($, settings),
    isTurnRunning: runningTurn !== null,
    contextTokens: ctx?.tokens ?? null,
    minContextTokens: settings.keepAliveMinTokens,
    idleSince: ka.idleSince ?? ctx?.at ?? now,
    maxIdleMs: settings.keepAliveMaxIdleMs,
    now,
  })
  if (ctx === null || !check.isDue) {
    if (ctx !== null && !check.isDue && check.why === 'idle too long') {
      await stopKeepAlive($, settings, ctx, `idle ${Math.round((now - (ka.idleSince ?? ctx.at)) / 60_000)} min`)
    }
    return
  }

  const result = await $.model.fork({ prompt: PING_PROMPT })
  if (!result.isAnswered && result.reason === 'nothing-to-fork') return
  await serially(() => recordPing($, settings, result.usage, ctx.model))
  if (!result.isAnswered && result.reason !== 'empty-reply') {
    await stopKeepAlive($, settings, ctx, result.reason === 'api-error' ? `ping failed: ${result.error}` : 'ping interrupted')
    return
  }
  if (!pingHit(result.usage, ctx.tail)) {
    await stopKeepAlive($, settings, ctx, 'a ping found the cache already cold')
    return
  }
  // The cache's lifetime runs from the ping's start. A turn that began while
  // the ping ran has moved the context on already and re-arms on its own.
  await update($, context, current => (current !== null && current.at < now ? { ...current, at: now } : current))
  if (runningTurn === null) await armKeepAlive($, settings)
  await updateStatus($, settings)
}

async function recordPing($: EngineInterface, settings: Settings, usage: Usage, model: string) {
  const priced = priceUsage(usage, ratesFor(settings.table, model, promptTokens(usage)), '5m')
  const now = await $.clock.now()
  const project = await $.session.root()
  const key = SESSION_PREFIX + (await $.session.id())
  const entry = (await $.store.get(key)) as SessionEntry | undefined
  await saveEntry($, key, addUsage(entry, now, priced, project, false))
  await update($, totals, t => (t === null ? t : applyUsage(t, now, priced, project, false)))
  await update($, keepAlive, ka => ({ ...ka, pings: ka.pings + 1, usd: ka.usd + totalUsd(priced) }))
}

async function warnIfCacheExpired($: EngineInterface, settings: Settings) {
  const ctx = await read($, context)
  if (ctx === null || ctx.tokens === 0 || warnedColdAt === ctx.at) return

  const ttl = await cacheTtl($, settings)
  const idleMs = (await $.clock.now()) - ctx.at
  if (idleMs <= TTL_MS[ttl]) return

  warnedColdAt = ctx.at
  const cold = await coldCost($, settings, ctx, ttl)
  $.ui.toast(
    `Prompt cache has likely expired (idle ${Math.round(idleMs / 60_000)} min, ${ttl} cache): ` +
      `this prompt re-writes ${cold ? `${coldTokens(cold)} tokens ${coldText(cold)}` : `~${formatTokens(ctx.tokens)} tokens`}.`,
    { timeoutMs: 10_000 },
  )
}

// /costs keepalive [on|off]: the choice holds for this session and overrides
// the keepAlive setting; with no argument, what the keep-alive is doing.
async function keepAliveCommand($: EngineInterface, settings: Settings, arg: string): Promise<string> {
  if (arg === 'on' || arg === 'off') {
    const override: 'on' | 'off' = arg
    await update($, keepAlive, ka => ({ ...ka, override, stopped: null }))
    if (override === 'off') cancelKeepAlive()
    else if (runningTurn === null) await armKeepAlive($, settings)
  } else if (arg !== '') {
    return 'Usage: /costs keepalive [on|off]'
  }
  const ka = await read($, keepAlive)
  const isOn = await isKeepAliveOn($, settings)
  const ttl = await cacheTtl($, settings)
  const source = ka.override === null ? 'the keepAlive setting' : '/costs keepalive for this session'
  const lines = [`Keep-alive is ${isOn ? 'on' : 'off'} (${source}); cache lifetime ${ttl}.`]
  if (ka.pings > 0) lines.push(`${ka.pings} ping${ka.pings === 1 ? '' : 's'} this session, ≈${formatUsd(ka.usd)}.`)
  if (ka.stopped !== null) lines.push(`Stopped: ${ka.stopped}. It starts again after your next prompt.`)
  const ctx = await read($, context)
  if (isOn && ka.stopped === null && ctx !== null && ctx.tokens > 0) {
    if (ctx.tokens < settings.keepAliveMinTokens) {
      lines.push(`The context (${formatTokens(ctx.tokens)}) is below keepAliveMinContextTokens, so no pings are sent.`)
    } else if (runningTurn === null) {
      lines.push(`Next ping in ${Math.ceil(pingDelay(ctx.at, ttl, await $.clock.now()) / 60_000)} min.`)
    }
  }
  return lines.join('\n')
}

function coldTokens(cold: ColdEstimate): string {
  return cold.likelyTokens < cold.worstTokens
    ? `~${formatTokens(cold.likelyTokens)}–${formatTokens(cold.worstTokens)}`
    : `~${formatTokens(cold.worstTokens)}`
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)
  const { isSubscription } = settings
  resetModuleState()

  on('session.start', async ($, e, next) => {
    isHeadless = !e.isInteractive
    await $.command.register({
      name: 'costs',
      description:
        'Show session, weekly and monthly Claude Code costs; "export" writes a CSV, "doctor" checks the setup, "keepalive on|off" keeps this session\'s prompt cache warm',
      argumentHint: '[export|doctor|keepalive on|off]',
    })
    if (settings.table.error) $.ui.toast(`cost-ledger: ${settings.table.error}`)

    const now = await $.clock.now()
    // Housekeeping can wait for the next start. The baseline below cannot: a
    // start that stopped here would count the session's whole cost as new.
    try {
      await compactStore($, now)
      await pruneBudgetKeys($, now)
    } catch (error) {
      $.ui.toast(`cost-ledger could not tidy its store, and will try again at the next start: ${String(error)}`, { timeoutMs: 10_000 })
    }
    $.clock.every(TICK_MS, () => void onTick($, settings))

    const usage = await $.session.usage()
    const usd = usage.cost?.usd ?? 0
    // A resumed session can start with spend that an earlier run already
    // recorded; only growth from here on is new. A reload keeps the baseline.
    if ((await read($, lastUsd)) === null) await update($, lastUsd, () => usd)
    await refresh($, settings, usd, usage.rateLimits)

    return next(e)
  })

  on('classic.SessionStart', async ($, e, next) => {
    // session.start fires once per process, but /clear, /resume and a fork
    // switch sessions inside it: the new session's running total starts from
    // whatever it carries, and none of that is new spend.
    if (e.source === 'clear' || e.source === 'resume' || e.source === 'fork') await serially(() => rebaseline($))
    if (e.source === 'clear' || e.source === 'compact') {
      await update($, context, () => null)
      await update($, loops, () => ({}))
    }
    if (e.source === 'clear') {
      await update($, activeTurn, () => null)
      await update($, turnPrompts, () => ({}))
    }
    // The keep-alive follows the conversation: a new one starts with no pings,
    // and is armed by its first turn. A /costs keepalive choice stays.
    if (e.source !== 'startup') {
      cancelKeepAlive()
      await update($, keepAlive, ka => ({ ...NO_KEEP_ALIVE, override: ka.override }))
    }

    // A resumed transcript's cache is as old as its last response, so the
    // idle warning on the first prompt covers resumes too; when Claude Code
    // says it has likely expired, the cost is shown now, before any prompt.
    if (e.context_tokens && e.seconds_since_last_response !== undefined && e.model) {
      const at = (await $.clock.now()) - e.seconds_since_last_response * 1000
      const ctx: Context = { tokens: e.context_tokens, model: e.model, at }
      await update($, context, () => ctx)
      if (e.prompt_cache_likely_expired) {
        warnedColdAt = at
        const cold = await coldCost($, settings, ctx, await cacheTtl($, settings))
        const idle = Math.round(e.seconds_since_last_response / 60)
        $.ui.toast(
          `This session's prompt cache has likely expired (idle ${idle} min): ` +
            `the first prompt re-writes ${cold ? `${coldTokens(cold)} tokens ${coldText(cold)}` : `~${formatTokens(ctx.tokens)} tokens`}.`,
          { timeoutMs: 10_000 },
        )
      }
    }
    return next(e)
  })

  on('classic.PreModelSwitch', async ($, e, next) => {
    await noteTtl($, { ttl: e.cache_ttl, from: 'claude-code' })
    await $.store.set(LEARNED_PRICING_KEY, e.pricing)
    // Only a quote at list prices says anything about the list: a managed
    // price is meant to differ, and the default tier is a guess at the model.
    if (e.pricing === 'catalog') {
      const quote = writeQuote(e.to_model, await $.clock.now(), e.context_tokens, e.estimated_cache_write_usd, e.cache_ttl)
      await noteWriteQuote($, settings, quote)
    }
    if (e.prompt_cache_warm && e.context_tokens > 0) {
      const rates = ratesFor(settings.table, e.to_model, e.context_tokens)
      const usd = rates
        ? (e.context_tokens * writeRate(rates, e.cache_ttl)) / 1_000_000
        : e.estimated_cache_write_usd
      $.ui.toast(
        `Switching to ${e.to_model} gives up a warm prompt cache: ` +
          `the next request re-writes ~${formatTokens(e.context_tokens)} tokens ≈ ${formatUsd(usd)}.`,
        { timeoutMs: 10_000 },
      )
    }
    return next(e)
  })

  on('classic.PostModelSwitch', async ($, e, next) => {
    await noteTtl($, { ttl: e.cache_ttl, from: 'claude-code' })
    await $.store.set(LEARNED_PRICING_KEY, e.pricing)
    return next(e)
  })

  // Spend after the last measurement (a background subagent, an exit right
  // after a turn) is otherwise never recorded; a /clear or /resume ends the
  // old session here before its successor's baseline is taken.
  on('session.end', async ($, e, next) => {
    cancelKeepAlive()
    const usage = await $.session.usage()
    const usd = usage.cost?.usd
    if (usd !== undefined) await serially(() => recordSpend($, usd))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await warnIfCacheExpired($, settings)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    // A subagent's run is a turn of its own. The keep-alive, the prompt's
    // record and the lifetime measurement follow the conversation alone, and
    // nothing would clear what a subagent's start left behind.
    if (e.agentId !== undefined) return next(e)
    runningTurn = e.turnId
    cancelKeepAlive()
    const at = await $.clock.now()
    await update($, turnPrompts, prompts => ({ ...prompts, [e.turnId]: { text: e.text, at } }))
    await startTurnCost($, e.turnId)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const step = { turnId: e.turnId, agentId: e.agentId, startedAt: await $.clock.now() }
    const result = yield* next(e)
    const usage = result.usage
    if (usage) await serially(() => recordStep($, settings, usage, step))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const agentId = e.agentId
    if (agentId === undefined) {
      await serially(() => closeTurn($, settings, e.turnId))
      runningTurn = null
      await armKeepAlive($, settings)
    } else
      await update($, loops, all => {
        const { [agentId]: _done, ...rest } = all
        return rest
      })
    return result
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const text = result.text
    if (typeof text === 'string' && text.length > 0) {
      await serially(() => recordToolResult($, String(e.tool), e.agentId, text))
    }
    return result
  })

  on('session.measure', async ($, e, next) => {
    const cost = e.cost
    if (cost) await serially(() => recordSpend($, cost.usd))
    await refresh($, settings, e.cost?.usd ?? 0, e.rateLimits)

    return next(e)
  })

  on('command.run', { command: 'costs' }, async ($, e) => {
    const args = e.args.trim()
    if (args === 'export') return { text: await writeExport($) }
    if (args === 'doctor') return { text: await runDoctor($, settings) }
    if (args === 'keepalive' || args.startsWith('keepalive ')) return { text: await keepAliveCommand($, settings, args.slice(9).trim()) }

    const usage = await $.session.usage()
    await refresh($, settings, usage.cost?.usd ?? 0, usage.rateLimits)
    await update($, monthOffset, () => 0)
    await $.ui.open({ id: PANE, title: 'Costs' })

    return { text: 'Costs pane opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const t = await read($, totals)
    if (!options.band || e.props.hasSurvey || t === null) return next(e)

    await read($, tick)
    const { Text } = $.ui.resolve(e)
    const contextPart = await contextLine($, settings, await read($, context))
    return <Text dimColor>{summaryLine(t, settings, contextPart)}</Text>
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const t = await read($, totals)
    if (t === null) return <Text dimColor>No cost recorded yet.</Text>

    const now = await $.clock.now()
    const today = dayKey(now)
    const offset = await read($, monthOffset)
    const shading = await read($, shadeBy)
    const ctx = await read($, context)
    const ka = await read($, keepAlive)
    await read($, tick)
    const shown = monthView(now, offset)
    const days = daysIn(t.days, shown.key)
    const shownTotal = days.reduce((sum, [, usd]) => sum + usd, 0)
    const cache = sumMonth<Breakdown>(t.cacheDays, shown.key, addBreakdown)
    const cacheSum = cache ? totalUsd(cache) : 0
    const subagents = sumMonth<Breakdown>(t.subagentDays, shown.key, addBreakdown)
    const subagentSum = subagents ? totalUsd(subagents) : 0
    const step = reconcile(shownTotal, cacheSum)
    const apart = await pricedApart($, settings)
    const isAstray = step.share !== null && apart === undefined && isOutOfStep(step.share)
    const projects = Object.entries(t.projectDays)
      .map(([root, projectDays]) => {
        const month = Object.entries(projectDays).filter(([day]) => day.startsWith(shown.key))
        return {
          name: projectName(root),
          usd: month.reduce((sum, [, d]) => sum + d.usd, 0),
          cacheWriteUsd: month.reduce((sum, [, d]) => sum + d.cacheWriteUsd, 0),
        }
      })
      .filter(p => p.usd > 0 || p.cacheWriteUsd > 0)
      .sort((a, b) => b.usd - a.usd)
    const ttl = await cacheTtl($, settings)
    const cold = ctx !== null && ctx.tokens > 0 ? await coldCost($, settings, ctx, ttl) : undefined
    const pace = monthPace(t.month, now)
    const reachDay = budgetReachDay(t.month, settings.budgets.month, now)
    const wow = weekOverWeek(t.days, now)
    const monthFrom = `${shown.key}-01`
    const monthTo = `${shown.key}-31`
    const expensive = turnsIn(t.turns, monthFrom, monthTo).slice(0, SHOWN_TURNS)
    const tools = topTools(t.toolDays, monthFrom, monthTo).slice(0, SHOWN_TOOLS)

    const shadeValue = (day: string) =>
      shading === 'cacheWrite' ? (t.cacheDays[day]?.usd.cacheWrite ?? 0) : (t.days[day] ?? 0)
    const monthKeys = Object.keys({ ...t.days, ...t.cacheDays }).filter(day => day.startsWith(shown.key))
    const shadePeak = Math.max(0, ...monthKeys.map(shadeValue))
    const barPeak = Math.max(0, ...days.map(([, usd]) => usd))
    const barRoom = Math.max(4, (e.props.bodyColumns ?? 40) - 24)

    const row = (label: string, usd: number, note = '', budget = 0) => (
      <Text>
        {label.padEnd(12)}
        {formatUsd(usd).padStart(10)}
        {budget > 0 && (
          <Text color={usd >= budget ? 'error' : usd >= budget * 0.8 ? 'warning' : undefined}>
            {` of ${formatUsd(budget)} (${Math.round((usd / budget) * 100)}%)`}
          </Text>
        )}
        <Text dimColor>{note}</Text>
      </Text>
    )
    const cell = (day: number | null) => {
      if (day === null) return <Text>{'   '}</Text>
      const key = `${shown.key}-${String(day).padStart(2, '0')}`
      const level = heatLevel(shadeValue(key), shadePeak)
      return (
        <Text>
          {' '}
          <Text
            backgroundColor={level > 0 ? HEAT[level] : undefined}
            color={level > 0 ? '#ffffff' : undefined}
            dimColor={level === 0}
            bold={key === today}
            underline={key === today}
          >
            {String(day).padStart(2)}
          </Text>
        </Text>
      )
    }

    return (
      <Box flexDirection="column">
        {isSubscription && <Text dimColor>Figures are API-equivalent, not billed amounts.</Text>}
        {row('Session', t.session)}
        {row('Today', t.today, '', settings.budgets.day)}
        {row(
          'This week',
          t.week,
          wow.change === null
            ? `  since ${t.weekStart}`
            : `  ${wow.change >= 0 ? '+' : ''}${Math.round(wow.change * 100)}% vs this point last week`,
          settings.budgets.week,
        )}
        {row(
          'This month',
          t.month,
          `  on pace for ${formatUsd(pace)}${reachDay ? `, budget reached ~${reachDay}` : ''}`,
          settings.budgets.month,
        )}
        {isSubscription && t.rateLimits.length > 0 && <Text>Rate limits: {rateLimitText(t.rateLimits)}</Text>}
        <Text> </Text>
        <Box flexDirection="row">
          {offset > OLDEST_MONTH_OFFSET ? (
            <Button key="prev" label="◀" plain hotkey="p" onPress={() => update($, monthOffset, n => n - 1)} />
          ) : (
            <Text> </Text>
          )}
          <Text bold> {shown.name.padEnd(15)}</Text>
          {offset < 0 ? (
            <Button key="next" label="▶" plain hotkey="n" onPress={() => update($, monthOffset, n => n + 1)} />
          ) : (
            <Text> </Text>
          )}
        </Box>
        <Text dimColor>{WEEKDAYS.map(d => ` ${d}`).join('')}</Text>
        {shown.weeks.map(week => (
          <Text>{week.map(cell)}</Text>
        ))}
        <Text>
          <Text dimColor>{'less '}</Text>
          {HEAT.slice(1).map(color => (
            <Text backgroundColor={color}>{'  '}</Text>
          ))}
          <Text dimColor>{' more'}</Text>
          {'   '}
          {formatUsd(shownTotal)}
          <Text dimColor> total</Text>
        </Text>
        <Box flexDirection="row">
          <Text dimColor>Shade by </Text>
          <Button
            key="shade"
            label={shading === 'total' ? 'total spend' : 'cache writes'}
            plain
            hotkey="s"
            onPress={() => update($, shadeBy, s => (s === 'total' ? 'cacheWrite' : 'total'))}
          />
        </Box>
        <Text> </Text>
        <Text bold>
          Prompt cache, {shown.name}
          <Text dimColor> (estimated at {settings.hasCustomRates ? 'your rates' : 'list prices'})</Text>
        </Text>
        {cache === undefined ? (
          <Text dimColor>No requests recorded.</Text>
        ) : (
          <Box flexDirection="column">
            <Text dimColor>{'            '}{'tokens'.padStart(8)}{'cost'.padStart(11)}{'share'.padStart(7)}</Text>
            {CATEGORIES.map(c => (
              <Text>
                {CATEGORY_NAMES[c].padEnd(12)}
                {formatTokens(cache.tokens[c]).padStart(8)}
                {formatUsd(cache.usd[c]).padStart(11)}
                <Text dimColor>{`${cacheSum > 0 ? Math.round((cache.usd[c] / cacheSum) * 100) : 0}%`.padStart(7)}</Text>
              </Text>
            ))}
            {(cache.unpricedTokens ?? 0) > 0 && (
              <Text color="warning">
                {formatTokens(cache.unpricedTokens ?? 0)} tokens from models with no rate are not priced; add them to
                the rates setting
              </Text>
            )}
            <Text dimColor>
              Cache hit {Math.round(hitRate(cache) * 100)}% of prompt tokens
              {settings.hasCustomRates ? '; totals above use Claude Code’s own pricing' : ''}
            </Text>
            {step.share !== null && (
              <Text dimColor={!isAstray} color={isAstray ? 'warning' : undefined}>
                {`The breakdown adds up to ${formatUsd(cacheSum)}, ${Math.round(step.share * 100)}% of the month's ${formatUsd(shownTotal)} total` +
                  (apart !== undefined ? `; ${apart}` : isAstray ? '; /costs doctor says what can cause the gap' : '')}
              </Text>
            )}
            <Text>
              {'Subagents'.padEnd(12)}
              {formatUsd(subagentSum).padStart(19)}
              <Text dimColor>
                {`${cacheSum > 0 ? Math.round((subagentSum / cacheSum) * 100) : 0}%`.padStart(7)}
                {subagents ? `  incl. ${formatUsd(subagents.usd.cacheWrite)} cache writes` : ''}
              </Text>
            </Text>
          </Box>
        )}
        {ctx !== null && ctx.tokens > 0 && (
          <Text dimColor>
            Current context {formatTokens(ctx.tokens)} on {ctx.model}
            {perStepText(ctx, settings)}
            {cacheText(ctx, ttl, now, ka, cold)}
            {nudgeText(ctx, settings)}
          </Text>
        )}
        <Text> </Text>
        <Text bold>
          Most expensive prompts, {shown.name}
          <Text dimColor> (estimated, subagents included)</Text>
        </Text>
        {expensive.length === 0 && <Text dimColor>None recorded.</Text>}
        {expensive.map(turn => (
          <Text>
            {formatUsd(turnUsd(turn)).padStart(9)}{' '}
            <Text dimColor>{`${turn.steps}${turn.subagentSteps > 0 ? `+${turn.subagentSteps}` : ''} req `.padStart(10)}</Text>
            {turn.prompt.slice(0, Math.max(10, (e.props.bodyColumns ?? 60) - 22))}
          </Text>
        ))}
        <Text> </Text>
        <Text bold>
          What filled the context, {shown.name}
          <Text dimColor> (tool results, ≈ tokens)</Text>
        </Text>
        {tools.length === 0 && <Text dimColor>No tool results recorded.</Text>}
        {tools.length > 0 && (
          <Text dimColor>{'tool'.padEnd(22)}{'calls'.padStart(6)}{'tokens'.padStart(8)}{'write'.padStart(9)}{'re-read'.padStart(10)}</Text>
        )}
        {tools.map(([tool, use]) => (
          <Text>
            {toolLabel(tool).slice(0, 21).padEnd(22)}
            {String(use.calls).padStart(6)}
            {formatTokens(use.tokens).padStart(8)}
            {formatUsd(use.writeUsd).padStart(9)}
            {formatUsd(use.rereadUsd).padStart(10)}
          </Text>
        ))}
        <Text> </Text>
        <Text bold>By project, {shown.name}</Text>
        {projects.length === 0 && <Text dimColor>No spend recorded.</Text>}
        {projects.slice(0, SHOWN_PROJECTS).map(p => (
          <Text>
            {p.name.slice(0, 20).padEnd(21)}
            {formatUsd(p.usd).padStart(10)}
            <Text dimColor>{`  ${formatUsd(p.cacheWriteUsd)} cache writes`}</Text>
          </Text>
        ))}
        {projects.length > SHOWN_PROJECTS && (
          <Text dimColor>and {projects.length - SHOWN_PROJECTS} more; /costs export has them all</Text>
        )}
        <Text> </Text>
        <Text bold>Daily, {shown.name}</Text>
        {days.length === 0 && <Text dimColor>No spend recorded.</Text>}
        {days.map(([day, usd]) => (
          <Text>
            {day} {formatUsd(usd).padStart(9)}{' '}
            <Text color="cyan">{'█'.repeat(Math.max(1, Math.round((usd / barPeak) * barRoom)))}</Text>
          </Text>
        ))}
      </Box>
    )
  })
}
