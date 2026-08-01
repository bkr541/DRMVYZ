import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { PixGridReactionRuntime } from '../PixGridAudioRouting'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { resolvePixGridPerformanceFrame } from '../PixGridPerformanceRuntime'
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
    signClock: 0,
    motionClockSign: 0,
    signTransitionClock: null,
    motionClockSignTransition: null,
    signTransitionSourceFrame: null,
    signTransitionTargetFrame: null,
    motionClockSignTransitionSourceFrame: null,
    motionClockSignTransitionTargetFrame: null,
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

function rendered(
  frame: PixGridAudioFrame,
  runtime?: PixGridReactionRuntime,
  visibleLayerIds?: readonly string[],
  performanceEnabled = frame.autoPerformanceEnabled === true,
): Uint8Array {
  const sectionType = frame.sectionType ?? 'verse'
  const section = [{
    id: `marquee-${sectionType}`,
    label: sectionType,
    type: sectionType,
    startSec: 0,
    endSec: 128,
    intensity: sectionType === 'drop' ? 1 : 0.72,
    source: 'auto' as const,
    confidence: 1,
  }]
  const context = buildSharedPerformanceContext({
    audioTimeSec: frame.audioTime,
    frame: {
      ...DEFAULT_MI_FRAME,
      timeSec: frame.audioTime,
      frameId: Math.max(1, Math.round(frame.audioTime * 60)),
      trackId: 'marquee-test-track',
      bands: {
        ...DEFAULT_MI_FRAME.bands,
        sub: frame.sub ?? 0,
        bass: frame.bass,
        mid: frame.mid,
        high: frame.high,
        air: frame.air ?? 0,
        volume: frame.volume,
        normalizedSub: frame.sub ?? 0,
        normalizedBass: frame.bass,
        normalizedMid: frame.mid,
        normalizedHigh: frame.high,
        normalizedAir: frame.air ?? 0,
      },
      rhythm: {
        ...DEFAULT_MI_FRAME.rhythm,
        bpm: 120,
        beatIndex: frame.beatIndex ?? 0,
        beatPhase: frame.beatPhase,
        beatInBar: (frame.beatIndex ?? 0) % 4,
        barIndex: frame.barIndex ?? 0,
        beatHit: frame.beatHit,
        downbeatHit: frame.downbeatHit ?? false,
        kickHit: frame.kickHit ?? false,
        snareHit: frame.snareHit ?? false,
        hatHit: frame.hatHit ?? false,
      },
      energy: {
        ...DEFAULT_MI_FRAME.energy,
        instant: frame.volume,
        percentile: frame.trackRelativeEnergy ?? frame.volume,
        buildProgress: frame.buildProgress ?? 0,
      },
      stems: { ...DEFAULT_MI_FRAME.stems, vocalEnergy: frame.sourceValues?.vocalEnergy ?? 0 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: true, sections: true, trackEnergyCurve: true },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 1, rhythm: 1, section: 1 },
    },
    resolvedSections: section,
    durationSec: 128,
    trackIdentity: 'marquee-test-track',
    previous: null,
  })
  const performance = resolvePixGridPerformanceFrame(
    state(performanceEnabled),
    context,
    PRESET_ID,
    { capabilities: frame.capabilities },
  )
  const renderedState = visibleLayerIds
    ? {
        ...performance.state,
        layers: performance.state.layers.map(candidate => ({
          ...candidate,
          visible: visibleLayerIds.includes(candidate.id),
        })),
      }
    : performance.state
  return composePixGridLogicalFrame(
    PRESET,
    renderedState,
    frame,
    undefined,
    undefined,
    runtime,
    performance.transition,
    performance.groupEffects,
  ).pixels
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

