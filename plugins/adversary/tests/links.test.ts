import { expect, test } from 'claude-code/testing'

import type { Entry } from '../hooks/host'
import { hasOutwardLinks } from '../hooks/links'
import { fakeHost } from './support'

const ROOT = 'C:/repo'

const file = (name: string): Entry => ({ name, kind: 'file', isLink: false })
const dir = (name: string): Entry => ({ name, kind: 'dir', isLink: false })
const link = (name: string): Entry => ({ name, kind: 'other', isLink: true })

// A tree of directories, and where each link (or odd entry) lands.
function tree(dirs: Record<string, Entry[]>, lands: Record<string, string> = {}) {
  const listed: string[] = []
  const host = fakeHost({
    async list(path) {
      listed.push(path)
      const entries = dirs[path]
      if (entries === undefined) throw new Error(`ENOENT: ${path}`)
      return entries
    },
    realPath: async path => lands[path],
  })
  return { host, listed }
}

test('a tree of plain files and directories has no outward links', async () => {
  const { host } = tree({ [ROOT]: [file('a.ts'), dir('src')], [`${ROOT}/src`]: [file('b.ts')] })

  expect(await hasOutwardLinks(host, ROOT)).toBe(false)
})

test('a link leading outside the root, however deep, is found', async () => {
  const { host } = tree(
    { [ROOT]: [dir('src')], [`${ROOT}/src`]: [link('home')] },
    { [`${ROOT}/src/home`]: 'C:/Users/someone/.claude' },
  )

  expect(await hasOutwardLinks(host, ROOT)).toBe(true)
})

test('a link leading inside the root is harmless and not followed', async () => {
  const { host, listed } = tree(
    { [ROOT]: [dir('src'), link('alias')], [`${ROOT}/src`]: [file('a.ts')] },
    { [`${ROOT}/alias`]: `${ROOT}/src` },
  )

  expect(await hasOutwardLinks(host, ROOT)).toBe(false)
  expect(listed).toEqual([ROOT, `${ROOT}/src`])
})

test('an entry that is neither file nor directory is checked like a link', async () => {
  const junction: Entry = { name: 'j', kind: 'other', isLink: false }

  expect(await hasOutwardLinks(tree({ [ROOT]: [junction] }, { [`${ROOT}/j`]: 'D:/elsewhere' }).host, ROOT)).toBe(true)
  expect(await hasOutwardLinks(tree({ [ROOT]: [junction] }, { [`${ROOT}/j`]: `${ROOT}/x` }).host, ROOT)).toBe(false)
})

test('a link that cannot be resolved counts as outward', async () => {
  expect(await hasOutwardLinks(tree({ [ROOT]: [link('gone')] }).host, ROOT)).toBe(true)
})

test('.git is not walked', async () => {
  const { host, listed } = tree({ [ROOT]: [dir('.git'), file('a.ts')] })

  expect(await hasOutwardLinks(host, ROOT)).toBe(false)
  expect(listed).toEqual([ROOT])
})

test('a directory that cannot be listed counts as outward', async () => {
  expect(await hasOutwardLinks(tree({ [ROOT]: [dir('locked')] }).host, ROOT)).toBe(true)
})

test('reaching the entry cap counts as outward', async () => {
  const many = Array.from({ length: 5 }, (_, i) => file(`f${i}.ts`))

  expect(await hasOutwardLinks(tree({ [ROOT]: many }).host, ROOT, 5)).toBe(false)
  expect(await hasOutwardLinks(tree({ [ROOT]: [...many, file('one-more.ts')] }).host, ROOT, 5)).toBe(true)
})
