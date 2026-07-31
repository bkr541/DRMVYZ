import { describe, expect, it } from 'vitest'
import { resolvePixGridAuthoredAssignmentState } from '../PixGridAssignmentApplication'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { createSilentPixGridAudioFrame, PixGridReactionRuntime } from '../PixGridAudioRouting'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT,
  PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT,
  PIX_GRID_NEON_MARQUEE_FRAME_WIDTH,
  getPixGridNeonMarqueeFrames,
} from '../PixGridNeonMarqueeFrames'
import {
  PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION,
  PIX_GRID_NEON_MARQUEE_SECTION_SUBDIVISIONS,
  resolvePixGridNeonMarqueePerformance,
} from '../PixGridNeonMarqueePerformance'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridRuntimeControls, PixGridMotionClock } from '../PixGridRuntimeControls'
import { applyPixGridPresetSettings } from '../PixGridState'
import { migratePixGridState } from '../PixGridStateMigration'
import type { PixGridAudioFrame, PixGridState } from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'
import {
  disposePixGridBaselineRenderer,
  renderPixGridCanvasFallback,
  type PixGridBaselineRenderFrame,
} from '../../renderers/pixGrid/PixGridBaselineRenderer'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const PRESET = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!

function frame(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  return createSilentPixGridAudioFrame({
    audioTime: 0,
    beatHit: false,
    beatPhase: 0,
    isPlaying: true,
    beatIndex: 0,
    barIndex: 0,
    beatsSinceSectionStart: 0,
    barsSinceSectionStart: 0,
    sectionType: 'drop',
    sectionProgress: 0,
    transportState: 'playing',
    trackIdentity: 'track-a',
    autoPerformanceEnabled: false,
    ...overrides,
  })
}

function clocked(
  clock: PixGridMotionClock,
  motion: number,
  overrides: Partial<PixGridAudioFrame>,
): PixGridAudioFrame {
  return clock.apply(applyPixGridRuntimeControls(frame(overrides), { bassReactivity: 1, motion }))
}

function frameIndex(audioFrame: PixGridAudioFrame, sceneMotionMultiplier = 1): number {
  return resolvePixGridNeonMarqueePerformance(audioFrame, sceneMotionMultiplier).frameIndex
}

function presetState(enabled: boolean): PixGridState {
  const current = createDefaultPixGridState()
  current.performance.enabled = enabled
  current.performance.sharedPerformanceProgramId = enabled ? 'pix-grid-bass-beacon-performance' : null
  const applied = applyPixGridPresetSettings(current, PRESET_ID, PRESET.pixGridSettings)
  return { ...applied, selectedSceneId: `${PRESET_ID}-drop` }
}

function eventFrame(overrides: Partial<PixGridAudioFrame>): PixGridAudioFrame {
  return frame({
    autoPerformanceEnabled: true,
    sectionType: 'drop',
    sectionProgress: 0.6,
    beatIndex: 32,
    barIndex: 8,
    beatsSinceSectionStart: 0,
    barsSinceSectionStart: 0,
    audioTime: 8,
    sourceValues: {
      beat: 0,
      kick: 0,
      snare: 0,
      bass: 0,
      downbeat: 0,
      dropImpact: 0,
      buildProgress: 0,
    },
    ...overrides,
  })
}

function renderWith(frameValue: PixGridAudioFrame, state = presetState(true)): Uint8Array {
  return composePixGridLogicalFrame(
    PRESET,
    state,
    frameValue,
    undefined,
    undefined,
    new PixGridReactionRuntime(),
  ).pixels
}

function perceptuallyChangedCellCount(a: Uint8Array, b: Uint8Array): number {
  let changed = 0
  for (let offset = 0; offset < Math.min(a.length, b.length); offset += 4) {
    const dr = Math.abs(a[offset] - b[offset])
    const dg = Math.abs(a[offset + 1] - b[offset + 1])
    const db = Math.abs(a[offset + 2] - b[offset + 2])
    const colorDistance = Math.sqrt(dr * dr + dg * dg + db * db)
    if (Math.max(dr, dg, db) >= 10 || colorDistance >= 16) changed += 1
  }
  return changed
}

