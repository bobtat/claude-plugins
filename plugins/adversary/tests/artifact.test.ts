import { expect, test } from 'claude-code/testing'

import { MAX_ARTIFACT_CHARS, docArtifact, planArtifact, prArtifact, removeWorktree } from '../hooks/artifact'
import { fakeHost, gh } from './support'

const OID = 'abcdef0123456789'
const VIEW = JSON.stringify({ number: 45, title: 'Fix refunds', body: 'Why', headRefOid: OID, baseRefName: 'main', url: 'https://github.com/o/r/pull/45' })

function recording(responses: Parameters<typeof gh>[0]) {
  const calls: { argv: string[]; cwd?: string }[] = []
  const inner = gh(responses)
  const host = fakeHost({
    run: async (argv, opts) => {
      calls.push({ argv, cwd: opts?.cwd })
      return inner.run(argv)
    },
  })
  return { host, lines: () => calls.map(c => c.argv.join(' ')), calls }
}

const repo = (nameWithOwner: string, url: string) => ({ exitCode: 0, stdout: JSON.stringify({ nameWithOwner, url }) })
const viewOf = (url: string) => ({ exitCode: 0, stdout: JSON.stringify({ ...JSON.parse(VIEW), url }) })

const prResponses = (head: string, diff = 'the diff') => ({
  'gh pr view': { exitCode: 0, stdout: VIEW },
  'gh repo view --json nameWithOwner,url': repo('o/r', 'https://github.com/o/r'),
  'gh pr diff': { exitCode: 0, stdout: diff },
  'git rev-parse HEAD': { exitCode: 0, stdout: `${head}\n` },
  'git status --porcelain': { exitCode: 0, stdout: '' },
  'git fetch': { exitCode: 0, stdout: '' },
  'git rev-parse FETCH_HEAD': { exitCode: 0, stdout: `${OID}\n` },
  'git worktree add': { exitCode: 0, stdout: '' },
})

test('pr at local HEAD reviews the working directory and creates no worktree', async () => {
  const { host, lines } = recording(prResponses(OID))

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result).toEqual({
    ok: true,
    artifact: {
      text: '# PR #45: Fix refunds\n\nWhy\n\n## Diff\n\nthe diff',
      root: '/repo',
      pr: { number: 45, url: 'https://github.com/o/r/pull/45', headRefOid: OID },
    },
  })
  expect(lines().some(l => l.includes('worktree add'))).toBe(false)
})

test('pr not at HEAD fetches and adds a detached worktree as the root', async () => {
  const { host, lines, calls } = recording(prResponses('0000000'))

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  const path = '/tmp/adversary-pr-45-abcdef0-f81d4fae'
  expect(result.ok && result.artifact.root).toBe(path)
  expect(result.ok && result.artifact.worktree).toBe(path)
  expect(lines()).toContain('git fetch origin pull/45/head')
  // The commit checked, not FETCH_HEAD, which another fetch may have moved since.
  expect(lines()).toContain(`git worktree add --detach ${path} ${OID}`)
  expect(calls.every(c => c.cwd === '/repo')).toBe(true)
})

test('pr at local HEAD with uncommitted or untracked changes is reviewed in a temp worktree', async () => {
  const path = '/tmp/adversary-pr-45-abcdef0-f81d4fae'
  const dirty = recording({ ...prResponses(OID), 'git status --porcelain': { exitCode: 0, stdout: ' M src/a.ts\n?? notes.md\n' } })
  // A status that cannot be read cannot vouch for a clean tree either.
  const unknown = recording({ ...prResponses(OID), 'git status --porcelain': { exitCode: 128, stdout: '', stderr: 'fatal' } })

  for (const { host, lines } of [dirty, unknown]) {
    const result = await prArtifact(host, '45', '/repo', '/tmp')
    expect(result.ok && result.artifact.root).toBe(path)
    expect(lines()).toContain(`git worktree add --detach ${path} ${OID}`)
  }
})

