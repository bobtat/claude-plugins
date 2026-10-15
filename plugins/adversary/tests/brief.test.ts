import { expect, test } from 'claude-code/testing'

import { classifyBrief, fetchBrief } from '../hooks/brief'
import { atlassian, fakeHost, gh } from './support'

test('classifies PROJ-123 and AB2-7 as jira', async () => {
  expect(classifyBrief('PROJ-123')).toEqual({ kind: 'jira', key: 'PROJ-123' })
  expect(classifyBrief('AB2-7')).toEqual({ kind: 'jira', key: 'AB2-7' })
})

test('does not classify near-misses as jira', async () => {
  for (const value of ['proj-123', 'PROJ-', 'PROJ-123 is broken', '-123']) {
    expect(classifyBrief(value)).toEqual({ kind: 'text', text: value })
  }
})

test('classifies #45 and https://github.com/o/r/issues/45 as github', async () => {
  expect(classifyBrief('#45')).toEqual({ kind: 'github', ref: '45' })
  expect(classifyBrief('https://github.com/o/r/issues/45')).toEqual({ kind: 'github', ref: 'https://github.com/o/r/issues/45' })
})

test('a pull request URL is text', async () => {
  const url = 'https://github.com/o/r/pull/45'
  expect(classifyBrief(url)).toEqual({ kind: 'text', text: url })
})

test('fetches a jira issue through the atlassian server', async () => {
  const host = fakeHost(atlassian({ 'PROJ-123': { summary: 'Refund fails', description: 'Steps to reproduce' } }))

  const result = await fetchBrief(host, { kind: 'jira', key: 'PROJ-123' })

  expect(result).toEqual({ ok: true, brief: { label: 'PROJ-123', text: 'PROJ-123: Refund fails\n\nSteps to reproduce' } })
})

test('jira without a connected atlassian server returns the verbatim Jira not connected message', async () => {
  const result = await fetchBrief(fakeHost(atlassian('absent')), { kind: 'jira', key: 'PROJ-123' })

  expect(result).toEqual({ ok: false, error: 'Jira not connected; paste the ticket with --brief "..."' })
})

test('fetches a github issue through gh', async () => {
  const host = fakeHost(gh({ 'gh issue view 45 --json title,body': { exitCode: 0, stdout: JSON.stringify({ title: 'Crash on save', body: 'It crashes.' }) } }))

  const result = await fetchBrief(host, { kind: 'github', ref: '45' })

  expect(result).toEqual({ ok: true, brief: { label: '#45', text: '#45: Crash on save\n\nIt crashes.' } })
})

test('a github issue URL is labelled with its number', async () => {
  const host = fakeHost(gh({ 'gh issue view https://github.com/o/r/issues/45': { exitCode: 0, stdout: JSON.stringify({ title: 'T', body: 'B' }) } }))

  const result = await fetchBrief(host, { kind: 'github', ref: 'https://github.com/o/r/issues/45' })

  expect(result).toEqual({ ok: true, brief: { label: '#45', text: '#45: T\n\nB' } })
})

test('gh failing returns the verbatim gh is not available message', async () => {
  const host = fakeHost(gh({ 'gh issue view': { exitCode: 1, stdout: '', stderr: 'auth' } }))

  const result = await fetchBrief(host, { kind: 'github', ref: '45' })

  expect(result).toEqual({ ok: false, error: 'gh is not available: run gh auth login' })
})

test('text is returned as the brief with label pasted brief', async () => {
  const result = await fetchBrief(fakeHost(), { kind: 'text', text: 'Make refunds idempotent' })

  expect(result).toEqual({ ok: true, brief: { label: 'pasted brief', text: 'Make refunds idempotent' } })
})
