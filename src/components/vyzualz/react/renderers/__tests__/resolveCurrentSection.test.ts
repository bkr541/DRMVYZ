import { describe, it, expect } from 'vitest'
import {
  resolveCurrentSection,
  resolveEffectiveParams,
} from '../ReactEngineRenderer'
import { DEFAULT_REACT_RENDER_PARAMS } from '../reactRenderUtils'
import type { ReactTrackSection, ReactPreset } from '../../ReactTypes'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSection(
  type: ReactTrackSection['type'],
  startSec: number,
  endSec: number,
): ReactTrackSection {
  return { id: `${type}-${startSec}`, label: type, type, startSec, endSec, intensity: 1 }
}

const dropSection  = makeSection('drop',  10, 20)
const verseSection = makeSection('verse',  0, 10)

const basePreset: ReactPreset = {
  id:   'test',
  name: 'Test',
  description: '',
  engine: 'shaderPads',
  palette: {
    primary: '#4ac7db', secondary: '#61d6aa', accent: '#d8b95a',
    background: '#060d10', highlight: '#80dfc0', text: '#e8f4f8',
  },
  params: { intensity: 0.7, motion: 0.5, glow: 0.65, bassReactivity: 0.8, colorShift: 0.4, complexity: 0.5 },
  scenes: [
    { id: 'drop-scene', sectionType: 'drop', engineId: 'shaderPads', params: { intensity: 1.0, motion: 0.9 } },
  ],
  sectionMappings: [
    { sectionType: 'drop', sceneId: 'drop-scene' },
  ],
}

const base = { ...DEFAULT_REACT_RENDER_PARAMS }

// ── resolveCurrentSection ─────────────────────────────────────────────────────

describe('resolveCurrentSection', () => {
  it('returns null + 0 when no sections are defined', () => {
    expect(resolveCurrentSection([], 5)).toEqual({ type: null, progress: 0 })
  })

  it('returns null when time is before all sections', () => {
    const r = resolveCurrentSection([dropSection], 5)
    expect(r).toEqual({ type: null, progress: 0 })
  })

  it('returns null when time is past the end of all sections', () => {
    const r = resolveCurrentSection([dropSection], 30)
    expect(r).toEqual({ type: null, progress: 0 })
  })

  it('returns correct type and 0.5 progress at the midpoint', () => {
    const r = resolveCurrentSection([dropSection], 15)
    expect(r.type).toBe('drop')
    expect(r.progress).toBeCloseTo(0.5, 5)
  })

  it('returns progress 0 at the section start', () => {
    const r = resolveCurrentSection([dropSection], 10)
    expect(r.type).toBe('drop')
    expect(r.progress).toBeCloseTo(0, 5)
  })

  it('returns null for time before startSec', () => {
    expect(resolveCurrentSection([dropSection], 9.9)).toEqual({ type: null, progress: 0 })
  })

  it('returns null at endSec (exclusive upper bound)', () => {
    // resolveSectionAtTime uses time < endSec; exactly at endSec the section is over
    expect(resolveCurrentSection([dropSection], 20)).toEqual({ type: null, progress: 0 })
  })

  it('returns near-1 progress just before endSec', () => {
    const r = resolveCurrentSection([dropSection], 19.9)
    expect(r.type).toBe('drop')
    expect(r.progress).toBeCloseTo(0.99, 1)
  })

  it('picks the correct section when multiple sections are provided', () => {
    const r = resolveCurrentSection([verseSection, dropSection], 12)
    expect(r.type).toBe('drop')
    expect(r.progress).toBeCloseTo(0.2, 5)
  })
})

// ── resolveEffectiveParams ────────────────────────────────────────────────────

describe('resolveEffectiveParams', () => {
  it('returns base intensity unchanged when no sections are defined', () => {
    const result = resolveEffectiveParams(basePreset, base, [], 15)
    expect(result.intensity).toBeCloseTo(base.intensity, 5)
  })

  it('preserves non-intensity params when no sections match', () => {
    const result = resolveEffectiveParams(basePreset, base, [], 15)
    expect(result.glow).toBe(base.glow)
    expect(result.motion).toBe(base.motion)
    expect(result.trailDecay).toBe(base.trailDecay)
  })

  it('applies sectionIntensityMultiplier when sections are defined', () => {
    // 'verse' section has no automation mapping in basePreset, but
    // sectionIntensityMultiplier for 'verse' is < 1.0 (quiet section)
    const verse = makeSection('verse', 0, 10)
    const result = resolveEffectiveParams(basePreset, base, [verse], 5)
    // Intensity should be multiplied (reduced for verse) and clamped to ≥0.05
    expect(result.intensity).toBeGreaterThanOrEqual(0.05)
    expect(result.intensity).toBeLessThan(base.intensity + 0.001)
  })

  it('blends toward scene params at mid-section via automation', () => {
    const result = resolveEffectiveParams(basePreset, base, [dropSection], 15)
    // Drop section at midpoint (progress=0.5, blend=1): intensity → 1.0, motion → 0.9
    // But sectionIntensityMultiplier for drop may raise base intensity first
    expect(result.motion).toBeCloseTo(0.9, 4)
    expect(result.intensity).toBeGreaterThan(base.intensity)
  })

  it('never returns intensity below 0.05', () => {
    const lowIntensity = { ...base, intensity: 0.01 }
    const result = resolveEffectiveParams(basePreset, lowIntensity, [dropSection], 15)
    expect(result.intensity).toBeGreaterThanOrEqual(0.05)
  })
})
