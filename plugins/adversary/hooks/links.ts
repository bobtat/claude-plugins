import { isUnder } from './guard'
import type { Host } from './host'

export const MAX_SCANNED_ENTRIES = 20_000

// Grep and Glob are judged by the directory they search, so a link beneath it
// that leads out of the root would let them read past the guard. Anything the
// walk cannot settle (an unresolvable link, an unreadable directory, a tree
// over the cap) counts as such a link.
export async function hasOutwardLinks(host: Host, root: string, cap = MAX_SCANNED_ENTRIES): Promise<boolean> {
  const pending = [root]
  let seen = 0
  while (pending.length > 0) {
    const dir = pending.pop() as string
    let entries
    try {
      entries = await host.list(dir)
    } catch {
      return true
    }
    for (const entry of entries) {
      if (++seen > cap) return true
      const path = /[\\/]$/.test(dir) ? `${dir}${entry.name}` : `${dir}/${entry.name}`
      if (entry.kind === 'dir' && !entry.isLink) {
        if (entry.name === '.git') continue
        // A junction or mount point can list as a plain directory.
        const realPath = await host.realPath(path)
        if (realPath === undefined || !isUnder(root, realPath)) return true
        pending.push(path)
      } else if (entry.isLink || entry.kind === 'other') {
        const realPath = await host.realPath(path)
        if (realPath === undefined || !isUnder(root, realPath)) return true
      }
    }
  }
  return false
}
