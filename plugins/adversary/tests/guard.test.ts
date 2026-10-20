import { expect, test } from 'claude-code/testing'

import { checkPath, grepNamesWithheld, isUnder, isUnplaceable, judgeCall, normalise } from '../hooks/guard'
import { fakeHost } from './support'

const ROOT = 'C:/repo'

function landing(realPath: string | undefined) {
  const asked: string[] = []
  const host = fakeHost({
    async realPath(path) {
      asked.push(path)
      return realPath
    },
  })
  return { host, asked }
}

test('normalises separators, drive letter and trailing slash', async () => {
  expect(normalise('C:\\repo\\src\\')).toBe('c:/repo/src')
  expect(normalise('D:/x')).toBe('d:/x')
})

test('a file under the root is inside', async () => {
  const { host, asked } = landing('C:/repo/src/a.cs')

  expect(await checkPath(host, 'src/a.cs', ROOT)).toBe(true)
  expect(asked).toEqual(['src/a.cs'])
})

test('the root itself is inside', async () => {
  expect(await checkPath(landing('C:/repo').host, '.', ROOT)).toBe(true)
  expect(await checkPath(landing('C:\\repo\\').host, '.', ROOT)).toBe(true)
})

test('Windows spellings of the same path are inside', async () => {
  for (const real of ['C:\\repo\\src\\a.cs', 'c:/repo/src/a.cs', 'C:/Repo/src/a.cs']) {
    expect(await checkPath(landing(real).host, 'whatever', ROOT)).toBe(true)
  }
})

test('the root may be spelled any way too', async () => {
  expect(isUnder('c:\\Repo\\', 'C:/repo/src/a.cs')).toBe(true)
})

test('a sibling with the root as a prefix is outside', async () => {
  expect(await checkPath(landing('C:/repo-other/x').host, 'x', ROOT)).toBe(false)
  expect(isUnder(ROOT, 'C:/repository')).toBe(false)
})

test('.. traversal resolved outside is outside', async () => {
  const { host } = landing('C:/Users/me/.claude/CLAUDE.md')

  expect(await checkPath(host, 'C:/repo/../Users/me/.claude/CLAUDE.md', ROOT)).toBe(false)
})

test('a symlink resolving outside is outside', async () => {
  const { host } = landing('D:/secrets/key.txt')

  expect(await checkPath(host, 'C:/repo/link.txt', ROOT)).toBe(false)
})

test('a path on another drive with the same tail is outside', async () => {
  expect(await checkPath(landing('D:/repo/a.cs').host, 'a.cs', ROOT)).toBe(false)
})

test('a root of a whole drive contains its files', async () => {
  expect(isUnder('C:/', 'C:/x')).toBe(true)
  expect(isUnder('C:/', 'D:/x')).toBe(false)
})

test('drive-relative, UNC and device paths are outside without a stat call', async () => {
  const { host, asked } = landing('C:/repo/a.cs')

  for (const path of ['D:x', 'C:a.cs', '\\\\server\\share\\a', '//server/share/a', '\\\\?\\C:\\repo\\a', '\\\\.\\pipe\\x', 'src/C:a.cs']) {
    expect(await checkPath(host, path, ROOT)).toBe(false)
  }
  expect(asked).toEqual([])
})

test('an empty path or one containing NUL is outside without a stat call', async () => {
  const { host, asked } = landing('C:/repo/a.cs')

  expect(await checkPath(host, '', ROOT)).toBe(false)
  expect(await checkPath(host, 'a.cs\0.txt', ROOT)).toBe(false)
  expect(asked).toEqual([])
})

test('ordinary absolute and relative spellings are placeable', async () => {
  for (const path of ['C:\\repo\\a.cs', 'C:/repo/a.cs', 'src/a.cs', './a.cs', '../a.cs', '/repo/a.cs']) {
    expect(isUnplaceable(path)).toBe(false)
  }
})

