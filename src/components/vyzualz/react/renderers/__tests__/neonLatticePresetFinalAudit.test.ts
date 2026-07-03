import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_NEON_LATTICE_SETTINGS,
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_REACT_PRESETS,
  type ReactPreset,
} from '../../ReactTypes'
import { normalizeNeonLatticeSettings } from '../../NeonLatticeConfig'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../../reactEngineCatalog'
import { DEFAULT_REACT_RENDER_PARAMS, renderReactEngine, type ReactFrameContext } from '../ReactEngineRenderer'
import { STABLE_NEON_LATTICE_PRESET_IDS } from '../neonLatticePresetValidation'
import { RETIRED_NEON_LATTICE_BUILT_IN_PRESET_IDS } from '../../../../../stores/reactStore'

describe('final Neon Lattice retirement audit', () => {
  it('keeps every historical public ID recognized while removing it from live registration', () => {
    expect([...RETIRED_NEON_LATTICE_BUILT_IN_PRESET_IDS]).toEqual(expect.arrayContaining([
      ...STABLE_NEON_LATTICE_PRESET_IDS,
      'preset-nl-reverie-keygrid',
    ]))
    expect(DEFAULT_REACT_PRESETS.some(preset => preset.engine === 'neonLattice')).toBe(false)
    expect(DEFAULT_REACT_PRESETS.some(preset => preset.id.startsWith('preset-nl-'))).toBe(false)
  })

  it('removes Neon from the canonical selectable engine catalog', () => {
    expect(REACT_ENGINE_IDS).toEqual(['shaderPads', 'cinematicPortal', 'oscilloscope', 'laserDmx'])
    expect(REACT_ENGINE_IDS).not.toContain('neonLattice')
    expect(Object.keys(REACT_ENGINE_CATALOG)).not.toContain('neonLattice')
  })

  it('central renderer dispatch treats a malformed retired preset as an unknown safe frame', () => {
    const base = DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'cinematicPortal')!
    const retiredPreset = {
      ...base,
      id: 'malformed-retired-preset',
      engine: 'neonLattice',
      neonLatticeSettings: DEFAULT_NEON_LATTICE_SETTINGS,
    } as ReactPreset
    const clearRect = vi.fn()
    const fillRect = vi.fn()
    const ctx = {
      clearRect,
      fillRect,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D
    const frame: ReactFrameContext = {
      W: 1280,
      H: 720,
      dpr: 1,
      t: 0,
      audioTime: 0,
      bpm: 120,
      beatPhase: 0,
      beatHit: false,
      isPlaying: true,
      audio: { bass: 0, mid: 0, high: 0, volume: 0 },
      freqData: null,
      timeDomainData: null,
      musicIntelligence: null,
    }

    expect(() => renderReactEngine(ctx, frame, retiredPreset, DEFAULT_REACT_RENDER_PARAMS)).not.toThrow()
    expect(clearRect).toHaveBeenCalledWith(0, 0, 1280, 720)
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1280, 720)
  })

  it('leaves no default performance pad pointing at a retired preset or action', () => {
    for (const pad of DEFAULT_PERFORMANCE_PADS) {
      expect(pad.presetId?.startsWith('preset-nl-') ?? false).toBe(false)
      expect((pad as { actionId?: string }).actionId?.startsWith('neonLattice.') ?? false).toBe(false)
    }
    expect(DEFAULT_PERFORMANCE_PADS.find(pad => pad.id === 'pad-13')?.presetId).toBeNull()
    expect(DEFAULT_PERFORMANCE_PADS.find(pad => pad.id === 'pad-18')?.presetId).toBeNull()
  })

  it('retains deterministic compatibility normalization for staged deletion', () => {
    const malformed = normalizeNeonLatticeSettings({
      ...DEFAULT_NEON_LATTICE_SETTINGS,
      orientationWeights: { vertical: Number.NaN, horizontal: -4, diagonalUp: 2, diagonalDown: 3 },
      lanePattern: {
        ...DEFAULT_NEON_LATTICE_SETTINGS.lanePattern,
        laneCount: 4,
        sequenceLength: 2,
        steps: [{ lanes: [-100, 99], paletteRole: 'not-a-role' as never }],
      },
      customSegments: [{ id: 'bad', startX: 0.5, startY: 0.5, endX: 0.5, endY: 0.5 }],
    })
    expect(malformed.customSegments).toEqual([])
    expect(malformed.lanePattern.steps).toHaveLength(2)
    expect(malformed.lanePattern.steps.flatMap(step => step.lanes).every(lane => lane >= 0 && lane < 4)).toBe(true)
    expect(normalizeNeonLatticeSettings(malformed)).toEqual(malformed)
    expect(malformed).not.toHaveProperty('runtime')
  })
})
