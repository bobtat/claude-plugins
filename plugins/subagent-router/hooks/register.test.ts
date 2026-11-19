import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { GUARD_FAILED } from './guard'
import { register } from './register'
import { ENGINE, change, input } from './test-support'

test('the guard and the spawn hook are registered with the .catch each needs', async () => {
  type Handler = (...args: unknown[]) => unknown
  const hooks: { event: string; handler: Handler; onFailure?: Handler }[] = []
  const recordingOn = ((event: string, ...rest: unknown[]) => {
    const hook: (typeof hooks)[number] = { event, handler: rest.at(-1) as Handler }
    hooks.push(hook)
    return {
      catch: (onFailure: Handler) => {
        hook.onFailure = onFailure
      },
    }
  }) as unknown as On
  register(recordingOn, {} as never)
  const failureOf = (event: string) => hooks.find((h) => h.event === event)?.onFailure
  const passedOn = { model: 'claude-opus-5-5', agentId: 'a1' } as const
  const notCalled = <T>(answer: T) => Object.assign(async () => answer, { called: false, origin: ENGINE }) as never

  expect(await failureOf('config.set')?.({}, change('subagent-router.mode', { kind: 'composer' }), notCalled({ value: 'route' }))).toEqual({ deny: GUARD_FAILED })
  expect(await failureOf('agent.spawn')?.({}, input(), notCalled(passedOn))).toEqual(passedOn)
})
