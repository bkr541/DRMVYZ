import { describe, expect, it } from 'vitest'
import {
  CINEMA_ENGINEERING_ONLY_COMPOSITION_IDS,
  createCinemaFoundationPersistedState,
  isCinemaEngineeringOnlyComposition,
} from '../CinemaFoundation'

/**
 * Guards the mistake that put five Stage 8-16 engineering reference/QA
 * compositions (Cinema Foundation Gradient, Cinema Shader Scene Reference,
 * Cinema Cinematic World Reference, Cinema Media/Text/Lyrics Reference, Cinema
 * Layer Compositor Reference) into the production Presets tab: every
 * composition seeded into a Cinema document is either a real, curated Stage
 * 21 catalog preset, or it is explicitly listed in
 * CINEMA_ENGINEERING_ONLY_COMPOSITION_IDS so CinemaPresetsPanel filters it
 * out. If neither is true, it will silently reach the Presets tab.
 */
describe('Cinema canonical built-in compositions never leak an engineering fixture as a preset', () => {
  it('classifies every seeded composition as either a real Stage 21 catalog preset or an explicit engineering-only fixture', () => {
    const { compositions } = createCinemaFoundationPersistedState()
    expect(compositions.length).toBeGreaterThan(0)

    for (const composition of compositions) {
      const provenance = composition.metadata?.provenance as Record<string, unknown> | undefined
      const isRealCatalogPreset = provenance?.stage === 21
      const isEngineeringOnly = isCinemaEngineeringOnlyComposition(composition)
      expect(
        isRealCatalogPreset || isEngineeringOnly,
        `"${composition.metadata.name}" (${composition.id}) is neither a Stage 21 catalog preset nor listed in ` +
        'CINEMA_ENGINEERING_ONLY_COMPOSITION_IDS, so it will show up as a pickable preset in the production Presets ' +
        'tab. If it is a real, curated preset it should carry Stage 21 provenance (project it through the legacy ' +
        'preset catalog). If it is a test/QA fixture, add its id to CINEMA_ENGINEERING_ONLY_COMPOSITION_IDS in ' +
        'CinemaFoundation.ts.',
      ).toBe(true)
    }
  })

  it('keeps every engineering-only id present in the seeded composition set (so the marker cannot rot)', () => {
    const { compositions } = createCinemaFoundationPersistedState()
    const seededIds = new Set(compositions.map(composition => String(composition.id)))
    for (const id of CINEMA_ENGINEERING_ONLY_COMPOSITION_IDS) {
      expect(seededIds.has(id), `Engineering-only id "${id}" is no longer a seeded composition — remove it from CINEMA_ENGINEERING_ONLY_COMPOSITION_IDS.`).toBe(true)
    }
  })
})
