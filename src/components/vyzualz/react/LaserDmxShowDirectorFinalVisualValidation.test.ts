import { describe, expect, it } from 'vitest'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from './LaserDmxShowDirectorPerformancePresets'
import {
  SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES,
  resolveShowDirectorVisualValidationFrame,
  showDirectorRepresentativeDifference,
  type ShowDirectorVisualValidationResolution,
} from './LaserDmxShowDirectorVisualValidation'

function byId(values: ShowDirectorVisualValidationResolution[], id: string): ShowDirectorVisualValidationResolution {
  const value = values.find(item => item.frame.id === id)
  if (!value) throw new Error(`Missing representative frame ${id}`)
  return value
}

function preset(id: string) {
  const value = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(item => item.id === id)
  if (!value) throw new Error(`Missing Performance Show ${id}`)
  return value
}

const BEAM_SHOW_IDS = [
  'prism-cathedral',
  'cardinal-fan-reactor',
  'cyan-mirror-cage',
  'small-club-rig-performance',
  'festival-front-beams-performance',
  'dubstep-drop-lasers-performance',
] as const

const RIG_BACKED_IDS = [
  'small-club-rig-performance',
  'festival-front-beams-performance',
  'dubstep-drop-lasers-performance',
  'led-bar-grid-performance',
  'moving-head-sweep-performance',
  'strobe-blinder-hits-performance',
  'haze-co2-drops-performance',
] as const

