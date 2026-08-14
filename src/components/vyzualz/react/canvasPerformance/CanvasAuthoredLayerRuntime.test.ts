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
})
