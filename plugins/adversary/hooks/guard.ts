import type { Host } from './host'

export function normalise(path: string): string {
  const slashed = path.replace(/\\/g, '/')
  if (/^\/+$/.test(slashed)) return slashed === '/' ? '/' : ''
  return slashed.replace(/\/+$/, '').replace(/^[A-Za-z]:/, drive => drive.toLowerCase())
}

// Only Windows paths are case-insensitive; a POSIX root compares exactly.
const isWindowsRoot = (root: string) => /^[A-Za-z]:/.test(root) || /^[\\/]{2}/.test(root)

export function isUnder(root: string, realPath: string): boolean {
  const fold = (text: string) => (isWindowsRoot(root) ? text.toLowerCase() : text)
  const base = fold(normalise(root))
  const target = fold(normalise(realPath))
  if (base === '' || target.split('/').some(segment => segment === '.' || segment === '..')) return false
  return target === base || target.startsWith(base.endsWith('/') ? base : `${base}/`)
}

// A spelling the tool may open but `realPath` cannot place reliably.
export function isUnplaceable(path: string): boolean {
  const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  return (
    path === '' ||
    path.includes('\0') ||
    path.startsWith('~') ||
    /^[A-Za-z]:(?![\\/])/.test(path) ||
    /^[\\/]{2}/.test(path) ||
    /^[A-Za-z]:/.test(name)
  )
}

export async function checkPath(host: Host, path: string, root: string): Promise<boolean> {
  if (isUnplaceable(path)) return false
  const realPath = await host.realPath(path)
  return realPath !== undefined && isUnder(root, realPath) && !isWithheld(root, normalise(realPath).slice(normalise(root).length))
}

// The session's own instructions and settings and the repository's internals:
// the reviewer is meant to start with none of the author session's context.
const WITHHELD = ['.claude', '.git', 'CLAUDE.md', 'CLAUDE.local.md']

// Whether any segment of `rest`, a path or pattern below the root, is withheld.
function isWithheld(root: string, rest: string, separators = /[\\/{},]/): boolean {
  const fold = (text: string) => (isWindowsRoot(root) ? text.toLowerCase() : text)
  const withheld = WITHHELD.map(fold)
  return rest.split(separators).some(segment => withheld.includes(fold(segment)))
}

// A path a search reported, absolute or relative to where the tool ran. One
// that is not under the root cannot be told apart from the root's own part, so
// all of it counts.
function isWithheldPath(root: string, path: string): boolean {
  const rest = isAbsolute(path) && isUnder(root, path) ? normalise(path).slice(normalise(root).length) : path
  return isWithheld(root, rest, /[\\/]/)
}

// The part of `path` below the root, or all of it when it does not start there.
function belowRoot(root: string, path: string): string {
  const fold = (text: string) => (isWindowsRoot(root) ? text.toLowerCase() : text)
  const base = normalise(root)
  const target = normalise(path)
  const rest = fold(target).startsWith(fold(base.endsWith('/') ? base : `${base}/`)) ? target.slice(base.length) : path
  return rest.split(/[\\/]/).includes('..') ? path : rest
}

const LONGEST_WITHHELD = Math.max(...WITHHELD.map(name => name.length))
const endsPath = (char: string | undefined) => char === ':' || char === '-'

// A content line is `path:line:text` or `path-line-text`, or without -n
// `path:text` and `path-text`, and a path may itself hold `:` or `-`. So the
// path is taken to end at any `:` or `-`: the line names a withheld file if any
// such prefix of it does. That can only refuse too much, never too little.
function lineNamesWithheld(root: string, line: string): boolean {
  const rest = belowRoot(root, line)
  let lastEnd = -1
  for (let i = rest.length - 1; i >= 0; i--) {
    if (endsPath(rest[i])) {
      lastEnd = i
      break
    }
  }
  let start = 0
  for (const segment of rest.split(/[\\/]/)) {
    const end = start + segment.length
    // A whole segment, followed later by a place the path may end.
    if (end < lastEnd && isWithheld(root, segment, /[\\/]/)) return true
    // A segment the path ends inside: only a prefix as long as a withheld name can match.
    for (let j = 1; j <= Math.min(segment.length, LONGEST_WITHHELD); j++) {
      if (endsPath(segment[j]) && isWithheld(root, segment.slice(0, j), /[\\/]/)) return true
    }
    start = end + 1
  }
  return false
}