test('an unresolvable path is outside', async () => {
  expect(await checkPath(landing(undefined).host, 'missing.cs', ROOT)).toBe(false)
})

test('a realPath that is empty is outside', async () => {
  expect(await checkPath(landing('').host, 'a.cs', ROOT)).toBe(false)
})

test('home-relative spellings are outside without a stat call', async () => {
  const { host, asked } = landing('C:/repo/~/.claude/CLAUDE.md')

  for (const path of ['~', '~/.claude/CLAUDE.md', '~\\x', '~user/x']) {
    expect(await checkPath(host, path, ROOT)).toBe(false)
  }
  expect(asked).toEqual([])
})

test('a POSIX root compares case-sensitively', async () => {
  expect(isUnder('/home/u/repo', '/home/u/Repo/secret')).toBe(false)
  expect(isUnder('/home/u/repo', '/home/u/repo/a')).toBe(true)
})

test('a Windows root compares case-insensitively', async () => {
  expect(isUnder('C:/repo', 'c:/REPO/x')).toBe(true)
  expect(isUnder('//srv/Share', '//SRV/share/x')).toBe(true)
})

test('an empty or all-slash root contains nothing', async () => {
  for (const root of ['', '//', '\\\\']) {
    expect(isUnder(root, '/etc/x')).toBe(false)
    expect(await checkPath(landing('/etc/x').host, 'x', root)).toBe(false)
  }
})

test('the POSIX filesystem root is a root', async () => {
  expect(isUnder('/', '/etc/x')).toBe(true)
  expect(isUnder('/', '/')).toBe(true)
})

test('a target with dot segments is outside', async () => {
  expect(isUnder(ROOT, 'C:/repo/../Users/x')).toBe(false)
  expect(isUnder(ROOT, 'C:/repo/./a')).toBe(false)
})

// A host whose paths land where they are spelled, as a tree without links does.
function spelled() {
  const asked: string[] = []
  const host = fakeHost({
    async realPath(path) {
      asked.push(path)
      return path
    },
  })
  return { host, asked }
}

test('a reviewer Read is judged by its file_path', async () => {
  expect(await judgeCall(spelled().host, { tool: 'Read', file_path: 'C:/repo/src/a.cs' }, ROOT)).toBe('allow')
  expect(await judgeCall(spelled().host, { tool: 'Read', file_path: 'C:/other/a.cs' }, ROOT)).toBe('deny')
  expect(await judgeCall(spelled().host, { tool: 'Read' }, ROOT)).toBe('deny')
})

test('a Grep or Glob without a path is scoped to the root, and one with a path is judged by it', async () => {
  expect(await judgeCall(spelled().host, { tool: 'Grep', pattern: 'lock' }, ROOT)).toBe('scope')
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: '**/*.cs' }, ROOT)).toBe('scope')
  expect(await judgeCall(spelled().host, { tool: 'Grep', pattern: 'lock', path: 'C:/repo/src' }, ROOT)).toBe('allow')
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: '*.cs', path: 'C:/other' }, ROOT)).toBe('deny')
})

test('with an empty root every call is denied, a pathless one too', async () => {
  expect(await judgeCall(spelled().host, { tool: 'Grep', pattern: 'lock' }, '')).toBe('deny')
  expect(await judgeCall(spelled().host, { tool: 'Read', file_path: 'C:/repo/a.cs' }, '')).toBe('deny')
})

test('a relative path or file_path is denied without a stat call', async () => {
  for (const call of [
    { tool: 'Read', file_path: 'src/a.cs' },
    { tool: 'Grep', pattern: 'x', path: 'src' },
    { tool: 'Glob', pattern: '*.cs', path: '.' },
  ]) {
    const { host, asked } = spelled()
    expect(await judgeCall(host, call, ROOT)).toBe('deny')
    expect(asked).toEqual([])
  }
})

