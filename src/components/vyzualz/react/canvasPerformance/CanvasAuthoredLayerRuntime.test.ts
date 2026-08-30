import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { buildSharedPerformanceContext } from '../../../../features/performanceCore'
import type { CanvasMediaItem } from '../ReactTypes'
import { resolveCanvasAuthoredLayerFrame } from './CanvasAuthoredLayerRuntime'
import {
  DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
  MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
  type CanvasAuthoredLayer,
} from './CanvasPerformanceTypes'

function context() {
  return buildSharedPerformanceContext({
    audioTimeSec: 4,
    frame: {
      ...DEFAULT_MI_FRAME,
      timeSec: 4,
      trackId: 'canvas-authored-runtime-test',
      rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, beatIndex: 8, barIndex: 2 },
    },
    trackIdentity: 'canvas-authored-runtime-test',
    trackChangeIdentity: 'track:canvas-authored-runtime-test',
    resolvedSections: [],
  })
}

function media(id: string, type: CanvasMediaItem['type'] = 'image'): CanvasMediaItem {
  return {
    id,
    name: id,
    type,
    objectUrl: `runtime://${id}`,
    thumbnailUrl: null,
    mimeType: type === 'video' ? 'video/mp4' : 'image/png',
    meta: type,
    source: 'library',
    createdAt: new Date(0).toISOString(),
    width: 1920,
    height: 1080,
    durationSec: type === 'video' ? 30 : undefined,
    fps: type === 'video' ? 30 : undefined,
  }
}

function layer(id: string, mediaId: string, order: number, patch: Partial<CanvasAuthoredLayer> = {}): CanvasAuthoredLayer {
  return {
    id,
    mediaId,
    effects: [],
    order,
    enabled: true,
    solo: false,
    ownership: 'manual',
    pinned: true,
    ...patch,
  }
}

