import { describe, expect, it } from 'vitest'
import { LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS } from './LaserDmxShowDirectorPerformanceShowcasePresets'
import {
  SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES,
  resolveShowDirectorVisualValidationFrame,
  showDirectorGeometryDifference,
} from './LaserDmxShowDirectorVisualValidation'

function byId<T extends { frame: { id: string } }>(values: T[], id: string): T {
  const value = values.find(item => item.frame.id === id)
  if (!value) throw new Error(`Missing representative frame ${id}`)
  return value
}

describe('Show Director final visual validation', () => {
  it.each(LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS)('$name renders all representative frames within a readable role hierarchy', preset => {
    const frames = SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.map(frame => resolveShowDirectorVisualValidationFrame(preset, frame))
    for (const frame of frames) {
      expect(frame.compiledBeamCount).toBeGreaterThan(0)
      expect(frame.compiledBeamCount).toBeLessThanOrEqual(300)
      expect(frame.metrics.activeSourceCount).toBeGreaterThan(0)
      expect(frame.metrics.originDistinguishability).toBeGreaterThanOrEqual(0.75)
      expect(frame.metrics.angularDiversity).toBeGreaterThan(0.08)
      if (frame.frame.id === 'verse' || frame.frame.id === 'build' || frame.frame.id === 'drop-1-body' || frame.frame.id === 'drop-2-body') {
        expect(frame.metrics.saturation).toBeGreaterThan(frame.frame.id === 'build' ? 0.12 : 0.3)
        expect(frame.metrics.dominantColorCount).toBeLessThanOrEqual(preset.id === 'cardinal-fan-reactor' || frame.frame.id === 'drop-2-body' ? 4 : 3)
      }
      expect(frame.output.beamPersistence).toBeLessThanOrEqual(frame.section === 'breakdown' ? 0.18 : 0.15)
      expect(frame.fog.density).toBeLessThanOrEqual(0.2)
    }
    const verse = byId(frames, 'verse')
    const dropOneImpact = byId(frames, 'drop-1-impact')
    const dropOne = byId(frames, 'drop-1-body')
    const breakdown = byId(frames, 'breakdown')
    const dropTwoImpact = byId(frames, 'drop-2-impact')
    const dropTwo = byId(frames, 'drop-2-body')
    expect(dropOne.compiledBeamCount).toBeGreaterThan(verse.compiledBeamCount)
    expect(breakdown.compiledBeamCount).toBeLessThan(dropOne.compiledBeamCount)
    expect(dropTwo.compiledBeamCount).toBeGreaterThan(dropOne.compiledBeamCount)
    expect(dropOneImpact.metrics.heroToTextureBrightnessRatio).toBeGreaterThan(1.35)
    expect(dropTwoImpact.metrics.heroToTextureBrightnessRatio).toBeGreaterThan(1.35)
    expect(showDirectorGeometryDifference(dropOne.metrics, dropTwo.metrics)).toBeGreaterThan(0.12)
  })

  it('preserves each show-specific protected negative-space identity', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const dropOne = resolveShowDirectorVisualValidationFrame(preset, SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES[5])
      const threshold = preset.id === 'cyan-mirror-cage' ? 0.12 : preset.id === 'cardinal-fan-reactor' ? 0.16 : 0.24
      expect(dropOne.metrics.protectedZoneOccupancy).toBeLessThan(threshold)
      expect(dropOne.metrics.symmetry).toBeGreaterThan(preset.id === 'prism-cathedral' ? 0.18 : 0.42)
    }
  })

  it('changes visibly on adjacent beats and across four bars instead of freezing into one hourglass', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const beatA = resolveShowDirectorVisualValidationFrame(preset, { id: 'drop-1-body', timeSec: 48.1, kick: true })
      const beatB = resolveShowDirectorVisualValidationFrame(preset, { id: 'drop-1-body', timeSec: 48.6, snare: true })
      const fourBars = resolveShowDirectorVisualValidationFrame(preset, { id: 'drop-1-body', timeSec: 56.1, kick: true })
      expect(showDirectorGeometryDifference(beatA.metrics, beatB.metrics)).toBeGreaterThan(0.08)
      expect(showDirectorGeometryDifference(beatA.metrics, fourBars.metrics)).toBeGreaterThan(0.12)
    }
  })
})
