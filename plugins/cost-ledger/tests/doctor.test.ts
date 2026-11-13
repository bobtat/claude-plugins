import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { complete, DAY, engine, measure, NOW, ROOT, runStep, spentSession, usage } from './support'

function doctorEngine(on: On, hostTime: (now: number) => string, stored: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(stored))
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

test('/costs doctor names only the models that still have no rate', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp, { unpricedModels: ['claude-fable-5-2', 'claude-opus-9'] })

  const report = await doctor($)

  expect(report).toMatch(/⚠ Models: no rate for claude-opus-9;/)
  expect(report).not.toMatch(/claude-fable-5-2/)
})

test('/costs doctor has nothing to say about a model that has since been given a rate', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp, { unpricedModels: ['claude-fable-5-2', 'claude-haiku-5-5'] })

  expect(await doctor($)).toMatch(/✓ Models: every model seen has a rate/)
})

test(
  '/costs doctor counts a model the rates setting names as priced',
  { options: { rates: '{"opus-9": {"input": 6, "output": 30, "cacheRead": 0.3}}' } },
  async ($, on) => {
    mock.clock(on, { now: NOW })
    engine(on)
    doctorEngine(on, localStamp, { unpricedModels: ['claude-opus-9'] })

    expect(await doctor($)).toMatch(/✓ Models: every model seen has a rate/)
  },
)

// What Claude Code quoted for a one-hour write of `tokens` on a switch to `model`.
const quoteOf = (model: string, tokens: number, usd: number, at = NOW) => ({ model, at, tokens, usd, ttl: '1h' })

test('/costs doctor says the prices have not been compared before any model switch', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp)

  expect(await doctor($)).toMatch(/ℹ Prices: not compared with Claude Code's yet/)
})

test('/costs doctor confirms the models Claude Code prices as the list does', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp, { writeQuotes: [quoteOf('claude-fable-5-2', 50_000, 0.8), quoteOf('claude-opus-5-5', 50_000, 0.4)] })

  expect(await doctor($)).toMatch(/✓ Prices: Claude Code prices cache writes as the price list does for claude-fable-5-2, claude-opus-5-5/)
})

test('/costs doctor names a model Claude Code prices differently, with both rates', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp, { writeQuotes: [quoteOf('claude-fable-5-2', 50_000, 1), quoteOf('claude-opus-5-5', 50_000, 0.4)] })

  const report = await doctor($)

  expect(report).toMatch(/⚠ Prices: Claude Code prices cache writes on claude-fable-5-2 at \$20 per million tokens and the price list has \$16; update the plugin/)
  expect(report).not.toMatch(/✓ Prices/)
  expect(report).not.toMatch(/Prices: .*claude-opus-5-5/)
})

test('/costs doctor reads a quote past thirty days, or anything that is not a quote, as none', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp, { writeQuotes: [quoteOf('claude-fable-5-2', 50_000, 1, NOW - 31 * DAY), null, 'claude-fable-5-2', { model: 7 }] })

  expect(await doctor($)).toMatch(/ℹ Prices: not compared with Claude Code's yet/)
})

test(
  '/costs doctor does not hold a model the rates setting reprices to Claude Code',
  { options: { rates: '{"fable-5-2": {"input": 9}}' } },
  async ($, on) => {
    mock.clock(on, { now: NOW })
    engine(on)
    doctorEngine(on, localStamp, { writeQuotes: [quoteOf('claude-fable-5-2', 50_000, 1)] })

    expect(await doctor($)).toMatch(/ℹ Prices: not compared with Claude Code's yet/)
  },
)

test('/costs doctor reports the price Claude Code quoted at a model switch', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp)
  on('classic.PreModelSwitch', () => ({}))

  await $.classic.PreModelSwitch({
    session_id: 's1',
    transcript_path: '',
    cwd: ROOT,
    from_model: 'claude-fable-5-2',
    to_model: 'claude-opus-5-5',
    requested_model: 'opus',
    source: 'command',
    context_tokens: 50_000,
    prompt_cache_warm: false,
    cache_ttl: '1h',
    estimated_cache_write_usd: 0.5,
    pricing: 'catalog',
  })

  expect(await doctor($)).toMatch(/⚠ Prices: Claude Code prices cache writes on claude-opus-5-5 at \$10 per million tokens and the price list has \$8/)
})

