import { describe, expect, it } from 'vitest'
import { generateCanvasFracturesPlan, generateCanvasFracturesTopology, scoreCanvasFractureCandidate } from './CanvasFracturesPlan'
import { CanvasFracturesRuntime, deriveCanvasFracturesPlanIdentityKeys } from './CanvasFracturesRuntime'
import { resolveCanvasFracturesIntervalIdentity, resolveCanvasFracturesTimeline } from './CanvasFracturesTimeline'
import { evaluateCanvasFracturesTransition, resolveCanvasFracturesFragmentDelay } from './CanvasFracturesTransition'
import type {
  CanvasFracturesPlanInput,
  CanvasFracturesRuntimeFrameInput,
  CanvasFracturesTimelineInput,
} from './CanvasFracturesTypes'

function basePlanInput(overrides: Partial<CanvasFracturesPlanInput> = {}): CanvasFracturesPlanInput {
  return {
    presetId: 'canvas-fractures',
    sourceIdentity: 'media:image:revision:7',
    mediaType: 'image',
    mediaRevision: 7,
    trackIdentity: 'track:fractures-runtime',
    topologyIdentityKey: 'topology:0',
    layoutIdentityKey: 'layout:0',
    variationSeed: 42017,
    topologyRevision: 0,
    layoutRevision: 0,
    mode: 'mixed',
    intensity: 0.62,
    focusProtection: 0.7,
    focusX: 0.5,
    focusY: 0.5,
    composition: 0.58,
    placementMode: 'balanced',
    quality: 'balanced',
    anchorMode: 'alwaysVisible',
    returnToAnchor: false,
    ...overrides,
  }
}

function timelineInput(positionSec: number, overrides: Partial<CanvasFracturesTimelineInput> = {}): CanvasFracturesTimelineInput {
  return {
    positionSec,
    bpm: 120,
    timeSignature: 4,
    beatGridOffsetSec: 0,
    topologyInterval: '4bars',
    layoutInterval: 'bar',
    freezeLayout: false,
    freezePositionSec: 0,
    ...overrides,
  }
}

function frameInput(
  positionSec: number,
  overrides: Partial<CanvasFracturesRuntimeFrameInput> = {},
): CanvasFracturesRuntimeFrameInput {
  const plan = basePlanInput()
  return {
    planInput: {
      presetId: plan.presetId,
      sourceIdentity: plan.sourceIdentity,
      mediaType: plan.mediaType,
      mediaRevision: plan.mediaRevision,
      trackIdentity: plan.trackIdentity,
      variationSeed: plan.variationSeed,
      topologyRevision: plan.topologyRevision,
      layoutRevision: plan.layoutRevision,
      mode: plan.mode,
      intensity: plan.intensity,
      focusProtection: plan.focusProtection,
      focusX: plan.focusX,
      focusY: plan.focusY,
      composition: plan.composition,
      placementMode: plan.placementMode,
      quality: plan.quality,
      anchorMode: plan.anchorMode,
      returnToAnchor: false,
    },
    timelineInput: timelineInput(positionSec),
    runtimeSettings: {
      topologyInterval: '4bars',
      layoutInterval: 'bar',
      freezeLayout: false,
      freezePositionSec: 0,
      topologyRevision: 0,
      layoutRevision: 0,
      returnToAnchor: false,
      lastManualAction: 'none',
      manualTransitionPositionSec: 0,
      transitionMode: 'staggeredAssembly',
      transitionSpeed: 0.5,
      staggerAmount: 0.65,
      zoomAmount: 0.5,
    },
    isPlaying: true,
    isPaused: false,
    ...overrides,
  }
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
}

function expectFiniteTransforms(plan: ReturnType<CanvasFracturesRuntime['resolveFrame']>) {
  for (const fragment of plan.fragments) {
    expect(Object.values(fragment.currentTransform).every(Number.isFinite)).toBe(true)
    expect(Object.values(fragment.targetTransform).every(Number.isFinite)).toBe(true)
    expect(Number.isFinite(fragment.opacity)).toBe(true)
  }
}

