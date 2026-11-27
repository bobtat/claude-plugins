// The mod's settings as its code reads them, parsed once from the plugin's
// options.

import type { PluginOptions } from 'claude-code'

import { rateTable } from './pricing'
import type { CacheTtl, RateTable } from './pricing'

// Claude Code prices at list rates unless an administrator set managed rates,
// so the cache lifetime it charged is read against list prices, never the
// rates setting.
export const LIST_TABLE = rateTable('')

export type Settings = {
  isSubscription: boolean
  hasStatusLine: boolean
  table: RateTable
  hasCustomRates: boolean
  ttlSetting: string
  largeWriteTokens: number
  contextNudgeTokens: number
  budgets: { day: number; week: number; month: number }
  expensiveTurnUsd: number
  keepAlive: boolean
  keepAliveMaxIdleMs: number
  keepAliveMinTokens: number
}

export function readSettings(options: PluginOptions): Settings {
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
    keepAlive: options.keepAlive === 'on',
    keepAliveMaxIdleMs: (typeof options.keepAliveMaxIdleMinutes === 'number' ? options.keepAliveMaxIdleMinutes : 0) * 60_000,
    keepAliveMinTokens: typeof options.keepAliveMinContextTokens === 'number' ? options.keepAliveMinContextTokens : 0,
  }
}

export const isTtlSet = (settings: Settings): settings is Settings & { ttlSetting: CacheTtl } =>
  settings.ttlSetting === '5m' || settings.ttlSetting === '1h'
