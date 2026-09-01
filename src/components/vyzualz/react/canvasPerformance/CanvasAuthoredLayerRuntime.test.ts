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
    mimeType: type === 'video' ? 'video/mp4' : type === 'svg' ? 'image/svg+xml' : 'image/png',
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

  it('routes four authored SVG sources through the same canonical four-layer compositor frame', () => {
    const mediaItems = ['svg-one', 'svg-two', 'svg-three', 'svg-four'].map(id => media(id, 'svg'))
    const authoredLayers = mediaItems.map((item, index) => layer(`svg-layer-${index + 1}`, item.id, index))
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers },
      mediaItems,
      fitMode: 'contain',
      isMediaReady: () => true,
    })

    expect(frame.layers).toHaveLength(4)
    expect(frame.layers.map(candidate => candidate.source?.type)).toEqual(['svg', 'svg', 'svg', 'svg'])
    expect(frame.readyMediaIds).toEqual(mediaItems.map(item => item.id))
    expect(frame.layers.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: -0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ])
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

    expect(frame.layers).toHaveLength(2)
    expect(frame.layers.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'stable-1', x: -0.5, y: -0.5 },
      { id: 'stable-3', x: 0.5, y: 0.5 },
    ])
    expect(frame.layers.some(candidate => candidate.id === 'stable-2')).toBe(false)

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

  it('fills the four rendered slots from canonical enabled order when disabled authored layers are retained', () => {
    const mediaItems = ['one', 'two', 'three', 'four', 'five'].map(id => media(id))
    const authoredLayers = [
      layer('stable-1', 'one', 0),
      layer('stable-2', 'two', 1, { enabled: false }),
      layer('stable-3', 'three', 2),
      layer('stable-4', 'four', 3),
      layer('stable-5', 'five', 4),
    ]
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers },
      mediaItems,
      fitMode: 'contain',
      isMediaReady: () => true,
    })

    expect(frame.layers.map(candidate => candidate.id)).toEqual(['stable-1', 'stable-3', 'stable-4', 'stable-5'])
    expect(frame.layers.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: -0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ])
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

