import type { Host, RunResult } from '../hooks/host'

type GhResponse = { exitCode: number; stdout: string; stderr?: string }
type Issues = Record<string, { summary: string; description: string }>

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
    mcpCall: unexpected('mcpCall'),
    readFile: unexpected('readFile'),
    writeFile: unexpected('writeFile'),
    exists: async () => false,
    realPath: async () => undefined,
    list: async () => [],
    env: async () => undefined,
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
      if (key === undefined) return { exitCode: 127, stdout: '', stderr: 'not found' } satisfies RunResult
      const { exitCode, stdout, stderr = '' } = responses[key]
      return { exitCode, stdout, stderr }
    },
  }
}

const text = (value: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(value) }], isError: false })

export function atlassian(issues: Issues | 'absent'): Pick<Host, 'mcpTools' | 'mcpCall'> {
  return {
    async mcpTools() {
      return issues === 'absent' ? [] : ['getAccessibleAtlassianResources', 'getJiraIssue'].map(tool => `mcp__${ATLASSIAN_SERVER}__${tool}`)
    },
    async mcpCall(server, tool, args) {
      if (issues === 'absent' || server !== ATLASSIAN_SERVER) return { content: [], isError: true }
      if (tool === 'getAccessibleAtlassianResources') return text([{ id: CLOUD_ID, name: 'site' }])
      const key = String(args.issueIdOrKey)
      const issue = args.cloudId === CLOUD_ID ? issues[key] : undefined
      if (issue === undefined) return { content: [{ type: 'text', text: 'not found' }], isError: true }
      return text({ key, fields: { summary: issue.summary, description: issue.description } })
    },
  }
}
