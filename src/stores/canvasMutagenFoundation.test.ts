import { beforeEach, describe, expect, it } from 'vitest'
import { CANVAS_PRESET_BY_ID, CANVAS_PRESETS, CANVAS_VISIBLE_PRESETS, CANVAS_PRESET_SETTINGS_SCHEMA_VERSION, type CanvasMediaItem } from '../components/vyzualz/react/ReactTypes'
import { resolveCanvasPresetProvenance } from '../components/vyzualz/react/canvasPerformance/CanvasPresetProvenance'
import { DEFAULT_CANVAS_MUTAGEN_SETTINGS, normalizeCanvasMutagenSettings } from '../components/vyzualz/react/renderers/mutagen/MutagenSettings'
import { isMutagenSource, MutagenRenderer, resolveMutagenFitSize, resolveMutagenRenderSize } from '../components/vyzualz/react/renderers/mutagen/MutagenRenderer'
import { getCanvasLibraryMediaType } from '../components/vyzualz/react/canvasMediaLibraryContract'
import { resolveCanvasOutputCapability } from '../components/vyzualz/react/canvasFracturesOutputContract'
import type { UploadedMedia } from './mediaStore'
import { mergeReactStoreState, migrateReactStore, normalizeCanvasPresetSettings, useReactStore } from './reactStore'

const store = () => useReactStore.getState()

