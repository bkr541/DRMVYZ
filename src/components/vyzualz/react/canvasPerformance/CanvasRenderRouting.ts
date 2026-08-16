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
 * Once CANVAS enters authored Layers mode, the authored compositor owns the
 * output immediately. Readiness controls which layer sources can be drawn, not
 * which renderer owns the frame. Falling back to the direct renderer while
 * authored sources preload makes the Layers UI lie: Solo, reorder, enable, and
 * Add as Layer can all update state while a stale single source remains visible.
 *
 * The direct renderer's already-decoded active source is adopted by the preload
 * manager during the handoff, so the normal path remains visually continuous.
 */
export function canRenderCanvasAuthoredLayerFrame(
  frame: Pick<CanvasResolvedPerformanceFrame, 'readyMediaIds' | 'pendingMediaIds' | 'mediaErrors'> | null | undefined,
  _hasDirectFallback: boolean,
): boolean {
  return Boolean(frame)
}
