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
  return realPath !== undefined && isUnder(root, realPath)
}

export type ReviewerCall = { tool: string; file_path?: unknown; path?: unknown; pattern?: unknown; glob?: unknown }
export type Verdict = 'allow' | 'deny' | 'scope'

const isAbsoluteSpelling = (pattern: string) => /^([\\/]|[A-Za-z]:|~)/.test(pattern)
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
    if (pattern.includes('..')) return 'deny'
    if (isAbsoluteSpelling(pattern)) places.push(anchor(pattern))
  }

  for (const place of places) {
    if (typeof place !== 'string' || !(await checkPath(host, place, root))) return 'deny'
  }
  return call.tool !== 'Read' && call.path === undefined ? 'scope' : 'allow'
}
