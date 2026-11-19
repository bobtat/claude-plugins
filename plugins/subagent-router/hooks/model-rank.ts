import type { Family } from '../types'

const ORDER: readonly Family[] = ['haiku', 'sonnet', 'opus', 'fable']

// Mythos is the Fable tier under its model-id name. A word counts only where no letter touches it, so a word
// that merely contains one ("affable") names no family; digits, dots and dashes may touch it, as in ids.
const WORDS: ReadonlyArray<readonly [RegExp, Family]> = [
  [/(?<![a-z])haiku(?![a-z])/, 'haiku'],
  [/(?<![a-z])sonnet(?![a-z])/, 'sonnet'],
  [/(?<![a-z])opus(?![a-z])/, 'opus'],
  [/(?<![a-z])fable(?![a-z])/, 'fable'],
  [/(?<![a-z])mythos(?![a-z])/, 'fable'],
]

export function familyOf(modelId: string): Family | undefined {
  if (typeof modelId !== 'string') return undefined
  const id = modelId.toLowerCase()
  const found = new Set<Family>()
  for (const [word, family] of WORDS) if (word.test(id)) found.add(family)
  return found.size === 1 ? [...found][0] : undefined
}

export function ranksBelow(a: string | undefined, b: string | undefined): boolean {
  const fa = a === undefined ? undefined : familyOf(a)
  const fb = b === undefined ? undefined : familyOf(b)
  if (fa === undefined || fb === undefined) return false
  return ORDER.indexOf(fa) < ORDER.indexOf(fb)
}
