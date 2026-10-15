import type { Host } from './host'

export function normalise(path: string): string {
  const slashed = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return slashed.replace(/^[A-Za-z]:/, drive => drive.toLowerCase())
}

export function isUnder(root: string, realPath: string): boolean {
  const base = normalise(root).toLowerCase()
  const target = normalise(realPath).toLowerCase()
  return target === base || target.startsWith(`${base}/`)
}

// A spelling the tool may open but `realPath` cannot place reliably.
export function isUnplaceable(path: string): boolean {
  const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  return (
    path === '' ||
    path.includes('\0') ||
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
