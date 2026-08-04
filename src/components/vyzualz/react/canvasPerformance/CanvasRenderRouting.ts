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
