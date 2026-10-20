import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { AgentInfo, On } from 'claude-code'

import type { Finding, Review } from '../types'
import { draftText, savedMarkdown } from '../hooks/findings'
import { diffLines, saveName, saveReview } from '../hooks/triage'
import { fakeHost } from './support'

const ROOT = 'C:/work/repo'
const NOW = new Date(2026, 9, 15, 12).getTime()
const DATE = '2026-10-15'
const AGENT = 'reviewer-1'
const WORKTREE = 'C:/tmp/adversary-pr-123-abc1234'
const NOTHING = 'Nothing to send — mark findings with s first'
const API = 'gh api repos/{owner}/{repo}/pulls/123/reviews -X POST --input -'
const HEAD = 'gh pr view 123 --json headRefOid'
const SAME_HEAD = { [HEAD]: { exitCode: 0, stdout: '{"headRefOid":"abc1234def"}\n' } }

const finding = (id: number, over: Partial<Finding>): Finding => ({
  id,
  severity: 'medium',
  location: { file: 'src/x.ts' },
  claim: `Claim ${id}.`,
  evidence: `Evidence ${id}.`,
  decision: 'undecided',
  ...over,
})

// Stored as finishReview stores them: already sorted by severity.
const FINDINGS: Finding[] = [
  finding(2, { severity: 'critical', location: { file: 'src/Cache.cs', line: 88 }, claim: 'Eviction races with refresh.', evidence: 'Refresh() reads _map before _lock.' }),
  finding(1, { severity: 'high', location: { file: 'src/Orders/Repo.cs', line: 140 }, claim: 'Repo leaks a connection.', evidence: 'No using around Open().' }),
  finding(4, { severity: 'medium', location: { section: 'Rollout' }, claim: 'Rollout has no rollback.', evidence: 'Step 3 is one-way.' }),
  finding(3, { severity: 'low', location: { file: 'README.md' }, claim: 'README is stale.', evidence: 'Mentions v1.' }),
]

const PR_REVIEW: Review = {
  kind: 'pr',
  target: '123',
  briefLabel: 'PROJ-456',
  model: 'opus',
  root: ROOT,
  pr: { number: 123, url: 'https://github.com/o/r/pull/123', headRefOid: 'abc1234def' },
  agentId: AGENT,
  status: 'done',
  findings: FINDINGS,
  unparsed: [],
  raw: 'answer',
  startedAt: NOW,
  hasOutwardLinks: false,
}

// New-side lines 85-89 of src/Cache.cs and 10-11 of src/Orders/Repo.cs are in the diff.
const DIFF = [
  'diff --git a/src/Cache.cs b/src/Cache.cs',
  'index 1111111..2222222 100644',
  '--- a/src/Cache.cs',
  '+++ b/src/Cache.cs',
  '@@ -85,4 +85,5 @@ class Cache',
  ' var a = 1;',
  ' var b = 2;',
  '-var old = 3;',
  '+var c = 3;',
  '+var d = 4;',
  ' var e = 5;',
  'diff --git a/src/Orders/Repo.cs b/src/Orders/Repo.cs',
  '--- a/src/Orders/Repo.cs',
  '+++ b/src/Orders/Repo.cs',
  '@@ -10,2 +10,2 @@',
  ' open();',
  '-close();',
  '+dispose();',
  '',
].join('\n')

type Run = { exitCode: number; stdout: string; stderr?: string }
type Options = { runs?: Record<string, Run>; isPlaced?: boolean; files?: string[] }

const ok = (stdout: string): Run => ({ exitCode: 0, stdout })

const PR = { number: 123, title: 'Fix the lock', body: 'Takes the lock first.', headRefOid: 'abc1234def', baseRefName: 'main', url: 'https://github.com/o/r/pull/123' }
const PR_RUNS: Record<string, Run> = {
  'gh pr view 123': ok(JSON.stringify(PR)),
  'gh repo view --json nameWithOwner,url': ok(JSON.stringify({ nameWithOwner: 'o/r', url: 'https://github.com/o/r' })),
  'gh pr diff 123': ok(DIFF),
  'git rev-parse HEAD': ok(`${PR.headRefOid}\n`),
  'git status --porcelain': ok(''),
}