describe('Show Director final visual validation', () => {
  it('covers all eighteen shows and all ten representative moments deterministically', () => {
    expect(LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS).toHaveLength(18)
    const reports: ShowDirectorVisualValidationResolution[] = []
    for (const show of LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS) {
      for (const frame of SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES) {
        const first = resolveShowDirectorVisualValidationFrame(show, frame)
        const repeated = resolveShowDirectorVisualValidationFrame(show, frame)
        reports.push(first)
        expect(first.performanceProgramId).toBe(show.id)
        expect(first.compiledBeamCount).toBeLessThanOrEqual(300)
        expect(first.authoredBeamCount).toBeLessThanOrEqual(300)
        expect(first.staticSourceRigImmutable).toBe(true)
        expect(repeated.compiledBeamCount).toBe(first.compiledBeamCount)
        expect(repeated.visibleBeamCount).toBe(first.visibleBeamCount)
        expect(repeated.metrics.geometrySignature).toBe(first.metrics.geometrySignature)
        expect(repeated.effects.stateSignature).toBe(first.effects.stateSignature)
      }
    }
    expect(reports).toHaveLength(180)
    expect(new Set(reports.map(report => `${report.presetId}/${report.frame.id}`))).toHaveLength(180)
  })

  it('keeps the seven rig-backed shows linked to distinct static source layouts', () => {
    const sourceLayouts = RIG_BACKED_IDS.map(id => preset(id).sourceRigLayoutId)
    expect(sourceLayouts.every(Boolean)).toBe(true)
    expect(new Set(sourceLayouts)).toHaveLength(7)
  })

  it.each(BEAM_SHOW_IDS)('%s preserves readable local origins, bounded density, progression, and evolved Drop 2', showId => {
    const show = preset(showId)
    const frames = SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.map(frame => resolveShowDirectorVisualValidationFrame(show, frame))
    for (const frame of frames) {
      expect(frame.compiledBeamCount).toBeGreaterThan(0)
      expect(frame.visibleBeamCount).toBeGreaterThan(0)
      expect(frame.metrics.activeSourceCount).toBeGreaterThan(0)
      expect(frame.metrics.originDistinguishability).toBeGreaterThanOrEqual(0.35)
      expect(frame.metrics.angularDiversity).toBeGreaterThan(0.03)
      expect(frame.output.beamPersistence).toBeLessThanOrEqual(0.25)
      expect(frame.fog.density).toBeLessThanOrEqual(frame.frame.id.includes('impact') ? 0.6 : 0.28)
    }
    const verse = byId(frames, 'verse')
    const dropOneImpact = byId(frames, 'drop-1-impact')
    const dropOne = byId(frames, 'drop-1-body')
    const breakdown = byId(frames, 'breakdown')
    const dropTwoImpact = byId(frames, 'drop-2-impact')
    const dropTwo = byId(frames, 'drop-2-body')
    expect(dropOne.compiledBeamCount).toBeGreaterThan(verse.compiledBeamCount)
    expect(breakdown.compiledBeamCount).toBeLessThan(dropTwo.compiledBeamCount)
    expect(showDirectorRepresentativeDifference(dropOneImpact, dropTwoImpact)).toBeGreaterThan(0.08)
    expect(dropTwo.compiledBeamCount).toBeGreaterThan(verse.compiledBeamCount)
    expect(dropOne.recruitmentStage).toBeGreaterThanOrEqual(2)
    expect(dropTwo.recruitmentStage).toBeGreaterThanOrEqual(2)
    expect(showDirectorRepresentativeDifference(dropOne, dropTwo)).toBeGreaterThan(0.08)
  })

  it('preserves protected apertures and corridors for the six beam shows', () => {
    const thresholds: Record<string, number> = {
      'prism-cathedral': 0.28,
      'cardinal-fan-reactor': 0.16,
      'cyan-mirror-cage': 0.12,
      'small-club-rig-performance': 0.25,
      'festival-front-beams-performance': 0.2,
      'dubstep-drop-lasers-performance': 0.2,
    }
    for (const showId of BEAM_SHOW_IDS) {
      const drop = resolveShowDirectorVisualValidationFrame(preset(showId), SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES[5])
      expect(drop.metrics.protectedZoneOccupancy).toBeLessThan(thresholds[showId])
    }
  })

  it('makes kick, snare, four-bar, and eight-bar changes observable without resetting the macro phrase', () => {
    const eventShows = [
      ...BEAM_SHOW_IDS,
      'led-bar-grid-performance',
      'moving-head-sweep-performance',
      'strobe-blinder-hits-performance',
    ]
    for (const showId of eventShows) {
      const show = preset(showId)
      const kick = resolveShowDirectorVisualValidationFrame(show, { id: 'drop-1-body', timeSec: 56.02, kick: true })
      const snare = resolveShowDirectorVisualValidationFrame(show, { id: 'drop-1-body', timeSec: 56.52, snare: true })
      const fourBars = resolveShowDirectorVisualValidationFrame(show, { id: 'drop-1-body', timeSec: 64.02, kick: true })
      const recruited = resolveShowDirectorVisualValidationFrame(show, { id: 'drop-1-body', timeSec: 68.02, kick: true })
      expect(showDirectorRepresentativeDifference(kick, snare)).toBeGreaterThan(0.02)
      expect(showDirectorRepresentativeDifference(kick, fourBars)).toBeGreaterThan(0.02)
      expect(recruited.recruitmentStage).toBeGreaterThan(fourBars.recruitmentStage)
      expect(showDirectorRepresentativeDifference(fourBars, recruited)).toBeGreaterThan(0.04)
    }
  })

  it('validates LED row-column ownership, sparse breakdown, and evolved Drop 2 structure', () => {
    const show = preset('led-bar-grid-performance')
    const frames = SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.map(frame => resolveShowDirectorVisualValidationFrame(show, frame))
    const verse = byId(frames, 'verse')
    const build = byId(frames, 'build')
    const dropOne = byId(frames, 'drop-1-body')
    const breakdown = byId(frames, 'breakdown')
    const dropTwo = byId(frames, 'drop-2-body')
    expect(verse.effects.activeRowCount).toBeGreaterThan(1)
    expect(verse.effects.activeColumnCount).toBeGreaterThan(1)
    expect(build.effects.activeLedFixtureCount).toBeGreaterThanOrEqual(verse.effects.activeLedFixtureCount)
    expect(breakdown.effects.activeLedFixtureCount).toBeLessThan(dropOne.effects.activeLedFixtureCount)
    expect(dropTwo.effects.activeLedFixtureCount).toBeGreaterThan(breakdown.effects.activeLedFixtureCount)
    expect(showDirectorRepresentativeDifference(dropOne, dropTwo)).toBeGreaterThan(0.1)
  })

  it('validates moving-head bank ownership, path continuity, compression, expansion, and deterministic evolution', () => {
    const show = preset('moving-head-sweep-performance')
    const frames = SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.map(frame => resolveShowDirectorVisualValidationFrame(show, frame))
    const build = byId(frames, 'build')
    const dropOne = byId(frames, 'drop-1-body')
    const breakdown = byId(frames, 'breakdown')
    const dropTwo = byId(frames, 'drop-2-body')
    expect(build.effects.activeMovementBankCount).toBeGreaterThanOrEqual(2)
    expect(dropOne.effects.activeMovingHeadCount).toBe(4)
    expect(breakdown.effects.activeMovingHeadCount).toBeLessThan(dropOne.effects.activeMovingHeadCount)
    expect(dropTwo.effects.activeMovingHeadCount).toBe(4)
    expect(dropOne.effects.movementSignature).not.toBe(dropTwo.effects.movementSignature)
    expect(dropOne.effects.movementPositionSpread).toBeGreaterThan(0)
  })

  it('keeps strobe and blinder output transient, bounded, and larger at the second-drop impact', () => {
    const show = preset('strobe-blinder-hits-performance')
    const idle = resolveShowDirectorVisualValidationFrame(show, { id: 'verse', timeSec: 20.25, beat: false })
    const dropOne = resolveShowDirectorVisualValidationFrame(show, SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES[4])
    const breakdown = resolveShowDirectorVisualValidationFrame(show, SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES[6])
    const dropTwo = resolveShowDirectorVisualValidationFrame(show, SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES[7])
    expect(idle.visibleBeamCount).toBe(0)
    expect(dropOne.effects.strobeActivations).toBeLessThanOrEqual(3)
    expect(dropOne.effects.blinderActivations).toBeLessThanOrEqual(3)
    expect(dropTwo.effects.strobeActivations).toBeLessThanOrEqual(3)
    expect(dropTwo.effects.blinderActivations).toBeLessThanOrEqual(3)
    expect(dropOne.effects.maximumStrobeDurationMs).toBeLessThanOrEqual(100)
    expect(dropTwo.effects.maximumStrobeDurationMs).toBeLessThanOrEqual(100)
    expect(dropOne.effects.maximumBlinderDurationMs).toBeLessThanOrEqual(250)
    expect(dropTwo.effects.maximumBlinderDurationMs).toBeLessThanOrEqual(250)
    expect(dropTwo.visibleBeamCount).toBeGreaterThan(0)
    expect(dropTwo.activeFixtureCount).toBeGreaterThanOrEqual(dropOne.activeFixtureCount)
    expect(breakdown.activeFixtureCount).toBeLessThan(dropTwo.activeFixtureCount)
  })

  it('caps haze and virtual CO2 bursts, reduces breakdown atmosphere, expands Drop 2, and clears the outro', () => {
    const show = preset('haze-co2-drops-performance')
    const frames = SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.map(frame => resolveShowDirectorVisualValidationFrame(show, frame))
    const build = byId(frames, 'build')
    const dropOne = byId(frames, 'drop-1-impact')
    const breakdown = byId(frames, 'breakdown')
    const dropTwo = byId(frames, 'drop-2-impact')
    const outro = byId(frames, 'outro')
    for (const frame of frames) {
      expect(frame.effects.hazeLevel).toBeLessThanOrEqual(0.65)
      expect(frame.effects.co2BurstCount).toBeLessThanOrEqual(3)
      expect(frame.effects.maximumCo2BurstDurationMs).toBeLessThanOrEqual(700)
    }
    expect(build.effects.hazeLevel).toBeGreaterThan(frames[1].effects.hazeLevel)
    expect(breakdown.effects.hazeLevel).toBeLessThan(dropOne.effects.hazeLevel)
    expect(breakdown.effects.co2BurstCount).toBe(0)
    expect(dropTwo.effects.hazeLevel).toBeGreaterThan(dropOne.effects.hazeLevel)
    expect(dropTwo.effects.co2BurstCount).toBeGreaterThan(dropOne.effects.co2BurstCount)
    expect(outro.effects.hazeLevel).toBeLessThan(0.08)
    expect(outro.effects.co2BurstCount).toBe(0)
  })

  it('does not leak compiler or runtime state between shows', () => {
    const frame = SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES[5]
    const firstShow = preset('small-club-rig-performance')
    const otherShow = preset('haze-co2-drops-performance')
    const before = resolveShowDirectorVisualValidationFrame(firstShow, frame)
    resolveShowDirectorVisualValidationFrame(otherShow, frame)
    const after = resolveShowDirectorVisualValidationFrame(firstShow, frame)
    expect(after.metrics.geometrySignature).toBe(before.metrics.geometrySignature)
    expect(after.effects.stateSignature).toBe(before.effects.stateSignature)
    expect(after.compiledBeamCount).toBe(before.compiledBeamCount)
  })
})
