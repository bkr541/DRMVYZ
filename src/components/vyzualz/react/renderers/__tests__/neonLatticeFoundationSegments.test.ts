import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NEON_LATTICE_SETTINGS,
  DEFAULT_REACT_PRESETS,
} from '../../ReactTypes'
import {
  normalizeNeonLatticePhraseAction,
  normalizeNeonLatticeSettings,
  orientationWeightsFromVerticalBias,
} from '../../NeonLatticeConfig'
import {
  legacyRailToSegment,
  makeHorizontalRail,
  makePulseOnRail,
  makeVerticalRail,
  pulsePointAt,
  segmentPointAt,
} from '../neonLatticeUtils'

const palette = {
  primary: '1,2,3',
  secondary: '4,5,6',
  accent: '7,8,9',
  highlight: '10,11,12',
}

describe('Neon Lattice foundation normalization', () => {
  it('maps legacy verticalBias into usable explicit orientation weights', () => {
    expect(orientationWeightsFromVerticalBias(0.75)).toEqual({
      vertical: 0.75,
      horizontal: 0.25,
      diagonalUp: 0,
      diagonalDown: 0,
    })
    const normalized = normalizeNeonLatticeSettings({ verticalBias: 0.75 })
    expect(normalized.orientationWeights).toEqual({
      vertical: 0.75,
      horizontal: 0.25,
      diagonalUp: 0,
      diagonalDown: 0,
    })
  })

  it('repairs malformed persisted values and rejects NaN/infinity', () => {
    const normalized = normalizeNeonLatticeSettings({
      railDensity: Number.NaN,
      railLifetime: Number.POSITIVE_INFINITY,
      verticalBias: -9,
      orientationWeights: { vertical: 0, horizontal: 0, diagonalUp: 0, diagonalDown: 0 },
      lineEnvelope: { attackBeats: -3, holdBeats: Number.NaN, releaseBeats: 0, gateLengthBeats: 9999 },
      lanePattern: { laneCount: 0, sequenceLength: 9999, steps: [{ lanes: [-8, 999], chordSize: 99 }] },
      customSegments: [{ id: 'bad', startX: -5, startY: 2, endX: 9, endY: -1 }],
    })
    expect(normalized.railDensity).toBe(DEFAULT_NEON_LATTICE_SETTINGS.railDensity)
    expect(normalized.railLifetime).toBe(DEFAULT_NEON_LATTICE_SETTINGS.railLifetime)
    expect(normalized.verticalBias).toBe(0)
    expect(normalized.orientationWeights.horizontal).toBe(1)
    expect(normalized.lineEnvelope.attackBeats).toBe(0)
    expect(normalized.lineEnvelope.releaseBeats).toBeGreaterThan(0)
    expect(normalized.lanePattern.laneCount).toBe(1)
    expect(normalized.lanePattern.sequenceLength).toBe(128)
    expect(normalized.customSegments[0]).toMatchObject({ startX: 0, startY: 1, endX: 1, endY: 0 })
  })

  it('is idempotent and preserves unknown future fields', () => {
    const first = normalizeNeonLatticeSettings({
      verticalBias: 0.4,
      futureField: { version: 9 },
      lanePattern: { laneCount: 4, sequenceLength: 2, steps: [{ lanes: [1] }, { rest: true, lanes: [] }] },
    }) as typeof DEFAULT_NEON_LATTICE_SETTINGS & { futureField: { version: number } }
    const second = normalizeNeonLatticeSettings(first) as typeof first
    expect(second).toEqual(first)
    expect(second.futureField).toEqual({ version: 9 })
  })

  it('provides safe default envelopes, phrase programs, and lane patterns', () => {
    const normalized = normalizeNeonLatticeSettings({})
    expect(normalized.lineEnvelope.attackBeats).toBeGreaterThanOrEqual(0)
    expect(normalized.lineEnvelope.releaseBeats).toBeGreaterThan(0)
    expect(normalized.phrasePrograms).toEqual([])
    expect(normalized.lanePattern.steps).toHaveLength(normalized.lanePattern.sequenceLength)
  })

  it('validates every phrase action contract and rejects unknown actions', () => {
    expect(normalizeNeonLatticePhraseAction({ type: 'spawnLine', orientation: 'diagonalUp', lane: 2 })).toMatchObject({ type: 'spawnLine', orientation: 'diagonalUp', lane: 2 })
    expect(normalizeNeonLatticePhraseAction({ type: 'spawnLineCluster', chordSize: 999 })).toMatchObject({ type: 'spawnLineCluster', chordSize: 16 })
    expect(normalizeNeonLatticePhraseAction({ type: 'temporaryLaneCountChange', laneCount: 0 })).toEqual({ type: 'temporaryLaneCountChange', laneCount: 1 })
    expect(normalizeNeonLatticePhraseAction({ type: 'restoreBaseState' })).toEqual({ type: 'restoreBaseState' })
    expect(normalizeNeonLatticePhraseAction({ type: 'futureUnknownAction' })).toBeNull()
  })
})

