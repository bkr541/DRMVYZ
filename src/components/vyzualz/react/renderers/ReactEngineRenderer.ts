import type { ReactEngineId, ReactPreset, ReactSectionType, ReactTrackSection } from '../ReactTypes'
import { PixGridStructuralChoreographer } from '../pixGrid/PixGridStructuralChoreographer'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { resolveSectionAtTime, effectiveSectionIntensity, DEFAULT_REACT_RENDER_PARAMS } from './reactRenderUtils'
import { disposeCinematicPortalRenderer, renderCinematicPortal } from './CinematicPortalRenderer'
import { disposeSoundDrawingRenderer, pauseSoundDrawingRenderer, renderSoundDrawing } from './SoundDrawingRenderer'
import { renderLaserDmx, clearLaserDmxVisualState, disposeLaserDmxRenderer, pauseLaserDmxRenderer } from './LaserDmxRenderer'
import type { WebGLContextLifetime } from '../shaders/runtime/WebGLContextLifecycle'
import { createPixGridStateForPreset, disposePixGridBaselineRenderer, renderPixGridBaseline } from './pixGrid/PixGridBaselineRenderer'


/**
 * The Canvas 2D engine path has no unified performance runtime, so it owns a
 * choreographer directly. Sequential single-surface rendering makes a
 * module-scoped instance safe here, matching the existing per-engine visual
 * state kept in this module.
 */
const pixGridChoreographer = new PixGridStructuralChoreographer()
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
  sections:  readonly ReactTrackSection[],
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
  sections:  readonly ReactTrackSection[],
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
  trackSections:  readonly ReactTrackSection[] = [],
  options: ReactEngineRenderOptions = {},
): void {
  // A user pause is a true frame hold across every React engine. Do not clear
  // gated engines and do not let idle/random animation mutate the last frame.
  if (frame.isPaused === true) {
    if (preset.engine === 'laserDmx') pauseLaserDmxRenderer(ctx, frame.audioTime)
    if (preset.engine === 'oscilloscope') pauseSoundDrawingRenderer(ctx)
    return
  }

  // Track Map owns the merged automatic/imported/manual timeline. Prefer the
  // explicit timeline supplied by ReactView; the MI bus can still hold the
  // previous revision for one or more frames after edits, analysis completion,
  // track replacement, or seeks.
  const authoritativeSections = trackSections
  const sectionResolution = frame.resolvedSection
    ? { type: frame.resolvedSection.type, progress: frame.resolvedSection.progress }
    : resolveCurrentSection(authoritativeSections, frame.audioTime)
  const sectionType = sectionResolution.type
  const effectiveParams = resolveEffectiveParams(preset, params, authoritativeSections, frame.audioTime)

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
    case 'canvas':
      // CANVAS owns a dedicated placeholder surface until media playback lands.
      ctx.clearRect(0, 0, frame.W, frame.H)
      ctx.fillStyle = preset.palette.background
      ctx.fillRect(0, 0, frame.W, frame.H)
      break
    case 'pixGrid': {
      const basePixGridState = createPixGridStateForPreset(preset)
      const mappedSceneId = sectionType
        ? preset.sectionMappings.find(mapping => mapping.sectionType === sectionType)?.sceneId
        : null
      renderPixGridBaseline(ctx, {
        width: frame.W,
        height: frame.H,
        audioTime: frame.audioTime,
        bass: frame.audio.bass,
        mid: frame.audio.mid,
        high: frame.audio.high,
        volume: frame.audio.volume,
        beatHit: frame.beatHit,
        kickHit: frame.musicIntelligence?.rhythm.kickHit ?? frame.beatHit,
        snareHit: frame.musicIntelligence?.rhythm.snareHit
          ?? (frame.beatHit && Math.floor(frame.audioTime * frame.bpm / 60) % 4 % 2 === 1),
        hatHit: frame.musicIntelligence?.rhythm.hatHit
          ?? (frame.audio.high > 0.45 && frame.beatPhase < 0.12),
        beatPhase: frame.beatPhase,
        beatIndex: Math.max(0, Math.floor(frame.audioTime * frame.bpm / 60)),
        isPlaying: frame.isPlaying !== false,
        motion: effectiveParams.motion,
        intensity: effectiveParams.intensity,
        glow: effectiveParams.glow,
        bassReactivity: effectiveParams.bassReactivity,
      }, preset, mappedSceneId ? { ...basePixGridState, selectedSceneId: mappedSceneId } : basePixGridState,
        undefined,
        undefined,
        null,
        [],
        undefined,
        pixGridChoreographer.evaluate({
          audioTime: frame.audioTime,
          bass: frame.audio.bass,
          mid: frame.audio.mid,
          high: frame.audio.high,
          volume: frame.audio.volume,
          beatHit: frame.beatHit,
          beatPhase: frame.beatPhase,
          isPlaying: frame.isPlaying !== false,
          sectionType,
          sectionProgress: sectionResolution.progress,
          barIndex: Math.max(0, Math.floor(frame.audioTime * frame.bpm / 60 / 4)),
          barEntry: frame.beatHit && Math.floor(frame.audioTime * frame.bpm / 60) % 4 === 0,
          kickHit: frame.musicIntelligence?.rhythm.kickHit ?? frame.beatHit,
        }),
      )
      break
    }
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
    case 'canvas':
      // CANVAS renders a React shell, not the live canvas renderer yet.
      break
    case 'pixGrid':
      disposePixGridBaselineRenderer()
      break
  }
}
