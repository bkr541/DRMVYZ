import { describe, expect, it } from 'vitest'
import { DEFAULT_REACT_PRESETS, type ReactEngineId } from '../ReactTypes'
import {
  getReactDefaultLeftTab,
  getReactLeftTabLabel,
  getReactLeftTabs,
  getReactLowerSurfaces,
  getReactPresetTabLabel,
  isReactLowerSurfaceAvailable,
  isReactLeftTabAvailable,
  resolveReactWorkspaceComposition,
} from '../reactWorkspaceComposition'

describe('React workspace composition', () => {
  it('keeps shared Track Map visible for every engine', () => {
    const engines: ReactEngineId[] = [
      'shaderPads',
      'cinematicPortal',
      'cinema',
      'oscilloscope',
      'canvas',
      'laserDmx',
      'pixGrid',
    ]

    for (const engine of engines) {
      expect(resolveReactWorkspaceComposition(engine, 'beamMatrix', false).showTrackMap)
        .toBe(true)
    }
  })

  it('mounts Sound Drawing authoring lanes only for Sound Drawing', () => {
    const soundDrawing = resolveReactWorkspaceComposition('oscilloscope', 'beamMatrix', false)
    expect(soundDrawing.showSoundDrawingTimeline).toBe(true)
    expect(getReactLowerSurfaces(soundDrawing)).toEqual([
      'trackMap',
      'soundDrawing',
      'performancePads',
    ])
    expect(isReactLowerSurfaceAvailable('soundDrawing', soundDrawing)).toBe(true)

    for (const engine of ['shaderPads', 'cinematicPortal', 'cinema', 'canvas', 'laserDmx', 'pixGrid'] as ReactEngineId[]) {
      const composition = resolveReactWorkspaceComposition(engine, 'beamMatrix', false)
      expect(composition.showSoundDrawingTimeline).toBe(false)
      expect(getReactLowerSurfaces(composition)).not.toContain('soundDrawing')
      expect(isReactLowerSurfaceAvailable('soundDrawing', composition)).toBe(false)
    }
  })

  it('uses Shader Scenes instead of React presets while CANVAS keeps contextual pads', () => {
    const shader = resolveReactWorkspaceComposition('shaderPads', 'beamMatrix', false)

    expect(DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'shaderPads')).toHaveLength(0)
    expect(shader.presetSurface).toBe('shaderScenes')
    expect(getReactPresetTabLabel(shader)).toBe('SCENES')
    expect(shader.showPerformancePads).toBe(false)

    const canvas = resolveReactWorkspaceComposition('canvas', 'beamMatrix', false)
    expect(DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'canvas')).toHaveLength(0)
    expect(canvas.presetSurface).toBe('enginePresets')
    expect(getReactPresetTabLabel(canvas)).toBe('PRESETS')
    expect(canvas.showPerformancePads).toBe(true)

    const cinema = resolveReactWorkspaceComposition('cinema', 'beamMatrix', false)
    expect(cinema.presetSurface).toBe('enginePresets')
    expect(getReactPresetTabLabel(cinema)).toBe('PRESETS')
    expect(cinema.showPerformancePads).toBe(false)

    for (const engine of ['cinematicPortal', 'oscilloscope', 'canvas', 'laserDmx', 'pixGrid'] as ReactEngineId[]) {
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

    const cinema = resolveReactWorkspaceComposition('cinema', 'beamMatrix', false)
    expect(getReactLeftTabs(cinema)).toEqual(['workspace', 'layers'])
    expect(getReactLeftTabLabel('workspace', cinema)).toBe('SOURCE')
    expect(getReactLeftTabLabel('layers', cinema)).toBe('LAYERS')

    const cinematic = resolveReactWorkspaceComposition('cinematicPortal', 'beamMatrix', false)
    expect(getReactLeftTabs(cinematic)).toEqual(['workspace'])
    expect(getReactDefaultLeftTab(cinematic)).toBe('workspace')
    expect(getReactLeftTabLabel('workspace', cinematic)).toBe('SOURCE')
    expect(isReactLeftTabAvailable('media', cinematic)).toBe(false)

    const soundDrawing = resolveReactWorkspaceComposition('oscilloscope', 'beamMatrix', false)
    expect(getReactLeftTabs(soundDrawing)).toEqual(['workspace', 'media', 'fonts'])
    expect(getReactLeftTabLabel('workspace', soundDrawing)).toBe('SOURCE')

    const canvas = resolveReactWorkspaceComposition('canvas', 'beamMatrix', false)
    expect(getReactLeftTabs(canvas)).toEqual(['workspace'])
    expect(getReactLeftTabLabel('workspace', canvas)).toBe('SOURCE')

    const pixGrid = resolveReactWorkspaceComposition('pixGrid', 'beamMatrix', false)
    expect(getReactLeftTabs(pixGrid)).toEqual(['workspace', 'media'])
    expect(getReactLeftTabLabel('workspace', pixGrid)).toBe('SETUP')
  })

  it('never advertises unfinished or unrelated contextual destinations', () => {
    for (const engine of ['shaderPads', 'cinematicPortal', 'cinema', 'oscilloscope', 'canvas', 'laserDmx', 'pixGrid'] as ReactEngineId[]) {
      const tabs = getReactLeftTabs(resolveReactWorkspaceComposition(engine, 'beamMatrix', false))
      expect(tabs).not.toContain('sessions')
      if (engine !== 'oscilloscope') expect(tabs).not.toContain('fonts')
      if (engine !== 'oscilloscope' && engine !== 'pixGrid') expect(tabs).not.toContain('media')
    }
  })
})
