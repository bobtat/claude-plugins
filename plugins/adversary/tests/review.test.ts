import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { AgentInfo, On } from 'claude-code'

import type { Review } from '../types'
import { OUTPUT_CONTRACT } from '../hooks/findings'
import { USAGE } from '../hooks/args'

const ROOT = 'C:/work/repo'
const HOME = 'C:/Users/someone'
const NOW = new Date(2026, 9, 15, 12).getTime()
const AGENT = 'reviewer-1'

const PR = { number: 123, title: 'Fix the lock', body: 'Takes the lock first.', headRefOid: 'abc1234def', baseRefName: 'main', url: 'https://github.com/o/r/pull/123' }
const DIFF = 'diff --git a/src/a.ts b/src/a.ts\n+lock()\n'
const PR_TEXT = `# PR #123: Fix the lock\n\nTakes the lock first.\n\n## Diff\n\n${DIFF}`

// Stands in for <plugin>/templates/pr.md: each placeholder on a line of its own.
const SHIPPED_PR = 'Review the PR at {{root}}.\n\n{{brief}}\n\n{{focus}}\n\n{{artifact}}\n\n{{output_contract}}\n'

type Run = { exitCode: number; stdout: string; stderr?: string }
type Options = {
  files?: Record<string, string>
  runs?: Record<string, Run>
  mcpTools?: string[]
  spawn?: { deny: string }
  env?: Record<string, string>
  writeDenied?: string
}

const ok = (stdout: string): Run => ({ exitCode: 0, stdout })

const PR_RUNS: Record<string, Run> = {
  'gh pr view 123': ok(JSON.stringify(PR)),
  'gh pr diff 123': ok(DIFF),
  'git rev-parse HEAD': ok(`${PR.headRefOid}\n`),
}

const slashes = (path: string) => path.replace(/\\/g, '/')
const shippedPath = (path: string) => /\/templates\/(pr|plan|doc)\.md$/.test(path) && !path.startsWith(ROOT) && !path.startsWith(HOME)