test("Grep's regex is not a path", async () => {
  const { host, asked } = spelled()

  expect(await judgeCall(host, { tool: 'Grep', pattern: 'C:/other/.*', path: 'C:/repo' }, ROOT)).toBe('allow')
  expect(asked).toEqual(['C:/repo'])
})

test('an absolute Glob pattern or Grep glob is judged by its directory before the first wildcard', async () => {
  const { host, asked } = spelled()

  expect(await judgeCall(host, { tool: 'Glob', pattern: 'C:/repo/src/**/*.cs' }, ROOT)).toBe('scope')
  expect(asked).toEqual(['C:/repo/src/'])
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: 'C:\\other\\*.cs' }, ROOT)).toBe('deny')
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: '/etc/*' }, ROOT)).toBe('deny')
  expect(await judgeCall(spelled().host, { tool: 'Grep', pattern: 'x', path: 'C:/repo', glob: 'C:/other/*.cs' }, ROOT)).toBe('deny')
})

test('a pattern or glob starting with ~, a drive or two slashes is denied without a stat call', async () => {
  for (const pattern of ['~/.ssh/*', 'C:*.cs', '//server/share/*', '\\\\server\\share\\*']) {
    const { host, asked } = spelled()
    expect(await judgeCall(host, { tool: 'Glob', pattern }, ROOT)).toBe('deny')
    expect(asked).toEqual([])
  }
})

test('CLAUDE.md, CLAUDE.local.md, .claude and .git under the root are denied to Read', async () => {
  for (const file_path of [
    'C:/repo/CLAUDE.md',
    'C:/repo/src/CLAUDE.local.md',
    'C:/repo/src/claude.md',
    'C:/repo/.claude/settings.json',
    'C:/repo/src/.claude/agents/x.md',
    'C:/repo/.git/config',
    'C:/repo/.GIT/HEAD',
  ]) {
    expect(await judgeCall(spelled().host, { tool: 'Read', file_path }, ROOT)).toBe('deny')
  }
})

test('a link that resolves into .git is denied', async () => {
  expect(await judgeCall(landing('C:/repo/.git/config').host, { tool: 'Read', file_path: 'C:/repo/notes.txt' }, ROOT)).toBe('deny')
})

test('only the part of the path below the root counts, and near names are allowed', async () => {
  const root = 'C:/Users/me/.claude/worktrees/x'
  for (const file_path of [`${root}/src/a.ts`, `${root}/.github/workflows/ci.yml`, `${root}/docs/CLAUDE.md.bak`, `${root}/.gitignore`]) {
    expect(await judgeCall(spelled().host, { tool: 'Read', file_path }, root)).toBe('allow')
  }
})

test('under a POSIX root the withheld names compare exactly', async () => {
  const root = '/home/u/repo'
  expect(await judgeCall(spelled().host, { tool: 'Read', file_path: '/home/u/repo/.git/config' }, root)).toBe('deny')
  expect(await judgeCall(spelled().host, { tool: 'Read', file_path: '/home/u/repo/CLAUDE.md' }, root)).toBe('deny')
  expect(await judgeCall(spelled().host, { tool: 'Read', file_path: '/home/u/repo/claude.md' }, root)).toBe('allow')
})

test('a Grep or Glob aimed at CLAUDE.md, .claude or .git is denied', async () => {
  for (const call of [
    { tool: 'Grep', pattern: 'x', path: 'C:/repo/.claude' },
    { tool: 'Glob', pattern: '*', path: 'C:/repo/.git' },
    { tool: 'Glob', pattern: '.claude/**' },
    { tool: 'Glob', pattern: '**/CLAUDE.md' },
    { tool: 'Glob', pattern: '**\\claude.local.md' },
    { tool: 'Glob', pattern: 'src/{a,.git}/*' },
    { tool: 'Grep', pattern: 'x', glob: '**/.git/*' },
    { tool: 'Glob', pattern: 'C:/repo/.claude/*' },
    { tool: 'Glob', pattern: 'C:/repo/**/CLAUDE.md' },
  ]) {
    expect(await judgeCall(spelled().host, call, ROOT)).toBe('deny')
  }
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: '**/*.md' }, ROOT)).toBe('scope')
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: '.github/**' }, ROOT)).toBe('scope')
})

