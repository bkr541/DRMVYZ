import { beforeEach, describe, expect, it } from 'vitest'
import {
  CANVAS_PRESET_BY_ID,
  CANVAS_PRESET_SETTINGS_SCHEMA_VERSION,
  CANVAS_VISIBLE_PRESETS,
  DEFAULT_CANVAS_PRESET_SETTINGS,
  resolveCanvasPresetRendererKind,
  type CanvasMediaItem,
} from '../../ReactTypes'
import type { CanvasMediaPool } from '../../canvasPerformance'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { CANVAS_OUTPUT_AVAILABLE, resolveCanvasOutputCapability } from '../../canvasFracturesOutputContract'
import { mergeReactStoreState, migrateReactStore, normalizeCanvasPresetSettings, reactStorePartialize, useReactStore } from '../../../../../stores/reactStore'
import { createShiftgridRuntimeGridState } from './ShiftgridGridState'
import { resolveShiftgridSourceSet } from './ShiftgridSourceMedia'
import {
  CANVAS_SHIFTGRID_SETTINGS_VERSION,
  DEFAULT_CANVAS_SHIFTGRID_SETTINGS,
  normalizeCanvasShiftgridSettings,
} from './ShiftgridSettings'
import { createShiftgridTileGeometry, getShiftgridTileId } from './ShiftgridTileGeometry'

function media(id: string): CanvasMediaItem {
  return {
    id,
    name: id,
    type: 'image',
    objectUrl: `https://example.test/${id}.png`,
    createdAt: new Date(0).toISOString(),
  }
}

