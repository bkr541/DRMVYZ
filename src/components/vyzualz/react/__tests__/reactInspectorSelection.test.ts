import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OSCILLATOR_SETTINGS,
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxSettings,
} from '../ReactTypes'
import { resolveReactInspectorSelection } from '../reactInspectorSelection'
import type { LaserDmxMatrixBeam } from '../ReactTypes'

function baseArgs() {
  return {
    activeReactEngineId: 'cinematicPortal' as const,
    activeShaderId: null,
    oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS },
    laserDmxSettings: createDefaultLaserDmxSettings(),
    laserDmxWorkspaceMode: 'spatialFixtures' as const,
    laserDmxBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
  }
}

describe('resolveReactInspectorSelection', () => {
  it('does not treat an active preset or engine alone as an inspectable object', () => {
    expect(resolveReactInspectorSelection(baseArgs())).toBeNull()
  })

  it('requires a concrete selected SVG asset but accepts built-in Sound Drawing sources', () => {
    const svgArgs = baseArgs()
    expect(resolveReactInspectorSelection({
      ...svgArgs,
      activeReactEngineId: 'oscilloscope',
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, sourceType: 'svg', selectedSvgId: null },
    })).toBeNull()

    expect(resolveReactInspectorSelection({
      ...svgArgs,
      activeReactEngineId: 'oscilloscope',
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, sourceType: 'svg', selectedSvgId: 'media-svg-1' },
    })).toEqual({ kind: 'soundDrawingSource', id: 'media-svg-1' })

    expect(resolveReactInspectorSelection({
      ...svgArgs,
      activeReactEngineId: 'oscilloscope',
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, sourceType: 'builtinShape', builtinShape: 'star' },
    })).toEqual({ kind: 'soundDrawingSource', id: 'shape:star' })
  })

  it('requires an active Shader scene', () => {
    expect(resolveReactInspectorSelection({
      ...baseArgs(),
      activeReactEngineId: 'shaderPads',
      activeShaderId: null,
    })).toBeNull()
    expect(resolveReactInspectorSelection({
      ...baseArgs(),
      activeReactEngineId: 'shaderPads',
      activeShaderId: 'shader-1',
    })).toEqual({ kind: 'shaderScene', id: 'shader-1' })
  })

  it('requires a valid selected LaserDMX fixture', () => {
    const args = baseArgs()
    const selectedId = args.laserDmxSettings.selectedFixtureId!
    expect(resolveReactInspectorSelection({ ...args, activeReactEngineId: 'laserDmx' }))
      .toEqual({ kind: 'laserFixture', id: selectedId })

    expect(resolveReactInspectorSelection({
      ...args,
      activeReactEngineId: 'laserDmx',
      laserDmxSettings: { ...args.laserDmxSettings, selectedFixtureId: 'missing' },
    })).toBeNull()
  })

  it('uses a valid selected beam before a selected reaction group', () => {
    const args = baseArgs()
    const beam = { id: 'beam-1', name: 'Beam 1' } as LaserDmxMatrixBeam
    const matrix = {
      ...args.laserDmxBeamMatrix,
      beams: [beam],
      selectedBeamIds: [beam.id],
      selectedGroupId: args.laserDmxBeamMatrix.groups[0].id,
    }
    expect(resolveReactInspectorSelection({
      ...args,
      activeReactEngineId: 'laserDmx',
      laserDmxWorkspaceMode: 'beamMatrix',
      laserDmxBeamMatrix: matrix,
    })).toEqual({ kind: 'laserBeam', id: beam.id })

    expect(resolveReactInspectorSelection({
      ...args,
      activeReactEngineId: 'laserDmx',
      laserDmxWorkspaceMode: 'beamMatrix',
      laserDmxBeamMatrix: { ...matrix, selectedBeamIds: [] },
    })).toEqual({ kind: 'laserGroup', id: matrix.selectedGroupId })
  })
})
