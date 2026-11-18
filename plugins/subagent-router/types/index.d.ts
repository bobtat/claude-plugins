// When the probe build's session.start last ran, for Q8 to read after a resume.
export type Canary = number

// The tool_use_id of the spawn whose hook wrote last, for Q6.
export type LastSpawn = string

declare module 'claude-code' {
  interface PluginState {
    'subagent-router': { canary: Canary; lastSpawn: LastSpawn }
  }
}