describe('SHIFTGRID Phase 0 foundation', () => {
  beforeEach(() => useReactStore.getState().resetReactView())

  it('registers a visible preset with a dedicated renderer kind', () => {
    expect(CANVAS_PRESET_BY_ID['canvas-shiftgrid']).toMatchObject({
      id: 'canvas-shiftgrid',
      name: 'SHIFTGRID',
      rendererKind: 'shiftgrid',
    })
    expect(CANVAS_VISIBLE_PRESETS.map(preset => preset.id)).toContain('canvas-shiftgrid')
    expect(resolveCanvasPresetRendererKind('canvas-shiftgrid')).toBe('shiftgrid')
    expect(resolveCanvasOutputCapability({
      selectedPresetId: 'canvas-shiftgrid',
      orchestrationRenderable: true,
      orchestrationFrame: { layers: [{ processor: null }] } as never,
    })).toBe(CANVAS_OUTPUT_AVAILABLE)
  })

  it('keeps Fractures and CUTBANK renderer resolution unchanged', () => {
    expect(resolveCanvasPresetRendererKind('canvas-fractures')).toBe('fragmentCollage')
    expect(resolveCanvasPresetRendererKind('canvas-cutbank')).toBe('cutbank')
    expect(CANVAS_PRESET_BY_ID['canvas-fractures'].settings.fractureVariationSeed).toBe(1337)
    expect(CANVAS_PRESET_BY_ID['canvas-cutbank'].settings.cutbank).toEqual(DEFAULT_CANVAS_PRESET_SETTINGS.cutbank)
  })

  it('normalizes the complete versioned settings contract without persisting runtime state', () => {
    const normalized = normalizeCanvasShiftgridSettings({
      sourceMode: 'pool',
      gridColumns: 100,
      gridRows: -2,
      movementSpeed: 9,
      poolSourceLimit: 128,
      deterministicSeed: 42.8,
      runtimeTiles: [{ x: 10 }],
    })
    expect(normalized).toMatchObject({
      version: CANVAS_SHIFTGRID_SETTINGS_VERSION,
      sourceMode: 'pool',
      gridColumns: 32,
      gridRows: 2,
      movementSpeed: 2,
      poolSourceLimit: 64,
      deterministicSeed: 43,
    })
    expect('runtimeTiles' in normalized).toBe(false)
    expect(normalizeCanvasShiftgridSettings(undefined)).toEqual(DEFAULT_CANVAS_SHIFTGRID_SETTINGS)
    expect(normalizeCanvasShiftgridSettings({ version: 1, gridMode: 'fixed', gridColumns: 10, gridRows: 6, tileShape: 'mixed' })).toMatchObject({
      version: CANVAS_SHIFTGRID_SETTINGS_VERSION,
      gridPreset: 'custom',
      gridColumns: 10,
      gridRows: 6,
      tileShape: 'square',
      fitMode: 'contain',
    })
    expect(normalizeCanvasShiftgridSettings({ version: 2, choreographyPattern: 'rowSlide', reconstructionMode: 'holdThenReturn' })).toMatchObject({
      version: CANVAS_SHIFTGRID_SETTINGS_VERSION,
      choreographyPattern: 'rowRunner',
      reconstructionMode: 'progressiveResolve',
      snapStrength: DEFAULT_CANVAS_SHIFTGRID_SETTINGS.snapStrength,
      scrambleComplexity: DEFAULT_CANVAS_SHIFTGRID_SETTINGS.scrambleComplexity,
    })
  })

  it('backfills schema v10 and SHIFTGRID defaults while preserving existing preset state', () => {
    expect(CANVAS_PRESET_SETTINGS_SCHEMA_VERSION).toBe(10)
    const migrated = migrateReactStore({
      selectedCanvasPresetId: 'canvas-fractures',
      canvasPresetSettings: {
        schemaVersion: 7,
        fractureVariationSeed: 4242,
        cutbank: { ...DEFAULT_CANVAS_PRESET_SETTINGS.cutbank, chaos: 0.9 },
      },
    }, 79)
    const normalized = migrated.canvasPresetSettings as typeof DEFAULT_CANVAS_PRESET_SETTINGS
    expect(migrated.selectedCanvasPresetId).toBe('canvas-fractures')
    expect(normalized.schemaVersion).toBe(10)
    expect(normalized.fractureVariationSeed).toBe(4242)
    expect(normalized.cutbank.chaos).toBe(0.9)
    expect(normalized.shiftgrid).toEqual(DEFAULT_CANVAS_SHIFTGRID_SETTINGS)

    const merged = mergeReactStoreState(migrated, useReactStore.getState())
    expect(merged.canvasPresetSettings.shiftgrid).toEqual(DEFAULT_CANVAS_SHIFTGRID_SETTINGS)
  })

  it('persists SHIFTGRID edits through canonical preset settings and provenance', () => {
    const preset = CANVAS_PRESET_BY_ID['canvas-shiftgrid']
    const exact = normalizeCanvasPresetSettings(preset.settings)
    const modified = normalizeCanvasPresetSettings({
      ...exact,
      shiftgrid: { ...exact.shiftgrid, gridColumns: 16 },
    })
    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, modified).status).toBe('modified')

    useReactStore.getState().selectCanvasPreset('canvas-shiftgrid')
    useReactStore.getState().setCanvasPresetSettings({
      shiftgrid: { ...useReactStore.getState().canvasPresetSettings.shiftgrid, gridColumns: 16 },
    })
    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.selectedCanvasPresetId).toBe('canvas-shiftgrid')
    expect(persisted.canvasPresetSettings.shiftgrid.gridColumns).toBe(16)
  })

  it('uses canonical active media and pools without the four-layer compositor limit', () => {
    const items = Array.from({ length: 9 }, (_, index) => media(`m${index}`))
    const pool: CanvasMediaPool = { id: 'pool-a', name: 'Pool A', mediaIds: items.map(item => item.id), textItems: [] }
    const sources = resolveShiftgridSourceSet({
      settings: { ...DEFAULT_CANVAS_SHIFTGRID_SETTINGS, sourceMode: 'pool', poolSourceLimit: 9 },
      activeMediaId: 'm0',
      activePool: pool,
      mediaItems: items,
    })
    expect(sources.poolId).toBe('pool-a')
    expect(sources.media).toHaveLength(9)
    expect(new Set(sources.media.map(item => item.id)).size).toBe(9)
  })

  it('creates stable renderer-owned tile identity and transient reconstruction state', () => {
    const geometry = createShiftgridTileGeometry({ gridColumns: 3, gridRows: 2, tileShape: 'square' }, 900, 600)
    expect(geometry.tiles).toHaveLength(6)
    expect(geometry.tiles[4].id).toBe(getShiftgridTileId(1, 1))
    expect(geometry.tiles.every(tile => tile.width === tile.height)).toBe(true)
    const runtime = createShiftgridRuntimeGridState(geometry, ['a', 'b', 'c', 'd', 'e'], 'track:one')
    expect(runtime.tiles.map(tile => tile.originalSlot)).toEqual([0, 1, 2, 3, 4, 5])
    expect(runtime.currentSlotsByTile).toEqual([0, 1, 2, 3, 4, 5])
    expect('shiftgridRuntime' in DEFAULT_CANVAS_PRESET_SETTINGS).toBe(false)
  })
})
