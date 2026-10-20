import type { PrRef } from '../types'
import { GH_UNAVAILABLE } from './brief'
import { failure } from './host'
import type { Host, RunResult } from './host'

export const MAX_ARTIFACT_CHARS = 200_000

export type Artifact = { text: string; root: string; worktree?: string; pr?: PrRef }
type Got = { ok: true; artifact: Artifact } | { ok: false; error: string }

const isAuthFailure = (stderr: string) => /gh auth login|not logged in|authenticat/i.test(stderr)

export async function prArtifact(host: Host, target: string, cwd: string, tmpBase: string): Promise<Got> {
  const view = await host.run(['gh', 'pr', 'view', target, '--json', 'number,title,body,headRefOid,baseRefName,url'], { cwd })
  if (view.exitCode === 127 || (view.exitCode !== 0 && isAuthFailure(view.stderr))) return { ok: false, error: GH_UNAVAILABLE }
  if (view.exitCode !== 0) return { ok: false, error: `Could not read PR ${target}: ${failure(view)}` }

  let pr: { number: number; title: string; body: string; headRefOid: string; url: string }
  try {
    pr = JSON.parse(view.stdout)
  } catch {
    return { ok: false, error: `Could not read PR ${target}: unexpected gh output` }
  }

  const diff = await host.run(['gh', 'pr', 'diff', target], { cwd })
  if (diff.exitCode !== 0) return { ok: false, error: `Could not read PR ${target}: ${failure(diff)}` }
  if (diff.stdout.length > MAX_ARTIFACT_CHARS) {
    return { ok: false, error: `PR diff is ${diff.stdout.length} characters; too large for one review (limit ${MAX_ARTIFACT_CHARS})` }
  }

  const ref: PrRef = { number: pr.number, url: pr.url, headRefOid: pr.headRefOid }
  const text = `# PR #${pr.number}: ${pr.title}\n\n${pr.body}\n\n## Diff\n\n${diff.stdout}`

  const head = await host.run(['git', 'rev-parse', 'HEAD'], { cwd })
  if (head.exitCode === 0 && head.stdout.trim() === pr.headRefOid) return { ok: true, artifact: { text, root: cwd, pr: ref } }

  const path = `${tmpBase}/adversary-pr-${pr.number}-${pr.headRefOid.slice(0, 7)}`
  const failed = (ran: RunResult): Got => ({ ok: false, error: `Could not check out PR #${pr.number}: ${failure(ran)}` })
  const fetch = await host.run(['git', 'fetch', 'origin', `pull/${pr.number}/head`], { cwd })
  if (fetch.exitCode !== 0) return failed(fetch)
  const add = await host.run(['git', 'worktree', 'add', '--detach', path, 'FETCH_HEAD'], { cwd })
  if (add.exitCode !== 0) return failed(add)

  return { ok: true, artifact: { text, root: path, worktree: path, pr: ref } }
}

export async function planArtifact(_host: Host, plan: string | null, cwd: string): Promise<Got> {
  if (plan === null) return { ok: false, error: 'No plan this session' }
  return { ok: true, artifact: { text: plan, root: cwd } }
}

export async function docArtifact(host: Host, path: string, cwd: string): Promise<Got> {
  const full = /^([A-Za-z]:)?[\\/]/.test(path) ? path : `${cwd.replace(/[\\/]$/, '')}/${path}`
  if (!(await host.exists(full))) return { ok: false, error: `Document not found: ${path}` }
  return { ok: true, artifact: { text: await host.readFile(full), root: cwd } }
}

export async function removeWorktree(host: Host, cwd: string, path: string): Promise<RunResult> {
  return host.run(['git', 'worktree', 'remove', '--force', path], { cwd })
}
