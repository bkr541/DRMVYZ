import { describe, expect, it } from 'vitest'
import { PixGridResponseLimitError, readPixGridResponseBlobBounded } from '../PixGridBoundedResponse'
import { PIX_GRID_BUILT_IN_SECTION_TYPES, PIX_GRID_PRESETS } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { resolvePixGridSceneSectionType } from '../PixGridScenePreview'
import {
  PIX_GRID_PRESET_CONFORMANCE_REPORTS,
  PIX_GRID_PRESET_DEFINITIONS,
  validatePixGridPresetConformance,
} from '../PixGridPresetRegistry'
import { PixGridPreparedAssetCache } from '../PixGridAssetPreparation'

describe('PixGrid P2 bounded infrastructure', () => {
  it('rejects an oversized declared response before consuming its body', async () => {
    let pulled = false
    const body = new ReadableStream<Uint8Array>({ pull(controller) { pulled = true; controller.enqueue(new Uint8Array(4)); controller.close() } })
    const response = new Response(body, { headers: { 'content-length': '1024', 'content-type': 'image/png' } })
    await expect(readPixGridResponseBlobBounded(response, 16)).rejects.toBeInstanceOf(PixGridResponseLimitError)
    expect(pulled).toBe(false)
  })

  it('cancels a streaming response when actual bytes exceed the budget', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(10)); controller.enqueue(new Uint8Array(10)) },
      cancel() { cancelled = true },
    })
    await expect(readPixGridResponseBlobBounded(new Response(body), 12)).rejects.toBeInstanceOf(PixGridResponseLimitError)
    expect(cancelled).toBe(true)
  })

  it('keeps prepared-media cache memory bounded and exposes hit/miss/eviction diagnostics', () => {
    const cache = new PixGridPreparedAssetCache(2, 12)
    const entry = (key: string) => ({ key, mediaId: key, mediaRevision: 1, width: 1, height: 1, pixels: new Uint8Array(4), approximateBytes: 4 })
    cache.set(entry('a')); cache.set(entry('b'))
    expect(cache.get('a')?.key).toBe('a')
    expect(cache.get('missing')).toBeNull()
    cache.set(entry('c'))
    expect(cache.get('b')).toBeNull()
    expect(cache.diagnostics).toMatchObject({ entries: 2, hits: 1, misses: 2, evictions: 1 })
  })
})

describe('PixGrid P2 sections and conformance', () => {
  it('authors explicit Bridge and Unknown mappings for every built-in preset', () => {
    expect(PIX_GRID_BUILT_IN_SECTION_TYPES).toEqual([
      'intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown',
    ])
    for (const preset of PIX_GRID_PRESETS) {
      expect(preset.sectionMappings.map(mapping => mapping.sectionType)).toEqual(PIX_GRID_BUILT_IN_SECTION_TYPES)
      expect(preset.scenes.map(scene => scene.sectionType)).toEqual(PIX_GRID_BUILT_IN_SECTION_TYPES)
    }
  })

  it('preserves authoritative scene metadata when a scene is renamed', () => {
    const preset = PIX_GRID_PRESETS[0]!
    const state = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
    const bridge = state.scenes.find(scene => scene.sectionType === 'bridge')!
    const renamed = { ...state, selectedSceneId: bridge.id, scenes: state.scenes.map(scene => scene.id === bridge.id ? { ...scene, name: 'Interlude Alpha' } : scene) }
    expect(resolvePixGridSceneSectionType(renamed)).toBe('bridge')
  })

  it('reports every registered preset as expansion-ready and returns field-specific failures', () => {
    expect(PIX_GRID_PRESET_CONFORMANCE_REPORTS.every(report => report.compatible)).toBe(true)
    const original = PIX_GRID_PRESET_DEFINITIONS[0]!
    const invalid = {
      ...original,
      preset: {
        ...original.preset!,
        pixGridSettings: {
          ...original.preset!.pixGridSettings!,
          audioAssignments: [{
            ...original.preset!.pixGridSettings!.audioAssignments![0]!,
            target: 'not-a-target',
          }],
        },
      },
    } as unknown as typeof original
    const report = validatePixGridPresetConformance(invalid)
    expect(report.compatible).toBe(false)
    expect(report.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-audio-destination', path: expect.stringContaining('.target') }),
    ]))
  })
})
