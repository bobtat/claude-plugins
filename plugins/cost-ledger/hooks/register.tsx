import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { Breakdown, Context, RateLimit, ToolUse, Totals } from '../types'
import {
  addStepToTurn,
  addToolResult,
  budgetReachDay,
  chargesAsUse,
  chargeStep,
  emptyLoop,
  estimateTokens,
  finishTurn,
  monthPace,
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
  addUsage,
  applyTools,
  applyTurn,
  applyUsage,
  budgetAlert,
  cacheMinutesLeft,
  dayKey,
  daysIn,
  exportCsv,
  formatTokens,
  formatUsd,
  heatLevel,
  mergeEntries,
  monthView,
  OLDEST_MONTH_OFFSET,
  projectName,
  pruneDays,
  shouldArchive,
  spendSince,
  summarize,
  sumMonth,
  UNKNOWN_PROJECT,
  weekStartKey,
} from './ledger'
import type { SessionEntry } from './ledger'
import {
  addBreakdown,
  CATEGORIES,
  hitRate,
  priceUsage,
  rateTable,
  ratesFor,
  totalUsd,
  writeRate,
} from './pricing'
import type { CacheTtl, RateTable, Usage } from './pricing'

const PANE = 'cost-ledger'
const SESSION_PREFIX = 'session:'
const ARCHIVE_PREFIX = 'archive:'
const LEARNED_TTL_KEY = 'learnedCacheTtl'
const LEARNED_PRICING_KEY = 'learnedPricing'
const UNPRICED_MODELS_KEY = 'unpricedModels'
const PROBE_KEY = 'doctorProbe'
const STORE_LIMIT_BYTES = 4 * 1024 * 1024
const SHOWN_TURNS = 10
const SHOWN_TOOLS = 8
const BUDGET_PREFIX = 'budget:'
const TICK_MS = 30_000
const SHOWN_PROJECTS = 8
const TTL_MS: Record<CacheTtl, number> = { '5m': 5 * 60_000, '1h': 60 * 60_000 }
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

type Settings = {
  isSubscription: boolean
  hasStatusLine: boolean
  table: RateTable
  hasCustomRates: boolean
  ttlSetting: string
  largeWriteTokens: number
  contextNudgeTokens: number
  budgets: { day: number; week: number; month: number }
  expensiveTurnUsd: number
}

function readSettings(options: PluginOptions): Settings {
  const rates = typeof options.rates === 'string' ? options.rates : ''
  return {
    isSubscription: options.billing === 'subscription',
    hasStatusLine: options.statusLine === true,
    table: rateTable(rates),
    hasCustomRates: rates.trim() !== '',
    ttlSetting: typeof options.cacheTtl === 'string' ? options.cacheTtl : 'auto',
    largeWriteTokens: typeof options.largeWriteTokens === 'number' ? options.largeWriteTokens : 0,
    contextNudgeTokens: typeof options.contextNudgeTokens === 'number' ? options.contextNudgeTokens : 0,
    budgets: {
      day: typeof options.dailyBudget === 'number' ? options.dailyBudget : 0,
      week: typeof options.weeklyBudget === 'number' ? options.weeklyBudget : 0,
      month: typeof options.monthlyBudget === 'number' ? options.monthlyBudget : 0,
    },
    expensiveTurnUsd: typeof options.expensiveTurnUsd === 'number' ? options.expensiveTurnUsd : 0,
  }
}

async function loadEntries($: EngineInterface): Promise<[string, SessionEntry][]> {
  const keys = (await $.store.keys()).filter(key => key.startsWith(SESSION_PREFIX) || key.startsWith(ARCHIVE_PREFIX))
  return Promise.all(
    keys.map(async key => [key, (await $.store.get(key)) as SessionEntry] as [string, SessionEntry]),
  )
}

async function cacheTtl($: EngineInterface, settings: Settings): Promise<CacheTtl> {
  if (settings.ttlSetting === '5m' || settings.ttlSetting === '1h') return settings.ttlSetting
  const learned = await $.store.get(LEARNED_TTL_KEY)
  return learned === '1h' ? '1h' : '5m'
}

function rateLimitText(limits: readonly RateLimit[]): string {
  return limits.map(l => `${RATE_LIMIT_NAMES[l.kind] ?? l.kind} ${Math.round(l.percentUsed)}%`).join(' · ')
}

function perStepText(ctx: Context, settings: Settings): string {
  const rates = ratesFor(settings.table, ctx.model)
  return rates ? ` ≈${formatUsd((ctx.tokens * rates.cacheRead) / 1_000_000)}/step` : ''
}

function nudgeText(ctx: Context, settings: Settings): string {
  return settings.contextNudgeTokens > 0 && ctx.tokens >= settings.contextNudgeTokens ? ', consider /compact' : ''
}

