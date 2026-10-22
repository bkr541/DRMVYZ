import { describe, expect, it } from 'vitest'
import { DEFAULT_REACT_PRESETS, type ReactEngineId } from '../ReactTypes'
import {
  getReactDefaultLeftTab,
  getReactLeftTabLabel,
  getReactLeftTabs,
  getReactLowerSurfaces,
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
      'cinema2',
      'headliner',
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

    for (const engine of ['shaderPads', 'cinematicPortal', 'cinema', 'canvas', 'laserDmx', 'pixGrid', 'headliner'] as ReactEngineId[]) {
      const composition = resolveReactWorkspaceComposition(engine, 'beamMatrix', false)
      expect(composition.showSoundDrawingTimeline).toBe(false)
      expect(getReactLowerSurfaces(composition)).not.toContain('soundDrawing')
      expect(isReactLowerSurfaceAvailable('soundDrawing', composition)).toBe(false)
    }
  })

  it('shows the performance pads for every selectable engine', () => {
    const engines = ['shaderPads', 'cinema2', 'headliner', 'oscilloscope', 'canvas', 'laserDmx', 'pixGrid', 'cinematicPortal'] as ReactEngineId[]
    for (const engine of engines) {
      const composition = resolveReactWorkspaceComposition(engine, 'beamMatrix', false)
      expect(composition.showPerformancePads, engine).toBe(true)
      expect(getReactLowerSurfaces(composition), engine).toContain('performancePads')
      expect(isReactLowerSurfaceAvailable('performancePads', composition), engine).toBe(true)
    }
  })

  it('keeps the performance pads on every engine, and has no default presets for the retired shader engine', () => {
    expect(DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'shaderPads')).toHaveLength(0)

    const canvas = resolveReactWorkspaceComposition('canvas', 'beamMatrix', false)
    expect(DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'canvas')).toHaveLength(0)
    expect(canvas.showPerformancePads).toBe(true)

    const cinema = resolveReactWorkspaceComposition('cinema', 'beamMatrix', false)
    expect(cinema.showPerformancePads).toBe(true)

    const cinema2 = resolveReactWorkspaceComposition('cinema2', 'beamMatrix', false)
    expect(cinema2.showPerformancePads).toBe(true)
    expect(getReactLowerSurfaces(cinema2)).toEqual(['trackMap', 'performancePads'])
    expect(cinema2.showTrackMap).toBe(true)

    for (const engine of ['cinematicPortal', 'oscilloscope', 'canvas', 'laserDmx', 'pixGrid'] as ReactEngineId[]) {
      const composition = resolveReactWorkspaceComposition(engine, 'beamMatrix', false)
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

    const cinema2 = resolveReactWorkspaceComposition('cinema2', 'beamMatrix', false)
    expect(getReactLeftTabs(cinema2)).toEqual(['workspace', 'layers'])
    expect(getReactLeftTabLabel('workspace', cinema2)).toBe('SOURCE')
    expect(getReactLeftTabLabel('layers', cinema2)).toBe('LAYERS')

    const cinematic = resolveReactWorkspaceComposition('cinematicPortal', 'beamMatrix', false)
    expect(getReactLeftTabs(cinematic)).toEqual(['workspace'])
    expect(getReactDefaultLeftTab(cinematic)).toBe('workspace')
    expect(getReactLeftTabLabel('workspace', cinematic)).toBe('SOURCE')
    expect(isReactLeftTabAvailable('media', cinematic)).toBe(false)

    const soundDrawing = resolveReactWorkspaceComposition('oscilloscope', 'beamMatrix', false)
    expect(getReactLeftTabs(soundDrawing)).toEqual(['workspace', 'media', 'fonts'])
    expect(getReactLeftTabLabel('workspace', soundDrawing)).toBe('SOURCE')

    const canvas = resolveReactWorkspaceComposition('canvas', 'beamMatrix', false)
    expect(getReactLeftTabs(canvas)).toEqual(['workspace', 'layers'])
    expect(getReactLeftTabLabel('workspace', canvas)).toBe('SOURCE')
    expect(getReactLeftTabLabel('layers', canvas)).toBe('LAYERS')

    const pixGrid = resolveReactWorkspaceComposition('pixGrid', 'beamMatrix', false)
    expect(getReactLeftTabs(pixGrid)).toEqual(['workspace', 'media'])
    expect(getReactLeftTabLabel('workspace', pixGrid)).toBe('SETUP')
  })

  it('gives Headliner its minimal setup rail plus the same Track Map and performance pads as every other engine', () => {
    const headliner = resolveReactWorkspaceComposition('headliner', 'beamMatrix', false)

    expect(getReactLeftTabs(headliner)).toEqual(['workspace'])
    expect(getReactLeftTabLabel('workspace', headliner)).toBe('SETUP')
    expect(getReactLowerSurfaces(headliner)).toEqual(['trackMap', 'performancePads'])
    expect(headliner.showTrackMap).toBe(true)
    expect(headliner.showPerformancePads).toBe(true)
    expect(headliner.showSoundDrawingTimeline).toBe(false)
  })

  it('never advertises unfinished or unrelated contextual destinations', () => {
    for (const engine of ['shaderPads', 'cinematicPortal', 'cinema', 'oscilloscope', 'canvas', 'laserDmx', 'pixGrid', 'headliner'] as ReactEngineId[]) {
      const tabs = getReactLeftTabs(resolveReactWorkspaceComposition(engine, 'beamMatrix', false))
      expect(tabs).not.toContain('sessions')
      if (engine !== 'oscilloscope') expect(tabs).not.toContain('fonts')
      if (engine !== 'oscilloscope' && engine !== 'pixGrid') expect(tabs).not.toContain('media')
    }
  })
})
