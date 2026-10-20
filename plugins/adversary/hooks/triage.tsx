import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { Decision, Finding, Review, Severity } from '../types'
import { removeWorktree } from './artifact'
import { draftText, relativeTo, savedMarkdown, whereText } from './findings'
import { failure, hostFrom } from './host'
import type { Host } from './host'

type Api = EngineInterface

export const PANE = 'adversary'

const reviewState = atom({ plugin: 'adversary', key: 'review' } as const, null)
const selectedState = atom({ plugin: 'adversary', key: 'selected' } as const, 0)
const editingState = atom({ plugin: 'adversary', key: 'editing' } as const, false)

const NOTHING_TO_SEND = 'Nothing to send — mark findings with s first'
const REVIEW_OPENING = 'An independent reviewer raised these findings.'
const REVIEWS_DIR = '.claude/adversary/reviews'

const SHORT: Record<Severity, string> = { critical: 'CRIT', high: 'HIGH', medium: 'MED', low: 'LOW' }
const MARK: Record<Decision, string> = { send: '✓', drop: '✗', undecided: '·' }

const claimOf = (finding: Finding) => finding.editedClaim ?? finding.claim
const sends = (review: Review) => review.findings.filter(finding => finding.decision === 'send')

export function paneTitle(review: Review): string {
  const target = review.kind === 'pr' ? `PR #${review.pr?.number ?? review.target}` : review.kind === 'plan' ? 'plan' : review.target
  return ['Adversary', target, review.briefLabel, review.model ?? 'session'].filter(Boolean).join(' · ')
}

export function summary(findings: Finding[]): string {
  const count = (decision: Decision) => findings.filter(finding => finding.decision === decision).length
  return `${findings.length} findings · ${count('send')} send · ${count('drop')} drop · ${count('undecided')} undecided`
}

// New-side line numbers per file, read from the unified diff's hunks: a
// comment can only be placed on one of these.
export function diffLines(diff: string): Map<string, Set<number>> {
  const lines = new Map<string, Set<number>>()
  let file: Set<number> | undefined
  let line = 0
  let oldLeft = 0
  let newLeft = 0
  for (const raw of diff.split('\n')) {
    const text = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    // Inside a hunk its counts say what each line is, so a removed line that
    // reads `--- x` or an added one reading `+++ x` is never taken for a header.
    if (oldLeft > 0 || newLeft > 0) {
      const mark = text[0] ?? ' '
      if (mark === '\\') continue
      if (mark === '-') {
        oldLeft--
        continue
      }
      if (mark !== '+') oldLeft--
      newLeft--
      file?.add(line)
      line++
      continue
    }
    if (text.startsWith('diff --git ')) {
      file = undefined
    } else if (text.startsWith('+++ ')) {
      const path = text.slice(4).replace(/\t.*$/, '')
      if (path === '/dev/null') {
        file = undefined
      } else {
        const name = path.replace(/^b\//, '')
        file = lines.get(name) ?? new Set<number>()
        lines.set(name, file)
      }
    } else {
      const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(text)
      if (hunk) {
        oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1])
        line = Number(hunk[2])
        newLeft = hunk[3] === undefined ? 1 : Number(hunk[3])
      }
    }
  }
  return lines
}

export type ReviewPayload = {
  event: 'COMMENT'
  commit_id: string
  body: string
  comments: { path: string; line: number; side: 'RIGHT'; body: string }[]
}

export type StalePayload = { event: 'COMMENT'; body: string }

export function reviewPayload(review: Review, headRefOid: string, lines: Map<string, Set<number>>): ReviewPayload {
  const comments: ReviewPayload['comments'] = []
  const rest: Finding[] = []
  for (const finding of sends(review)) {
    const { location } = finding
    if ('file' in location && location.line !== undefined) {
      const path = relativeTo(review.root, location.file).replace(/\\/g, '/')
      if (lines.get(path)?.has(location.line)) {
        comments.push({ path, line: location.line, side: 'RIGHT', body: `${claimOf(finding)}\n\nEvidence: ${finding.evidence}` })
        continue
      }
    }
    rest.push(finding)
  }
  const listed = numbered(rest)
  const body = [REVIEW_OPENING, ...(listed.length > 0 ? ['', ...listed] : [])].join('\n')
  return { event: 'COMMENT', commit_id: headRefOid, body, comments }
}