// The engine beneath the plugin: a file system of the given files plus the
// shipped templates under the plugin's folder, gh and git answering by argv
// prefix, and agents that start under AGENT and stay listed while running.
function world(on: On, opts: Options = {}) {
  const files: Record<string, string> = { ...opts.files }
  const written: Record<string, string> = {}
  const spawned: { subagent_type: string; description: string; model?: string; prompt: string }[] = []
  const registered: unknown[] = []
  const reviews: Review[] = []
  const reads: string[] = []
  const logs: string[] = []
  const toolCalls: Record<string, unknown>[] = []
  const agents: AgentInfo[] = []
  const ran: string[] = []

  const read = (path: string) => (shippedPath(path) ? SHIPPED_PR : files[path] ?? written[path])

  mock.clock(on, { now: NOW })
  mock.env(on, opts.env ?? { USERPROFILE: HOME, TEMP: 'C:/tmp' })
  on('session.root', () => ({ value: ROOT }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('agent.register', (_$, e) => {
    registered.push(e)
    return { value: { agent: `adversary:${e.name}` } }
  })
  on('agent.offer', () => ({ isOffered: true }))
  on('agent.list', () => ({ value: agents }))
  // A plugin's spawn reaches this hook as the Agent tool's input (`subagent_type`).
  on('agent.spawn', (_$, e) => {
    const input = e as unknown as { subagent_type: string; description: string; model?: string; prompt: string }
    spawned.push(input)
    if (opts.spawn) return opts.spawn
    agents.push({ id: AGENT, description: input.description, type: input.subagent_type, status: 'running' })
    return { model: input.model ?? 'claude-opus-5-5', agentId: AGENT }
  })
  on('turn.complete', () => ({ text: '' }))
  on('tool.list', () => ({
    value: (opts.mcpTools ?? []).map(name => ({ name, description: '', mcp: true })),
  }))
  on('ui.log', (_$, e) => {
    logs.push(e.text)
    return { value: undefined }
  })
  on('fs.exists', (_$, e) => ({ value: read(slashes(e.path)) !== undefined }))
  on('fs.read', (_$, e) => {
    const path = slashes(e.path)
    reads.push(path)
    const text = read(path)
    return text === undefined ? { deny: `ENOENT: ${path}` } : { value: text }
  })
  on('fs.write', (_$, e) => {
    if (opts.writeDenied !== undefined) return { deny: opts.writeDenied }
    written[slashes(e.path)] = e.text
    return { value: undefined }
  })
  on('fs.stat', (_$, e) => ({ value: { kind: 'file', size: 1, mtimeMs: NOW, isLink: false, realPath: slashes(e.path) } }))
  on('process.run', (_$, e) => {
    const line = e.argv.join(' ')
    ran.push(line)
    const key = Object.keys(opts.runs ?? {}).find(k => line.startsWith(k))
    if (key === undefined) return { deny: `${e.argv[0]}: not found` }
    const { exitCode, stdout, stderr = '' } = opts.runs![key]
    return { value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('state.set', (_$, e, next) => {
    if (e.key === 'review' && e.value) reviews.push(e.value as Review)
    return next(e)
  })
  on('tool.call', (_$, e) => {
    toolCalls.push({ ...e })
    return { result: 'ran' }
  })
  return { written, spawned, registered, reviews, reads, logs, toolCalls, agents, ran }
}

const PRESENTATION = { isFullscreen: false, columns: 120 }

async function adversary($: Engine, args: string) {
  const result = await $.command.run({ command: 'adversary', args, origin: { kind: 'composer' }, presentation: PRESENTATION })
  return 'text' in result ? String(result.text) : ''
}

const start = ($: Engine) => $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })

const complete = (answer: string, reason: 'answer' | 'aborted' | 'error' = 'answer', agentId = AGENT) =>
  ({ answer, durationMs: 10, isAborted: reason === 'aborted', turnId: 't-review', agentId, reason }) as const

const json = (value: unknown) => `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``

test('registers the reviewer hidden from the model with the constrained spec', async ($, on) => {
  const w = world(on)

  await start($)

  expect(w.registered).toHaveLength(1)
  const spec = w.registered[0] as Record<string, unknown>
  expect(spec).toEqual({
    name: 'reviewer',
    description: expect.any(String),
    prompt: expect.any(String),
    tools: ['Read', 'Grep', 'Glob'],
    background: true,
    omitClaudeMd: true,
  })
  expect('memory' in spec).toBe(false)
  expect(await $.agent.offer({ agent: 'adversary:reviewer', description: '', source: 'plugin', provider: { plugin: 'adversary', tier: 'user' } })).toEqual({
    isOffered: false,
  })
  expect(await $.agent.offer({ agent: 'Explore', description: '', source: 'built-in', provider: { plugin: 'engine', tier: 'core' } })).toEqual({
    isOffered: true,
  })
})

test('session start seeds missing user templates and never overwrites one', async ($, on) => {
  const w = world(on, { files: { [`${HOME}/.claude/adversary/plan.md`]: 'my plan' } })

  await start($)

  expect(Object.keys(w.written).sort()).toEqual([`${HOME}/.claude/adversary/doc.md`, `${HOME}/.claude/adversary/pr.md`])
})

test('a failure to seed templates is logged and the session still starts', async ($, on) => {
  const w = world(on, { writeDenied: 'read-only file system' })

  await start($)

  expect(w.registered).toHaveLength(1)
  expect(w.logs.some(line => line.includes('read-only file system'))).toBe(true)
})

test('with no home directory nothing is seeded', async ($, on) => {
  const w = world(on, { env: { TEMP: 'C:/tmp' } })

  await start($)

  expect(w.written).toEqual({})
})

test('a full pr review spawns the reviewer with the filled template and the chosen model', async ($, on) => {
  const w = world(on, { runs: { ...PR_RUNS, 'gh issue view 45': ok(JSON.stringify({ title: 'Locks', body: 'Never deadlock.' })) } })

  const reply = await adversary($, 'pr 123 --brief #45 --focus "lock order" --model sonnet')

  expect(reply).toBe('Reviewing pr 123 with sonnet; findings will open in the triage pane.')
  expect(w.spawned).toHaveLength(1)
  expect(w.spawned[0]).toMatchObject({ subagent_type: 'adversary:reviewer', description: 'adversarial review', model: 'sonnet' })
  expect(w.spawned[0].prompt).toBe(
    `Review the PR at ${ROOT}.\n\n## Brief (#45)\n\n#45: Locks\n\nNever deadlock.\n\n## Focus\n\nlock order\n\n${PR_TEXT}\n\n${OUTPUT_CONTRACT}\n`,
  )
  expect(w.reviews.at(-1)).toEqual({
    kind: 'pr',
    target: '123',
    briefLabel: '#45',
    model: 'sonnet',
    root: ROOT,
    pr: { number: 123, url: PR.url, headRefOid: PR.headRefOid },
    agentId: AGENT,
    status: 'running',
    findings: [],
    unparsed: [],
    raw: '',
    startedAt: NOW,
  })
})

