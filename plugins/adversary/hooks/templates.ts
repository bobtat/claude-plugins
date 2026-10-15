import type { Kind } from '../types'
import type { Brief } from './brief'
import { OUTPUT_CONTRACT } from './findings'
import type { Host } from './host'

export type Fill = { artifact: string; brief?: Brief; focus?: string; root: string }
type Resolved = { ok: true; path: string; text: string } | { ok: false; error: string }
type Filled = { ok: true; prompt: string } | { ok: false; error: string }

const KINDS: Kind[] = ['pr', 'plan', 'doc']
const REQUIRED = ['{{artifact}}', '{{output_contract}}']

// A section placeholder alone on its line takes the line with it when it has
// no value; every other placeholder is replaced in place. One pass keeps
// substituted text from being scanned for placeholders.
const PLACEHOLDER = /^[ \t]*\{\{(brief|focus)\}\}[ \t]*(\r?\n|$)|\{\{(artifact|output_contract|root|brief|focus)\}\}/gm

const shippedPath = (host: Host, kind: Kind) => `${host.pluginRoot}/templates/${kind}.md`
const userPath = (home: string, kind: Kind) => `${home}/.claude/adversary/${kind}.md`
const repoPath = (repoRoot: string, kind: Kind) => `${repoRoot}/.claude/adversary/${kind}.md`

export async function homeDir(host: Host): Promise<string> {
  return (await host.env('USERPROFILE')) ?? (await host.env('HOME')) ?? ''
}

export async function seedUserTemplates(host: Host, home: string): Promise<void> {
  for (const kind of KINDS) {
    const target = userPath(home, kind)
    if (await host.exists(target)) continue
    await host.writeFile(target, await host.readFile(shippedPath(host, kind)))
  }
}

export async function resolveTemplate(host: Host, kind: Kind, repoRoot: string, home: string): Promise<Resolved> {
  for (const path of [repoPath(repoRoot, kind), userPath(home, kind), shippedPath(host, kind)]) {
    if (await host.exists(path)) return { ok: true, path, text: await host.readFile(path) }
  }
  return { ok: false, error: `No ${kind} template found; reinstall the adversary plugin` }
}

export function fillTemplate(text: string, path: string, fill: Fill): Filled {
  const missing = REQUIRED.find(placeholder => !text.includes(placeholder))
  if (missing !== undefined) return { ok: false, error: `Template ${path} is missing ${missing}` }

  const sections = {
    brief: fill.brief === undefined ? undefined : `## Brief (${fill.brief.label})\n\n${fill.brief.text}`,
    focus: fill.focus === undefined ? undefined : `## Focus\n\n${fill.focus}`,
  }
  const values: Record<string, string> = { artifact: fill.artifact, output_contract: OUTPUT_CONTRACT, root: fill.root }

  const prompt = text.replace(PLACEHOLDER, (_match, lineName: 'brief' | 'focus' | undefined, newline: string | undefined, inlineName: string | undefined) => {
    if (lineName !== undefined) return sections[lineName] === undefined ? '' : `${sections[lineName]}${newline}`
    const name = inlineName as string
    return name === 'brief' || name === 'focus' ? (sections[name] ?? '') : values[name]
  })
  return { ok: true, prompt }
}
