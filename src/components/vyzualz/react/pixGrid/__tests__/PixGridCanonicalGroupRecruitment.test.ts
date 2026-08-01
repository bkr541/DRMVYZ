import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import { PixGridReactionRuntime } from '../PixGridAudioRouting'
import { samplePixGridBuiltInAsset } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import type { PixGridGroupFrameEffect } from '../PixGridFrameEffects'
import { PixGridFrameGroupCompiler } from '../PixGridGroupCompiler'
import { PixGridPerformanceProgramCompiler } from '../PixGridPerformanceProgramCompiler'
import { resolvePixGridPerformanceFrame } from '../PixGridPerformanceRuntime'
import { NEON_MARQUEE_PERFORMANCE_PROGRAM } from '../PixGridPerformancePrograms'
import { pixGridMaskHasCell } from '../PixGridGroups'
import {
  pixGridNeonMarqueeComponentContainsCell,
  type PixGridNeonMarqueeComponentId,
} from '../PixGridNeonMarqueeMasks'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import type { PixGridAudioFrame, PixGridState } from '../PixGridTypes'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const PRESET = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
const WIDTH = 160
const HEIGHT = 90

function state(scene: 'intro' | 'drop' | 'build' = 'drop'): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, PRESET.pixGridSettings)
  return {
    ...applied,
    selectedSceneId: `${PRESET_ID}-${scene}`,
    performance: { ...applied.performance, enabled: true },
  }
}

function frame(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  return {
    audioTime: 10,
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
    sectionType: 'drop',
    motionClockSectionType: 'drop',
    motionClockSectionBeat: 0,
    motionClockSectionBar: 0,
    motionClockSectionProgress: 0,
    sectionProgress: 0,
    signClock: 0,
    motionClockSign: 0,
    signTransitionClock: null,
    motionClockSignTransition: null,
    transportState: 'playing',
    autoPerformanceEnabled: true,
    sourceValues: {},
    ...overrides,
  }
}

function resolvePerformance(
  sourceFrame: PixGridAudioFrame,
  sourceState: PixGridState,
) {
  const sectionType = sourceFrame.sectionType ?? 'verse'
  const context = buildSharedPerformanceContext({
    audioTimeSec: sourceFrame.audioTime,
    frame: {
      ...DEFAULT_MI_FRAME,
      timeSec: sourceFrame.audioTime,
      frameId: Math.max(1, Math.round(sourceFrame.audioTime * 60)),
      trackId: 'marquee-recruitment-test-track',
      bands: {
        ...DEFAULT_MI_FRAME.bands,
        sub: sourceFrame.sub ?? 0,
        bass: sourceFrame.bass,
        mid: sourceFrame.mid,
        high: sourceFrame.high,
        air: sourceFrame.air ?? 0,
        volume: sourceFrame.volume,
        normalizedSub: sourceFrame.sub ?? 0,
        normalizedBass: sourceFrame.bass,
        normalizedMid: sourceFrame.mid,
        normalizedHigh: sourceFrame.high,
        normalizedAir: sourceFrame.air ?? 0,
      },
      rhythm: {
        ...DEFAULT_MI_FRAME.rhythm,
        bpm: 120,
        beatIndex: sourceFrame.beatIndex ?? 0,
        beatPhase: sourceFrame.beatPhase,
        beatInBar: (sourceFrame.beatIndex ?? 0) % 4,
        barIndex: sourceFrame.barIndex ?? 0,
        beatHit: sourceFrame.beatHit,
        downbeatHit: sourceFrame.downbeatHit ?? false,
        kickHit: sourceFrame.kickHit ?? false,
        snareHit: sourceFrame.snareHit ?? false,
        hatHit: sourceFrame.hatHit ?? false,
      },
      energy: {
        ...DEFAULT_MI_FRAME.energy,
        instant: sourceFrame.volume,
        percentile: sourceFrame.trackRelativeEnergy ?? sourceFrame.volume,
        buildProgress: sourceFrame.buildProgress ?? 0,
      },
      stems: { ...DEFAULT_MI_FRAME.stems, vocalEnergy: sourceFrame.sourceValues?.vocalEnergy ?? 0 },
      capabilities: {
        ...DEFAULT_MI_FRAME.capabilities!,
        liveBands: true,
        rhythmEvents: true,
        beatGrid: true,
        sections: true,
        trackEnergyCurve: true,
      },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 1, rhythm: 1, section: 1 },
    },
    resolvedSections: [{
      id: `marquee-${sectionType}`,
      label: sectionType,
      type: sectionType,
      startSec: 0,
      endSec: 128,
      intensity: sectionType === 'drop' ? 1 : 0.72,
      source: 'auto' as const,
      confidence: 1,
    }],
    durationSec: 128,
    trackIdentity: 'marquee-recruitment-test-track',
    previous: null,
  })
  return resolvePixGridPerformanceFrame(
    sourceState,
    context,
    PRESET_ID,
    { capabilities: sourceFrame.capabilities },
  )
}

