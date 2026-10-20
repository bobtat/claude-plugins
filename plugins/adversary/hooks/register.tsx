import type { Register } from 'claude-code'

import { parseArgs } from './args'
import { judgeCall } from './guard'
import { hostFrom } from './host'
import { registerPlanBand } from './plan'
import { namesReviewer, REVIEWER, reviewerScope, reviewerTurnEnded, startReview } from './review'
import { homeDir, seedUserTemplates } from './templates'
import { openTriage, releaseWorktree, renderPane } from './triage'

const OUTSIDE = 'outside the review root'
// Spelled out, not imported from triage.tsx, so validate can list the pane hooks' matchers.
const PANE_ID = 'adversary'
const NO_SEARCH = 'Grep/Glob disabled: the review root contains links leading outside it; use Read'
const REVIEW_DELIVERED = 'adversary: the review finished; its findings are in the triage pane (/adversary triage).'

export const register: Register = on => {
  registerPlanBand(on)

  on('session.start', async ($, e, next) => {
    await $.agent.register(REVIEWER)
    await $.command.register({ name: 'adversary', description: 'Adversarial review of a PR, plan or document by an isolated reviewer' })
    const host = hostFrom($)
    try {
      await seedUserTemplates(host, await homeDir(host))
    } catch (error) {
      $.ui.log(`Could not copy the reviewer templates to your home directory: ${error instanceof Error ? error.message : String(error)}`)
    }
    return next(e)
  })

  on('agent.offer', { agent: 'adversary:reviewer' }, () => ({ isOffered: false }))

  on('command.run', { command: 'adversary' }, async ($, e) => {
    const parsed = parseArgs(e.args)
    if (!parsed.ok) return { text: parsed.error }
    if (parsed.args.sub === 'triage') return { text: await openTriage($, true) }
    return { text: await startReview($, parsed.args) }
  })

  on('tool.call', { tool: ['Read', 'Grep', 'Glob'] }, async ($, e, next) => {
    const scope = await reviewerScope($, e.agentId)
    if (scope === undefined) return next(e)
    if (e.tool !== 'Read' && !scope.canSearch) return { deny: NO_SEARCH }
    const verdict = await judgeCall(hostFrom($), e, scope.root)
    if (verdict === 'deny') return { deny: OUTSIDE }
    return next(verdict === 'scope' ? { ...e, path: scope.root } : e)
  }).catch(($, e, next) => (next.called || e.agentId === undefined ? next(e) : { deny: OUTSIDE }))

  // The reviewer runs in the background, so its answer would also come back to
  // the author session as a task notification, findings and all, past triage.
  on('prompt.submit', { origin: { kind: 'task-notification' } }, async ($, e, next) => {
    if (e.origin.kind !== 'task-notification' || !(await namesReviewer($, e.text))) return next(e)
    return { drop: REVIEW_DELIVERED }
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    await reviewerTurnEnded($, e)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => renderPane($, e))

  on('ui.close', { id: PANE_ID }, async ($, e, next) => {
    const result = await next(e)
    await releaseWorktree($, false)
    return result
  })

  on('session.end', async ($, e, next) => {
    await releaseWorktree($, true)
    return next(e)
  })
}
