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

const prResponses = (head: string, diff = 'the diff') => ({
  'gh pr view': { exitCode: 0, stdout: VIEW },
  'gh pr diff': { exitCode: 0, stdout: diff },
  'git rev-parse HEAD': { exitCode: 0, stdout: `${head}\n` },
  'git fetch': { exitCode: 0, stdout: '' },
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

  const path = '/tmp/adversary-pr-45-abcdef0'
  expect(result.ok && result.artifact.root).toBe(path)
  expect(result.ok && result.artifact.worktree).toBe(path)
  expect(lines()).toContain('git fetch origin pull/45/head')
  expect(lines()).toContain(`git worktree add --detach ${path} FETCH_HEAD`)
  expect(calls.every(c => c.cwd === '/repo')).toBe(true)
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

test('a missing doc names the path', async () => {
  expect(await docArtifact(fakeHost(), 'docs/gone.md', '/repo')).toEqual({ ok: false, error: 'Document not found: docs/gone.md' })
})

test('removeWorktree runs git worktree remove --force', async () => {
  const { host, lines } = recording({ 'git worktree remove': { exitCode: 0, stdout: '' } })

  await removeWorktree(host, '/repo', '/tmp/wt')

  expect(lines()).toEqual(['git worktree remove --force /tmp/wt'])
})
