import { MAX_CANVAS_FEEDBACK_PASSES } from '../../canvasPerformance/CanvasPerformanceTypes'
import type { CanvasDataBleedSettings } from './DataBleedSettings'
export const DATA_BLEED_MAX_TRANSIENT_BYTES = 64 * 1024 * 1024
export const DATA_BLEED_MAX_SOURCE_EDGE = 4096
export function dataBleedSize(width: number, height: number, edge: number) {
  const k = Math.min(1, edge / Math.max(1, width, height))
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}
export function resolveDataBleedPlan(settings: CanvasDataBleedSettings, width: number, height: number, dpr = 1) {
  const tier = settings.quality === 'auto' ? (width * height > 1920 * 1080 ? 'low' : width * height > 960 * 540 ? 'balanced' : 'high') : settings.quality
  const i = tier === 'low' ? 0 : tier === 'balanced' ? 1 : 2
  return {
    tier, output: dataBleedSize(width * Math.max(1, Math.min(2, dpr)), height * Math.max(1, Math.min(2, dpr)), [960, 1920, 2560][i]),
    historyEdge: [640, 1280, 1920][i], motionEdge: [256, 512, 768][i],
    clean: settings.amount === 0 || settings.sourceMix === 1,
    feedbackPasses: Math.min(1, MAX_CANVAS_FEEDBACK_PASSES), maxTargets: 4, maxDrawPasses: 3,
  }
}
