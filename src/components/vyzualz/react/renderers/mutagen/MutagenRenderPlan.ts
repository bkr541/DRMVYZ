import { MAX_CANVAS_CONCURRENT_TRANSITIONS, MAX_CANVAS_FEEDBACK_PASSES } from '../../canvasPerformance/CanvasPerformanceTypes'
import type { CanvasMutagenSettings, MutagenPattern } from './MutagenSettings'

export const MUTAGEN_MAX_SOURCE_EDGE = 4096
export const MUTAGEN_MAX_OUTPUT_EDGE = 2560
export const MUTAGEN_MAX_TARGET_EDGE = 1920
export const MUTAGEN_MAX_TARGETS = 4

export function resolveMutagenQualityPlan(quality: CanvasMutagenSettings['quality'], width: number, height: number) {
  // Auto chooses a deterministic workload from output area, not an unstable
  // frame-rate measurement or an additional React render loop.
  const tier = quality === 'auto' ? (width * height > 1920 * 1080 ? 'low' : width * height > 960 * 540 ? 'balanced' : 'high') : quality
  const index = tier === 'low' ? 0 : tier === 'high' ? 2 : 1
  return {
    tier,
    renderScale: [0.75, 1, 1.25][index],
    maxEdge: [960, 1920, 2560][index],
    feedbackScale: [0.5, 0.75, 1][index],
    maxCells: [48, 80, 120][index],
    heightSteps: [10, 16, 24][index],
    voronoiCells: [5, 8, 11][index],
    maxTearBands: [12, 24, 48][index],
    maxRecursionDepth: [3, 4, 6][index],
  }
}

export type MutagenTransitionFrame = { from: MutagenPattern; to: MutagenPattern; mix: number; active: boolean }

/** One transition at a time. Rapid selection coalesces to the latest request;
 * the current pair finishes before starting it, without snapping or a third output. */
export class MutagenPatternTransition {
  private current: MutagenPattern | null = null
  private target: MutagenPattern | null = null
  private start = 0
  private duration = 0.55

  reset(): void { this.current = null; this.target = null }

  update(requested: MutagenPattern, time: number, duration: number): MutagenTransitionFrame {
    if (this.current === null) this.current = requested
    if (this.target !== null && (time < this.start || time >= this.start + this.duration)) {
      this.current = this.target; this.target = null
    }
    if (this.target === null && this.current !== requested && MAX_CANVAS_CONCURRENT_TRANSITIONS >= 1) {
      this.target = requested; this.start = time; this.duration = Math.max(0.1, Math.min(2, duration))
    }
    const progress = this.target === null ? 1 : Math.max(0, Math.min(1, (time - this.start) / this.duration))
    return { from: this.current, to: this.target ?? this.current, mix: progress * progress * (3 - 2 * progress), active: this.target !== null }
  }
}

export function resolveMutagenFramePlan(settings: CanvasMutagenSettings, width: number, height: number, transitioning = false) {
  const quality = resolveMutagenQualityPlan(settings.quality, width, height)
  const clean = settings.mutation === 0 || settings.sourceMix === 1
  const feedbackPasses: 0 | 1 = !clean && !transitioning && settings.feedback > 0 && MAX_CANVAS_FEEDBACK_PASSES >= 1 ? 1 : 0
  return {
    ...quality,
    clean,
    feedbackPasses,
    feedback: feedbackPasses ? settings.feedback * 0.85 * settings.mutation * (1 - settings.sourceMix) : 0,
    glow: clean ? 0 : settings.glow * settings.mutation * (1 - settings.sourceMix),
    cells: Math.round(quality.maxCells * (1 - settings.cellSize * 0.78)),
    tearBands: Math.min(settings.tearBands, quality.maxTearBands),
    recursionDepth: Math.min(settings.recursionDepth, quality.maxRecursionDepth),
    // Two transition targets + two history targets, regardless of switch count.
    maxTargets: MUTAGEN_MAX_TARGETS,
    maxDrawPasses: transitioning && !clean ? 3 : settings.glow > 0 && !clean ? 2 : 1,
  }
}
