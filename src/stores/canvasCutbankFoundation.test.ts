import { beforeEach, describe, expect, it } from 'vitest'
import {
  CANVAS_PRESET_BY_ID,
  CANVAS_PRESET_SETTINGS_SCHEMA_VERSION,
  CANVAS_VISIBLE_PRESETS,
  DEFAULT_CANVAS_PRESET_SETTINGS,
  resolveCanvasPresetRendererKind,
} from '../components/vyzualz/react/ReactTypes'
import { DEFAULT_CANVAS_CUTBANK_SETTINGS } from '../components/vyzualz/react/renderers/cutbank/CutbankSettings'
import { countCanvasPoolEntries, normalizeCanvasMediaPools } from '../components/vyzualz/react/canvasPerformance/CanvasAuthoringState'
import { resolveCanvasPresetProvenance } from '../components/vyzualz/react/canvasPerformance/CanvasPresetProvenance'
import { mergeReactStoreState, migrateReactStore, normalizeCanvasOrchestrationSettings, normalizeCanvasPresetSettings, useReactStore } from './reactStore'

const store = () => useReactStore.getState()
const pools = () => store().canvasOrchestrationSettings.mediaPools

function makePool(name = 'Warmup') {
  const result = store().createCanvasMediaPool(name)
  if (!result.ok) throw new Error(result.message)
  return result.pool
}

describe('CANVAS CUTBANK registration and persistence', () => {
  beforeEach(() => store().resetReactView())

  it('registers CUTBANK as a visible CANVAS preset with its own renderer kind', () => {
    const preset = CANVAS_PRESET_BY_ID['canvas-cutbank']
    expect(preset).toMatchObject({ id: 'canvas-cutbank', name: 'CUTBANK', rendererKind: 'cutbank' })
    expect(resolveCanvasPresetRendererKind('canvas-cutbank')).toBe('cutbank')
    expect(CANVAS_VISIBLE_PRESETS.map(p => p.id)).toContain('canvas-cutbank')
    store().selectCanvasPreset('canvas-cutbank')
    expect(store().selectedCanvasPresetId).toBe('canvas-cutbank')
    expect(store().canvasPresetSettings.cutbank).toEqual(DEFAULT_CANVAS_CUTBANK_SETTINGS)
  })

  it('keeps every other CANVAS preset and its renderer kind unchanged', () => {
    expect(resolveCanvasPresetRendererKind('canvas-fractures')).toBe('fragmentCollage')
    expect(resolveCanvasPresetRendererKind('canvas-laser-image-fx')).toBe('laserImageFx')
    expect(resolveCanvasPresetRendererKind('canvas-particle-aura')).toBe('particleAura')
    expect(resolveCanvasPresetRendererKind('canvas-clean-playback')).toBe('standard')
  })

  it('normalizes CUTBANK settings inside Canvas preset settings and bumps the schema', () => {
    expect(CANVAS_PRESET_SETTINGS_SCHEMA_VERSION).toBe(7)
    const normalized = normalizeCanvasPresetSettings({ cutbank: { chaos: 9, layoutMode: 'poster', layerCount: 0, paletteMode: 'bogus' } })
    expect(normalized.schemaVersion).toBe(7)
    expect(normalized.cutbank.chaos).toBe(1)
    expect(normalized.cutbank.layoutMode).toBe('poster')
    expect(normalized.cutbank.layerCount).toBe(1)
    expect(normalized.cutbank.paletteMode).toBe(DEFAULT_CANVAS_CUTBANK_SETTINGS.paletteMode)
  })

  it('hydrates pre-CUTBANK (v6) projects with CUTBANK defaults and preserves authored values', () => {
    const merged = mergeReactStoreState({
      selectedCanvasPresetId: 'canvas-fractures',
      canvasPresetSettings: { schemaVersion: 6, fractureVariationSeed: 4242, intensity: 0.4 },
    }, store())
    expect(merged.canvasPresetSettings.schemaVersion).toBe(7)
    expect(merged.canvasPresetSettings.fractureVariationSeed).toBe(4242)
    expect(merged.canvasPresetSettings.cutbank).toEqual(DEFAULT_CANVAS_CUTBANK_SETTINGS)
    expect(merged.selectedCanvasPresetId).toBe('canvas-fractures')
  })

  it('persists CUTBANK edits through setCanvasPresetSettings and reports modified provenance', () => {
    store().selectCanvasPreset('canvas-cutbank')
    const preset = CANVAS_PRESET_BY_ID['canvas-cutbank']
    expect(resolveCanvasPresetProvenance(preset, store().canvasPresetSettings).status).toBe('exact')
    store().setCanvasPresetSettings({ cutbank: { ...store().canvasPresetSettings.cutbank, chaos: 0.9 } })
    expect(store().canvasPresetSettings.cutbank.chaos).toBe(0.9)
    expect(resolveCanvasPresetProvenance(preset, store().canvasPresetSettings).status).toBe('modified')
    store().resetCanvasPresetSettings()
    expect(store().canvasPresetSettings.cutbank.chaos).toBe(DEFAULT_CANVAS_CUTBANK_SETTINGS.chaos)
  })

  it('never stores runtime objects in CUTBANK settings', () => {
    const json = JSON.stringify(store().canvasPresetSettings.cutbank)
    expect(JSON.parse(json)).toEqual(store().canvasPresetSettings.cutbank)
    expect(DEFAULT_CANVAS_PRESET_SETTINGS.cutbank).toEqual(DEFAULT_CANVAS_CUTBANK_SETTINGS)
  })
})

