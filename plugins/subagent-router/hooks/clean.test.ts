import { expect, test } from 'claude-code/testing'
import { clean } from './clean'

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

test('a lone surrogate does not throw and is not shown', async () => {
  expect(clean('ok\ud800ok', 80)).toBe('okok')
})

test('a value that is not a string is shown as text and never throws', async () => {
  expect(clean(undefined, 80)).toBe('')
  expect(clean(7, 80)).toBe('7')
  expect(clean({ a: 1 }, 80).length > 0).toBe(true)
})

test('removing a hidden character never leaves a run of spaces', async () => {
  expect(clean('a \u200B b\u001b\tc', 80)).toBe('a b c')
})