test('a worktree left at the path by an earlier run is removed and pruned before the add', async () => {
  const path = '/tmp/adversary-pr-45-abcdef0-f81d4fae'
  const responses = { ...prResponses('0000000'), 'git worktree remove': { exitCode: 0, stdout: '' }, 'git worktree prune': { exitCode: 0, stdout: '' } }
  const leftover = recording(responses)
  leftover.host.exists = async p => p === path
  const clean = recording(responses)

  expect((await prArtifact(leftover.host, '45', '/repo', '/tmp')).ok).toBe(true)
  expect((await prArtifact(clean.host, '45', '/repo', '/tmp')).ok).toBe(true)

  expect(leftover.lines().filter(l => l.startsWith('git worktree'))).toEqual([
    `git worktree remove --force ${path}`,
    'git worktree prune',
    `git worktree add --detach ${path} ${OID}`,
  ])
  expect(clean.lines().filter(l => l.startsWith('git worktree'))).toEqual([`git worktree add --detach ${path} ${OID}`])
})

test("each session checks the same PR head out to its own path and never removes another session's", async () => {
  const theirs = '/tmp/adversary-pr-45-abcdef0-f81d4fae'
  const mine = '/tmp/adversary-pr-45-abcdef0-0b7c2e19'
  const { host, lines } = recording(prResponses('0000000'))
  host.sessionId = async () => '0b7c2e19-aaaa-bbbb-cccc-dddddddddddd'
  host.exists = async p => p === theirs

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result.ok && result.artifact.worktree).toBe(mine)
  expect(lines().filter(l => l.startsWith('git worktree'))).toEqual([`git worktree add --detach ${mine} ${OID}`])
})

test('a pr from another repository is refused before anything is fetched', async () => {
  const url = 'https://github.com/someone/fork/pull/45'
  const { host, lines } = recording({ ...prResponses('0000000'), 'gh pr view': viewOf(url) })

  const result = await prArtifact(host, url, '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: `PR ${url} is not in this repository (o/r)` })
  expect(lines().some(l => l.startsWith('gh pr diff') || l.startsWith('git '))).toBe(false)
})

test('the repository is matched ignoring case, on github.com and on an enterprise host', async () => {
  const cased = recording({ ...prResponses(OID), 'gh repo view --json nameWithOwner,url': repo('O/R', 'https://GitHub.com/O/R') })
  const enterprise = recording({
    ...prResponses(OID),
    'gh pr view': viewOf('https://ghe.example.org/team/svc/pull/45'),
    'gh repo view --json nameWithOwner,url': repo('team/svc', 'https://ghe.example.org/team/svc'),
  })

  expect((await prArtifact(cased.host, '45', '/repo', '/tmp')).ok).toBe(true)
  expect((await prArtifact(enterprise.host, '45', '/repo', '/tmp')).ok).toBe(true)
})

test('a pr with the same owner and name on another host is refused', async () => {
  const { host } = recording({ ...prResponses(OID), 'gh pr view': viewOf('https://ghe.example.org/o/r/pull/45') })

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: 'PR https://ghe.example.org/o/r/pull/45 is not in this repository (o/r)' })
})

test('a repository gh cannot name is refused', async () => {
  const { host } = recording({ ...prResponses(OID), 'gh repo view --json nameWithOwner,url': { exitCode: 1, stdout: '', stderr: 'no git remotes found' } })

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: 'Could not tell which repository this is: no git remotes found' })
})

test('a fetch that brings another commit than the pr head is refused and adds no worktree', async () => {
  const { host, lines } = recording({ ...prResponses('0000000'), 'git rev-parse FETCH_HEAD': { exitCode: 0, stdout: '1111111\n' } })

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: 'PR 45 changed while it was being fetched; try again' })
  expect(lines().some(l => l.startsWith('git worktree'))).toBe(false)
})

test('gh missing gives the verbatim gh message', async () => {
  const result = await prArtifact(recording({}).host, '45', '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: 'gh is not available: run gh auth login' })
})

test('an unreadable pr names the target and the first stderr line', async () => {
  const { host } = recording({ 'gh pr view': { exitCode: 1, stdout: '', stderr: 'no pull requests found\nmore' } })

  const result = await prArtifact(host, '99', '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: 'Could not read PR 99: no pull requests found' })
})

test('a failed fetch names the pr', async () => {
  const { host } = recording({ ...prResponses('0000000'), 'git fetch': { exitCode: 128, stdout: '', stderr: 'fatal: no remote\nx' } })

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: 'Could not check out PR #45: fatal: no remote' })
})

