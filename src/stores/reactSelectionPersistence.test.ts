import { beforeEach, describe, expect, it } from 'vitest'
import {
  isLaserDmxBeamMatrixPresetDirty,
  mergeReactStoreState,
  migrateReactStore,
  REACT_PROJECT_STATE_KEYS,
  reactStorePartialize,
  repairReactEnginePresetSelection,
  useReactStore,
} from './reactStore'
import { DEFAULT_PERFORMANCE_PADS, DEFAULT_REACT_PRESETS } from '../components/vyzualz/react/ReactTypes'
import { LASER_DMX_BEAM_MATRIX_PRESETS } from '../components/vyzualz/react/laserDmxBeamMatrixPresets'
import { splitStorageValue } from '../lib/splitPersistStorage'

const firstFor = (engine: (typeof DEFAULT_REACT_PRESETS)[number]['engine']) =>
  DEFAULT_REACT_PRESETS.find(p => p.engine === engine)!

describe('repairReactEnginePresetSelection', () => {
  it('preserves a valid matching engine/preset pair', () => {
    const preset = firstFor('oscilloscope')
    expect(repairReactEnginePresetSelection(preset.id, 'oscilloscope')).toEqual({
      activeReactPresetId: preset.id,
      activeReactEngineId: 'oscilloscope',
    })
  })

  it('preserves the valid engine and replaces a preset from another engine', () => {
    const wrongPreset = firstFor('cinematicPortal')
    const expected = firstFor('laserDmx')
    expect(repairReactEnginePresetSelection(wrongPreset.id, 'laserDmx')).toEqual({
      activeReactPresetId: expected.id,
      activeReactEngineId: 'laserDmx',
    })
  })

  it('replaces a missing preset with the first preset for the active engine', () => {
    const expected = firstFor('neonLattice')
    expect(repairReactEnginePresetSelection('removed-preset', 'neonLattice')).toEqual({
      activeReactPresetId: expected.id,
      activeReactEngineId: 'neonLattice',
    })
  })

  it('keeps the standalone Shader engine preset-free', () => {
    const stalePreset = firstFor('cinematicPortal')
    expect(repairReactEnginePresetSelection(stalePreset.id, 'shaderPads')).toEqual({
      activeReactPresetId: null,
      activeReactEngineId: 'shaderPads',
    })
  })

  it('recovers an invalid engine from a valid preset', () => {
    const preset = firstFor('oscilloscope')
    expect(repairReactEnginePresetSelection(preset.id, 'removed-engine')).toEqual({
      activeReactPresetId: preset.id,
      activeReactEngineId: 'oscilloscope',
    })
  })

  it('falls back to the explicit startup pair when both values are invalid', () => {
    expect(repairReactEnginePresetSelection('removed-preset', 'removed-engine')).toEqual({
      activeReactPresetId: 'preset-dream-gate',
      activeReactEngineId: 'cinematicPortal',
    })
  })
})

describe('React selection persistence invariant', () => {
  beforeEach(() => {
    useReactStore.getState().resetReactView()
  })

  it('repairs a version-19 mismatched persisted pair during v20 migration', () => {
    const result = migrateReactStore({
      activeReactPresetId: firstFor('cinematicPortal').id,
      activeReactEngineId: 'laserDmx',
    }, 19)

    expect(result.activeReactEngineId).toBe('laserDmx')
    expect(result.activeReactPresetId).toBe(firstFor('laserDmx').id)
  })

  it('partialize never writes a mismatched pair even if external code corrupts memory', () => {
    useReactStore.setState({
      activeReactPresetId: firstFor('cinematicPortal').id,
      activeReactEngineId: 'neonLattice',
    })

    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.activeReactEngineId).toBe('neonLattice')
    expect(persisted.activeReactPresetId).toBe(firstFor('neonLattice').id)
  })

  it('compatibility engine setter routes through the invariant-preserving selector', () => {
    useReactStore.getState().setActiveReactEngineId('laserDmx')
    const state = useReactStore.getState()
    const preset = state.reactPresets.find(p => p.id === state.activeReactPresetId)

    expect(state.activeReactEngineId).toBe('laserDmx')
    expect(preset?.engine).toBe('laserDmx')
  })

  it('compatibility preset setter also synchronizes the engine', () => {
    const preset = firstFor('oscilloscope')
    useReactStore.getState().setActiveReactPresetId(preset.id)

    const state = useReactStore.getState()
    expect(state.activeReactPresetId).toBe(preset.id)
    expect(state.activeReactEngineId).toBe('oscilloscope')
  })
})