// The PR moved on since the review (or its head could not be read): line
// numbers from the reviewed commit may point at other code now, so nothing is
// anchored to a commit or a line.
export function staleReviewPayload(review: Review, reviewedOid: string): StalePayload {
  const opening = `The PR has new commits since this review (reviewed ${reviewedOid.slice(0, 7)}).`
  return { event: 'COMMENT', body: [opening, '', ...numbered(sends(review))].join('\n') }
}

const numbered = (findings: Finding[]) =>
  findings.flatMap((finding, index) => [
    `${index + 1}. [${finding.severity.toUpperCase()}] ${whereText(finding.location)} — ${claimOf(finding)}`,
    `   Evidence: ${finding.evidence}`,
  ])

async function currentHead(host: Host, number: number, cwd: string): Promise<string | undefined> {
  const viewed = await host.run(['gh', 'pr', 'view', String(number), '--json', 'headRefOid'], { cwd })
  if (viewed.exitCode !== 0) return undefined
  try {
    const head = (JSON.parse(viewed.stdout) as { headRefOid?: unknown }).headRefOid
    return typeof head === 'string' ? head : undefined
  } catch {
    return undefined
  }
}

export async function postReview(host: Host, review: Review, cwd: string): Promise<string> {
  if (review.pr === undefined) return 'Post failed: not a pull request review'
  const { number, headRefOid } = review.pr
  try {
    let payload: ReviewPayload | StalePayload
    if ((await currentHead(host, number, cwd)) === headRefOid) {
      const diff = await host.run(['gh', 'pr', 'diff', String(number)], { cwd })
      if (diff.exitCode !== 0) return `Post failed: ${failure(diff)}`
      payload = reviewPayload(review, headRefOid, diffLines(diff.stdout))
    } else {
      payload = staleReviewPayload(review, headRefOid)
    }
    const posted = await host.run(['gh', 'api', `repos/{owner}/{repo}/pulls/${number}/reviews`, '-X', 'POST', '--input', '-'], {
      cwd,
      stdin: JSON.stringify(payload),
    })
    if (posted.exitCode !== 0) return `Post failed: ${failure(posted)}`
    let url: unknown
    try {
      url = (JSON.parse(posted.stdout) as { html_url?: unknown }).html_url
    } catch {
      url = undefined
    }
    return typeof url === 'string' ? `Review posted: ${url}` : 'Review posted'
  } catch (error) {
    return `Post failed: ${error instanceof Error ? error.message : String(error)}`
  }
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// The saved file's name without `.md`: <date>-pr-<n>, <date>-plan or <date>-doc-<basename>.
export function saveName(review: Review, date: string): string {
  switch (review.kind) {
    case 'pr':
      return `${date}-pr-${review.pr?.number ?? slug(review.target)}`
    case 'plan':
      return `${date}-plan`
    case 'doc': {
      const base = review.target.split(/[\\/]/).pop() ?? ''
      return `${date}-doc-${slug(base.replace(/\.[^.]*$/, '')) || 'doc'}`
    }
  }
}

// Writes the review under <cwd>/.claude/adversary/reviews, never over an
// existing file, and returns the path written relative to `cwd`.
export async function saveReview(host: Host, review: Review, cwd: string, date: string): Promise<string> {
  const name = saveName(review, date)
  const dir = `${cwd.replace(/[\\/]+$/, '')}/${REVIEWS_DIR}`
  let file = `${name}.md`
  for (let n = 2; await host.exists(`${dir}/${file}`); n++) file = `${name}-${n}.md`
  await host.writeFile(`${dir}/${file}`, savedMarkdown(review, date))
  return `${REVIEWS_DIR}/${file}`
}

const localDate = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Opens the pane on the last review. Unasked (the review just finished) a
// pane the surface does not place is announced with a toast instead.
export async function openTriage($: Api, isAsked: boolean): Promise<string> {
  const review = await read($, reviewState)
  if (review === null) return 'No review yet'
  await update($, editingState, () => false)
  let opened: Awaited<ReturnType<Api['ui']['open']>>
  try {
    opened = await $.ui.open({ id: PANE, title: paneTitle(review), ...(isAsked ? { focus: true } : {}) })
  } catch (error) {
    opened = { isPlaced: false, reason: error instanceof Error ? error.message : String(error) } as typeof opened
  }
  if (!opened.isPlaced && !isAsked) {
    $.ui.toast(
      review.status === 'failed'
        ? `Review failed: ${review.error ?? 'unknown error'} — /adversary triage`
        : `Review done: ${review.findings.length} findings — /adversary triage`,
    )
  }
  if (!opened.isPlaced) return `The triage pane could not open: ${opened.reason}`
  return 'Triage pane opened.'
}

async function selectedIndex($: Api, review: Review): Promise<number> {
  const selected = await read($, selectedState)
  return Math.min(Math.max(selected, 0), Math.max(review.findings.length - 1, 0))
}

async function changeSelected($: Api, change: (finding: Finding) => Finding): Promise<void> {
  const review = await read($, reviewState)
  if (review === null || review.findings.length === 0) return
  const index = await selectedIndex($, review)
  const id = review.findings[index].id
  await update($, reviewState, current =>
    current === null ? current : { ...current, findings: current.findings.map(finding => (finding.id === id ? change(finding) : finding)) },
  )
}

export async function decide($: Api, decision: Decision): Promise<void> {
  await changeSelected($, finding => ({ ...finding, decision }))
}

export async function move($: Api, delta: 1 | -1): Promise<void> {
  const review = await read($, reviewState)
  if (review === null) return
  const index = await selectedIndex($, review)
  const next = Math.min(Math.max(index + delta, 0), Math.max(review.findings.length - 1, 0))
  await update($, selectedState, () => next)
}

// An empty edit, or one back to the reviewer's words, drops the edit.
export async function editClaim($: Api, text: string): Promise<void> {
  const claim = text.trim()
  await changeSelected($, ({ editedClaim: _old, ...finding }) => (claim === '' || claim === finding.claim ? finding : { ...finding, editedClaim: claim }))
  await update($, editingState, () => false)
}

async function startEdit($: Api): Promise<void> {
  await update($, editingState, () => true)
}

// The person's close mark raises ui.close too; register.tsx releases the
// worktree there. Released here as well, since a plugin's own close may not
// pass through its own hook; a second release finds nothing to do.
async function closePane($: Api): Promise<void> {
  await $.ui.close({ id: PANE })
  await releaseWorktree($, false)
}

export async function draft($: Api): Promise<void> {
  const review = await read($, reviewState)
  if (review === null) return
  if (sends(review).length === 0) return $.ui.toast(NOTHING_TO_SEND)
  const filled = await $.prompt.fill({ text: draftText(review.findings), mode: 'replace' })
  if (!filled.isFilled) $.ui.toast('The prompt box is not available; Draft did nothing')
}

export async function post($: Api): Promise<void> {
  const review = await read($, reviewState)
  if (review?.kind !== 'pr') return
  if (sends(review).length === 0) return $.ui.toast(NOTHING_TO_SEND)
  try {
    const cwd = await $.session.root()
    $.ui.toast(await postReview(hostFrom($), review, cwd))
  } catch (error) {
    $.ui.toast(`Post failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function save($: Api): Promise<void> {
  const review = await read($, reviewState)
  if (review === null) return
  try {
    const cwd = await $.session.root()
    const path = await saveReview(hostFrom($), review, cwd, localDate(await $.clock.now()))
    $.ui.toast(`Saved ${path}`)
  } catch (error) {
    $.ui.toast(`Save failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Removes the review's temp worktree, unless the reviewer is still reading it
// and `isEnding` is false. It never throws, so a close or a session end is
// never held up by it.
export async function releaseWorktree($: Api, isEnding: boolean): Promise<void> {
  try {
    const review = await read($, reviewState)
    if (review?.worktree === undefined || (review.status === 'running' && !isEnding)) return
    const host = hostFrom($)
    const cwd = await $.session.root()
    const removed = await removeWorktree(host, cwd, review.worktree)
    if (removed.exitCode !== 0) {
      // A worktree still on disk is kept on record so a later close or session
      // end tries again; one already gone only leaves git's bookkeeping behind.
      if (await host.exists(review.worktree)) {
        $.ui.toast(`Could not remove the review worktree ${review.worktree}: ${failure(removed)}`)
        return
      }
      await host.run(['git', 'worktree', 'prune'], { cwd })
    }
    await update($, reviewState, current => {
      if (current?.worktree !== review.worktree) return current
      const { worktree: _gone, ...rest } = current
      return rest
    })
  } catch (error) {
    $.ui.log(`Could not remove the review worktree: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  }
}

export async function renderPane($: Api, e: RenderInput<'Pane'>) {
  const elements = $.ui.resolve(e)
  const { Box, Button, Text } = elements
  // Mobile draws no Input, so there the claim cannot be edited.
  const Input = 'Input' in elements ? elements.Input : undefined
  const review = await read($, reviewState)
  if (review === null) return <Text dimColor>No review yet</Text>

  const title = <Text bold>{paneTitle(review)}</Text>
  const close = <Button key="close" label="Close" hotkey="c" role="dismiss" onPress={() => closePane($)} />
  if (review.status === 'running') {
    return (
      <Box flexDirection="column">
        {title}
        <Text dimColor>Review running…</Text>
        <Box>{close}</Box>
      </Box>
    )
  }
  if (review.status === 'failed') {
    return (
      <Box flexDirection="column">
        {title}
        <Text color="red">Review failed: {review.error ?? 'unknown error'}</Text>
        {review.raw !== '' && <Text dimColor>{review.raw}</Text>}
        <Box>{close}</Box>
      </Box>
    )
  }

  const selected = await selectedIndex($, review)
  const isEditing = await read($, editingState)
  const current = review.findings[selected]
  const count = sends(review).length
  return (
    <Box flexDirection="column">
      {title}
      <Text>{summary(review.findings)}</Text>
      <Text> </Text>
      {review.findings.length === 0 && <Text>No findings.</Text>}
      {review.findings.map((finding, index) => (
        <Box key={`finding-${finding.id}`} flexDirection="column">
          <Text bold={index === selected}>
            {index === selected ? '▸' : ' '} {MARK[finding.decision]} {SHORT[finding.severity].padEnd(4)} {whereText(finding.location)}
            {finding.editedClaim === undefined ? '' : ' (edited)'}
          </Text>
          {index === selected && (
            <Box flexDirection="column" paddingLeft={4}>
              <Text>{claimOf(finding)}</Text>
              <Text dimColor>Evidence: {finding.evidence}</Text>
            </Box>
          )}
        </Box>
      ))}
      {review.unparsed.length > 0 && (
        <Box flexDirection="column">
          <Text> </Text>
          <Text bold>Unparsed</Text>
          {review.unparsed.map((entry, index) => (
            <Text key={`unparsed-${index}`} dimColor>
              {entry.reason}: {entry.raw}
            </Text>
          ))}
        </Box>
      )}
      <Text> </Text>
      {isEditing && current !== undefined && Input !== undefined ? (
        <Input key="claim" label="Claim: " value={claimOf(current)} submitLabel="save" autoFocus onSubmit={(text: string) => editClaim($, text)} />
      ) : (
        <Box flexWrap="wrap">
          {review.findings.length > 0 && <Button key="send" label="Send" hotkey="s" onPress={() => decide($, 'send')} />}
          {review.findings.length > 0 && <Button key="drop" label="Drop" hotkey="d" onPress={() => decide($, 'drop')} />}
          {review.findings.length > 0 && Input !== undefined && (
            <Button key="edit" label="Edit" hotkey="e" onPress={() => startEdit($)} />
          )}
          {review.findings.length > 0 && <Button key="down" label="Down" hotkey="j" onPress={() => move($, 1)} />}
          {review.findings.length > 0 && <Button key="up" label="Up" hotkey="k" onPress={() => move($, -1)} />}
          <Button key="draft" label={`Draft (${count})`} hotkey="r" variant="primary" onPress={() => draft($)} />
          {review.kind === 'pr' && <Button key="post" label="Post" hotkey="p" onPress={() => post($)} />}
          <Button key="save" label="Save" hotkey="w" onPress={() => save($)} />
          {close}
        </Box>
      )}
    </Box>
  )
}