test("/costs doctor confirms a breakdown that accounts for the month's total", async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp, { 'session:earlier': spentSession(10, 9.5) })

  expect(await doctor($)).toMatch(/✓ Breakdown: accounts for 95% of this month's \$10\.00 total/)
})

test('/costs doctor flags a breakdown out of step with the total, and says what can cause it', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp, { 'session:earlier': spentSession(10, 5) })

  const report = await doctor($)

  expect(report).toMatch(/⚠ Breakdown: adds up to \$5\.00 against this month's \$10\.00 total \(50%\)/)
  expect(report).toMatch(/a price that has changed, .*fast mode.*requests the mod does not see/)
})

test('/costs doctor counts unpriced tokens as the first cause of a low breakdown', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  const unpriced = spentSession(10, 5)
  const day = Object.keys(unpriced.cache ?? {})[0] ?? ''
  const stored = { ...unpriced, cache: { [day]: { ...unpriced.cache?.[day], unpricedTokens: 2_000_000 } } }
  doctorEngine(on, localStamp, { 'session:earlier': stored })

  expect(await doctor($)).toMatch(/⚠ Breakdown: adds up to \$5\.00 against this month's \$10\.00 total \(50%\): 2\.0M tokens this month are from models with no rate/)
})

test('/costs doctor makes no comparison on too little spend', async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp, { 'session:earlier': spentSession(0.4, 0.1) })

  expect(await doctor($)).toMatch(/ℹ Breakdown: too little spend this month to compare with the total/)
})

test(
  '/costs doctor does not hold a breakdown at your own rates to the total',
  { options: { rates: '{"opus-5-5": {"input": 2}}' } },
  async ($, on) => {
    mock.clock(on, { now: NOW })
    engine(on)
    doctorEngine(on, localStamp, { 'session:earlier': spentSession(10, 5) })

    expect(await doctor($)).toMatch(/ℹ Breakdown: adds up to \$5\.00 against this month's \$10\.00 total \(50%\); it is priced at your rates and the total at Claude Code's/)
  },
)

test("/costs doctor does not hold a list-price breakdown to a total at your organisation's rates", async ($, on) => {
  mock.clock(on, { now: NOW })
  engine(on)
  doctorEngine(on, localStamp, { 'session:earlier': spentSession(10, 5), learnedPricing: 'configured' })

  expect(await doctor($)).toMatch(/ℹ Breakdown: adds up to \$5\.00 against this month's \$10\.00 total \(50%\); it is priced at list rates and the total at your organisation's/)
})

// One turn in which Claude Code's total moves $3.00 for a request the mod
// prices at $0.02, then $1.50 more after the turn with no request to show.
async function turnThenUnseenSpend($: Engine, session: { usd: number }) {
  await $.turn.start({ turnId: 't1', text: 'read the billing module' })
  session.usd = 3
  await runStep($, 't1')
  await $.turn.complete(complete('t1'))
  session.usd = 4.5
  await $.session.measure(measure(4.5))
}

test('/costs doctor sets the total against the breakdown inside turns and outside them', async ($, on) => {
  mock.clock(on, { now: NOW })
  const session = { usd: 0 }
  engine(on, [usage(100_000, 0)], 'claude-opus-5-5', session)
  doctorEngine(on, localStamp)

  await turnThenUnseenSpend($, session)

  expect(await doctor($)).toMatch(/ℹ Turns: during turns the total moved \$3\.00 and the breakdown has \$0\.02; outside them, \$1\.50 against \$0\.00/)
})

test('/costs doctor leaves a session begun under an earlier version out of the turn figures', async ($, on) => {
  mock.clock(on, { now: NOW })
  const session = { usd: 0 }
  engine(on, [usage(100_000, 0)], 'claude-opus-5-5', session)
  doctorEngine(on, localStamp, { 'session:s1': { project: ROOT, days: {}, updatedAt: NOW } })

  await turnThenUnseenSpend($, session)

  expect(await doctor($)).not.toMatch(/Turns:/)
})

test(
  '/costs doctor gives no turn figures where the breakdown and the total are priced apart',
  { options: { rates: '{"opus-5-5": {"input": 2}}' } },
  async ($, on) => {
    mock.clock(on, { now: NOW })
    const session = { usd: 0 }
    engine(on, [usage(100_000, 0)], 'claude-opus-5-5', session)
    doctorEngine(on, localStamp)

    await turnThenUnseenSpend($, session)

    expect(await doctor($)).not.toMatch(/Turns:/)
  },
)
