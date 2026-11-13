// /costs doctor: the self-check's report, from the store, the host and the
// session's own readings as they are handed in.

import type { EngineInterface } from 'claude-code'

import type { Breakdown, KeepAlive, LearnedTtl } from '../types'
import { isOutOfStep, reconcile } from './insights'
import { dayKey, formatTokens, formatUsd, summarize, sumMonth, turnSplit } from './ledger'
import { keptQuotes, rateText } from './pricecheck'
import { pricedApart, quoteVerdict } from './prices'
import { addBreakdown, ratesFor, totalUsd } from './pricing'
import type { CacheTtl } from './pricing'
import type { Settings } from './settings'
import { ledgerEntries, LEARNED_PRICING_KEY, SESSION_PREFIX, SHARED_PREFIX_KEY, UNPRICED_MODELS_KEY, WRITE_QUOTES_KEY } from './store'

const PROBE_KEY = 'doctorProbe'
const STORE_LIMIT_BYTES = 4 * 1024 * 1024

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
// What the doctor reports of the session's own state. The module that holds
// that state reads it and hands it over.
export type SessionReadings = {
  ttl: CacheTtl
  ownTtl: LearnedTtl | null
  storedTtlKey: string
  isHeadless: boolean
  keepAlive: KeepAlive
  isKeepAliveOn: boolean
  recordedUsd: number | null
}

export async function runDoctor($: EngineInterface, settings: Settings, session: SessionReadings): Promise<string> {
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

  const own = session.ownTtl
  const stored = await $.store.get(session.storedTtlKey)
  const kind = session.isHeadless ? 'headless' : 'interactive'
  const learned =
    own !== null
      ? `this session: ${own.ttl}, ${own.from === 'pricing' ? "from Claude Code's pricing of a turn" : 'reported by Claude Code'}`
      : stored === '5m' || stored === '1h'
        ? `not learned in this session yet; earlier ${kind} sessions: ${stored}`
        : 'not learned yet'
  say(null, 'Cache lifetime', `using ${session.ttl} (setting: ${settings.ttlSetting}; ${learned})`)
  const prefix = await $.store.get(SHARED_PREFIX_KEY)
  say(
    null,
    'Shared opening',
    typeof prefix === 'number'
      ? `${formatTokens(prefix)} tokens stay cached between sessions; cold-resume estimates leave them out of the likely cost`
      : 'not measured yet; it is read from the first request of a new conversation',
  )
  const ka = session.keepAlive
  say(
    null,
    'Keep-alive',
    `${session.isKeepAliveOn ? 'on' : 'off'}${ka.override === null ? '' : ' for this session'}; ${ka.pings} ping${ka.pings === 1 ? '' : 's'} this session${ka.stopped ? `, stopped: ${ka.stopped}` : ''}`,
  )

  const usd = (await $.session.usage()).cost?.usd ?? 0
  const recorded = session.recordedUsd
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
