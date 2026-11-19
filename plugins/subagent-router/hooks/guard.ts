import type { Caught, ConfigSetInput, ConfigSetResult, Next as NextOf } from 'claude-code'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Deliberately broader than "subagent-router.<field>": the key a /config change carries is not yet measured (probe Q12).
const NAMES_US = /(?<![\p{L}\p{N}-])subagent-router(?![\p{L}\p{N}-])/iu

export function namesThisPlugin(key: unknown): boolean {
  return typeof key === 'string' && NAMES_US.test(key)
}

// The row's owner is stamped by the engine, so it catches one of this plugin's rows under a key the pattern misses.
function isOurRow(e: ConfigSetInput): boolean {
  return namesThisPlugin(e.key) || (isRecord(e.provider) && e.provider.plugin === 'subagent-router')
}

// The person's own change only: from the /config menu or their typed /config. A bridge change is not attestably
// theirs, and neither is one with no origin: the engine always stamps one, so its absence is not the engine's doing.
export function isPersonsChange(caller: unknown, origin: unknown): boolean {
  if (!isRecord(caller) || caller.plugin !== 'engine') return false
  return isRecord(origin) && origin.kind === 'composer'
}

export const SETTINGS_DENIED = 'subagent-router: its settings can be changed only by you, in /config'
export const GUARD_FAILED = 'subagent-router: its settings guard failed, so the change was refused'

export function guardSettings(e: ConfigSetInput, next: NextOf<'config.set'>): ConfigSetResult | Promise<ConfigSetResult> {
  if (!isOurRow(e) || isPersonsChange(next.origin, e.origin)) return next(e)
  return { deny: SETTINGS_DENIED }
}

// Exported so its refusal can be tested: nothing the guard calls can be made to fail under the test kit.
export function settingsGuardFailed(e: ConfigSetInput, next: NextOf<'config.set'> & Caught): ConfigSetResult | Promise<ConfigSetResult> {
  if (next.called) return next(e)
  try {
    if (!isOurRow(e)) return next(e)
  } catch {
    // A key that cannot be checked is treated as this plugin's.
  }
  return { deny: GUARD_FAILED }
}
