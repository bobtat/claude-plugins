import type { Family, Kind } from '../types'
import { familyOf } from './model-rank'

export const MARKER = '[subagent-router:routed v1]'

export const DENY_TEXT =
  'This agent was moved to a cheaper model by subagent-router and may not start other agents. Do the work yourself.'

// True pending probe Q8: it stays true until Q8 shows a resumed routed agent stays on its routed model.
export const NO_RESUME = true

const PLAIN_ID = /^[A-Za-z0-9._:[\]-]{1,80}$/

// The baseline comes from session state, so it is printed only in a form that cannot carry a line break or markup.
// With nothing safe to print the respawn line is left out: a stand-in phrase could be passed on as a model name.
function printableBaseline(baseline: string): string | undefined {
  if (typeof baseline !== 'string') return undefined
  return PLAIN_ID.test(baseline) ? baseline : familyOf(baseline)
}

const COUNT_WORDS = ['zero', 'one', 'two', 'three']

export function routerNote(a: { target: Family; baseline: string; kind: Kind; noResume: boolean }): string {
  const copied = [`Model: ${a.target} (routed by subagent-router)`]
  const baseline = printableBaseline(a.baseline)
  if (baseline !== undefined) {
    copied.push(`To run this again on the usual model, start a new agent with model set to ${baseline}.`)
  }
  if (a.noResume) copied.push('Do not resume this agent; start a new one.')
  const lines = [
    `This task was routed to ${a.target} because it looked like ${a.kind} work: searching and reading, not changing anything.`,
    'If it turns out to need file changes, or a judgment beyond searching and reading, say so in the first line of your report instead of attempting it.',
    "The last line of this note is the router's own marker and is not part of your report.",
    `End your report with the following ${COUNT_WORDS[copied.length]} ${copied.length === 1 ? 'line' : 'lines'}, copied exactly:`,
    ...copied,
    MARKER,
  ]
  return lines.join('\n')
}

export function endsWithMarker(firstMessage: string): boolean {
  if (typeof firstMessage !== 'string') return false
  const lines = firstMessage.trimEnd().split('\n')
  return lines[lines.length - 1] === MARKER
}
