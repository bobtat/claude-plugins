import type { AgentSpawnInput, EngineInterface, Register } from 'claude-code'

const PLUGIN = 'subagent-router'
const NOTE = '\n\nEnd your reply with the word PROBE-OK.\n[subagent-router:routed v1]'
const canary = { plugin: 'subagent-router', key: 'canary' } as const
const lastSpawn = { plugin: 'subagent-router', key: 'lastSpawn' } as const

// Held in module memory, so kit.test.ts (K8) can see whether module memory
// carries over from one test to the next.
let folder: string | undefined
let hasSelfSpawned = false

async function probeFolder($: EngineInterface): Promise<string> {
  if (folder === undefined) {
    const data = (await $.process.hookEnv()).CLAUDE_PLUGIN_DATA
    if (!data) throw new Error('no CLAUDE_PLUGIN_DATA')
    folder = `${data}/probe`
  }
  return folder
}

// One file per event: two hooks appending to one file lose lines, which is
// the case Q4 measures.
async function record($: EngineInterface, build: () => object | Promise<object>): Promise<void> {
  const at = Date.now()
  try {
    const entry = await build()
    await $.fs.write(`${await probeFolder($)}/${at}-${crypto.randomUUID()}.json`, JSON.stringify(entry))
  } catch {
    // Dropped: the probe never changes the event it observes.
  }
}

// A read that fails is recorded as its error, so it costs that field, not the file.
const attempt = <T>(read: Promise<T>): Promise<T | { error: string }> => read.catch((error: unknown) => ({ error: String(error) }))

async function firstMessages($: EngineInterface, agentId: string) {
  const rows = await $.session.messages({ agentId })
  if (!Array.isArray(rows)) return { deny: rows.deny }
  return { rows: rows.length, firstTail: rows[0]?.text.slice(-300) ?? null }
}

async function pluginConfigs($: EngineInterface, source: 'user' | 'policy') {
  const configs = (await $.settings.read({ source })).pluginConfigs
  if (configs === null || typeof configs !== 'object') return { keys: [], entries: {} }
  return {
    keys: Object.keys(configs),
    entries: Object.fromEntries(Object.entries(configs).filter(([key]) => key.startsWith(PLUGIN))),
  }
}

async function rewritten($: EngineInterface, e: AgentSpawnInput): Promise<AgentSpawnInput> {
  try {
    const model = await $.env.get('SUBAGENT_ROUTER_PROBE_MODEL')
    const note = await $.env.get('SUBAGENT_ROUTER_PROBE_NOTE')
    const routed = model !== undefined && model !== '' && e.subagentType === 'Explore'
    if (!routed && note !== '1') return e
    return { ...e, ...(routed ? { model } : {}), ...(note === '1' ? { prompt: e.prompt + NOTE } : {}) }
  } catch {
    return e
  }
}

// Q13: what a real session delivers for a spawn a plugin raises. Once per
// load, so a reload or a second session.start does not spawn again.
async function selfSpawn($: EngineInterface): Promise<void> {
  if (hasSelfSpawned) return
  hasSelfSpawned = true
  if ((await $.env.get('SUBAGENT_ROUTER_PROBE_SELFSPAWN')) !== '1') return
  const outcome = await $.agent
    .spawn({ prompt: 'Reply with the single word OK.', description: 'probe self-spawn', subagentType: 'Explore' })
    .then(
      (result) => ({ result }),
      (error: unknown) => ({ error: String(error) }),
    )
  await record($, () => ({ ev: 'self-spawn', ...outcome }))
}

export const register: Register = (on, options) => {
  on('agent.spawn', async ($, e, next) => {
    await record($, async () => ({
      ev: 'spawn',
      keys: Object.keys(e).sort(),
      subagentType: e.subagentType,
      provider: e.provider,
      model: e.model ?? null,
      parentModel: e.parentModel,
      parentAgentId: e.parentAgentId ?? null,
      fork: e.fork,
      resume: e.resume ?? null,
      workflow: e.workflow ?? null,
      isTeammate: e.isTeammate ?? null,
      origin: next.origin,
      promptChars: e.prompt.length,
      toolUseId: e.tool_use_id,
      sessionModel: await attempt($.session.model()),
    }))
    // Q6: whether a read after next sees the other concurrent spawn's write.
    const seenBefore = await attempt($.state.get(lastSpawn).then((read) => read.value ?? null))
    await $.state.set(lastSpawn, e.tool_use_id).catch(() => undefined)
    const result = await next(await rewritten($, e))
    await record($, () => ({ ev: 'started', toolUseId: e.tool_use_id, result }))
    await record($, async () => ({
      ev: 'q6',
      mine: e.tool_use_id,
      seen: await attempt($.state.get(lastSpawn).then((read) => read.value ?? null)),
      seenBefore,
    }))
    const parentAgentId = e.parentAgentId
    if (parentAgentId !== undefined) {
      await record($, async () => ({ ev: 'parent-messages', result: await attempt(firstMessages($, parentAgentId)) }))
    }
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId !== undefined) {
      await record($, async () => ({
        ev: 'end',
        agentId,
        reason: e.reason,
        usage: e.usage ?? null,
        answerTail: e.answer.slice(-80),
        firstTail: await attempt(firstMessages($, agentId)),
      }))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'subagent-router-probe', description: 'Shows that the subagent-router probe build is loaded' })
    } catch {
      // The probe files still matter without the command.
    }
    await record($, async () => ({
      ev: 'session',
      options,
      sub: (await attempt($.env.get('CLAUDE_CODE_SUBAGENT_MODEL'))) ?? null,
      force: (await attempt($.env.get('CLAUDE_CODE_SUBAGENT_MODEL_FORCE'))) ?? null,
      user: await attempt(pluginConfigs($, 'user')),
      policy: await attempt(pluginConfigs($, 'policy')),
      stateCanary: await attempt($.state.get(canary).then((read) => read.value ?? null)),
    }))
    await $.state.set(canary, Date.now()).catch(() => undefined)
    await probeFolder($).then(
      (path) => $.ui.log(`subagent-router probe files: ${path}`),
      () => undefined,
    )
    const started = await next(e)
    // Not awaited: the session's start must not wait on an agent.
    void selfSpawn($).catch(() => undefined)
    return started
  }).catch(($, e, next) => next(e))

  on('config.set', async ($, e, next) => {
    if (e.key.startsWith(PLUGIN)) await record($, () => ({ ev: 'config', key: e.key, origin: e.origin, caller: next.origin }))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'subagent-router-probe' }, () => ({ text: 'probe command alive', isTextDisplayOnly: true }))
}
