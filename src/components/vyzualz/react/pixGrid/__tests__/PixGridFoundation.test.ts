import { describe, expect, it } from 'vitest'
import { DEFAULT_REACT_PRESETS } from '../../ReactTypes'
import { isSelectableReactEngineId, REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../../reactEngineCatalog'
import { resolveReactWorkspaceComposition } from '../../reactWorkspaceComposition'
import {
  DEFAULT_PIX_GRID_QUALITY,
  PIX_GRID_MATRIX_DIMENSIONS,
  createDefaultPixGridState,
} from '../PixGridDefaults'
import { PIX_GRID_PRESET_IDS, PIX_GRID_PRESETS } from '../PixGridPresets'
import { normalizePixGridState } from '../PixGridValidation'

describe('PixGrid engine foundation', () => {
  it('registers PixGrid as a selectable React engine', () => {
    expect(REACT_ENGINE_IDS).toContain('pixGrid')
    expect(isSelectableReactEngineId('pixGrid')).toBe(true)
    expect(REACT_ENGINE_CATALOG.pixGrid).toMatchObject({
      label: 'PixGrid',
      shortLabel: 'PixGrid',
      description: 'Programmable LED-cell artwork, animation, and full-song pixel choreography.',
    })
  })

  it('registers four distinct built-in PixGrid presets', () => {
    const registered = DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'pixGrid')
    expect(registered.map(preset => preset.id)).toEqual([...PIX_GRID_PRESET_IDS])
    expect(registered).toHaveLength(4)
    expect(new Set(registered.map(preset => preset.palette.primary)).size).toBe(4)
    expect(new Set(registered.map(preset => preset.pixGridSettings?.pattern)).size).toBe(4)
    expect(PIX_GRID_PRESETS.every(preset => preset.scenes.length > 0 && preset.sectionMappings.length > 0)).toBe(true)
  })

  it('locks High/default quality to a 160 × 90 matrix and preserves 16:9 tiers', () => {
    const state = createDefaultPixGridState()
    expect(DEFAULT_PIX_GRID_QUALITY).toBe('high')
    expect(state).toMatchObject({ quality: 'high', matrixWidth: 160, matrixHeight: 90 })
    expect(PIX_GRID_MATRIX_DIMENSIONS).toEqual({
      draft: { width: 64, height: 36 },
      low: { width: 96, height: 54 },
      high: { width: 160, height: 90 },
      ultra: { width: 256, height: 144 },
    })
    for (const dimensions of Object.values(PIX_GRID_MATRIX_DIMENSIONS)) {
      expect(dimensions.width / dimensions.height).toBeCloseTo(16 / 9, 8)
    }
  })

  it('normalizes corrupt values into compact, bounded, serializable state', () => {
    const normalized = normalizePixGridState({
      quality: 'ultra',
      matrixWidth: 99999,
      matrixHeight: -4,
      cellGap: 9,
      cellRoundness: -1,
      globalIntensity: Number.NaN,
      glowAmount: 7,
      backgroundBrightness: 9,
      diffusion: -1,
      rgbSubpixelMode: true,
      stoppedBehavior: 'random',
      backgroundColor: 'not-a-color',
      layers: [{ id: '', name: '', visible: 'yes', opacity: 4, blendMode: 'invalid' }],
      groups: [{ id: 'group', cellRuns: [[999, -5, 9999]] }],
      pixelOverrides: [[999, -2, '#ABCDEF', 9], [999, -2, '#123456', 0.4]],
      performance: { lockedRoutes: ['bass', 'bass', '', 42] },
    })

    expect(normalized.matrixWidth).toBe(256)
    expect(normalized.matrixHeight).toBe(144)
    expect(normalized.cellGap).toBe(0.45)
    expect(normalized.cellRoundness).toBe(0)
    expect(normalized.globalIntensity).toBe(createDefaultPixGridState().globalIntensity)
    expect(normalized.glowAmount).toBe(1)
    expect(normalized.backgroundBrightness).toBe(1)
    expect(normalized.diffusion).toBe(0)
    expect(normalized.rgbSubpixelMode).toBe(true)
    expect(normalized.stoppedBehavior).toBe('baseline')
    expect(normalized.backgroundColor).toBe('#030608')
    expect(normalized.layers[0]).toMatchObject({ opacity: 1, blendMode: 'normal' })
    expect(normalized.groups[0].cellRuns[0]).toEqual([143, 0, 256])
    expect(normalized.pixelOverrides).toEqual([[255, 0, 1, '#123456', 0.4]])
    expect(normalized.performance.lockedRoutes).toEqual(['bass'])
    expect(() => JSON.stringify(normalized)).not.toThrow()
  })

  it('uses the native setup, Media Library, presets, Track Map, and Performance Pads composition', () => {
    const composition = resolveReactWorkspaceComposition('pixGrid', 'beamMatrix', false)
    expect(composition.leftTabs).toEqual(['workspace', 'media'])
    expect(composition.workspaceTabLabel).toBe('SETUP')
    expect(composition.presetSurface).toBe('enginePresets')
    expect(composition.showTrackMap).toBe(true)
    expect(composition.showPerformancePads).toBe(true)
    expect(composition.showLaserBeamEditor).toBe(false)
  })
})