function cacheText(ctx: Context, ttl: CacheTtl, now: number): string {
  const left = cacheMinutesLeft(ctx.at, TTL_MS[ttl], now)
  return left > 0 ? ` · cache warm ${left}m` : ' · cache cold'
}

// The context segment of the status line and band; empty before the first
// main-thread response of the session.
async function contextLine($: EngineInterface, settings: Settings, ctx: Context | null): Promise<string> {
  if (ctx === null || ctx.tokens === 0) return ''
  const ttl = await cacheTtl($, settings)
  const cache = cacheText(ctx, ttl, await $.clock.now())
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

async function pruneBudgetKeys($: EngineInterface, now: number) {
  const today = dayKey(now)
  const current = [`day:${today}:`, `week:${weekStartKey(now)}:`, `month:${today.slice(0, 7)}:`]
  const isCurrent = (period: string) => current.some(prefix => period.startsWith(prefix))
  for (const key of await $.store.keys()) {
    if (key.startsWith(BUDGET_PREFIX) && !isCurrent(key.slice(BUDGET_PREFIX.length))) await $.store.delete(key)
  }
}

async function writeExport($: EngineInterface): Promise<string> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  if (home === undefined) return 'Could not find a home folder to write the export to.'

  const csv = exportCsv((await loadEntries($)).map(([, entry]) => entry))
  const path = `${home}/claude-costs/claude-costs-${dayKey(await $.clock.now())}.csv`
  await $.fs.write(path, csv)
  return `Wrote ${csv.trimEnd().split('\n').length - 1} rows to ${path}`
}

// Module scope on purpose: one notice per load of the mod is enough.
let hasWarnedSaveFailure = false

async function saveEntry($: EngineInterface, key: string, entry: SessionEntry): Promise<boolean> {
  try {
    await $.store.set(key, entry)
    return true
  } catch (error) {
    if (!hasWarnedSaveFailure) {
      hasWarnedSaveFailure = true
      $.ui.toast(`cost-ledger could not save spend, so totals will fall behind: ${String(error)}`, {
        timeoutMs: 15_000,
      })
    }
    return false
  }
}

