export type PixGridWorkspaceDestination = 'routing' | 'events' | 'choreography' | 'analysis'

let destination: PixGridWorkspaceDestination | null = null
const listeners = new Set<(next: PixGridWorkspaceDestination) => void>()

export function requestPixGridWorkspace(next: PixGridWorkspaceDestination): void {
  destination = next
  listeners.forEach(listener => listener(next))
}

export function getRequestedPixGridWorkspace(): PixGridWorkspaceDestination | null {
  return destination
}

export function subscribePixGridWorkspace(listener: (next: PixGridWorkspaceDestination) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
