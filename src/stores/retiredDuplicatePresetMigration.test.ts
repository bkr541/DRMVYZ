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

const RETIRED_CINEMATIC_PRESET_IDS = [
  'preset-dream-gate',
  'preset-crimson-rift',
  'preset-emerald-fog',
  'preset-portal-overload',
  'preset-quiet-ruins',
  'preset-titan-seal',
  'preset-sunken-oracle',
  'preset-ascension-array',
  'preset-placid-veil',
  'preset-bass-breach',
  'preset-prismatic-amnion',
  'preset-starlit-basilica',
  'preset-solar-nave',
  'preset-void-choir',
]

const RETIRED_LASER_DMX_PRESET_IDS = [
  'preset-rgb-plane-shift',
  'preset-ceiling-lattice-overload',
  'preset-magenta-cyan-festival-fan',
  'preset-blinder-cryo-drop',
  'preset-white-fog-cathedral',
]

const RETIRED_IDS = [...RETIRED_CINEMATIC_PRESET_IDS, ...RETIRED_LASER_DMX_PRESET_IDS]

describe('retired React presets', () => {
  it('keeps retired Cinematic and LaserDMX preset families out of the live catalog', () => {
    const ids = new Set(DEFAULT_REACT_PRESETS.map(preset => preset.id))
    expect(DEFAULT_REACT_PRESETS.some(preset => preset.cinematicConfig?.worldMode === 'legacyPortal')).toBe(false)
    expect(DEFAULT_REACT_PRESETS.some(preset => preset.cinematicConfig?.worldMode === 'monolithGate')).toBe(false)
    expect(DEFAULT_REACT_PRESETS.some(preset => preset.cinematicConfig?.worldMode === 'liquidMembrane')).toBe(false)
    expect(DEFAULT_REACT_PRESETS.some(preset => preset.cinematicConfig?.worldMode === 'celestialCathedral')).toBe(false)
    expect(ids.has(LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID)).toBe(true)
    for (const id of RETIRED_IDS) expect(ids.has(id), id).toBe(false)
  })

  it('repairs persisted selections to a live preset without reviving retired definitions', () => {
    expect(repairReactEnginePresetSelection('preset-dream-gate', 'cinematicPortal'))
      .toEqual({ activeReactPresetId: 'preset-singularity-crown', activeReactEngineId: 'cinematicPortal' })
    expect(repairReactEnginePresetSelection('preset-placid-veil', 'cinematicPortal'))
      .toEqual({ activeReactPresetId: 'preset-singularity-crown', activeReactEngineId: 'cinematicPortal' })
    expect(repairReactEnginePresetSelection('preset-white-fog-cathedral', 'laserDmx'))
      .toEqual({ activeReactPresetId: LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID, activeReactEngineId: 'laserDmx' })
  })

  it('prunes retired definitions and every keyed reference from persisted state', () => {
    const liveCinematic = DEFAULT_REACT_PRESETS.find(preset => preset.id === 'preset-singularity-crown')!
    const beamMatrix = DEFAULT_REACT_PRESETS.find(preset => preset.id === LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID)!
    const retiredCinematic: ReactPreset = {
      ...structuredClone(liveCinematic),
      id: 'preset-placid-veil',
      name: 'Placid Veil',
    }
    const retiredLaserDmxRig: ReactPreset = {
      ...structuredClone(beamMatrix),
      id: 'preset-white-fog-cathedral',
      name: 'White Fog Cathedral',
    }
    const obsoletePad: ReactPerformancePad = {
      ...DEFAULT_PERFORMANCE_PADS.find(pad => pad.id === 'pad-6')!,
      presetId: retiredCinematic.id,
      label: 'Veil',
    }

    const migrated = migrateReactStore({
      activeReactPresetId: retiredCinematic.id,
      activeReactEngineId: 'cinematicPortal',
      reactPresets: [...DEFAULT_REACT_PRESETS, retiredCinematic, retiredLaserDmxRig],
      performancePads: [obsoletePad],
      presetAutomationCuesByTrackId: {
        'track-1': [
          { id: 'retired', presetId: retiredCinematic.id, timeSec: 1 },
          { id: 'live', presetId: liveCinematic.id, timeSec: 2 },
        ],
      },
      cinematicConfigsByPresetId: {
        [retiredCinematic.id]: retiredCinematic.cinematicConfig,
      },
      cinematicSeedLocksByPresetId: {
        [retiredCinematic.id]: true,
      },
    }, 42)

    const presets = migrated.reactPresets as ReactPreset[]
    const pads = migrated.performancePads as ReactPerformancePad[]
    expect(migrated.activeReactPresetId).toBe('preset-singularity-crown')
    expect(migrated.activeReactEngineId).toBe('cinematicPortal')
    expect(presets.some(preset => RETIRED_IDS.includes(preset.id))).toBe(false)
    expect(pads).toEqual([expect.objectContaining({ id: 'pad-6', presetId: null, label: 'Empty' })])
    expect(migrated.presetAutomationCuesByTrackId).toEqual({
      'track-1': [expect.objectContaining({ id: 'live', presetId: liveCinematic.id })],
    })
    expect(migrated.cinematicConfigsByPresetId).toEqual({})
    expect(migrated.cinematicSeedLocksByPresetId).toEqual({})
  })
})
