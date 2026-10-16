export interface PixGridDevelopmentSnapshot {
  activePresetId: string
  activeSceneId: string | null
  activeImageItemId: string | null
  sourceImageItemId: string | null
  destinationImageItemId: string | null
  requestedTransitionMode: string | null
  resolvedTransitionStrategy: string | null
  activeMotionProfileId: string | null
  transitionProgress: number
  scheduledStartBar: number | null
  scheduledArrivalBar: number | null
  compilationStatus: string | null
  preparedFrameCount: number
  activeWorkerJobs: number
  transitionCacheEntries: number
  transitionCacheBytes: number
  cacheHits: number
  cacheMisses: number
  transitionFallbackReason: string | null
  audioSignals: Readonly<Record<string, number | boolean>>
  frameRenderingCostMs: number
  updatedAtMs: number
}

let enabled = Boolean(import.meta.env.DEV)
let latest: Readonly<PixGridDevelopmentSnapshot> | null = null

export function setPixGridDevelopmentDiagnosticsEnabled(value: boolean): void { enabled = value }
export function getPixGridDevelopmentDiagnostics(): Readonly<PixGridDevelopmentSnapshot> | null { return latest }
export function clearPixGridDevelopmentDiagnostics(): void { latest = null }

export function publishPixGridDevelopmentDiagnostics(snapshot: PixGridDevelopmentSnapshot): void {
  if (!enabled) return
  latest = Object.freeze({ ...snapshot, audioSignals: Object.freeze({ ...snapshot.audioSignals }) })
}
