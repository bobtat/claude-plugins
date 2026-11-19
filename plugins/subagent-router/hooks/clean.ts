function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  try {
    return String(value)
  } catch {
    return ''
  }
}

// These can hide, reorder or forge text once it is shown: C0/C1 controls, soft hyphen, Arabic letter
// mark, zero-width and bidi marks and overrides, invisible operators, BOM and tag characters. With the
// u flag a surrogate class member matches only an unpaired one, so valid pairs such as emoji survive.
const HIDDEN = /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u{E0000}-\u{E007F}\uD800-\uDFFF]/gu

const STACKED_MARKS = /(\p{M}{3})\p{M}+/gu

export function clean(text: unknown, max: number): string {
  // \s already covers U+2028 and U+2029. Whitespace becomes a space before hidden characters go, so
  // "one\ntwo" keeps its break; spaces are collapsed after, so a removed character leaves no double space.
  const spaced = asText(text).replace(/\s/gu, ' ')
  // Marks are capped after hidden characters go, so a removed character cannot join two runs into a longer one.
  // Some terminals draw a tall stack of marks over the rows around it.
  const visible = spaced.replace(HIDDEN, '').replace(STACKED_MARKS, '$1').replace(/ {2,}/gu, ' ').trim()
  const points = Array.from(visible)
  if (points.length <= max) return visible
  return points.slice(0, Math.max(0, max - 1)).join('') + '…'
}

export function hasHidden(text: unknown): boolean {
  const raw = asText(text)
  return raw.replace(HIDDEN, '') !== raw
}

export const ID_MAX = 80

export const cleanId = (value: unknown): string | null => clean(value, ID_MAX) || null
