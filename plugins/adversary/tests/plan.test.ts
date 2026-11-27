import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { AgentInfo, On } from 'claude-code'

const ROOT = 'C:/work/repo'
const NOW = new Date(2026, 9, 15, 12).getTime()
const AGENT = 'reviewer-1'
const PLAN = '1. Add the lock\n2. Take it first'
const BAND = 'Plan ready — /adversary plan to review it'

type Outcome = Record<string, unknown>
const planned = (plan: string | null): Outcome => ({ result: { plan, isAgent: false }, text: 'ok' })

const slashes = (path: string) => path.replace(/\\/g, '/')
const shipped = (path: string) => /\/templates\/(pr|plan|doc)\.md$/.test(path) && !path.startsWith(ROOT)

function world(on: On, outcome: Outcome = planned(PLAN)) {
  const spawned: { prompt: string }[] = []
  const submitted: string[] = []
  mock.clock(on, { now: NOW })
  mock.env(on, { USERPROFILE: 'C:/Users/someone', TEMP: 'C:/tmp' })
  on('session.root', () => ({ value: ROOT }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('agent.register', (_$, e) => ({ value: { agent: `adversary:${e.name}` } }))
  const agents: AgentInfo[] = []
  on('agent.list', () => ({ value: agents }))
  on('agent.spawn', (_$, e) => {
    const input = e as unknown as { prompt: string; subagent_type: string; description: string }
    spawned.push(input)
    agents.push({ id: AGENT, description: input.description, type: input.subagent_type, status: 'running' })
    return { model: 'claude-opus-5-5', agentId: AGENT }
  })
  on('turn.complete', () => ({ text: '' }))
  on('tool.list', () => ({ value: [] }))
  on('fs.exists', (_$, e) => ({ value: shipped(slashes(e.path)) }))
  on('fs.read', (_$, e) => (shipped(slashes(e.path)) ? { value: '{{artifact}}\n\n{{output_contract}}\n' } : { deny: `ENOENT: ${e.path}` }))
  on('fs.write', () => ({ value: undefined }))
  on('fs.stat', (_$, e) => ({ value: { kind: 'file', size: 1, mtimeMs: NOW, isLink: false, realPath: slashes(e.path) } }))
  on('fs.list', () => ({ value: [] }))
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('tool.call', () => outcome as never)
  // The engine draws nothing of its own in the band.
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}) as never)
  return { spawned, submitted }
}

const exitPlanMode = ($: Engine, extra: Record<string, unknown> = {}) => $.tool.call({ tool: 'ExitPlanMode', ...extra } as never)

const mountBand = ($: Engine) =>
  $.ui.mount({
    plugin: 'adversary',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 120, scroll: { offset: 0, bodyRows: 3 }, view: {} },
  })

const hasBand = async ($: Engine) => (await (await mountBand($)).find({ type: 'Text', text: BAND })) !== undefined

const submit = ($: Engine, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

async function adversary($: Engine, args: string) {
  const result = await $.command.run({ command: 'adversary', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  return 'text' in result ? String(result.text) : ''
}

test('ExitPlanMode stores the plan from its result and shows the band', async ($, on) => {
  const w = world(on)

  await exitPlanMode($)

  expect(await hasBand($)).toBe(true)
  await adversary($, 'plan')
  expect(w.spawned[0]!.prompt).toContain(PLAN)
})

test('the next prompt clears the band but keeps the plan', async ($, on) => {
  const w = world(on)
  await exitPlanMode($)

  await submit($, 'go ahead')

  expect(w.submitted).toEqual(['go ahead'])
  expect(await hasBand($)).toBe(false)
  expect(await adversary($, 'plan')).toBe('Reviewing plan with session model; findings will open in the triage pane.')
  expect(w.spawned[0]!.prompt).toContain(PLAN)
})

test('only a prompt the user sent clears the band', async ($, on) => {
  world(on)
  await exitPlanMode($)

  await $.prompt.submit({ text: '<task-notification>done</task-notification>', wait: false, isMeta: true, origin: { kind: 'task-notification' } })
  await $.prompt.submit({ text: 'tick', wait: false, origin: { kind: 'scheduled-trigger' } })
  await $.prompt.submit({ text: 'injected', wait: false, isMeta: true, origin: { kind: 'composer' } })
  expect(await hasBand($)).toBe(true)

  await $.prompt.submit({ text: 'from my phone', wait: false, origin: { kind: 'bridge' } })
  expect(await hasBand($)).toBe(false)
})

test('no band before any plan', async ($, on) => {
  world(on)

  expect(await hasBand($)).toBe(false)
})

test('a denied ExitPlanMode stores nothing', async ($, on) => {
  world(on, { deny: 'not now' })
  await exitPlanMode($)
  expect(await hasBand($)).toBe(false)
  expect(await adversary($, 'plan')).toBe('No plan this session')
})

test('an errored ExitPlanMode stores nothing', async ($, on) => {
  world(on, { ...planned(PLAN), isError: true })
  await exitPlanMode($)
  expect(await hasBand($)).toBe(false)
  expect(await adversary($, 'plan')).toBe('No plan this session')
})

test("a subagent's ExitPlanMode stores nothing", async ($, on) => {
  world(on)
  await exitPlanMode($, { agentId: 'sub-1' })
  expect(await hasBand($)).toBe(false)
  expect(await adversary($, 'plan')).toBe('No plan this session')
})

test('a null plan stores nothing', async ($, on) => {
  world(on, planned(null))
  await exitPlanMode($)
  expect(await hasBand($)).toBe(false)
  expect(await adversary($, 'plan')).toBe('No plan this session')
})

test('a plan over 200000 characters is refused', async ($, on) => {
  const w = world(on, planned('x'.repeat(200_001)))
  await exitPlanMode($)

  expect(await adversary($, 'plan')).toBe('Plan is 200001 characters; too large for one review (limit 200000)')
  expect(w.spawned).toEqual([])
})

test("ExitPlanMode's result is returned unchanged", async ($, on) => {
  const outcome = planned(PLAN)
  world(on, outcome)

  const result = await exitPlanMode($)

  expect(result).toMatchObject(outcome)
})
