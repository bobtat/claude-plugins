import { atom, read, update } from 'claude-code'
import type { EngineInterface, TurnCompleteInput } from 'claude-code'

import type { Review } from '../types'
import type { Args } from './args'
import { docArtifact, planArtifact, prArtifact, removeWorktree } from './artifact'
import type { Artifact } from './artifact'
import { classifyBrief, fetchBrief } from './brief'
import type { Brief } from './brief'
import { parseFindings, sortBySeverity } from './findings'
import { hostFrom, messageOf } from './host'
import type { Host } from './host'
import { hasOutwardLinks } from './links'
import { fillTemplate, homeDir, resolveTemplate } from './templates'
import { openTriage } from './triage'

type Api = EngineInterface

const reviewState = atom({ plugin: 'adversary', key: 'review' } as const, null)
const planState = atom({ plugin: 'adversary', key: 'plan' } as const, null)
const selectedState = atom({ plugin: 'adversary', key: 'selected' } as const, 0)
type Start = Exclude<Args, { sub: 'triage' }>
type Prepared = { ok: true; artifact: Artifact; brief?: Brief; prompt: string } | { ok: false; error: string }

const REVIEWER_TYPE = 'adversary:reviewer'

export const REVIEWER = {
  name: 'reviewer',
  description: 'Adversarial reviewer that /adversary starts itself; never delegate to it.',
  prompt: [
    'You are an independent adversarial reviewer.',
    'Your task message is everything you are given: what to review, where it is, and the form your answer must take.',
    'Work only from it and from the files under the directory it names, using Read, Grep and Glob.',
  ].join(' '),
  tools: ['Read', 'Grep', 'Glob'],
  // A spawn's --model overrides it; without one the reply promises the session model.
  model: 'inherit',
  background: true,
  omitClaudeMd: true,
} as const

const ENDED = ['completed', 'failed', 'killed']

const TURN_FAILURES = {
  aborted: 'The reviewer was interrupted',
  error: 'The reviewer stopped on an API error',
  refusal: 'The reviewer refused the review',
} as const

// Called once a review settles. The engine only lets `$` reach functions it can
// resolve statically, so the triage pane is opened from here, not through a
// callback another module assigns.
export async function onReviewReady($: Api): Promise<void> {
  await openTriage($, false)
}

// A running review blocks only while its agent is alive: after a reload or a
// crash the state can still say running for an agent that is long gone.
export async function isBlocked($: Api): Promise<boolean> {
  const review = await read($, reviewState)
  if (review?.status !== 'running' || review.agentId === undefined) return false
  const agents = await $.agent.list()
  return agents.some(agent => agent.id === review.agentId && !ENDED.includes(agent.status))
}

// A spawn can resolve without the started agent's id (the test kit drops it
// from a plugin's own spawn); the agent list still names it by type.
async function newestLiveReviewer($: Api): Promise<string | undefined> {
  const live = (await $.agent.list()).filter(agent => agent.type === REVIEWER_TYPE && !ENDED.includes(agent.status))
  return live.at(-1)?.id
}

const tmpBase = async (host: Host) => (await host.env('TEMP')) ?? (await host.env('TMPDIR')) ?? '/tmp'

async function acquire($: Api, host: Host, args: Start, cwd: string) {
  switch (args.sub) {
    case 'pr':
      return prArtifact(host, args.target, cwd, await tmpBase(host))
    case 'plan':
      return planArtifact(host, await read($, planState), cwd)
    case 'doc':
      return docArtifact(host, args.target, cwd)
  }
}

async function promptFor(host: Host, args: Start, cwd: string, artifact: Artifact): Promise<Prepared> {
  let brief: Brief | undefined
  if (args.brief !== undefined) {
    const fetched = await fetchBrief(host, classifyBrief(args.brief))
    if (!fetched.ok) return fetched
    brief = fetched.brief
  }
  const template = await resolveTemplate(host, args.sub, cwd, await homeDir(host))
  if (!template.ok) return template
  const filled = fillTemplate(template.text, template.path, { artifact: artifact.text, brief, focus: args.focus, root: artifact.root })
  if (!filled.ok) return filled
  return { ok: true, artifact, brief, prompt: filled.prompt }
}

async function resolved(host: Host, args: Start, cwd: string, artifact: Artifact): Promise<Prepared> {
  // The guard compares resolved targets, so the root must be resolved the same
  // way (a short 8.3 name, a subst drive, a junction) or nothing is under it.
  const root = await host.realPath(artifact.root)
  if (root === undefined) return { ok: false, error: `Could not resolve the review root ${artifact.root}` }
  return promptFor(host, args, cwd, { ...artifact, root })
}

async function prepare($: Api, host: Host, args: Start, cwd: string): Promise<Prepared> {
  const got = await acquire($, host, args, cwd)
  if (!got.ok) return got
  let prepared: Prepared
  try {
    prepared = await resolved(host, args, cwd, got.artifact)
  } catch (error) {
    prepared = { ok: false, error: `Could not prepare the review: ${messageOf(error)}` }
  }
  // Nothing records a worktree until the review is stored, so it goes here.
  if (!prepared.ok && got.artifact.worktree !== undefined) await removeWorktree(host, cwd, got.artifact.worktree)
  return prepared
}

const withoutUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T

export async function startReview($: Api, args: Start): Promise<string> {
  if (await isBlocked($)) return 'Review in progress'

  const host = hostFrom($)
  const cwd = await $.session.root()
  // Removed first: a new review of the same PR head checks out to the same path.
  const previous = await read($, reviewState)
  if (previous?.worktree !== undefined) await removeWorktree(host, cwd, previous.worktree)

  const prepared = await prepare($, host, args, cwd)
  if (!prepared.ok) return prepared.error

  const { artifact, brief, prompt } = prepared
  const target = args.sub === 'plan' ? '' : args.target
  const review: Review = withoutUndefined({
    kind: args.sub,
    target,
    briefLabel: brief?.label,
    model: args.model,
    root: artifact.root,
    worktree: artifact.worktree,
    pr: artifact.pr,
    status: 'running' as const,
    findings: [],
    unparsed: [],
    raw: '',
    startedAt: await $.clock.now(),
    hasOutwardLinks: await hasOutwardLinks(host, artifact.root),
  })
  await update($, reviewState, () => review)

  let spawned: Awaited<ReturnType<Api['agent']['spawn']>>
  try {
    spawned = await $.agent.spawn({
      subagentType: REVIEWER_TYPE,
      prompt,
      description: 'adversarial review',
      ...(args.model === undefined ? {} : { model: args.model }),
    })
  } catch (error) {
    spawned = { deny: error instanceof Error ? error.message : String(error) }
  }
  const agentId = spawned.deny === undefined ? (spawned.agentId ?? (await newestLiveReviewer($))) : undefined
  if (agentId === undefined) {
    const error = spawned.deny ?? 'no reviewer agent was started'
    await failReview($, undefined, error, '')
    return `The reviewer could not start: ${error}`
  }
  await update($, reviewState, current => (current === null ? current : { ...current, agentId }))

  return `Reviewing ${[args.sub, target].filter(Boolean).join(' ')} with ${args.model ?? 'session model'}; findings will open in the triage pane.`
}

// Settles the running review whose agent is `agentId` (none for a spawn that
// never started one); any other review, or one already settled, is left alone.
async function settle($: Api, agentId: string | undefined, settled: (review: Review) => Review): Promise<void> {
  const isOurs = (review: Review | null): review is Review => review?.status === 'running' && review.agentId === agentId
  if (!isOurs(await read($, reviewState))) return
  await update($, reviewState, current => (isOurs(current) ? settled(current) : current))
  await update($, selectedState, () => 0)
  await onReviewReady($)
}

export async function finishReview($: Api, agentId: string, answer: string): Promise<void> {
  await settle($, agentId, review => {
    const parsed = parseFindings(answer, review.root)
    if (!parsed.ok) return { ...review, status: 'failed', error: 'The reviewer gave no json block', raw: answer }
    return { ...review, status: 'done', findings: sortBySeverity(parsed.findings), unparsed: parsed.unparsed, raw: answer }
  })
}

export async function failReview($: Api, agentId: string | undefined, error: string, raw: string): Promise<void> {
  await settle($, agentId, review => ({ ...review, status: 'failed', error, raw }))
}

export async function reviewerTurnEnded($: Api, e: TurnCompleteInput): Promise<void> {
  if (e.agentId === undefined) return
  if (e.reason === 'answer') await finishReview($, e.agentId, e.answer)
  else await failReview($, e.agentId, TURN_FAILURES[e.reason], e.answer)
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const mentions = (text: string, id: string) => new RegExp(`(?<![\\w-])${escapeRegExp(id)}(?![\\w-])`).test(text)

// Whether a task notification's text names a reviewer: `prompt.submit` carries
// no task id of its own, so the id is looked for in the text the engine wrote.
export async function namesReviewer($: Api, text: string): Promise<boolean> {
  const stored = (await read($, reviewState))?.agentId
  if (stored !== undefined && mentions(text, stored)) return true
  const reviewers = (await $.agent.list()).filter(agent => agent.type === REVIEWER_TYPE)
  return reviewers.some(agent => mentions(text, agent.id))
}

export type Confinement = { root: string; canSearch: boolean }

// Where a subagent's file access is confined, or undefined for a call that is
// not a reviewer's. Any reviewer is confined, not only the current one, so an
// agent from an earlier review, or one whose id is not stored yet, is never
// let loose; with no review on record it may reach nothing (root '').
export async function reviewerScope($: Api, agentId: string | undefined): Promise<Confinement | undefined> {
  if (agentId === undefined) return undefined
  const review = await read($, reviewState)
  const confined = { root: review?.root ?? '', canSearch: review?.hasOutwardLinks === false }
  if (review?.agentId === agentId) return confined
  const agent = (await $.agent.list()).find(a => a.id === agentId)
  return agent?.type === REVIEWER_TYPE ? confined : undefined
}
