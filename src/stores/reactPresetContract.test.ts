import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_REACT_PRESET_RENDER_SETTINGS,
  DEFAULT_REACT_PRESETS,
  createDefaultLaserDmxSettings,
} from '../components/vyzualz/react/ReactTypes'
import {
  buildPresetPatch,
  migrateReactStore,
  reactStorePartialize,
  useReactStore,
} from './reactStore'

const laserPreset = DEFAULT_REACT_PRESETS.find(p => p.engine === 'laserDmx')!
const cinematicPreset = DEFAULT_REACT_PRESETS.find(p => p.engine === 'cinematicPortal')!

describe('React preset contracts', () => {
  beforeEach(() => {
    useReactStore.getState().resetReactView()
  })

  it('resolves LaserDMX presets independently of the previously edited live state', () => {
    const liveA = createDefaultLaserDmxSettings()
    liveA.masterDimmer = 0.01
    liveA.fixtures = []

    const liveB = createDefaultLaserDmxSettings()
    liveB.masterDimmer = 1
    liveB.blackout = true

    const patchA = buildPresetPatch(laserPreset, DEFAULT_OSCILLATOR_SETTINGS, liveA)
    const patchB = buildPresetPatch(laserPreset, DEFAULT_OSCILLATOR_SETTINGS, liveB)

    expect(patchA.laserDmxSettings).toEqual(patchB.laserDmxSettings)
  })

  it('resets every global render control when a preset is selected', () => {
    const patch = buildPresetPatch(cinematicPreset, DEFAULT_OSCILLATOR_SETTINGS)
    expect(patch.reactTrailDecay).toBe(DEFAULT_REACT_PRESET_RENDER_SETTINGS.trailDecay)
    expect(patch.reactFogDensity).toBe(DEFAULT_REACT_PRESET_RENDER_SETTINGS.fogDensity)
    expect(patch.reactParticleDensity).toBe(DEFAULT_REACT_PRESET_RENDER_SETTINGS.particleDensity)
  })

  it('creates a transient visual transition from the pad transitionTimeMs', () => {
    const store = useReactStore.getState()
    store.setReactIntensity(0.11)
    store.setReactMotion(0.22)
    store.setReactGlow(0.33)
    store.setReactBassReactivity(0.44)
    store.setReactTrailDecay(0.55)
    store.setReactFogDensity(0.66)
    store.setReactParticleDensity(0.77)

    const pad = useReactStore.getState().performancePads.find(p => p.presetId != null)!
    useReactStore.getState().setActivePadId(pad.id)

    const state = useReactStore.getState()
    const transition = state.performancePadTransition
    const preset = state.reactPresets.find(p => p.id === pad.presetId)!

    expect(transition?.durationMs).toBe(pad.transitionTimeMs)
    expect(transition?.from).toMatchObject({
      intensity: 0.11,
      motion: 0.22,
      glow: 0.33,
      bassReactivity: 0.44,
      trailDecay: 0.55,
      fogDensity: 0.66,
      particleDensity: 0.77,
    })
    expect(transition?.to.intensity).toBe(preset.params.intensity)
    expect(state.reactIntensity).toBe(preset.params.intensity)
    expect('performancePadTransition' in reactStorePartialize(state)).toBe(false)
  })

  it('strips decorative preset fields and dead palette state during v22 migration', () => {
    const migrated = migrateReactStore({
      reactColorPalette: 'legacy',
      reactPresets: [{
        ...cinematicPreset,
        params: { ...cinematicPreset.params, colorShift: 0.5, complexity: 0.8 },
        scenes: [{
          ...cinematicPreset.scenes[0],
          params: { ...cinematicPreset.scenes[0].params, colorShift: 0.2 },
          palette: { primary: '#fff' },
        }],
      }],
    }, 21)

    expect(migrated).not.toHaveProperty('reactColorPalette')
    const migratedPreset = (migrated.reactPresets as typeof DEFAULT_REACT_PRESETS)[0]
    expect(migratedPreset.params).not.toHaveProperty('colorShift')
    expect(migratedPreset.params).not.toHaveProperty('complexity')
    expect(migratedPreset.scenes[0]).not.toHaveProperty('palette')
    expect(migratedPreset.scenes[0].params).not.toHaveProperty('colorShift')
  })
})