describe('React authored-state persistence', () => {
  beforeEach(() => {
    useReactStore.getState().resetReactView()
  })

  it('includes editable preset definitions, performance pads, and Beam Matrix dirty state', () => {
    const preset = DEFAULT_REACT_PRESETS[0]
    const pad = DEFAULT_PERFORMANCE_PADS[0]
    useReactStore.getState().updateReactPresetParams(preset.id, { glow: 0.123 })
    useReactStore.getState().updatePerformancePad(pad.id, { label: 'Edited Pad' })
    useReactStore.setState({ laserDmxBeamMatrixPresetDirty: true })

    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.reactPresets.find(p => p.id === preset.id)?.params.glow).toBe(0.123)
    expect(persisted.performancePads.find(p => p.id === pad.id)?.label).toBe('Edited Pad')
    expect(persisted.laserDmxBeamMatrixPresetDirty).toBe(true)
  })

  it('routes project-sized fields away from the localStorage envelope', () => {
    const persisted = reactStorePartialize(useReactStore.getState())
    const split = splitStorageValue({ state: persisted, version: 21 }, REACT_PROJECT_STATE_KEYS)

    expect(split.local.state.performancePads).toBeDefined()
    expect(split.local.state.laserDmxBeamMatrixPresetDirty).toBeDefined()
    expect(split.local.state.oscillatorGlyphAssets).toBeUndefined()
    expect(split.local.state.soundDrawingLayersByTrackId).toBeUndefined()
    expect(split.local.state.laserDmxBeamMatrix).toBeUndefined()

    expect(split.project.state.reactPresets).toBeDefined()
    expect(split.project.state.oscillatorGlyphAssets).toBeDefined()
    expect(split.project.state.soundDrawingLayersByTrackId).toBeDefined()
    expect(split.project.state.laserDmxBeamMatrix).toBeDefined()
  })

  it('derives Beam Matrix dirty state by comparing authored content with the named preset', () => {
    const preset = LASER_DMX_BEAM_MATRIX_PRESETS[0]
    const clean = preset.createSettings()
    expect(isLaserDmxBeamMatrixPresetDirty(clean, preset.id)).toBe(false)

    const dirty = {
      ...clean,
      output: { ...clean.output, masterDimmer: clean.output.masterDimmer * 0.5 },
    }
    expect(isLaserDmxBeamMatrixPresetDirty(dirty, preset.id)).toBe(true)
  })

  it('merges persisted edits with current built-ins and repairs legacy clean flags', () => {
    const current = useReactStore.getState()
    const editedPreset = {
      ...current.reactPresets[0],
      params: { ...current.reactPresets[0].params, motion: 0.111 },
    }
    const beamPreset = LASER_DMX_BEAM_MATRIX_PRESETS[0]
    const changedMatrix = beamPreset.createSettings()
    changedMatrix.output = { ...changedMatrix.output, masterDimmer: 0.25 }

    const merged = mergeReactStoreState({
      reactPresets: [editedPreset],
      performancePads: [{ ...current.performancePads[0], label: 'Persisted' }],
      activeLaserDmxBeamMatrixPresetId: beamPreset.id,
      laserDmxBeamMatrix: changedMatrix,
      laserDmxBeamMatrixPresetDirty: false,
    }, current)

    expect(merged.reactPresets.find(p => p.id === editedPreset.id)?.params.motion).toBe(0.111)
    expect(merged.reactPresets.length).toBe(current.reactPresets.length)
    expect(merged.performancePads[0].label).toBe('Persisted')
    expect(merged.performancePads.length).toBe(current.performancePads.length)
    expect(merged.laserDmxBeamMatrixPresetDirty).toBe(true)
  })
})
