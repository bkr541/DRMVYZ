import { describe, expect, it } from 'vitest'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { PixGridReactionRuntime } from '../PixGridAudioRouting'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_NEON_MARQUEE_SIGN_CADENCE } from '../PixGridSignClock'
import { pixGridNeonMarqueeComponentContainsCell } from '../PixGridNeonMarqueeMasks'
import { PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION, PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridRuntimeControls, PixGridMotionClock } from '../PixGridRuntimeControls'
import { applyPixGridPresetSettings } from '../PixGridState'
import { migratePixGridState } from '../PixGridStateMigration'
import type { PixGridAudioFrame, PixGridLayer, PixGridState } from '../PixGridTypes'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const PROGRAM_ID = 'pix-grid-neon-marquee-performance'
const PRESET = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!

function state(enabled = true): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, PRESET.pixGridSettings)
  return {
    ...applied,
    selectedSceneId: `${PRESET_ID}-drop`,
    performance: { ...applied.performance, enabled },
  }
}

function audio(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
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
    beatsSinceSectionStart: 0,
    barsSinceSectionStart: 0,
    sectionType: 'verse',
    motionClockSectionType: 'verse',
    motionClockSectionBeat: 0,
    motionClockSectionBar: 0,
    motionClockSectionProgress: 0,
    sectionProgress: 0,
    transportState: 'playing',
    autoPerformanceEnabled: false,
    sourceValues: {},
    ...overrides,
  }
}

function resolved(layer: PixGridLayer, frame: PixGridAudioFrame) {
  return resolvePixGridLayerAnimation(layer, PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!, frame, 1)
}

function layer(id: string): PixGridLayer {
  return PRESET.pixGridSettings!.layers!.find(candidate => candidate.id === id)!
}

function rendered(frame: PixGridAudioFrame, runtime?: PixGridReactionRuntime): Uint8Array {
  return composePixGridLogicalFrame(PRESET, state(true), frame, undefined, undefined, runtime).pixels
}

function changedStructureCells(a: Uint8Array, b: Uint8Array): number {
  let changed = 0
  for (let cell = 0; cell < 160 * 90; cell += 1) {
    const x = cell % 160
    const y = Math.floor(cell / 160)
    if (!pixGridNeonMarqueeComponentContainsCell('structure', 0, x, y)) continue
    const offset = cell * 4
    if (
      Math.abs(a[offset] - b[offset]) >= 8
      || Math.abs(a[offset + 1] - b[offset + 1]) >= 8
      || Math.abs(a[offset + 2] - b[offset + 2]) >= 8
    ) changed += 1
  }
  return changed
}

function changedCells(a: Uint8Array, b: Uint8Array): number {
  let changed = 0
  for (let offset = 0; offset < Math.min(a.length, b.length); offset += 4) {
    if (
      Math.abs(a[offset] - b[offset]) >= 8
      || Math.abs(a[offset + 1] - b[offset + 1]) >= 8
      || Math.abs(a[offset + 2] - b[offset + 2]) >= 8
    ) changed += 1
  }
  return changed
}

