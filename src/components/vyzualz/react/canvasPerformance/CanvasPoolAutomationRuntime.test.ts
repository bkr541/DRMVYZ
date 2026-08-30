import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import type { CanvasMediaItem, ReactTrackSection } from '../ReactTypes'
import { resolveCanvasAuthoredLayerFrame } from './CanvasAuthoredLayerRuntime'
import {
  getCanvasPoolAutomationPreloadCandidates,
  resolveCanvasPoolAutomationRuntime,
  resolveCanvasPoolAutomationTriggerToken,
} from './CanvasPoolAutomationRuntime'
import {
  CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS,
  DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
  type CanvasAuthoredLayer,
  type CanvasOrchestrationSettings,
  type CanvasPoolAutomationTrigger,
} from './CanvasPerformanceTypes'

const sections: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 4, intensity: 0.3, source: 'auto', confidence: 0.95 },
  { id: 'drop', label: 'Drop', type: 'drop', startSec: 4, endSec: 40, intensity: 0.9, source: 'auto', confidence: 0.95 },
]

function frame(timeSec: number, events: { kick?: boolean; snare?: boolean } = {}): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.round(timeSec * 1000),
    trackId: 'pool-automation-track',
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: true,
      downbeatHit: beatIndex % 4 === 0,
      kickHit: events.kick === true,
      kickStrength: events.kick ? 0.9 : 0,
      snareHit: events.snare === true,
      snareStrength: events.snare ? 0.9 : 0,
    },
    capabilities: {
      liveBands: false,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: false,
      stemCurves: false,
      lyrics: false,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.95, rhythm: 0.95, section: 0.95 },
  }
}

