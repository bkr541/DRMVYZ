import { describe, expect, it } from 'vitest'
import {
  VACANCY_TOWER_LAYOUTS, VACANCY_TV_IDS,
  type VacancyTowerSize, type VacancyTvId, type VacancyTvSize,
} from '../modules/vacancy/Cinema2VacancyDomain'
import {
  VACANCY_MIN_CONTACT_SHARE, VACANCY_MIN_SUPPORT_MARGIN, buildVacancyLayout, vacancyAuditLayout, vacancyFootprint, vacancyOverlapArea, vacancyTowerBounds,
} from '../modules/vacancy/Cinema2VacancyStacking'

/** The normalised sizes build-vacancy-runtime.mjs writes into the shipped asset. */
const SIZES: Record<VacancyTvId, VacancyTvSize> = {
  'old-school': { width: 0.62, height: 0.4236, depth: 0.2275, bodyHeight: 0.424 },
  'old-two': { width: 0.5, height: 0.321, depth: 0.3417, bodyHeight: 0.321 },
  'sony-pvm': { width: 0.38, height: 0.3599, depth: 0.4808, bodyHeight: 0.36 },
  retro: { width: 0.55, height: 0.6026, depth: 0.6113, bodyHeight: 0.603 },
  'tv-set': { width: 0.7, height: 0.4062, depth: 0.4756, bodyHeight: 0.406 },
  vintage: { width: 0.52, height: 0.4913, depth: 0.3085, bodyHeight: 0.341 },
}
const SIZE_NAMES = Object.keys(VACANCY_TOWER_LAYOUTS) as VacancyTowerSize[]
const CEILING = 2.76

describe('VACANCY tower layout', () => {
  it.each(SIZE_NAMES)('uses at least one of every television model in the %s tower', size => {
    const used = new Set(buildVacancyLayout(size, SIZES).map(placement => placement.tv))
    for (const id of VACANCY_TV_IDS) expect(used.has(id), `${id} is missing from the ${size} tower`).toBe(true)
  })

  it.each(SIZE_NAMES)('narrows toward a single point or a pair at the top of the %s tower', size => {
    const counts = VACANCY_TOWER_LAYOUTS[size].map(tier => tier.length)
    for (let i = 1; i < counts.length; i += 1) expect(counts[i]!).toBeLessThanOrEqual(counts[i - 1]!)
    expect(counts[0]!).toBeGreaterThan(counts[counts.length - 1]!)
  })

  it('is deterministic', () => {
    expect(buildVacancyLayout('standard', SIZES)).toEqual(buildVacancyLayout('standard', SIZES))
  })

  it.each(SIZE_NAMES)('stands every set on the floor or on another set and keeps the %s tower under the ceiling', size => {
    const layout = buildVacancyLayout(size, SIZES)
    for (const placement of layout) {
      expect(placement.y).toBeGreaterThanOrEqual(0)
      if (placement.tier === 0) expect(placement.y).toBe(0)
      else expect(placement.y, `tier ${placement.tier} ${placement.tv} floats on the floor`).toBeGreaterThan(0)
    }
    expect(vacancyTowerBounds(layout, SIZES).height).toBeLessThan(CEILING - 0.1)
  })

  it('keeps the vintage set, whose antennae stand above its body, on the top tier', () => {
    for (const size of SIZE_NAMES) {
      const layout = buildVacancyLayout(size, SIZES)
      const top = Math.max(...layout.map(placement => placement.tier))
      expect(layout.filter(placement => placement.tv === 'vintage').every(placement => placement.tier === top)).toBe(true)
    }
  })

  it.each(SIZE_NAMES)('keeps every set in the %s tower physically supported, with its centre of mass over its contact', size => {
    for (const { placement, support } of vacancyAuditLayout(buildVacancyLayout(size, SIZES), SIZES)) {
      const label = `${placement.tv} in tier ${placement.tier}`
      if (placement.tier === 0) { expect(placement.y, label).toBe(0); continue }
      expect(support.margin, `${label} would tip (margin ${support.margin.toFixed(3)} m)`).toBeGreaterThanOrEqual(VACANCY_MIN_SUPPORT_MARGIN - 1e-6)
      expect(support.contactShare, `${label} has too little of its base in contact`).toBeGreaterThanOrEqual(VACANCY_MIN_CONTACT_SHARE - 1e-6)
    }
  })

  it.each(SIZE_NAMES)('never lets two sets of the %s tower occupy the same space', size => {
    const layout = buildVacancyLayout(size, SIZES)
    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        const a = layout[i]!, b = layout[j]!
        const aTop = a.y + SIZES[a.tv].bodyHeight, bTop = b.y + SIZES[b.tv].bodyHeight
        const verticalOverlap = Math.min(aTop, bTop) - Math.max(a.y, b.y)
        if (verticalOverlap <= 0.005) continue
        const overlap = vacancyOverlapArea(vacancyFootprint(SIZES[a.tv], a.x, a.z, a.yaw), vacancyFootprint(SIZES[b.tv], b.x, b.z, b.yaw))
        expect(overlap, `${a.tv} (tier ${a.tier}) intersects ${b.tv} (tier ${b.tier})`).toBeLessThan(1e-4)
      }
    }
  })

  it('rejects an overhang the old layout allowed: a set half off its support has its centre of mass outside it', () => {
    const [{ support }] = vacancyAuditLayout([
      { tv: 'old-school', tier: 0, index: 0, x: 0, y: 0, z: 0, yaw: 0 },
      { tv: 'tv-set', tier: 1, index: 0, x: 0.45, y: SIZES['old-school'].bodyHeight, z: 0, yaw: 0 },
    ], SIZES).slice(1)
    expect(support.margin).toBeLessThan(VACANCY_MIN_SUPPORT_MARGIN)
  })
})
