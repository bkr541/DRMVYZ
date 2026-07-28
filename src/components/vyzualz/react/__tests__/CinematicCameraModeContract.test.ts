import { beforeEach, describe, expect, it } from 'vitest'
import { resolveSupportedCinematicCameraRig } from '../CinematicWorldConfig'
import { resolveCinematicPresetBaseConfig, resolveCinematicPresetProvenance } from '../CinematicPresetProvenance'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import { useReactStore } from '../../../../stores/reactStore'

describe('Cinematic camera mode contract', () => {
  beforeEach(() => {
    useReactStore.setState({ cinematicConfigsByPresetId: {} })
  })
  it('keeps Camera Mode as the sole supported-rig source of truth', () => {
    const supported = ['locked', 'orbit', 'autoDirector'] as const
    expect(resolveSupportedCinematicCameraRig('autoDirector', supported, 'orbit')).toBe('autoDirector')
    expect(resolveSupportedCinematicCameraRig('orbit', supported, 'autoDirector')).toBe('orbit')
  })

  it('falls back without creating a second persisted enable state', () => {
    expect(resolveSupportedCinematicCameraRig('flyThrough', ['locked', 'orbit'], 'orbit')).toBe('orbit')
    expect(resolveSupportedCinematicCameraRig('flyThrough', ['locked'], 'autoDirector')).toBe('locked')
  })

  it('returns to exact preset provenance and removes an equivalent persisted override', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.engine === 'cinematicPortal')
    expect(preset).toBeDefined()
    if (!preset) return
    const exact = resolveCinematicPresetBaseConfig(preset)
    expect(exact).not.toBeNull()
    if (!exact) return
    const modified = { ...exact, seed: exact.seed + 1 }

    expect(resolveCinematicPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCinematicPresetProvenance(preset, modified).status).toBe('modified')

    useReactStore.getState().setCinematicConfigForPreset(preset.id, modified)
    expect(useReactStore.getState().cinematicConfigsByPresetId[preset.id]).toBeDefined()
    useReactStore.getState().setCinematicConfigForPreset(preset.id, exact)
    expect(useReactStore.getState().cinematicConfigsByPresetId[preset.id]).toBeUndefined()
  })

})
