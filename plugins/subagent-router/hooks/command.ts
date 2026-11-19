import type { CommandRunInput, CommandRunResult, EngineInterface } from 'claude-code'
import type { Kind } from '../types'
import { answerCheckPicker } from './check-picker'
import { clean } from './clean'
import { snapshot } from './records'
import { renderReport } from './report'
import { readSettings } from './settings'

const ROUTE_OFF = { plugin: 'subagent-router', key: 'routeOff' } as const
const PICKER_OFF = { plugin: 'subagent-router', key: 'pickerOff' } as const

const LINE_MAX = 160
const USAGE = 'Usage: /subagent-router shows the report; /subagent-router check-picker says what the picker check costs; add confirm to run it.'

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
      .register({ name: 'subagent-router', description: 'Shows what subagent-router decided this session and what those runs cost (estimated)' })
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

async function answerReport($: $): Promise<CommandRunResult> {
  try {
    return { text: await buildReport($), isTextDisplayOnly: true }
  } catch (error) {
    return { text: clean(`subagent-router: the report could not be built (${clean(error, 80)})`, LINE_MAX), isTextDisplayOnly: true }
  }
}

// Display-only: the report costs the conversation nothing and puts none of the records' text before the model.
export async function answerCommand($: $, e: CommandRunInput): Promise<CommandRunResult> {
  const words = typeof e?.args === 'string' ? e.args.trim().split(/\s+/u).filter((word) => word !== '') : []
  if (words.length === 0) return answerReport($)
  if (words[0] === 'check-picker' && words.length === 1) return answerCheckPicker($, e, false)
  if (words[0] === 'check-picker' && words[1] === 'confirm' && words.length === 2) return answerCheckPicker($, e, true)
  return { text: USAGE, isTextDisplayOnly: true }
}
