import type { Finding, Location, Review, Severity, Unparsed } from '../types'

export const OUTPUT_CONTRACT = [
  'End your answer with exactly one fenced ```json block of the form { "findings": [...] }.',
  'Each finding has these fields:',
  '- "severity": one of "critical", "high", "medium", "low".',
  '- "location": { "file": "<path>", "line": <number, optional> } for code, or { "section": "<heading>" } for a plan or document.',
  '- "claim": what is wrong, in one or two sentences.',
  '- "evidence": the concrete text, code or behaviour that shows it.',
  'Do not suggest fixes. If nothing is wrong, return { "findings": [] }.',
].join('\n')

export const DRAFT_OPENING =
  'An independent reviewer raised these findings. For each one, either fix it or reject it with a specific reason. Do not skip any.'

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

const slashes = (path: string) => path.replace(/\\/g, '/')

export const relativeTo = (root: string, file: string): string => {
  const prefix = slashes(root).replace(/\/+$/, '') + '/'
  const normal = slashes(file)
  return normal.toLowerCase().startsWith(prefix.toLowerCase()) ? normal.slice(prefix.length) : file
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

const readLocation = (value: unknown, root: string): Location | string => {
  if (typeof value !== 'object' || value === null) return 'location must be an object'
  const { file, line, section } = value as Record<string, unknown>
  if (isText(section)) return { section }
  if (!isText(file)) return 'location needs a file or a section'
  if (line === undefined || line === null) return { file: relativeTo(root, file) }
  if (typeof line !== 'number' || !Number.isInteger(line)) return 'location.line must be an integer'
  return { file: relativeTo(root, file), line }
}

const readFinding = (value: unknown, id: number, root: string): Finding | string => {
  if (typeof value !== 'object' || value === null) return 'finding must be an object'
  const { severity, location, claim, evidence } = value as Record<string, unknown>
  if (!SEVERITIES.includes(severity as Severity)) return `severity must be one of ${SEVERITIES.join(', ')}`
  const where = readLocation(location, root)
  if (typeof where === 'string') return where
  if (!isText(claim)) return 'claim must be text'
  if (!isText(evidence)) return 'evidence must be text'
  return { id, severity: severity as Severity, location: where, claim, evidence, decision: 'undecided' }
}

const lastJsonBlock = (output: string): string | undefined => {
  const blocks = [...output.matchAll(/```json[^\S\n]*\n([\s\S]*?)^```[^\S\n]*$/gm)]
  return blocks.at(-1)?.[1]
}

export const parseFindings = (
  output: string,
  root: string,
): { ok: true; findings: Finding[]; unparsed: Unparsed[] } | { ok: false; error: 'no json block' } => {
  const body = lastJsonBlock(output)
  if (body === undefined) return { ok: false, error: 'no json block' }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch (error) {
    return { ok: true, findings: [], unparsed: [{ raw: body.trim(), reason: `invalid JSON: ${(error as Error).message}` }] }
  }

  const items = (parsed as { findings?: unknown } | null)?.findings
  if (!Array.isArray(items)) {
    return { ok: true, findings: [], unparsed: [{ raw: body.trim(), reason: 'no findings array' }] }
  }

  const findings: Finding[] = []
  const unparsed: Unparsed[] = []
  for (const item of items) {
    const result = readFinding(item, findings.length + 1, root)
    if (typeof result === 'string') unparsed.push({ raw: JSON.stringify(item), reason: result })
    else findings.push(result)
  }
  return { ok: true, findings, unparsed }
}

export const sortBySeverity = (findings: Finding[]): Finding[] =>
  findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => SEVERITIES.indexOf(a.finding.severity) - SEVERITIES.indexOf(b.finding.severity) || a.index - b.index)
    .map(({ finding }) => finding)

export const whereText = (location: Location): string => {
  if ('section' in location) return `§ ${location.section}`
  return location.line === undefined ? location.file : `${location.file}:${location.line}`
}

export const draftText = (findings: Finding[]): string => {
  const lines = findings
    .filter(finding => finding.decision === 'send')
    .flatMap((finding, index) => [
      `${index + 1}. [${finding.severity.toUpperCase()}] ${whereText(finding.location)} — ${finding.editedClaim ?? finding.claim}`,
      `   Evidence: ${finding.evidence}`,
    ])
  return [DRAFT_OPENING, '', ...lines].join('\n')
}

export const savedMarkdown = (review: Review, date: string): string => {
  const lines = [`# Adversarial review: ${review.kind} ${review.target}`, '', `Date: ${date}`, '']
  for (const finding of review.findings) {
    lines.push(
      `## ${finding.id}. [${finding.severity.toUpperCase()}] ${whereText(finding.location)} (${finding.decision})`,
      '',
      finding.editedClaim === undefined ? finding.claim : `${finding.editedClaim}`,
      '',
    )
    if (finding.editedClaim !== undefined) lines.push(`Original claim: ${finding.claim}`, '')
    lines.push(`Evidence: ${finding.evidence}`, '')
  }
  if (review.unparsed.length > 0) {
    lines.push('## Unparsed', '')
    for (const entry of review.unparsed) lines.push(`- ${entry.reason}: ${entry.raw}`)
    lines.push('')
  }
  return lines.join('\n')
}
