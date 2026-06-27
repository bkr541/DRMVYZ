import { beforeEach, describe, expect, it } from 'vitest'
import {
  migrateReactStore,
  reactStorePartialize,
  repairReactEnginePresetSelection,
  useReactStore,
} from './reactStore'
import { DEFAULT_REACT_PRESETS } from '../components/vyzualz/react/ReactTypes'

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
