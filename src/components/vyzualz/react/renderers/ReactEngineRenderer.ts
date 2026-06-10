import type { ReactPreset, ReactSectionType, ReactTrackSection } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { resolveSectionAtTime, sectionIntensityMultiplier, DEFAULT_REACT_RENDER_PARAMS } from './reactRenderUtils'
import { renderShaderPads }     from './ShaderPadsRenderer'
import { renderCinematicPortal } from './CinematicPortalRenderer'
import { renderSoundDrawing }    from './SoundDrawingRenderer'

export type { ReactFrameContext, ReactRenderParams }
export { DEFAULT_REACT_RENDER_PARAMS }

// Re-export the VzFrameContext converter for consumers
export { reactFrameFromVz } from './reactRenderUtils'

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

/**
 * Resolves the effective section type at the current audio time, respecting any
 * manual track section overrides from the React store.
 */
function resolveCurrentSectionType(
  sections: ReactTrackSection[],
  audioTime: number,
): ReactSectionType | null {
  const sec = resolveSectionAtTime(sections, audioTime)
  return sec?.type ?? null
}

/**
 * Main React engine entry point.  Call once per animation frame.
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
  const sectionType = resolveCurrentSectionType(manualSections, frame.audioTime)

  // Merge section intensity multiplier into effective params
  const secMul = sectionIntensityMultiplier(sectionType)

  // When sections are defined, intensity is modulated by the section multiplier.
  // When no sections are defined, use params.intensity directly (default 0.65 fallback).
  const effectiveIntensity = manualSections.length > 0
    ? params.intensity * secMul
    : params.intensity

  const effectiveParams: ReactRenderParams = {
    ...params,
    intensity: Math.max(0.05, effectiveIntensity),
  }

  switch (preset.engine) {
    case 'shaderPads':
      renderShaderPads(ctx, frame, preset, effectiveParams, sectionType)
      break
    case 'cinematicPortal':
      renderCinematicPortal(ctx, frame, preset, effectiveParams, sectionType)
      break
    case 'oscilloscope':
      renderSoundDrawing(ctx, frame, preset, effectiveParams, sectionType)
      break
    default:
      // Unknown engine — draw a placeholder so the frame is never blank
      ctx.fillStyle = preset.palette.background
      ctx.fillRect(0, 0, frame.W, frame.H)
  }
}