type GrepCall = { pattern: string; path?: string; glob?: string; type?: string; '-i'?: boolean; multiline?: boolean }

// The same search as `call`, listing every file it matches: no context, no
// head_limit (0 is unlimited) and no offset.
export function grepPreflight(call: GrepCall) {
  return {
    tool: 'Grep' as const,
    pattern: call.pattern,
    ...(call.path === undefined ? {} : { path: call.path }),
    ...(call.glob === undefined ? {} : { glob: call.glob }),
    ...(call.type === undefined ? {} : { type: call.type }),
    ...(call['-i'] === undefined ? {} : { '-i': call['-i'] }),
    ...(call.multiline === undefined ? {} : { multiline: call.multiline }),
    output_mode: 'files_with_matches' as const,
    head_limit: 0,
  }
}

export const isFileList = (result: unknown): boolean =>
  typeof result === 'object' && result !== null && Array.isArray((result as { filenames?: unknown }).filenames)

// Whether a Grep result names a withheld file: its `filenames`, or the path
// leading each line of its `content`.
export function grepNamesWithheld(root: string, result: unknown): boolean {
  if (typeof result !== 'object' || result === null) return false
  const { filenames, content } = result as { filenames?: unknown; content?: unknown }
  const named = Array.isArray(filenames) ? filenames.filter((name): name is string => typeof name === 'string') : []
  if (named.some(path => isWithheldPath(root, path))) return true
  return typeof content === 'string' && content.split(/\r?\n/).some(line => lineNamesWithheld(root, line))
}

export type ReviewerCall = { tool: string; file_path?: unknown; path?: unknown; pattern?: unknown; glob?: unknown }
export type Verdict = 'allow' | 'deny' | 'scope'

const isAbsoluteSpelling = (pattern: string) => /^([\\/]|[A-Za-z]:|~)/.test(pattern)
// `{src,/etc}` expands to an absolute pattern the anchor never sees.
const hasAbsoluteAlternative = (pattern: string) => /[{,]\s*([\\/~]|[A-Za-z]:)/.test(pattern)
const isAbsolute = (path: string) => /^([\\/]|[A-Za-z]:[\\/])/.test(path)

// The directory a glob is anchored at: everything before the segment holding its first wildcard.
function anchor(pattern: string): string {
  const wildcard = pattern.search(/[*?[{]/)
  if (wildcard === -1) return pattern
  const head = pattern.slice(0, wildcard)
  return head.slice(0, Math.max(head.lastIndexOf('/'), head.lastIndexOf('\\')) + 1)
}

// A reviewer's Read, Grep or Glob: every field naming a place must land under
// the root. Grep's `pattern` is a regex, not a place. A relative path is
// refused rather than resolved, since the tool and `realPath` may resolve it
// against different directories.
export async function judgeCall(host: Host, call: ReviewerCall, root: string): Promise<Verdict> {
  if (normalise(root) === '') return 'deny'
  const named = call.tool === 'Read' ? call.file_path : call.path
  if (named !== undefined && (typeof named !== 'string' || !isAbsolute(named))) return 'deny'
  const places: unknown[] = []
  if (call.tool === 'Read') places.push(call.file_path)
  else if (call.path !== undefined) places.push(call.path)

  const pattern = call.tool === 'Glob' ? call.pattern : call.tool === 'Grep' ? call.glob : undefined
  if (typeof pattern === 'string') {
    if (pattern.includes('..') || hasAbsoluteAlternative(pattern)) return 'deny'
    const absolute = isAbsoluteSpelling(pattern)
    const fixed = absolute ? anchor(pattern) : ''
    if (absolute) places.push(fixed)
    if (isWithheld(root, pattern.slice(fixed.length))) return 'deny'
  }

  for (const place of places) {
    if (typeof place !== 'string' || !(await checkPath(host, place, root))) return 'deny'
  }
  return call.tool !== 'Read' && call.path === undefined ? 'scope' : 'allow'
}