test('the reviewer prompt contains no session transcript', async ($, on) => {
  const w = world(on, { runs: PR_RUNS })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.turn.start({ turnId: 't-main', text: 'SECRET framing: the author thinks this PR is perfect' })
  await $.turn.complete({ answer: 'SECRET answer from the author session', durationMs: 1, isAborted: false, turnId: 't-main', reason: 'answer' })

  const reply = await adversary($, 'pr 123')

  expect(reply).toBe('Reviewing pr 123 with session model; findings will open in the triage pane.')
  const spawn = w.spawned[0]
  expect(spawn.model).toBeUndefined()
  // The prompt is the shipped template, read from the plugin's folder, filled with the PR and nothing else.
  expect(w.reads.filter(shippedPath)).toEqual([w.reads.find(shippedPath)])
  expect(w.reads.find(shippedPath)).toMatch(/\/templates\/pr\.md$/)
  // The brief and focus lines go; the blank lines around them stay.
  expect(spawn.prompt).toBe(`Review the PR at ${ROOT}.\n\n\n\n${PR_TEXT}\n\n${OUTPUT_CONTRACT}\n`)
  expect(spawn.prompt).not.toContain('SECRET')
})

test('each pre-start error replies with its message and leaves review state untouched', async ($, on) => {
  const badTemplate = `${ROOT}/.claude/adversary/doc.md`
  const w = world(on, {
    files: { [`${ROOT}/docs/design.md`]: '# Design', [badTemplate]: 'Review {{artifact}} only' },
    runs: { 'gh pr view 7': { exitCode: 1, stdout: '', stderr: 'To get started with GitHub CLI, please run:  gh auth login' } },
  })

  expect(await adversary($, 'pr 7')).toBe('gh is not available: run gh auth login')
  expect(await adversary($, 'doc docs/design.md --brief PROJ-12')).toBe('Jira not connected; paste the ticket with --brief "..."')
  expect(await adversary($, 'plan')).toBe('No plan this session')
  expect(await adversary($, 'doc docs/missing.md')).toBe('Document not found: docs/missing.md')
  expect(await adversary($, 'doc docs/design.md')).toBe(`Template ${badTemplate} is missing {{output_contract}}`)
  expect(await adversary($, 'pr')).toContain(USAGE)

  expect(w.reviews).toEqual([])
  expect(w.spawned).toEqual([])
})

test('a brief that fails after a temp worktree was made removes the worktree', async ($, on) => {
  const w = world(on, {
    runs: {
      ...PR_RUNS,
      'git rev-parse HEAD': ok('0000000\n'),
      'git fetch origin pull/123/head': ok(''),
      'git worktree': ok(''),
    },
  })

  expect(await adversary($, 'pr 123 --brief PROJ-12')).toBe('Jira not connected; paste the ticket with --brief "..."')
  expect(w.ran.filter(line => line.startsWith('git worktree'))).toEqual([
    'git worktree add --detach C:/tmp/adversary-pr-123-abc1234 FETCH_HEAD',
    'git worktree remove --force C:/tmp/adversary-pr-123-abc1234',
  ])
  expect(w.reviews).toEqual([])
})

test('a second review while one runs replies Review in progress', async ($, on) => {
  const w = world(on, { runs: PR_RUNS })

  await adversary($, 'pr 123')
  expect(await adversary($, 'pr 123')).toBe('Review in progress')
  expect(w.spawned).toHaveLength(1)
})

test('a stale running review does not block', async ($, on) => {
  const w = world(on, { runs: PR_RUNS })
  await adversary($, 'pr 123')

  // After a reload or crash the state still says running but no such agent is listed.
  w.agents.length = 0
  expect(await adversary($, 'pr 123')).toBe('Reviewing pr 123 with session model; findings will open in the triage pane.')

  // An agent that is listed but has ended does not block either.
  w.agents.forEach(agent => (agent.status = 'completed'))
  expect(await adversary($, 'pr 123')).toMatch(/^Reviewing pr 123/)
  expect(w.spawned).toHaveLength(3)
})

test('turn.complete for the reviewer parses findings and marks done', async ($, on) => {
  const w = world(on, { runs: PR_RUNS })
  await adversary($, 'pr 123')
  const answer = `Checked the lock.\n${json({
    findings: [
      { severity: 'low', location: { file: `${ROOT}/src/b.ts` }, claim: 'Unused import.', evidence: 'import x' },
      { severity: 'critical', location: { file: 'src/a.ts', line: 3 }, claim: 'Deadlock.', evidence: 'lock() twice' },
    ],
  })}`

  await $.turn.complete(complete(answer))

  const done = w.reviews.at(-1)!
  expect(done.status).toBe('done')
  expect(done.raw).toBe(answer)
  expect(done.unparsed).toEqual([])
  expect(done.findings.map(f => [f.severity, f.location])).toEqual([
    ['critical', { file: 'src/a.ts', line: 3 }],
    ['low', { file: 'src/b.ts' }],
  ])
  expect(await adversary($, 'pr 123')).toMatch(/^Reviewing pr 123/)
})

