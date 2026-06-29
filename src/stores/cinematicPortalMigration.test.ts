import { describe, expect, it } from 'vitest'
import { DEFAULT_REACT_PRESETS } from '../components/vyzualz/react/ReactTypes'
import type { ReactPreset } from '../components/vyzualz/react/ReactTypes'
import { migrateReactStore, normalizeCinematicPresetConfiguration } from './reactStore'

const dreamGate = DEFAULT_REACT_PRESETS.find(preset => preset.id === 'preset-dream-gate')!

describe('Cinematic Portal compatibility migration', () => {
  it('maps every existing Cinematic Portal preset to legacyPortal', () => {
    const cinematicPresets = DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'cinematicPortal')

    expect(cinematicPresets).toHaveLength(5)
    for (const preset of cinematicPresets) {
      expect(preset.cinematicConfig?.worldMode).toBe('legacyPortal')
      expect(preset.cinematicConfig?.portalShape).toBe('rectangle')
    }
  })

  it('migrates a legacy saved preset without changing its existing visual parameters', () => {
    const legacyPreset = {
      ...dreamGate,
      params: { intensity: 0.23, motion: 0.34, glow: 0.45, bassReactivity: 0.56 },
      renderSettings: { trailDecay: 0.12, fogDensity: 0.67, particleDensity: 0.78 },
      cinematicConfig: undefined,
      portalSettings: { oldRingSpeed: 9, oldPortalWidth: 0.42 },
    } as ReactPreset & { portalSettings: Record<string, unknown> }

    const migrated = migrateReactStore({ reactPresets: [legacyPreset] }, 23)
    const migratedPreset = (migrated.reactPresets as ReactPreset[])[0]

    expect(migratedPreset.params).toEqual(legacyPreset.params)
    expect(migratedPreset.renderSettings).toEqual(legacyPreset.renderSettings)
    expect((migratedPreset as typeof legacyPreset).portalSettings).toEqual(legacyPreset.portalSettings)
    expect(migratedPreset.cinematicConfig).toMatchObject({
      worldMode: 'legacyPortal',
      portalShape: 'rectangle',
      cameraRig: 'locked',
    })
    expect(migratedPreset.cinematicConfig?.compatibility.legacyValues).toMatchObject({
      params: legacyPreset.params,
      renderSettings: legacyPreset.renderSettings,
      portalSettings: legacyPreset.portalSettings,
    })
  })

  it('normalizes malformed imported configuration without making the preset unloadable', () => {
    const imported = {
      ...dreamGate,
      cinematicConfig: {
        worldMode: 'not-a-world',
        seed: -200,
        environment: { fog: 400 },
        futureRendererFlag: 'preserve-me',
      },
    } as unknown as ReactPreset

    const normalized = normalizeCinematicPresetConfiguration(imported)

    expect(normalized.id).toBe(dreamGate.id)
    expect(normalized.params).toEqual(dreamGate.params)
    expect(normalized.cinematicConfig?.worldMode).toBe('legacyPortal')
    expect(normalized.cinematicConfig?.seed).toBe(0)
    expect(normalized.cinematicConfig?.environment.fog).toBe(1)
    expect(normalized.cinematicConfig?.compatibility.extensions.futureRendererFlag).toBe('preserve-me')
  })
})
