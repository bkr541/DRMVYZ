import {
  ScopeSignalCore,
  resolveScopeCaptureFrames,
  type ScopeTrace,
  type StereoScopeFrame,
} from '../../../../audio/scope'
import type { OscillatorSettings } from '../ReactTypes'
import type { ReactFrameContext } from './reactRenderUtils'
import type { VectorBeamPoint } from '../vectorBeam/VectorBeamTypes'

/**
 * Geometry bridge between the professional scope signal core and Sound Drawing's
 * Canvas2D vector-beam rasterizer.
 *
 * Kept out of SoundDrawingRenderer so the mapping from normalized trace space to
 * canvas space is unit-testable without a canvas, and so the same mapping can be
 * reused by a GPU beam renderer later.
 */

/** One core per canvas context. WeakMap so a discarded canvas releases its DSP. */
const scopeCoresByContext = new WeakMap<CanvasRenderingContext2D, ScopeSignalCore>()

export function getScopeSignalCore(ctx: CanvasRenderingContext2D): ScopeSignalCore {
  const existing = scopeCoresByContext.get(ctx)
  if (existing) return existing
  const core = new ScopeSignalCore()
  scopeCoresByContext.set(ctx, core)
  return core
}

export function disposeScopeSignalCore(ctx: CanvasRenderingContext2D): void {
  scopeCoresByContext.delete(ctx)
}

/**
 * Capture frames the professional core needs for the current settings.
 *
 * Returns 0 when the professional path is not selected, which is the canvas's
 * signal to skip the stereo read entirely rather than copy a window nothing will
 * consume.
 */
export function resolveScopeCaptureRequestFrames(
  osc: OscillatorSettings,
  sampleRate: number,
): number {
  if (osc.sourceType !== 'classic') return 0
  if (osc.classicMode !== 'professionalScope') return 0
  const scope = osc.scope
  if (!scope) return 0

  // Sized from the widest window the timebase could select this frame, so a
  // cycle-locked display on low bass never runs short mid-acquisition.
  const widestWindowSeconds = Math.max(
    scope.timebase.secondsPerDisplay,
    scope.timebase.autoMaximumSeconds,
  )
  return resolveScopeCaptureFrames(
    widestWindowSeconds,
    scope.trigger.searchWindowSeconds,
    sampleRate,
  )
}

/** Adapts the React frame's stereo capture into the core's input shape. */
export function toStereoScopeFrame(frame: ReactFrameContext): StereoScopeFrame | null {
  const capture = frame.scopeStereo
  if (!capture) return null
  return {
    left: capture.left,
    right: capture.right,
    sampleRate: capture.sampleRate,
    startFrame: capture.startFrame,
    sequenceNumber: capture.sequenceNumber,
    audioTimeSeconds: capture.audioTimeSeconds,
    channelCount: capture.channelCount,
  }
}

export interface ScopeScreenGeometryOptions {
  W: number
  H: number
  /** Half-extent of the plotted figure, in pixels. */
  scalePx: number
  /** Vertical centre of the trace, in pixels. */
  centerY: number
  /** Horizontal centre, used by X/Y modes. */
  centerX: number
  /** Vertical offset applied to the secondary trace, in pixels. */
  secondaryOffsetPx: number
}

/**
 * Maps one resolved trace into canvas points.
 *
 * Y is negated: the signal core works in mathematical orientation where positive
 * is up, and canvas Y grows downward. Without this an anti-phase stereo pair
 * would render as the *positive* diagonal, inverting the one reading a
 * vectorscope exists to give.
 *
 * Writes into `out`, growing it only when the point count changes, so a steady
 * render loop reuses the same array.
 */
export function buildScopeTracePoints(
  trace: ScopeTrace,
  values: Float32Array,
  options: ScopeScreenGeometryOptions,
  out: VectorBeamPoint[],
  verticalOffsetPx = 0,
): number {
  const { W, scalePx, centerX, centerY } = options
  const count = trace.length
  if (count < 2) return 0

  if (out.length !== count) {
    out.length = count
    for (let i = 0; i < count; i++) out[i] = { x: 0, y: 0 }
  }

  if (trace.isXY) {
    for (let i = 0; i < count; i++) {
      const point = out[i]
      point.x = centerX + trace.x[i] * scalePx
      point.y = centerY - values[i] * scalePx + verticalOffsetPx
    }
    return count
  }

  // Waveform modes: X carries a normalised 0..1 time ramp across the display.
  for (let i = 0; i < count; i++) {
    const point = out[i]
    point.x = trace.x[i] * W
    point.y = centerY - values[i] * scalePx + verticalOffsetPx
  }
  return count
}

/**
 * True when the current settings ask for the professional core AND the frame
 * actually carries synchronized stereo capture.
 *
 * Both halves matter: selecting a stereo mode does not make stereo data exist,
 * and rendering a mono-derived figure under a stereo label would be exactly the
 * false claim this work set out to remove.
 */
export function canRenderProfessionalScope(
  osc: OscillatorSettings,
  frame: ReactFrameContext,
): boolean {
  if (osc.sourceType !== 'classic') return false
  if (osc.classicMode !== 'professionalScope') return false
  if (!osc.scope) return false
  const capture = frame.scopeStereo
  return capture != null && capture.left.length > 0
}
