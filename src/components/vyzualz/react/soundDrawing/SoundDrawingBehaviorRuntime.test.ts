import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import {
  buildSharedPerformanceContext,
  type SharedPerformanceContext,
} from '../../../../features/performanceCore'
import type { ReactFrameContext } from '../renderers/reactRenderUtils'
import {
  applySoundDrawingBehaviorRouting,
  disposeSoundDrawingBehaviorRuntime,
  getSoundDrawingBehaviorRuntimeStats,
} from './SoundDrawingBehaviorRuntime'
import {
  DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  type SoundDrawingEventBinding,
  type SoundDrawingModulationRoute,
  type SoundDrawingPerformanceTemporalState,
} from './SoundDrawingPerformanceTypes'

function contextAt(
  timeSec: number,
  patch: Partial<SharedPerformanceContext> = {},
): SharedPerformanceContext {
  const frame = {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.floor(timeSec * 60)),
    trackId: 'track-a',
    sourceId: 'track-a',
    analysisRevision: 'analysis-a',
    timelineRevision: 'timeline-a',
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.95,
      beatIndex: Math.floor(timeSec * 2),
      beatPhase: timeSec * 2 - Math.floor(timeSec * 2),
      beatInBar: Math.floor(timeSec * 2) % 4,
      barIndex: Math.floor(timeSec / 2),
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 0.95,
      rhythm: 0.95,
      section: 0.95,
    },
  } as MusicIntelligenceFrame
  const base = buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame,
    trackIdentity: 'track-a',
  })
  return {
    ...base,
    ...patch,
    capabilities: { ...base.capabilities, ...(patch.capabilities ?? {}) },
    confidence: { ...base.confidence, ...(patch.confidence ?? {}) },
    boundaries: { ...base.boundaries, ...(patch.boundaries ?? {}) },
    intelligence: {
      ...base.intelligence,
      ...(patch.intelligence ?? {}),
      rhythm: {
        ...base.intelligence.rhythm,
        ...(patch.intelligence?.rhythm ?? {}),
      },
    },
  }
}

function frameAt(timeSec: number, timingDiscontinuity = false): ReactFrameContext {
  return {
    W: 1280,
    H: 720,
    dpr: 1,
    t: timeSec * 1000,
    elapsedTimeSec: timeSec,
    deltaTimeSec: 1 / 60,
    timingDiscontinuity,
    timeSec,
    audioTime: timeSec,
    trackKey: 'track-a',
    bpm: 120,
    beatPhase: timeSec * 2 - Math.floor(timeSec * 2),
    beatHit: false,
    isPlaying: true,
    audio: { bass: 0.5, mid: 0.5, high: 0.5, volume: 0.5 },
    freqData: null,
    timeDomainData: null,
    musicIntelligence: null,
  }
}

function apply(
  temporalState: SoundDrawingPerformanceTemporalState,
  context: SharedPerformanceContext,
  routes: readonly SoundDrawingModulationRoute[] = [],
  events: readonly SoundDrawingEventBinding[] = [],
  timingDiscontinuity = false,
) {
  const continuous = new Map<string, number>()
  const transient = new Map<string, number>()
  applySoundDrawingBehaviorRouting({
    temporalState,
    context,
    frame: frameAt(context.audioTimeSec, timingDiscontinuity),
    settings: DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
    routes: routes.map(route => ({ layerId: 'layer-a', route })),
    events: events.map(binding => ({ id: `layer-a:${binding.id}`, layerId: 'layer-a', binding })),
    applyContinuous: (target, value) => continuous.set(target.target, value),
    applyEvent: (target, value) => transient.set(target.target, (transient.get(target.target) ?? 0) + value),
  })
  return { continuous, transient }
}

const envelope: SoundDrawingEventBinding['envelope'] = {
  attack: '1/16beat',
  hold: '1/8beat',
  release: '1/2beat',
  curve: 'easeOut',
}

