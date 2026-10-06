import { expect, mock, test } from 'claude-code/testing'

import { addSpend, addUsage, budgetAlert, cacheMinutesLeft, exportCsv, projectName, summarize } from '../hooks/ledger'
import { priceUsage, rateTable, ratesFor } from '../hooks/pricing'

const NOW = new Date(2026, 9, 6, 12).getTime()
const OPUS = ratesFor(rateTable(''), 'claude-opus-5-5')

const priced = (cacheWrite: number) =>
  priceUsage(
    { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: cacheWrite },
    OPUS,
    '5m',
  )

test('spend and cache writes are attributed to the project the session ran in', async () => {
  const api = addUsage(addSpend(undefined, NOW, 3, 'C:/work/billing-api'), NOW, priced(200_000), 'C:/work/billing-api', false)
  const web = addSpend(undefined, NOW, 1, 'C:/work/web')

  const s = summarize([api, web], NOW)

  expect(s.projectDays['C:/work/billing-api']?.['2026-10-06']).toEqual({ usd: 3, cacheWriteUsd: 1 })
  expect(s.projectDays['C:/work/web']?.['2026-10-06']).toEqual({ usd: 1, cacheWriteUsd: 0 })
})

test('a project is named by the last folder of its root, on either separator', async () => {
  expect(projectName('C:\\Users\\someone\\billing-api')).toBe('billing-api')
  expect(projectName('/home/someone/web/')).toBe('web')
})

test('subagent requests count toward the total and are also kept apart', async () => {
  let entry = addUsage(undefined, NOW, priced(200_000), 'p', false)
  entry = addUsage(entry, NOW, priced(400_000), 'p', true)

  const s = summarize([entry], NOW)

  expect(s.cacheDays['2026-10-06']?.tokens.cacheWrite).toBe(600_000)
  expect(s.subagentDays['2026-10-06']?.tokens.cacheWrite).toBe(400_000)
})

test('a budget announces 80% and 100% once each', async () => {
  expect(budgetAlert(7, 10, 0)).toBeNull()
  expect(budgetAlert(8, 10, 0)).toBe(0.8)
  expect(budgetAlert(9, 10, 0.8)).toBeNull()
  expect(budgetAlert(12, 10, 0.8)).toBe(1)
  expect(budgetAlert(15, 10, 1)).toBeNull()
  expect(budgetAlert(15, 0, 0)).toBeNull()
})

test('the cache countdown rounds up and stops at zero', async () => {
  expect(cacheMinutesLeft(NOW, 5 * 60_000, NOW + 30_000)).toBe(5)
  expect(cacheMinutesLeft(NOW, 5 * 60_000, NOW + 4 * 60_000 + 1)).toBe(1)
  expect(cacheMinutesLeft(NOW, 5 * 60_000, NOW + 6 * 60_000)).toBe(0)
})

test('the export has one row per day and project, quoting paths that need it', async () => {
  const entry = addUsage(addSpend(undefined, NOW, 2.5, 'C:/work/a, b'), NOW, priced(200_000), 'C:/work/a, b', true)

  const lines = exportCsv([entry]).trimEnd().split('\n')

  expect(lines).toHaveLength(2)
  expect(lines[0]).toMatch(/^date,project,total_usd,input_tokens,/)
  expect(lines[1]).toMatch(/^2026-10-06,"C:\/work\/a, b",2\.5000,0,0,0,200000,0\.0000,0\.0000,0\.0000,1\.0000,1\.0000$/)
})

const measure = (usd: number) => ({
  context: { window: 200_000 },
  rateLimits: [],
  cost: { usd },
  changed: ['cost' as const],
})

test('a weekly budget toasts at 80% and again when reached', { options: { weeklyBudget: 10 } }, async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('session.id', () => ({ value: 'test-session' }))
  on('session.root', () => ({ value: 'C:/work/billing-api' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))

  await $.session.measure(measure(8.5))
  await $.session.measure(measure(9))
  expect(toasts).toEqual(['Weekly budget at 80%: $8.50 of $10.00.'])

  await $.session.measure(measure(10.5))
  expect(toasts.at(-1)).toBe('Weekly budget reached: $10.50 of $10.00.')
})

test('/costs export writes the CSV under the home folder', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on, { 'session:earlier': addSpend(undefined, NOW, 2, 'C:/work/web') })
  mock.env(on, { USERPROFILE: 'C:\\Users\\someone' })
  const written: { path: string; text: string }[] = []
  on('fs.write', (_$, e) => {
    written.push(e)
    return { value: undefined }
  })

  const result = await $.command.run({
    command: 'costs',
    args: 'export',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  })

  expect(written).toHaveLength(1)
  expect(written[0]?.path).toMatch(/^C:[\\/]Users[\\/]someone[\\/]claude-costs[\\/]claude-costs-2026-10-06\.csv$/)
  expect(written[0]?.text).toMatch(/^2026-10-06,C:\/work\/web,2\.0000,/m)
  expect(result).toMatchObject({ text: expect.stringContaining('Wrote 1 rows') })
})

test('the band counts the cache down and then shows it cold', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('session.id', () => ({ value: 'test-session' }))
  on('session.root', () => ({ value: 'C:/work/billing-api' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        input_tokens: 1_000,
        output_tokens: 1_000,
        cache_read_input_tokens: 100_000,
        cache_creation_input_tokens: 1_000,
        model: 'claude-opus-5-5',
      },
    }
  })

  await $.session.measure(measure(1))
  const step = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
  for await (const _ of step) {
    // the response's chunks are not under test
  }

  const band = await $.ui.mount({
    plugin: 'cost-ledger',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 120, scroll: { offset: 0, bodyRows: 3 }, view: {} },
  })
  expect(await band.find({ text: /cache warm 5m/ })).toBeDefined()

  await clock.advance(6 * 60_000)
  await band.redraw()
  expect(await band.find({ text: /cache cold/ })).toBeDefined()
})
