import { expect, test } from 'claude-code/testing'

import { checkPath, isUnder, isUnplaceable, normalise } from '../hooks/guard'
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
  for (const path of ['C:\\repo\\a.cs', 'C:/repo/a.cs', 'src/a.cs', './a.cs', '../a.cs', '/repo/a.cs', '~/a.cs']) {
    expect(isUnplaceable(path)).toBe(false)
  }
})

test('an unresolvable path is outside', async () => {
  expect(await checkPath(landing(undefined).host, 'missing.cs', ROOT)).toBe(false)
})

test('a realPath that is empty is outside', async () => {
  expect(await checkPath(landing('').host, 'a.cs', ROOT)).toBe(false)
})