function changedComponentCells(
  componentId: Parameters<typeof pixGridNeonMarqueeComponentContainsCell>[0],
  a: Uint8Array,
  b: Uint8Array,
): number {
  let changed = 0
  for (let cell = 0; cell < 160 * 90; cell += 1) {
    const x = cell % 160
    const y = Math.floor(cell / 160)
    if (!pixGridNeonMarqueeComponentContainsCell(componentId, 0, x, y)) continue
    const offset = cell * 4
    if (
      Math.abs(a[offset] - b[offset]) >= 8
      || Math.abs(a[offset + 1] - b[offset + 1]) >= 8
      || Math.abs(a[offset + 2] - b[offset + 2]) >= 8
    ) changed += 1
  }
  return changed
}

function activeColumnHeights(pixels: Uint8Array): number[] {
  const heights: number[] = []
  for (let x = 0; x < 160; x += 1) {
    let active = 0
    for (let y = 0; y < 90; y += 1) {
      if (pixels[(y * 160 + x) * 4 + 3] > 0) active += 1
    }
    if (active > 0) heights.push(active)
  }
  return heights
}

function activeCellsByHorizontalThird(pixels: Uint8Array): readonly [number, number, number] {
  const totals: [number, number, number] = [0, 0, 0]
  for (let y = 0; y < 90; y += 1) {
    for (let x = 0; x < 160; x += 1) {
      if (pixels[(y * 160 + x) * 4 + 3] <= 0) continue
      const third = Math.min(2, Math.floor((x / 160) * 3)) as 0 | 1 | 2
      totals[third] = totals[third] + 1
    }
  }
  return totals
}

function totalColorEnergy(pixels: Uint8Array): number {
  let total = 0
  for (let offset = 0; offset < pixels.length; offset += 4) {
    total += pixels[offset] + pixels[offset + 1] + pixels[offset + 2]
  }
  return total
}

