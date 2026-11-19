import type { CommandRunResult, EngineInterface } from 'claude-code'
import type { Kind } from '../types'
import { clean } from './clean'
import { snapshot } from './records'
import { renderReport } from './report'
import { readSettings } from './settings'

const ROUTE_OFF = { plugin: 'subagent-router', key: 'routeOff' } as const
const PICKER_OFF = { plugin: 'subagent-router', key: 'pickerOff' } as const

const LINE_MAX = 160

type $ = EngineInterface

let commandRegistered = false
let registering: Promise<void> | undefined

// Whether a command outlives a settings reload is not yet known (probe Q12), so every hook asks until one call in
// this load has succeeded. Resolves whatever happens, so a caller that does not await it is never held up or failed.
export function registerCommand($: $): Promise<void> {
  if (commandRegistered) return Promise.resolve()
  if (registering !== undefined) return registering
  try {
    registering = $.command
      .register({ name: 'subagent-router', description: 'Shows what subagent-router decided this session and what it would save' })
      .then(
        () => {
          commandRegistered = true
        },
        () => undefined,
      )
      .finally(() => {
        registering = undefined
      })
    return registering
  } catch {
    return Promise.resolve()
  }
}

async function buildReport($: $): Promise<string> {
  const [settings, recorded, locatingOff, readingOff, pickerOff] = await Promise.all([
    readSettings($),
    snapshot($),
    $.state.get({ ...ROUTE_OFF, id: 'locating' }),
    $.state.get({ ...ROUTE_OFF, id: 'reading' }),
    $.state.get(PICKER_OFF),
  ])
  const routeOff: Kind[] = []
  if (locatingOff.value !== undefined) routeOff.push('locating')
  if (readingOff.value !== undefined) routeOff.push('reading')
  return renderReport({ settings, ...recorded, routeOff, pickerOff: pickerOff.value === true })
}

// Display-only: the report costs the conversation nothing and puts none of the records' text before the model.
export async function answerCommand($: $): Promise<CommandRunResult> {
  try {
    return { text: await buildReport($), isTextDisplayOnly: true }
  } catch (error) {
    return { text: clean(`subagent-router: the report could not be built (${clean(error, 80)})`, LINE_MAX), isTextDisplayOnly: true }
  }
}