function render(
  sourceFrame: PixGridAudioFrame,
  sourceState = state(),
  runtime = new PixGridReactionRuntime(),
  effects: readonly PixGridGroupFrameEffect[] = [],
  compiler?: PixGridFrameGroupCompiler,
): Uint8Array {
  const performance = sourceState.audioAssignments.length === 0
    && sourceState.performance.enabled
    && sourceFrame.autoPerformanceEnabled === true
    ? resolvePerformance(sourceFrame, sourceState)
    : null
  return composePixGridLogicalFrame(
    PRESET,
    performance?.state ?? sourceState,
    sourceFrame,
    undefined,
    undefined,
    runtime,
    performance?.transition,
    [...(performance?.groupEffects ?? []), ...effects],
    compiler,
  ).pixels
}

function group(sourceState: PixGridState, id: string) {
  return sourceState.groups.find(candidate => candidate.id === id)!
}

function activeCells(pixels: Uint8Array): number {
  let count = 0
  for (let offset = 3; offset < pixels.length; offset += 4) count += Number(pixels[offset] > 0)
  return count
}

function cellChanged(before: Uint8Array, after: Uint8Array, index: number): boolean {
  const offset = index * 4
  return before[offset] !== after[offset]
    || before[offset + 1] !== after[offset + 1]
    || before[offset + 2] !== after[offset + 2]
    || before[offset + 3] !== after[offset + 3]
}

function changedComponentCells(
  before: Uint8Array,
  after: Uint8Array,
  component: PixGridNeonMarqueeComponentId,
): number {
  let changed = 0
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    const x = index % WIDTH
    const y = Math.floor(index / WIDTH)
    if (!pixGridNeonMarqueeComponentContainsCell(component, 0, x, y)) continue
    changed += Number(cellChanged(before, after, index))
  }
  return changed
}

function recruitedComponentCells(
  before: Uint8Array,
  after: Uint8Array,
  component: PixGridNeonMarqueeComponentId,
): number {
  let recruited = 0
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    const x = index % WIDTH
    const y = Math.floor(index / WIDTH)
    if (!pixGridNeonMarqueeComponentContainsCell(component, 0, x, y)) continue
    const offset = index * 4
    recruited += Number(before[offset + 3] === 0 && after[offset + 3] > 0)
  }
  return recruited
}

function eventFrame(
  source: 'kick' | 'snare' | 'downbeat',
): PixGridAudioFrame {
  if (source === 'kick') return frame({
    kickHit: true,
    sourceValues: { kick: 1 },
    capabilities: { kick: true },
    confidence: { kick: 1 },
  })
  if (source === 'snare') return frame({
    snareHit: true,
    sourceValues: { snare: 1 },
    capabilities: { snare: true },
    confidence: { snare: 1 },
  })
  return frame({
    beatHit: true,
    downbeatHit: true,
    sourceValues: { downbeat: 1 },
    capabilities: { downbeat: true },
    confidence: { downbeat: 1 },
  })
}

