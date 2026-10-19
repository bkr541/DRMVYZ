import { describe, expect, it, vi } from 'vitest'
import type { CanvasMediaItem } from '../../ReactTypes'
import { CanvasPreloadManager, type CanvasMediaPool, type CanvasPreloadHandle } from '../../canvasPerformance'
import { ShiftgridGridRuntime } from './ShiftgridGridState'
import {
  createShiftgridMosaicPlan,
  createShiftgridMosaicResolvePlan,
  resolveShiftgridAutoMosaicType,
  selectShiftgridTargetSource,
  ShiftgridMosaicPlayback,
} from './ShiftgridMosaic'
import { createShiftgridRenderPlan } from './ShiftgridRenderPlan'
import { ShiftgridCanvas2DRenderer } from './ShiftgridCanvas2DRenderer'
import { resolveShiftgridSourceSet } from './ShiftgridSourceMedia'
import { DEFAULT_CANVAS_SHIFTGRID_SETTINGS, type CanvasShiftgridMosaicType, type CanvasShiftgridSettings } from './ShiftgridSettings'
import { resolveShiftgridAtlasLayout } from './ShiftgridTextureAtlas'
import { createShiftgridTileGeometry } from './ShiftgridTileGeometry'

const MULTI_TYPES: readonly CanvasShiftgridMosaicType[] = [
  'imageTakeover', 'hybridMosaic', 'travelingImageWave', 'callAndResponse', 'progressiveIdentityReveal', 'autoMosaic',
]

function sourceIds(count: number): string[] { return Array.from({ length: count }, (_, index) => `source-${index}`) }
function settings(mosaicType: CanvasShiftgridMosaicType, patch: Partial<CanvasShiftgridSettings> = {}): CanvasShiftgridSettings {
  return { ...DEFAULT_CANVAS_SHIFTGRID_SETTINGS, mosaicType, sourceMode: 'pool', autoPerformance: false, ...patch }
}
function media(id: string, patch: Partial<CanvasMediaItem> = {}): CanvasMediaItem {
  return { id, name: id, type: 'image', mimeType: 'image/png', objectUrl: `https://assets.test/${id}.png`, createdAt: new Date(0).toISOString(), ...patch }
}

