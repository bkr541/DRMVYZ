import type { Cinema2MarqueeFixtureKind } from './Cinema2MarqueeDomain'

/**
 * MARQUEE's authored emission and surface calibration. Structural light, bulb emission, neon and letterboard light are separate values
 * so each can be balanced without touching bloom (bloom, haze and exposure live in the preset manifest's effect parameters).
 *
 * Fixture values are linear HDR multipliers of the family colour: `base` is the unlit/idle glow, `peak` the extra level at full pattern gain.
 */
export const MARQUEE_LOOK = Object.freeze({
  /** Defaults of the Architectural Accent and Marquee Red palette colours; the brick/velvet tint is exactly 1 at these. */
  defaultArchitecture: [0.19, 0.11, 0.075] as const,
  defaultMarquee: [0.86, 0.035, 0.025] as const,
  fixtureBase: Object.freeze({
    'marquee-front': 0.5, 'marquee-left': 0.5, 'marquee-right': 0.5, canopy: 0.5,
    'tower-left': 0.55, 'tower-right': 0.55, 'led-left': 0.35, 'led-right': 0.35,
    'neon-red': 0.45, 'neon-amber': 0.45, 'neon-blue': 0.35, 'crowd-flash': 0,
  } as Readonly<Record<Cinema2MarqueeFixtureKind, number>>),
  fixturePeak: Object.freeze({
    'marquee-front': 3.0, 'marquee-left': 3.0, 'marquee-right': 3.0, canopy: 3.2,
    'tower-left': 3.2, 'tower-right': 3.2, 'led-left': 2.0, 'led-right': 2.0,
    'neon-red': 1.5, 'neon-amber': 1.5, 'neon-blue': 1.1, 'crowd-flash': 9,
  } as Readonly<Record<Cinema2MarqueeFixtureKind, number>>),
  /** Fixture level = base + peak * gain^curve. A curve above 1 keeps mid-gain bulbs visibly dimmer than peak ones, so travelling patterns read instead of saturating to cream. */
  fixtureCurve: 1.8,
  /** Letterboard emission as a multiple of the texture's own colour (lettering stays dark). */
  signBase: 0.06,
  signPeak: 0.32,
  interiorEmission: 1.5,
  /** Image-based light level: low, so the facade is lit by the theater's own fixtures rather than by an even studio fill. */
  environmentIntensity: 0.035,
  glassOpacity: 0.42,
  brickRelief: 2.2,
  brickNormalScale: 0.9,
})
