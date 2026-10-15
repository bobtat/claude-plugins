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