describe('PixGrid canonical Smart Group recruitment', () => {
  it('keeps canonical frame-aware membership beside rendered membership', () => {
    const sourceState = state()
    const compiler = new PixGridFrameGroupCompiler()
    render(frame({ autoPerformanceEnabled: false }), sourceState, new PixGridReactionRuntime(), [], compiler)

    const bankA = group(sourceState, 'marquee-bulb-a-group')
    const bankB = group(sourceState, 'marquee-bulb-b-group')
    const bankC = group(sourceState, 'marquee-bulb-c-group')
    const bankD = group(sourceState, 'marquee-bulb-d-group')
    const perimeter = group(sourceState, 'marquee-perimeter-group')
    const letters = group(sourceState, 'marquee-letter-group')

    expect(compiler.compile(bankA, 'rendered').cellCount).toBeGreaterThan(0)
    for (const hiddenBank of [bankB, bankC, bankD]) {
      expect(compiler.compile(hiddenBank, 'rendered').cellCount).toBe(0)
      expect(compiler.compile(hiddenBank, 'canonical').cellCount).toBeGreaterThan(250)
    }
    expect(compiler.compile(letters, 'rendered').cellCount).toBe(0)
    expect(compiler.compile(letters, 'canonical').cellCount).toBeGreaterThan(700)
    expect(compiler.compile(perimeter, 'canonical').cellCount)
      .toBeGreaterThan(compiler.compile(perimeter, 'rendered').cellCount)
  })

  it('recruits through compiled Performance Program bank assignments', () => {
    const sourceState = state()
    const compiled = new PixGridPerformanceProgramCompiler().compile(NEON_MARQUEE_PERFORMANCE_PROGRAM, sourceState)
    const kickAssignments = compiled.assignments.filter(candidate => (
      candidate.id.includes(':marquee-kick-perimeter:')
    ))
    const buildAssignments = compiled.assignments.filter(candidate => (
      candidate.id.includes(':marquee-build-bulb-recruitment:')
    ))

    expect(kickAssignments.length).toBeGreaterThan(0)
    expect(kickAssignments.every(candidate => candidate.target === 'brightness')).toBe(true)
    expect(buildAssignments.length).toBeGreaterThan(0)
    expect(buildAssignments.every(candidate => candidate.target === 'rowRecruitment')).toBe(true)

    const programState: PixGridState = { ...sourceState, audioAssignments: kickAssignments }
    const baseline = render(frame(), programState)
    const kick = render(eventFrame('kick'), programState)
    for (const bank of ['bulbs-b', 'bulbs-c', 'bulbs-d'] as const) {
      expect(recruitedComponentCells(baseline, kick, bank), `kick recruited ${bank}`).toBeGreaterThan(100)
    }
    expect(recruitedComponentCells(baseline, kick, 'structure')).toBe(0)
  })

  it('restores exact authored source colors for a recruited hidden bank', () => {
    const sourceState = state()
    const sourceFrame = frame({ autoPerformanceEnabled: false })
    const targetGroup = group(sourceState, 'marquee-bulb-b-group')
    const targetLayer = sourceState.layers.find(candidate => candidate.id === 'marquee-bulbs-b')!
    const compiler = new PixGridFrameGroupCompiler()
    render(sourceFrame, sourceState, new PixGridReactionRuntime(), [], compiler)
    const canonical = compiler.compile(targetGroup, 'canonical')
    const effect: PixGridGroupFrameEffect = {
      id: 'test-recruit-hidden-bulb-bank',
      groupId: targetGroup.id,
      kind: 'visibility',
      source: 'manual',
      stage: 'manual',
      priority: 1_000,
      amount: 1,
      blend: 'replace',
      membership: 'canonical',
      recruitHidden: true,
    }
    const recruited = render(sourceFrame, sourceState, new PixGridReactionRuntime(), [effect])

    let compared = 0
    for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
      if (!pixGridMaskHasCell(canonical.bits, index)) continue
      const x = index % WIDTH
      const y = Math.floor(index / WIDTH)
      const sample = samplePixGridBuiltInAsset(
        targetLayer.assetId,
        (x + 0.5) / WIDTH,
        (y + 0.5) / HEIGHT,
        0,
        targetLayer.seed,
      )
      if (sample.alpha <= 0 || !sample.color) continue
      const offset = index * 4
      expect(Array.from(recruited.slice(offset, offset + 3))).toEqual(Array.from(sample.color))
      compared += 1
    }
    expect(compared).toBe(canonical.cellCount)
  })

  it('recruits hidden perimeter and letter banks from kick, downbeat, build, and snare routes', () => {
    const baseline = render(frame())

    const kick = render(eventFrame('kick'))
    for (const bank of ['bulbs-b', 'bulbs-c', 'bulbs-d'] as const) {
      expect(changedComponentCells(baseline, kick, bank), `kick changed ${bank}`).toBeGreaterThan(250)
      expect(recruitedComponentCells(baseline, kick, bank), `kick recruited ${bank}`).toBeGreaterThan(100)
    }

    const downbeat = render(eventFrame('downbeat'))
    for (const bank of ['bulbs-b', 'bulbs-c', 'bulbs-d'] as const) {
      expect(recruitedComponentCells(baseline, downbeat, bank), `downbeat recruited ${bank}`).toBeGreaterThan(100)
    }

    const buildState = state('build')
    const buildBaselineFrame = frame({
      sectionType: 'build',
      motionClockSectionType: 'build',
      buildProgress: 0,
      sourceValues: { buildProgress: 0 },
      capabilities: { buildProgress: true },
      confidence: { buildProgress: 1 },
    })
    const buildActiveFrame = {
      ...buildBaselineFrame,
      buildProgress: 1,
      sourceValues: { buildProgress: 1 },
    }
    const buildBaseline = render(buildBaselineFrame, buildState)
    const buildActive = render(buildActiveFrame, buildState)
    expect(activeCells(buildActive)).toBeGreaterThan(activeCells(buildBaseline))
    for (const bank of ['bulbs-b', 'bulbs-c', 'bulbs-d'] as const) {
      expect(recruitedComponentCells(buildBaseline, buildActive, bank), `build recruited ${bank}`).toBeGreaterThan(100)
    }

    const snare = render(eventFrame('snare'))
    expect(recruitedComponentCells(baseline, snare, 'letter-b') + recruitedComponentCells(baseline, snare, 'letter-c'), 'snare recruited letters')
      .toBeGreaterThan(50)
    expect(changedComponentCells(baseline, snare, 'letter-b') + changedComponentCells(baseline, snare, 'letter-c'), 'snare changed letters')
      .toBeGreaterThan(500)

    for (const active of [kick, downbeat, buildActive, snare]) {
      const authoredBaseline = active === buildActive ? buildBaseline : baseline
      expect(recruitedComponentCells(authoredBaseline, active, 'structure')).toBe(0)
    }
  })

  it('gates audio recruitment with Auto Performance and resumes authored animation after release', () => {
    const offBaselineFrame = frame({ autoPerformanceEnabled: false })
    const offKickFrame = { ...eventFrame('kick'), autoPerformanceEnabled: false }
    expect(render(offKickFrame)).toEqual(render(offBaselineFrame))

    const runtime = new PixGridReactionRuntime()
    const triggeredFrame = eventFrame('kick')
    const baseline = render(frame())
    const triggered = render(triggeredFrame, state(), runtime)
    expect(recruitedComponentCells(baseline, triggered, 'bulbs-b')).toBeGreaterThan(100)

    const settledFrame = frame({
      audioTime: 11,
      kickHit: false,
      sourceValues: { kick: 0 },
      capabilities: { kick: true },
      confidence: { kick: 1 },
    })
    const settled = render(settledFrame, state(), runtime)
    const authored = render(settledFrame, state(), new PixGridReactionRuntime())
    expect(settled).toEqual(authored)
  })

  it('keeps explicit group visibility as a final canonical clamp', () => {
    const sourceState = state()
    const clampedState: PixGridState = {
      ...sourceState,
      groups: sourceState.groups.map(candidate => candidate.id === 'marquee-bulb-b-group'
        ? { ...candidate, contentVisible: false }
        : candidate),
    }
    const baseline = render(frame(), clampedState)
    const kick = render(eventFrame('kick'), clampedState)

    expect(recruitedComponentCells(baseline, kick, 'bulbs-b')).toBe(0)
    expect(recruitedComponentCells(baseline, kick, 'bulbs-c')).toBeGreaterThan(100)
    expect(recruitedComponentCells(baseline, kick, 'bulbs-d')).toBeGreaterThan(100)
  })

  it('protects scene-hidden layers from canonical recruitment', () => {
    const introState = state('intro')
    const introFrame = frame({
      sectionType: 'intro',
      motionClockSectionType: 'intro',
      autoPerformanceEnabled: false,
    })
    const targetGroup = group(introState, 'marquee-equalizer-group')
    const compiler = new PixGridFrameGroupCompiler()
    const baseline = render(introFrame, introState, new PixGridReactionRuntime(), [], compiler)
    expect(compiler.compile(targetGroup, 'canonical').cellCount).toBe(0)

    const effect: PixGridGroupFrameEffect = {
      id: 'test-scene-hidden-protection',
      groupId: targetGroup.id,
      kind: 'visibility',
      source: 'manual',
      stage: 'manual',
      priority: 1_000,
      amount: 1,
      membership: 'canonical',
      recruitHidden: true,
    }
    expect(render(introFrame, introState, new PixGridReactionRuntime(), [effect])).toEqual(baseline)
  })
})