describe('CANVAS Phase 2: per-layer Engine scope resolution', () => {
  it('applies the Canvas baseline (Scale/Position/Rotation/Opacity) uniformly to every layer when no layer has an override', () => {
    const mediaItems = ['one', 'two'].map(id => media(id))
    const authoredLayers = mediaItems.map((item, index) => layer(`layer-${index + 1}`, item.id, index))
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers },
      mediaItems,
      fitMode: 'contain',
      scale: 1.5,
      positionX: 20,
      positionY: -10,
      rotation: 15,
      opacity: 0.6,
      isMediaReady: () => true,
    })

    // Layer 1's own layout is x:-0.5, scaleX:0.46 (see the 2-layer layout
    // test above); the Canvas-scope baseline composes on top of that
    // identically for both layers -- i.e. the "complete output" moves/
    // scales/rotates/dims together, exactly as Canvas scope always has.
    expect(frame.layers[0]).toMatchObject({ x: -0.5 + 0.2, y: -0.5 - 0.1, rotation: 15, opacity: 0.6 })
    expect(frame.layers[1]).toMatchObject({ x: 0.5 + 0.2, y: 0.5 - 0.1, rotation: 15, opacity: 0.6 })
    expect(frame.layers[0].scaleX).toBeCloseTo(0.46 * 1.5, 10)
    expect(frame.layers[1].scaleX).toBeCloseTo(0.46 * 1.5, 10)
  })

  it('scopes an individual layer override to only that layer, leaving sibling layers exactly on the Canvas baseline', () => {
    const mediaItems = ['one', 'two', 'three'].map(id => media(id))
    const authoredLayers = [
      layer('layer-1', 'one', 0),
      layer('layer-2', 'two', 1, { engineOverrides: { scale: 0.6, positionX: 25, positionY: -5, rotation: 20, opacity: 0.4 } }),
      layer('layer-3', 'three', 2),
    ]
    const withOverride = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers },
      mediaItems,
      fitMode: 'contain',
      isMediaReady: () => true,
    })
    const baselineOnly = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: authoredLayers.map(candidate => ({ ...candidate, engineOverrides: undefined })),
      },
      mediaItems,
      fitMode: 'contain',
      isMediaReady: () => true,
    })

    const layer2 = withOverride.layers.find(candidate => candidate.id === 'layer-2')
    const layer2Baseline = baselineOnly.layers.find(candidate => candidate.id === 'layer-2')
    // The overridden layer visibly differs from what it would be on pure inheritance...
    expect(layer2?.rotation).toBe(20)
    expect(layer2?.opacity).toBe(0.4)
    expect(layer2?.x).not.toBe(layer2Baseline?.x)
    expect(layer2?.scaleX).not.toBe(layer2Baseline?.scaleX)

    // ...while Layer 1 and Layer 3 (Position X/Y, Rotation, Scale, Opacity)
    // are pixel-for-pixel identical to the no-override case: "no other layer
    // moves" when one layer is customized.
    for (const id of ['layer-1', 'layer-3']) {
      const withOverrideLayer = withOverride.layers.find(candidate => candidate.id === id)
      const baselineLayer = baselineOnly.layers.find(candidate => candidate.id === id)
      expect(withOverrideLayer).toEqual(baselineLayer)
    }
  })

  it('lets an explicit per-layer Fit Mode override win over the multi-layer contain default, without disturbing non-overridden siblings', () => {
    const mediaItems = ['one', 'two'].map(id => media(id))
    const authoredLayers = [
      layer('stretched', 'one', 0, { engineOverrides: { fitMode: 'stretch' } }),
      layer('default', 'two', 1),
    ]
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers },
      mediaItems,
      // Global Fit Mode is 'cover', but multi-layer Canvas scope still
      // defaults every non-overridden layer to 'contain' exactly as before.
      fitMode: 'cover',
      isMediaReady: () => true,
    })

    expect(frame.layers.find(layer => layer.id === 'stretched')?.aspectBehavior).toBe('stretch')
    expect(frame.layers.find(layer => layer.id === 'default')?.aspectBehavior).toBe('contain')
  })

  it('resolves sparse per-layer overrides against a non-default Canvas baseline: only overridden fields deviate, the rest inherit', () => {
    const mediaItems = ['one', 'two'].map(id => media(id))
    const authoredLayers = [
      layer('layer-a', 'one', 0, { engineOverrides: { rotation: 45 } }),
      layer('layer-b', 'two', 1),
    ]
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers },
      mediaItems,
      fitMode: 'contain',
      scale: 1.2,
      positionX: 10,
      opacity: 0.9,
      isMediaReady: () => true,
    })

    const layerA = frame.layers.find(candidate => candidate.id === 'layer-a')
    const layerB = frame.layers.find(candidate => candidate.id === 'layer-b')
    // Layer A only overrides rotation -- Scale/Position/Opacity still
    // inherit the Canvas baseline exactly like the non-overridden Layer B.
    expect(layerA?.rotation).toBe(45)
    expect(layerB?.rotation).toBe(0)
    expect(layerA?.opacity).toBe(0.9)
    expect(layerA?.opacity).toBe(layerB?.opacity)
    expect(layerA?.scaleX).toBeCloseTo(layerB?.scaleX ?? NaN, 10)
  })

  it('resets a layer back to full Canvas-baseline inheritance once its engineOverrides are cleared', () => {
    const mediaItems = ['one'].map(id => media(id))
    const overridden = [layer('layer-1', 'one', 0, { engineOverrides: { scale: 0.5, rotation: 40 } })]
    const reset = [layer('layer-1', 'one', 0)]
    const before = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers: overridden },
      mediaItems,
      fitMode: 'contain',
      scale: 1.1,
      rotation: 5,
      isMediaReady: () => true,
    })
    const after = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: { programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId, authoredLayers: reset },
      mediaItems,
      fitMode: 'contain',
      scale: 1.1,
      rotation: 5,
      isMediaReady: () => true,
    })

    expect(before.layers[0].rotation).toBe(40)
    expect(after.layers[0].rotation).toBe(5) // back to the Canvas baseline
    expect(after.layers[0].scaleX).toBeCloseTo(1.1, 10)
  })

  it('keeps Add Effects (userEffects) fully independent of Engine overrides on the same layer', () => {
    const source = media('effect-and-override-source')
    const frame = resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: [layer('combo-layer', source.id, 0, {
          effects: ['bloom', 'glitch'],
          engineOverrides: { scale: 0.5, opacity: 0.3 },
        })],
      },
      mediaItems: [source],
      fitMode: 'contain',
      isMediaReady: () => true,
    })

    expect(frame.layers[0].userEffects).toEqual(['bloom', 'glitch'])
    expect(frame.layers[0].effectChain).toEqual([])
    expect(frame.layers[0].opacity).toBe(0.3)
    expect(frame.layers[0].scaleX).toBe(0.5) // single-layer: full-canvas layout scale is 1
  })

  it('recomputes deterministically frame-to-frame as override values change (no stale cached transform)', () => {
    const source = media('live-edit-source')
    const layerAt = (scale: number) => resolveCanvasAuthoredLayerFrame({
      context: context(),
      settings: {
        programId: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
        authoredLayers: [layer('live-layer', source.id, 0, { engineOverrides: { scale } })],
      },
      mediaItems: [source],
      fitMode: 'contain',
      isMediaReady: () => true,
    }).layers[0]

    expect(layerAt(0.4).scaleX).toBe(0.4)
    expect(layerAt(0.4).scaleX).toBe(0.4)
    expect(layerAt(1.8).scaleX).toBe(1.8)
    expect(layerAt(0.9).scaleX).toBe(0.9)
  })
})
