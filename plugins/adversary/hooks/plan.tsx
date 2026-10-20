import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const planState = atom({ plugin: 'adversary', key: 'plan' } as const, null)
const pendingState = atom({ plugin: 'adversary', key: 'planPending' } as const, false)

export const registerPlanBand: Register = on => {
  on('tool.call', { tool: 'ExitPlanMode' }, async ($, e, next) => {
    const ran = await next(e)
    // The plan is in the tool's result: its input carries none.
    if (e.agentId !== undefined || ran.deny !== undefined || ran.isError === true) return ran
    const plan = (ran.result as { plan: string | null } | undefined)?.plan
    if (typeof plan !== 'string' || plan === '') return ran
    try {
      await update($, planState, () => plan)
      await update($, pendingState, () => true)
    } catch {
      // Remembering the plan must never fail the tool call.
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    try {
      await update($, pendingState, () => false)
    } catch {
      // A failed write must not block the prompt.
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, pendingState))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text>Plan ready — /adversary plan to review it</Text>
      </Box>
    )
  })
}
