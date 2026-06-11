import { describe, it, expect } from 'vitest'
import { resolveOscillatorSectionModifiers } from '../SoundDrawingRenderer'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../../ReactTypes'
import type { ReactSectionType } from '../../ReactTypes'

const settings = { ...DEFAULT_OSCILLATOR_SETTINGS }

const ALL_SECTIONS: (ReactSectionType | null)[] = [
  null, 'intro', 'verse', 'build', 'drop', 'breakdown', 'outro',
]

describe('resolveOscillatorSectionModifiers', () => {
  it('returns base values when sectionType is null', () => {
    const m = resolveOscillatorSectionModifiers(null, settings)
    expect(m.duplicateTraces).toBe(settings.duplicateTraces)
    expect(m.rotationSpeed).toBe(settings.rotationSpeed)
    expect(m.bassScale).toBe(settings.bassScale)
    expect(m.beatBloom).toBe(settings.beatBloom)
    expect(m.pathScale).toBe(settings.pathScale)
    expect(m.midTwist).toBe(settings.midTwist)
    expect(m.audioDisplacement).toBe(settings.audioDisplacement)
    expect(m.highJitter).toBe(settings.highJitter)
  })

  it('does not mutate the input settings', () => {
    const copy = { ...settings }
    resolveOscillatorSectionModifiers('drop', settings)
    expect(settings).toEqual(copy)
  })

  it('returns finite values for every section type', () => {
    for (const type of ALL_SECTIONS) {
      const m = resolveOscillatorSectionModifiers(type, settings)
      for (const [key, val] of Object.entries(m)) {
        expect(isFinite(val), `${key} should be finite for section '${type}'`).toBe(true)
      }
    }
  })

  it('keeps duplicateTraces in [1, 6] for all section types', () => {
    for (const type of ALL_SECTIONS) {
      const m = resolveOscillatorSectionModifiers(type, settings)
      expect(m.duplicateTraces, `duplicateTraces for '${type}'`).toBeGreaterThanOrEqual(1)
      expect(m.duplicateTraces, `duplicateTraces for '${type}'`).toBeLessThanOrEqual(6)
    }
  })

  it('keeps beatBloom in [0, 1] for all section types', () => {
    for (const type of ALL_SECTIONS) {
      const m = resolveOscillatorSectionModifiers(type, settings)
      expect(m.beatBloom).toBeGreaterThanOrEqual(0)
      expect(m.beatBloom).toBeLessThanOrEqual(1)
    }
  })

  it('keeps midTwist in [0, 1] for all section types', () => {
    for (const type of ALL_SECTIONS) {
      const m = resolveOscillatorSectionModifiers(type, settings)
      expect(m.midTwist).toBeGreaterThanOrEqual(0)
      expect(m.midTwist).toBeLessThanOrEqual(1)
    }
  })

  it('keeps highJitter >= 0 for all section types', () => {
    for (const type of ALL_SECTIONS) {
      const m = resolveOscillatorSectionModifiers(type, settings)
      expect(m.highJitter).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps audioDisplacement >= 0 for all section types', () => {
    for (const type of ALL_SECTIONS) {
      const m = resolveOscillatorSectionModifiers(type, settings)
      expect(m.audioDisplacement).toBeGreaterThanOrEqual(0)
    }
  })

  it('is stable: same inputs produce same outputs', () => {
    for (const type of ALL_SECTIONS) {
      const a = resolveOscillatorSectionModifiers(type, settings)
      const b = resolveOscillatorSectionModifiers(type, settings)
      expect(a).toEqual(b)
    }
  })

  it('intro: sets duplicateTraces=1, reduces rotationSpeed, pathScale, and caps audioDisplacement', () => {
    const m = resolveOscillatorSectionModifiers('intro', settings)
    expect(m.duplicateTraces).toBe(1)
    expect(m.rotationSpeed).toBeCloseTo(settings.rotationSpeed * 0.4, 8)
    expect(m.pathScale).toBeCloseTo(settings.pathScale * 0.85, 8)
    expect(m.audioDisplacement).toBeLessThanOrEqual(0.08 + 1e-9)
  })

  it('build: increases rotationSpeed, midTwist, beatBloom, duplicateTraces', () => {
    const m = resolveOscillatorSectionModifiers('build', settings)
    expect(m.rotationSpeed).toBeCloseTo(settings.rotationSpeed * 1.5, 8)
    expect(m.midTwist).toBeGreaterThan(settings.midTwist)
    expect(m.beatBloom).toBeGreaterThan(settings.beatBloom)
    expect(m.duplicateTraces).toBeGreaterThan(settings.duplicateTraces)
  })

  it('drop: increases bassScale, duplicateTraces, beatBloom, rotationSpeed', () => {
    const m = resolveOscillatorSectionModifiers('drop', settings)
    expect(m.bassScale).toBeGreaterThan(settings.bassScale)
    expect(m.duplicateTraces).toBeGreaterThan(settings.duplicateTraces)
    expect(m.beatBloom).toBeGreaterThan(settings.beatBloom)
    expect(m.rotationSpeed).toBeCloseTo(settings.rotationSpeed * 1.8, 8)
  })

  it('outro: sets duplicateTraces=1, reduces pathScale, rotationSpeed, audioDisplacement', () => {
    const m = resolveOscillatorSectionModifiers('outro', settings)
    expect(m.duplicateTraces).toBe(1)
    expect(m.pathScale).toBeCloseTo(settings.pathScale * 0.8, 8)
    expect(m.rotationSpeed).toBeCloseTo(settings.rotationSpeed * 0.3, 8)
    expect(m.audioDisplacement).toBeCloseTo(settings.audioDisplacement * 0.5, 8)
  })
})
