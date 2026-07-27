// Optional galvo slew-limiting for vector-beam segments, mirroring the corner
// dwell / blanking / max angular velocity fields on LaserDmxScannerHead
// (renderers/laserDmx/LaserDmxScannerDomain.ts). Off by default: Sound Drawing's
// dwell/velocity heuristics (see buildVectorBeamSegmentsFromPoints) already give
// a good-looking result without this, so this exists purely as an optional,
// more "physically literal" mode a user can opt into.
//
// This is a simplified, visual-fidelity approximation, not a frame-accurate
// scanner simulator: it reuses the laser module's own scene-space-distance-to-
// angular-degrees convention (px * 90 / referenceExtent, see
// LaserDmxScannerDomain.travelDurationSeconds) rather than re-deriving true
// galvo mirror physics from scratch.
import type { VectorBeamSegment } from './VectorBeamTypes'

export interface VectorBeamScannerKinematicsSettings {
  enabled: boolean
  /** Extra dwell (microseconds) budgeted for sharp corners. Mirrors LaserDmxScannerHead.cornerDwellMicros. */
  cornerDwellMicros: number
  /** Blanking gap (microseconds) at corners sharp enough to demand a retrace. Mirrors LaserDmxScannerHead.blankingDelayMicros. */
  blankingDelayMicros: number
  /** Maximum sustained angular velocity (degrees/sec) the simulated galvo can hit. Mirrors LaserDmxScannerHead.maximumAngularVelocity. */
  maxAngularVelocityDegPerSec: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

const REFERENCE_FRAME_SECONDS = 1 / 30
/** Same scene-distance-to-degrees approximation LaserDmxScannerDomain uses for its own compatibility math. */
const PX_TO_DEG = 90 / 1000

/**
 * When `settings.enabled`, re-derives each segment's dwellWeight and
 * velocityRatio from simulated galvo slew limits: segments whose on-screen
 * travel would demand more angular velocity than `maxAngularVelocityDegPerSec`
 * sustains are throttled (lower velocityRatio, i.e. rendered as if the beam
 * were moving slower than the raw geometry implies), and corners sharp enough
 * to need `blankingDelayMicros` of retrace are dimmed toward blanked. No-op
 * (returns the input array unchanged) when disabled.
 */
export function applyVectorBeamScannerKinematics(
  segments: readonly VectorBeamSegment[],
  settings: VectorBeamScannerKinematicsSettings,
): readonly VectorBeamSegment[] {
  if (!settings.enabled || segments.length === 0) return segments

  return segments.map(segment => {
    const dx = segment.target.x - segment.origin.x
    const dy = segment.target.y - segment.origin.y
    const angularDistanceDeg = Math.hypot(dx, dy) * PX_TO_DEG
    const sustainableDeg = settings.maxAngularVelocityDegPerSec * REFERENCE_FRAME_SECONDS
    const velocityBoundRatio = clamp01(sustainableDeg / Math.max(1e-6, angularDistanceDeg))

    const cornerDwellBoost = clamp01(
      (segment.dwellWeight * settings.cornerDwellMicros) / Math.max(1, settings.cornerDwellMicros),
    )
    const needsBlank = segment.dwellWeight > 0.92 && settings.blankingDelayMicros > 0

    return {
      ...segment,
      dwellWeight: clamp01(segment.dwellWeight + cornerDwellBoost * 0.2),
      velocityRatio: clamp01(segment.velocityRatio * (0.5 + velocityBoundRatio * 0.5)),
      density: needsBlank ? segment.density * 0.15 : segment.density,
    }
  })
}

export const VECTOR_BEAM_SCANNER_KINEMATICS_DISABLED: VectorBeamScannerKinematicsSettings = {
  enabled: false,
  cornerDwellMicros: 64,
  blankingDelayMicros: 18,
  maxAngularVelocityDegPerSec: 18_000,
}
