import type { Quality } from '../stores/visualStore'

export type WarningLevel = 'ok' | 'caution' | 'critical'

export type RendererType = 'canvas2d' | 'webgl2'

export interface PerformanceStats {
  fps:               number
  averageFps:        number
  droppedFrameCount: number   // frames exceeding 33ms render budget per window
  frameTimeMs:       number   // most recent inter-frame delta (ms)
  avgFrameDeltaMs:   number   // average inter-frame delta across last reporting window
  worstFrameDeltaMs: number   // worst inter-frame delta in last reporting window
  framesOver60:      number   // frames that missed 60fps budget (>16.7ms) in window
  framesOver30:      number   // frames that missed 30fps budget (>33.3ms) in window
  videoTotalFrames:  number   // cumulative frames decoded by active video element
  videoDroppedFrames: number  // cumulative frames dropped by active video element
  canvasWidth:       number
  canvasHeight:      number
  dpr:               number   // effective DPR after both cap and pixel budget
  renderScale:       number   // pixel-budget scale factor (<1 when budget was applied)
  quality:           Quality
  autoQualityEnabled: boolean
  autoQualityReason:  string
  activeMediaLoaded: boolean
  missingMediaCount: number
  activeEffectCount: number
  warningLevel:      WarningLevel
  // Video lifecycle diagnostics
  videoElementCount: number   // total managed video elements in canvas system
  videoPlayingCount: number   // currently playing
  // Renderer
  rendererType: RendererType
  gpuEffects:   string[]      // effects handled by GPU path (empty when canvas2d)
  rendererFallbackReason: string | null  // set when WebGL2 was requested but unavailable
  contextLost: boolean                   // true while WebGL2 context is lost
}

export const DEFAULT_PERFORMANCE_STATS: PerformanceStats = {
  fps: 0, averageFps: 0, droppedFrameCount: 0,
  frameTimeMs: 0, avgFrameDeltaMs: 0, worstFrameDeltaMs: 0,
  framesOver60: 0, framesOver30: 0,
  videoTotalFrames: 0, videoDroppedFrames: 0,
  canvasWidth: 0, canvasHeight: 0, dpr: 1, renderScale: 1, quality: 'High',
  autoQualityEnabled: false, autoQualityReason: '',
  activeMediaLoaded: false, missingMediaCount: 0, activeEffectCount: 0,
  warningLevel: 'ok',
  videoElementCount: 0, videoPlayingCount: 0,
  rendererType: 'canvas2d', gpuEffects: [],
  rendererFallbackReason: null, contextLost: false,
}
