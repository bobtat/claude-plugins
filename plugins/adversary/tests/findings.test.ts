import { expect, test } from 'claude-code/testing'

import type { Finding, Review } from '../types'
import { draftText, parseFindings, relativeTo, savedMarkdown, sortBySeverity } from '../hooks/findings'

const block = (body: unknown) => '```json\n' + (typeof body === 'string' ? body : JSON.stringify(body)) + '\n```'

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: 1,
  severity: 'high',
  location: { file: 'src/a.cs', line: 88 },
  claim: 'Null dereference',
  evidence: 'x is never checked',
  decision: 'undecided',
  ...over,
})

const raw = (over: object = {}) => ({
  severity: 'high',
  location: { file: 'src/a.cs', line: 1 },
  claim: 'c',
  evidence: 'e',
  ...over,
})

test('takes the last json block', async () => {
  const output = [
    'first',
    block({ findings: [raw({ claim: 'old' })] }),
    'second',
    block({ findings: [raw({ claim: 'new' })] }),
  ].join('\n')

  const result = parseFindings(output, 'C:/tmp')

  expect(result.ok && result.findings.map(f => f.claim)).toEqual(['new'])
})

test('valid findings get ids from 1 and decision undecided', async () => {
  const result = parseFindings(block({ findings: [raw(), raw({ severity: 'low' })] }), 'C:/tmp')

  expect(result.ok && result.findings.map(f => [f.id, f.decision])).toEqual([
    [1, 'undecided'],
    [2, 'undecided'],
  ])
})

test('an invalid finding goes to unparsed with its raw text', async () => {
  const result = parseFindings(block({ findings: [raw({ severity: 'urgent' }), raw({ claim: 'fine' })] }), 'C:/tmp')

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.findings.map(f => f.claim)).toEqual(['fine'])
  expect(result.unparsed).toHaveLength(1)
  expect(result.unparsed[0].raw).toContain('"urgent"')
  expect(result.unparsed[0].reason).toContain('severity')
})

test('empty findings array is ok', async () => {
  expect(parseFindings(block({ findings: [] }), 'C:/tmp')).toEqual({ ok: true, findings: [], unparsed: [] })
})

test('no json block is an error', async () => {
  expect(parseFindings('nothing fenced here', 'C:/tmp')).toEqual({ ok: false, error: 'no json block' })
})

test('malformed JSON in the last block is one unparsed entry', async () => {
  const result = parseFindings(block('{ "findings": [ oops'), 'C:/tmp')

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.findings).toEqual([])
  expect(result.unparsed).toHaveLength(1)
})

test('absolute file paths become relative to the root', async () => {
  const output = block({
    findings: [
      raw({ location: { file: 'C:\\tmp\\adv-1\\src\\a.cs', line: 3 } }),
      raw({ location: { file: 'c:/tmp/adv-1/src/b.cs' } }),
      raw({ location: { file: 'D:/elsewhere/c.cs' } }),
    ],
  })

  const result = parseFindings(output, 'C:/tmp/adv-1')

  expect(result.ok && result.findings.map(f => f.location)).toEqual([
    { file: 'src/a.cs', line: 3 },
    { file: 'src/b.cs' },
    { file: 'D:/elsewhere/c.cs' },
  ])
  expect(relativeTo('C:/tmp/adv-1', 'C:/tmp/adv-1-other/x.cs')).toBe('C:/tmp/adv-1-other/x.cs')
})

test('sorts critical, high, medium, low, stable within a severity', async () => {
  const sorted = sortBySeverity([
    finding({ id: 1, severity: 'low' }),
    finding({ id: 2, severity: 'high' }),
    finding({ id: 3, severity: 'critical' }),
    finding({ id: 4, severity: 'high' }),
    finding({ id: 5, severity: 'medium' }),
  ])

  expect(sorted.map(f => f.id)).toEqual([3, 2, 4, 5, 1])
})

test('draft numbers only send findings, uses editedClaim when present', async () => {
  const text = draftText([
    finding({ id: 1, severity: 'critical', decision: 'send' }),
    finding({ id: 2, decision: 'drop' }),
    finding({ id: 3, decision: 'undecided' }),
    finding({
      id: 4,
      severity: 'low',
      location: { section: 'Rollout' },
      claim: 'original',
      editedClaim: 'edited',
      evidence: 'no rollback',
      decision: 'send',
    }),
  ])

  expect(text).toBe(
    [
      'An independent reviewer raised these findings. For each one, either fix it or reject it with a specific reason. Do not skip any.',
      '',
      '1. [CRITICAL] src/a.cs:88 — Null dereference',
      '   Evidence: x is never checked',
      '2. [LOW] § Rollout — edited',
      '   Evidence: no rollback',
    ].join('\n'),
  )
})

test('saved markdown lists every finding with its decision and keeps the original claim beside an edit', async () => {
  const review: Review = {
    kind: 'pr',
    target: '42',
    root: 'C:/repo',
    status: 'done',
    findings: [
      finding({ id: 1, decision: 'send', claim: 'original', editedClaim: 'edited' }),
      finding({ id: 2, severity: 'low', decision: 'drop', claim: 'minor' }),
      finding({ id: 3, severity: 'medium', decision: 'undecided', claim: 'maybe' }),
    ],
    unparsed: [],
    raw: '',
    startedAt: 0,
  }

  const md = savedMarkdown(review, '2026-10-15')

  expect(md).toContain('2026-10-15')
  expect(md).toContain('edited')
  expect(md).toContain('original')
  expect(md).toContain('minor')
  expect(md).toContain('maybe')
  expect(md).toMatch(/send/)
  expect(md).toMatch(/drop/)
  expect(md).toMatch(/undecided/)
})
