import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_REACT_PRESETS,
  LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID,
  type ReactPerformancePad,
  type ReactPreset,
} from '../components/vyzualz/react/ReactTypes'
import {
  migrateReactStore,
  repairReactEnginePresetSelection,
} from './reactStore'

const RETIRED_IDS = [
  'preset-crimson-rift',
  'preset-emerald-fog',
  'preset-portal-overload',
  'preset-quiet-ruins',
  'preset-rgb-plane-shift',
  'preset-ceiling-lattice-overload',
  'preset-magenta-cyan-festival-fan',
  'preset-blinder-cryo-drop',
  'preset-white-fog-cathedral',
]

describe('retired duplicate React presets', () => {
  it('keeps only Dream Gate and Beam Matrix from the retired duplicate families', () => {
    const ids = new Set(DEFAULT_REACT_PRESETS.map(preset => preset.id))
    expect(DEFAULT_REACT_PRESETS
      .filter(preset => preset.cinematicConfig?.worldMode === 'legacyPortal')
      .map(preset => preset.id))
      .toEqual(['preset-dream-gate'])
    expect(ids.has(LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID)).toBe(true)
    for (const id of RETIRED_IDS) expect(ids.has(id), id).toBe(false)
  })

  it('repairs persisted selections to the retained preset in the same duplicate family', () => {
    expect(repairReactEnginePresetSelection('preset-crimson-rift', 'cinematicPortal'))
      .toEqual({ activeReactPresetId: 'preset-dream-gate', activeReactEngineId: 'cinematicPortal' })
    expect(repairReactEnginePresetSelection('preset-white-fog-cathedral', 'laserDmx'))
      .toEqual({ activeReactPresetId: LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID, activeReactEngineId: 'laserDmx' })
  })

  it('prunes retired persisted definitions and clears their obsolete pad assignments', () => {
    const dreamGate = DEFAULT_REACT_PRESETS.find(preset => preset.id === 'preset-dream-gate')!
    const beamMatrix = DEFAULT_REACT_PRESETS.find(preset => preset.id === LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID)!
    const retiredCinematic: ReactPreset = {
      ...structuredClone(dreamGate),
      id: 'preset-crimson-rift',
      name: 'Crimson Rift',
    }
    const retiredLaserDmxRig: ReactPreset = {
      ...structuredClone(beamMatrix),
      id: 'preset-white-fog-cathedral',
      name: 'White Fog Cathedral',
    }
    const obsoletePad: ReactPerformancePad = {
      ...DEFAULT_PERFORMANCE_PADS.find(pad => pad.id === 'pad-6')!,
      presetId: retiredCinematic.id,
      label: 'Rift',
    }

    const migrated = migrateReactStore({
      activeReactPresetId: retiredLaserDmxRig.id,
      activeReactEngineId: 'laserDmx',
      reactPresets: [...DEFAULT_REACT_PRESETS, retiredCinematic, retiredLaserDmxRig],
      performancePads: [obsoletePad],
      cinematicConfigsByPresetId: {
        [retiredCinematic.id]: retiredCinematic.cinematicConfig,
      },
      cinematicSeedLocksByPresetId: {
        [retiredCinematic.id]: true,
      },
    }, 35)

    const presets = migrated.reactPresets as ReactPreset[]
    const pads = migrated.performancePads as ReactPerformancePad[]
    expect(migrated.activeReactPresetId).toBe(LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID)
    expect(presets.some(preset => RETIRED_IDS.includes(preset.id))).toBe(false)
    expect(pads).toEqual([expect.objectContaining({ id: 'pad-6', presetId: null, label: 'Empty' })])
    expect(migrated.cinematicConfigsByPresetId).toEqual({})
    expect(migrated.cinematicSeedLocksByPresetId).toEqual({})
  })
})
