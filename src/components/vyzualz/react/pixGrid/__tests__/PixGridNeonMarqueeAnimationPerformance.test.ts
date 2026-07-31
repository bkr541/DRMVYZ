import { describe, expect, it } from 'vitest'
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
  PIX_GRID_NEON_MARQUEE_ASSET_ID,
  PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION,
  PIX_GRID_NEON_MARQUEE_SECTION_SUBDIVISIONS,
  resolvePixGridNeonMarqueePerformance,
} from '../PixGridNeonMarqueePerformance'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import { migratePixGridState } from '../PixGridStateMigration'
import type { PixGridAudioFrame } from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'
import {
  disposePixGridBaselineRenderer,
  renderPixGridCanvasFallback,
  type PixGridBaselineRenderFrame,
} from '../../renderers/pixGrid/PixGridBaselineRenderer'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const ASSET = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(PIX_GRID_NEON_MARQUEE_ASSET_ID)!

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
    ...overrides,
  })
}

function resolvedFrameIndex(overrides: Partial<PixGridAudioFrame>): number {
  return resolvePixGridNeonMarqueePerformance(frame(overrides)).frameIndex
}

describe('PixGrid Neon Marquee Cycle Stage 3 final hardening', () => {
  it('uses a documented section-local musical subdivision in every section', () => {
    expect(PIX_GRID_NEON_MARQUEE_SECTION_SUBDIVISIONS).toMatchObject({
      intro: expect.stringContaining('section-local'),
      verse: expect.stringContaining('section-local'),
      build: expect.stringContaining('section-local'),
      preDrop: expect.stringContaining('held'),
      drop: expect.stringContaining('section-local'),
      breakdown: expect.stringContaining('section-local'),
      outro: expect.stringContaining('section-local'),
    })
  })

  it('programs deterministic section-specific frame order from section-local clocks', () => {
    expect([0, 1, 2, 3].map(barsSinceSectionStart => resolvedFrameIndex({
      sectionType: 'intro',
      barIndex: 37 + barsSinceSectionStart,
      beatIndex: 148 + barsSinceSectionStart * 4,
      barsSinceSectionStart,
      beatsSinceSectionStart: barsSinceSectionStart * 4,
    }))).toEqual([0, 0, 0, 1])

    expect([0, 2, 4, 6].map(beatsSinceSectionStart => resolvedFrameIndex({
      sectionType: 'verse',
      beatIndex: 101 + beatsSinceSectionStart,
      barIndex: 25,
      beatsSinceSectionStart,
      barsSinceSectionStart: beatsSinceSectionStart / 4,
    }))).toEqual([0, 1, 0, 1])

    expect([0, 1, 2, 3].map(beatsSinceSectionStart => resolvedFrameIndex({
      sectionType: 'build',
      sectionProgress: 0.5,
      beatIndex: 73 + beatsSinceSectionStart,
      beatsSinceSectionStart,
      barsSinceSectionStart: beatsSinceSectionStart / 4,
    }))).toEqual([0, 1, 2, 3])
    expect([0, 0.5, 1, 1.5].map(beatsSinceSectionStart => resolvedFrameIndex({
      sectionType: 'build',
      sectionProgress: 0.8,
      beatIndex: 91 + Math.floor(beatsSinceSectionStart),
      beatPhase: beatsSinceSectionStart % 1,
      beatsSinceSectionStart,
      barsSinceSectionStart: beatsSinceSectionStart / 4,
    }))).toEqual([0, 1, 2, 3])

    expect([0.1, 0.5, 0.9].map(sectionProgress => resolvedFrameIndex({ sectionType: 'preDrop', sectionProgress })))
      .toEqual([0, 1, 2])

    expect([0, 1, 2, 3, 4].map(beatsSinceSectionStart => resolvedFrameIndex({
      sectionType: 'drop',
      beatIndex: 203 + beatsSinceSectionStart,
      beatsSinceSectionStart,
      barsSinceSectionStart: beatsSinceSectionStart / 4,
    }))).toEqual([0, 1, 2, 3, 0])

    expect([0, 1, 2, 3].map(barsSinceSectionStart => resolvedFrameIndex({
      sectionType: 'breakdown',
      barIndex: 61 + barsSinceSectionStart,
      beatIndex: 244 + barsSinceSectionStart * 4,
      barsSinceSectionStart,
      beatsSinceSectionStart: barsSinceSectionStart * 4,
    }))).toEqual([0, 3, 0, 3])

    expect(resolvedFrameIndex({ sectionType: 'outro', sectionProgress: 0.2, barsSinceSectionStart: 0 })).toBe(3)
    expect(resolvedFrameIndex({ sectionType: 'outro', sectionProgress: 0.2, barsSinceSectionStart: 1 })).toBe(0)
    expect(resolvedFrameIndex({ sectionType: 'outro', sectionProgress: 0.5, barsSinceSectionStart: 0 })).toBe(0)
  })

  it('resolves pause, seek, loop, stop, restart, and track replacement from transport position only', () => {
    const position = frame({
      sectionType: 'drop',
      beatIndex: 206,
      beatsSinceSectionStart: 2,
      barsSinceSectionStart: 0.5,
      beatPhase: 0.42,
      audioTime: 18.21,
    })
    const fresh = resolvePixGridNeonMarqueePerformance(position)
    expect(resolvePixGridNeonMarqueePerformance({ ...position, transportState: 'paused', isPlaying: false })).toEqual(fresh)

    resolvePixGridNeonMarqueePerformance(frame({
      sectionType: 'drop',
      beatIndex: 231,
      beatsSinceSectionStart: 27,
      barsSinceSectionStart: 6.75,
      audioTime: 70,
    }))
    expect(resolvePixGridNeonMarqueePerformance({ ...position, timingDiscontinuity: true })).toEqual(fresh)

    const loopStart = frame({
      sectionType: 'build',
      sectionProgress: 0.82,
      beatIndex: 112,
      beatsSinceSectionStart: 12.5,
      barsSinceSectionStart: 3.125,
      beatPhase: 0.5,
      audioTime: 24.25,
    })
    const loopResolved = resolvePixGridNeonMarqueePerformance(loopStart)
    resolvePixGridNeonMarqueePerformance(frame({
      sectionType: 'build',
      sectionProgress: 0.95,
      beatIndex: 119,
      beatsSinceSectionStart: 19,
      barsSinceSectionStart: 4.75,
      audioTime: 27.5,
    }))
    expect(resolvePixGridNeonMarqueePerformance({ ...loopStart, timingDiscontinuity: true })).toEqual(loopResolved)

    expect(resolvePixGridNeonMarqueePerformance(frame({ transportState: 'stopped', isPlaying: false, beatIndex: 27 })))
      .toEqual({ frameIndex: 0 })
    expect(resolvePixGridNeonMarqueePerformance(frame({
      trackIdentity: 'track-b',
      sectionType: 'intro',
      beatIndex: 300,
      barIndex: 75,
      beatsSinceSectionStart: 0,
      barsSinceSectionStart: 0,
    }))).toMatchObject({ frameIndex: 0 })
  })

  it('keeps exact native geometry, RGB values, and opaque alpha in the logical framebuffer', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
    const layer = preset.pixGridSettings!.layers![0]

    const resolved = [0, 1, 2, 3].map(beatsSinceSectionStart => resolvePixGridLayerAnimation(
      layer,
      ASSET,
      frame({ sectionType: 'drop', beatIndex: 100 + beatsSinceSectionStart, beatsSinceSectionStart, beatPhase: 0.5 }),
      0,
    ))

    expect(resolved.map(value => value.frameIndex)).toEqual([0, 1, 2, 3])
    expect(resolved.every(value => value.positionX === 0.5 && value.positionY === 0.5 && value.rotation === 0)).toBe(true)
    expect(resolved.every(value => value.scaleX === 1 && value.scaleY === 1 && value.opacity === 1)).toBe(true)

    const state = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset.pixGridSettings)
    const nativeFrames = getPixGridNeonMarqueeFrames()
    expect(nativeFrames).toHaveLength(4)
    expect(state.matrixWidth).toBe(PIX_GRID_NEON_MARQUEE_FRAME_WIDTH)
    expect(state.matrixHeight).toBe(PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT)

    for (let frameIndex = 0; frameIndex < nativeFrames.length; frameIndex += 1) {
      const audioFrame = frame({
        sectionType: 'drop',
        beatIndex: 400 + frameIndex,
        beatsSinceSectionStart: frameIndex,
        barsSinceSectionStart: frameIndex / 4,
        beatPhase: 0.5,
      })
      const logical = composePixGridLogicalFrame(preset, state, audioFrame)
      const source = nativeFrames[frameIndex]
      expect(logical.width).toBe(PIX_GRID_NEON_MARQUEE_FRAME_WIDTH)
      expect(logical.height).toBe(PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT)
      expect(logical.pixels).toHaveLength(PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT * 4)
      for (let cell = 0; cell < PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT; cell += 1) {
        const rgbOffset = cell * 3
        const rgbaOffset = cell * 4
        expect(logical.pixels[rgbaOffset]).toBe(source[rgbOffset])
        expect(logical.pixels[rgbaOffset + 1]).toBe(source[rgbOffset + 1])
        expect(logical.pixels[rgbaOffset + 2]).toBe(source[rgbOffset + 2])
        expect(logical.pixels[rgbaOffset + 3]).toBe(255)
      }
    }
  })

  it('prevents duplicate frame ownership from integrated clocks or noncanonical asset reuse', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
    const canonicalLayer = preset.pixGridSettings!.layers![0]
    const canonical = resolvePixGridLayerAnimation(
      canonicalLayer,
      ASSET,
      frame({
        sectionType: 'drop',
        beatIndex: 999,
        beatsSinceSectionStart: 2,
        motionClockBeat: 123.75,
        motionClockTime: 456,
      }),
      1,
    )
    expect(canonical.frameIndex).toBe(2)

    const customLayer = { ...canonicalLayer, id: 'custom-neon-copy' }
    const generic = resolvePixGridLayerAnimation(
      customLayer,
      ASSET,
      frame({ sectionType: 'verse', beatIndex: 2, beatsSinceSectionStart: 0 }),
      1,
    )
    expect(generic.frameIndex).toBe(2)
  })

  it('clears authored event envelopes on seek and stop', () => {
    const assignment = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!.pixGridSettings!.audioAssignments!
      .find(candidate => candidate.id === 'neon-marquee-kick-impact')!
    const runtime = new PixGridReactionRuntime()
    const fired = frame({
      audioTime: 8,
      beatIndex: 16,
      kickHit: true,
      sourceValues: { kick: 1 },
      confidence: { kick: 1 },
      bassReactivityGain: 1,
    })

    expect(runtime.resolve(assignment, fired).value).toBeGreaterThan(0)
    expect(runtime.resolve(assignment, { ...fired, audioTime: 8.08, kickHit: false, sourceValues: { kick: 0 } }).value).toBeGreaterThan(0)
    expect(runtime.resolve(assignment, {
      ...fired,
      audioTime: 3,
      beatIndex: 6,
      kickHit: false,
      sourceValues: { kick: 0 },
      timingDiscontinuity: true,
    }).value).toBe(0)
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

  it('gates low-confidence sources and preserves a visible bounded no-audio fallback', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
    const state = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset.pixGridSettings)
    const assignment = state.audioAssignments.find(candidate => candidate.id === 'neon-marquee-kick-impact')!

    const lowConfidence = new PixGridReactionRuntime().resolve(assignment, frame({
      sectionType: 'drop',
      kickHit: true,
      beatHit: false,
      sourceValues: { kick: 1, beat: 0 },
      confidence: { kick: 0 },
      capabilities: { kick: true, beat: true },
    })).value
    expect(lowConfidence).toBe(0)

    const safeFallback = new PixGridReactionRuntime().resolve(assignment, frame({
      sectionType: 'drop',
      kickHit: false,
      beatHit: true,
      sourceValues: { kick: 0, beat: 1 },
      confidence: { kick: 0 },
      capabilities: { kick: false, beat: true },
    })).value
    expect(Number.isFinite(safeFallback)).toBe(true)
    expect(safeFallback).toBeGreaterThan(0)
    expect(safeFallback).toBeLessThanOrEqual(assignment.outputRange?.[1] ?? 0)

    const silentFrame = createSilentPixGridAudioFrame({
      transportState: 'paused',
      isPlaying: false,
      sectionType: null,
      trackIdentity: null,
      timingDiscontinuity: true,
    })
    const logical = composePixGridLogicalFrame(preset, state, silentFrame, undefined, undefined, new PixGridReactionRuntime())
    let litCells = 0
    for (let offset = 0; offset < logical.pixels.length; offset += 4) {
      if (logical.pixels[offset] || logical.pixels[offset + 1] || logical.pixels[offset + 2]) litCells += 1
      expect(logical.pixels[offset + 3]).toBe(255)
    }
    expect(litCells).toBeGreaterThan(0)
  })

  it('attaches conservative output-brightness routes without taking Auto Performance ownership', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
    const current = createDefaultPixGridState()
    current.performance.enabled = false
    current.performance.sharedPerformanceProgramId = null
    const state = applyPixGridPresetSettings(current, PRESET_ID, preset.pixGridSettings)

    expect(state.configuration.presetConfigurationVersion).toBe(PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION)
    expect(state.performance.enabled).toBe(false)
    expect(state.performance.sharedPerformanceProgramId).toBeNull()
    expect(preset.params.bassReactivity).toBeGreaterThan(0)

    const expectedRanges = new Map<string, readonly [number, number]>([
      ['neon-marquee-bass-breath', [0, 0.012]],
      ['neon-marquee-build-lift', [0, 0.024]],
      ['neon-marquee-kick-impact', [0, 0.014]],
      ['neon-marquee-snare-edge', [0, 0.018]],
      ['neon-marquee-downbeat-structure', [0, 0.016]],
      ['neon-marquee-drop-impact', [0, 0.026]],
    ])
    expect(state.audioAssignments).toHaveLength(expectedRanges.size)
    for (const assignment of state.audioAssignments) {
      expect(assignment.target).toBe('brightness')
      expect(assignment.targetScope).toBe('output')
      expect(assignment.amount).toBe(1)
      expect(assignment.outputRange).toEqual(expectedRanges.get(assignment.id))
      expect(assignment.minimumConfidence).toBeGreaterThan(0)
      expect(assignment.conditions?.autoPerformanceOnly).not.toBe(true)
    }
    expect(state.audioAssignments.every(assignment => !['frameIndex', 'frameAdvance', 'scale', 'positionX', 'positionY', 'opacity'].includes(assignment.target))).toBe(true)
  })

  it('removes inherited shared performance ownership when migrating this explicitly static preset', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
    const applied = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset.pixGridSettings)
    const contaminated = {
      ...applied,
      configuration: {
        ...applied.configuration,
        presetConfigurationVersion: PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION - 1,
      },
      audioAssignments: applied.audioAssignments.map(assignment => ({
        ...assignment,
        amount: assignment.outputRange?.[1] ?? 0,
        minimumConfidence: 0,
        ...(assignment.id === 'neon-marquee-bass-breath' || assignment.id === 'neon-marquee-kick-impact'
          ? { target: 'scale' as const, targetScope: 'layer' as const, targetId: 'neon-marquee-frame' }
          : {}),
      })),
      performance: {
        ...applied.performance,
        enabled: true,
        sharedPerformanceProgramId: 'pix-grid-bass-beacon-performance',
      },
    }

    const migrated = migratePixGridState(contaminated, preset)
    expect(migrated.configuration.presetConfigurationVersion).toBe(PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION)
    expect(migrated.performance.enabled).toBe(false)
    expect(migrated.performance.sharedPerformanceProgramId).toBeNull()
    expect(migrated.audioAssignments.every(assignment => (
      assignment.target === 'brightness'
      && assignment.targetScope === 'output'
      && assignment.amount === 1
      && assignment.minimumConfidence > 0
    ))).toBe(true)
    expect(migrated.configuration.lastMigration?.programsUpgraded).toBe(1)

    const reactivePreset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
    const reactiveState = applyPixGridPresetSettings(createDefaultPixGridState(), reactivePreset.id, reactivePreset.pixGridSettings)
    const reactiveMigrated = migratePixGridState(reactiveState, reactivePreset)
    expect(reactiveMigrated.performance.enabled).toBe(true)
    expect(reactiveMigrated.performance.sharedPerformanceProgramId).toBe('pix-grid-bass-beacon-performance')
  })

  it('reuses Canvas fallback ImageData while preserving the same logical frame', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
    const state = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset.pixGridSettings)
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
    const renderFrame: PixGridBaselineRenderFrame = {
      ...frame({ sectionType: 'drop', beatsSinceSectionStart: 2, beatIndex: 202, beatPhase: 0.5 }),
      width: 640,
      height: 360,
      motion: 0,
      intensity: 1,
      glow: 0,
      bassReactivity: 0,
    }

    disposePixGridBaselineRenderer()
    const first = renderPixGridCanvasFallback(output, { canvas: logicalCanvas, context: logicalContext }, renderFrame, preset, state)
    const second = renderPixGridCanvasFallback(output, { canvas: logicalCanvas, context: logicalContext }, renderFrame, preset, state)
    expect(allocationCount).toBe(1)
    expect(second.logicalFrame.pixels).toEqual(first.logicalFrame.pixels)

    disposePixGridBaselineRenderer()
    renderPixGridCanvasFallback(output, { canvas: logicalCanvas, context: logicalContext }, renderFrame, preset, state)
    expect(allocationCount).toBe(2)
  })

  it('leaves generic frame-cycle behavior and existing preset configuration unchanged', () => {
    const existingPreset = PIX_GRID_PRESET_BY_ID.get('pix-grid-pixel-parade')!
    const existingLayer = existingPreset.pixGridSettings!.layers!.find(layer => layer.assetId === 'pix-equalizer-bars')!
    const existingAsset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get('pix-equalizer-bars')!

    expect(existingPreset.pixGridSettings!.authoredConfigurationVersion).toBe(8)
    expect([0, 2, 4, 6].map(beatIndex => resolvePixGridLayerAnimation(
      existingLayer,
      existingAsset,
      frame({ beatIndex, sectionType: 'drop' }),
      1,
    ).frameIndex)).toEqual([0, 1, 2, 3])
  })

  it('round-trips the Stage 3 preset through serialization without losing animation or routes', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
    const applied = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset.pixGridSettings)
    const restored = normalizePixGridState(JSON.parse(JSON.stringify(applied)))

    expect(restored.selectedPresetId).toBe(PRESET_ID)
    expect(restored.layers[0].animations).toEqual(applied.layers[0].animations)
    expect(restored.audioAssignments.map(assignment => assignment.id)).toEqual(applied.audioAssignments.map(assignment => assignment.id))
    expect(restored.performance.enabled).toBe(false)
    expect(restored.performance.sharedPerformanceProgramId).toBeNull()
  })
})