test('a diff over 200000 characters is refused', async () => {
  const { host, lines } = recording(prResponses('0000000', 'x'.repeat(MAX_ARTIFACT_CHARS + 1)))

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: 'PR diff is 200001 characters; too large for one review (limit 200000)' })
  expect(lines().some(l => l.startsWith('git fetch'))).toBe(false)
})

test('a diff of exactly 200000 characters is accepted', async () => {
  const { host } = recording(prResponses(OID, 'x'.repeat(MAX_ARTIFACT_CHARS)))

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result.ok).toBe(true)
})

test('a gh authentication failure gives the verbatim gh message', async () => {
  const stderr = 'To get started with GitHub CLI, please run:  gh auth login'
  const { host } = recording({ 'gh pr view': { exitCode: 1, stdout: '', stderr } })

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: 'gh is not available: run gh auth login' })
})

test('a failing gh pr diff names the target and the first stderr line', async () => {
  const { host } = recording({ ...prResponses(OID), 'gh pr diff': { exitCode: 1, stdout: '', stderr: 'diff unavailable\nmore' } })

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: 'Could not read PR 45: diff unavailable' })
})

test('gh pr view output that is not JSON is an unreadable pr', async () => {
  const { host } = recording({ 'gh pr view': { exitCode: 0, stdout: 'not json' } })

  const result = await prArtifact(host, '45', '/repo', '/tmp')

  expect(result).toEqual({ ok: false, error: 'Could not read PR 45: unexpected gh output' })
})

test('plan with no captured plan gives No plan this session', async () => {
  expect(await planArtifact(fakeHost(), null, '/repo')).toEqual({ ok: false, error: 'No plan this session' })
})

test('plan reviews the working directory', async () => {
  expect(await planArtifact(fakeHost(), 'Step 1', '/repo')).toEqual({ ok: true, artifact: { text: 'Step 1', root: '/repo' } })
})

test('doc reads the file', async () => {
  const host = fakeHost({ exists: async p => p === '/repo/docs/a.md', readFile: async p => (p === '/repo/docs/a.md' ? 'Hello' : '') })

  expect(await docArtifact(host, 'docs/a.md', '/repo')).toEqual({ ok: true, artifact: { text: 'Hello', root: '/repo' } })
})

test('a doc that cannot be read names the path and the reason', async () => {
  const host = fakeHost({ exists: async () => true, readFile: async () => Promise.reject(new Error('EACCES: permission denied')) })

  expect(await docArtifact(host, 'docs/a.md', '/repo')).toEqual({ ok: false, error: 'Could not read docs/a.md: EACCES: permission denied' })
})

test('a missing doc names the path', async () => {
  expect(await docArtifact(fakeHost(), 'docs/gone.md', '/repo')).toEqual({ ok: false, error: 'Document not found: docs/gone.md' })
})

test('removeWorktree runs git worktree remove --force', async () => {
  const { host, lines } = recording({ 'git worktree remove': { exitCode: 0, stdout: '' } })

  await removeWorktree(host, '/repo', '/tmp/wt')

  expect(lines()).toEqual(['git worktree remove --force /tmp/wt'])
})

test('a git or gh failure with nothing on stderr names the exit code', async () => {
  const fetch = recording({ ...prResponses('0000000'), 'git fetch': { exitCode: 128, stdout: '' } })
  const view = recording({ 'gh pr view': { exitCode: 1, stdout: '', stderr: '\n' } })

  expect(await prArtifact(fetch.host, '45', '/repo', '/tmp')).toEqual({ ok: false, error: 'Could not check out PR #45: exit 128' })
  expect(await prArtifact(view.host, '45', '/repo', '/tmp')).toEqual({ ok: false, error: 'Could not read PR 45: exit 1' })
})
