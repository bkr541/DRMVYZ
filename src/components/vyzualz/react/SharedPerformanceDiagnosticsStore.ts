import { useSyncExternalStore } from 'react'
import type {
  SharedPerformanceDiagnosticsEngine,
  SharedPerformanceDiagnosticsSnapshot,
} from '../../../features/performanceCore'

const snapshots: Partial<Record<SharedPerformanceDiagnosticsEngine, SharedPerformanceDiagnosticsSnapshot>> = {}
const listeners = new Set<() => void>()
const fingerprints: Partial<Record<SharedPerformanceDiagnosticsEngine, string>> = {}
const lastPublishedAt: Partial<Record<SharedPerformanceDiagnosticsEngine, number>> = {}
const DIAGNOSTICS_MIN_PUBLISH_INTERVAL_MS = 80
let revision = 0

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now()
}

export function publishSharedPerformanceDiagnostics(snapshot: SharedPerformanceDiagnosticsSnapshot): void {
  const previous = snapshots[snapshot.engine]
  const currentTime = nowMs()
  if (previous
    && previous.runtimeIdentity === snapshot.runtimeIdentity
    && previous.performanceShow === snapshot.performanceShow
    && previous.scene === snapshot.scene
    && currentTime - (lastPublishedAt[snapshot.engine] ?? 0) < DIAGNOSTICS_MIN_PUBLISH_INTERVAL_MS) return
  const nextFingerprint = JSON.stringify(snapshot)
  if (fingerprints[snapshot.engine] === nextFingerprint) return
  snapshots[snapshot.engine] = Object.freeze({
    ...snapshot,
    activeLayers: Object.freeze([...snapshot.activeLayers]),
    activeEventEnvelopes: Object.freeze([...snapshot.activeEventEnvelopes]),
    recentActions: Object.freeze([...snapshot.recentActions]),
    continuousRoutes: Object.freeze([...snapshot.continuousRoutes]),
    lockedParameters: Object.freeze([...snapshot.lockedParameters]),
    capabilityLimitations: Object.freeze([...snapshot.capabilityLimitations]),
    confidenceLimitations: Object.freeze([...snapshot.confidenceLimitations]),
    resourceLimitDecisions: Object.freeze([...snapshot.resourceLimitDecisions]),
  })
  fingerprints[snapshot.engine] = nextFingerprint
  lastPublishedAt[snapshot.engine] = currentTime
  revision += 1
  listeners.forEach(listener => listener())
}

export function clearSharedPerformanceDiagnostics(engine: SharedPerformanceDiagnosticsEngine): void {
  if (!snapshots[engine]) return
  delete snapshots[engine]
  delete fingerprints[engine]
  delete lastPublishedAt[engine]
  revision += 1
  listeners.forEach(listener => listener())
}

export function clearAllSharedPerformanceDiagnostics(): void {
  if (!Object.keys(snapshots).length) return
  for (const engine of Object.keys(snapshots) as SharedPerformanceDiagnosticsEngine[]) {
    delete snapshots[engine]
    delete fingerprints[engine]
    delete lastPublishedAt[engine]
  }
  revision += 1
  listeners.forEach(listener => listener())
}


export function retainSharedPerformanceDiagnosticsEngine(engine: SharedPerformanceDiagnosticsEngine | null): void {
  let changed = false
  for (const candidate of Object.keys(snapshots) as SharedPerformanceDiagnosticsEngine[]) {
    if (candidate !== engine) {
      delete snapshots[candidate]
      delete fingerprints[candidate]
      delete lastPublishedAt[candidate]
      changed = true
    }
  }
  if (!changed) return
  revision += 1
  listeners.forEach(listener => listener())
}

export function getSharedPerformanceDiagnostics(engine: SharedPerformanceDiagnosticsEngine): SharedPerformanceDiagnosticsSnapshot | null {
  return snapshots[engine] ?? null
}

export function subscribeSharedPerformanceDiagnostics(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSharedPerformanceDiagnostics(engine: SharedPerformanceDiagnosticsEngine): SharedPerformanceDiagnosticsSnapshot | null {
  return useSyncExternalStore(
    subscribeSharedPerformanceDiagnostics,
    () => {
      void revision
      return getSharedPerformanceDiagnostics(engine)
    },
    () => null,
  )
}
