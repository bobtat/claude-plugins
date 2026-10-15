import { expect, test } from 'claude-code/testing'

import { USAGE, parseArgs } from '../hooks/args'

const ok = (raw: string) => {
  const r = parseArgs(raw)
  if (!r.ok) throw new Error(r.error)
  return r.args
}

const error = (raw: string) => {
  const r = parseArgs(raw)
  if (r.ok) throw new Error('expected an error')
  return r.error
}

test('pr with a number', async () => {
  expect(ok('pr 12')).toEqual({ sub: 'pr', target: '12' })
})

test('pr with a URL', async () => {
  expect(ok('pr https://github.com/o/r/pull/12')).toEqual({ sub: 'pr', target: 'https://github.com/o/r/pull/12' })
})

test('plan with no target', async () => {
  expect(ok('plan')).toEqual({ sub: 'plan' })
})

test('doc with a path containing spaces in quotes', async () => {
  expect(ok('doc "docs/my notes.md"')).toEqual({ sub: 'doc', target: 'docs/my notes.md' })
})

test('triage takes no options', async () => {
  expect(ok('triage')).toEqual({ sub: 'triage' })
  expect(error('triage --focus x')).toContain(USAGE)
})

test('all three options in any order', async () => {
  expect(ok('pr 3 --model sonnet --focus auth --brief PROJ-9')).toEqual({
    sub: 'pr',
    target: '3',
    model: 'sonnet',
    focus: 'auth',
    brief: 'PROJ-9',
  })
  expect(ok('--brief "#4" plan --model haiku')).toEqual({ sub: 'plan', brief: '#4', model: 'haiku' })
})

test('quoted values keep flags and escaped quotes inside', async () => {
  expect(ok('plan --focus "why does --force skip the lock?"')).toEqual({
    sub: 'plan',
    focus: 'why does --force skip the lock?',
  })
  expect(ok('plan --brief "say \\"no\\""')).toEqual({ sub: 'plan', brief: 'say "no"' })
})

test('rejects an unknown model', async () => {
  const e = error('plan --model gpt')
  expect(e).toContain('opus, sonnet, haiku')
  expect(e.endsWith('\n' + USAGE)).toBe(true)
})

test('rejects pr and doc without a target', async () => {
  expect(error('pr')).toContain(USAGE)
  expect(error('doc --focus x')).toContain(USAGE)
})

test('rejects an unknown subcommand', async () => {
  expect(error('review 12')).toContain(USAGE)
})

test('rejects an empty string', async () => {
  expect(error('   ')).toContain(USAGE)
})

test('rejects a flag with no value', async () => {
  expect(error('plan --focus')).toContain(USAGE)
  expect(error('plan --focus --model opus')).toContain(USAGE)
})
