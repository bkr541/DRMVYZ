import { describe, expect, it } from 'vitest'
import { LASER_DMX_BEAM_MATRIX_PRESETS } from './laserDmxBeamMatrixPresets'
import {
  isLaserDmxBeamMatrixPresetModified,
  resolveLaserDmxBeamMatrixPresetProvenance,
} from './LaserDmxBeamMatrixPresetProvenance'

describe('LaserDMX Beam Matrix preset provenance', () => {
  it('preserves the stable preset ID while edits and exact restoration change status', () => {
    const preset = LASER_DMX_BEAM_MATRIX_PRESETS[0]
    expect(preset).toBeDefined()
    const exact = preset.createSettings()
    const modified = {
      ...exact,
      output: { ...exact.output, globalGlow: Math.max(0, exact.output.globalGlow - 0.1) },
    }

    expect(resolveLaserDmxBeamMatrixPresetProvenance(exact, preset.id).status).toBe('exact')
    expect(resolveLaserDmxBeamMatrixPresetProvenance(modified, preset.id).status).toBe('modified')
    expect(resolveLaserDmxBeamMatrixPresetProvenance(preset.createSettings(), preset.id).status).toBe('exact')
  })

  it('ignores editor selection and temporary group mute/solo state', () => {
    const preset = LASER_DMX_BEAM_MATRIX_PRESETS.find(candidate => candidate.createSettings().groups.length > 0)
      ?? LASER_DMX_BEAM_MATRIX_PRESETS[0]
    const exact = preset.createSettings()
    const performanceOnly = {
      ...exact,
      selectedBeamIds: exact.beams[0] ? [exact.beams[0].id] : [],
      selectedGroupId: exact.groups[0]?.id ?? null,
      groups: exact.groups.map(group => ({ ...group, muted: true, soloed: true })),
    }

    expect(isLaserDmxBeamMatrixPresetModified(performanceOnly, preset.id)).toBe(false)
    expect(isLaserDmxBeamMatrixPresetModified(exact, 'missing-preset-id')).toBe(true)
  })
})
