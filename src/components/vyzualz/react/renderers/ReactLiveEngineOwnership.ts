import type { ReactPreset } from '../ReactTypes'

export type ReactLiveEngineId = Exclude<ReactPreset['engine'], 'cinema'>
export type ReactLiveEngineRetireReason = 'superseded' | 'unmount' | 'setup-failed' | 'render-failed' | 'test-reset'
export type ReactLiveEnginePhase = 'idle' | 'initializing' | 'stable'

export interface ReactLiveEngineSnapshot {
  generation: number
  engine: ReactLiveEngineId | null
  phase: ReactLiveEnginePhase
}

export interface ReactLiveEngineOwnershipHandle {
  readonly generation: number
  readonly engine: ReactLiveEngineId
  isCurrent(): boolean
  markStable(): void
  retire(reason?: ReactLiveEngineRetireReason): void
}

interface ReactLiveEngineOwnerRecord {
  generation: number
  engine: ReactLiveEngineId
  stable: boolean
  retired: boolean
  retireOwnedResources: (reason: ReactLiveEngineRetireReason) => void
}

type ReactLiveEngineListener = (snapshot: ReactLiveEngineSnapshot) => void

let nextGeneration = 1
let activeOwner: ReactLiveEngineOwnerRecord | null = null
const listeners = new Set<ReactLiveEngineListener>()

/**
 * Claims the one canonical React live-preview slot.
 *
 * Any previous owner is synchronously retired before the new caller is allowed
 * to initialize renderer resources. This keeps React effect timing, Suspense,
 * Strict Mode remounts, and rapid engine clicks from producing overlapping live
 * animation loops or WebGL ownership.
 */
export function acquireReactLiveEngineOwnership(
  engine: ReactLiveEngineId,
  retireOwnedResources: (reason: ReactLiveEngineRetireReason) => void,
): ReactLiveEngineOwnershipHandle {
  retireOwner(activeOwner, 'superseded')

  const owner: ReactLiveEngineOwnerRecord = {
    generation: nextGeneration++,
    engine,
    stable: false,
    retired: false,
    retireOwnedResources,
  }
  activeOwner = owner
  emitSnapshot()

  return {
    generation: owner.generation,
    engine: owner.engine,
    isCurrent: () => activeOwner === owner && !owner.retired,
    markStable: () => {
      if (activeOwner !== owner || owner.retired || owner.stable) return
      owner.stable = true
      emitSnapshot()
    },
    retire: (reason = 'unmount') => retireOwner(owner, reason),
  }
}

export function getReactLiveEngineSnapshot(): ReactLiveEngineSnapshot {
  if (!activeOwner) return { generation: 0, engine: null, phase: 'idle' }
  return {
    generation: activeOwner.generation,
    engine: activeOwner.engine,
    phase: activeOwner.stable ? 'stable' : 'initializing',
  }
}

export function isReactLiveEngineInitializing(): boolean {
  return activeOwner != null && !activeOwner.stable
}

export function subscribeReactLiveEngineOwnership(listener: ReactLiveEngineListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Wait until the active live preview has completed initialization or retired. */
export function waitForReactLiveEngineStable(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(createAbortError())
  if (!isReactLiveEngineInitializing()) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    let finished = false
    const finish = (error?: Error) => {
      if (finished) return
      finished = true
      unsubscribe()
      signal?.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    const abort = () => finish(createAbortError())
    const unsubscribe = subscribeReactLiveEngineOwnership(snapshot => {
      if (snapshot.phase !== 'initializing') finish()
    })
    signal?.addEventListener('abort', abort, { once: true })
  })
}

export function getReactLiveEngineOwnershipDiagnosticsForTests(): Readonly<{
  generation: number
  activeOwnerCount: number
  activeEngine: ReactLiveEngineId | null
  phase: ReactLiveEnginePhase
}> {
  const snapshot = getReactLiveEngineSnapshot()
  return {
    generation: snapshot.generation,
    activeOwnerCount: activeOwner ? 1 : 0,
    activeEngine: snapshot.engine,
    phase: snapshot.phase,
  }
}

export function resetReactLiveEngineOwnershipForTests(): void {
  retireOwner(activeOwner, 'test-reset')
  activeOwner = null
  nextGeneration = 1
  emitSnapshot()
}

function retireOwner(
  owner: ReactLiveEngineOwnerRecord | null,
  reason: ReactLiveEngineRetireReason,
): void {
  if (!owner || owner.retired) return
  owner.retired = true
  if (activeOwner === owner) activeOwner = null
  try {
    owner.retireOwnedResources(reason)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[ReactLiveEngineOwnership] renderer retirement failed:', error)
    }
  }
  emitSnapshot()
}

function emitSnapshot(): void {
  const snapshot = getReactLiveEngineSnapshot()
  for (const listener of [...listeners]) {
    try {
      listener(snapshot)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[ReactLiveEngineOwnership] ownership listener failed:', error)
      }
    }
  }
}

function createAbortError(): Error {
  if (typeof DOMException === 'function') return new DOMException('Aborted', 'AbortError')
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}
