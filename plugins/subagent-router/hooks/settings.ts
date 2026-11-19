import type { EngineInterface } from 'claude-code'
import type { Mode, Route, Settings } from '../types'
import { clean } from './clean'
import { familyOf } from './model-rank'

const PLUGIN = 'subagent-router'
const FORCE_VARIABLE = 'CLAUDE_CODE_SUBAGENT_MODEL_FORCE'
const MODES: readonly Mode[] = ['observe', 'route', 'off']

export type SettingsHost = {
  settings: { read: (args: { source: 'user' | 'policy' }) => Promise<unknown> }
  env: Pick<EngineInterface['env'], 'get'>
}

type Options = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

function shown(value: unknown): string {
  return value === null ? 'null' : `"${clean(value, 40)}"`
}

function parseMode(value: unknown, notes: string[]): Mode {
  if (value === undefined) return 'observe'
  const name = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const found = MODES.find(mode => mode === name)
  if (found) return found
  notes.push(`mode ${shown(value)} is not observe, route or off, so the router is off`)
  return 'off'
}

function parseRoute(field: string, value: unknown, fallback: Route, notes: string[]): Route {
  if (value === undefined) return fallback
  const name = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (name === 'parent') return 'parent'
  const family = name === '' ? undefined : familyOf(name)
  if (family) return family
  notes.push(`${field} ${shown(value)} is not a model family or parent, so the parent model is used`)
  return 'parent'
}

export function parseSettings(raw: unknown, force: string | undefined): Settings {
  const options = isRecord(raw) ? raw : {}
  const notes: string[] = []
  const mode = parseMode(options.mode, notes)
  const locating = parseRoute('locatingRoute', options.locatingRoute, 'haiku', notes)
  const reading = parseRoute('readingRoute', options.readingRoute, 'parent', notes)
  const standingDown = force !== undefined && force !== '' && force !== '0' && force !== 'false'
    ? `${FORCE_VARIABLE} is set`
    : null
  return { mode, routes: { locating, reading }, standingDown, notes }
}

function isOurKey(key: string): boolean {
  return key === PLUGIN || key.startsWith(`${PLUGIN}@`)
}

export function pickOptions(settings: unknown): { options: Options; note: string | null; conflicts: string[] } {
  const configs = isRecord(settings) ? settings.pluginConfigs : undefined
  if (!isRecord(configs)) return { options: {}, note: null, conflicts: [] }

  const options: Options = {}
  const conflicts = new Set<string>()
  for (const [key, entry] of Object.entries(configs)) {
    if (!isOurKey(key) || !isRecord(entry) || !isRecord(entry.options)) continue
    for (const [field, value] of Object.entries(entry.options)) {
      // An own "__proto__" key from parsed JSON would otherwise set the prototype.
      if (field === '__proto__') continue
      if (!Object.hasOwn(options, field)) options[field] = value
      else if (!sameValue(options[field], value)) conflicts.add(field)
    }
  }
  for (const field of conflicts) delete options[field]
  const note = conflicts.size === 0
    ? null
    : `${PLUGIN} settings disagree on ${[...conflicts].map(f => `"${clean(f, 40)}"`).join(', ')}, so ${conflicts.size === 1 ? 'it is' : 'they are'} not recognised`
  return { options, note, conflicts: [...conflicts] }
}

function off(note: string): Settings {
  const stood = parseSettings({ mode: 'off' }, undefined)
  return { ...stood, notes: [note] }
}

export async function readSettings($: SettingsHost): Promise<Settings> {
  const merged: Options = {}
  const notes: string[] = []
  try {
    // Only user and policy are read: project and local settings come from the repository being worked in.
    const user = pickOptions(await $.settings.read({ source: 'user' }))
    const policy = pickOptions(await $.settings.read({ source: 'policy' }))
    if (user.note !== null) notes.push(`user: ${user.note}`)
    if (policy.note !== null) notes.push(`policy: ${policy.note}`)
    Object.assign(merged, user.options, policy.options)
    // A field the sources disagree on is unrecognised, not missing: a missing one would take a default that can be more active than either entry.
    for (const field of policy.conflicts) merged[field] = null
    for (const field of user.conflicts) if (!Object.hasOwn(policy.options, field)) merged[field] = null
    // A literal, not FORCE_VARIABLE: the engine reads env names off the source and refuses a name the module does not spell.
    const force = await $.env.get('CLAUDE_CODE_SUBAGENT_MODEL_FORCE')
    const parsed = parseSettings(merged, typeof force === 'string' ? force : undefined)
    return { ...parsed, notes: [...notes, ...parsed.notes] }
  } catch (error) {
    return off(`settings could not be read (${clean(error, 40)}), so the router is off`)
  }
}
