import type { ReactEngineId, ReactPreset, ReactSectionType, ReactTrackSection } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { resolveSectionAtTime, effectiveSectionIntensity, DEFAULT_REACT_RENDER_PARAMS } from './reactRenderUtils'
import { disposeCinematicPortalRenderer, renderCinematicPortal } from './CinematicPortalRenderer'
import { disposeSoundDrawingRenderer, renderSoundDrawing } from './SoundDrawingRenderer'
import { renderLaserDmx, clearLaserDmxVisualState, disposeLaserDmxRenderer, pauseLaserDmxRenderer } from './LaserDmxRenderer'
import type { WebGLContextLifetime } from '../shaders/runtime/WebGLContextLifecycle'

export type { ReactFrameContext, ReactRenderParams }
export { DEFAULT_REACT_RENDER_PARAMS }

// Re-export the VzFrameContext converter for consumers
export { reactFrameFromVz } from './reactRenderUtils'

// ── Section resolution ────────────────────────────────────────────────────────

export interface ReactEngineRenderOptions {
  webglLifetime?: WebGLContextLifetime
}

export interface SectionResolution {
  /** Active section type, or null when no section matches. */
  type:     ReactSectionType | null
  /** Progress through the section, 0–1 (clamped). */
  progress: number
}

/**
 * Resolves the active section type and how far through it we are (0–1) at
 * the given audio time.  Returns `{ type: null, progress: 0 }` when no
 * manual section covers the time.
 */
export function resolveCurrentSection(
  sections:  ReactTrackSection[],
  audioTime: number,
): SectionResolution {
  const sec = resolveSectionAtTime(sections, audioTime)
  if (!sec) return { type: null, progress: 0 }
  const duration = sec.endSec - sec.startSec
  const progress = duration > 0
    ? Math.max(0, Math.min(1, (audioTime - sec.startSec) / duration))
    : 0
  return { type: sec.type, progress }
}

// ── Section automation resolver ───────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Blends base render params toward the active preset's scene params for the
 * given section type.  `sectionProgress` (0–1) is used to smoothly fade in
 * at the section start and out at the end.
 *
 * Returns base params unchanged when no matching scene is found.
 *
 */
export function resolveReactAutomation(
  preset:          ReactPreset,
  sectionType:     ReactSectionType | null,
  sectionProgress: number,
  baseParams:      ReactRenderParams,
): ReactRenderParams {
  if (!sectionType) return baseParams

  const mapping = preset.sectionMappings.find((m) => m.sectionType === sectionType)
  if (!mapping) return baseParams

  const scene = preset.scenes.find((s) => s.id === mapping.sceneId)
  if (!scene) return baseParams

  // Ease blend: ramp 0→1 over first 10% of section, hold, ramp 1→0 over last 10%
  const blend = sectionProgress < 0.1
    ? sectionProgress * 10
    : sectionProgress > 0.9
      ? (1 - sectionProgress) * 10
      : 1.0

  const sp = scene.params
  return {
    ...baseParams,
    intensity:      sp.intensity      != null ? lerp(baseParams.intensity,      sp.intensity,      blend) : baseParams.intensity,
    motion:         sp.motion         != null ? lerp(baseParams.motion,         sp.motion,         blend) : baseParams.motion,
    glow:           sp.glow           != null ? lerp(baseParams.glow,           sp.glow,           blend) : baseParams.glow,
    bassReactivity: sp.bassReactivity != null ? lerp(baseParams.bassReactivity, sp.bassReactivity, blend) : baseParams.bassReactivity,
  }
}

// ── Effective params resolver (exported for unit testing) ─────────────────────

/**
 * Computes the final ReactRenderParams for a frame by combining:
 *  1. Section intensity multiplier (only when manual sections are defined)
 *  2. Preset scene automation via resolveReactAutomation
 *
 * Exported so callers can verify blending without needing a canvas context.
 */
