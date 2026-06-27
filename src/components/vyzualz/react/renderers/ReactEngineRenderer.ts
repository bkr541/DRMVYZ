import type { ReactPreset, ReactSectionType, ReactTrackSection } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { resolveSectionAtTime, effectiveSectionIntensity, DEFAULT_REACT_RENDER_PARAMS } from './reactRenderUtils'
import { renderCinematicPortal } from './CinematicPortalRenderer'
import { renderSoundDrawing }    from './SoundDrawingRenderer'
import { renderLaserDmx, clearLaserDmxVisualState } from './LaserDmxRenderer'
import { renderNeonLattice, clearNeonLatticeVisualState } from './NeonLatticeRenderer'

export type { ReactFrameContext, ReactRenderParams }
export { DEFAULT_REACT_RENDER_PARAMS }

// Re-export the VzFrameContext converter for consumers
export { reactFrameFromVz } from './reactRenderUtils'

// ── Section resolution ────────────────────────────────────────────────────────

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
 * TODO: add scene-level OscillatorSettings blending here when needed.
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

  // TODO: add scene-level oscillator automation when needed
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
 * @param manualSections Manual track section definitions from reactStore
 */
export function renderReactEngine(
  ctx:            CanvasRenderingContext2D,
  frame:          ReactFrameContext,
  preset:         ReactPreset,
  params:         ReactRenderParams,
  manualSections: ReactTrackSection[] = [],
): void {
  // A user pause is a true frame hold across every React engine. Do not clear
  // gated engines and do not let idle/random animation mutate the last frame.
  if (frame.isPaused === true) return

  const { type: sectionType } = resolveCurrentSection(manualSections, frame.audioTime)
  const effectiveParams       = resolveEffectiveParams(preset, params, manualSections, frame.audioTime)

  switch (preset.engine) {
    case 'shaderPads':
      // Compatibility-only branch for legacy persisted state.
      // The former Canvas 2D Shader Pads renderer has been removed.
      clearNeonLatticeVisualState(ctx, frame.W, frame.H)
      ctx.fillStyle = preset.palette.background
      ctx.fillRect(0, 0, frame.W, frame.H)
      break
    case 'cinematicPortal':
      clearNeonLatticeVisualState(ctx, frame.W, frame.H)
      renderCinematicPortal(ctx, frame, preset, effectiveParams, sectionType)
      break
    case 'oscilloscope':
      clearNeonLatticeVisualState(ctx, frame.W, frame.H)
      renderSoundDrawing(ctx, frame, preset, effectiveParams, sectionType)
      break
    case 'laserDmx':
      // Level-1 gate: skip compilation entirely when not playing.
      // clearLaserDmxVisualState wipes trail persistence and resets compiler dt.
      clearNeonLatticeVisualState(ctx, frame.W, frame.H)
      if (frame.isPlaying === false) {
        clearLaserDmxVisualState(ctx, frame.W, frame.H)
      } else {
        renderLaserDmx(ctx, frame, preset, effectiveParams, sectionType)
      }
      break
    case 'neonLattice':
      if (frame.isPlaying === false) {
        clearNeonLatticeVisualState(ctx, frame.W, frame.H)
        ctx.fillStyle = preset.palette.background
        ctx.fillRect(0, 0, frame.W, frame.H)
      } else {
        renderNeonLattice(ctx, frame, effectiveParams, preset, sectionType)
      }
      break
    default:
      // Unknown engine — draw a placeholder so the frame is never blank
      clearNeonLatticeVisualState(ctx, frame.W, frame.H)
      ctx.fillStyle = preset.palette.background
      ctx.fillRect(0, 0, frame.W, frame.H)
  }
}
