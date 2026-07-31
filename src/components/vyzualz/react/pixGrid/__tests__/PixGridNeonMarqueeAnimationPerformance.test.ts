import { describe, expect, it } from 'vitest'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { PixGridReactionRuntime } from '../PixGridAudioRouting'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  PIX_GRID_NEON_MARQUEE_ASSET_ID,
  PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION,
  PIX_GRID_NEON_MARQUEE_SECTION_SUBDIVISIONS,
  resolvePixGridNeonMarqueePerformance,
} from '../PixGridNeonMarqueePerformance'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import type { PixGridAudioFrame } from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const ASSET = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(PIX_GRID_NEON_MARQUEE_ASSET_ID)!

function frame(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  return {
    audioTime: 0,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0,
    isPlaying: true,
    beatIndex: 0,
    barIndex: 0,
    sectionType: 'drop',
    sectionProgress: 0,
    transportState: 'playing',
    trackIdentity: 'track-a',
    ...overrides,
  }
}

function resolvedFrameIndex(overrides: Partial<PixGridAudioFrame>): number {
  return resolvePixGridNeonMarqueePerformance(frame(overrides)).frameIndex
}

describe('PixGrid Neon Marquee Cycle Stage 2 performance', () => {
  it('uses the documented musical subdivision in every section', () => {
    expect(PIX_GRID_NEON_MARQUEE_SECTION_SUBDIVISIONS).toMatchObject({
      intro: expect.stringContaining('bar'),
      verse: 'two beats',
      build: expect.stringContaining('half-beat'),
      preDrop: expect.stringContaining('held'),
      drop: 'one beat',
      breakdown: 'one bar',
      outro: expect.stringContaining('held on Base'),
    })
  })

  it('programs deterministic section-specific frame order without interpolation', () => {
    expect([0, 1, 2, 3].map(barIndex => resolvedFrameIndex({ sectionType: 'intro', barIndex, beatIndex: barIndex * 4 })))
      .toEqual([0, 0, 0, 1])

    expect([0, 2, 4, 6].map(beatIndex => resolvedFrameIndex({ sectionType: 'verse', beatIndex })))
      .toEqual([0, 1, 0, 1])

    expect([0, 1, 2, 3].map(beatIndex => resolvedFrameIndex({ sectionType: 'build', sectionProgress: 0.5, beatIndex })))
      .toEqual([0, 1, 2, 3])
    expect([0, 0.5, 1, 1.5].map(position => resolvedFrameIndex({
      sectionType: 'build',
      sectionProgress: 0.8,
      beatIndex: Math.floor(position),
      beatPhase: position % 1,
    }))).toEqual([0, 1, 2, 3])

    expect([0.1, 0.5, 0.9].map(sectionProgress => resolvedFrameIndex({ sectionType: 'preDrop', sectionProgress })))
      .toEqual([0, 1, 2])

    expect([0, 1, 2, 3, 4].map(beatIndex => resolvedFrameIndex({ sectionType: 'drop', beatIndex })))
      .toEqual([0, 1, 2, 3, 0])

    expect([0, 1, 2, 3].map(barIndex => resolvedFrameIndex({ sectionType: 'breakdown', barIndex, beatIndex: barIndex * 4 })))
      .toEqual([0, 3, 0, 3])

    expect(resolvedFrameIndex({ sectionType: 'outro', sectionProgress: 0.2, barIndex: 0 })).toBe(3)
    expect(resolvedFrameIndex({ sectionType: 'outro', sectionProgress: 0.2, barIndex: 1 })).toBe(0)
    expect(resolvedFrameIndex({ sectionType: 'outro', sectionProgress: 0.5, barIndex: 0 })).toBe(0)
  })

  it('resolves pause, seek, loop, stop, restart, and track replacement from transport position only', () => {
    const position = frame({ sectionType: 'drop', beatIndex: 6, beatPhase: 0.42, audioTime: 18.21 })
    const fresh = resolvePixGridNeonMarqueePerformance(position)
    expect(resolvePixGridNeonMarqueePerformance({ ...position, transportState: 'paused', isPlaying: false })).toEqual(fresh)

    resolvePixGridNeonMarqueePerformance(frame({ sectionType: 'drop', beatIndex: 31, audioTime: 70 }))
    expect(resolvePixGridNeonMarqueePerformance({ ...position, timingDiscontinuity: true })).toEqual(fresh)

    const loopStart = frame({ sectionType: 'build', sectionProgress: 0.82, beatIndex: 12, beatPhase: 0.5, audioTime: 24.25 })
    const loopResolved = resolvePixGridNeonMarqueePerformance(loopStart)
    resolvePixGridNeonMarqueePerformance(frame({ sectionType: 'build', sectionProgress: 0.95, beatIndex: 19, audioTime: 27.5 }))
    expect(resolvePixGridNeonMarqueePerformance({ ...loopStart, timingDiscontinuity: true })).toEqual(loopResolved)

    expect(resolvePixGridNeonMarqueePerformance(frame({ transportState: 'stopped', isPlaying: false, beatIndex: 27 })))
      .toEqual({ frameIndex: 0, scaleMultiplier: 1, opacityMultiplier: 1 })
    expect(resolvePixGridNeonMarqueePerformance(frame({ trackIdentity: 'track-b', sectionType: 'intro', beatIndex: 0, barIndex: 0 }))).toMatchObject({ frameIndex: 0 })
  })

  it('keeps frame identity and bounded transform in the shared logical compositor path', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
    const layer = preset.pixGridSettings!.layers![0]

    const resolved = [0, 1, 2, 3].map(beatIndex => resolvePixGridLayerAnimation(
      layer,
      ASSET,
      frame({ sectionType: 'drop', beatIndex, beatPhase: 0 }),
      0,
    ))

    expect(resolved.map(value => value.frameIndex)).toEqual([0, 1, 2, 3])
    expect(resolved.every(value => value.positionX === 0.5 && value.positionY === 0.5 && value.rotation === 0)).toBe(true)
    expect(Math.max(...resolved.map(value => value.scaleX))).toBeLessThanOrEqual(1.042)
    expect(resolved[2].scaleX).toBeGreaterThan(resolved[1].scaleX)
    expect(resolved[2].opacity).toBe(1)
    expect(resolved[0].opacity).toBe(0.96)
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

  it('attaches conservative audio routes without taking Auto Performance ownership', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
    const current = createDefaultPixGridState()
    current.performance.enabled = false
    current.performance.sharedPerformanceProgramId = null
    const state = applyPixGridPresetSettings(current, PRESET_ID, preset.pixGridSettings)

    expect(state.configuration.presetConfigurationVersion).toBe(PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION)
    expect(state.performance.enabled).toBe(false)
    expect(state.performance.sharedPerformanceProgramId).toBeNull()
    expect(preset.params.bassReactivity).toBeGreaterThan(0)

    const byId = new Map(state.audioAssignments.map(assignment => [assignment.id, assignment]))
    expect(byId.get('neon-marquee-bass-breath')).toMatchObject({ source: 'bass', target: 'scale', targetScope: 'layer', outputRange: [0, 0.02] })
    expect(byId.get('neon-marquee-kick-impact')).toMatchObject({ source: 'kick', target: 'scale', outputRange: [0, 0.03] })
    expect(byId.get('neon-marquee-snare-edge')).toMatchObject({ source: 'snare', target: 'brightness', outputRange: [0, 0.08] })
    expect(byId.get('neon-marquee-downbeat-structure')).toMatchObject({ source: 'downbeat', target: 'brightness', outputRange: [0, 0.1] })
    expect(byId.get('neon-marquee-drop-impact')).toMatchObject({ source: 'dropImpact', target: 'brightness', outputRange: [0, 0.16] })
    expect(state.audioAssignments.every(assignment => assignment.target !== 'frameIndex' && assignment.target !== 'frameAdvance')).toBe(true)
    expect(state.audioAssignments.every(assignment => assignment.conditions?.autoPerformanceOnly !== true)).toBe(true)
  })

  it('leaves the generic frame-cycle behavior and configuration version of existing presets unchanged', () => {
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

  it('round-trips the Stage 2 preset through state serialization without losing animation or routes', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
    const applied = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset.pixGridSettings)
    const restored = normalizePixGridState(JSON.parse(JSON.stringify(applied)))

    expect(restored.selectedPresetId).toBe(PRESET_ID)
    expect(restored.layers[0].animations).toEqual(applied.layers[0].animations)
    expect(restored.audioAssignments.map(assignment => assignment.id)).toEqual(applied.audioAssignments.map(assignment => assignment.id))
    expect(restored.performance.enabled).toBe(false)
  })
})
