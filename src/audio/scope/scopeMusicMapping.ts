// ── scopeMusicMapping ─────────────────────────────────────────────────────────
//
// Maps Music Intelligence signals onto the professional scope's render values.
//
// This is the seam that keeps the scope part of DRMVYZ rather than a bolted-on
// instrument: the signal core supplies measurement-grade geometry, and this layer
// lets the *presentation* respond to the music without touching the geometry. A
// beat can brighten the bloom; it can never move the trace, because moving the
// trace would falsify the reading.
//
// Deliberately narrow input. It takes a handful of already-resolved scalars
// rather than a MusicIntelligenceFrame, so the mapping is unit-testable without
// constructing an MI frame and cannot quietly grow a dependency on MI's full
// shape. The renderer adapts.
//
// Everything returned is a *multiplier*. The user's own tuning stays
// authoritative and the music scales it, so turning every amount to zero returns
// exactly the unmodulated look rather than some other look.

export interface ScopeMusicMappingSettings {
  /** 0..1 how much a beat lifts the bloom. */
  beatBloom: number
  /** 0..1 how much a kick widens the beam. */
  kickWidth: number
  /** 0..1 how much bass energy raises exposure. */
  bassExposure: number
  /** 0..1 how much build progress raises exposure toward a drop. */
  buildExposure: number
  /** 0..1 how much a drop shortens persistence, snapping the trail tighter. */
  dropSnap: number
}

/**
 * All amounts default to zero, which is the identity mapping.
 *
 * That makes the migration that introduced this appearance-preserving by
 * construction: an existing project picks up the feature switched on but neutral,
 * and presets are what dial it in.
 */
export const DEFAULT_SCOPE_MUSIC_MAPPING: ScopeMusicMappingSettings = {
  beatBloom: 0,
  kickWidth: 0,
  bassExposure: 0,
  buildExposure: 0,
  dropSnap: 0,
}

/** Already-resolved musical scalars. All 0..1; -1 means "unknown". */
export interface ScopeMusicalInput {
  /** Decaying pulse on each beat. */
  beatEnvelope: number
  /** Decaying pulse on each kick. */
  kickEnvelope: number
  /** Low-band energy. */
  bass: number
  /** Progress through a build, or -1 when no build is active. */
  buildProgress: number
  /** Impact of a drop moment, or 0 when none. */
  dropImpact: number
}

export const NEUTRAL_SCOPE_MUSICAL_INPUT: ScopeMusicalInput = {
  beatEnvelope: 0,
  kickEnvelope: 0,
  bass: 0,
  buildProgress: -1,
  dropImpact: 0,
}

export interface ScopeMusicModulation {
  glowMultiplier: number
  beamWidthMultiplier: number
  exposureMultiplier: number
  persistenceMultiplier: number
}

export const IDENTITY_SCOPE_MODULATION: ScopeMusicModulation = {
  glowMultiplier: 1,
  beamWidthMultiplier: 1,
  exposureMultiplier: 1,
  persistenceMultiplier: 1,
}

/**
 * Upper bounds on each multiplier.
 *
 * A musical spike must not be able to blow out the display or freeze the trail.
 * These are hard ceilings rather than suggestions: Music Intelligence values come
 * from live analysis, and a transient mis-detection should cost a slightly wrong
 * frame, not an unreadable one.
 */
const MAX_GLOW_MULTIPLIER = 2.5
const MAX_WIDTH_MULTIPLIER = 2.2
const MAX_EXPOSURE_MULTIPLIER = 2
const MIN_PERSISTENCE_MULTIPLIER = 0.25

/**
 * Resolves the frame's modulation.
 *
 * Note what is absent: nothing here scales the trace's geometry, position, or
 * signal path. Only presentation — bloom, beam width, exposure, persistence. A
 * measurement display that moved with the music would no longer be measuring
 * anything, so that boundary is structural rather than a matter of taste.
 */
export function resolveScopeMusicModulation(
  settings: ScopeMusicMappingSettings,
  input: ScopeMusicalInput,
): ScopeMusicModulation {
  const beat = clamp01(input.beatEnvelope)
  const kick = clamp01(input.kickEnvelope)
  const bass = clamp01(input.bass)
  // -1 means no build is active; treating that as 0 progress would make every
  // ordinary passage look like the start of a build.
  const build = input.buildProgress >= 0 ? clamp01(input.buildProgress) : 0
  const drop = clamp01(input.dropImpact)

  const glow = 1 + beat * clamp01(settings.beatBloom) * (MAX_GLOW_MULTIPLIER - 1)
  const width = 1 + kick * clamp01(settings.kickWidth) * (MAX_WIDTH_MULTIPLIER - 1)
  const exposure =
    1 +
    (bass * clamp01(settings.bassExposure) + build * clamp01(settings.buildExposure)) *
      (MAX_EXPOSURE_MULTIPLIER - 1)
  const persistence = 1 - drop * clamp01(settings.dropSnap) * (1 - MIN_PERSISTENCE_MULTIPLIER)

  return {
    glowMultiplier: clamp(glow, 1, MAX_GLOW_MULTIPLIER),
    beamWidthMultiplier: clamp(width, 1, MAX_WIDTH_MULTIPLIER),
    exposureMultiplier: clamp(exposure, 1, MAX_EXPOSURE_MULTIPLIER),
    persistenceMultiplier: clamp(persistence, MIN_PERSISTENCE_MULTIPLIER, 1),
  }
}

/** True when the settings would leave every value untouched. */
export function isScopeMusicMappingNeutral(settings: ScopeMusicMappingSettings): boolean {
  return (
    settings.beatBloom === 0 &&
    settings.kickWidth === 0 &&
    settings.bassExposure === 0 &&
    settings.buildExposure === 0 &&
    settings.dropSnap === 0
  )
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}
