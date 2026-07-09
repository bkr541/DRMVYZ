import { describe, expect, it } from 'vitest'
import { DEFAULT_REACT_PRESETS, type ReactEngineId } from '../ReactTypes'
import {
  getReactLeftTabLabel,
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
      'canvas',
      'laserDmx',
    ]

    for (const engine of engines) {
      expect(resolveReactWorkspaceComposition(engine, 'beamMatrix', false).showTrackMap)
        .toBe(true)
    }
  })

  it('mounts Sound Drawing authoring lanes only for Sound Drawing', () => {
    expect(resolveReactWorkspaceComposition('oscilloscope', 'beamMatrix', false).showSoundDrawingTimeline)
      .toBe(true)

    for (const engine of ['shaderPads', 'cinematicPortal', 'canvas', 'laserDmx'] as ReactEngineId[]) {
      expect(resolveReactWorkspaceComposition(engine, 'beamMatrix', false).showSoundDrawingTimeline)
        .toBe(false)
    }
  })

  it('uses Shader Scenes instead of React presets and preset performance pads', () => {
    const shader = resolveReactWorkspaceComposition('shaderPads', 'beamMatrix', false)

    expect(DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'shaderPads')).toHaveLength(0)
    expect(shader.presetSurface).toBe('shaderScenes')
    expect(getReactPresetTabLabel(shader)).toBe('SCENES')
    expect(shader.showPerformancePads).toBe(false)

    const canvas = resolveReactWorkspaceComposition('canvas', 'beamMatrix', false)
    expect(DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'canvas')).toHaveLength(0)
    expect(canvas.presetSurface).toBe('enginePresets')
    expect(getReactPresetTabLabel(canvas)).toBe('PRESETS')
    expect(canvas.showPerformancePads).toBe(false)

    for (const engine of ['cinematicPortal', 'oscilloscope', 'laserDmx'] as ReactEngineId[]) {
      const composition = resolveReactWorkspaceComposition(engine, 'beamMatrix', false)
      expect(composition.presetSurface).toBe('enginePresets')
      expect(getReactPresetTabLabel(composition)).toBe('PRESETS')
      expect(composition.showPerformancePads).toBe(true)
    }
  })

  it('exposes Laser Layers and the beam editor even when a retired workspace value is requested', () => {
    const retiredWorkspaceRequest = resolveReactWorkspaceComposition('laserDmx', 'retiredFixtureRig', true)
    expect(retiredWorkspaceRequest.showLaserLayersTab).toBe(true)
    expect(retiredWorkspaceRequest.showLaserBeamEditor).toBe(true)
    expect(getReactLeftTabs(retiredWorkspaceRequest)).toEqual(['workspace', 'layers'])
    expect(getReactLeftTabLabel('workspace', retiredWorkspaceRequest)).toBe('RIG')

    const matrixHidden = resolveReactWorkspaceComposition('laserDmx', 'beamMatrix', false)
    expect(matrixHidden.showLaserLayersTab).toBe(true)
    expect(matrixHidden.showLaserBeamEditor).toBe(false)
    expect(getReactLeftTabs(matrixHidden)).toEqual(['workspace', 'layers'])

    const matrixVisible = resolveReactWorkspaceComposition('laserDmx', 'beamMatrix', true)
    expect(matrixVisible.showLaserBeamEditor).toBe(true)
    expect(isReactLeftTabAvailable('layers', matrixVisible)).toBe(true)
  })

  it('shows only source tools that are relevant to the selected engine', () => {
    const shader = resolveReactWorkspaceComposition('shaderPads', 'beamMatrix', false)
    expect(getReactLeftTabs(shader)).toEqual(['workspace'])
    expect(getReactLeftTabLabel('workspace', shader)).toBe('SETUP')

    const cinematic = resolveReactWorkspaceComposition('cinematicPortal', 'beamMatrix', false)
    expect(getReactLeftTabs(cinematic)).toEqual(['workspace', 'media'])
    expect(getReactLeftTabLabel('workspace', cinematic)).toBe('WORLD')

    const soundDrawing = resolveReactWorkspaceComposition('oscilloscope', 'beamMatrix', false)
    expect(getReactLeftTabs(soundDrawing)).toEqual(['workspace', 'media', 'fonts'])
    expect(getReactLeftTabLabel('workspace', soundDrawing)).toBe('SOURCE')

    const canvas = resolveReactWorkspaceComposition('canvas', 'beamMatrix', false)
    expect(getReactLeftTabs(canvas)).toEqual(['workspace', 'media'])
    expect(getReactLeftTabLabel('workspace', canvas)).toBe('SETUP')
  })

  it('never advertises unfinished or unrelated contextual destinations', () => {
    for (const engine of ['shaderPads', 'cinematicPortal', 'oscilloscope', 'canvas', 'laserDmx'] as ReactEngineId[]) {
      const tabs = getReactLeftTabs(resolveReactWorkspaceComposition(engine, 'beamMatrix', false))
      expect(tabs).not.toContain('sessions')
      if (engine !== 'oscilloscope') expect(tabs).not.toContain('fonts')
      if (engine !== 'cinematicPortal' && engine !== 'oscilloscope' && engine !== 'canvas') expect(tabs).not.toContain('media')
    }
  })
})
