import type { EngineInterface } from 'claude-code'

export type RunResult = { exitCode: number; stdout: string; stderr: string }

export type Host = {
  run(argv: string[], opts?: { cwd?: string; stdin?: string }): Promise<RunResult>
  mcpTools(): Promise<string[]>
  mcpCall(server: string, tool: string, args: Record<string, unknown>): Promise<unknown>
  readFile(path: string): Promise<string>
  writeFile(path: string, text: string): Promise<void>
  exists(path: string): Promise<boolean>
  realPath(path: string): Promise<string | undefined>
  env(name: string): Promise<string | undefined>
  pluginRoot: string
}

export function hostFrom($: EngineInterface): Host {
  return {
    async run(argv, opts) {
      try {
        const { exitCode, stdout, stderr } = await $.process.run(argv, opts)
        return { exitCode, stdout, stderr }
      } catch (error) {
        return { exitCode: 127, stdout: '', stderr: error instanceof Error ? error.message : String(error) }
      }
    },
    async mcpTools() {
      return (await $.tool.list()).filter(t => t.mcp).map(t => t.name)
    },
    mcpCall: (server, tool, args) => $.mcp.call(server, tool, args),
    readFile: path => $.fs.read(path),
    writeFile: (path, text) => $.fs.write(path, text),
    exists: path => $.fs.exists(path),
    async realPath(path) {
      try {
        return (await $.fs.stat(path, { resolve: true })).realPath
      } catch {
        return undefined
      }
    },
    env: name => $.env.get(name),
    pluginRoot: $.plugin.root,
  }
}
