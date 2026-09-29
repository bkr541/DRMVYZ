import { describe, expect, it } from 'vitest'
import { resolveActiveEnginePresetName, type ActiveEnginePresetInput } from './activeEnginePresetName'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from './LaserDmxShowDirectorPerformancePresets'
import { LASER_DMX_BEAM_MATRIX_PRESETS } from './laserDmxBeamMatrixPresets'
import { LASER_DMX_SHOW_DIRECTOR_TEMPLATES } from './laserDmxShowDirectorTemplates'

const base: ActiveEnginePresetInput = {
  engineId: 'canvas',
  cinema2PresetId: null,
  selectedCanvasPresetId: null,
  activeCinemaCompositionName: null,
  activeReactPresetId: null,
  reactPresets: [
    { id: 'sd-1', engine: 'oscilloscope', name: 'Neon Lissajous' },
    { id: 'pg-1', engine: 'pixGrid', name: 'Wall Sweep' },
  ],
  laserDmxMode: 'manual',
  activeLaserDmxBeamMatrixPresetId: null,
  laserDmxPerformancePresetId: null,
  laserDmxRigTemplateId: null,
}
const name = (patch: Partial<ActiveEnginePresetInput>) => resolveActiveEnginePresetName({ ...base, ...patch })

describe('active engine preset name (Engine dropdown)', () => {
  it('names the selected preset of every engine that has presets', () => {
    expect(name({ engineId: 'cinema2', cinema2PresetId: 'drmvyz.cinema2.reliquary' as never })).toBe('RELIQUARY')
    expect(name({ engineId: 'canvas', selectedCanvasPresetId: 'canvas-bass-bloom' })).toBe('Bass Bloom')
    expect(name({ engineId: 'cinema', activeCinemaCompositionName: 'Prism Tunnel' })).toBe('Prism Tunnel')
    expect(name({ engineId: 'oscilloscope', activeReactPresetId: 'sd-1' })).toBe('Neon Lissajous')
    expect(name({ engineId: 'pixGrid', activeReactPresetId: 'pg-1' })).toBe('Wall Sweep')
  })

  it('shows nothing when nothing is selected, when the selection belongs to another engine, or when the engine has no presets', () => {
    expect(name({ engineId: 'cinema2', cinema2PresetId: 'not-a-preset' as never })).toBeNull()
    expect(name({ engineId: 'cinema', activeCinemaCompositionName: null })).toBeNull()
    expect(name({ engineId: 'pixGrid', activeReactPresetId: 'sd-1' })).toBeNull() // a Sound Drawing preset is not a PixGrid selection
    expect(name({ engineId: 'oscilloscope', activeReactPresetId: null })).toBeNull()
    expect(name({ engineId: 'headliner', activeReactPresetId: 'sd-1' })).toBeNull()
  })

  it('LaserDMX follows its authoring mode: the Beam Matrix preset, or in Show Director the applied Performance Show, else the Rig Layout', () => {
    const matrix = LASER_DMX_BEAM_MATRIX_PRESETS[0]!
    const show = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS[0]!
    const rig = LASER_DMX_SHOW_DIRECTOR_TEMPLATES[0]!
    const common = { engineId: 'laserDmx' as const, activeLaserDmxBeamMatrixPresetId: matrix.id, laserDmxPerformancePresetId: show.id, laserDmxRigTemplateId: rig.id }
    expect(name({ ...common, laserDmxMode: 'manual' })).toBe(matrix.name)
    expect(name({ ...common, laserDmxMode: 'showDirector' })).toBe(show.name)
    expect(name({ ...common, laserDmxMode: 'showDirector', laserDmxPerformancePresetId: null })).toBe(rig.name)
    expect(name({ ...common, laserDmxMode: 'showDirector', laserDmxPerformancePresetId: null, laserDmxRigTemplateId: null })).toBeNull()
    expect(name({ ...common, laserDmxMode: 'manual', activeLaserDmxBeamMatrixPresetId: null })).toBeNull()
  })
})
