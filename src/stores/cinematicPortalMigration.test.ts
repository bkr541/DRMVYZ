import { describe, expect, it } from 'vitest'
import { createLegacyPortalCinematicConfig } from '../components/vyzualz/react/CinematicWorldConfig'
import { DEFAULT_REACT_PRESETS } from '../components/vyzualz/react/ReactTypes'
import type { ReactPreset } from '../components/vyzualz/react/ReactTypes'
import { migrateReactStore, normalizeCinematicPresetConfiguration } from './reactStore'

const liveCinematicPreset = DEFAULT_REACT_PRESETS.find(preset => preset.id === 'preset-singularity-crown')!

function legacyPortalFixture(id = 'fixture-legacy-portal'): ReactPreset {
  return {
    ...structuredClone(liveCinematicPreset),
    id,
    name: 'Legacy Portal Fixture',
    cinematicConfig: createLegacyPortalCinematicConfig({ intensity: 0.7, fogDensity: 0.4 }),
  }
}

describe('Cinematic Portal compatibility migration', () => {
  it('keeps Legacy Portal out of the live catalog while preserving its compatibility normalizer', () => {
    expect(DEFAULT_REACT_PRESETS.filter(
      preset => preset.cinematicConfig?.worldMode === 'legacyPortal',
    )).toEqual([])

    const fixture = legacyPortalFixture()
    expect(fixture.cinematicConfig).toMatchObject({
      worldMode: 'legacyPortal',
      portalShape: 'rectangle',
      cameraRig: 'locked',
    })
  })

  it('migrates a legacy saved preset without changing its existing visual parameters', () => {
    const fixture = legacyPortalFixture()
    const legacyPreset = {
      ...fixture,
      params: { intensity: 0.23, motion: 0.34, glow: 0.45, bassReactivity: 0.56 },
      renderSettings: { trailDecay: 0.12, fogDensity: 0.67, particleDensity: 0.78 },
      cinematicConfig: undefined,
      portalSettings: { oldRingSpeed: 9, oldPortalWidth: 0.42 },
    } as ReactPreset & { portalSettings: Record<string, unknown> }

    const normalized = normalizeCinematicPresetConfiguration(legacyPreset)

    expect(normalized.params).toEqual(legacyPreset.params)
    expect(normalized.renderSettings).toEqual(legacyPreset.renderSettings)
    expect((normalized as typeof legacyPreset).portalSettings).toEqual(legacyPreset.portalSettings)
    expect(normalized.cinematicConfig).toMatchObject({
      worldMode: 'legacyPortal',
      portalShape: 'rectangle',
      cameraRig: 'locked',
    })
    expect(normalized.cinematicConfig?.compatibility.legacyValues).toMatchObject({
      params: legacyPreset.params,
      renderSettings: legacyPreset.renderSettings,
      portalSettings: legacyPreset.portalSettings,
    })
  })

  it('normalizes malformed imported compatibility configuration without making it unloadable', () => {
    const fixture = legacyPortalFixture()
    const imported = {
      ...fixture,
      cinematicConfig: {
        worldMode: 'not-a-world',
        seed: -200,
        environment: { fog: 400 },
        futureRendererFlag: 'preserve-me',
      },
    } as unknown as ReactPreset

    const normalized = normalizeCinematicPresetConfiguration(imported)

    expect(normalized.id).toBe(fixture.id)
    expect(normalized.params).toEqual(fixture.params)
    expect(normalized.cinematicConfig?.worldMode).toBe('legacyPortal')
    expect(normalized.cinematicConfig?.seed).toBe(0)
    expect(normalized.cinematicConfig?.environment.fog).toBe(1)
    expect(normalized.cinematicConfig?.compatibility.extensions.futureRendererFlag).toBe('preserve-me')
  })

  it('drops a retired Legacy Portal preset during persisted-store migration', () => {
    const retired = legacyPortalFixture('preset-dream-gate')
    const migrated = migrateReactStore({
      activeReactPresetId: retired.id,
      activeReactEngineId: 'cinematicPortal',
      reactPresets: [...DEFAULT_REACT_PRESETS, retired],
    }, 42)

    expect(migrated.activeReactEngineId).toBe('cinema')
    expect(migrated.activeReactPresetId).toBeNull()
    expect((migrated.reactPresets as ReactPreset[]).some(preset => preset.id === retired.id)).toBe(false)
  })
})
