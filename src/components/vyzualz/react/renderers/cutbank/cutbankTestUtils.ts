import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { CanvasMediaItem } from '../../ReactTypes'
import type { CanvasMediaPool } from '../../canvasPerformance/CanvasPerformanceTypes'
import { DEFAULT_CANVAS_CUTBANK_SETTINGS, normalizeCanvasCutbankSettings, type CanvasCutbankSettings } from './CutbankSettings'

export function testSettings(patch: Partial<CanvasCutbankSettings> = {}): CanvasCutbankSettings {
  return normalizeCanvasCutbankSettings({ ...DEFAULT_CANVAS_CUTBANK_SETTINGS, ...patch })
}

/** A canonical-BPM context at an absolute beat, built on the shared fallback context. */
export function testContext(beat: number, patch: Partial<SharedPerformanceContext> = {}, bpm = 120): SharedPerformanceContext {
  const base = createSharedPerformanceFallbackContext((beat * 60) / bpm)
  const whole = Math.floor(beat)
  return {
    ...base,
    bpm,
    timeSignature: 4,
    absoluteBeat: whole,
    beatPhase: beat - whole,
    beatIndex: whole % 4,
    beatWithinBar: whole % 4,
    absoluteBar: Math.floor(whole / 4),
    absoluteTrackBarIndex: Math.floor(whole / 4),
    audioTimeSec: (beat * 60) / bpm,
    trackIdentity: 'track-a',
    ...patch,
  }
}

export function testMedia(id: string, type: CanvasMediaItem['type'] = 'image'): CanvasMediaItem {
  return { id, name: id, type, objectUrl: `blob:${id}`, createdAt: '2026-01-01T00:00:00.000Z', width: 1600, height: 900 }
}

export function testPool(mediaIds: string[], texts: string[] = [], id = 'pool-1'): CanvasMediaPool {
  return { id, name: 'Pool', mediaIds, textItems: texts.map((text, index) => ({ id: `t${index}`, text })) }
}
