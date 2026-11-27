import { expect, test } from 'claude-code/testing'

import { OUTPUT_CONTRACT } from '../hooks/findings'
import type { Host } from '../hooks/host'
import { fillTemplate, homeDir, resolveTemplate, seedUserTemplates } from '../hooks/templates'
import { fakeHost } from './support'

const REPO_TEMPLATE = '/repo/.claude/adversary/pr.md'
const USER_TEMPLATE = '/home/me/.claude/adversary/pr.md'
const SHIPPED_TEMPLATE = 'C:/plugins/adversary/templates/pr.md'

function filesystem(files: Record<string, string>): Host & { written: Record<string, string> } {
  const written: Record<string, string> = {}
  const host = fakeHost({
    exists: async path => path in files || path in written,
    readFile: async path => {
      const text = files[path] ?? written[path]
      if (text === undefined) throw new Error(`no such file ${path}`)
      return text
    },
    writeFile: async (path, text) => {
      written[path] = text
    },
  })
  return Object.assign(host, { written })
}

test('repo template wins over the user template over the shipped one', async () => {
  const repo = `repo {{artifact}} {{output_contract}}`
  const user = `user {{artifact}} {{output_contract}}`
  const shipped = `shipped {{artifact}} {{output_contract}}`

  expect(await resolveTemplate(filesystem({ [REPO_TEMPLATE]: repo, [USER_TEMPLATE]: user, [SHIPPED_TEMPLATE]: shipped }), 'pr', '/repo', '/home/me')).toEqual({
    ok: true,
    path: REPO_TEMPLATE,
    text: repo,
  })
  expect(await resolveTemplate(filesystem({ [USER_TEMPLATE]: user, [SHIPPED_TEMPLATE]: shipped }), 'pr', '/repo', '/home/me')).toEqual({
    ok: true,
    path: USER_TEMPLATE,
    text: user,
  })
  expect(await resolveTemplate(filesystem({ [SHIPPED_TEMPLATE]: shipped }), 'pr', '/repo', '/home/me')).toEqual({
    ok: true,
    path: SHIPPED_TEMPLATE,
    text: shipped,
  })
})

test('resolving fails naming the kind when no template exists anywhere', async () => {
  const result = await resolveTemplate(filesystem({}), 'plan', '/repo', '/home/me')

  expect(result.ok).toBe(false)
  expect(!result.ok && result.error).toContain('plan')
})

test('seeding copies missing shipped templates and never overwrites an existing one', async () => {
  const host = filesystem({
    'C:/plugins/adversary/templates/pr.md': 'shipped pr',
    'C:/plugins/adversary/templates/plan.md': 'shipped plan',
    'C:/plugins/adversary/templates/doc.md': 'shipped doc',
    '/home/me/.claude/adversary/plan.md': 'my plan',
  })

  await seedUserTemplates(host, '/home/me')

  expect(host.written).toEqual({
    '/home/me/.claude/adversary/pr.md': 'shipped pr',
    '/home/me/.claude/adversary/doc.md': 'shipped doc',
  })
})

test('with no home directory nothing is seeded and the user level is not looked up', async () => {
  const shipped = `shipped {{artifact}} {{output_contract}}`
  const host = filesystem({ [SHIPPED_TEMPLATE]: shipped, '/.claude/adversary/pr.md': 'at the filesystem root' })

  await seedUserTemplates(host, '')
  expect(host.written).toEqual({})
  expect(await resolveTemplate(host, 'pr', '/repo', '')).toEqual({ ok: true, path: SHIPPED_TEMPLATE, text: shipped })
})

test('fill drops brief and focus lines when absent and renders them when present', async () => {
  const text = 'before\n{{brief}}\n{{focus}}\n{{artifact}}\n{{output_contract}}'

  const bare = fillTemplate(text, 'p.md', { artifact: 'THE DIFF', root: '/r' })
  expect(bare).toEqual({ ok: true, prompt: `before\nTHE DIFF\n${OUTPUT_CONTRACT}` })

  const full = fillTemplate(text, 'p.md', { artifact: 'THE DIFF', root: '/r', brief: { label: 'PROJ-1', text: 'Do it' }, focus: 'locking' })
  expect(full).toEqual({ ok: true, prompt: `before\n## Brief (PROJ-1)\n\nDo it\n## Focus\n\nlocking\nTHE DIFF\n${OUTPUT_CONTRACT}` })
})

test('fill inserts the output contract and the root', async () => {
  const result = fillTemplate('{{root}}\n{{artifact}}\n{{output_contract}}', 'p.md', { artifact: 'a', root: '/the/root' })

  expect(result).toEqual({ ok: true, prompt: `/the/root\na\n${OUTPUT_CONTRACT}` })
})

test('substituted values containing dollar patterns are inserted literally', async () => {
  const result = fillTemplate('{{artifact}}\n{{output_contract}}', 'p.md', { artifact: "cost $& and $' here", root: '/r' })

  expect(result.ok && result.prompt.startsWith("cost $& and $' here\n")).toBe(true)
})

test('a template missing {{artifact}} is rejected naming its path and the placeholder', async () => {
  const result = fillTemplate('{{output_contract}}', '/x/pr.md', { artifact: 'a', root: '/r' })

  expect(result.ok).toBe(false)
  expect(!result.ok && result.error).toContain('/x/pr.md')
  expect(!result.ok && result.error).toContain('{{artifact}}')
})

test('a template missing {{output_contract}} is rejected naming its path and the placeholder', async () => {
  const result = fillTemplate('{{artifact}}', '/x/pr.md', { artifact: 'a', root: '/r' })

  expect(result.ok).toBe(false)
  expect(!result.ok && result.error).toContain('/x/pr.md')
  expect(!result.ok && result.error).toContain('{{output_contract}}')
})

test('homeDir prefers USERPROFILE over HOME', async () => {
  const both = fakeHost({ env: async name => ({ USERPROFILE: 'C:/Users/me', HOME: '/home/me' } as Record<string, string>)[name] })
  const homeOnly = fakeHost({ env: async name => (name === 'HOME' ? '/home/me' : undefined) })

  expect(await homeDir(both)).toBe('C:/Users/me')
  expect(await homeDir(homeOnly)).toBe('/home/me')
})
