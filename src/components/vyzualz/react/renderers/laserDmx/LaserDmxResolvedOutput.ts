import type { LaserDmxSceneFrame } from './LaserDmxSceneFrame'
import type {
  CompiledLaserDmxBeamMatrixOutput,
  CompiledLaserDmxBeamMatrixResult,
} from '../LaserDmxBeamMatrixCompiler'

export const LASER_DMX_RESOLVED_OUTPUT_SCHEMA_VERSION = 1 as const

export interface LaserDmxResolvedOutputHierarchy {
  schemaVersion: typeof LASER_DMX_RESOLVED_OUTPUT_SCHEMA_VERSION
  authoredShowDimmer: number
  previewOutputTrim: number
  safetyClamp: number
  blackout: boolean
  authoredShowGlow: number
  previewGlowTrim: number
  resolvedPreviewIntensity: number
  resolvedHardwareIntensity: number
  resolvedPreviewGlow: number
  resolvedHardwareGlow: number
}

function clamp01(value: unknown, fallback = 0): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.min(1, number))
}

/**
 * Canonical backend-neutral LaserDMX output hierarchy.
 *
 * React-wide values are preview presentation trims. Beam Matrix output values
 * are authored show content. Safety and blackout remain final output-domain
 * authorities. Hardware values deliberately exclude preview trims.
 */
export function resolveLaserDmxOutputHierarchy(input: {
  authoredOutput: CompiledLaserDmxBeamMatrixOutput
  previewOutputTrim: number
  previewGlowTrim: number
}): LaserDmxResolvedOutputHierarchy {
  const authoredShowDimmer = clamp01(input.authoredOutput.masterDimmer, 1)
  const previewOutputTrim = clamp01(input.previewOutputTrim, 1)
  const safetyClamp = clamp01(input.authoredOutput.safetyClamp, 1)
  const blackout = input.authoredOutput.blackout === true
  const authoredShowGlow = clamp01(input.authoredOutput.globalGlow, 0)
  const previewGlowTrim = clamp01(input.previewGlowTrim, 1)
  const gate = blackout ? 0 : 1

  return Object.freeze({
    schemaVersion: LASER_DMX_RESOLVED_OUTPUT_SCHEMA_VERSION,
    authoredShowDimmer,
    previewOutputTrim,
    safetyClamp,
    blackout,
    authoredShowGlow,
    previewGlowTrim,
    resolvedPreviewIntensity: gate * authoredShowDimmer * safetyClamp * previewOutputTrim,
    resolvedHardwareIntensity: gate * authoredShowDimmer * safetyClamp,
    resolvedPreviewGlow: gate * authoredShowGlow * previewGlowTrim,
    resolvedHardwareGlow: gate * authoredShowGlow,
  })
}

function scaleSceneFrame(frame: LaserDmxSceneFrame, intensityScale: number): LaserDmxSceneFrame {
  const scale = clamp01(intensityScale, 1)
  const scaleColor = <T extends { a: number }>(color: T): T => ({ ...color, a: clamp01(color.a) } as T)
  return {
    ...frame,
    fixtures: frame.fixtures.map(fixture => ({
      ...fixture,
      color: scaleColor(fixture.color),
      intensity: clamp01(fixture.intensity * scale),
      enabled: fixture.enabled && scale > 0,
    })),
    beams: frame.beams.map(beam => ({
      ...beam,
      color: scaleColor(beam.color),
      intensity: clamp01(beam.intensity * scale),
      coreIntensity: clamp01(beam.coreIntensity * scale),
      opacity: clamp01(beam.opacity),
      enabled: beam.enabled && scale > 0,
    })),
    emitters: frame.emitters.map(emitter => ({
      ...emitter,
      color: scaleColor(emitter.color),
      intensity: clamp01(emitter.intensity * scale),
      totalActiveEnergy: Math.max(0, emitter.totalActiveEnergy * scale),
      peakRayIntensity: clamp01(emitter.peakRayIntensity * scale),
    })),
    scannerInstantaneousRays: frame.scannerInstantaneousRays.map(ray => ({
      ...ray,
      intensity: clamp01(ray.intensity * scale),
      blanked: ray.blanked || scale <= 0,
    })),
    exposureSamples: frame.exposureSamples.map(sample => ({
      ...sample,
      intensity: clamp01(sample.intensity * scale),
      blanked: sample.blanked || scale <= 0,
    })),
    // Preview intensity trims illumination, not authored fog/haze density.
    atmosphereSources: frame.atmosphereSources,
  }
}

/** Apply preview-only presentation trims to a hardware-safe authored scene. */
export function applyLaserDmxPreviewPresentation(
  frame: LaserDmxSceneFrame,
  hierarchy: LaserDmxResolvedOutputHierarchy,
): LaserDmxSceneFrame {
  const scaled = scaleSceneFrame(frame, hierarchy.previewOutputTrim)
  return {
    ...scaled,
    output: {
      ...scaled.output,
      previewOutputTrim: hierarchy.previewOutputTrim,
      previewGlowTrim: hierarchy.previewGlowTrim,
      safetyClamp: hierarchy.safetyClamp,
      resolvedPreviewIntensity: hierarchy.resolvedPreviewIntensity,
      resolvedHardwareIntensity: hierarchy.resolvedHardwareIntensity,
      resolvedPreviewGlow: hierarchy.resolvedPreviewGlow,
      resolvedHardwareGlow: hierarchy.resolvedHardwareGlow,
      globalGlow: hierarchy.resolvedPreviewGlow,
    },
  }
}

/**
 * Resolve the compiled Canvas2D compatibility frame before renderer dispatch.
 * The renderer receives already-resolved beam intensity and glow and therefore
 * uses neutral presentation scales, matching the WebGL scene-frame contract.
 */
export function applyLaserDmxPreviewToCompiledResult(
  result: CompiledLaserDmxBeamMatrixResult,
  hierarchy: LaserDmxResolvedOutputHierarchy,
): CompiledLaserDmxBeamMatrixResult {
  return {
    ...result,
    output: {
      ...result.output,
      globalGlow: hierarchy.resolvedPreviewGlow,
    },
    beams: result.beams.map(beam => ({
      ...beam,
      intensity: clamp01(beam.intensity * hierarchy.previewOutputTrim),
      glow: clamp01(beam.glow * hierarchy.previewGlowTrim),
    })),
  }
}
