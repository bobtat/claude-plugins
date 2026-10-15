import { expect, test } from 'claude-code/testing'

import { checkPath, isUnder, isUnplaceable, judgeCall, normalise } from '../hooks/guard'
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

test('a relative pattern or glob climbing out with .. is denied', async () => {
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: '../../secrets/*' }, ROOT)).toBe('deny')
  expect(await judgeCall(spelled().host, { tool: 'Glob', pattern: 'src/{a,../../x}/*' }, ROOT)).toBe('deny')
  expect(await judgeCall(spelled().host, { tool: 'Grep', pattern: 'x', glob: '../*.env' }, ROOT)).toBe('deny')
})
