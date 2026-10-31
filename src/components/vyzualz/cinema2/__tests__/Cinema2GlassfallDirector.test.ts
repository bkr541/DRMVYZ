import { describe, it, expect } from 'vitest'
import { cinema2StableId } from '../contracts/Cinema2NativePresetManifest'
import { createGlassfallDirectorRoutes } from '../presets/Cinema2GlassfallDirectorRoutes'
import { GLASSFALL_DIRECTOR_NEUTRAL, readGlassfallDirector, resolveGlassfallDirector } from '../modules/glassfall/Cinema2GlassfallDirector'
import type { Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'
describe('GLASSFALL bounded Director enhancement', () => {
  const peak = { intensity: 1, momentum: 1, build: 1, impact: 1 }
  it('has neutral zero/OFF behavior and capped distinct performance gains', () => {
    expect(resolveGlassfallDirector(peak, 0, true)).toEqual(GLASSFALL_DIRECTOR_NEUTRAL)
    expect(resolveGlassfallDirector(peak, 1, false)).toEqual(GLASSFALL_DIRECTOR_NEUTRAL)
    expect(resolveGlassfallDirector(peak, 100, true)).toEqual({ activity: 1.25, contour: 1.25, tension: 1.2, impact: 1.35 })
    const authored = resolveGlassfallDirector(peak, .35, true)
    expect(authored.impact).toBeGreaterThan(1); expect(authored.impact).toBeLessThan(1.35)
    expect(peak).toEqual({ intensity: 1, momentum: 1, build: 1, impact: 1 })
  })
  it('fails neutral for missing/invalid meaning targets', () => {
    const values: Record<string, number> = { 'director-intensity': NaN, 'director-momentum': -1, 'director-build': 2 }
    const facts = readGlassfallDirector({ get: name => values[name] } as Cinema2ModuleParameterReadFacet)
    expect(facts).toEqual({ intensity: 0, momentum: 0, build: 1, impact: 0 })
  })
  it('routes only shared preset-agnostic significance into internal module targets', () => {
    const routes = createGlassfallDirectorRoutes(cinema2StableId('glassfall-field'))
    expect(routes).toHaveLength(4)
    expect(routes[3].actions[0].envelope?.release).toBe(.35)
    for (const route of routes) {
      expect(route.source.signal).toBe('continuous')
      expect(route.source.capability).toBe('visual-director.significance')
      expect(route.source.clamp).toEqual([0, 1])
      expect(route.enabledParameter?.$ref).toBe('glassfall-choreography')
      expect(route.actions[0].target.kind).toBe('module')
    }
  })
})
