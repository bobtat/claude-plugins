import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { complete, engine, memoryStore, NOW, ROOT, runStep, usage } from './support'

// Each request writes 100,000 tokens to the cache on Opus 5.5: $0.80 at the
// one-hour rate and $0.50 at the five-minute rate. The toast for a large
// write shows which one the request was priced at.
const WRITE = usage(0, 100_000)
const AT_1H = /wrote 100k tokens .*≈ \$0\.80 on/
const AT_5M = /wrote 100k tokens .*≈ \$0\.50 on/

function sessionEngine(on: On, stored: Record<string, unknown> = {}) {
  mock.clock(on, { now: NOW })
  const store = memoryStore(on, stored)
  const session = { usd: 0 }
  const toasts = engine(on, [WRITE, WRITE, WRITE, WRITE], 'claude-opus-5-5', session)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('classic.PreModelSwitch', () => ({}))
  const writes = () => toasts.filter(t => t.includes('wrote 100k tokens'))
  return { store, session, writes }
}

const startInteractive = ($: Engine) => $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
const startHeadless = ($: Engine) => $.session.start({ cwd: ROOT, surface: null, isInteractive: false })

// A turn whose one request Claude Code charged at the one-hour rate.
async function turnChargedAt1h($: Engine, session: { usd: number }, turnId: string) {
  await $.turn.start({ turnId, text: 'read the billing module' })
  session.usd += 0.8
  await runStep($, turnId)
  await $.turn.complete(complete(turnId))
}

const reportedAtSwitch = ($: Engine, cache_ttl: '5m' | '1h') =>
  $.classic.PreModelSwitch({
    session_id: 's1',
    transcript_path: '',
    cwd: ROOT,
    from_model: 'claude-sonnet-5-5',
    to_model: 'claude-opus-5-5',
    requested_model: 'opus',
    source: 'command',
    context_tokens: 0,
    prompt_cache_warm: false,
    cache_ttl,
    estimated_cache_write_usd: 0,
    pricing: 'catalog',
  })

test('a session keeps the lifetime its own turn showed when another session stores a different one', async ($, on) => {
  const { store, session, writes } = sessionEngine(on)
  await startInteractive($)
  await turnChargedAt1h($, session, 't1')

  store.set('learnedCacheTtl', '5m')
  await runStep($, 't2')

  expect(writes()).toHaveLength(2)
  expect(writes()[0]).toMatch(AT_5M)
  expect(writes()[1]).toMatch(AT_1H)
})

test('a session that has learned nothing yet starts from what earlier sessions of its kind stored', async ($, on) => {
  const { writes } = sessionEngine(on, { learnedCacheTtl: '1h' })
  await startInteractive($)

  await runStep($, 't1')

  expect(writes()[0]).toMatch(AT_1H)
})

test('a headless session does not start from what interactive sessions learned', async ($, on) => {
  const { writes } = sessionEngine(on, { learnedCacheTtl: '1h' })
  await startHeadless($)

  await runStep($, 't1')

  expect(writes()[0]).toMatch(AT_5M)
})

test('an interactive session does not start from what headless sessions learned', async ($, on) => {
  const { writes } = sessionEngine(on, { learnedCacheTtlHeadless: '1h' })
  await startInteractive($)

  await runStep($, 't1')

  expect(writes()[0]).toMatch(AT_5M)
})

test('what a headless session learns is stored for headless sessions alone', async ($, on) => {
  const { store, session } = sessionEngine(on, { learnedCacheTtl: '5m' })
  await startHeadless($)

  await turnChargedAt1h($, session, 't1')

  expect(store.get('learnedCacheTtlHeadless')).toBe('1h')
  expect(store.get('learnedCacheTtl')).toBe('5m')
})

test('what an interactive session learns is stored for interactive sessions alone', async ($, on) => {
  const { store, session } = sessionEngine(on, { learnedCacheTtlHeadless: '5m' })
  await startInteractive($)

  await turnChargedAt1h($, session, 't1')

  expect(store.get('learnedCacheTtl')).toBe('1h')
  expect(store.get('learnedCacheTtlHeadless')).toBe('5m')
})

test('the lifetime Claude Code reports at a model switch becomes the session’s own', async ($, on) => {
  const { store, writes } = sessionEngine(on)
  await startInteractive($)

  await reportedAtSwitch($, '1h')
  store.set('learnedCacheTtl', '5m')
  await runStep($, 't1')

  expect(writes()[0]).toMatch(AT_1H)
})

test('a later turn or switch replaces what the session learned before', async ($, on) => {
  const { session, writes } = sessionEngine(on)
  await startInteractive($)
  await turnChargedAt1h($, session, 't1')

  await reportedAtSwitch($, '5m')
  await runStep($, 't2')

  expect(writes()[1]).toMatch(AT_5M)
})

test('the cacheTtl setting decides over what was learned or stored', { options: { cacheTtl: '5m' } }, async ($, on) => {
  const { writes } = sessionEngine(on, { learnedCacheTtl: '1h' })
  await startInteractive($)
  await reportedAtSwitch($, '1h')

  await runStep($, 't1')

  expect(writes()[0]).toMatch(AT_5M)
})
