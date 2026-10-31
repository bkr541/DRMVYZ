import type { Cinema2ModuleParameterReadFacet } from '../Cinema2ModuleContracts'
export const GLASSFALL_DIRECTOR_CHANNELS = ['intensity', 'momentum', 'build', 'impact'] as const
export type GlassfallDirectorFacts = Record<typeof GLASSFALL_DIRECTOR_CHANNELS[number], number>
export interface GlassfallDirectorModifiers { activity: number; contour: number; tension: number; impact: number }
export const GLASSFALL_DIRECTOR_SILENCE: GlassfallDirectorFacts = { intensity: 0, momentum: 0, build: 0, impact: 0 }
export const GLASSFALL_DIRECTOR_NEUTRAL: GlassfallDirectorModifiers = { activity: 1, contour: 1, tension: 1, impact: 1 }
const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
/** Shared Choreography owns smoothing; this reads only resolved meaning targets. */
export function readGlassfallDirector(parameters: Cinema2ModuleParameterReadFacet): GlassfallDirectorFacts {
  return Object.fromEntries(GLASSFALL_DIRECTOR_CHANNELS.map(name => {
    const value = parameters.get(`director-${name}`)
    return [name, typeof value === 'number' ? unit(value) : 0]
  })) as GlassfallDirectorFacts
}
/** Meaning can amplify existing musical gestures, never invent geometry,
 * choose a pattern/color/camera, or exceed the documented user-granted bounds. */
export function resolveGlassfallDirector(facts: GlassfallDirectorFacts, influence: number, enabled: boolean): GlassfallDirectorModifiers {
  const strength = enabled ? unit(influence) : 0
  return {
    activity: 1 + .25 * strength * unit(facts.intensity),
    contour: 1 + .25 * strength * unit(facts.momentum),
    tension: 1 + .20 * strength * unit(facts.build),
    impact: 1 + .35 * strength * unit(facts.impact),
  }
}