const slashes = (path: string) => path.replace(/\\/g, '/')

// The engine beneath the plugin, recording what reaches it: panes opened,
// toasts, prompt fills, processes run (with their stdin), files written and
// every review state written.
function world(on: On, opts: Options = {}) {
  const opened: { id: string; title?: string; focus?: boolean }[] = []
  const toasts: string[] = []
  const fills: { text: string; mode: string }[] = []
  const ran: { line: string; stdin?: string; cwd?: string }[] = []
  const written: Record<string, string> = {}
  const reviews: Review[] = []
  const agents: AgentInfo[] = []
  const existing = new Set(opts.files ?? [])

  mock.clock(on, { now: NOW })
  mock.env(on, { USERPROFILE: 'C:/Users/someone', TEMP: 'C:/tmp' })
  on('session.root', () => ({ value: ROOT }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('agent.register', (_$, e) => ({ value: { agent: `adversary:${e.name}` } }))
  on('agent.list', () => ({ value: agents }))
  on('agent.spawn', (_$, e) => {
    const input = e as unknown as { subagent_type: string; description: string }
    agents.push({ id: AGENT, description: input.description, type: input.subagent_type, status: 'running' })
    return { model: 'claude-opus-5-5', agentId: AGENT }
  })
  on('turn.complete', () => ({ text: '' }))
  on('tool.list', () => ({ value: [] }))
  on('ui.open', (_$, e) => {
    opened.push({ id: e.id, title: e.title, focus: e.focus })
    return { value: opts.isPlaced === false ? ({ isPlaced: false, reason: 'narrow' } as never) : { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('prompt.fill', (_$, e) => {
    fills.push({ text: e.text, mode: e.mode })
    return { isFilled: true }
  })
  // Of the templates, only the shipped ones are there.
  const shipped = (path: string) => /\/templates\/(pr|plan|doc)\.md$/.test(path) && !path.startsWith(ROOT)
  on('fs.exists', (_$, e) => ({ value: shipped(slashes(e.path)) || existing.has(slashes(e.path)) || slashes(e.path) in written }))
  on('fs.read', (_$, e) => (shipped(slashes(e.path)) ? { value: '{{artifact}}\n\n{{output_contract}}\n' } : { deny: `ENOENT: ${e.path}` }))
  on('fs.write', (_$, e) => {
    written[slashes(e.path)] = e.text
    return { value: undefined }
  })
  on('fs.stat', (_$, e) => ({ value: { kind: 'file', size: 1, mtimeMs: NOW, isLink: false, realPath: slashes(e.path) } }))
  on('fs.list', () => ({ value: [] }))
  on('process.run', (_$, e) => {
    const line = e.argv.join(' ')
    ran.push({ line, stdin: e.init?.stdin, cwd: e.init?.cwd })
    const key = Object.keys(opts.runs ?? {}).find(k => line.startsWith(k))
    if (key === undefined) return { deny: `${e.argv[0]}: not found` }
    const { exitCode, stdout, stderr = '' } = opts.runs![key]
    return { value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  // The kit keeps the session's state, so a write redraws the pane as in a
  // session. A seeded review stands in for a review not yet written there.
  const seeded: { review?: Review } = {}
  on('state.get', async (_$, e, next) => {
    const held = (await next(e)) as unknown as { value: { value: unknown; version: number } }
    if (e.key !== 'review' || held.value.value != null || seeded.review === undefined) return held as never
    return { value: { value: seeded.review, version: held.value.version } } as never
  })
  on('state.set', (_$, e, next) => {
    if (e.key === 'review' && e.value) reviews.push(e.value as Review)
    return next(e)
  })
  return { opened, toasts, fills, ran, written, reviews, agents, seeded }
}

type World = ReturnType<typeof world>

const seed = (w: World, review: Review) => {
  w.seeded.review = review
}

const PANE_PROPS = {
  title: 'Adversary',
  isFocused: true,
  bodyColumns: 100,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
} as const

const mount = ($: Engine) =>
  $.ui.mount({ plugin: 'adversary', surface: 'terminal', component: 'Pane', requestId: 'adversary', props: PANE_PROPS })

type Pane = Awaited<ReturnType<typeof mount>>

const texts = async (pane: Pane) => (await pane.findAll({ type: 'Text' })).map(el => el.text)
const has = async (pane: Pane, text: string | RegExp) => (await pane.find({ type: 'Text', text })) !== undefined
const latest = (w: ReturnType<typeof world>) => w.reviews.at(-1)!

async function adversary($: Engine, args: string) {
  const result = await $.command.run({ command: 'adversary', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  return 'text' in result ? String(result.text) : ''
}

const json = (value: unknown) => `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``

const complete = (answer: string) =>
  ({ answer, durationMs: 10, isAborted: false, turnId: 't-review', agentId: AGENT, reason: 'answer' }) as const

test('renders title, summary and findings sorted by severity with the selected one expanded', async ($, on) => {
  const w = world(on)
  seed(w, PR_REVIEW)

  const pane = await mount($)

  expect(await has(pane, 'Adversary · PR #123 · PROJ-456 · opus')).toBe(true)
  expect(await has(pane, '4 findings · 0 send · 0 drop · 4 undecided')).toBe(true)
  const rows = (await texts(pane)).filter(text => /\b(CRIT|HIGH|MED|LOW)\b/.test(text ?? ''))
  expect(rows.map(row => row!.match(/\b(CRIT|HIGH|MED|LOW)\b/)![1])).toEqual(['CRIT', 'HIGH', 'MED', 'LOW'])
  expect(rows[0]).toContain('src/Cache.cs:88')
  expect(await has(pane, 'Eviction races with refresh.')).toBe(true)
  expect(await has(pane, 'Evidence: Refresh() reads _map before _lock.')).toBe(true)
  expect(await has(pane, 'No using around Open().')).toBe(false)
})

test('s, d, j, k change decision and selection', async ($, on) => {
  const w = world(on)
  seed(w, PR_REVIEW)
  const pane = await mount($)

  await pane.press({ key: 'send' })
  await pane.press({ key: 'down' })
  await pane.press({ key: 'drop' })
  await pane.press({ key: 'down' })
  await pane.press({ key: 'up' })

  expect(latest(w).findings.map(f => f.decision)).toEqual(['send', 'drop', 'undecided', 'undecided'])
  expect(await has(pane, '4 findings · 1 send · 1 drop · 2 undecided')).toBe(true)
  expect(await has(pane, 'Evidence: No using around Open().')).toBe(true)
})

test('move clamps at both ends', async ($, on) => {
  const w = world(on)
  seed(w, PR_REVIEW)
  const pane = await mount($)

  await pane.press({ key: 'up' })
  expect(await has(pane, 'Evidence: Refresh() reads _map before _lock.')).toBe(true)

  for (let i = 0; i < 6; i++) await pane.press({ key: 'down' })
  expect(await has(pane, 'Evidence: Mentions v1.')).toBe(true)
  await pane.press({ key: 'send' })
  await pane.press({ key: 'up' })
  expect(await has(pane, 'Evidence: Step 3 is one-way.')).toBe(true)
})

test('edit replaces the claim and keeps the original', async ($, on) => {
  const w = world(on)
  seed(w, PR_REVIEW)
  const pane = await mount($)

  await pane.press({ key: 'edit' })
  const field = await pane.find({ type: 'Input', key: 'claim' })
  expect(field?.props.value).toBe('Eviction races with refresh.')

  await pane.input({ key: 'claim', text: 'Refresh re-inserts a stale entry.' })

  expect(latest(w).findings[0]).toMatchObject({ claim: 'Eviction races with refresh.', editedClaim: 'Refresh re-inserts a stale entry.' })
  expect(await pane.find({ type: 'Input', key: 'claim' })).toBeUndefined()
  expect(await has(pane, 'Refresh re-inserts a stale entry.')).toBe(true)
})

test('Draft fills the prompt with only send findings', async ($, on) => {
  const w = world(on)
  seed(w, { ...PR_REVIEW, findings: [{ ...FINDINGS[0], decision: 'send', editedClaim: 'Edited.' }, { ...FINDINGS[1], decision: 'drop' }, { ...FINDINGS[2], decision: 'send' }, FINDINGS[3]] })
  const pane = await mount($)

  await pane.press({ key: 'draft' })

  const expected = draftText([
    { ...FINDINGS[0], decision: 'send', editedClaim: 'Edited.' },
    { ...FINDINGS[2], decision: 'send' },
  ])
  expect(w.fills).toEqual([{ text: expected, mode: 'replace' }])
  expect(expected).toContain('Edited.')
  expect(expected).not.toContain('Repo leaks a connection.')
})

test('Draft and Post with no send findings do nothing and say so', async ($, on) => {
  const w = world(on, { runs: { 'gh pr diff 123': ok(DIFF), 'gh api': ok('{}') } })
  seed(w, { ...PR_REVIEW, findings: [{ ...FINDINGS[0], decision: 'drop' }, FINDINGS[1]] })
  const pane = await mount($)

  await pane.press({ key: 'draft' })
  await pane.press({ key: 'post' })

  expect(w.fills).toEqual([])
  expect(w.ran).toEqual([])
  expect(w.toasts).toEqual([NOTHING, NOTHING])
})

test('Post is absent for plan and doc reviews', async ($, on) => {
  const w = world(on)
  const { pr: _pr, ...rest } = PR_REVIEW
  for (const review of [{ ...rest, kind: 'plan', target: '' }, { ...rest, kind: 'doc', target: 'docs/design.md' }] as Review[]) {
    seed(w, review)
    const pane = await mount($)
    expect(await pane.find({ type: 'Button', key: 'post' })).toBeUndefined()
    expect(await pane.find({ type: 'Button', key: 'draft' })).toBeDefined()
    await pane.unmount()
  }
})

test('Post sends one review with inline comments and lineless findings in the body', async ($, on) => {
  const html = 'https://github.com/o/r/pull/123#pullrequestreview-9'
  const w = world(on, { runs: { ...SAME_HEAD, 'gh pr diff 123': ok(DIFF), [API]: ok(JSON.stringify({ id: 9, html_url: html })) } })
  seed(w, {
    ...PR_REVIEW,
    findings: [
      { ...FINDINGS[0], location: { file: `${ROOT}/src/Cache.cs`, line: 88 }, decision: 'send', editedClaim: 'Refresh re-inserts a stale entry.' },
      { ...FINDINGS[1], decision: 'send' },
      { ...FINDINGS[2], decision: 'send' },
      { ...FINDINGS[3], decision: 'drop' },
    ],
  })
  const pane = await mount($)

  await pane.press({ key: 'post' })

  const posts = w.ran.filter(r => r.line === API)
  expect(posts).toHaveLength(1)
  expect(posts[0].cwd).toBe(ROOT)
  expect(JSON.parse(posts[0].stdin!)).toEqual({
    event: 'COMMENT',
    commit_id: 'abc1234def',
    body: [
      'An independent reviewer raised these findings.',
      '',
      '1. [HIGH] src/Orders/Repo.cs:140 — Repo leaks a connection.',
      '   Evidence: No using around Open().',
      '2. [MEDIUM] § Rollout — Rollout has no rollback.',
      '   Evidence: Step 3 is one-way.',
    ].join('\n'),
    comments: [
      { path: 'src/Cache.cs', line: 88, side: 'RIGHT', body: 'Refresh re-inserts a stale entry.\n\nEvidence: Refresh() reads _map before _lock.' },
    ],
  })
  expect(w.toasts).toEqual([`Review posted: ${html}`])
})

test('Post puts a finding on a line outside the diff in the body', async ($, on) => {
  const w = world(on, { runs: { ...SAME_HEAD, 'gh pr diff 123': ok(DIFF), [API]: ok('{"html_url":"u"}') } })
  seed(w, { ...PR_REVIEW, findings: [{ ...FINDINGS[0], location: { file: 'src/Cache.cs', line: 200 }, decision: 'send' }] })
  const pane = await mount($)

  await pane.press({ key: 'post' })

  const payload = JSON.parse(w.ran.find(r => r.line === API)!.stdin!)
  expect(payload.comments).toEqual([])
  expect(payload.body).toContain('1. [CRITICAL] src/Cache.cs:200 — Eviction races with refresh.')
})

test('Post reports gh failure without throwing', async ($, on) => {
  const w = world(on, { runs: { ...SAME_HEAD, 'gh pr diff 123': ok(DIFF), [API]: { exitCode: 1, stdout: '', stderr: 'HTTP 422: Unprocessable Entity\nline is outside the diff' } } })
  seed(w, { ...PR_REVIEW, findings: [{ ...FINDINGS[0], decision: 'send' }] })
  const pane = await mount($)

  await pane.press({ key: 'post' })

  expect(w.toasts).toEqual(['Post failed: HTTP 422: Unprocessable Entity'])
})

test('Post reports a failed diff fetch without posting', async ($, on) => {
  const w = world(on, { runs: { ...SAME_HEAD, 'gh pr diff 123': { exitCode: 1, stdout: '', stderr: 'could not find pull request' } } })
  seed(w, { ...PR_REVIEW, findings: [{ ...FINDINGS[0], decision: 'send' }] })
  const pane = await mount($)

  await pane.press({ key: 'post' })

  expect(w.toasts).toEqual(['Post failed: could not find pull request'])
  expect(w.ran.map(r => r.line)).toEqual([HEAD, 'gh pr diff 123'])
})

const STALE_FINDINGS: Finding[] = [
  { ...FINDINGS[0], decision: 'send', editedClaim: 'Refresh re-inserts a stale entry.' },
  { ...FINDINGS[1], decision: 'send' },
  { ...FINDINGS[3], decision: 'drop' },
]

// Every send finding in the body, no commit to anchor to and no inline comment.
const STALE_PAYLOAD = {
  event: 'COMMENT',
  body: [
    'The PR has new commits since this review (reviewed abc1234).',
    '',
    '1. [CRITICAL] src/Cache.cs:88 — Refresh re-inserts a stale entry.',
    '   Evidence: Refresh() reads _map before _lock.',
    '2. [HIGH] src/Orders/Repo.cs:140 — Repo leaks a connection.',
    '   Evidence: No using around Open().',
  ].join('\n'),
}

test('Post after the PR head moved puts every send finding in the body against no commit', async ($, on) => {
  const w = world(on, { runs: { [HEAD]: ok('{"headRefOid":"fff9999000"}'), 'gh pr diff 123': ok(DIFF), [API]: ok('{"html_url":"u"}') } })
  seed(w, { ...PR_REVIEW, findings: STALE_FINDINGS })
  const pane = await mount($)

  await pane.press({ key: 'post' })

  expect(w.ran.map(r => r.line)).toEqual([HEAD, API])
  expect(JSON.parse(w.ran.find(r => r.line === API)!.stdin!)).toEqual(STALE_PAYLOAD)
  expect(w.toasts).toEqual(['Review posted: u'])
})

for (const [name, head] of [
  ['fails', { exitCode: 1, stdout: '', stderr: 'HTTP 502' }],
  ['answers no head', ok('not json')],
] as const) {
  test(`Post when the head check ${name} puts every send finding in the body against no commit`, async ($, on) => {
    const w = world(on, { runs: { [HEAD]: head, 'gh pr diff 123': ok(DIFF), [API]: ok('{"html_url":"u"}') } })
    seed(w, { ...PR_REVIEW, findings: STALE_FINDINGS })
    const pane = await mount($)

    await pane.press({ key: 'post' })

    expect(w.ran.map(r => r.line)).toEqual([HEAD, API])
    expect(JSON.parse(w.ran.find(r => r.line === API)!.stdin!)).toEqual(STALE_PAYLOAD)
  })
}

test('Post with an empty stderr reports the exit code', async ($, on) => {
  const w = world(on, { runs: { ...SAME_HEAD, 'gh pr diff 123': ok(DIFF), [API]: { exitCode: 4, stdout: '' } } })
  seed(w, { ...PR_REVIEW, findings: [{ ...FINDINGS[0], decision: 'send' }] })
  const pane = await mount($)

  await pane.press({ key: 'post' })

  expect(w.toasts).toEqual(['Post failed: exit 4'])
})

test('Save writes the markdown to .claude/adversary/reviews/2026-10-15-pr-123.md', async ($, on) => {
  const w = world(on)
  seed(w, PR_REVIEW)
  const pane = await mount($)

  await pane.press({ key: 'save' })

  const path = `${ROOT}/.claude/adversary/reviews/2026-10-15-pr-123.md`
  expect(w.written).toEqual({ [path]: savedMarkdown(PR_REVIEW, DATE) })
  expect(w.toasts).toEqual(['Saved .claude/adversary/reviews/2026-10-15-pr-123.md'])
})

test('Save never overwrites', async () => {
  const dir = `${ROOT}/.claude/adversary/reviews`
  const taken = new Set([`${dir}/2026-10-15-pr-123.md`, `${dir}/2026-10-15-pr-123-2.md`])
  const written: Record<string, string> = {}
  const host = fakeHost({
    exists: async path => taken.has(path),
    writeFile: async (path, text) => {
      written[path] = text
    },
  })

  const path = await saveReview(host, PR_REVIEW, ROOT, DATE)

  expect(path).toBe('.claude/adversary/reviews/2026-10-15-pr-123-3.md')
  expect(Object.keys(written)).toEqual([`${dir}/2026-10-15-pr-123-3.md`])
})

test('save file names for plan and doc reviews', () => {
  expect(saveName({ ...PR_REVIEW, kind: 'plan', target: '' }, DATE)).toBe('2026-10-15-plan')
  expect(saveName({ ...PR_REVIEW, kind: 'doc', target: 'docs/My Design_v2.md' }, DATE)).toBe('2026-10-15-doc-my-design-v2')
  expect(saveName({ ...PR_REVIEW, kind: 'doc', target: 'docs\\specs\\API.Spec.MD' }, DATE)).toBe('2026-10-15-doc-api-spec')
  expect(saveName(PR_REVIEW, DATE)).toBe('2026-10-15-pr-123')
})

test('a failed review renders the error and raw output', async ($, on) => {
  const w = world(on)
  seed(w, { ...PR_REVIEW, status: 'failed', error: 'The reviewer gave no json block', raw: 'I looked and it seems fine.', findings: [] })

  const pane = await mount($)

  expect(await has(pane, 'Review failed: The reviewer gave no json block')).toBe(true)
  expect(await has(pane, 'I looked and it seems fine.')).toBe(true)
  expect((await pane.findAll({ type: 'Button' })).map(button => button.key)).toEqual(['close'])
})

test('unparsed items render below the findings under an Unparsed heading with their raw text', async ($, on) => {
  const w = world(on)
  seed(w, { ...PR_REVIEW, unparsed: [{ raw: '{"severity":"urgent"}', reason: 'severity must be one of critical, high, medium, low' }] })

  const pane = await mount($)

  const all = await texts(pane)
  const heading = all.indexOf('Unparsed')
  expect(heading).toBeGreaterThan(all.findIndex(text => text?.includes('README.md')))
  expect(all.slice(heading).some(text => text?.includes('{"severity":"urgent"}'))).toBe(true)
})

test('zero findings renders No findings.', async ($, on) => {
  const w = world(on)
  seed(w, { ...PR_REVIEW, findings: [] })

  const pane = await mount($)

  expect(await has(pane, 'No findings.')).toBe(true)
})

test('review ready opens the pane', async ($, on) => {
  const answer = json({ findings: [{ severity: 'high', location: { file: 'src/a.ts', line: 3 }, claim: 'Deadlock.', evidence: 'lock() twice' }] })
  const w = world(on, { runs: PR_RUNS })
  await adversary($, 'pr 123 --model opus')

  await $.turn.complete(complete(answer))

  expect(w.opened).toEqual([{ id: 'adversary', title: 'Adversary · PR #123 · opus', focus: undefined }])
  expect(w.toasts).toEqual([])
})

test('review ready toasts when the pane is not placed', async ($, on) => {
  const answer = json({ findings: [{ severity: 'high', location: { file: 'src/a.ts', line: 3 }, claim: 'Deadlock.', evidence: 'lock() twice' }] })
  const w = world(on, { runs: PR_RUNS, isPlaced: false })
  await adversary($, 'pr 123')

  await $.turn.complete(complete(answer))

  expect(w.opened).toHaveLength(1)
  expect(w.toasts).toEqual(['Review done: 1 findings — /adversary triage'])
})

test('/adversary triage with no review replies No review yet', async ($, on) => {
  const w = world(on)

  expect(await adversary($, 'triage')).toBe('No review yet')
  expect(w.opened).toEqual([])
})

test('/adversary triage opens the pane for the last review', async ($, on) => {
  const w = world(on, { isPlaced: false })
  seed(w, PR_REVIEW)

  await adversary($, 'triage')

  expect(w.opened).toEqual([{ id: 'adversary', title: 'Adversary · PR #123 · PROJ-456 · opus', focus: true }])
  expect(w.toasts).toEqual([])
})

test('closing the pane removes the temp worktree', async ($, on) => {
  const w = world(on, { runs: { 'git worktree remove': ok('') } })
  seed(w, { ...PR_REVIEW, worktree: WORKTREE })
  const pane = await mount($)

  await pane.press({ key: 'close' })

  expect(w.ran.map(r => r.line)).toEqual([`git worktree remove --force ${WORKTREE}`])
  expect('worktree' in latest(w)).toBe(false)
  expect(w.toasts).toEqual([])
})

test('a worktree git could not remove and that is still there stays in state and is reported', async ($, on) => {
  const w = world(on, {
    runs: { 'git worktree remove': { exitCode: 128, stdout: '', stderr: 'fatal: cannot remove: Permission denied\nmore' } },
    files: [WORKTREE],
  })
  seed(w, { ...PR_REVIEW, worktree: WORKTREE })
  const pane = await mount($)

  await pane.press({ key: 'close' })

  expect(w.ran.map(r => r.line)).toEqual([`git worktree remove --force ${WORKTREE}`])
  expect(w.reviews).toEqual([])
  expect(w.toasts).toEqual([`Could not remove the review worktree ${WORKTREE}: fatal: cannot remove: Permission denied`])
})

test('a worktree git could not remove because it is already gone is pruned and cleared', async ($, on) => {
  const w = world(on, { runs: { 'git worktree remove': { exitCode: 128, stdout: '', stderr: 'fatal: not a working tree' }, 'git worktree prune': ok('') } })
  seed(w, { ...PR_REVIEW, worktree: WORKTREE })
  const pane = await mount($)

  await pane.press({ key: 'close' })

  expect(w.ran.map(r => [r.line, r.cwd])).toEqual([
    [`git worktree remove --force ${WORKTREE}`, ROOT],
    ['git worktree prune', ROOT],
  ])
  expect('worktree' in latest(w)).toBe(false)
  expect(w.toasts).toEqual([])
})

const liveReviewer = (): AgentInfo => ({ id: AGENT, description: 'adversarial review', type: 'adversary:reviewer', status: 'running' })

test('closing the pane while the review runs keeps the worktree', async ($, on) => {
  const w = world(on)
  w.agents.push(liveReviewer())
  seed(w, { ...PR_REVIEW, status: 'running', worktree: WORKTREE })
  const pane = await mount($)

  expect(await has(pane, 'Review running…')).toBe(true)
  await pane.press({ key: 'close' })

  expect(w.ran).toEqual([])
})

test('a running review whose reviewer is gone shows as failed without writing state', async ($, on) => {
  const w = world(on)
  // After a reload no agent is listed; after a crash it is listed as ended.
  for (const agents of [[], [{ ...liveReviewer(), status: 'failed' as const }]]) {
    w.agents.splice(0, w.agents.length, ...agents)
    seed(w, { ...PR_REVIEW, status: 'running', findings: [], raw: '', worktree: WORKTREE })

    const pane = await mount($)

    expect(await has(pane, 'Review failed: The reviewer is gone')).toBe(true)
    expect(await has(pane, 'Review running…')).toBe(false)
    await pane.unmount()
  }
  expect(w.reviews).toEqual([])
})

test('closing the pane on a review whose reviewer is gone removes the worktree', async ($, on) => {
  const w = world(on, { runs: { 'git worktree remove': ok('') } })
  seed(w, { ...PR_REVIEW, status: 'running', worktree: WORKTREE })
  const pane = await mount($)

  await pane.press({ key: 'close' })

  expect(w.ran.map(r => r.line)).toEqual([`git worktree remove --force ${WORKTREE}`])
  expect('worktree' in latest(w)).toBe(false)
})

test('session end removes the temp worktree', async ($, on) => {
  const w = world(on, { runs: { 'git worktree remove': ok('') } })
  seed(w, { ...PR_REVIEW, worktree: WORKTREE })

  await $.session.end({ reason: 'other', sessionId: 's1', resume: { id: 's1' } } as never)

  expect(w.ran.map(r => r.line)).toEqual([`git worktree remove --force ${WORKTREE}`])
  expect('worktree' in latest(w)).toBe(false)
})

test('diffLines reads new-side lines across hunks', () => {
  const diff = [
    'diff --git a/a.ts b/a.ts',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -1,3 +1,3 @@',
    ' one',
    '-two',
    '+TWO',
    ' three',
    '@@ -20,2 +20,3 @@ fn()',
    ' twenty',
    '+added',
    ' twenty-two',
    '\\ No newline at end of file',
  ].join('\n')

  expect([...diffLines(diff).get('a.ts')!].sort((a, b) => a - b)).toEqual([1, 2, 3, 20, 21, 22])
})

test('diffLines keys a renamed file by its new path', () => {
  const diff = [
    'diff --git a/src/old.ts b/src/new.ts',
    'similarity index 90%',
    'rename from src/old.ts',
    'rename to src/new.ts',
    '--- a/src/old.ts',
    '+++ b/src/new.ts',
    '@@ -3,2 +3,3 @@',
    ' keep',
    '+added',
    ' keep',
  ].join('\n')

  const lines = diffLines(diff)
  expect([...lines.keys()]).toEqual(['src/new.ts'])
  expect([...lines.get('src/new.ts')!]).toEqual([3, 4, 5])
})

test('diffLines handles a new file, a deleted file and CRLF', () => {
  const diff = [
    'diff --git a/new.ts b/new.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/new.ts',
    '@@ -0,0 +1,2 @@',
    '+first',
    '+--- not a header',
    'diff --git a/gone.ts b/gone.ts',
    'deleted file mode 100644',
    '--- a/gone.ts',
    '+++ /dev/null',
    '@@ -1,2 +0,0 @@',
    '-a',
    '-b',
    'diff --git a/win.ts b/win.ts',
    '--- a/win.ts',
    '+++ b/win.ts',
    '@@ -5 +5 @@',
    '-old',
    '+new',
  ].join('\r\n')

  const lines = diffLines(diff)
  expect([...lines.get('new.ts')!]).toEqual([1, 2])
  expect(lines.has('gone.ts')).toBe(false)
  expect(lines.has('/dev/null')).toBe(false)
  expect([...lines.get('win.ts')!]).toEqual([5])
})
