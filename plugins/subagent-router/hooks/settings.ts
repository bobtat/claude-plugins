import type { EngineInterface } from 'claude-code'
import type { Mode, Route, Settings } from '../types'
import type { Family } from '../types'
import { clean, hasHidden, jsonOf } from './clean'
import { familyOf } from './model-rank'

const PLUGIN = 'subagent-router'
const FORCE_VARIABLE = 'CLAUDE_CODE_SUBAGENT_MODEL_FORCE'
const MODES: readonly Mode[] = ['observe', 'route', 'off']
const FAMILIES: readonly Family[] = ['haiku', 'sonnet', 'opus', 'fable']

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

// Without the remark, "route" with a zero-width space would be reported as an unrecognised "route".
function shown(value: unknown): string {
  if (typeof value !== 'string') return clean(jsonOf(value), 40)
  return hasHidden(value) ? `"${clean(value, 40)}" (hidden characters removed)` : `"${clean(value, 40)}"`
}

// As JSON, so a value that differs from an option only by a newline shows the difference ("route\n").
function shownAsJson(value: unknown): string {
  const json = jsonOf(value)
  return hasHidden(json) ? `${clean(json, 40)} (hidden characters removed)` : clean(json, 40)
}

// Exactly as the manifest lists it: the engine treats any other value as unset, so /config would show the default
// observe while a loosely read " Route" ran as route.
function parseMode(value: unknown, notes: string[]): Mode {
  if (value === undefined) return 'observe'
  const found = MODES.find(mode => mode === value)
  if (found) return found
  const loosely = typeof value === 'string' && MODES.some(mode => mode === value.trim().toLowerCase())
  notes.push(loosely
    ? `mode ${shownAsJson(value)} must be written exactly (lower case, no spaces) as observe, route or off, so the router is off`
    : `mode ${shown(value)} is not observe, route or off, so the router is off`)
  return 'off'
}

// A route names a family only as the whole value or as a claude- model id with one readable family: "not-haiku",
// "my-haiku" and "not haiku" hold a family word but do not name one.
function routeOf(name: string): Route | undefined {
  if (name === 'parent') return 'parent'
  const family = FAMILIES.find(f => f === name)
  if (family) return family
  if (!name.startsWith('claude-') || /\s/u.test(name)) return undefined
  return familyOf(name)
}

function parseRoute(field: string, value: unknown, fallback: Route, notes: string[]): Route {
  if (value === undefined) return fallback
  const route = typeof value === 'string' ? routeOf(value.trim().toLowerCase()) : undefined
  if (route) return route
  notes.push(`${field} ${shown(value)} is not a model family or parent, so the parent model is used`)
  return 'parent'
}

// `conflicted` names fields already reported as a conflict: they are unrecognised, with no note of their own.
export function parseSettings(raw: unknown, force: string | undefined, conflicted: ReadonlySet<string> = new Set()): Settings {
  const options = isRecord(raw) ? raw : {}
  const notes: string[] = []
  const mode = conflicted.has('mode') ? 'off' : parseMode(options.mode, notes)
  const locating = conflicted.has('locatingRoute') ? 'parent' : parseRoute('locatingRoute', options.locatingRoute, 'haiku', notes)
  const reading = conflicted.has('readingRoute') ? 'parent' : parseRoute('readingRoute', options.readingRoute, 'parent', notes)
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

function conflictNote(source: 'user' | 'policy', field: string, outcome: 'off' | 'overruled'): string {
  const name = clean(field, 40)
  const head = `${source}: ${PLUGIN} entries disagree on ${name}`
  if (outcome === 'overruled') return `${head}, so policy's value is used`
  if (field === 'mode') return `${head}, so the router is off`
  if (field === 'locatingRoute' || field === 'readingRoute') return `${head}, so that route is off and the parent model is used`
  return `${head}, so it is not used`
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
    Object.assign(merged, user.options, policy.options)
    // A field the sources disagree on is unrecognised, not missing: a missing one would take a default that can be more active than either entry.
    const conflicted = new Set<string>()
    for (const field of policy.conflicts) {
      conflicted.add(field)
      notes.push(conflictNote('policy', field, 'off'))
    }
    for (const field of user.conflicts) {
      if (policy.conflicts.includes(field)) continue
      if (Object.hasOwn(policy.options, field)) {
        notes.push(conflictNote('user', field, 'overruled'))
      } else {
        conflicted.add(field)
        notes.push(conflictNote('user', field, 'off'))
      }
    }
    // A literal, not FORCE_VARIABLE: the engine reads env names off the source and refuses a name the module does not spell.
    const force = await $.env.get('CLAUDE_CODE_SUBAGENT_MODEL_FORCE')
    const parsed = parseSettings(merged, typeof force === 'string' ? force : undefined, conflicted)
    return { ...parsed, notes: [...notes, ...parsed.notes] }
  } catch (error) {
    return off(`settings could not be read (${clean(error, 40)}), so the router is off`)
  }
}