function resolvedLayerScale(state: PixGridState, audioFrame: PixGridAudioFrame, runtime = new PixGridReactionRuntime()): number {
  runtime.beginFrame(audioFrame)
  const resolved = resolvePixGridAuthoredAssignmentState(state, audioFrame, runtime)
  return resolved.layers.find(layer => layer.id === 'marquee-structure')!.scale.x
}

describe('PixGrid Neon Marquee motion, audio, and Auto Performance correction', () => {
  it('keeps the authored section choreography and canonical forward order', () => {
    expect(PIX_GRID_NEON_MARQUEE_SECTION_SUBDIVISIONS).toMatchObject({
      intro: expect.stringContaining('section-local'),
      verse: expect.stringContaining('section-local'),
      build: expect.stringContaining('section-local'),
      preDrop: expect.stringContaining('held'),
      drop: expect.stringContaining('section-local'),
      breakdown: expect.stringContaining('section-local'),
      outro: expect.stringContaining('section-local'),
    })

    expect([0, 1, 2, 3, 4].map(beatsSinceSectionStart => frameIndex(frame({
      sectionType: 'drop',
      beatsSinceSectionStart,
      barsSinceSectionStart: beatsSinceSectionStart / 4,
    })))).toEqual([0, 1, 2, 3, 0])
    expect([0, 2, 4, 6].map(beatsSinceSectionStart => frameIndex(frame({
      sectionType: 'verse',
      beatsSinceSectionStart,
      barsSinceSectionStart: beatsSinceSectionStart / 4,
    })))).toEqual([0, 1, 0, 1])
  })

  it('freezes the active frame at Motion 0 and resumes without a phase jump', () => {
    const clock = new PixGridMotionClock()
    const beforeFreeze = clocked(clock, 1, {
      audioTime: 1.2,
      beatIndex: 1,
      beatPhase: 0.2,
      beatsSinceSectionStart: 1.2,
      barsSinceSectionStart: 0.3,
    })
    expect(frameIndex(beforeFreeze)).toBe(1)

    const frozen = [2.2, 3.2, 4.2].map(value => clocked(clock, 0, {
      audioTime: value,
      beatIndex: Math.floor(value),
      beatPhase: value % 1,
      beatsSinceSectionStart: value,
      barsSinceSectionStart: value / 4,
    }))
    expect(frozen.map(value => frameIndex(value))).toEqual([1, 1, 1])

    const resumed = clocked(clock, 1, {
      audioTime: 4.7,
      beatIndex: 4,
      beatPhase: 0.7,
      beatsSinceSectionStart: 4.7,
      barsSinceSectionStart: 1.175,
    })
    expect(resumed.motionClockSectionBeat).toBeCloseTo(1.7, 5)
    expect(frameIndex(resumed)).toBe(1)
  })

  it('holds the active choreography identity across section changes while Motion is 0', () => {
    const clock = new PixGridMotionClock()
    const drop = clocked(clock, 1, {
      sectionType: 'drop',
      sectionOccurrence: 0,
      audioTime: 3.2,
      beatIndex: 3,
      beatPhase: 0.2,
      beatsSinceSectionStart: 3.2,
      barsSinceSectionStart: 0.8,
    })
    expect(frameIndex(drop)).toBe(3)

    const frozenBreakdown = clocked(clock, 0, {
      sectionType: 'breakdown',
      sectionOccurrence: 1,
      audioTime: 4.2,
      beatIndex: 4,
      beatPhase: 0.2,
      beatsSinceSectionStart: 0.2,
      barsSinceSectionStart: 0.05,
    })
    expect(frozenBreakdown.motionClockSectionType).toBe('drop')
    expect(frameIndex(frozenBreakdown)).toBe(3)

    const resumedBreakdown = clocked(clock, 1, {
      sectionType: 'breakdown',
      sectionOccurrence: 1,
      audioTime: 4.7,
      beatIndex: 4,
      beatPhase: 0.7,
      beatsSinceSectionStart: 0.7,
      barsSinceSectionStart: 0.175,
    })
    expect(resumedBreakdown.motionClockSectionType).toBe('breakdown')
    expect(frameIndex(resumedBreakdown)).toBe(0)
  })

  it('scales progression proportionally at Motion 0.5, 1, and above 1', () => {
    const half = new PixGridMotionClock()
    const normal = new PixGridMotionClock()
    const fast = new PixGridMotionClock()
    clocked(half, 0.5, { audioTime: 0, beatsSinceSectionStart: 0 })
    clocked(normal, 1, { audioTime: 0, beatsSinceSectionStart: 0 })
    clocked(fast, 2, { audioTime: 0, beatsSinceSectionStart: 0 })

    const halfFrame = clocked(half, 0.5, { audioTime: 2, beatIndex: 2, beatsSinceSectionStart: 2, barsSinceSectionStart: 0.5 })
    const normalFrame = clocked(normal, 1, { audioTime: 2, beatIndex: 2, beatsSinceSectionStart: 2, barsSinceSectionStart: 0.5 })
    const fastFrame = clocked(fast, 2, { audioTime: 2, beatIndex: 2, beatsSinceSectionStart: 2, barsSinceSectionStart: 0.5 })

    expect(halfFrame.motionClockSectionBeat).toBeCloseTo(1, 5)
    expect(normalFrame.motionClockSectionBeat).toBeCloseTo(2, 5)
    expect(fastFrame.motionClockSectionBeat).toBeCloseTo(4, 5)
    expect([frameIndex(halfFrame), frameIndex(normalFrame), frameIndex(fastFrame)]).toEqual([1, 2, 0])
    expect(frameIndex(normalFrame, 0.5)).toBe(1)
    expect(frameIndex(normalFrame, 2)).toBe(0)
  })

  it('holds while paused and reconstructs seeks, loops, restarts, and track changes deterministically', () => {
    const clock = new PixGridMotionClock()
    const active = clocked(clock, 1, {
      audioTime: 2.4,
      beatIndex: 2,
      beatPhase: 0.4,
      beatsSinceSectionStart: 2.4,
      barsSinceSectionStart: 0.6,
    })
    const paused = clocked(clock, 1, {
      audioTime: 9,
      beatIndex: 9,
      beatsSinceSectionStart: 9,
      barsSinceSectionStart: 2.25,
      transportState: 'paused',
      isPlaying: false,
    })
    expect(paused.motionClockSectionBeat).toBe(active.motionClockSectionBeat)
    expect(frameIndex(paused)).toBe(frameIndex(active))

    const seekTarget = {
      audioTime: 6.5,
      beatIndex: 6,
      beatPhase: 0.5,
      beatsSinceSectionStart: 6.5,
      barsSinceSectionStart: 1.625,
      timingDiscontinuity: true,
    } satisfies Partial<PixGridAudioFrame>
    const firstSeek = clocked(clock, 1, seekTarget)
    clocked(clock, 1, { audioTime: 12, beatIndex: 12, beatsSinceSectionStart: 12, barsSinceSectionStart: 3 })
    const repeatedSeek = clocked(clock, 1, seekTarget)
    expect(repeatedSeek.motionClockSectionBeat).toBe(firstSeek.motionClockSectionBeat)
    expect(frameIndex(repeatedSeek)).toBe(frameIndex(firstSeek))

    const loopStart = clocked(clock, 1, {
      audioTime: 1,
      beatIndex: 1,
      beatsSinceSectionStart: 1,
      barsSinceSectionStart: 0.25,
      timingDiscontinuity: true,
    })
    clocked(clock, 1, { audioTime: 4, beatIndex: 4, beatsSinceSectionStart: 4, barsSinceSectionStart: 1 })
    const repeatedLoopStart = clocked(clock, 1, {
      audioTime: 1,
      beatIndex: 1,
      beatsSinceSectionStart: 1,
      barsSinceSectionStart: 0.25,
      timingDiscontinuity: true,
    })
    expect(repeatedLoopStart.motionClockSectionBeat).toBe(loopStart.motionClockSectionBeat)
    expect(frameIndex(repeatedLoopStart)).toBe(frameIndex(loopStart))

    clock.reset('track-b')
    const replacement = clocked(clock, 1, {
      trackIdentity: 'track-b',
      sectionType: 'intro',
      audioTime: 0,
      beatIndex: 0,
      beatsSinceSectionStart: 0,
      barsSinceSectionStart: 0,
      timingDiscontinuity: true,
    })
    expect(replacement.motionClockSectionBeat).toBe(0)
    expect(frameIndex(replacement)).toBe(0)
  })

  it('uses the same integrated generic frame clock for canonical and copied component layers', () => {
    const canonicalLayer = PRESET.pixGridSettings!.layers![0]
    const asset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(canonicalLayer.assetId)!
    const clockFrame = frame({
      sectionType: 'drop',
      beatIndex: 999,
      beatsSinceSectionStart: 2,
      motionClockBeat: 3,
      motionClockSectionBeat: 123.75,
      motionClockTime: 456,
    })
    const canonical = resolvePixGridLayerAnimation(canonicalLayer, asset, clockFrame, 1)
    const copied = resolvePixGridLayerAnimation({ ...canonicalLayer, id: 'custom-neon-copy' }, asset, clockFrame, 1)
    expect(canonical.frameIndex).toBe(3)
    expect(copied).toEqual(canonical)
  })

  it('preserves native frame geometry and pixels when Auto Performance is off', () => {
    const layer = PRESET.pixGridSettings!.layers![0]
    const state = presetState(false)
    const nativeFrames = getPixGridNeonMarqueeFrames()

    expect(state.matrixWidth).toBe(PIX_GRID_NEON_MARQUEE_FRAME_WIDTH)
    expect(state.matrixHeight).toBe(PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT)
    expect(nativeFrames).toHaveLength(4)

    for (let index = 0; index < nativeFrames.length; index += 1) {
      const audioFrame = frame({
        autoPerformanceEnabled: false,
        sectionType: 'drop',
        beatIndex: index,
        motionClockBeat: index,
        beatsSinceSectionStart: index,
        barsSinceSectionStart: index / 4,
      })
      const asset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!
      const resolved = resolvePixGridLayerAnimation(layer, asset, audioFrame, 1)
      expect(resolved).toMatchObject({
        frameIndex: index,
        positionX: 0.5,
        positionY: 0.5,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
      })

      const logical = composePixGridLogicalFrame(PRESET, state, audioFrame)
      const source = nativeFrames[index]
      expect(logical.pixels).toHaveLength(PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT * 4)
      for (let cell = 0; cell < PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT; cell += 1) {
        const rgb = cell * 3
        const rgba = cell * 4
        expect(logical.pixels[rgba]).toBe(source[rgb])
        expect(logical.pixels[rgba + 1]).toBe(source[rgb + 1])
        expect(logical.pixels[rgba + 2]).toBe(source[rgb + 2])
        const nonBlack = source[rgb] !== 0 || source[rgb + 1] !== 0 || source[rgb + 2] !== 0
        expect(logical.pixels[rgba + 3]).toBe(nonBlack ? 255 : 0)
      }
    }
  })

  it('produces visible bounded kick, snare, downbeat, build, and drop reactions', () => {
    const state = presetState(true)
    const baseDrop = renderWith(eventFrame({}), state)
    const kick = renderWith(eventFrame({ kickHit: true, beatHit: true, sourceValues: { kick: 1, beat: 1 } }), state)
    const snare = renderWith(eventFrame({ snareHit: true, beatHit: true, transientHit: true, sourceValues: { snare: 1, beat: 1, transient: 1 } }), state)
    const downbeat = renderWith(eventFrame({ downbeatHit: true, beatHit: true, sourceValues: { downbeat: 1, beat: 1 } }), state)
    const drop = renderWith(eventFrame({ dropImpactHit: true, transientHit: true, sourceValues: { dropImpact: 1, transient: 1 } }), state)

    expect(perceptuallyChangedCellCount(baseDrop, kick)).toBeGreaterThan(50)
    expect(perceptuallyChangedCellCount(baseDrop, snare)).toBeGreaterThan(50)
    expect(perceptuallyChangedCellCount(baseDrop, downbeat)).toBeGreaterThan(50)
    expect(perceptuallyChangedCellCount(baseDrop, drop)).toBeGreaterThan(perceptuallyChangedCellCount(baseDrop, snare))

    const buildBase = renderWith(eventFrame({ sectionType: 'build', sectionProgress: 0.1, buildProgress: 0.1, sourceValues: { buildProgress: 0.1 } }), state)
    const buildPeak = renderWith(eventFrame({ sectionType: 'build', sectionProgress: 0.92, buildProgress: 0.92, sourceValues: { buildProgress: 0.92 } }), state)
    expect(perceptuallyChangedCellCount(buildBase, buildPeak)).toBeGreaterThan(50)
  })

  it('keeps bass smoothing and combined transform peaks inside the authored scale budget', () => {
    const state = presetState(true)
    const runtime = new PixGridReactionRuntime()
    const silence = eventFrame({ sectionType: 'verse', audioTime: 1, bass: 0, sourceValues: { bass: 0 } })
    const bassStart = eventFrame({ sectionType: 'verse', audioTime: 1.016, bass: 1, sourceValues: { bass: 1 } })
    const bassLater = eventFrame({ sectionType: 'verse', audioTime: 1.25, bass: 1, sourceValues: { bass: 1 } })
    const baseScale = resolvedLayerScale(state, silence, runtime)
    const startScale = resolvedLayerScale(state, bassStart, runtime)
    const laterScale = resolvedLayerScale(state, bassLater, runtime)
    expect(startScale).toBeGreaterThanOrEqual(baseScale)
    expect(laterScale).toBeGreaterThan(startScale)
    expect(laterScale).toBeLessThanOrEqual(1.015001)

    const peak = eventFrame({
      audioTime: 3,
      bass: 1,
      kickHit: true,
      downbeatHit: true,
      dropImpactHit: true,
      beatHit: true,
      transientHit: true,
      sourceValues: { bass: 1, kick: 1, downbeat: 1, dropImpact: 1, beat: 1, transient: 1 },
    })
    const peakScale = resolvedLayerScale(state, peak)
    expect(Number.isFinite(peakScale)).toBe(true)
    expect(peakScale).toBeGreaterThan(1.06)
    expect(peakScale).toBeLessThanOrEqual(1.1)
  })

  it('gates every marquee reaction behind Auto Performance without stopping frame cycling', () => {
    const stateOff = presetState(false)
    const stateOn = presetState(true)
    expect(stateOff.performance.enabled).toBe(false)
    expect(stateOn.performance.enabled).toBe(true)
    expect(stateOff.performance.sharedPerformanceProgramId).toBeNull()
    expect(stateOn.performance.sharedPerformanceProgramId).toBeNull()
    expect(stateOn.audioAssignments.every(assignment => assignment.conditions?.autoPerformanceOnly === true)).toBe(true)

    const eventOn = eventFrame({ kickHit: true, sourceValues: { kick: 1 } })
    const eventOff = { ...eventOn, autoPerformanceEnabled: false }
    expect(resolvedLayerScale(stateOn, eventOff)).toBe(1)
    expect(resolvedLayerScale(stateOn, eventOn)).toBeGreaterThan(1)
    expect(frameIndex({ ...eventOff, beatsSinceSectionStart: 2 })).toBe(2)
  })

  it('clears active envelopes when Auto Performance is disabled and does not replay stale events', () => {
    const assignment = presetState(true).audioAssignments.find(candidate => candidate.id === 'neon-marquee-kick-impact')!
    const runtime = new PixGridReactionRuntime()
    const fired = eventFrame({ audioTime: 8, kickHit: true, sourceValues: { kick: 1 } })
    expect(runtime.resolve(assignment, fired).value).toBeGreaterThan(0)
    expect(runtime.resolve(assignment, eventFrame({ audioTime: 8.08, kickHit: false, sourceValues: { kick: 0 } })).value).toBeGreaterThan(0)

    const disabled = eventFrame({ audioTime: 8.09, autoPerformanceEnabled: false, kickHit: false, sourceValues: { kick: 0 } })
    expect(runtime.resolve(assignment, disabled).value).toBe(0)
    const reenabled = eventFrame({ audioTime: 8.1, autoPerformanceEnabled: true, kickHit: false, sourceValues: { kick: 0 } })
    expect(runtime.resolve(assignment, reenabled).value).toBe(0)

    expect(runtime.resolve(assignment, { ...fired, audioTime: 9, timingDiscontinuity: true, kickHit: false, sourceValues: { kick: 0 } }).value).toBe(0)
    expect(runtime.resolve(assignment, {
      ...fired,
      audioTime: 0,
      beatIndex: 0,
      kickHit: false,
      sourceValues: { kick: 0 },
      timingDiscontinuity: true,
      transportState: 'stopped',
      isPlaying: false,
    }).value).toBe(0)
  })

  it('preserves the user toggle while clearing inherited program ownership on selection and migration', () => {
    for (const enabled of [false, true]) {
      const applied = presetState(enabled)
      expect(applied.performance.enabled).toBe(enabled)
      expect(applied.performance.sharedPerformanceProgramId).toBeNull()

      const contaminated = {
        ...applied,
        configuration: {
          ...applied.configuration,
          presetConfigurationVersion: PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION - 1,
        },
        performance: {
          ...applied.performance,
          enabled,
          sharedPerformanceProgramId: 'pix-grid-bass-beacon-performance',
        },
      }
      const migrated = migratePixGridState(contaminated, PRESET)
      expect(migrated.configuration.presetConfigurationVersion).toBe(PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION)
      expect(migrated.performance.enabled).toBe(enabled)
      expect(migrated.performance.sharedPerformanceProgramId).toBeNull()
      expect(migrated.audioAssignments.every(assignment => assignment.conditions?.autoPerformanceOnly === true)).toBe(true)
    }

    const reactivePreset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
    const reactiveState = applyPixGridPresetSettings(createDefaultPixGridState(), reactivePreset.id, reactivePreset.pixGridSettings)
    const reactiveMigrated = migratePixGridState(reactiveState, reactivePreset)
    expect(reactiveMigrated.performance.enabled).toBe(true)
    expect(reactiveMigrated.performance.sharedPerformanceProgramId).toBe('pix-grid-bass-beacon-performance')
  })

  it('keeps low-confidence, silence, and stop states safe', () => {
    const state = presetState(true)
    const assignment = state.audioAssignments.find(candidate => candidate.id === 'neon-marquee-kick-impact')!
    const lowConfidence = new PixGridReactionRuntime().resolve(assignment, eventFrame({
      kickHit: true,
      sourceValues: { kick: 1 },
      confidence: { kick: 0 },
      capabilities: { kick: true },
    })).value
    expect(lowConfidence).toBe(0)

    const silent = eventFrame({
      autoPerformanceEnabled: true,
      bass: 0,
      kickHit: false,
      snareHit: false,
      downbeatHit: false,
      dropImpactHit: false,
      sourceValues: { bass: 0, kick: 0, snare: 0, downbeat: 0, dropImpact: 0 },
    })
    expect(resolvedLayerScale(state, silent)).toBe(1)
    const logical = renderWith(silent, state)
    expect(logical.every(value => Number.isFinite(value))).toBe(true)
  })

  it('keeps Canvas fallback logical state equivalent and reuses its ImageData allocation', () => {
    const state = presetState(true)
    const logicalCanvas = { width: 0, height: 0 } as HTMLCanvasElement
    let allocationCount = 0
    const logicalContext = {
      createImageData(width: number, height: number) {
        allocationCount += 1
        return { width, height, data: new Uint8ClampedArray(width * height * 4) } as ImageData
      },
      putImageData() {},
    } as unknown as CanvasRenderingContext2D
    const output = {
      save() {},
      restore() {},
      clearRect() {},
      fillRect() {},
      drawImage() {},
      strokeRect() {},
    } as unknown as CanvasRenderingContext2D
    const audioFrame = eventFrame({
      beatsSinceSectionStart: 2,
      beatIndex: 202,
      kickHit: true,
      sourceValues: { kick: 1 },
      motionClockSectionBeat: 2,
    })
    const renderFrame: PixGridBaselineRenderFrame = {
      ...audioFrame,
      width: 640,
      height: 360,
      motion: 1,
      intensity: 1,
      glow: 0,
      bassReactivity: 1,
    }

    disposePixGridBaselineRenderer()
    const first = renderPixGridCanvasFallback(output, { canvas: logicalCanvas, context: logicalContext }, renderFrame, PRESET, state)
    const second = renderPixGridCanvasFallback(output, { canvas: logicalCanvas, context: logicalContext }, renderFrame, PRESET, state)
    expect(allocationCount).toBe(1)
    expect(second.logicalFrame.pixels).toEqual(first.logicalFrame.pixels)
    expect(resolvePixGridLayerAnimation(state.layers[0], PIX_GRID_BUILT_IN_ASSET_BY_ID.get(state.layers[0].assetId)!, audioFrame, 1).frameIndex).toBe(2)

    disposePixGridBaselineRenderer()
    renderPixGridCanvasFallback(output, { canvas: logicalCanvas, context: logicalContext }, renderFrame, PRESET, state)
    expect(allocationCount).toBe(2)
  })

  it('leaves generic frame-cycle behavior and existing preset ownership unchanged', () => {
    const existingPreset = PIX_GRID_PRESET_BY_ID.get('pix-grid-pixel-parade')!
    const existingLayer = existingPreset.pixGridSettings!.layers!.find(layer => layer.assetId === 'pix-equalizer-bars')!
    const existingAsset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get('pix-equalizer-bars')!

    expect(existingPreset.pixGridSettings!.authoredConfigurationVersion).toBe(8)
    expect([0, 2, 4, 6].map(beatIndex => resolvePixGridLayerAnimation(
      existingLayer,
      existingAsset,
      frame({ beatIndex, sectionType: 'drop', motionClockBeat: beatIndex }),
      1,
    ).frameIndex)).toEqual([0, 1, 2, 3])
    expect(existingPreset.pixGridSettings!.performanceProgramId).toBe('pix-grid-pixel-parade-performance')
  })

  it('round-trips the corrected preset without losing nullable ownership or gated routes', () => {
    const applied = presetState(true)
    const restored = normalizePixGridState(JSON.parse(JSON.stringify(applied)))

    expect(restored.selectedPresetId).toBe(PRESET_ID)
    expect(restored.layers[0].animations).toEqual(applied.layers[0].animations)
    expect(restored.audioAssignments.map(assignment => assignment.id)).toEqual(applied.audioAssignments.map(assignment => assignment.id))
    expect(restored.audioAssignments.every(assignment => assignment.conditions?.autoPerformanceOnly === true)).toBe(true)
    expect(restored.performance.enabled).toBe(true)
    expect(restored.performance.sharedPerformanceProgramId).toBeNull()
  })
})