describe('canonical normalized segments', () => {
  it('converts legacy vertical and horizontal rails to normalized endpoints', () => {
    const vertical = legacyRailToSegment({ vertical: true, pos: 0.25, spanStart: 0.1, spanEnd: 0.9 })
    const horizontal = legacyRailToSegment({ vertical: false, pos: 0.75, spanStart: 0.2, spanEnd: 0.8 })
    expect(vertical).toMatchObject({ startX: 0.25, endX: 0.25, startY: 0.1, endY: 0.9, orientation: 'vertical' })
    expect(horizontal).toMatchObject({ startX: 0.2, endX: 0.8, startY: 0.75, endY: 0.75, orientation: 'horizontal' })
  })

  it('supports full-height vertical and full-width horizontal spans', () => {
    const vertical = makeVerticalRail(1, normalizeNeonLatticeSettings({ verticalSpanMode: 'fullCanvas' }), 0, [], palette, 1)
    const horizontal = makeHorizontalRail(2, normalizeNeonLatticeSettings({ horizontalSpanMode: 'fullCanvas' }), 0, [], palette, 1)
    expect(vertical.startY).toBe(0)
    expect(vertical.endY).toBe(1)
    expect(horizontal.startX).toBe(0)
    expect(horizontal.endX).toBe(1)
  })

  it('keeps legacy horizontal short dashes as the normalized default', () => {
    const horizontal = makeHorizontalRail(7, normalizeNeonLatticeSettings({}), 0, [], palette, 0.5)
    expect(horizontal.spanMode).toBe('short')
    expect(horizontal.endX - horizontal.startX).toBeLessThan(1)
    expect(horizontal.startY).toBe(horizontal.endY)
  })

  it('keeps every segment coordinate within normalized bounds', () => {
    for (let seed = 1; seed < 64; seed++) {
      const vertical = makeVerticalRail(seed, normalizeNeonLatticeSettings({}), 0, [], palette, 0.5)
      const horizontal = makeHorizontalRail(seed, normalizeNeonLatticeSettings({ horizontalSpanMode: 'random' }), 0, [], palette, 0.5)
      for (const value of [vertical.startX, vertical.startY, vertical.endX, vertical.endY, horizontal.startX, horizontal.startY, horizontal.endX, horizontal.endY]) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('interpolates pulses along vertical and horizontal segments', () => {
    const settings = normalizeNeonLatticeSettings({})
    const vertical = legacyRailToSegment({ vertical: true, pos: 0.3, spanStart: 0.2, spanEnd: 0.8 }, { id: 'v' })
    const horizontal = legacyRailToSegment({ vertical: false, pos: 0.6, spanStart: 0.1, spanEnd: 0.9 }, { id: 'h' })
    const vp = makePulseOnRail(vertical, 1, settings, 0, palette, 1, 1, 1)
    const hp = makePulseOnRail(horizontal, 1, settings, 0, palette, 1, 2, 1)
    vp.progress = 0.5
    hp.progress = 0.5
    expect(pulsePointAt(vp)).toEqual({ x: 0.3, y: 0.5 })
    expect(pulsePointAt(hp)).toEqual({ x: 0.5, y: 0.6 })
    expect(segmentPointAt(vertical, 0.5)).toEqual({ x: 0.3, y: 0.5 })
  })
})

describe('preset compatibility', () => {
  it('keeps Neon compatibility normalization while removing every live built-in preset', () => {
    expect(DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'neonLattice')).toEqual([])
    expect(normalizeNeonLatticeSettings(DEFAULT_NEON_LATTICE_SETTINGS)).toEqual(DEFAULT_NEON_LATTICE_SETTINGS)
  })

  it('normalizes every enhanced preset safely and idempotently', () => {
    for (const preset of DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'neonLattice')) {
      const normalized = normalizeNeonLatticeSettings(preset.neonLatticeSettings)
      expect(normalizeNeonLatticeSettings(normalized)).toEqual(normalized)
      expect(normalized.compositionMode).not.toBe('legacyLattice')
      expect(Object.values(normalized.orientationWeights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1)
      expect(normalized.lanePattern.steps).toHaveLength(normalized.lanePattern.sequenceLength)
    }
  })
})
