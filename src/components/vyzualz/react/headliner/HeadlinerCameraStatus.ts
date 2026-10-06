import { useSyncExternalStore } from 'react'
import type { HeadlinerCameraRuntime, HeadlinerCameraRuntimeSnapshot } from './HeadlinerCameraRuntime'

// The runtime lives with the Headliner surface (it owns the <video>), but the setup panel and the
// notification need its state too. The surface publishes its runtime here while it is mounted.
let activeRuntime: HeadlinerCameraRuntime | null = null
const listeners = new Set<() => void>()

export function publishHeadlinerCameraRuntime(runtime: HeadlinerCameraRuntime | null): void {
  if (activeRuntime === runtime) return
  activeRuntime = runtime
  listeners.forEach(listener => listener())
}

const subscribeActive = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const getActive = () => activeRuntime
const noopSubscribe = () => () => {}

/** The mounted Headliner surface's camera state, or null while no surface is mounted. */
export function useHeadlinerCameraStatus(): {
  snapshot: HeadlinerCameraRuntimeSnapshot | null
  retry: () => void
  disconnect: () => void
  connect: () => void
} {
  const runtime = useSyncExternalStore(subscribeActive, getActive, getActive)
  const snapshot = useSyncExternalStore(
    runtime ? runtime.subscribe : noopSubscribe,
    runtime ? runtime.getSnapshot : getNull,
    runtime ? runtime.getSnapshot : getNull,
  )
  return { snapshot, retry: () => runtime?.retry(), disconnect: () => runtime?.disconnect(), connect: () => runtime?.connect() }
}

const getNull = () => null