// Sessions untouched for 60 days are folded into one archive entry per
// project, and days past retention are dropped, which keeps the store far
// below its 4 MiB limit however many sessions run.
async function compactStore($: EngineInterface, now: number) {
  for (const [key, entry] of await loadEntries($)) {
    if (!key.startsWith(SESSION_PREFIX) || !shouldArchive(entry, now)) continue
    const archiveKey = ARCHIVE_PREFIX + (entry.project ?? UNKNOWN_PROJECT)
    const archive = (await $.store.get(archiveKey)) as SessionEntry | undefined
    if (await saveEntry($, archiveKey, mergeEntries(archive, entry))) await $.store.delete(key)
  }
  for (const [key, entry] of await loadEntries($)) {
    const pruned = pruneDays(entry, now)
    const dayCount = (e: SessionEntry) =>
      [e.days, e.cache, e.subagentCache].reduce((sum, days) => sum + Object.keys(days ?? {}).length, 0)
    if (pruned === undefined) await $.store.delete(key)
    else if (dayCount(pruned) !== dayCount(entry)) await saveEntry($, key, pruned)
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
  const entries = (await loadEntries($)).map(([, entry]) => entry)
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
  const ttl = await cacheTtl($, settings)
  const rates = ratesFor(settings.table, usage.model)
  const priced = priceUsage(usage, rates, ttl)
  if (rates === undefined) await noteUnpricedModel($, usage.model)

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
    const tokens =
      usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens + usage.output_tokens
    await update($, context, () => ({ tokens, model: usage.model, at: step.startedAt }))
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

async function noteUnpricedModel($: EngineInterface, model: string) {
  const seen = ((await $.store.get(UNPRICED_MODELS_KEY)) as string[] | undefined) ?? []
  if (!seen.includes(model)) await $.store.set(UNPRICED_MODELS_KEY, [...seen, model].slice(-20))
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

async function finishActiveTurn($: EngineInterface, settings: Settings, turnId: string) {
  const turn = await read($, activeTurn)
  await update($, turnPrompts, prompts => {
    const { [turnId]: _done, ...rest } = prompts
    return rest
  })
  if (turn === null || turn.turnId !== turnId) return
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

  const learnedTtl = await $.store.get(LEARNED_TTL_KEY)
  say(
    null,
    'Cache lifetime',
    `using ${await cacheTtl($, settings)} (setting: ${settings.ttlSetting}; reported by Claude Code: ${typeof learnedTtl === 'string' ? learnedTtl : 'not yet'})`,
  )

  const usd = (await $.session.usage()).cost?.usd ?? 0
  const recorded = await read($, lastUsd)
  if (recorded === null) say(false, 'Baseline', 'not set; spend is recorded from the next measurement')
  else if (recorded > usd + 0.005) say(false, 'Baseline', `recorded up to ${formatUsd(recorded)}, above the session's ${formatUsd(usd)}`)
  else say(true, 'Baseline', `session at ${formatUsd(usd)}, recorded up to ${formatUsd(recorded)}${usd - recorded >= 0.005 ? '; the rest is recorded after the next turn' : ''}`)

  if (settings.table.error) say(false, 'Rates', settings.table.error)
  const unpriced = ((await $.store.get(UNPRICED_MODELS_KEY)) as string[] | undefined) ?? []
  say(unpriced.length === 0, 'Models', unpriced.length === 0 ? 'every model seen has a rate' : `no rate for ${unpriced.join(', ')}; add them to the rates setting`)

  say(null, 'Resume', 'cannot be checked from here: compare /costs before and after a /resume of a session with known spend')
  return lines.join('\n')
}

async function warnIfCacheExpired($: EngineInterface, settings: Settings) {
  const ctx = await read($, context)
  if (ctx === null || ctx.tokens === 0) return

  const ttl = await cacheTtl($, settings)
  const idleMs = (await $.clock.now()) - ctx.at
  if (idleMs <= TTL_MS[ttl]) return

  const rates = ratesFor(settings.table, ctx.model)
  const cost = rates ? ` ≈ ${formatUsd((ctx.tokens * writeRate(rates, ttl)) / 1_000_000)}` : ''
  $.ui.toast(
    `Prompt cache has likely expired (idle ${Math.round(idleMs / 60_000)} min, ${ttl} cache): ` +
      `this prompt re-writes ~${formatTokens(ctx.tokens)} tokens${cost}.`,
    { timeoutMs: 10_000 },
  )
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)
  const { isSubscription } = settings

  // Steps of parallel subagents finish concurrently; each read-modify-write of
  // this session's store entry must see the previous one's result.
  let queue: Promise<void> = Promise.resolve()
  const serially = (task: () => Promise<void>) => {
    const run = queue.then(task)
    queue = run.catch(() => undefined)
    return run
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'costs',
      description: 'Show session, weekly and monthly Claude Code costs; "export" writes a CSV, "doctor" checks the setup',
      argumentHint: '[export|doctor]',
    })
    if (settings.table.error) $.ui.toast(`cost-ledger: ${settings.table.error}`)

    const now = await $.clock.now()
    await compactStore($, now)
    await pruneBudgetKeys($, now)
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

    // A resumed transcript's cache is as old as its last response, so the
    // idle warning on the first prompt covers resumes too.
    if (e.context_tokens && e.seconds_since_last_response !== undefined && e.model) {
      const at = (await $.clock.now()) - e.seconds_since_last_response * 1000
      await update($, context, () => ({ tokens: e.context_tokens ?? 0, model: e.model ?? '', at }))
    }
    return next(e)
  })

  on('classic.PreModelSwitch', async ($, e, next) => {
    await $.store.set(LEARNED_TTL_KEY, e.cache_ttl)
    await $.store.set(LEARNED_PRICING_KEY, e.pricing)
    if (e.prompt_cache_warm && e.context_tokens > 0) {
      const rates = ratesFor(settings.table, e.to_model)
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
    await $.store.set(LEARNED_TTL_KEY, e.cache_ttl)
    await $.store.set(LEARNED_PRICING_KEY, e.pricing)
    return next(e)
  })

  // Spend after the last measurement (a background subagent, an exit right
  // after a turn) is otherwise never recorded; a /clear or /resume ends the
  // old session here before its successor's baseline is taken.
  on('session.end', async ($, e, next) => {
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
    const at = await $.clock.now()
    await update($, turnPrompts, prompts => ({ ...prompts, [e.turnId]: { text: e.text, at } }))
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
    if (agentId === undefined) await serially(() => finishActiveTurn($, settings, e.turnId))
    else
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
    await read($, tick)
    const shown = monthView(now, offset)
    const days = daysIn(t.days, shown.key)
    const shownTotal = days.reduce((sum, [, usd]) => sum + usd, 0)
    const cache = sumMonth<Breakdown>(t.cacheDays, shown.key, addBreakdown)
    const cacheSum = cache ? totalUsd(cache) : 0
    const subagents = sumMonth<Breakdown>(t.subagentDays, shown.key, addBreakdown)
    const subagentSum = subagents ? totalUsd(subagents) : 0
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
            {cacheText(ctx, ttl, now)}
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