describe('SHIFTGRID P3 multi-image mosaic planning', () => {
  it.each(MULTI_TYPES.flatMap(type => [2, 6, 10].map(count => [type, count] as const)))('%s supports %i retained images', (mosaicType, count) => {
    const plan = createShiftgridMosaicPlan({ columns: 10, rows: 6, sourceIds: sourceIds(count), settings: settings(mosaicType), sequenceIndex: 1 })
    expect(plan.sourceCount).toBe(count)
    expect(plan.steps.length).toBeGreaterThan(0)
    for (const step of plan.steps) {
      expect(step.fromSourceIndicesByTile).toHaveLength(60)
      expect(step.toSourceIndicesByTile).toHaveLength(60)
      expect(step.toSourceIndicesByTile.every(source => source >= 0 && source < count)).toBe(true)
      expect(new Set(step.affectedTileIndices).size).toBe(step.affectedTileIndices.length)
    }
  })

  it('implements five genuinely different authored source-assignment topologies', () => {
    const authored = MULTI_TYPES.filter(type => type !== 'autoMosaic')
    const signatures = authored.map(mosaicType => {
      const plan = createShiftgridMosaicPlan({ columns: 8, rows: 6, sourceIds: sourceIds(6), settings: settings(mosaicType), sequenceIndex: 1 })
      return JSON.stringify(plan.steps.map(step => ({ topology: step.topology, affected: step.affectedTileIndices, target: step.toSourceIndicesByTile })))
    })
    expect(new Set(signatures).size).toBe(authored.length)
  })

  it('Auto Mosaic deterministically rotates implemented modes without an immediate mode repeat', () => {
    const first = resolveShiftgridAutoMosaicType(91, 2, null)
    const repeatedCandidate = Array.from({ length: 20 }, (_, sequence) => resolveShiftgridAutoMosaicType(91, sequence, first))
    expect(repeatedCandidate.every(type => type !== first || repeatedCandidate.length === 1)).toBe(true)
    expect(resolveShiftgridAutoMosaicType(91, 2, null)).toBe(first)
  })

  it('fully reconstructs every target source from a ten-image hybrid composition', () => {
    const mixed = createShiftgridMosaicPlan({ columns: 10, rows: 6, sourceIds: sourceIds(10), settings: settings('hybridMosaic'), sequenceIndex: 1 })
    for (let target = 0; target < 10; target += 1) {
      const resolve = createShiftgridMosaicResolvePlan({ columns: 10, rows: 6, sourceCount: 10, targetSourceIndex: target,
        initialSourceIndicesByTile: mixed.finalSourceIndicesByTile, settings: settings('hybridMosaic') })
      const playback = new ShiftgridMosaicPlayback(resolve); playback.seek(resolve.durationMs)
      expect(playback.currentSourceIndicesByTile.every(source => source === target)).toBe(true)
    }
  })

  it('keeps source ownership independent from spatial tile positions', () => {
    const geometry = createShiftgridTileGeometry({ gridColumns: 4, gridRows: 4, tileShape: 'rectangular' }, 800, 800)
    const spatial = new ShiftgridGridRuntime(geometry, 'orthogonal')
    spatial.scramble(42, 200); spatial.advance(200)
    const positions = [...spatial.state.currentSlotsByTile]
    const plan = createShiftgridMosaicPlan({ columns: 4, rows: 4, sourceIds: sourceIds(6), settings: settings('travelingImageWave'), sequenceIndex: 1 })
    const mosaic = new ShiftgridMosaicPlayback(plan); mosaic.seek(plan.durationMs)
    expect(spatial.state.currentSlotsByTile).toEqual(positions)
    expect(mosaic.currentSourceIndicesByTile).toHaveLength(16)
  })

  it('supports deterministic pause, seek, reset, and replacement', () => {
    const plan = createShiftgridMosaicPlan({ columns: 10, rows: 6, sourceIds: sourceIds(6), settings: settings('imageTakeover'), sequenceIndex: 1 })
    const playback = new ShiftgridMosaicPlayback(plan)
    playback.seek(300); const at300 = [...playback.currentSourceIndicesByTile]
    playback.setPaused(true); playback.advance(1000); expect(playback.timelineMs).toBe(300)
    playback.setPaused(false); playback.reset(); playback.advance(300); expect(playback.currentSourceIndicesByTile).toEqual(at300)
    const switched = createShiftgridMosaicPlan({ columns: 10, rows: 6, sourceIds: sourceIds(6), settings: settings('hybridMosaic'),
      initialSourceIndicesByTile: playback.currentSourceIndicesByTile, sequenceIndex: 2 })
    playback.replacePlan(switched); expect(playback.currentSourceIndicesByTile).toEqual(switched.initialSourceIndicesByTile)
  })

  it('honors pool order, deterministic shuffle, manual target, and no immediate target repeat', () => {
    const ids = sourceIds(10); const items = ids.map(id => media(id)); const pool: CanvasMediaPool = { id: 'pool', name: 'Pool', mediaIds: ids, textItems: [] }
    const sequential = resolveShiftgridSourceSet({ settings: settings('imageTakeover', { poolSelectionMode: 'sequential', poolSourceLimit: 10 }), activeMediaId: ids[0]!, activePool: pool, mediaItems: items })
    const shuffledA = resolveShiftgridSourceSet({ settings: settings('imageTakeover', { poolSelectionMode: 'shuffle', deterministicSeed: 17 }), activeMediaId: ids[0]!, activePool: pool, mediaItems: items })
    const shuffledB = resolveShiftgridSourceSet({ settings: settings('imageTakeover', { poolSelectionMode: 'shuffle', deterministicSeed: 17 }), activeMediaId: ids[0]!, activePool: pool, mediaItems: items })
    expect(sequential.media.map(item => item.id)).toEqual(ids)
    expect(shuffledA.media.map(item => item.id)).toEqual(shuffledB.media.map(item => item.id))
    expect(shuffledA.media.map(item => item.id)).not.toEqual(ids)
    expect(selectShiftgridTargetSource({ sourceIds: ids, settings: settings('imageTakeover', { primaryTargetMediaId: ids[7] }), sequenceIndex: 1 })).toBe(7)
    expect(selectShiftgridTargetSource({ sourceIds: ids, settings: settings('imageTakeover'), sequenceIndex: 1, previousTargetIndex: 1 })).toBe(2)
  })

  it('handles deletion, pool replacement, video exclusion, and media revisions without stale identities', () => {
    const items = [...sourceIds(6).map(id => media(id)), media('video', { type: 'video', mimeType: 'video/mp4', objectUrl: 'video.mp4' })]
    const firstPool: CanvasMediaPool = { id: 'first', name: 'First', mediaIds: items.map(item => item.id), textItems: [] }
    const first = resolveShiftgridSourceSet({ settings: settings('autoMosaic'), activeMediaId: null, activePool: firstPool, mediaItems: items })
    const revisedItems = items.filter(item => item.id !== 'source-2').map(item => item.id === 'source-3' ? { ...item, mediaRevision: 2 } : item)
    const secondPool: CanvasMediaPool = { id: 'second', name: 'Second', mediaIds: revisedItems.map(item => item.id), textItems: [] }
    const second = resolveShiftgridSourceSet({ settings: settings('autoMosaic'), activeMediaId: null, activePool: secondPool, mediaItems: revisedItems })
    expect(first.media.map(item => item.id)).not.toContain('video')
    expect(second.media.map(item => item.id)).not.toContain('source-2')
    expect(second.identity).not.toBe(first.identity)
    expect(second.identity).toContain('source-3@2')
  })

  it('isolates a failed pool image while retaining other drawable sources', async () => {
    const manager = new CanvasPreloadManager({ loader: async item => {
      if (item.id === 'bad') throw new Error('decode failed')
      return { tagName: 'IMG', complete: true, naturalWidth: 640, naturalHeight: 360 } as CanvasPreloadHandle
    } })
    const good = media('good'); const bad = media('bad')
    manager.setScope('shiftgrid:test', 4)
    manager.request([good, bad].map((item, index) => ({ media: item, trackIdentity: 'shiftgrid:test', poolRevision: 4, priority: 100 - index })))
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(manager.isReady('good')).toBe(true)
    expect(manager.getReadiness('bad')).toMatchObject({ status: 'error', error: 'decode failed' })
    manager.dispose()
  })

  it.each(MULTI_TYPES)('%s retains transparent PNG and SVG sources as real mosaic identities', mosaicType => {
    const items = [
      media('transparent-png', { mimeType: 'image/png', hasAlpha: true }),
      media('transparent-svg', { type: 'svg', mimeType: 'image/svg+xml', objectUrl: 'https://assets.test/transparent.svg', hasAlpha: true }),
    ]
    const pool: CanvasMediaPool = { id: 'alpha', name: 'Alpha', mediaIds: items.map(item => item.id), textItems: [] }
    const modeSettings = settings(mosaicType, { poolSelectionMode: 'sequential' })
    const resolved = resolveShiftgridSourceSet({ settings: modeSettings, activeMediaId: null, activePool: pool, mediaItems: items })
    const plan = createShiftgridMosaicPlan({ columns: 4, rows: 4, sourceIds: resolved.media.map(item => item.id), settings: modeSettings, sequenceIndex: 1 })
    expect(resolved.media.map(item => item.id)).toEqual(['transparent-png', 'transparent-svg'])
    expect(plan.sourceCount).toBe(2)
    expect(plan.steps.length).toBeGreaterThan(0)
  })
})