describe('Canvas Fractures quantized timeline', () => {
  it('derives topology and layout interval identities independently', () => {
    expect(resolveCanvasFracturesIntervalIdentity({
      interval: 'manualOnly',
      barIndex: 12,
      barStartSec: 24,
      barDurationSec: 2,
      sectionIndex: 3,
      sectionStartSec: 20,
    })).toEqual({ bucket: 0, boundarySec: 0 })
    expect(resolveCanvasFracturesIntervalIdentity({
      interval: '8bars',
      barIndex: 13,
      barStartSec: 26,
      barDurationSec: 2,
      sectionIndex: 3,
      sectionStartSec: 20,
    })).toEqual({ bucket: 1, boundarySec: 16 })
    expect(resolveCanvasFracturesIntervalIdentity({
      interval: 'section',
      barIndex: 13,
      barStartSec: 26,
      barDurationSec: 2,
      sectionIndex: 3,
      sectionStartSec: 20,
    })).toEqual({ bucket: 3, boundarySec: 20 })
  })

  it('uses analyzed bar and section boundaries when available and stable musical fallback otherwise', () => {
    const markers = Array.from({ length: 8 }, (_, barIndex) => ({
      barIndex,
      startSec: barIndex * 2,
      endSec: (barIndex + 1) * 2,
      gridSource: 'automatic' as const,
      gridConfidence: 0.95,
    }))
    const sections = [
      { id: 'intro', label: 'Intro', type: 'intro' as const, startSec: 0, endSec: 8, intensity: 0.3 },
      { id: 'drop', label: 'Drop', type: 'drop' as const, startSec: 8, endSec: 16, intensity: 0.9 },
    ]
    const analyzed = resolveCanvasFracturesTimeline(timelineInput(8.25, {
      barMarkers: markers,
      sections,
      topologyInterval: 'section',
      layoutInterval: '4bars',
    }))
    const fallback = resolveCanvasFracturesTimeline(timelineInput(8.25, {
      topologyInterval: '4bars',
      layoutInterval: 'bar',
    }))

    expect(analyzed).toMatchObject({
      barIndex: 4,
      sectionIndex: 1,
      topologyBucket: 1,
      topologyBoundarySec: 8,
      layoutBucket: 1,
      layoutBoundarySec: 8,
    })
    expect(fallback).toMatchObject({
      barIndex: 4,
      topologyBucket: 1,
      topologyBoundarySec: 8,
      layoutBucket: 4,
      layoutBoundarySec: 8,
    })
  })

  it('uses the analyzed bucket-start marker when bar durations vary', () => {
    const starts = [0, 1.5, 3.75, 5, 7.25, 9, 11.5, 13]
    const markers = starts.map((startSec, barIndex) => ({
      barIndex,
      startSec,
      endSec: starts[barIndex + 1] ?? 15.25,
      gridSource: 'automatic' as const,
      gridConfidence: 0.94,
    }))
    const resolved = resolveCanvasFracturesTimeline(timelineInput(9.4, {
      barMarkers: markers,
      topologyInterval: '4bars',
      layoutInterval: 'bar',
    }))

    expect(resolved.barIndex).toBe(5)
    expect(resolved.topologyBoundarySec).toBe(7.25)
    expect(resolved.layoutBoundarySec).toBe(9)
  })

  it('keeps future automatic identities intact while freezing the resolved structural position', () => {
    const frozenAtSeven = resolveCanvasFracturesTimeline(timelineInput(50, {
      freezeLayout: true,
      freezePositionSec: 7,
    }))
    const frozenAtOneHundred = resolveCanvasFracturesTimeline(timelineInput(100, {
      freezeLayout: true,
      freezePositionSec: 7,
    }))
    const released = resolveCanvasFracturesTimeline(timelineInput(100))

    expect(frozenAtOneHundred).toEqual(frozenAtSeven)
    expect(released.layoutBucket).toBe(50)
    expect(released.topologyBucket).toBe(12)
  })
})

