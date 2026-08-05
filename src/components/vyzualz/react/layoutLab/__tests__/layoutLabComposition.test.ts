import { describe, expect, it } from 'vitest'
import { REACT_ENGINE_IDS } from '../../reactEngineCatalog'
import {
  getReactDefaultLeftTab,
  getReactLeftTabLabel,
  getReactLeftTabs,
  getReactLowerSurfaceLabel,
  getReactLowerSurfaces,
  resolveReactWorkspaceComposition,
} from '../../reactWorkspaceComposition'
import { resolveLayoutLabComposition } from '../layoutLabComposition'

describe('Layout Lab production composition parity', () => {
  it.each(REACT_ENGINE_IDS)('matches production tabs and lower surfaces for %s', engineId => {
    const production = resolveReactWorkspaceComposition(engineId, null, false)
    const layoutLab = resolveLayoutLabComposition(engineId)

    expect(layoutLab.defaultLeftTab).toBe(getReactDefaultLeftTab(production))
    expect(layoutLab.leftTabs).toEqual(getReactLeftTabs(production).map(id => ({
      id,
      label: getReactLeftTabLabel(id, production),
    })))
    expect(layoutLab.lowerSurfaces).toEqual(getReactLowerSurfaces(production).map(id => ({
      id,
      label: getReactLowerSurfaceLabel(id),
    })))
  })

  it('keeps the three critical lower-tray contracts explicit', () => {
    expect(resolveLayoutLabComposition('shaderPads').lowerSurfaces.map(surface => surface.id)).toEqual(['trackMap'])
    expect(resolveLayoutLabComposition('oscilloscope').lowerSurfaces.map(surface => surface.id)).toEqual(['trackMap', 'soundDrawing', 'performancePads'])
    expect(resolveLayoutLabComposition('pixGrid').lowerSurfaces.map(surface => surface.id)).toEqual(['trackMap', 'performancePads'])
  })
})
