import type { Register } from 'claude-code'

import { parseArgs } from './args'
import { judgeCall } from './guard'
import { hostFrom } from './host'
import { REVIEWER, reviewerRoot, reviewerTurnEnded, startReview } from './review'
import { homeDir, seedUserTemplates } from './templates'

const OUTSIDE = 'outside the review root'

export const register: Register = on => {
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
    if (parsed.args.sub === 'triage') return { text: 'No review yet' }
    return { text: await startReview($, parsed.args) }
  })

  on('tool.call', { tool: ['Read', 'Grep', 'Glob'] }, async ($, e, next) => {
    const root = await reviewerRoot($, e.agentId)
    if (root === undefined) return next(e)
    const verdict = await judgeCall(hostFrom($), e, root)
    if (verdict === 'deny') return { deny: OUTSIDE }
    return next(verdict === 'scope' ? { ...e, path: root } : e)
  }).catch(($, e, next) => (next.called || e.agentId === undefined ? next(e) : { deny: OUTSIDE }))

  on('turn.complete', async ($, e, next) => {
    await reviewerTurnEnded($, e)
    return next(e)
  })
}
