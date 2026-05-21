import type { Quality } from '../stores/visualStore'

export type WarningLevel = 'ok' | 'caution' | 'critical'

export interface PerformanceStats {
  fps:               number
  averageFps:        number
  droppedFrameCount: number
  frameTimeMs:       number
  canvasWidth:       number
  canvasHeight:      number
  dpr:               number
  quality:           Quality
  activeMediaLoaded: boolean
  missingMediaCount: number
  warningLevel:      WarningLevel
}

export const DEFAULT_PERFORMANCE_STATS: PerformanceStats = {
  fps: 0, averageFps: 0, droppedFrameCount: 0, frameTimeMs: 0,
  canvasWidth: 0, canvasHeight: 0, dpr: 1, quality: 'High',
  activeMediaLoaded: false, missingMediaCount: 0, warningLevel: 'ok',
}
