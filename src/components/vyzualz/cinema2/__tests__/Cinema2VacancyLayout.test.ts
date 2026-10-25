import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  VACANCY_COLORS, VACANCY_DEFAULTS, VACANCY_PYRAMID_SIDES, VACANCY_TIER_HEIGHTS, VACANCY_TOWER_LAYOUTS, VACANCY_TV_IDS,
  type VacancyPlacement,
  type VacancyTowerSize, type VacancyTvId, type VacancyTvSize,
} from '../modules/vacancy/Cinema2VacancyDomain'
import {
  VACANCY_MIN_CONTACT_SHARE, VACANCY_MIN_SUPPORT_COUNT, VACANCY_MIN_SUPPORT_MARGIN, buildVacancyLayout, vacancyAuditLayout, vacancyFootprint, vacancyLoadMargins, vacancyOverlapArea, vacancyPlacementSize, vacancyTowerBounds,
} from '../modules/vacancy/Cinema2VacancyStacking'
import { loadCinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { Cinema2VacancySceneController } from '../modules/vacancy/Cinema2VacancySceneController'

/** Audit the exact dimensions shipped to production, including unrounded cabinet support heights. */
const asset = readFileSync(new URL('../../../../../public/cinema2/models/vacancy-set.glb', import.meta.url))
const { nodes } = JSON.parse(asset.subarray(20, 20 + asset.readUInt32LE(12)).toString())
const tvNodes = nodes.filter((node: { extras?: { vacancyTv?: string } }) => node.extras?.vacancyTv)
const SIZES = Object.fromEntries(tvNodes.map(({ extras: data }: { extras: { vacancyTv: VacancyTvId; size: number[]; bodyHeight: number } }) =>
  [data.vacancyTv, { width: data.size[0], height: data.size[1], depth: data.size[2], bodyHeight: data.bodyHeight }])) as Record<VacancyTvId, VacancyTvSize>
const SIZE_NAMES = Object.keys(VACANCY_TOWER_LAYOUTS) as VacancyTowerSize[]
const CEILING = 2.76

describe('VACANCY tower layout', () => {
  it.each(SIZE_NAMES)('uses at least one of every television model in the %s tower', size => {
    const used = new Set(buildVacancyLayout(size, SIZES).map(placement => placement.tv))
    for (const id of VACANCY_TV_IDS) expect(used.has(id), `${id} is missing from the ${size} tower`).toBe(true)
  })

  it.each(SIZE_NAMES)('narrows toward a single point at the top of the %s tower', size => {
    const counts = VACANCY_TOWER_LAYOUTS[size].map(tier => tier.length)
    for (let i = 1; i < counts.length; i += 1) expect(counts[i]!).toBeLessThanOrEqual(counts[i - 1]!)
    expect(counts[0]!).toBeGreaterThan(counts[counts.length - 1]!)
    expect(counts[counts.length - 1]).toBe(1)
  })

  it.each(SIZE_NAMES)('packs the %s pile into staggered layers with real depth and a taper toward the crown', size => {
    const layout = buildVacancyLayout(size, SIZES)
    let previous: ReturnType<typeof vacancyTowerBounds> | null = null
    for (let tier = 0; tier < VACANCY_TOWER_LAYOUTS[size].length; tier += 1) {
      const layer = layout.filter(p => p.tier === tier)
      expect(layer).toHaveLength(VACANCY_TOWER_LAYOUTS[size][tier]!.length)
      const turn = layer[0]!.yaw, c = Math.cos(turn), s = Math.sin(turn)
      const points = layer.flatMap(p => vacancyFootprint(vacancyPlacementSize(p, SIZES), p.x, p.z, p.yaw))
        .map(([x, z]) => [x * c - z * s, x * s + z * c])
      const width = Math.max(...points.map(p => p[0]!)) - Math.min(...points.map(p => p[0]!))
      const depth = Math.max(...points.map(p => p[1]!)) - Math.min(...points.map(p => p[1]!))
      const contactArea = layer.reduce((sum, p) => { const size = vacancyPlacementSize(p, SIZES); return sum + size.width * size.depth }, 0)
      expect(contactArea / (width * depth), 'the triangular pile must retain dense support in its footprint').toBeGreaterThan(.45)
      const bounds = vacancyTowerBounds(layer, SIZES)
      if (previous) {
        expect(bounds.minX).toBeGreaterThan(previous.minX)
        expect(bounds.maxX).toBeLessThan(previous.maxX)
        expect(bounds.minZ).toBeGreaterThan(previous.minZ)
        expect(bounds.maxZ).toBeLessThan(previous.maxZ)
      } else {
        expect(depth).toBeGreaterThan(width * .5)
      }
      for (const p of layer) {
        expect(p.y).toBeCloseTo(tier * VACANCY_TIER_HEIGHTS[size], 6)
        expect(p.y + vacancyPlacementSize(p, SIZES).bodyHeight).toBeCloseTo((tier + 1) * VACANCY_TIER_HEIGHTS[size], 6)
      }
      if (layer.length === 1) { expect(layer[0]!.x).toBe(0); expect(Math.abs(layer[0]!.z)).toBeLessThanOrEqual(.12) }
      if (tier < VACANCY_PYRAMID_SIDES.length - 1) expect(new Set(layer.map(p => p.z.toFixed(3))).size).toBeGreaterThan(1)
      previous = bounds
    }
  })

  it('is deterministic', () => {
    expect(buildVacancyLayout('standard', SIZES)).toEqual(buildVacancyLayout('standard', SIZES))
  })

  it.each(SIZE_NAMES)('keeps the %s screens facing coherently forward with varied inward angles and no quarter-turned tier', size => {
    const layout = buildVacancyLayout(size, SIZES)
    for (const p of layout) {
      expect(Math.cos(p.yaw), 'a side panel or cabinet back must not replace an entire tier of screens').toBeGreaterThan(.9)
      expect(Math.abs(p.yaw - .18)).toBeGreaterThan(.1)
      expect(Math.abs(p.yaw - .18)).toBeLessThan(.17)
    }
    expect(layout.some(p => p.yaw > .18)).toBe(true)
    expect(layout.some(p => p.yaw < .18)).toBe(true)
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
      expect(support.supportCount, `${label} needs multiple supporting cabinets`).toBeGreaterThanOrEqual(VACANCY_MIN_SUPPORT_COUNT)
      expect(support.margin, `${label} would tip (margin ${support.margin.toFixed(3)} m)`).toBeGreaterThanOrEqual(VACANCY_MIN_SUPPORT_MARGIN - 1e-6)
      expect(support.contactShare, `${label} has too little of its base in contact`).toBeGreaterThanOrEqual(VACANCY_MIN_CONTACT_SHARE - 1e-6)
    }
  })

  it.each(SIZE_NAMES)('keeps the %s tower stable under the accumulated weight of all higher TVs', size => {
    expect(vacancyLoadMargins(buildVacancyLayout(size, SIZES), SIZES).every(margin => margin >= VACANCY_MIN_SUPPORT_MARGIN)).toBe(true)
  })

  it('rejects a staircase whose individual TVs balance but whose upper load tips the middle TV', () => {
    const sizes = { ...SIZES, 'old-two': { width: .5, height: .4, depth: .4, bodyHeight: .4 } }
    const layout: VacancyPlacement[] = [0, 1, 2].map(tier => ({ tv: 'old-two', tier, index: 0, x: tier * .17, y: tier * .4, z: 0, yaw: 0 }))
    for (const { support } of vacancyAuditLayout(layout, sizes).slice(1)) {
      expect(support.margin).toBeGreaterThan(VACANCY_MIN_SUPPORT_MARGIN)
      expect(support.contactShare).toBeGreaterThan(VACANCY_MIN_CONTACT_SHARE)
    }
    expect(vacancyLoadMargins(layout, sizes)[1]).toBeLessThan(0)
  })

  it.each(SIZE_NAMES)('never lets two sets of the %s tower occupy the same space', size => {
    const layout = buildVacancyLayout(size, SIZES)
    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        const a = layout[i]!, b = layout[j]!
        const aSize = vacancyPlacementSize(a, SIZES), bSize = vacancyPlacementSize(b, SIZES)
        const aTop = a.y + aSize.bodyHeight, bTop = b.y + bSize.bodyHeight
        const verticalOverlap = Math.min(aTop, bTop) - Math.max(a.y, b.y)
        if (verticalOverlap <= 0.005) continue
        const overlap = vacancyOverlapArea(vacancyFootprint(aSize, a.x, a.z, a.yaw), vacancyFootprint(bSize, b.x, b.z, b.yaw))
        expect(overlap, `${a.tv} (tier ${a.tier}) intersects ${b.tv} (tier ${b.tier})`).toBeLessThan(1e-4)
      }
    }
  })

  it('identifies a single vertical column as having only one supporting TV', () => {
    const layout: VacancyPlacement[] = [0, 1].map(tier => ({ tv: 'old-two', tier, index: 0, x: 0, y: tier * SIZES['old-two'].bodyHeight, z: 0, yaw: 0 }))
    const { support } = vacancyAuditLayout(layout, SIZES)[1]!
    expect(support.contactShare).toBeCloseTo(1)
    expect(support.supportCount).toBeLessThan(VACANCY_MIN_SUPPORT_COUNT)
  })

  it('rejects an overhang the old layout allowed: a set half off its support has its centre of mass outside it', () => {
    const [{ support }] = vacancyAuditLayout([
      { tv: 'old-school', tier: 0, index: 0, x: 0, y: 0, z: 0, yaw: 0 },
      { tv: 'tv-set', tier: 1, index: 0, x: 0.45, y: SIZES['old-school'].bodyHeight, z: 0, yaw: 0 },
    ], SIZES).slice(1)
    expect(support.margin).toBeLessThan(VACANCY_MIN_SUPPORT_MARGIN)
  })
})

