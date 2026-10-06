import { expect, mock, test } from 'claude-code/testing'

const NOW = new Date(2026, 9, 6, 12).getTime()

const PANE = {
  plugin: 'cost-ledger',
  component: 'Pane',
  requestId: 'cost-ledger',
  props: {
    title: 'Costs',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('the calendar shows this month and steps back and forth between months', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on, { 'session:earlier': { days: { '2026-09-14': 3 }, updatedAt: NOW } })
  on('session.id', () => ({ value: 'test-session' }))
  on('session.root', () => ({ value: 'C:/work/billing-api' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))

  await $.session.measure({
    context: { window: 200000 },
    rateLimits: [],
    cost: { usd: 2 },
    changed: ['cost'],
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ text: /October 2026/ })).toBeDefined()
    expect(await ui.find({ key: 'next' })).toBeUndefined()

    expect(await ui.find({ text: /\$2\.00 total/ })).toBeDefined()

    await ui.press({ key: 'prev' })
    expect(await ui.find({ text: /September 2026/ })).toBeDefined()
    expect(await ui.find({ text: /\$3\.00 total/ })).toBeDefined()

    await ui.press({ key: 'next' })
    expect(await ui.find({ text: /October 2026/ })).toBeDefined()

    await ui.unmount()
  }
})
