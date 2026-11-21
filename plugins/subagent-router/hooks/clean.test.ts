import { expect, test } from 'claude-code/testing'
import { ID_MAX, clean, cleanId, cleanMiddle } from './clean'

const LONE = /[\uD800-\uDFFF]/u   // with the u flag this matches only an unpaired surrogate

test('control, escape, bidi and invisible characters are removed', async () => {
  expect(clean('a\u001b[31mb\u0007c', 80)).toBe('a[31mbc')
  expect(clean('x\u202Ey\u200Bz\u2066w', 80)).toBe('xyzw')
  expect(clean('a\u061Cb\u00ADc\u2060d\u{E0041}e', 80)).toBe('abcde')
})

test('newlines, tabs and line separators become single spaces and the result is one line', async () => {
  expect(clean('one\r\ntwo\tthree\n\nfour\u2028five\u2029six', 80)).toBe('one two three four five six')
})

test('long text is capped by code points and marked', async () => {
  expect(clean('abcdefghij', 6)).toBe('abcde…')
  const out = clean('😀'.repeat(10), 6)
  expect(Array.from(out).length).toBe(6)
  expect(LONE.test(out)).toBe(false)
})

const ARN = 'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/us.anthropic.claude-'
const ELLIPSIS = String.fromCodePoint(0x2026)

test('an over-long model id keeps its head and its tail around one ellipsis, within the limit', async () => {
  const haiku = cleanId(ARN + 'haiku-5-5-20261101-v1:0')
  const opus = cleanId(ARN + 'opus-5-5-20261101-v1:0')
  expect(haiku !== opus).toBe(true)
  for (const id of [haiku, opus]) {
    expect(Array.from(id ?? '').length).toBe(ID_MAX)
    expect(id?.startsWith('arn:aws:')).toBe(true)
    expect(id?.split(ELLIPSIS).length).toBe(2)
  }
  expect(haiku?.endsWith('haiku-5-5-20261101-v1:0')).toBe(true)
  expect(cleanMiddle('abcdefghij', 7)).toBe('ab' + ELLIPSIS + 'ghij')
  expect(cleanMiddle('abcdefg', 7)).toBe('abcdefg')
  expect(cleanId('claude-opus-5-5')).toBe('claude-opus-5-5')
  expect(cleanId('')).toBe(null)
})

test('a lone surrogate does not throw and is not shown', async () => {
  expect(clean('ok\ud800ok', 80)).toBe('okok')
})

test('a value that is not a string is shown as text and never throws', async () => {
  expect(clean(undefined, 80)).toBe('')
  expect(clean(7, 80)).toBe('7')
  expect(clean({ a: 1 }, 80).length > 0).toBe(true)
})

test('no more than three combining marks in a run survive', async () => {
  const stacked = 'a' + String.fromCharCode(0x0301).repeat(500) + 'b'
  expect(clean(stacked, 80)).toBe('a' + String.fromCharCode(0x0301).repeat(3) + 'b')
  // A removed character between two runs does not let them join into a longer one.
  const split = 'a' + '\u0301\u0302\u0303\u200B\u0304\u0305' + 'b'
  expect(clean(split, 80)).toBe('a\u0301\u0302\u0303b')
})

test('an accented word, a flag and a skin-tone emoji are unchanged', async () => {
  for (const text of ['caf\u00E9', 'cafe\u0301', 'Vie\u0302\u0323t', '\u{1F1EC}\u{1F1E7}', '\u{1F44D}\u{1F3FD}', '\u2764\uFE0F']) {
    expect(clean(text, 80)).toBe(text)
  }
})

test('removing a hidden character never leaves a run of spaces', async () => {
  expect(clean('a \u200B b\u001b\tc', 80)).toBe('a b c')
})
