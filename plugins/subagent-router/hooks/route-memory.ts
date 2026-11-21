import type { Kind } from '../types'

// The routes this load turned off, beside the routeOff state that carries them across loads. Its own module, so the
// spawn hook that fills it and the command that reports it need not import each other.
export const routeOffHere = new Set<Kind>()

// The routes this load turned off, whether or not state took the write.
export const routesOffInMemory = (): Kind[] => [...routeOffHere]