describe('CANVAS Media Pool native text', () => {
  beforeEach(() => store().resetReactView())

  it('migrates media-only pools to empty text lists without losing media', () => {
    const migrated = normalizeCanvasMediaPools([{ id: 'p', name: 'Old', mediaIds: ['a', 'b'] }])
    expect(migrated).toEqual([{ id: 'p', name: 'Old', mediaIds: ['a', 'b'], textItems: [] }])
    const settings = normalizeCanvasOrchestrationSettings({ mediaPools: [{ id: 'p', name: 'Old', mediaIds: ['a'] }], activeMediaPoolId: 'p' })
    expect(settings.mediaPools[0].textItems).toEqual([])
    expect(settings.mediaPoolIds).toEqual(['a'])
  })

  it('hydrates persisted pre-text projects through the store migration', () => {
    const merged = mergeReactStoreState({
      canvasOrchestrationSettings: { mediaPools: [{ id: 'p', name: 'Old', mediaIds: ['a'] }], activeMediaPoolId: 'p' },
    }, store())
    expect(merged.canvasOrchestrationSettings.mediaPools).toEqual([{ id: 'p', name: 'Old', mediaIds: ['a'], textItems: [] }])
    const migrated = migrateReactStore({ canvasOrchestrationSettings: { mediaPools: [{ id: 'p', name: 'Old', mediaIds: ['a'] }] } }, 80)
    expect(JSON.stringify(migrated)).toContain('"p"')
  })

  it('adds, edits, and deletes text entries and bumps the pool revision', () => {
    const pool = makePool()
    const rev0 = store().canvasOrchestrationSettings.poolRevision
    const added = store().addCanvasPoolText(pool.id, "  DON'T   WAKE ME  ")
    expect(added.ok).toBe(true)
    const [item] = pools()[0].textItems
    expect(item.text).toBe("DON'T WAKE ME")
    expect(store().canvasOrchestrationSettings.poolRevision).toBeGreaterThan(rev0)

    expect(store().updateCanvasPoolText(pool.id, item.id, 'IS THIS REAL?').ok).toBe(true)
    expect(pools()[0].textItems).toEqual([{ id: item.id, text: 'IS THIS REAL?' }])

    expect(store().removeCanvasPoolText(pool.id, item.id).ok).toBe(true)
    expect(pools()[0].textItems).toEqual([])
  })

  it('rejects empty text, unknown pools, and unknown entries without mutating state', () => {
    const pool = makePool()
    const before = JSON.stringify(pools())
    expect(store().addCanvasPoolText(pool.id, '   ')).toMatchObject({ ok: false, code: 'invalid-text' })
    expect(store().addCanvasPoolText('missing', 'HI')).toMatchObject({ ok: false, code: 'pool-not-found' })
    expect(store().updateCanvasPoolText(pool.id, 'missing', 'HI')).toMatchObject({ ok: false, code: 'text-not-found' })
    expect(store().removeCanvasPoolText(pool.id, 'missing')).toMatchObject({ ok: false, code: 'text-not-found' })
    expect(JSON.stringify(pools())).toBe(before)
    store().addCanvasPoolText(pool.id, 'ONE')
    const id = pools()[0].textItems[0].id
    expect(store().updateCanvasPoolText(pool.id, id, '  ')).toMatchObject({ ok: false, code: 'invalid-text' })
    expect(pools()[0].textItems[0].text).toBe('ONE')
  })

  it('enforces the per-pool text limit', () => {
    const pool = makePool()
    for (let i = 0; i < 60; i += 1) store().addCanvasPoolText(pool.id, `line ${i}`)
    expect(pools()[0].textItems.length).toBe(48)
    expect(store().addCanvasPoolText(pool.id, 'one more')).toMatchObject({ ok: false, code: 'text-limit-reached' })
  })

  it('counts media and text together and leaves media-only APIs untouched', () => {
    const pool = makePool()
    store().addCanvasMediaToPool(pool.id, 'media-1')
    store().addCanvasPoolText(pool.id, 'HELLO')
    store().setActiveCanvasMediaPool(pool.id)
    expect(countCanvasPoolEntries(pools()[0])).toBe(2)
    expect(store().canvasOrchestrationSettings.mediaPoolIds).toEqual(['media-1'])
    store().removeCanvasMediaFromPool(pool.id, 'media-1')
    expect(pools()[0].textItems).toHaveLength(1)
  })

  it('deleting a pool removes its text and clears the active selection', () => {
    const pool = makePool()
    store().addCanvasPoolText(pool.id, 'GONE SOON')
    store().setActiveCanvasMediaPool(pool.id)
    expect(store().canvasOrchestrationSettings.activeMediaPoolId).toBe(pool.id)
    store().deleteCanvasMediaPool(pool.id)
    expect(pools()).toEqual([])
    expect(store().canvasOrchestrationSettings.activeMediaPoolId).toBeNull()
    expect(store().canvasOrchestrationSettings.mediaPoolIds).toEqual([])
  })

  it('keeps text separate per pool and uses the canonical active pool for CUTBANK', () => {
    const a = makePool('A')
    const b = makePool('B')
    store().addCanvasPoolText(a.id, 'ONLY A')
    store().setActiveCanvasMediaPool(b.id)
    expect(pools().find(p => p.id === a.id)!.textItems).toHaveLength(1)
    expect(pools().find(p => p.id === b.id)!.textItems).toHaveLength(0)
    expect(store().canvasOrchestrationSettings.activeMediaPoolId).toBe(b.id)
  })
})