function contextAt(
  timeSec: number,
  previous: SharedPerformanceContext | null = null,
  events: { kick?: boolean; snare?: boolean } = {},
  identityPatch: { seek?: string; track?: string } = {},
): SharedPerformanceContext {
  const track = identityPatch.track ?? 'pool-automation-track'
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: { ...frame(timeSec, events), trackId: track },
    resolvedSections: sections,
    trackIdentity: track,
    seekIdentity: identityPatch.seek ?? 'seek-0',
    trackChangeIdentity: `track:${track}`,
    previous,
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

function manualLayer(id: string, mediaId: string, order: number): CanvasAuthoredLayer {
  return { id, mediaId, effects: [], order, enabled: true, solo: false, ownership: 'manual', pinned: true }
}

function settings(patch: Partial<CanvasOrchestrationSettings> = {}): CanvasOrchestrationSettings {
  return {
    ...DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
    renderMode: 'layers',
    poolAutomationEnabled: true,
    mediaPools: [{ id: 'active-pool', name: 'Active', mediaIds: ['pool-a', 'pool-b', 'pool-c', 'pool-d'] }],
    activeMediaPoolId: 'active-pool',
    mediaPoolIds: ['pool-a', 'pool-b', 'pool-c', 'pool-d'],
    ...patch,
  }
}

function boundary(previousTime: number, currentTime: number, events: { kick?: boolean; snare?: boolean } = {}) {
  const previous = contextAt(previousTime)
  return contextAt(currentTime, previous, events)
}

describe('CANVAS Pool automation runtime', () => {
  it('exposes exactly the eight required trigger choices', () => {
    expect(CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS.map(option => option.label)).toEqual([
      'Beat', '4 Bar', '6 Bar', '8 Bar', '16 Bar', 'Track Sections', 'Kick Hit', 'Snare Hit',
    ])
  })

  it.each<[CanvasPoolAutomationTrigger, SharedPerformanceContext]>([
    ['beat', boundary(0.49, 0.51)],
    ['4bars', boundary(7.99, 8.01)],
    ['6bars', boundary(11.99, 12.01)],
    ['8bars', boundary(15.99, 16.01)],
    ['16bars', boundary(31.99, 32.01)],
    ['trackSections', boundary(3.99, 4.01)],
    ['kickHit', boundary(1.01, 1.11, { kick: true })],
    ['snareHit', boundary(1.01, 1.11, { snare: true })],
  ])('fires %s only from the canonical shared-performance signal', (trigger, context) => {
    expect(resolveCanvasPoolAutomationTriggerToken(context, trigger)).not.toBeNull()
  })

  it('fills only free automatic slots, preserves manual layers, and no-ops at four manual layers', () => {
    const mediaItems = [media('manual-a'), media('manual-b'), media('manual-c'), media('manual-d'), media('pool-a'), media('pool-b'), media('pool-c'), media('pool-d')]
    const twoManual = settings({
      authoredLayers: [manualLayer('manual-1', 'manual-a', 0), manualLayer('manual-2', 'manual-b', 1)],
    })
    const initial = resolveCanvasPoolAutomationRuntime({
      context: contextAt(1),
      settings: twoManual,
      mediaItems,
    })
    expect(initial.automaticLayers).toHaveLength(2)
    expect(initial.automaticLayers.every(layer => layer.ownership === 'automatic' && !layer.pinned)).toBe(true)
    expect(twoManual.authoredLayers.map(layer => layer.mediaId)).toEqual(['manual-a', 'manual-b'])

    const full = settings({
      authoredLayers: ['manual-a', 'manual-b', 'manual-c', 'manual-d'].map((id, index) => manualLayer(`manual-${index}`, id, index)),
    })
    const blocked = resolveCanvasPoolAutomationRuntime({ context: contextAt(1), settings: full, mediaItems })
    expect(blocked.automaticLayers).toEqual([])
    expect(blocked.diagnostics).toContain('pool-automation-no-free-slots')
  })

  it('respects the four-layer cap for every manual-layer count from zero through four', () => {
    const mediaItems = [
      media('manual-a'), media('manual-b'), media('manual-c'), media('manual-d'),
      media('pool-a'), media('pool-b'), media('pool-c'), media('pool-d'),
    ]

    for (let manualCount = 0; manualCount <= 4; manualCount += 1) {
      const authoredLayers = ['manual-a', 'manual-b', 'manual-c', 'manual-d']
        .slice(0, manualCount)
        .map((id, index) => manualLayer(`manual-${index + 1}`, id, index))
      const configured = settings({ authoredLayers })
      const resolved = resolveCanvasPoolAutomationRuntime({ context: contextAt(1), settings: configured, mediaItems })
      expect(resolved.automaticLayers).toHaveLength(4 - manualCount)
      expect(authoredLayers.map(layer => layer.mediaId)).toEqual(
        ['manual-a', 'manual-b', 'manual-c', 'manual-d'].slice(0, manualCount),
      )
    }
  })

  it('handles empty, single-item, and many-item active Pools without borrowing from inactive Pools', () => {
    const mediaItems = [media('pool-a'), media('pool-b'), media('pool-c'), media('inactive-a')]
    const empty = settings({ mediaPools: [{ id: 'active-pool', name: 'Active', mediaIds: [] }], mediaPoolIds: [] })
    const emptyResolution = resolveCanvasPoolAutomationRuntime({ context: contextAt(1), settings: empty, mediaItems })
    expect(emptyResolution.automaticLayers).toEqual([])
    expect(emptyResolution.diagnostics).toContain('pool-automation-empty-active-pool')

    const single = settings({
      mediaPools: [
        { id: 'active-pool', name: 'Active', mediaIds: ['pool-a'] },
        { id: 'inactive-pool', name: 'Inactive', mediaIds: ['inactive-a'] },
      ],
      mediaPoolIds: ['pool-a'],
    })
    const singleResolution = resolveCanvasPoolAutomationRuntime({ context: contextAt(1), settings: single, mediaItems })
    expect(singleResolution.automaticLayers).toHaveLength(4)
    expect(singleResolution.automaticLayers.every(layer => layer.mediaId === 'pool-a')).toBe(true)

    const many = settings({
      mediaPools: [
        { id: 'active-pool', name: 'Active', mediaIds: ['pool-a', 'pool-b', 'pool-c'] },
        { id: 'inactive-pool', name: 'Inactive', mediaIds: ['inactive-a'] },
      ],
      mediaPoolIds: ['pool-a', 'pool-b', 'pool-c'],
    })
    const manyResolution = resolveCanvasPoolAutomationRuntime({ context: contextAt(1), settings: many, mediaItems })
    expect(manyResolution.automaticLayers.every(layer => ['pool-a', 'pool-b', 'pool-c'].includes(layer.mediaId))).toBe(true)
    expect(manyResolution.automaticLayers.some(layer => layer.mediaId === 'inactive-a')).toBe(false)
    expect(getCanvasPoolAutomationPreloadCandidates(many, mediaItems, ['pool-a'])).toEqual(
      expect.arrayContaining(['pool-b', 'pool-c']),
    )
    expect(getCanvasPoolAutomationPreloadCandidates(many, mediaItems, ['pool-a'])).not.toContain('inactive-a')
  })

  it('uses only the active Pool, retires old Pool choices on switch, and never mutates authored manual media IDs', () => {
    const mediaItems = [media('manual-a'), media('pool-a'), media('pool-b'), media('other-a'), media('other-b')]
    const initialSettings = settings({
      authoredLayers: [manualLayer('manual-1', 'manual-a', 0)],
      mediaPools: [
        { id: 'active-pool', name: 'Active', mediaIds: ['pool-a', 'pool-b'] },
        { id: 'other-pool', name: 'Other', mediaIds: ['other-a', 'other-b'] },
      ],
      mediaPoolIds: ['pool-a', 'pool-b'],
    })
    const initial = resolveCanvasPoolAutomationRuntime({ context: contextAt(1), settings: initialSettings, mediaItems })
    expect(initial.automaticLayers.every(layer => ['pool-a', 'pool-b'].includes(layer.mediaId))).toBe(true)

    const switchedSettings = settings({
      ...initialSettings,
      activeMediaPoolId: 'other-pool',
      mediaPoolIds: ['other-a', 'other-b'],
      poolRevision: initialSettings.poolRevision + 1,
    })
    const switched = resolveCanvasPoolAutomationRuntime({
      context: contextAt(1.2),
      settings: switchedSettings,
      mediaItems,
      previousState: initial.state,
    })
    expect(switched.automaticLayers.every(layer => ['other-a', 'other-b'].includes(layer.mediaId))).toBe(true)
    expect(switchedSettings.authoredLayers[0]?.mediaId).toBe('manual-a')
    expect(switched.state.lastEventToken).toBeNull()
  })

  it('does not fabricate trigger events when the required Music Intelligence capability is unavailable', () => {
    const beatBoundary = boundary(0.49, 0.51)
    const unavailable: SharedPerformanceContext = {
      ...beatBoundary,
      intelligence: { ...beatBoundary.intelligence, supports: () => false },
    }
    expect(resolveCanvasPoolAutomationTriggerToken(unavailable, 'beat')).toBeNull()
    expect(resolveCanvasPoolAutomationTriggerToken(unavailable, 'kickHit')).toBeNull()
    expect(resolveCanvasPoolAutomationTriggerToken(unavailable, 'trackSections')).toBeNull()
  })

  it('deduplicates a repeated kick frame while allowing a later canonical kick event', () => {
    const mediaItems = [media('pool-a'), media('pool-b')]
    const configured = settings({ poolAutomationTrigger: 'kickHit' })
    const initialContext = contextAt(1.01)
    const initial = resolveCanvasPoolAutomationRuntime({ context: initialContext, settings: configured, mediaItems })
    const kickContext = contextAt(1.11, initialContext, { kick: true })
    const fired = resolveCanvasPoolAutomationRuntime({ context: kickContext, settings: configured, mediaItems, previousState: initial.state })
    expect(fired.advanced).toBe(true)

    const duplicate = resolveCanvasPoolAutomationRuntime({ context: kickContext, settings: configured, mediaItems, previousState: fired.state })
    expect(duplicate.advanced).toBe(false)

    const quietContext = contextAt(1.2, kickContext)
    const quiet = resolveCanvasPoolAutomationRuntime({ context: quietContext, settings: configured, mediaItems, previousState: duplicate.state })
    const laterKickContext = contextAt(1.31, quietContext, { kick: true })
    const later = resolveCanvasPoolAutomationRuntime({ context: laterKickContext, settings: configured, mediaItems, previousState: quiet.state })
    expect(later.advanced).toBe(true)
    expect(later.state.lastEventToken).not.toBe(fired.state.lastEventToken)
  })

  it('deduplicates one musical event, resets safely on seek, and supports exact six-bar phase', () => {
    const mediaItems = [media('pool-a'), media('pool-b')]
    const configured = settings({ poolAutomationTrigger: '6bars' })
    const beforeSix = contextAt(11.99)
    const atSix = contextAt(12.01, beforeSix)
    const first = resolveCanvasPoolAutomationRuntime({ context: atSix, settings: configured, mediaItems })
    const fired = resolveCanvasPoolAutomationRuntime({
      context: atSix,
      settings: configured,
      mediaItems,
      previousState: { ...first.state, lastEventToken: null },
    })
    expect(fired.advanced).toBe(true)
    expect(fired.state.lastEventToken).toBe('6bars:1')
    expect(resolveCanvasPoolAutomationTriggerToken(boundary(15.99, 16.01), '6bars')).toBeNull()
    expect(resolveCanvasPoolAutomationTriggerToken(boundary(23.99, 24.01), '6bars')).toBe('6bars:2')

    const duplicate = resolveCanvasPoolAutomationRuntime({ context: atSix, settings: configured, mediaItems, previousState: fired.state })
    expect(duplicate.advanced).toBe(false)
    expect(duplicate.state.automaticMediaIds).toEqual(fired.state.automaticMediaIds)

    const seeked = contextAt(2, atSix, {}, { seek: 'seek-1' })
    const reset = resolveCanvasPoolAutomationRuntime({ context: seeked, settings: configured, mediaItems, previousState: fired.state })
    expect(reset.advanced).toBe(false)
    expect(reset.state.lastEventToken).toBeNull()
    expect(reset.diagnostics).toContain('pool-automation-trigger-reset')
  })

  it('routes automatic swaps through the user-selected CANVAS transition compositor contract', () => {
    const mediaItems = [media('manual-a'), media('pool-a'), media('pool-b')]
    const configured = settings({
      authoredLayers: [manualLayer('manual-1', 'manual-a', 0)],
      poolAutomationTransitionId: 'dipToBlack',
    })
    const firstContext = contextAt(0.2)
    const initialFrame = resolveCanvasAuthoredLayerFrame({
      context: firstContext,
      settings: configured,
      mediaItems,
      fitMode: 'cover',
      automaticLayers: [
        { id: 'canvas-pool-auto-slot-1', mediaId: 'pool-a', effects: [], order: 0, enabled: true, solo: false, ownership: 'automatic', pinned: false },
      ],
      automationTransitionId: configured.poolAutomationTransitionId,
      isMediaReady: () => true,
    })

    const nextContext = contextAt(0.51, firstContext)
    const nextFrame = resolveCanvasAuthoredLayerFrame({
      context: nextContext,
      settings: configured,
      mediaItems,
      fitMode: 'cover',
      automaticLayers: [
        { id: 'canvas-pool-auto-slot-1', mediaId: 'pool-b', effects: [], order: 0, enabled: true, solo: false, ownership: 'automatic', pinned: false },
      ],
      previousFrame: initialFrame,
      automationAdvanced: true,
      automationTransitionId: configured.poolAutomationTransitionId,
      isMediaReady: () => true,
    })

    expect(nextFrame.layers[0]?.id).toBe('manual-1')
    expect(nextFrame.layers[0]?.sourceMediaId).toBe('manual-a')
    expect(nextFrame.layers.find(layer => layer.id === 'canvas-pool-auto-slot-1')?.sourceMediaId).toBe('pool-b')
    expect(nextFrame.transitionLayerIds).toEqual(['canvas-pool-auto-slot-1'])
    expect(nextFrame.transitionLayerIds).not.toContain('manual-1')
    expect(nextFrame.transition?.id).toBe('dipToBlack')
    expect(nextFrame.transition?.fromFrameIdentity).toBe(initialFrame.frameIdentity)
    expect(nextFrame.transition?.toFrameIdentity).toBe(nextFrame.frameIdentity)
  })
})
