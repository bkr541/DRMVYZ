import { useSyncExternalStore } from 'react'
import type { PixGridUnifiedRuntimeDiagnostics } from './PixGridUnifiedPerformanceRuntime'
import type { PixGridAudioFrame, PixGridReactionSource, PixGridRendererDiagnostics } from './PixGridTypes'

export interface PixGridReactivityRuntimeSnapshot {
  audioFrame: PixGridAudioFrame | null
  runtime: PixGridUnifiedRuntimeDiagnostics | null
  renderer: PixGridRendererDiagnostics | null
  updatedAt: number
}

const EMPTY: PixGridReactivityRuntimeSnapshot = Object.freeze({
  audioFrame: null,
  runtime: null,
  renderer: null,
  updatedAt: 0,
})

let snapshot = EMPTY
const listeners = new Set<() => void>()
const STATUS_NOTIFICATION_INTERVAL_MS = 80
let lastNotificationAt = 0
let notificationTimer: ReturnType<typeof setTimeout> | null = null

function notifyListeners(): void {
  notificationTimer = null
  lastNotificationAt = Date.now()
  listeners.forEach(listener => listener())
}

function publish(next: Partial<PixGridReactivityRuntimeSnapshot>): void {
  const now = Date.now()
  snapshot = Object.freeze({ ...snapshot, ...next, updatedAt: now })
  if (now - lastNotificationAt >= STATUS_NOTIFICATION_INTERVAL_MS) {
    if (notificationTimer != null) clearTimeout(notificationTimer)
    notifyListeners()
    return
  }
  if (notificationTimer == null) {
    notificationTimer = setTimeout(notifyListeners, STATUS_NOTIFICATION_INTERVAL_MS - (now - lastNotificationAt))
  }
}

export function publishPixGridAudioAnalysis(frame: PixGridAudioFrame, runtime: PixGridUnifiedRuntimeDiagnostics): void {
  publish({ audioFrame: frame, runtime })
}

export function publishPixGridRendererDiagnostics(renderer: PixGridRendererDiagnostics): void {
  publish({ renderer })
}

export function clearPixGridReactivityRuntimeStatus(): void {
  if (notificationTimer != null) clearTimeout(notificationTimer)
  notificationTimer = null
  snapshot = EMPTY
  notifyListeners()
}

export function getPixGridReactivityRuntimeStatus(): PixGridReactivityRuntimeSnapshot {
  return snapshot
}

export function usePixGridReactivityRuntimeStatus(): PixGridReactivityRuntimeSnapshot {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getPixGridReactivityRuntimeStatus,
    () => EMPTY,
  )
}

export interface PixGridPreviewSource {
  source: PixGridReactionSource
  identity: string
  expiresAt: number
}

let previewSequence = 0
let previewSource: PixGridPreviewSource | null = null

export function triggerPixGridPreviewSource(source: PixGridReactionSource, durationMs = 450): PixGridPreviewSource {
  previewSequence += 1
  previewSource = {
    source,
    identity: `pix-grid-editor-preview:${source}:${previewSequence}`,
    expiresAt: Date.now() + Math.max(60, Math.min(2_000, durationMs)),
  }
  return previewSource
}

export function getPixGridPreviewSource(): PixGridPreviewSource | null {
  if (previewSource && previewSource.expiresAt <= Date.now()) previewSource = null
  return previewSource
}

export function clearPixGridPreviewSource(): void {
  previewSource = null
}
