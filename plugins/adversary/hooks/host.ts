import type { EngineInterface } from 'claude-code'

export type EnvName = 'USERPROFILE' | 'HOME' | 'TEMP' | 'TMPDIR'

export type RunResult = { exitCode: number; stdout: string; stderr: string }

// What a failed process said: its stderr's first line, or its exit code when it said nothing.
export const failure = ({ exitCode, stderr }: Pick<RunResult, 'exitCode' | 'stderr'>) =>
  stderr.trim().split(/\r?\n/)[0] || `exit ${exitCode}`

// A symbolic link is kind `other`, whatever it leads to.
export type Entry = { name: string; kind: 'file' | 'dir' | 'other'; isLink: boolean }

export type Host = {
  run(argv: string[], opts?: { cwd?: string; stdin?: string }): Promise<RunResult>
  mcpTools(): Promise<string[]>
  mcpCall(server: string, tool: string, args: Record<string, unknown>): Promise<unknown>
  readFile(path: string): Promise<string>
  writeFile(path: string, text: string): Promise<void>
  exists(path: string): Promise<boolean>
  realPath(path: string): Promise<string | undefined>
  list(dir: string): Promise<Entry[]>
  env(name: EnvName): Promise<string | undefined>
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
    async list(dir) {
      return (await $.fs.list(dir)).map(({ name, kind, isLink }) => ({ name, kind, isLink }))
    },
    // The engine lists the variables a module reads, so each name is spelled out.
    async env(name) {
      switch (name) {
        case 'USERPROFILE':
          return $.env.get('USERPROFILE')
        case 'HOME':
          return $.env.get('HOME')
        case 'TEMP':
          return $.env.get('TEMP')
        case 'TMPDIR':
          return $.env.get('TMPDIR')
      }
    },
    pluginRoot: $.plugin.root,
  }
}
