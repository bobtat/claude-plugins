import type { Register } from 'claude-code'
import { answerCommand, registerCommand } from './command'
import { guardSettings, settingsGuardFailed } from './guard'
import { onSpawn } from './spawn'
import { addUsage } from './usage'

export const register: Register = (on) => {
  // Before next was called this passes the spawn on unchanged; after, next(e) replays what that call settled
  // to (next.called), so a failure never starts a second agent.
  on('agent.spawn', onSpawn).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    void registerCommand($)
    try {
      await addUsage($, e)
    } catch {
      // A cost that cannot be recorded changes nothing about the turn.
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    await registerCommand($)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('config.set', ($, e, next) => guardSettings(e, next)).catch(($, e, next) => settingsGuardFailed(e, next))

  on('command.run', { command: 'subagent-router' }, ($) => answerCommand($)).catch(() => ({
    text: 'subagent-router: the report could not be built',
    isTextDisplayOnly: true,
  }))
}
