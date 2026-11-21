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

// The five ASCII whitespace controls are ordinary whitespace that clean turns into a space, so they do not count as
// hidden. Other whitespace, such as U+FEFF, still does.
export function hasHidden(text: unknown): boolean {
  const raw = asText(text).replace(/[\t\n\v\f\r]/gu, ' ')
  return raw.replace(HIDDEN, '') !== raw
}

// A value that is not text, as JSON, so ["route"] is not shown as route. Uncleaned: the caller cleans it.
export function jsonOf(value: unknown): string {
  try {
    const text = JSON.stringify(value)
    return typeof text === 'string' ? text : asText(value)
  } catch {
    return asText(value)
  }
}

// A model id can carry its name at its tail (a Bedrock ARN ends with the profile), so an over-long one keeps a third of
// the limit from its head and the rest from its tail, around one ellipsis.
export function cleanMiddle(text: unknown, max: number): string {
  const visible = clean(text, Number.MAX_SAFE_INTEGER)
  const points = Array.from(visible)
  if (points.length <= max) return visible
  const head = Math.floor((max - 1) / 3)
  const tail = Math.max(0, max - 1 - head)
  return points.slice(0, head).join('') + '…' + points.slice(points.length - tail).join('')
}

export const ID_MAX = 80

export const cleanId = (value: unknown): string | null => cleanMiddle(value, ID_MAX) || null