describe('VACANCY room visibility', () => {
  it('reveals the baked room independently of quality, and follows visibility and master blackout', async () => {
    const library = await loadCinema2ThreeLibrary(), { THREE } = library
    const root = new THREE.Group(), room = new THREE.Group()
    room.name = 'vacancy.room'
    const baseMap = new THREE.Texture(), originalEmission = new THREE.Texture()
    const material = new THREE.MeshStandardMaterial({ map: baseMap, emissiveMap: originalEmission })
    const geometry = new THREE.BoxGeometry()
    room.add(new THREE.Mesh(geometry, material)); root.add(room)
    for (const node of tvNodes) {
      const template = new THREE.Group()
      template.name = node.name; template.userData = node.extras; root.add(template)
    }
    const controller = new Cinema2VacancySceneController(library)
    const controls = { ...VACANCY_DEFAULTS, colors: { background: VACANCY_COLORS.background.slice(0, 3) as [number, number, number], screen: VACANCY_COLORS.screen.slice(0, 3) as [number, number, number] } }
    try {
      controller.attach(root)
      expect(material.emissiveMap).toBe(material.map)
      controller.apply({ controls, timeSec: 0, quality: 'high' })
      const defaultFill = material.emissiveIntensity
      expect(defaultFill).toBeGreaterThan(1)
      controller.apply({ controls, timeSec: 0, quality: 'low' })
      expect(material.emissiveIntensity).toBe(defaultFill)
      controller.apply({ controls: { ...controls, roomVisibility: 1 }, timeSec: 0, quality: 'low' })
      expect(material.emissiveIntensity).toBeGreaterThan(defaultFill)
      controller.apply({ controls: { ...controls, roomVisibility: 0 }, timeSec: 0, quality: 'high' })
      expect(material.emissiveIntensity).toBe(0)
      controller.apply({ controls: { ...controls, master: 0 }, timeSec: 0, quality: 'high' })
      expect(material.emissiveIntensity).toBe(0)
    } finally {
      controller.dispose(); geometry.dispose(); baseMap.dispose(); originalEmission.dispose(); material.dispose()
    }
  })
})