export function resolveEffectiveParams(
  preset:    ReactPreset,
  params:    ReactRenderParams,
  sections:  ReactTrackSection[],
  audioTime: number,
): ReactRenderParams {
  const { type: sectionType, progress: sectionProgress } =
    resolveCurrentSection(sections, audioTime)

  const activeSection = resolveSectionAtTime(sections, audioTime)
  const secMul = effectiveSectionIntensity(activeSection)
  const effectiveIntensity = sections.length > 0
    ? params.intensity * secMul
    : params.intensity

  const withIntensity: ReactRenderParams = {
    ...params,
    // Zero is an intentional blackout. Do not silently re-introduce output.
    intensity: Math.max(0, effectiveIntensity),
  }

  return resolveReactAutomation(preset, sectionType, sectionProgress, withIntensity)
}

// ── Main React engine entry point ─────────────────────────────────────────────

/**
 * Call once per animation frame.
 *
 * @param ctx            2D rendering context
 * @param frame          ReactFrameContext built from analyser + animation tick
 * @param preset         Active ReactPreset (engine + palette + params)
 * @param params         Live render parameters from the React control panel
 * @param trackSections Resolved automatic + manual track section timeline
 */
export function renderReactEngine(
  ctx:            CanvasRenderingContext2D,
  frame:          ReactFrameContext,
  preset:         ReactPreset,
  params:         ReactRenderParams,
  trackSections:  ReactTrackSection[] = [],
  options: ReactEngineRenderOptions = {},
): void {
  // A user pause is a true frame hold across every React engine. Do not clear
  // gated engines and do not let idle/random animation mutate the last frame.
  if (frame.isPaused === true) {
    if (preset.engine === 'laserDmx') pauseLaserDmxRenderer(ctx, frame.audioTime)
    return
  }

  const { type: sectionType } = resolveCurrentSection(trackSections, frame.audioTime)
  const effectiveParams       = resolveEffectiveParams(preset, params, trackSections, frame.audioTime)

  switch (preset.engine) {
    case 'shaderPads':
      // Compatibility-only branch for legacy persisted state.
      // The former Canvas 2D Shader Pads renderer has been removed.
      ctx.clearRect(0, 0, frame.W, frame.H)
      ctx.fillStyle = preset.palette.background
      ctx.fillRect(0, 0, frame.W, frame.H)
      break
    case 'cinematicPortal':
      renderCinematicPortal(
        ctx, frame, preset, effectiveParams, sectionType,
        options.webglLifetime ?? 'live-reusable',
      )
      break
    case 'oscilloscope':
      renderSoundDrawing(ctx, frame, preset, effectiveParams, sectionType)
      break
    case 'laserDmx':
      // Level-1 gate: skip compilation entirely when not playing.
      // clearLaserDmxVisualState wipes trail persistence and resets compiler dt.
      if (frame.isPlaying === false) {
        clearLaserDmxVisualState(ctx, frame.W, frame.H)
      } else {
        renderLaserDmx(ctx, frame, preset, effectiveParams, sectionType)
      }
      break
    default:
      // Unknown engine — draw a placeholder so the frame is never blank
      ctx.clearRect(0, 0, frame.W, frame.H)
      ctx.fillStyle = preset.palette.background
      ctx.fillRect(0, 0, frame.W, frame.H)
  }
}


export interface ReactEngineDisposalOptions {
  width?: number
  height?: number
  affectProductionOutput?: boolean
}

/**
 * Retires resources owned by one non-shader React engine family. The parent
 * canvas owns the animation loop; this function owns family-specific caches,
 * listeners, observers, and GPU runtimes reached through the Canvas2D context.
 */
export function disposeReactEngineRenderer(
  ctx: CanvasRenderingContext2D,
  engine: ReactEngineId,
  options: ReactEngineDisposalOptions = {},
): void {
  const width = options.width ?? ctx.canvas.width
  const height = options.height ?? ctx.canvas.height
  switch (engine) {
    case 'cinematicPortal':
      disposeCinematicPortalRenderer(ctx, 'release-resources')
      break
    case 'laserDmx':
      clearLaserDmxVisualState(ctx, width, height, {
        affectProductionOutput: options.affectProductionOutput,
      })
      disposeLaserDmxRenderer(ctx, {
        affectProductionOutput: options.affectProductionOutput,
      })
      break
    case 'oscilloscope':
      disposeSoundDrawingRenderer(ctx)
      break
    case 'shaderPads':
      // Shader Pads owns a dedicated canvas and ShaderEngineRenderer lifecycle.
      break
  }
}