test('a brace alternative spelled absolute is denied without a stat call', async () => {
  for (const call of [
    { tool: 'Glob', pattern: 'src/{a,/etc}/*' },
    { tool: 'Glob', pattern: '{C:/Users,src}/*' },
    { tool: 'Glob', pattern: '{src, ~/.ssh}/*' },
    { tool: 'Glob', pattern: 'a/{b,\\\\server\\share}/*' },
    { tool: 'Grep', pattern: 'x', glob: '{*.ts,/etc/passwd}' },
  ]) {
    const { host, asked } = spelled()
    expect(await judgeCall(host, call, ROOT)).toBe('deny')
    expect(asked).toEqual([])
  }
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: '{src,test}/**/*.ts' }, ROOT)).toBe('scope')
})

test('a relative pattern or glob climbing out with .. is denied', async () => {
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: '../../secrets/*' }, ROOT)).toBe('deny')
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: 'src/{a,../../x}/*' }, ROOT)).toBe('deny')
  expect(await judgeCall(spelled().host, { tool: 'Grep', pattern: 'x', glob: '../*.env' }, ROOT)).toBe('deny')
})

const files = (...filenames: string[]) => ({ mode: 'files_with_matches', numFiles: filenames.length, filenames })
const lines = (...content: string[]) => ({ mode: 'content', numFiles: 0, filenames: [], content: content.join('\n') })

test('a Grep result naming CLAUDE.md, .claude or .git below the root, relative or absolute, is withheld', async () => {
  for (const result of [
    files('CLAUDE.md'),
    files('src/a.ts', '.claude/settings.json'),
    files('C:/repo/.git/config'),
    files('C:\\repo\\src\\CLAUDE.local.md'),
    files('c:/Repo/.Claude/agents/x.md'),
    lines('src/a.ts:3:lock()', 'CLAUDE.md:12:the secret'),
    lines('C:\\repo\\.claude\\notes.md:1:the secret'),
    lines('.git/config:4:url = x'),
    { mode: 'count', numFiles: 1, filenames: [], content: 'C:/repo/CLAUDE.md:2' },
  ]) {
    expect(grepNamesWithheld(ROOT, result)).toBe(true)
  }
})

test('a Grep result naming only other files is not withheld, whatever the matched text says', async () => {
  for (const result of [
    files('src/a.ts', 'C:/repo/docs/CLAUDE.md.bak', '.github/ci.yml'),
    lines('src/a.ts:3:see .claude/settings.json: x', 'src/a.ts-4-read CLAUDE.md', '--', 'C:/repo/b.ts:1:.git/config:'),
    lines(''),
    { mode: 'count', numFiles: 1, filenames: [], content: 'src/a.ts:3' },
    'not a record',
    undefined,
  ]) {
    expect(grepNamesWithheld(ROOT, result)).toBe(false)
  }
})

test('in a Grep result only the part of a path below the root counts', async () => {
  const root = 'C:/Users/me/.claude/worktrees/x'
  expect(grepNamesWithheld(root, files(`${root}/src/a.ts`))).toBe(false)
  expect(grepNamesWithheld(root, lines(`${root}/src/a.ts:1:x`))).toBe(false)
  expect(grepNamesWithheld(root, files(`${root}/.claude/x`))).toBe(true)
  // A path outside the root cannot be placed below it, so every segment counts.
  expect(grepNamesWithheld(root, files('C:/elsewhere/.git/config'))).toBe(true)
  expect(grepNamesWithheld('/home/u/repo', files('claude.md', '.GIT/x'))).toBe(false)
  expect(grepNamesWithheld('/home/u/repo', files('/home/u/repo/CLAUDE.md'))).toBe(true)
})
