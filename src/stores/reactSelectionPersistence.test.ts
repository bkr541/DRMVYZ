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
import {
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_REACT_PRESETS,
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxSettings,
  type LaserDmxSettings,
} from '../components/vyzualz/react/ReactTypes'
import { LASER_DMX_BEAM_MATRIX_PRESETS } from '../components/vyzualz/react/laserDmxBeamMatrixPresets'
import { splitStorageValue } from '../lib/splitPersistStorage'

const firstFor = (engine: (typeof DEFAULT_REACT_PRESETS)[number]['engine']) =>
  DEFAULT_REACT_PRESETS.find(p => p.engine === engine)!

describe('repairReactEnginePresetSelection', () => {
  it('preserves an explicitly selected PixGrid preset in live memory', () => {
    const preset = firstFor('pixGrid')
    expect(repairReactEnginePresetSelection(preset.id, 'pixGrid')).toEqual({
      activeReactPresetId: preset.id,
      activeReactEngineId: 'pixGrid',
    })
  })

  it('keeps Sound Drawing XY preset-free', () => {
    expect(repairReactEnginePresetSelection(null, 'xyScope')).toEqual({
      activeReactPresetId: null,
      activeReactEngineId: 'xyScope',
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

  it('retires a stale Neon engine selection to the explicit startup pair', () => {
    expect(repairReactEnginePresetSelection('removed-preset', 'neonLattice' as never)).toEqual({
      activeReactPresetId: null,
      activeReactEngineId: 'cinema2',
    })
  })

  it('retires the standalone Cinema engine to Cinema 2.0', () => {
    const stalePreset = firstFor('cinematicPortal')
    expect(repairReactEnginePresetSelection(stalePreset.id, 'cinema')).toEqual({
      activeReactPresetId: null,
      activeReactEngineId: 'cinema2',
    })
  })

  it('retires the standalone Shader compatibility identity to Cinema 2.0', () => {
    const stalePreset = firstFor('cinematicPortal')
    expect(repairReactEnginePresetSelection(stalePreset.id, 'shaderPads')).toEqual({
      activeReactPresetId: null,
      activeReactEngineId: 'cinema2',
    })
  })

  it('recovers an invalid engine from a valid preset', () => {
    const preset = firstFor('pixGrid')
    expect(repairReactEnginePresetSelection(preset.id, 'removed-engine')).toEqual({
      activeReactPresetId: preset.id,
      activeReactEngineId: 'pixGrid',
    })
  })

  it('falls back to the explicit startup pair when both values are invalid', () => {
    expect(repairReactEnginePresetSelection('removed-preset', 'removed-engine')).toEqual({
      activeReactPresetId: null,
      activeReactEngineId: 'cinema2',
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

  it('migrates a version-65 Cinema selection without retaining a legacy preset', () => {
    const result = migrateReactStore({
      activeReactPresetId: firstFor('cinematicPortal').id,
      activeReactEngineId: 'cinema',
    }, 65)

    expect(result.activeReactEngineId).toBe('cinema2')
    expect(result.activeReactPresetId).toBeNull()
  })

  it('partialize retires a Neon selection even if external code corrupts memory', () => {
    useReactStore.setState({
      activeReactPresetId: firstFor('cinematicPortal').id,
      activeReactEngineId: 'neonLattice' as never,
    } as never)

    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.activeReactEngineId).toBe('cinema2')
    expect(persisted.activeReactPresetId).toBeNull()
  })

  it('retires a saved Sound Drawing selection, its presets, pads, cues and state to Sound Drawing XY', () => {
    const userPreset = { ...firstFor('pixGrid'), id: 'user-sound-drawing', engine: 'oscilloscope' }
    const migrated = migrateReactStore({
      activeReactPresetId: 'preset-xy-cyan-scope',
      activeReactEngineId: 'oscilloscope',
      reactPresets: [...DEFAULT_REACT_PRESETS, userPreset],
      performancePads: [
        { ...DEFAULT_PERFORMANCE_PADS[0], id: 'pad-a', presetId: 'preset-bass-triangle-reactor', label: 'Reactor' },
        { ...DEFAULT_PERFORMANCE_PADS[0], id: 'pad-b', presetId: 'user-sound-drawing', label: 'Mine' },
        { ...DEFAULT_PERFORMANCE_PADS[0], id: 'pad-c', presetId: null, label: 'Old', destination: { schemaVersion: 1, engineId: 'oscilloscope', presetId: 'preset-lissajous-flower' } },
        { ...DEFAULT_PERFORMANCE_PADS[0], id: 'pad-d', presetId: firstFor('pixGrid').id, label: 'Keep' },
      ],
      presetAutomationCuesByTrackId: {
        track: [
          { id: 'cue-old', timeSec: 1, presetId: 'preset-spiral-signal', label: 'Old', enabled: true, transitionMs: 0 },
          { id: 'cue-keep', timeSec: 2, presetId: firstFor('pixGrid').id, label: 'Keep', enabled: true, transitionMs: 0 },
        ],
      },
      oscillatorSettings: { sourceType: 'text', text: 'OLD' },
      soundDrawingPerformanceSettings: {},
      oscillatorGlyphAssets: [],
      soundDrawingLayersByTrackId: {},
      soundDrawingClipsByTrackId: {},
    }, 59)

    expect(migrated.activeReactEngineId).toBe('xyScope')
    expect(migrated.activeReactPresetId).toBeNull()
    const presets = migrated.reactPresets as { id: string; engine: string }[]
    expect(presets.some(preset => preset.engine === 'oscilloscope')).toBe(false)
    const pads = migrated.performancePads as { id: string; presetId: string | null; label: string; destination?: unknown }[]
    expect(pads.find(pad => pad.id === 'pad-a')).toMatchObject({ presetId: null, label: 'OCTA', destination: { schemaVersion: 1, engineId: 'xyScope', presetId: 'octa' } })
    expect(pads.find(pad => pad.id === 'pad-b')).toMatchObject({ presetId: null, label: 'Converse', destination: { engineId: 'xyScope', presetId: 'conversation' } })
    expect(pads.find(pad => pad.id === 'pad-c')).toMatchObject({ presetId: null, label: 'Clean Scope', destination: { engineId: 'xyScope', presetId: 'clean-scope' } })
    expect(pads.find(pad => pad.id === 'pad-d')?.presetId).toBe(firstFor('pixGrid').id)
    const cues = (migrated.presetAutomationCuesByTrackId as Record<string, { id: string }[]>).track
    expect(cues.map(cue => cue.id)).toEqual(['cue-keep'])
    for (const key of ['oscillatorSettings', 'soundDrawingPerformanceSettings', 'oscillatorGlyphAssets', 'soundDrawingLayersByTrackId', 'soundDrawingClipsByTrackId']) {
      expect(migrated).not.toHaveProperty(key)
    }
  })

  it('retires a Sound Drawing selection in a current-version snapshot too', () => {
    const migrated = migrateReactStore({ activeReactPresetId: null, activeReactEngineId: 'oscilloscope' }, 86)
    expect(migrated.activeReactEngineId).toBe('xyScope')
  })

  it('migrates a live Cinema selection to Cinema 2.0 at the persistence boundary', () => {
    useReactStore.getState().selectReactEngine('cinema')
    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.activeReactEngineId).toBe('cinema2')
    expect(persisted.activeReactPresetId).toBeNull()

    const merged = mergeReactStoreState(persisted, useReactStore.getState())
    expect(merged.activeReactEngineId).toBe('cinema2')
    expect(merged.activeReactPresetId).toBeNull()
  })

  it('compatibility engine setter routes through the invariant-preserving selector', () => {
    useReactStore.getState().setActiveReactEngineId('laserDmx')
    const state = useReactStore.getState()
    const preset = state.reactPresets.find(p => p.id === state.activeReactPresetId)

    expect(state.activeReactEngineId).toBe('laserDmx')
    expect(preset?.engine).toBe('laserDmx')
  })

  it('compatibility preset setter also synchronizes the engine', () => {
    const preset = firstFor('pixGrid')
    useReactStore.getState().setActiveReactPresetId(preset.id)

    const state = useReactStore.getState()
    expect(state.activeReactPresetId).toBe(preset.id)
    expect(state.activeReactEngineId).toBe('pixGrid')
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
    expect(split.local.state.laserDmxBeamMatrix).toBeUndefined()

    expect(split.project.state.reactPresets).toBeDefined()
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


describe('LaserDMX Show Director persistence and migration', () => {
  beforeEach(() => {
    useReactStore.getState().resetReactView()
  })

  it('migrates v33 Beam Matrix gate and trigger cues without deleting the legacy list', () => {
    const matrix = createDefaultLaserDmxBeamMatrixSettings()
    matrix.cues = [{
      id: 'legacy-gate',
      name: 'Legacy Gate',
      enabled: true,
      targetType: 'group',
      targetId: 'grp-bass',
      timingMode: 'absolute',
      action: 'gate',
      startMs: 1000,
      endMs: 2000,
    }]
    const migrated = migrateReactStore({
      laserDmxSettings: createDefaultLaserDmxSettings(),
      laserDmxBeamMatrix: matrix,
    }, 33)
    const legacyRig = migrated.laserDmxSettings as LaserDmxSettings
    expect(legacyRig.productionCues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'production-cue:legacy:legacy-gate', source: 'legacyBeamMigration' }),
    ]))
    expect((migrated.laserDmxBeamMatrix as typeof matrix).cues).toEqual(matrix.cues)
  })

  it('does not persist cue selection or transient manual Fire requests', () => {
    const cueId = useReactStore.getState().addLaserDmxProductionCue()
    useReactStore.getState().fireLaserDmxProductionCue(cueId)
    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    const laserDmxSettings = persisted.laserDmxSettings as LaserDmxSettings
    expect(persisted.selectedLaserDmxProductionCueId).toBeUndefined()
    expect(laserDmxSettings.runtime).toBeUndefined()
    expect(laserDmxSettings.productionCues?.some(cue => cue.id === cueId)).toBe(true)
  })

  it('migrates newly loaded legacy cue lists exactly once', () => {
    const cue = {
      id: 'runtime-legacy-trigger',
      name: 'Runtime Trigger',
      enabled: true,
      targetType: 'group' as const,
      targetId: 'grp-bass',
      timingMode: 'absolute' as const,
      action: 'trigger' as const,
      startMs: 750,
    }
    useReactStore.getState().setLaserDmxBeamMatrixSettings({ cues: [cue] })
    useReactStore.getState().setLaserDmxBeamMatrixSettings({ cues: [cue] })
    const migrated = useReactStore.getState().laserDmxSettings.productionCues?.filter(item => item.id === 'production-cue:legacy:runtime-legacy-trigger') ?? []
    expect(migrated).toHaveLength(1)
  })
})