describe('Canvas Fractures placement scoring and composition modes', () => {
  it('scores identical candidates identically without unbounded or random state', () => {
    const input = basePlanInput()
    const topology = generateCanvasFracturesTopology(input)
    const fragment = topology.fragments[1]
    const candidate = {
      fragment,
      transform: { centerX: 0.22, centerY: 0.73, scale: 1.08, rotationDeg: -7 },
      mode: 'balanced' as const,
      focusX: 0.5,
      focusY: 0.5,
      focusProtection: 0.7,
      composition: 0.58,
      placedBounds: [{ left: 0.35, top: 0.35, right: 0.65, bottom: 0.65, area: 0.09 }],
      zoneOccupancy: { 'lower-left': 1 },
      zoneId: 'lower-left',
    }

    expect(scoreCanvasFractureCandidate(candidate)).toEqual(scoreCanvasFractureCandidate(candidate))
  })

  it('gives every placement mode a deterministic, visibly distinct strategy', () => {
    const modes = ['balanced', 'offscreenSpill', 'heavyOverlap', 'anchorCover', 'repeatedCrops', 'mirrorFlip', 'randomMix'] as const
    const plans = modes.map(placementMode => generateCanvasFracturesPlan(basePlanInput({ placementMode, composition: 0.9 })))
    const [balanced, spill, overlap, cover, repeated, mirrored, mixed] = plans

    expect(new Set(plans.map(plan => plan.layoutIdentity)).size).toBe(modes.length)
    expect(plans.every(plan => plan.topologyIdentity === balanced.topologyIdentity)).toBe(true)
    expect(spill.fragments.some(fragment => fragment.visibleAreaRatio < 0.9)).toBe(true)
    expect(average(overlap.fragments.map(fragment => fragment.overlapRatio)))
      .toBeGreaterThan(average(balanced.fragments.map(fragment => fragment.overlapRatio)))
    expect(average(cover.fragments.map(fragment => Math.hypot(
      fragment.targetTransform.centerX - 0.5,
      fragment.targetTransform.centerY - 0.5,
    )))).toBeLessThan(average(balanced.fragments.map(fragment => Math.hypot(
      fragment.targetTransform.centerX - 0.5,
      fragment.targetTransform.centerY - 0.5,
    ))))
    expect(repeated.fragments.some(fragment => fragment.repeatedFromFragmentId !== null)).toBe(true)
    expect(mirrored.fragments.some(fragment => fragment.mirrorX || fragment.mirrorY)).toBe(true)
    expect(new Set(mixed.fragments.map(fragment => fragment.resolvedPlacementMode)).size).toBeGreaterThan(1)
    expect(generateCanvasFracturesPlan(basePlanInput({ placementMode: 'randomMix', composition: 0.9 }))).toEqual(mixed)
  })

  it('enforces minimum visible area and finite overlap at maximum composition', () => {
    for (const placementMode of ['balanced', 'offscreenSpill', 'heavyOverlap', 'anchorCover', 'randomMix'] as const) {
      const plan = generateCanvasFracturesPlan(basePlanInput({
        placementMode,
        composition: 1,
        intensity: 1,
        quality: 'high',
      }))
      const focus = plan.fragments.find(fragment => fragment.anchorRole === 'focus')
      expect(focus?.visibleAreaRatio).toBeGreaterThanOrEqual(0.9)
      expect(Math.min(...plan.fragments.map(fragment => fragment.visibleAreaRatio))).toBeGreaterThanOrEqual(0.2)
      expect(plan.fragments.every(fragment => Number.isFinite(fragment.overlapRatio) && fragment.overlapRatio >= 0 && fragment.overlapRatio <= 1)).toBe(true)
      expectFiniteTransforms(plan)
    }
  })

  it('returns a fully fragmented composition to deterministic source anchors without changing crops', () => {
    const scattered = generateCanvasFracturesPlan(basePlanInput({ anchorMode: 'fullyFragmented', placementMode: 'offscreenSpill' }))
    const anchored = generateCanvasFracturesPlan(basePlanInput({
      anchorMode: 'fullyFragmented',
      placementMode: 'offscreenSpill',
      layoutRevision: 1,
      returnToAnchor: true,
    }))

    expect(anchored.topologyIdentity).toBe(scattered.topologyIdentity)
    expect(anchored.fragments.map(fragment => fragment.crop)).toEqual(scattered.fragments.map(fragment => fragment.crop))
    for (const fragment of anchored.fragments) {
      expect(fragment.targetTransform.centerX).toBe(fragment.homeTransform.centerX)
      expect(fragment.targetTransform.centerY).toBe(fragment.homeTransform.centerY)
      expect(fragment.targetTransform.rotationDeg).toBe(0)
    }
  })
})