describe('CANVAS authored multi-layer runtime adapter', () => {
  it('maps canonical layer identity/order to the production compositor with top row highest', () => {
    const mediaItems = [media('top'), media('middle'), media('bottom')]
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: [
          layer('layer-top', 'top', 0),
          layer('layer-middle', 'middle', 1),
          layer('layer-bottom', 'bottom', 2),
        ],
      },
      mediaItems,
      fitMode: 'contain',
      isMediaReady: () => true,
    })

    expect(frame.runtimeMode).toBe('authored')
    expect(frame.layers.map(candidate => candidate.id)).toEqual(['layer-top', 'layer-middle', 'layer-bottom'])
    expect(frame.layers.map(candidate => candidate.sourceMediaId)).toEqual(['top', 'middle', 'bottom'])
    expect(frame.layers[0].zIndex).toBeGreaterThan(frame.layers[1].zIndex)
    expect(frame.layers[1].zIndex).toBeGreaterThan(frame.layers[2].zIndex)
    expect(frame.layers.every(candidate => candidate.aspectBehavior === 'contain')).toBe(true)
    expect(frame.layers.every(candidate => candidate.userLocked)).toBe(true)
  })

  it('hands ordered user effects through without fabricating primitive renderer nodes', () => {
    const source = media('effect-source')
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: [layer('effect-layer', source.id, 0, { effects: ['bloom', 'stutter'] })],
      },
      mediaItems: [source],
      fitMode: 'cover',
      isMediaReady: () => true,
    })

    expect(frame.layers[0]?.userEffects).toEqual(['bloom', 'stutter'])
    expect(frame.layers[0]?.effectChain).toEqual([])
  })

  it('resolves four visible authored layers into canonical quadrants without changing stable identities', () => {
    const mediaItems = ['one', 'two', 'three', 'four'].map(id => media(id))
    const authoredLayers = mediaItems.map((item, index) => layer(`stable-${index + 1}`, item.id, index))
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers },
      mediaItems,
      fitMode: 'cover',
      isMediaReady: () => true,
    })

    expect(frame.layers.map(candidate => candidate.id)).toEqual(authoredLayers.map(candidate => candidate.id))
    expect(frame.layers.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: -0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ])
    expect(frame.layers.every(candidate => candidate.scaleX === candidate.scaleY)).toBe(true)
    expect(frame.layers.every(candidate => Math.abs(candidate.scaleX - 0.46) < 1e-10)).toBe(true)
    expect(frame.layers.every(candidate => candidate.aspectBehavior === 'contain')).toBe(true)
  })

  it('compacts visible ordinals after middle removal while preserving the remaining stable layer IDs', () => {
    const mediaItems = ['one', 'two', 'three', 'four'].map(id => media(id))
    const authoredLayers = mediaItems.map((item, index) => layer(`stable-${index + 1}`, item.id, index))
    const before = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers },
      mediaItems,
      fitMode: 'contain',
      isMediaReady: () => true,
    })
    const remaining = authoredLayers
      .filter(candidate => candidate.id !== 'stable-2')
      .map((candidate, index) => ({ ...candidate, order: index }))
    const after = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers: remaining },
      mediaItems,
      fitMode: 'contain',
      isMediaReady: () => true,
    })

    expect(before.layers.map(candidate => candidate.id)).toEqual(['stable-1', 'stable-2', 'stable-3', 'stable-4'])
    expect(after.layers.map(candidate => candidate.id)).toEqual(['stable-1', 'stable-3', 'stable-4'])
    expect(after.layers.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: -2 / 3, y: 0 },
      { x: 0, y: 0 },
      { x: 2 / 3, y: 0 },
    ])
    expect(after.layers.every(candidate => Math.abs(candidate.scaleX - (0.92 / 3)) < 1e-10)).toBe(true)
    expect(after.layers.every(candidate => Math.abs(candidate.scaleY - 0.92) < 1e-10)).toBe(true)
  })

  it('derives layout participation from visible enabled/solo state without deleting retained authored state', () => {
    const mediaItems = ['one', 'two', 'three'].map(id => media(id))
    const authoredLayers = [
      layer('stable-1', 'one', 0),
      layer('stable-2', 'two', 1, { enabled: false }),
      layer('stable-3', 'three', 2),
    ]
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers },
      mediaItems,
      fitMode: 'contain',
      isMediaReady: () => true,
    })

    expect(frame.layers).toHaveLength(3)
    expect(frame.layers[1]).toMatchObject({ id: 'stable-2', enabled: false })
    expect(frame.layers.filter(candidate => candidate.enabled).map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'stable-1', x: -0.5, y: -0.5 },
      { id: 'stable-3', x: 0.5, y: 0.5 },
    ])

    const soloFrame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: authoredLayers.map(candidate => ({ ...candidate, enabled: true, solo: candidate.id === 'stable-3' })),
      },
      mediaItems,
      fitMode: 'cover',
      isMediaReady: () => true,
    })
    const visible = soloFrame.layers.filter(candidate => candidate.enabled)
    expect(visible).toHaveLength(1)
    expect(visible[0]).toMatchObject({ id: 'stable-3', x: 0, y: 0, scaleX: 1, scaleY: 1, aspectBehavior: 'cover' })
  })

  it('keeps alpha-capable PNG sources as dry source-over layers with no mask or opaque slot treatment', () => {
    const transparent = media('transparent-png')
    transparent.hasAlpha = true
    transparent.mimeType = 'image/png'
    transparent.width = 420
    transparent.height = 960
    const primary = media('primary-video', 'video')
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: [layer('primary-layer', primary.id, 0), layer('alpha-layer', transparent.id, 1)],
      },
      mediaItems: [primary, transparent],
      fitMode: 'cover',
      isMediaReady: () => true,
    })

    const alphaLayer = frame.layers.find(candidate => candidate.id === 'alpha-layer')
    expect(alphaLayer?.source).toMatchObject({ id: transparent.id, hasAlpha: true, mimeType: 'image/png' })
    expect(alphaLayer).toMatchObject({
      enabled: true,
      blendMode: 'source-over',
      opacity: 1,
      maskMode: null,
      aspectBehavior: 'contain',
      fitWithinTransformBounds: true,
      x: 0.5,
      y: 0.5,
    })
    expect(alphaLayer?.scaleX).toBe(alphaLayer?.scaleY)
  })

  it('preserves the existing single-media fit mode and full-canvas transform', () => {
    const source = media('single')
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: [layer('single-layer', source.id, 0)],
      },
      mediaItems: [source],
      fitMode: 'cover',
      isMediaReady: () => true,
    })

    expect(frame.layers[0]).toMatchObject({
      id: 'single-layer',
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      fitWithinTransformBounds: false,
      aspectBehavior: 'cover',
    })
  })

  it('reconstructs identical layout from persisted order and appends automatic layers after manual ordinals', () => {
    const mediaItems = ['manual-a', 'manual-b', 'auto-a', 'auto-b'].map(id => media(id))
    const persisted = [
      layer('manual-b-layer', 'manual-b', 1),
      layer('manual-a-layer', 'manual-a', 0),
    ]
    const automaticLayers = [
      layer('auto-a-layer', 'auto-a', 0, { ownership: 'automatic', pinned: false }),
      layer('auto-b-layer', 'auto-b', 1, { ownership: 'automatic', pinned: false }),
    ]
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers: persisted },
      mediaItems,
      fitMode: 'contain',
      automaticLayers,
      isMediaReady: () => true,
    })

    expect(frame.layers.map(candidate => candidate.id)).toEqual([
      'manual-a-layer',
      'manual-b-layer',
      'auto-a-layer',
      'auto-b-layer',
    ])
    expect(frame.layers.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: -0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ])
  })

  it('keeps a raster Image at the top/front of a mixed Image + SVG + SVG authored stack', () => {
    const image = media('image-c', 'image')
    const svgB = media('svg-b', 'svg')
    const svgA = media('svg-a', 'svg')
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: [
          layer('layer-image-c', image.id, 0),
          layer('layer-svg-b', svgB.id, 1),
          layer('layer-svg-a', svgA.id, 2),
        ],
      },
      mediaItems: [svgA, image, svgB],
      fitMode: 'contain',
      isMediaReady: () => true,
    })

    expect(frame.layers.map(candidate => candidate.source?.type)).toEqual(['image', 'svg', 'svg'])
    expect(frame.layers.map(candidate => candidate.sourceMediaId)).toEqual([image.id, svgB.id, svgA.id])
    expect(frame.readyMediaIds).toEqual([image.id, svgB.id, svgA.id])
    expect(frame.layers[0].zIndex).toBeGreaterThan(frame.layers[1].zIndex)
    expect(frame.layers[1].zIndex).toBeGreaterThan(frame.layers[2].zIndex)
  })

  it('keeps duplicate media as distinct layer instances while sharing one source handle identity', () => {
    const shared = media('shared-video', 'video')
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: [layer('duplicate-a', shared.id, 0), layer('duplicate-b', shared.id, 1)],
      },
      mediaItems: [shared],
      fitMode: 'cover',
      isMediaReady: () => true,
    })

    expect(frame.layers.map(candidate => candidate.id)).toEqual(['duplicate-a', 'duplicate-b'])
    expect(frame.layers.map(candidate => candidate.sourceMediaId)).toEqual([shared.id, shared.id])
    expect(frame.decoderCount).toBe(1)
    expect(frame.readyMediaIds).toEqual([shared.id])
  })

  it('honors solo and deterministically suppresses only unique videos beyond the live decoder budget', () => {
    const videos = Array.from({ length: 4 }, (_, index) => media(`video-${index + 1}`, 'video'))
    const authored = videos.map((item, index) => layer(`layer-${index + 1}`, item.id, index))
    const bounded = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers: authored },
      mediaItems: videos,
      fitMode: 'cover',
      isMediaReady: () => true,
    })

    expect(bounded.layers.filter(candidate => candidate.enabled)).toHaveLength(MAX_CANVAS_ACTIVE_VIDEO_DECODERS)
    expect(bounded.layers[MAX_CANVAS_ACTIVE_VIDEO_DECODERS].enabled).toBe(false)
    expect(bounded.diagnostics).toContain(`video-decoder-limit:${authored[MAX_CANVAS_ACTIVE_VIDEO_DECODERS].id}`)

    const solo = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: authored.map((candidate, index) => ({ ...candidate, solo: index === 3 })),
      },
      mediaItems: videos,
      fitMode: 'cover',
      isMediaReady: () => true,
    })
    expect(solo.layers.filter(candidate => candidate.enabled).map(candidate => candidate.id)).toEqual([authored[3].id])
    expect(solo.decoderCount).toBe(1)
  })

  it('reports failed authored media separately from sources that are still preloading', () => {
    const failed = media('failed-image')
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: [layer('failed-layer', failed.id, 0)],
      },
      mediaItems: [failed],
      fitMode: 'cover',
      isMediaReady: () => false,
      getMediaError: mediaId => mediaId === failed.id ? 'Expired signed URL' : null,
    })

    expect(frame.pendingMediaIds).toEqual([])
    expect(frame.mediaErrors).toEqual([{ mediaId: failed.id, message: 'Expired signed URL' }])
    expect(frame.diagnostics).toContain(`media-load-error:${failed.id}:Expired signed URL`)
  })
})