test("another agent's turn.complete leaves the review running", async ($, on) => {
  const w = world(on, { runs: PR_RUNS })
  await adversary($, 'pr 123')
  const writes = w.reviews.length

  await $.turn.complete(complete(json({ findings: [] }), 'answer', 'someone-else'))
  await $.turn.complete({ answer: json({ findings: [] }), durationMs: 1, isAborted: false, turnId: 't-main', reason: 'answer' })

  expect(w.reviews.length).toBe(writes)
})

test('turn.complete with no json block marks failed and keeps raw output', async ($, on) => {
  const w = world(on, { runs: PR_RUNS })
  await adversary($, 'pr 123')

  await $.turn.complete(complete('I looked and it seems fine.'))

  expect(w.reviews.at(-1)).toMatchObject({ status: 'failed', error: 'The reviewer gave no json block', raw: 'I looked and it seems fine.' })
})

test('an interrupted or errored reviewer turn marks failed', async ($, on) => {
  const w = world(on, { runs: PR_RUNS })
  await adversary($, 'pr 123')
  await $.turn.complete(complete('partial', 'aborted'))
  expect(w.reviews.at(-1)).toMatchObject({ status: 'failed', error: 'The reviewer was interrupted', raw: 'partial' })

  w.agents.length = 0
  await adversary($, 'pr 123')
  await $.turn.complete(complete('', 'error'))
  expect(w.reviews.at(-1)).toMatchObject({ status: 'failed', error: 'The reviewer stopped on an API error' })
})

test('a denied spawn marks failed', async ($, on) => {
  const w = world(on, { runs: PR_RUNS, spawn: { deny: 'background agents are disabled' } })

  const reply = await adversary($, 'pr 123')

  expect(reply).toBe('The reviewer could not start: background agents are disabled')
  expect(w.reviews.at(-1)).toMatchObject({ status: 'failed', error: 'background agents are disabled', raw: '' })
  expect(w.reviews.at(-1)!.agentId).toBeUndefined()
})

test('triage replies No review yet', async ($, on) => {
  world(on)

  expect(await adversary($, 'triage')).toBe('No review yet')
})

const call = ($: Engine, input: Record<string, unknown>) => $.tool.call(input as never)

test('guard denies a reviewer Read outside the root and allows one inside', async ($, on) => {
  const w = world(on, { runs: PR_RUNS })
  await adversary($, 'pr 123')

  const outside = await call($, { tool: 'Read', file_path: 'C:/Users/someone/.claude/CLAUDE.md', agentId: AGENT })
  const inside = await call($, { tool: 'Read', file_path: `${ROOT}/src/a.ts`, agentId: AGENT })

  expect(JSON.stringify(outside)).toContain('outside the review root')
  expect(w.toolCalls.map(c => c.file_path)).toEqual([`${ROOT}/src/a.ts`])
  expect(JSON.stringify(inside)).not.toContain('outside the review root')
})

test("guard leaves the main thread's Read alone", async ($, on) => {
  const w = world(on, { runs: PR_RUNS })
  await adversary($, 'pr 123')

  await call($, { tool: 'Read', file_path: 'C:/Users/someone/notes.md' })

  expect(w.toolCalls.map(c => c.file_path)).toEqual(['C:/Users/someone/notes.md'])
})

test('guard scopes a pathless Grep to the root', async ($, on) => {
  const w = world(on, { runs: PR_RUNS })
  await adversary($, 'pr 123')

  await call($, { tool: 'Grep', pattern: 'lock', agentId: AGENT })

  expect(w.toolCalls).toHaveLength(1)
  expect(w.toolCalls[0]).toMatchObject({ tool: 'Grep', pattern: 'lock', path: ROOT })
})

test('guard denies a reviewer Glob whose absolute pattern leaves the root', async ($, on) => {
  const w = world(on, { runs: PR_RUNS })
  await adversary($, 'pr 123')

  const result = await call($, { tool: 'Glob', pattern: 'C:/Users/someone/.claude/**/*.md', agentId: AGENT })

  expect(JSON.stringify(result)).toContain('outside the review root')
  expect(w.toolCalls).toEqual([])
})