describe('Canvas Fractures transition reconstruction', () => {
  it('orders stagger delays deterministically with large fragments leading thin slices', () => {
    const target = generateCanvasFracturesPlan(basePlanInput({ layoutRevision: 1 }))
    const byArea = [...target.fragments].sort((a, b) => b.crop.width * b.crop.height - a.crop.width * a.crop.height)
    const identity = 'transition:stable-order'
    const largeDelay = resolveCanvasFracturesFragmentDelay(byArea[0], identity, 1, target.fragments.length)
    const thinDelay = resolveCanvasFracturesFragmentDelay(byArea[byArea.length - 1], identity, 1, target.fragments.length)

    expect(resolveCanvasFracturesFragmentDelay(byArea[0], identity, 1, target.fragments.length)).toBe(largeDelay)
    expect(largeDelay).toBeLessThanOrEqual(thinDelay)
  })

  it('supports hard cut, staggered assembly, and zoom without stale or non-finite transforms', () => {
    const previous = generateCanvasFracturesPlan(basePlanInput())
    const target = generateCanvasFracturesPlan(basePlanInput({ layoutRevision: 1, placementMode: 'offscreenSpill', composition: 1 }))

    for (const mode of ['hardGlitchCut', 'staggeredAssembly', 'zoomInOut'] as const) {
      const middle = evaluateCanvasFracturesTransition({
        previousPlan: previous,
        targetPlan: target,
        transitionIdentity: `transition:${mode}`,
        mode,
        source: 'automatic',
        startSec: 8,
        positionSec: 8.25,
        transitionSpeed: 0.4,
        staggerAmount: 0.8,
        zoomAmount: 1,
      })
      const complete = evaluateCanvasFracturesTransition({
        previousPlan: previous,
        targetPlan: target,
        transitionIdentity: `transition:${mode}`,
        mode,
        source: 'automatic',
        startSec: 8,
        positionSec: 20,
        transitionSpeed: 0.4,
        staggerAmount: 0.8,
        zoomAmount: 1,
      })

      expect(middle.transition?.mode).toBe(mode)
      expect(complete.fragments.map(fragment => fragment.currentTransform)).toEqual(target.fragments.map(fragment => fragment.targetTransform))
      expectFiniteTransforms(middle)
      expectFiniteTransforms(complete)
    }
  })

  it('switches transition types from the same absolute target state without changing identities', () => {
    const staggeredInput = frameInput(8.25)
    const zoomInput = frameInput(8.25, {
      runtimeSettings: {
        ...frameInput(8.25).runtimeSettings,
        transitionMode: 'zoomInOut',
      },
    })
    const staggered = new CanvasFracturesRuntime().resolveFrame(staggeredInput)
    const zoom = new CanvasFracturesRuntime().resolveFrame(zoomInput)

    expect(zoom.topologyIdentity).toBe(staggered.topologyIdentity)
    expect(zoom.layoutIdentity).toBe(staggered.layoutIdentity)
    expect(zoom.transition?.mode).toBe('zoomInOut')
    expect(zoom.fragments.map(fragment => fragment.currentTransform))
      .not.toEqual(staggered.fragments.map(fragment => fragment.currentTransform))
    expectFiniteTransforms(zoom)
  })

  it('reconstructs a mid-transition seek exactly and remains equivalent after looping backward', () => {
    const input = frameInput(8.35)
    const direct = new CanvasFracturesRuntime().resolveFrame(input)
    const linearRuntime = new CanvasFracturesRuntime()
    linearRuntime.resolveFrame(frameInput(7.99))
    linearRuntime.resolveFrame(frameInput(8.1))
    const linear = linearRuntime.resolveFrame(input)
    linearRuntime.resolveFrame(frameInput(24.2))
    const looped = linearRuntime.resolveFrame(input)

    expect(direct.transition?.progress).toBeGreaterThan(0)
    expect(direct.transition?.progress).toBeLessThan(1)
    expect(linear).toEqual(direct)
    expect(looped).toEqual(direct)
  })

  it('resolves one frame before and after independent topology and layout boundaries', () => {
    const before = new CanvasFracturesRuntime().resolveFrame(frameInput(7.9999))
    const after = new CanvasFracturesRuntime().resolveFrame(frameInput(8.0001))
    const layoutBefore = new CanvasFracturesRuntime().resolveFrame(frameInput(3.9999))
    const layoutAfter = new CanvasFracturesRuntime().resolveFrame(frameInput(4.0001))

    expect(after.topologyIdentity).not.toBe(before.topologyIdentity)
    expect(after.layoutIdentity).not.toBe(before.layoutIdentity)
    expect(layoutAfter.topologyIdentity).toBe(layoutBefore.topologyIdentity)
    expect(layoutAfter.layoutIdentity).not.toBe(layoutBefore.layoutIdentity)
  })
})