describe('Marquee Sign Cycle canonical authored animation', () => {
  it('binds the preset to its native Performance Program without changing semantic ownership', () => {
    const applied = state()
    expect(PRESET.pixGridSettings!.performanceProgramId).toBe(PROGRAM_ID)
    expect(applied.performance.sharedPerformanceProgramId).toBe(PROGRAM_ID)
    expect(applied.layers).toHaveLength(12)
    expect(applied.groups).toHaveLength(14)
    expect(applied.layers.map(candidate => candidate.id)).not.toContain('neon-marquee-frame')
    expect(applied.audioAssignments.every(route => route.conditions?.autoPerformanceOnly === true)).toBe(true)
  })

  it('runs the deterministic A → B → C → D perimeter chase on the section-beat Motion clock', () => {
    const bulbs = ['marquee-bulbs-a', 'marquee-bulbs-b', 'marquee-bulbs-c', 'marquee-bulbs-d'].map(layer)
    const activeAtBeat = [0, 1, 2, 3].map(beat => bulbs.map(candidate => (
      resolved(candidate, audio({ motionClockSectionBeat: beat })).opacity
    )))

    expect(activeAtBeat.map(values => values.findIndex(value => value > 0.9))).toEqual([0, 1, 2, 3])
    expect(activeAtBeat.every(values => values.filter(value => value > 0.9).length === 1)).toBe(true)
    expect(bulbs.map(candidate => resolved(candidate, audio({ motionClockSectionBeat: 4 }),).frameIndex))
      .toEqual([0, 0, 0, 0])
  })

  it('accelerates the authored bulb chase progressively through builds without accelerating sign identity', () => {
    const bulbs = ['marquee-bulbs-a', 'marquee-bulbs-b', 'marquee-bulbs-c', 'marquee-bulbs-d'].map(layer)
    const buildAt = (progress: number) => audio({
      sectionType: 'build',
      motionClockSectionType: 'build',
      motionClockSectionBeat: 1,
      motionClockSectionBar: 1,
      motionClockSectionProgress: progress,
      sectionProgress: progress,
    })
    const activeBank = (progress: number) => bulbs
      .map(candidate => resolved(candidate, buildAt(progress)).opacity)
      .findIndex(value => value > 0.9)

    expect(activeBank(0)).toBe(1)
    expect(activeBank(1)).toBe(2)
    expect(resolved(layer('marquee-structure'), buildAt(0)).frameIndex).toBe(0)
    expect(resolved(layer('marquee-structure'), buildAt(1)).frameIndex).toBe(0)
  })

  it('travels letter-light banks independently from the perimeter chase', () => {
    const letters = ['marquee-letter-lights-a', 'marquee-letter-lights-b', 'marquee-letter-lights-c'].map(layer)
    const activeAtBeat = [0, 1, 2].map(beat => letters.map(candidate => (
      resolved(candidate, audio({ motionClockSectionBeat: beat })).opacity
    )))
    expect(activeAtBeat.map(values => values.findIndex(value => value > 0.9))).toEqual([0, 1, 2])

    const bulbAtBeatTwo = resolved(layer('marquee-bulbs-c'), audio({ motionClockSectionBeat: 2 })).opacity
    const letterAtBeatTwo = resolved(layer('marquee-letter-lights-c'), audio({ motionClockSectionBeat: 2 })).opacity
    expect(bulbAtBeatTwo).toBeGreaterThan(0.9)
    expect(letterAtBeatTwo).toBeGreaterThan(0.9)
    expect(resolved(layer('marquee-letter-lights-a'), audio({ motionClockSectionBeat: 2 })).opacity).toBe(0)
  })

  it('keeps structure centered and changes complete signs only at large musical boundaries', () => {
    const structure = layer('marquee-structure')
    const at = (sectionType: PixGridAudioFrame['sectionType'], bar: number, beat = bar * 4) => {
      const signClock = bar * PIX_GRID_NEON_MARQUEE_SIGN_CADENCE[sectionType ?? 'unknown']
      return resolved(structure, audio({
        sectionType,
        motionClockSectionType: sectionType,
        motionClockSectionBar: bar,
        motionClockSectionBeat: beat,
        signClock,
        motionClockSign: signClock,
      }))
    }

    for (const section of ['intro', 'preDrop', 'outro'] as const) {
      expect([0, 4, 8, 16].map(bar => at(section, bar).frameIndex)).toEqual([0, 0, 0, 0])
    }
    expect([0, 1, 7.99, 8, 16, 24].map(bar => at('verse', bar).frameIndex)).toEqual([0, 0, 0, 1, 2, 3])
    expect([0, 3.99, 4, 7.99, 8].map(bar => at('build', bar).frameIndex)).toEqual([0, 0, 1, 1, 2])
    expect([0, 3.99, 4, 7.99, 8].map(bar => at('drop', bar).frameIndex)).toEqual([0, 0, 1, 1, 2])
    expect([0, 8, 15.99, 16].map(bar => at('breakdown', bar).frameIndex)).toEqual([0, 0, 0, 1])

    const moving = at('drop', 4)
    expect(moving.positionX).toBe(0.5)
    expect(moving.positionY).toBe(0.5)
    expect(moving.scaleX).toBe(1)
    expect(moving.scaleY).toBe(1)
  })

  it('freezes and resumes every authored phase through the existing Motion clock', () => {
    const clock = new PixGridMotionClock()
    const clocked = (motion: number, time: number) => clock.apply(applyPixGridRuntimeControls(audio({
      audioTime: time,
      beatIndex: Math.floor(time),
      beatPhase: time % 1,
      beatsSinceSectionStart: time,
      barsSinceSectionStart: time / 4,
      motionClockSectionBeat: undefined,
      motionClockSectionBar: undefined,
      motionClockSectionProgress: undefined,
      motionClockSectionType: undefined,
    }), { motion, bassReactivity: 1 }))

    clocked(1, 1)
    const frozenA = clocked(0, 2)
    const frozenB = clocked(0, 6)
    const resumed = clocked(1, 7)
    expect(frozenB.motionClockSectionBeat).toBe(frozenA.motionClockSectionBeat)
    expect(resolved(layer('marquee-bulbs-b'), frozenB)).toEqual(resolved(layer('marquee-bulbs-b'), frozenA))
    expect((resumed.motionClockSectionBeat ?? 0) - (frozenB.motionClockSectionBeat ?? 0)).toBeCloseTo(1, 5)

    const half = new PixGridMotionClock()
    const normal = new PixGridMotionClock()
    half.apply(applyPixGridRuntimeControls(audio({ audioTime: 0 }), { motion: 0.5, bassReactivity: 1 }))
    normal.apply(applyPixGridRuntimeControls(audio({ audioTime: 0 }), { motion: 1, bassReactivity: 1 }))
    const halfFrame = half.apply(applyPixGridRuntimeControls(audio({ audioTime: 4, beatsSinceSectionStart: 4, barsSinceSectionStart: 1 }), { motion: 0.5, bassReactivity: 1 }))
    const normalFrame = normal.apply(applyPixGridRuntimeControls(audio({ audioTime: 4, beatsSinceSectionStart: 4, barsSinceSectionStart: 1 }), { motion: 1, bassReactivity: 1 }))
    expect(normalFrame.motionClockSectionBeat).toBeCloseTo((halfFrame.motionClockSectionBeat ?? 0) * 2, 5)
  })

  it('keeps authored movement with Auto Performance off and gates only targeted modulation', () => {
    const baselineA = audio({ motionClockSectionBeat: 0, autoPerformanceEnabled: false })
    const baselineB = audio({ motionClockSectionBeat: 1, autoPerformanceEnabled: false })
    expect(changedCells(rendered(baselineA), rendered(baselineB))).toBeGreaterThan(20)

    const kickOff = audio({ sectionType: 'drop', motionClockSectionType: 'drop', autoPerformanceEnabled: false, kickHit: true, sourceValues: { kick: 1 } })
    const kickOn = { ...kickOff, autoPerformanceEnabled: true }
    const silenceOn = { ...kickOn, kickHit: false, sourceValues: { kick: 0 } }
    expect(rendered(kickOff)).toEqual(rendered(silenceOn))
    expect(changedCells(rendered(silenceOn), rendered(kickOn))).toBeGreaterThan(0)
    expect(state(false).performance.sharedPerformanceProgramId).toBe(PROGRAM_ID)
  })



  it('routes every requested music source to light systems and keeps stable structure protected', () => {
    const baseline = audio({
      audioTime: 10,
      sectionType: 'drop',
      motionClockSectionType: 'drop',
      motionClockSectionBeat: 5,
      motionClockSectionBar: 1.25,
      autoPerformanceEnabled: true,
      sourceValues: {},
    })
    const baselinePixels = rendered(baseline)
    const cases: Array<[string, PixGridAudioFrame]> = [
      ['bass', { ...baseline, bass: 1, sourceValues: { bass: 1 }, capabilities: { bass: true }, confidence: { bass: 1 } }],
      ['mid', { ...baseline, mid: 1, sourceValues: { mid: 1 }, capabilities: { mid: true }, confidence: { mid: 1 } }],
      ['vocal', { ...baseline, sourceValues: { vocalEnergy: 1 }, capabilities: { vocalEnergy: true }, confidence: { vocalEnergy: 1 } }],
      ['high', { ...baseline, high: 1, sourceValues: { high: 1 }, capabilities: { high: true }, confidence: { high: 1 } }],
      ['kick', { ...baseline, kickHit: true, sourceValues: { kick: 1 }, capabilities: { kick: true }, confidence: { kick: 1 } }],
      ['snare', { ...baseline, snareHit: true, sourceValues: { snare: 1 }, capabilities: { snare: true }, confidence: { snare: 1 } }],
      ['hat', { ...baseline, hatHit: true, sourceValues: { hat: 1 }, capabilities: { hat: true }, confidence: { hat: 1 } }],
      ['downbeat', { ...baseline, beatHit: true, downbeatHit: true, sourceValues: { downbeat: 1 }, capabilities: { downbeat: true }, confidence: { downbeat: 1 } }],
      ['drop impact', { ...baseline, dropImpactHit: true, sourceValues: { dropImpact: 1 }, capabilities: { dropImpact: true }, confidence: { dropImpact: 1 } }],
      ['build progress', {
        ...baseline,
        sectionType: 'build',
        motionClockSectionType: 'build',
        buildProgress: 1,
        sourceValues: { buildProgress: 1 },
        capabilities: { buildProgress: true },
        confidence: { buildProgress: 1 },
      }],
    ]

    for (const [name, sourceFrame] of cases) {
      const sourceBaseline = sourceFrame.sectionType === 'build'
        ? rendered({ ...baseline, sectionType: 'build', motionClockSectionType: 'build' })
        : baselinePixels
      expect(changedCells(sourceBaseline, rendered(sourceFrame)), name).toBeGreaterThan(0)
    }

    const kickPixels = rendered(cases.find(([name]) => name === 'kick')![1])
    const downbeatPixels = rendered(cases.find(([name]) => name === 'downbeat')![1])
    expect(changedCells(baselinePixels, downbeatPixels)).toBeGreaterThan(changedCells(baselinePixels, kickPixels))
    expect(changedStructureCells(baselinePixels, rendered(cases.find(([name]) => name === 'drop impact')![1]))).toBeLessThan(8)
  })

  it('returns reactive envelopes to authored baseline and clears them on stop or seek', () => {
    const runtime = new PixGridReactionRuntime()
    const event = audio({
      audioTime: 10,
      sectionType: 'drop',
      motionClockSectionType: 'drop',
      motionClockSectionBeat: 5,
      motionClockSectionBar: 1.25,
      autoPerformanceEnabled: true,
      kickHit: true,
      sourceValues: { kick: 1 },
      capabilities: { kick: true },
      confidence: { kick: 1 },
    })
    const eventPixels = rendered(event, runtime)
    const settled = { ...event, audioTime: 11, kickHit: false, sourceValues: { kick: 0 } }
    const settledPixels = rendered(settled, runtime)
    const freshBaseline = rendered(settled, new PixGridReactionRuntime())
    expect(changedCells(freshBaseline, eventPixels)).toBeGreaterThan(0)
    expect(settledPixels).toEqual(freshBaseline)

    rendered(event, runtime)
    const stopped = { ...settled, audioTime: 0, isPlaying: false, transportState: 'stopped' as const, timingDiscontinuity: true }
    expect(rendered(stopped, runtime)).toEqual(rendered(stopped, new PixGridReactionRuntime()))

    rendered(event, runtime)
    const sought = { ...settled, audioTime: 4, timingDiscontinuity: true }
    expect(rendered(sought, runtime)).toEqual(rendered(sought, new PixGridReactionRuntime()))
  })

  it('refreshes an older canonical state while preserving the user Auto Performance toggle', () => {
    for (const enabled of [false, true]) {
      const stageOne = state(enabled)
      stageOne.configuration.presetConfigurationVersion = PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION - 1
      stageOne.performance.sharedPerformanceProgramId = null
      stageOne.layers = stageOne.layers.map(candidate => ({
        ...candidate,
        animations: [{ mode: 'frameCycle', clock: 'beat', speed: 1, amount: 1, phase: 0, boundary: 'wrap', stepped: true }],
      }))
      const migrated = migratePixGridState(stageOne, PRESET)
      expect(migrated.configuration.presetConfigurationVersion).toBe(PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION)
      expect(migrated.performance.enabled).toBe(enabled)
      expect(migrated.performance.sharedPerformanceProgramId).toBe(PROGRAM_ID)
      expect(migrated.layers.find(candidate => candidate.id === 'marquee-bulbs-a')?.animations.some(animation => animation.mode === 'blink')).toBe(true)
      expect(migrated.layers.find(candidate => candidate.id === 'marquee-structure')?.animations[0].clock).toBe('sign')
    }
  })
})
