import type { Host, RunResult } from '../hooks/host'

type GhResponse = { exitCode: number; stdout: string; stderr?: string }
type Issues = Record<string, { summary: string; description: unknown }>

export const ATLASSIAN_SERVER = 'claude_ai_Atlassian'
export const CLOUD_ID = 'cloud-1'

// Every member rejects or answers "nothing" unless a test overrides it.
export function fakeHost(overrides: Partial<Host> = {}): Host {
  const unexpected = (name: string) => async (): Promise<never> => {
    throw new Error(`unexpected host.${name}`)
  }
  return {
    run: unexpected('run'),
    mcpTools: async () => [],
    mcpConnect: async () => ({ isConnected: false, reason: 'unlisted' }),
    mcpCall: unexpected('mcpCall'),
    readFile: unexpected('readFile'),
    writeFile: unexpected('writeFile'),
    exists: async () => false,
    realPath: async () => undefined,
    list: async () => [],
    env: async () => undefined,
    sessionId: async () => 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    pluginRoot: 'C:/plugins/adversary',
    ...overrides,
  }
}

// `run` answering with the response whose key is a prefix of the argv joined
// by spaces; an unmatched command fails as a missing binary would.
export function gh(responses: Record<string, GhResponse>): Pick<Host, 'run'> {
  return {
    async run(argv) {
      const line = argv.join(' ')
      const key = Object.keys(responses).find(k => line.startsWith(k))
      const response = key === undefined ? undefined : responses[key]
      if (response === undefined) return { exitCode: 127, stdout: '', stderr: 'not found' } satisfies RunResult
      const { exitCode, stdout, stderr = '' } = response
      return { exitCode, stdout, stderr }
    },
  }
}

const text = (value: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(value) }], isError: false })

export function atlassian(issues: Issues | 'absent', server: string = ATLASSIAN_SERVER): Pick<Host, 'mcpTools' | 'mcpCall'> {
  return {
    async mcpTools() {
      return issues === 'absent' ? [] : ['getAccessibleAtlassianResources', 'getJiraIssue'].map(tool => `mcp__${server}__${tool}`)
    },
    async mcpCall(called, tool, args) {
      if (issues === 'absent' || called !== server) return { content: [], isError: true }
      if (tool === 'getAccessibleAtlassianResources') return text([{ id: CLOUD_ID, name: 'site' }])
      const key = String(args.issueIdOrKey)
      const issue = args.cloudId === CLOUD_ID ? issues[key] : undefined
      if (issue === undefined) return { content: [{ type: 'text', text: 'not found' }], isError: true }
      return text({ key, fields: { summary: issue.summary, description: issue.description } })
    },
  }
}
