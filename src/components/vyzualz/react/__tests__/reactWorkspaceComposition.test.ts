import { describe, expect, it } from 'vitest'
import { DEFAULT_REACT_PRESETS, type ReactEngineId } from '../ReactTypes'
import {
  getReactLeftTabs,
  getReactPresetTabLabel,
  isReactLeftTabAvailable,
  resolveReactWorkspaceComposition,
} from '../reactWorkspaceComposition'

describe('React workspace composition', () => {
  it('keeps shared Track Map visible for every engine', () => {
    const engines: ReactEngineId[] = [
      'shaderPads',
      'cinematicPortal',
      'oscilloscope',
      'laserDmx',
      'neonLattice',
    ]

    for (const engine of engines) {
      expect(resolveReactWorkspaceComposition(engine, 'spatialFixtures', false).showTrackMap)
        .toBe(true)
    }
  })

  it('mounts Sound Drawing authoring lanes only for Sound Drawing', () => {
    expect(resolveReactWorkspaceComposition('oscilloscope', 'spatialFixtures', false).showSoundDrawingTimeline)
      .toBe(true)

    for (const engine of ['shaderPads', 'cinematicPortal', 'laserDmx', 'neonLattice'] as ReactEngineId[]) {
      expect(resolveReactWorkspaceComposition(engine, 'spatialFixtures', false).showSoundDrawingTimeline)
        .toBe(false)
    }
  })

  it('uses Shader Scenes instead of React presets and preset performance pads', () => {
    const shader = resolveReactWorkspaceComposition('shaderPads', 'spatialFixtures', false)

    expect(DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'shaderPads')).toHaveLength(0)
    expect(shader.presetSurface).toBe('shaderScenes')
    expect(getReactPresetTabLabel(shader)).toBe('SCENES')
    expect(shader.showPerformancePads).toBe(false)

    for (const engine of ['cinematicPortal', 'oscilloscope', 'laserDmx', 'neonLattice'] as ReactEngineId[]) {
      const composition = resolveReactWorkspaceComposition(engine, 'spatialFixtures', false)
      expect(composition.presetSurface).toBe('enginePresets')
      expect(getReactPresetTabLabel(composition)).toBe('PRESETS')
      expect(composition.showPerformancePads).toBe(true)
    }
  })

  it('exposes Laser Layers and the beam editor only in Beam Matrix workspace', () => {
    const spatial = resolveReactWorkspaceComposition('laserDmx', 'spatialFixtures', true)
    expect(spatial.showLaserLayersTab).toBe(false)
    expect(spatial.showLaserBeamEditor).toBe(false)
    expect(getReactLeftTabs(spatial)).not.toContain('layers')

    const matrixHidden = resolveReactWorkspaceComposition('laserDmx', 'beamMatrix', false)
    expect(matrixHidden.showLaserLayersTab).toBe(true)
    expect(matrixHidden.showLaserBeamEditor).toBe(false)
    expect(getReactLeftTabs(matrixHidden)).toContain('layers')

    const matrixVisible = resolveReactWorkspaceComposition('laserDmx', 'beamMatrix', true)
    expect(matrixVisible.showLaserBeamEditor).toBe(true)
    expect(isReactLeftTabAvailable('layers', matrixVisible)).toBe(true)
  })

  it('never advertises unfinished Sessions or unrelated Layers destinations', () => {
    for (const engine of ['shaderPads', 'cinematicPortal', 'oscilloscope', 'neonLattice'] as ReactEngineId[]) {
      const tabs = getReactLeftTabs(resolveReactWorkspaceComposition(engine, 'spatialFixtures', false))
      expect(tabs).toEqual(['engine', 'media', 'fonts'])
      expect(tabs).not.toContain('layers')
      expect(tabs).not.toContain('sessions')
    }
  })
})