describe('SoundDrawingBehaviorRuntime', () => {
  it('preserves bass-to-scale, energy-to-glow, and vocal-to-opacity mappings', () => {
    const temporal = { identity: '' }
    const routes: SoundDrawingModulationRoute[] = [
      { id: 'bass-scale', source: 'bass', target: 'scale', min: 0, max: 0.4, amount: 1, attack: 0, release: 0 },
      { id: 'energy-glow', source: 'trackRelativeEnergy', target: 'glow', min: 0, max: 0.5, amount: 1, attack: 0, release: 0 },
      { id: 'vocal-opacity', source: 'vocalEnergy', target: 'opacity', min: 0, max: 0.25, amount: 1, attack: 0, release: 0 },
    ]
    const result = apply(temporal, contextAt(4, {
      bass: 0.75,
      trackRelativeEnergy: 0.6,
      vocalEnergy: 0.8,
    }), routes)
    expect(result.continuous.get('scale')).toBeCloseTo(0.3, 6)
    expect(result.continuous.get('glow')).toBeCloseTo(0.3, 6)
    expect(result.continuous.get('opacity')).toBeCloseTo(0.2, 6)
  })

  it('preserves Sound Drawing amount semantics by scaling the authored range span', () => {
    const temporal = { identity: '' }
    const route: SoundDrawingModulationRoute = {
      id: 'amount-span', source: 'bass', target: 'rotation', min: 2, max: 6, amount: 0.5, attack: 0, release: 0,
    }
    const result = apply(temporal, contextAt(1, { bass: 0.5 }), [route])
    expect(result.continuous.get('rotation')).toBeCloseTo(3, 6)
  })

  it('uses separate attack and release smoothing constants', () => {
    const temporal = { identity: '' }
    const route: SoundDrawingModulationRoute = {
      id: 'smooth', source: 'bass', target: 'scale', min: 0, max: 1, amount: 1, attack: 1, release: 2,
    }
    apply(temporal, contextAt(1, { bass: 0 }), [route])
    const attack = apply(temporal, contextAt(1 + 1 / 60, { bass: 1 }), [route]).continuous.get('scale') ?? 0
    const release = apply(temporal, contextAt(1 + 2 / 60, { bass: 0 }), [route]).continuous.get('scale') ?? 0
    expect(attack).toBeGreaterThan(0)
    expect(attack).toBeLessThan(1)
    expect(release).toBeGreaterThan(0)
    expect(release).toBeLessThan(attack)
  })

  it('gates routes by section, confidence, and capability', () => {
    const temporal = { identity: '' }
    const route: SoundDrawingModulationRoute = {
      id: 'gated',
      source: 'bass',
      target: 'scale',
      min: 0,
      max: 1,
      amount: 1,
      attack: 0,
      release: 0,
      sectionFilter: ['drop'],
      minConfidence: 0.8,
      capability: 'liveBands',
    }
    const blockedSection = apply(temporal, contextAt(2, { macroSectionType: 'verse', bass: 1 }), [route])
    expect(blockedSection.continuous.has('scale')).toBe(false)
    const blockedConfidence = apply(temporal, contextAt(2.1, {
      macroSectionType: 'drop',
      bass: 1,
      confidence: { ...contextAt(2.1).confidence, overall: 0.2 },
    }), [route])
    expect(blockedConfidence.continuous.has('scale')).toBe(false)
    const blockedCapability = apply(temporal, contextAt(2.2, {
      macroSectionType: 'drop',
      bass: 1,
      capabilities: { ...contextAt(2.2).capabilities, liveBands: false },
    }), [route])
    expect(blockedCapability.continuous.has('scale')).toBe(false)
    const allowed = apply(temporal, contextAt(2.3, { macroSectionType: 'drop', bass: 1 }), [route])
    expect(allowed.continuous.get('scale')).toBe(1)
  })

  it('preserves kick and snare attack-hold-release envelopes and suppresses duplicates', () => {
    const temporal = { identity: '' }
    const events: SoundDrawingEventBinding[] = [
      { id: 'kick', event: 'kick', target: 'scale', amount: 0.4, envelope },
      { id: 'snare', event: 'snare', target: 'rotation', amount: 12, envelope },
    ]
    const hit = contextAt(8, {
      kick: true,
      kickStrength: 1,
      snare: true,
      snareStrength: 1,
      intelligence: {
        ...contextAt(8).intelligence,
        rhythm: { ...contextAt(8).intelligence.rhythm, kickHit: true, snareHit: true },
      },
    })
    const first = apply(temporal, hit, [], events)
    expect(first.transient.get('scale')).toBeGreaterThanOrEqual(0)
    expect(first.transient.get('rotation')).toBeGreaterThanOrEqual(0)
    const statsAfterFirst = getSoundDrawingBehaviorRuntimeStats(temporal)
    apply(temporal, hit, [], events)
    expect(getSoundDrawingBehaviorRuntimeStats(temporal)?.activeEventStateCount).toBe(statsAfterFirst?.activeEventStateCount)

    const hold = apply(temporal, contextAt(8.08), [], events)
    expect(hold.transient.get('scale')).toBeGreaterThan(0)
    const release = apply(temporal, contextAt(8.25), [], events)
    expect(release.transient.get('scale')).toBeGreaterThanOrEqual(0)
  })

  it('clears stale smoothing and transient state on seek, loop wrap, and track replacement', () => {
    const temporal = { identity: '' }
    const route: SoundDrawingModulationRoute = {
      id: 'smooth', source: 'bass', target: 'scale', min: 0, max: 1, amount: 1, attack: 1, release: 1,
    }
    const event: SoundDrawingEventBinding = { id: 'kick', event: 'kick', target: 'scale', amount: 1, envelope }
    apply(temporal, contextAt(9, { bass: 1, kick: true, kickStrength: 1 }), [route], [event])
    const before = getSoundDrawingBehaviorRuntimeStats(temporal)
    expect(before?.routeStateCount).toBe(1)

    const seekContext = contextAt(4, {
      bass: 0,
      seekDetected: true,
      seekIdentity: 'seek-1',
      boundaries: { ...contextAt(4).boundaries, timingDiscontinuity: true },
    })
    apply(temporal, seekContext, [route], [event], true)
    expect(getSoundDrawingBehaviorRuntimeStats(temporal)?.synchronizationCount).toBeGreaterThan(0)

    const loopContext = contextAt(2, {
      loopWrapDetected: true,
      loopIdentity: 'loop-1',
      boundaries: { ...contextAt(2).boundaries, timingDiscontinuity: true },
    })
    const synchronizationBeforeLoop = getSoundDrawingBehaviorRuntimeStats(temporal)?.synchronizationCount ?? 0
    apply(temporal, loopContext, [route], [event], true)
    apply(temporal, loopContext, [route], [event], true)
    expect(getSoundDrawingBehaviorRuntimeStats(temporal)?.synchronizationCount).toBe(synchronizationBeforeLoop + 1)

    const replacement = contextAt(0, {
      trackReplacementDetected: true,
      trackChangeIdentity: 'track-b',
      boundaries: { ...contextAt(0).boundaries, timingDiscontinuity: true },
    })
    apply(temporal, replacement, [route], [event], true)
    expect(getSoundDrawingBehaviorRuntimeStats(temporal)?.activeEventStateCount).toBe(0)
  })

  it('keeps renderer temporal states isolated and releases them on disposal', () => {
    const first = { identity: '' }
    const second = { identity: '' }
    const route: SoundDrawingModulationRoute = {
      id: 'route', source: 'bass', target: 'scale', min: 0, max: 1, amount: 1, attack: 0, release: 0,
    }
    apply(first, contextAt(1, { bass: 1 }), [route])
    expect(getSoundDrawingBehaviorRuntimeStats(first)?.routeStateCount).toBe(1)
    expect(getSoundDrawingBehaviorRuntimeStats(second)).toBeNull()
    disposeSoundDrawingBehaviorRuntime(first)
    expect(getSoundDrawingBehaviorRuntimeStats(first)).toBeNull()
    expect(getSoundDrawingBehaviorRuntimeStats(second)).toBeNull()
  })
})
