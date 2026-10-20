import type { Host } from './host'

export type BriefSource = { kind: 'jira'; key: string } | { kind: 'github'; ref: string } | { kind: 'text'; text: string }
export type Brief = { label: string; text: string }
type Result = { ok: true; brief: Brief } | { ok: false; error: string }
type McpResult = { content: { text?: string }[]; isError: boolean }

const RESOURCES_TOOL = 'getAccessibleAtlassianResources'
const ISSUE_TOOL = 'getJiraIssue'

const JIRA_KEY = /^[A-Z][A-Z0-9]+-\d+$/
const GITHUB_NUMBER = /^#(\d+)$/
const GITHUB_ISSUE_URL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/(\d+)$/

const JIRA_NOT_CONNECTED = 'Jira not connected; paste the ticket with --brief "..."'
export const GH_UNAVAILABLE = 'gh is not available: run gh auth login'

export function classifyBrief(value: string): BriefSource {
  if (JIRA_KEY.test(value)) return { kind: 'jira', key: value }
  const number = GITHUB_NUMBER.exec(value)
  if (number) return { kind: 'github', ref: number[1] }
  if (GITHUB_ISSUE_URL.test(value)) return { kind: 'github', ref: value }
  return { kind: 'text', text: value }
}

export async function fetchBrief(host: Host, source: BriefSource): Promise<Result> {
  if (source.kind === 'text') return { ok: true, brief: { label: 'pasted brief', text: source.text } }
  return source.kind === 'jira' ? fetchJira(host, source.key) : fetchGithub(host, source.ref)
}

// Servers cannot be listed, so the Atlassian one is found from the names of
// the MCP tools the session carries (`mcp__<server>__<tool>`).
async function atlassianServer(host: Host): Promise<string | undefined> {
  const tools = await host.mcpTools().catch(() => [])
  for (const name of tools) {
    const match = /^mcp__(.+)__([^_]+)$/.exec(name)
    if (match && /atlassian/i.test(match[1]) && match[2] === ISSUE_TOOL) return match[1]
  }
  return undefined
}

// A call that rejects (a server gone mid-session) reads as one that failed.
async function callJson(host: Host, server: string, tool: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const { content, isError } = (await host.mcpCall(server, tool, args)) as McpResult
    return isError ? undefined : JSON.parse(content.map(b => b.text ?? '').join(''))
  } catch {
    return undefined
  }
}

const descriptionText = (description: unknown): string => {
  if (description === undefined || description === null) return ''
  return typeof description === 'string' ? description : JSON.stringify(description)
}

async function fetchJira(host: Host, key: string): Promise<Result> {
  const failed: Result = { ok: false, error: JIRA_NOT_CONNECTED }
  const server = await atlassianServer(host)
  if (server === undefined) return failed

  const resources = await callJson(host, server, RESOURCES_TOOL, {})
  const cloudId = Array.isArray(resources) ? (resources[0] as { id?: string } | undefined)?.id : undefined
  if (cloudId === undefined) return failed

  const issue = (await callJson(host, server, ISSUE_TOOL, { cloudId, issueIdOrKey: key })) as
    | { fields?: { summary?: string; description?: unknown } }
    | undefined
  if (issue?.fields === undefined) return { ok: false, error: `Could not read ${key} from Jira; paste the ticket with --brief "..."` }

  const { summary = '', description } = issue.fields
  return { ok: true, brief: { label: key, text: `${key}: ${summary}\n\n${descriptionText(description)}` } }
}

async function fetchGithub(host: Host, ref: string): Promise<Result> {
  const failed: Result = { ok: false, error: GH_UNAVAILABLE }
  const number = /\d+$/.exec(ref)?.[0] ?? ref
  const run = await host.run(['gh', 'issue', 'view', ref, '--json', 'title,body'])
  if (run.exitCode !== 0) return failed
  try {
    const { title, body } = JSON.parse(run.stdout) as { title: string; body: string }
    return { ok: true, brief: { label: `#${number}`, text: `#${number}: ${title}\n\n${body}` } }
  } catch {
    return failed
  }
}
