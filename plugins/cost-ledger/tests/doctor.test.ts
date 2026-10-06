import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { engine, NOW } from './support'

function doctorEngine(on: On, hostTime: (now: number) => string) {
  const store = new Map<string, unknown>()
  const dir = 'C:/Users/someone/.claude/plugins/store'
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.delete', (_$, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  mock.env(on, { USERPROFILE: 'C:/Users/someone', OS: 'Windows_NT' })
  on('process.run', () => ({
    value: { exitCode: 0, stdout: `${hostTime(NOW)}\r\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('fs.list', () => ({
    value: [{ name: 'cost-ledger_inline-abc.json', kind: 'file', size: 10, mtimeMs: NOW, isLink: false }],
  }))
  // The engine hands the path on in the platform's own spelling.
  on('fs.read', (_$, e) => ({
    value: e.path.replace(/\\/g, '/') === `${dir}/cost-ledger_inline-abc.json` ? JSON.stringify(Object.fromEntries(store)) : '',
  }))
}

const localStamp = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} ${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
}

const doctor = async ($: Engine) => {
  const result = await $.command.run({
    command: 'costs',
    args: 'doctor',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })
  return 'text' in result ? String(result.text) : ''
}

test('/costs doctor confirms a matching clock and a store this session sees whole', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp)

  const report = await doctor($)

  expect(report).toMatch(/✓ Time zone/)
  expect(report).toMatch(/✓ Store file: writes reach disk at once/)
  expect(report).toMatch(/✓ Other sessions/)
  expect(report).toMatch(/ℹ Claude Code pricing: not reported yet/)
})

test('/costs doctor flags a clock that splits days at the wrong hour', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, now => localStamp(now + 5 * 60 * 60 * 1000).replace(/[+-]\d{2}:\d{2}$/, '+09:00'))

  const report = await doctor($)

  expect(report).toMatch(/⚠ Time zone: the mod sees .* but the host says/)
})