describe('Marquee Sign Cycle canonical authored animation', () => {
  it('binds the preset to its native Performance Program without changing semantic ownership', () => {
    const applied = state()
    expect(PRESET.pixGridSettings!.performanceProgramId).toBe(PROGRAM_ID)
    expect(applied.performance.sharedPerformanceProgramId).toBe(PROGRAM_ID)
    expect(applied.layers).toHaveLength(12)
    expect(applied.groups).toHaveLength(14)
    expect(applied.layers.map(candidate => candidate.id)).not.toContain('neon-marquee-frame')
    expect(applied.audioAssignments).toEqual([])
  })

  it('runs the deterministic overlapping A → B → C → D perimeter chase on the section-beat Motion clock', () => {
    const bulbs = ['marquee-bulbs-a', 'marquee-bulbs-b', 'marquee-bulbs-c', 'marquee-bulbs-d'].map(layer)
    const activeAtBeat = [0, 1, 2, 3].map(beat => bulbs.map(candidate => (
      resolved(candidate, audio({ motionClockSectionBeat: beat })).opacity
    )))
    const activeIndices = activeAtBeat.map(values => values
      .map((value, index) => value > 0.9 ? index : -1)
      .filter(index => index >= 0))

    expect(activeIndices).toEqual([[0, 3], [0, 1], [1, 2], [2, 3]])
    expect(activeAtBeat.every(values => values.filter(value => value > 0.9).length === 2)).toBe(true)
    expect(activeAtBeat.every(values => values.filter(value => value === 0.18).length === 2)).toBe(true)
    expect(bulbs.map(candidate => resolved(candidate, audio({ motionClockSectionBeat: 4 }),).frameIndex))
      .toEqual([0, 0, 0, 0])
  })

  it('keeps all four physical bulb banks present in every authored scene', () => {
    const bulbLayerIds = ['marquee-bulbs-a', 'marquee-bulbs-b', 'marquee-bulbs-c', 'marquee-bulbs-d'] as const
    const minimumDensity = Math.max(...bulbLayerIds.map(id => layer(id).densityRank))

    for (const sectionType of ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro'] as const) {
      const scene = PRESET.pixGridSettings!.sceneSettings![`${PRESET_ID}-${sectionType}`]
      expect(scene.density, sectionType).toBeGreaterThanOrEqual(minimumDensity)
      for (const layerId of bulbLayerIds) {
        expect(scene.hiddenLayerIds ?? [], `${sectionType}:${layerId}`).not.toContain(layerId)
        expect(scene.layerOpacity?.[layerId] ?? 1, `${sectionType}:${layerId}`).toBeGreaterThan(0)
      }
    }
  })

  it('freezes PreDrop as a deliberate paired A + D bulb pattern instead of one surviving bank', () => {
    const bulbs = ['marquee-bulbs-a', 'marquee-bulbs-b', 'marquee-bulbs-c', 'marquee-bulbs-d'].map(layer)
    const opacities = bulbs.map(candidate => resolved(candidate, audio({
      sectionType: 'preDrop',
      motionClockSectionType: 'preDrop',
      motionClockSectionBeat: 37,
      motionClockSectionBar: 9.25,
    })).opacity)

    expect(opacities).toEqual([1, 0.18, 0.18, 1])
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
    const activeBanks = (progress: number) => bulbs
      .map(candidate => resolved(candidate, buildAt(progress)).opacity)
      .map((value, index) => value > 0.9 ? index : -1)
      .filter(index => index >= 0)

    expect(activeBanks(0)).toEqual([0, 3])
    expect(activeBanks(1)).toEqual([1, 2])
    expect(resolved(layer('marquee-structure'), buildAt(0)).frameIndex).toBe(0)
    expect(resolved(layer('marquee-structure'), buildAt(1)).frameIndex).toBe(0)
  })

  it('travels letter-light banks independently from the perimeter chase', () => {
    const letters = ['marquee-letter-lights-a', 'marquee-letter-lights-b', 'marquee-letter-lights-c'].map(layer)
    const activeAtBeat = [0.5, 1.25, 1.5].map(beat => letters.map(candidate => (
      resolved(candidate, audio({ motionClockSectionBeat: beat })).opacity
    )))
    expect(activeAtBeat.map(values => values.map(value => value > 0.9))).toEqual([
      [true, false, false],
      [false, false, true],
      [false, true, true],
    ])

    const letterLayers = ['marquee-letter-lights-a', 'marquee-letter-lights-b', 'marquee-letter-lights-c']
    const atHalfBeat = rendered(audio({ motionClockSectionBeat: 0.5 }), undefined, letterLayers)
    const atOneAndQuarter = rendered(audio({ motionClockSectionBeat: 1.25 }), undefined, letterLayers)
    const atOneAndHalf = rendered(audio({ motionClockSectionBeat: 1.5 }), undefined, letterLayers)
    expect(changedComponentCells('letter-a', atHalfBeat, atOneAndQuarter)).toBeGreaterThan(0)
    expect(changedComponentCells('letter-c', atHalfBeat, atOneAndQuarter)).toBeGreaterThan(0)
    expect(changedComponentCells('letter-b', atOneAndQuarter, atOneAndHalf)).toBeGreaterThan(0)

    const bulbAtBeatOneAndQuarter = resolved(layer('marquee-bulbs-b'), audio({ motionClockSectionBeat: 1.25 })).opacity
    expect(bulbAtBeatOneAndQuarter).toBeGreaterThan(0.9)
    expect(activeAtBeat[1]).toEqual([0, 0, 1])
  })

  it('animates independent equalizer columns and maps low, mid, and high modulation to separate regions', () => {
    const equalizerOnly = ['marquee-equalizer-lights']
    const idleA = rendered(audio({
      sectionType: 'drop',
      motionClockSectionType: 'drop',
      motionClockSectionBeat: 0,
    }), undefined, equalizerOnly)
    const idleB = rendered(audio({
      sectionType: 'drop',
      motionClockSectionType: 'drop',
      motionClockSectionBeat: 1,
    }), undefined, equalizerOnly)
    expect(changedCells(idleA, idleB)).toBeGreaterThan(100)
    expect(new Set(activeColumnHeights(idleA)).size).toBeGreaterThan(8)
    expect(new Set(activeColumnHeights(idleB)).size).toBeGreaterThan(8)

    const reactiveBase = {
      sectionType: 'drop' as const,
      motionClockSectionType: 'drop' as const,
      motionClockSectionBeat: 2,
      motionClockSectionBar: 0.5,
      autoPerformanceEnabled: true,
    }
    const baseline = activeCellsByHorizontalThird(rendered(audio(reactiveBase), undefined, equalizerOnly, false))
    const bass = activeCellsByHorizontalThird(rendered(audio({ ...reactiveBase, bass: 1, sourceValues: { bass: 1 } }), undefined, equalizerOnly, false))
    const mid = activeCellsByHorizontalThird(rendered(audio({ ...reactiveBase, mid: 1, sourceValues: { mid: 1 } }), undefined, equalizerOnly, false))
    const high = activeCellsByHorizontalThird(rendered(audio({ ...reactiveBase, high: 1, sourceValues: { high: 1 } }), undefined, equalizerOnly, false))
    expect(bass[0]).toBeGreaterThan(baseline[0])
    expect(bass[1]).toBe(baseline[1])
    expect(mid[1]).toBeGreaterThan(baseline[1])
    expect(mid[2]).toBe(baseline[2])
    expect(high[2]).toBeGreaterThan(baseline[2])
    expect(high[0]).toBe(baseline[0])
  })

  it('resolves all seven scenes into distinct component-level programs', () => {
    const scenes = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro'] as const
    const outputs = new Map(scenes.map(scene => {
      const bar = scene === 'outro' ? 0.75 : 2
      const sceneFrame = audio({
        audioTime: bar * 2,
        sectionType: scene,
        motionClockSectionType: scene,
        motionClockSectionBeat: bar * 4,
        motionClockSectionBar: bar,
        beatsSinceSectionStart: bar * 4,
        barsSinceSectionStart: bar,
        sectionProgress: Math.min(1, bar / 16),
        motionClockSectionProgress: Math.min(1, bar / 16),
      })
      const sceneState = { ...state(false), selectedSceneId: `${PRESET_ID}-${scene}` }
      return [scene, composePixGridLogicalFrame(PRESET, sceneState, sceneFrame).pixels] as const
    }))
    const hashes = new Set(Array.from(outputs.values(), pixels => {
      let hash = 2166136261
      for (const value of pixels) {
        hash ^= value
        hash = Math.imul(hash, 16777619)
      }
      return hash >>> 0
    }))
    expect(hashes.size).toBe(scenes.length)
    expect(totalColorEnergy(outputs.get('drop')!)).toBeGreaterThan(totalColorEnergy(outputs.get('intro')!))
    expect(changedCells(outputs.get('drop')!, outputs.get('verse')!)).toBeGreaterThan(100)
    expect(changedCells(outputs.get('intro')!, outputs.get('breakdown')!)).toBeGreaterThan(100)
    expect(changedCells(outputs.get('preDrop')!, outputs.get('breakdown')!)).toBeGreaterThan(100)
    expect(outputs.get('outro')!.some(value => value !== 0)).toBe(false)

    const buildState = { ...state(false), selectedSceneId: `${PRESET_ID}-build` }
    const buildEarly = composePixGridLogicalFrame(PRESET, buildState, audio({
      sectionType: 'build',
      motionClockSectionType: 'build',
      motionClockSectionBeat: 1,
      motionClockSectionBar: 0.25,
      sectionProgress: 0,
      motionClockSectionProgress: 0,
    })).pixels
    const buildLate = composePixGridLogicalFrame(PRESET, buildState, audio({
      sectionType: 'build',
      motionClockSectionType: 'build',
      motionClockSectionBeat: 13,
      motionClockSectionBar: 3.25,
      sectionProgress: 1,
      motionClockSectionProgress: 1,
    })).pixels
    expect(changedCells(buildEarly, buildLate)).toBeGreaterThan(100)
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
