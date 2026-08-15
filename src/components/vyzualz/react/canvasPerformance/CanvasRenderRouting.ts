import type {
  CanvasOrchestrationSettings,
  CanvasResolvedPerformanceFrame,
} from './CanvasPerformanceTypes'

/**
 * Active resolved orchestration owns show rendering. The selected Canvas preset
 * is intentionally absent because it owns only the direct-renderer fallback.
 */
export function canRenderCanvasOrchestrationFrame(
  orchestration: Pick<CanvasOrchestrationSettings, 'enabled'>,
  frame: Pick<CanvasResolvedPerformanceFrame, 'orchestrationActive' | 'readyMediaIds'> | null | undefined,
): boolean {
  return Boolean(
    orchestration.enabled
      && frame?.orchestrationActive
      && frame.readyMediaIds.length > 0,
  )
}

/**
 * Authored layers are allowed to take ownership as soon as at least one source
 * is drawable. While every source is still preloading, keep the direct renderer
 * visible so Add as Layer never flashes black. If every authored source has
 * resolved to an error, hand ownership to the authored stage anyway so its
 * load diagnostics are visible instead of leaving stale direct media on screen.
 */
export function canRenderCanvasAuthoredLayerFrame(
  frame: Pick<CanvasResolvedPerformanceFrame, 'readyMediaIds' | 'pendingMediaIds' | 'mediaErrors'> | null | undefined,
  hasDirectFallback: boolean,
): boolean {
  if (!frame) return false
  if (!hasDirectFallback) return true
  if (frame.readyMediaIds.length > 0) return true
  return frame.pendingMediaIds.length === 0 && frame.mediaErrors.length > 0
}
