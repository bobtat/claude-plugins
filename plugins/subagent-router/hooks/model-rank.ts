import type { Family } from '../types'

const ORDER: readonly Family[] = ['haiku', 'sonnet', 'opus', 'fable']

// Mythos is the Fable tier under its model-id name.
const WORDS: ReadonlyArray<readonly [string, Family]> = [
  ['haiku', 'haiku'],
  ['sonnet', 'sonnet'],
  ['opus', 'opus'],
  ['fable', 'fable'],
  ['mythos', 'fable'],
]

export function familyOf(modelId: string): Family | undefined {
  if (typeof modelId !== 'string') return undefined
  const id = modelId.toLowerCase()
  const found = new Set<Family>()
  for (const [word, family] of WORDS) if (id.includes(word)) found.add(family)
  return found.size === 1 ? [...found][0] : undefined
}

export function ranksBelow(a: string | undefined, b: string | undefined): boolean {
  const fa = a === undefined ? undefined : familyOf(a)
  const fb = b === undefined ? undefined : familyOf(b)
  if (fa === undefined || fb === undefined) return false
  return ORDER.indexOf(fa) < ORDER.indexOf(fb)
}