describe('Canvas Fractures manual actions, pause, and freeze', () => {
  it('distinguishes Refracture from Shuffle Layout while preserving layout-only crops', () => {
    const base = new CanvasFracturesRuntime().resolveFrame(frameInput(10, {
      timelineInput: timelineInput(10, { topologyInterval: 'manualOnly', layoutInterval: 'manualOnly' }),
      runtimeSettings: {
        ...frameInput(10).runtimeSettings,
        topologyInterval: 'manualOnly',
        layoutInterval: 'manualOnly',
      },
    }))
    const shuffled = new CanvasFracturesRuntime().resolveFrame(frameInput(10, {
      timelineInput: timelineInput(10, { topologyInterval: 'manualOnly', layoutInterval: 'manualOnly' }),
      runtimeSettings: {
        ...frameInput(10).runtimeSettings,
        topologyInterval: 'manualOnly',
        layoutInterval: 'manualOnly',
        layoutRevision: 1,
        lastManualAction: 'shuffleLayout',
        manualTransitionPositionSec: 10,
      },
      isPlaying: false,
      isPaused: true,
    }))
    const refractured = new CanvasFracturesRuntime().resolveFrame(frameInput(10, {
      timelineInput: timelineInput(10, { topologyInterval: 'manualOnly', layoutInterval: 'manualOnly' }),
      runtimeSettings: {
        ...frameInput(10).runtimeSettings,
        topologyInterval: 'manualOnly',
        layoutInterval: 'manualOnly',
        topologyRevision: 1,
        layoutRevision: 1,
        lastManualAction: 'refracture',
        manualTransitionPositionSec: 10,
      },
      isPlaying: false,
      isPaused: true,
    }))

    expect(shuffled.topologyIdentity).toBe(base.topologyIdentity)
    expect(shuffled.layoutIdentity).not.toBe(base.layoutIdentity)
    expect(shuffled.fragments.map(fragment => fragment.crop)).toEqual(base.fragments.map(fragment => fragment.crop))
    expect(refractured.topologyIdentity).not.toBe(base.topologyIdentity)
    expect(refractured.fragments.map(fragment => fragment.crop)).not.toEqual(base.fragments.map(fragment => fragment.crop))
    expect(shuffled.transition?.progress).toBe(1)
    expect(refractured.transition?.progress).toBe(1)
  })

  it('invalidates the runtime plan cache when the variation seed or media path changes', () => {
    const runtime = new CanvasFracturesRuntime()
    const base = runtime.resolveFrame(frameInput(6))
    const reseeded = runtime.resolveFrame(frameInput(6, {
      planInput: {
        ...frameInput(6).planInput,
        variationSeed: 42018,
      },
    }))
    const video = runtime.resolveFrame(frameInput(6, {
      planInput: {
        ...frameInput(6).planInput,
        mediaType: 'video',
      },
    }))

    expect(reseeded.topologyIdentity).not.toBe(base.topologyIdentity)
    expect(video.sourcePath).toBe('video-frame')
  })

  it('lets a manual layout command complete while automatic structural time is frozen', () => {
    const frozenShuffle = new CanvasFracturesRuntime().resolveFrame(frameInput(40.2, {
      timelineInput: timelineInput(40.2, { freezeLayout: true, freezePositionSec: 7.5 }),
      runtimeSettings: {
        ...frameInput(40.2).runtimeSettings,
        freezeLayout: true,
        freezePositionSec: 7.5,
        layoutRevision: 1,
        lastManualAction: 'shuffleLayout',
        manualTransitionPositionSec: 40,
      },
    }))

    expect(frozenShuffle.transition?.source).toBe('manual')
    expect(frozenShuffle.transition?.progress).toBeGreaterThan(0)
    expect(frozenShuffle.transition?.startSec).toBe(40)
  })

  it('starts a manual shuffle from the reconstructed in-flight automatic frame', () => {
    const actionPositionSec = 8.2
    const automaticAtAction = new CanvasFracturesRuntime().resolveFrame(frameInput(actionPositionSec))
    const manualAtAction = new CanvasFracturesRuntime().resolveFrame(frameInput(actionPositionSec, {
      runtimeSettings: {
        ...frameInput(actionPositionSec).runtimeSettings,
        layoutRevision: 1,
        lastManualAction: 'shuffleLayout',
        manualTransitionPositionSec: actionPositionSec,
      },
    }))
    const automaticById = new Map(automaticAtAction.fragments.map(fragment => [fragment.id, fragment.currentTransform]))

    expect(manualAtAction.transition?.source).toBe('manual')
    expect(manualAtAction.transition?.progress).toBe(0)
    for (const fragment of manualAtAction.fragments) {
      expect(fragment.currentTransform).toEqual(automaticById.get(fragment.id))
    }
  })

  it('allows Shuffle Layout during a transition and reconstructs it from its absolute action time', () => {
    const input = frameInput(10.2, {
      runtimeSettings: {
        ...frameInput(10.2).runtimeSettings,
        layoutRevision: 1,
        lastManualAction: 'shuffleLayout',
        manualTransitionPositionSec: 10,
      },
    })
    const direct = new CanvasFracturesRuntime().resolveFrame(input)
    const repeated = new CanvasFracturesRuntime().resolveFrame(input)

    expect(direct.transition?.source).toBe('manual')
    expect(direct.transition?.startSec).toBe(10)
    expect(direct).toEqual(repeated)
  })

  it('freezes automatic structural progress and releases toward the transport-derived identity', () => {
    const frozenInput = frameInput(40, {
      timelineInput: timelineInput(40, { freezeLayout: true, freezePositionSec: 7.5 }),
      runtimeSettings: {
        ...frameInput(40).runtimeSettings,
        freezeLayout: true,
        freezePositionSec: 7.5,
      },
    })
    const frozenAtForty = new CanvasFracturesRuntime().resolveFrame(frozenInput)
    const frozenAtNinety = new CanvasFracturesRuntime().resolveFrame({
      ...frozenInput,
      timelineInput: { ...frozenInput.timelineInput, positionSec: 90 },
    })
    const released = new CanvasFracturesRuntime().resolveFrame(frameInput(90, {
      runtimeSettings: {
        ...frameInput(90).runtimeSettings,
        freezePositionSec: 7.5,
        lastManualAction: 'releaseFreeze',
        manualTransitionPositionSec: 90,
      },
    }))

    expect(frozenAtNinety).toEqual(frozenAtForty)
    expect(released.topologyIdentity).not.toBe(frozenAtForty.topologyIdentity)
    expect(released.layoutIdentity).not.toBe(frozenAtForty.layoutIdentity)
    expect(released.transition?.source).toBe('freezeRelease')
  })

  it('keeps paused structural progress stable while completing manual actions coherently', () => {
    const paused = new CanvasFracturesRuntime().resolveFrame(frameInput(12.25, {
      isPlaying: false,
      isPaused: true,
    }))
    const samePaused = new CanvasFracturesRuntime().resolveFrame(frameInput(12.25, {
      isPlaying: false,
      isPaused: true,
    }))
    const manual = new CanvasFracturesRuntime().resolveFrame(frameInput(12.25, {
      runtimeSettings: {
        ...frameInput(12.25).runtimeSettings,
        topologyRevision: 1,
        layoutRevision: 1,
        lastManualAction: 'refracture',
        manualTransitionPositionSec: 12.25,
      },
      isPlaying: false,
      isPaused: true,
    }))

    expect(paused).toEqual(samePaused)
    expect(manual.topologyIdentity).not.toBe(paused.topologyIdentity)
    expect(manual.transition?.progress).toBe(1)
  })

  it('derives stable identity keys directly from absolute structural buckets and manual revisions', () => {
    const timeline = resolveCanvasFracturesTimeline(timelineInput(26.2, {
      topologyInterval: '8bars',
      layoutInterval: '4bars',
    }))
    expect(deriveCanvasFracturesPlanIdentityKeys(timeline, 2, 5)).toEqual({
      topologyIdentityKey: 'auto-topology:1|manual:2',
      layoutIdentityKey: 'auto-layout:3|manual:5',
    })
  })
})