describe('SHIFTGRID P3 sampling and bounded rendering', () => {
  it('keeps source-relative crops aligned across different sizes and aspect ratios', () => {
    const geometry = createShiftgridTileGeometry({ gridColumns: 3, gridRows: 3, tileShape: 'rectangular' }, 900, 600)
    const spatial = new ShiftgridGridRuntime(geometry, 'aspects')
    const mosaicPlan = createShiftgridMosaicPlan({ columns: 3, rows: 3, sourceIds: sourceIds(2), settings: settings('imageTakeover'), sequenceIndex: 1 })
    const mosaic = new ShiftgridMosaicPlayback(mosaicPlan); mosaic.seek(mosaicPlan.steps[0]!.startMs + 10)
    const plan = createShiftgridRenderPlan({ geometry, runtime: spatial, sourceRuntime: mosaic, width: 900, height: 600,
      sourceWidth: 2400, sourceHeight: 600, sources: [{ id: 'wide', width: 2400, height: 600 }, { id: 'tall', width: 600, height: 2400 }],
      fitMode: 'contain', easing: 'linear' })
    expect(plan.tiles.every(tile => [tile.source, tile.pendingSource].every(crop => Object.values(crop).every(Number.isFinite)))).toBe(true)
    expect(plan.tiles.some(tile => tile.source.width !== tile.pendingSource.width || tile.source.height !== tile.pendingSource.height)).toBe(true)
  })

  it('bounds a ten-source RGBA atlas within the selected cell and device texture limits', () => {
    const layout = resolveShiftgridAtlasLayout(10, 768, 2048)
    expect(layout.columns).toBe(4); expect(layout.rows).toBe(3)
    expect(layout.width).toBeLessThanOrEqual(2048); expect(layout.height).toBeLessThanOrEqual(2048)
    expect(layout.estimatedBytes).toBe(layout.width * layout.height * 4)
  })

  it('Canvas2D fallback visibly blends per-tile source changes without masks', () => {
    const drawImage = vi.fn(); const context = { imageSmoothingEnabled: false, imageSmoothingQuality: 'low', globalAlpha: 1,
      setTransform: vi.fn(), clearRect: vi.fn(), drawImage, save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn() }
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) } as unknown as HTMLCanvasElement
    const renderer = new ShiftgridCanvas2DRenderer(canvas)
    const imageA = { width: 100, height: 100 } as ImageBitmap; const imageB = { width: 200, height: 80 } as ImageBitmap
    renderer.setSources([{ id: 'a', element: imageA }, { id: 'b', element: imageB }])
    const geometry = createShiftgridTileGeometry({ gridColumns: 2, gridRows: 2, tileShape: 'rectangular' }, 200, 200)
    const spatial = new ShiftgridGridRuntime(geometry, 'fallback')
    const mosaicPlan = createShiftgridMosaicPlan({ columns: 2, rows: 2, sourceIds: ['a', 'b'], settings: settings('imageTakeover'), sequenceIndex: 1 })
    const mosaic = new ShiftgridMosaicPlayback(mosaicPlan); mosaic.seek(mosaicPlan.steps[0]!.startMs + mosaicPlan.steps[0]!.durationMs / 2)
    renderer.resize(200, 200, 1)
    renderer.render(createShiftgridRenderPlan({ geometry, runtime: spatial, sourceRuntime: mosaic, width: 200, height: 200,
      sourceWidth: 100, sourceHeight: 100, sources: [{ id: 'a', width: 100, height: 100 }, { id: 'b', width: 200, height: 80 }], fitMode: 'cover', easing: 'linear' }))
    expect(drawImage.mock.calls.some(call => call[0] === imageA)).toBe(true)
    expect(drawImage.mock.calls.some(call => call[0] === imageB)).toBe(true)
    renderer.dispose()
  })
})