describe('MUTAGEN Phase 1 recipe and primary source', () => {
  beforeEach(() => store().resetReactView())

  it('registers exactly one visible recipe and preserves active media on entry and exit', () => {
    expect(CANVAS_VISIBLE_PRESETS.filter(p => p.id === 'canvas-mutagen')).toHaveLength(1)
    expect(CANVAS_PRESET_BY_ID['canvas-mutagen']).toMatchObject({ name: 'MUTAGEN', rendererKind: 'imageMutation' })
    useReactStore.setState({ activeCanvasMediaId: 'opaque-jpg' })
    store().selectCanvasPreset('canvas-mutagen')
    expect(store().activeCanvasMediaId).toBe('opaque-jpg')
    expect(store().canvasPresetSettings.mutagen).toEqual(DEFAULT_CANVAS_MUTAGEN_SETTINGS)
    store().selectCanvasPreset('canvas-clean-playback')
    expect(store().activeCanvasMediaId).toBe('opaque-jpg')
    expect(store().canvasPresetSettings).toEqual(normalizeCanvasPresetSettings(CANVAS_PRESET_BY_ID['canvas-clean-playback'].settings))
  })

  it('strictly validates and strips everything except the authored recipe', () => {
    expect(normalizeCanvasMutagenSettings({ version: 99, pattern: 'bogus', mutation: 20, flowSpeed: -4, feedback: 2, sourceMix: -1, preserveColors: 'false', quality: 'ultra', url: 'blob:secret', framebuffer: {} })).toEqual({
      ...DEFAULT_CANVAS_MUTAGEN_SETTINGS, mutation: 1, flowSpeed: 0, feedback: 1, sourceMix: 0,
    })
    for (const value of [undefined, null, [], 'bad', { mutation: NaN, feedback: Infinity, flowSpeed: '2' }]) {
      expect(normalizeCanvasMutagenSettings(value)).toEqual(DEFAULT_CANVAS_MUTAGEN_SETTINGS)
    }
  })

  it('hydrates older documents with defaults and round-trips edited settings through migration', () => {
    const old = mergeReactStoreState({ canvasPresetSettings: { schemaVersion: 13, intensity: 0.42 } }, store())
    expect(old.canvasPresetSettings.schemaVersion).toBe(CANVAS_PRESET_SETTINGS_SCHEMA_VERSION)
    expect(old.canvasPresetSettings.intensity).toBe(0.42)
    expect(old.canvasPresetSettings.mutagen).toEqual(DEFAULT_CANVAS_MUTAGEN_SETTINGS)
    store().selectCanvasPreset('canvas-mutagen')
    store().setCanvasPresetSettings({ mutagen: { ...DEFAULT_CANVAS_MUTAGEN_SETTINGS, mutation: 0.28, quality: 'high' } })
    const saved = JSON.parse(JSON.stringify({ selectedCanvasPresetId: store().selectedCanvasPresetId, canvasPresetSettings: store().canvasPresetSettings, activeCanvasMediaId: 'library-id' }))
    const hydrated = mergeReactStoreState(migrateReactStore(saved, 0), store())
    expect(hydrated.selectedCanvasPresetId).toBe('canvas-mutagen')
    expect(hydrated.canvasPresetSettings.mutagen).toEqual(store().canvasPresetSettings.mutagen)
    expect(CANVAS_PRESET_BY_ID['canvas-mutagen'].settings.mutagen).toEqual(DEFAULT_CANVAS_MUTAGEN_SETTINGS)
    store().resetCanvasPresetSettings()
    expect(store().canvasPresetSettings.mutagen).toEqual(DEFAULT_CANVAS_MUTAGEN_SETTINGS)
  })

  it('tracks every authored MUTAGEN field in exact/modified provenance and reset', () => {
    const preset = CANVAS_PRESET_BY_ID['canvas-mutagen']
    const exact = normalizeCanvasPresetSettings(preset.settings)
    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    for (const patch of [{ mutation: 0 }, { flowSpeed: 2 }, { feedback: 0.5 }, { sourceMix: 1 }, { preserveColors: false }, { quality: 'high' as const }]) {
      expect(resolveCanvasPresetProvenance(preset, { ...exact, mutagen: { ...exact.mutagen, ...patch } }).status).toBe('modified')
    }
    for (const p of CANVAS_PRESETS) expect(resolveCanvasPresetProvenance(p, normalizeCanvasPresetSettings(p.settings)).status).toBe('exact')
  })

  it.each([['image/png', 'logo.png'], ['image/jpeg', 'opaque.jpg'], ['image/webp', 'art.webp'], ['image/svg+xml', 'logo.svg']])('admits %s through the primary media contract without transparency tests', (mimeType, name) => {
    const type = getCanvasLibraryMediaType({ type: 'image', mimeType, name } as UploadedMedia)
    expect(type).not.toBeNull()
    expect(isMutagenSource({ type } as CanvasMediaItem)).toBe(true)
  })

  it('rejects video locally, handles missing WebGL2, and bounds quality sizes and aspects', () => {
    expect(isMutagenSource(null)).toBe(false)
    expect(isMutagenSource({ type: 'video' } as CanvasMediaItem)).toBe(false)
    expect(MutagenRenderer.create({ getContext: () => null } as unknown as HTMLCanvasElement)).toEqual({ renderer: null, error: 'WebGL2 unavailable' })
    expect(resolveMutagenFitSize('contain', 400, 800, 800, 400)).toEqual({ width: 200, height: 400 })
    expect(resolveMutagenFitSize('cover', 400, 800, 800, 400)).toEqual({ width: 800, height: 1600 })
    expect(resolveMutagenFitSize('stretch', 400, 800, 800, 400)).toEqual({ width: 800, height: 400 })
    expect(resolveMutagenRenderSize(3840, 2160, 2, 'low')).toEqual({ width: 960, height: 540 })
  })

  it('keeps existing renderer routes and authored capture precedence', () => {
    for (const [id, kind] of [['canvas-clean-playback', 'standard'], ['canvas-fractures', 'fragmentCollage'], ['canvas-laser-image-fx', 'laserImageFx'], ['canvas-cutbank', 'cutbank'], ['canvas-shiftgrid', 'shiftgrid']] as const) {
      expect(CANVAS_PRESET_BY_ID[id].rendererKind).toBe(kind)
    }
    expect(resolveCanvasOutputCapability({ selectedPresetId: 'canvas-mutagen', orchestrationRenderable: false, orchestrationFrame: null }).status).toBe('available')
    expect(resolveCanvasOutputCapability({ selectedPresetId: 'canvas-mutagen', orchestrationRenderable: true, orchestrationFrame: null }).status).toBe('unavailable')
  })
})
