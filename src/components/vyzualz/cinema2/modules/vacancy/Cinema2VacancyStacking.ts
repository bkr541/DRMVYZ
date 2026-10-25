import {
  VACANCY_TOWER_LAYOUTS,
  type VacancyPlacement, type VacancyTowerSize, type VacancyTvId, type VacancyTvSize,
} from './Cinema2VacancyDomain'

/**
 * Physically valid stacking for the VACANCY tower.
 *
 * Every set above the floor must be able to stay put: its centre of mass (the middle of its footprint) has to lie over the support polygon, which is
 * the convex hull of the contact patches with whatever it rests on. Footprints are exact oriented rectangles, so turned sets are judged by their real
 * corners rather than a bounding box. Sets may overhang an edge as long as the centre of mass stays over the support.
 */

type Vec = readonly [number, number]
type Poly = readonly Vec[]

/** How far inside the support polygon the centre of mass must sit (metres), and the least share of the footprint that must be in contact. */
export const VACANCY_MIN_SUPPORT_MARGIN = 0.04
export const VACANCY_MIN_CONTACT_SHARE = 0.35
/** Gap kept between neighbouring sets of one tier, and how close a lower top must be to the highest one to count as supporting. */
const GAP = 0.006
const SUPPORT_TOLERANCE = 0.012

/** The footprint of a set standing at (x, z) and turned by `yaw` about the vertical axis (matches Three's rotation.y). */
export function vacancyFootprint(size: Pick<VacancyTvSize, 'width' | 'depth'>, x: number, z: number, yaw: number): Poly {
  const c = Math.cos(yaw), s = Math.sin(yaw)
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sz]) => {
    const px = sx * size.width / 2, pz = sz * size.depth / 2
    return [x + px * c + pz * s, z - px * s + pz * c] as const
  })
}

const area = (poly: Poly): number => {
  let sum = 0
  for (let i = 0; i < poly.length; i += 1) {
    const [x1, z1] = poly[i]!, [x2, z2] = poly[(i + 1) % poly.length]!
    sum += x1 * z2 - x2 * z1
  }
  return Math.abs(sum) / 2
}

/** Sutherland-Hodgman clip of one convex polygon by another. */
function clip(subject: Poly, clipper: Poly): Poly {
  // Orient the clipper counter-clockwise so "inside" is the left of every edge.
  let signed = 0
  for (let i = 0; i < clipper.length; i += 1) {
    const [x1, z1] = clipper[i]!, [x2, z2] = clipper[(i + 1) % clipper.length]!
    signed += x1 * z2 - x2 * z1
  }
  const ring = signed < 0 ? [...clipper].reverse() : clipper
  let output: Vec[] = [...subject]
  for (let i = 0; i < ring.length && output.length > 0; i += 1) {
    const [ax, az] = ring[i]!, [bx, bz] = ring[(i + 1) % ring.length]!
    const inside = (p: Vec) => (bx - ax) * (p[1] - az) - (bz - az) * (p[0] - ax) >= -1e-12
    const input = output
    output = []
    for (let j = 0; j < input.length; j += 1) {
      const current = input[j]!, previous = input[(j + input.length - 1) % input.length]!
      const currentIn = inside(current), previousIn = inside(previous)
      if (currentIn !== previousIn) {
        const dx = current[0] - previous[0], dz = current[1] - previous[1]
        const denominator = (bx - ax) * dz - (bz - az) * dx
        if (Math.abs(denominator) > 1e-12) {
          const t = ((bx - ax) * (az - previous[1]) - (bz - az) * (ax - previous[0])) / denominator
          output.push([previous[0] + t * dx, previous[1] + t * dz])
        }
      }
      if (currentIn) output.push(current)
    }
  }
  return output
}

export const vacancyOverlapArea = (a: Poly, b: Poly): number => area(clip(a, b))

function convexHull(points: readonly Vec[]): Poly {
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1])
  if (sorted.length < 3) return sorted
  const cross = (o: Vec, a: Vec, b: Vec) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Vec[] = [], upper: Vec[] = []
  for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop(); lower.push(p) }
  for (const p of [...sorted].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop(); upper.push(p) }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** Shortest distance from a point to the inside of a counter-clockwise convex polygon; negative when outside. */
function insideMargin(point: Vec, hull: Poly): number {
  if (hull.length < 3) return -Infinity
  let margin = Infinity
  for (let i = 0; i < hull.length; i += 1) {
    const [ax, az] = hull[i]!, [bx, bz] = hull[(i + 1) % hull.length]!
    const length = Math.hypot(bx - ax, bz - az)
    if (length < 1e-9) continue
    margin = Math.min(margin, ((bx - ax) * (point[1] - az) - (bz - az) * (point[0] - ax)) / length)
  }
  return margin
}

interface Body { footprint: Poly; y: number; top: number }

export interface VacancySupport {
  /** Height the set rests at. */
  y: number
  /** Distance the centre of mass sits inside the support polygon; negative means it would tip. */
  margin: number
  /** Share of the footprint in contact with what is beneath. */
  contactShare: number
}

/** Where a set at (x, z) would rest on the bodies below it, and how securely. The floor always supports. */
export function vacancySupport(size: VacancyTvSize, x: number, z: number, yaw: number, below: readonly Body[]): VacancySupport {
  const footprint = vacancyFootprint(size, x, z, yaw)
  const footArea = area(footprint)
  let y = 0
  const touching: Body[] = []
  for (const body of below) if (vacancyOverlapArea(footprint, body.footprint) > 1e-4) { touching.push(body); y = Math.max(y, body.top) }
  if (y === 0) return { y: 0, margin: Infinity, contactShare: 1 }
  const patches = touching.filter(body => body.top >= y - SUPPORT_TOLERANCE).map(body => clip(footprint, body.footprint)).filter(patch => patch.length >= 3)
  if (patches.length === 0) return { y, margin: -Infinity, contactShare: 0 }
  const contact = patches.reduce((sum, patch) => sum + area(patch), 0)
  return { y, margin: insideMargin([x, z], convexHull(patches.flat())), contactShare: Math.min(1, contact / footArea) }
}

/** Small deterministic generator so a layout is identical on every load. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const stable = (support: VacancySupport, margin: number) => support.margin >= margin && support.contactShare >= VACANCY_MIN_CONTACT_SHARE

/**
 * Build the tower tier by tier. Each set is placed as near its even-spaced slot as physics allows: the slot is searched sideways in one-centimetre
 * steps for the nearest position that clears its neighbours and keeps its centre of mass over its support. Tier mates are placed from the middle
 * outward, and never rest on each other.
 */
export function buildVacancyLayout(size: VacancyTowerSize, sizes: Readonly<Record<VacancyTvId, VacancyTvSize>>, seed = 7): VacancyPlacement[] {
  const random = mulberry32(seed)
  const placed: Body[] = []
  const out: VacancyPlacement[] = []
  VACANCY_TOWER_LAYOUTS[size].forEach((tier, tierIndex) => {
    const turnLimit = Math.max(0.1, 0.34 - tierIndex * 0.06)
    const items = tier.map((tv, index) => {
      const sign = (index + tierIndex) % 2 === 0 ? 1 : -1
      const yaw = sign * (0.08 + random() * Math.max(0.04, turnLimit - 0.08))
      const s = sizes[tv]
      const footW = s.width * Math.cos(yaw) + s.depth * Math.abs(Math.sin(yaw))
      return { tv, index, yaw, s, footW, z: (random() - 0.5) * 0.12 }
    })
    const total = items.reduce((sum, item) => sum + item.footW, 0) + GAP * (items.length - 1)
    let cursor = -total / 2 + (tierIndex % 2 === 0 ? 0 : 0.03)
    const slots = items.map(item => { const x = cursor + item.footW / 2; cursor += item.footW + GAP; return x })
    const order = items.map((_, i) => i).sort((a, b) => Math.abs(slots[a]!) - Math.abs(slots[b]!))
    const mates: Poly[] = []
    const result = new Map<number, VacancyPlacement>()
    const tierBodies: Body[] = []
    for (const i of order) {
      const item = items[i]!
      let best: { x: number; support: VacancySupport; score: number } | null = null
      for (let k = 0; k <= 160 && !(best && stable(best.support, VACANCY_MIN_SUPPORT_MARGIN)); k += 1) {
        for (const direction of k === 0 ? [0] : [1, -1]) {
          const x = slots[i]! + direction * k * 0.01
          const footprint = vacancyFootprint(item.s, x, item.z, item.yaw)
          if (mates.some(mate => vacancyOverlapArea(footprint, mate) > 1e-5)) continue
          const support = vacancySupport(item.s, x, item.z, item.yaw, placed)
          if (stable(support, VACANCY_MIN_SUPPORT_MARGIN)) { best = { x, support, score: Infinity }; break }
          // Remember the most secure position in case nothing meets the margin.
          const score = Math.min(support.margin, 1) + support.contactShare
          if (!best || (!stable(best.support, VACANCY_MIN_SUPPORT_MARGIN) && score > best.score)) best = { x, support, score }
        }
      }
      if (!best) throw new Error(`VACANCY could not place ${item.tv} in tier ${tierIndex}.`)
      if (!stable(best.support, VACANCY_MIN_SUPPORT_MARGIN) && tierIndex > 0) throw new Error(`VACANCY could not find a stable position for ${item.tv} in tier ${tierIndex}.`)
      const footprint = vacancyFootprint(item.s, best.x, item.z, item.yaw)
      mates.push(footprint)
      tierBodies.push({ footprint, y: best.support.y, top: best.support.y + item.s.bodyHeight })
      result.set(i, { tv: item.tv, tier: tierIndex, index: item.index, x: best.x, y: best.support.y, z: item.z, yaw: item.yaw })
    }
    for (let i = 0; i < items.length; i += 1) out.push(result.get(i)!)
    placed.push(...tierBodies)
  })
  return out
}

/** The tower's footprint, for framing and for the stack-wall media layout. */
export function vacancyTowerBounds(layout: readonly VacancyPlacement[], sizes: Readonly<Record<VacancyTvId, VacancyTvSize>>) {
  let minX = Infinity, maxX = -Infinity, maxY = 0
  for (const p of layout) {
    const s = sizes[p.tv]
    minX = Math.min(minX, p.x - s.width / 2); maxX = Math.max(maxX, p.x + s.width / 2)
    maxY = Math.max(maxY, p.y + s.height)
  }
  return { minX, maxX, height: maxY }
}

/** Audit used by tests and diagnostics: every set's support in a finished layout, judged against the sets that were placed before it. */
export function vacancyAuditLayout(layout: readonly VacancyPlacement[], sizes: Readonly<Record<VacancyTvId, VacancyTvSize>>) {
  return layout.map(p => {
    const below: Body[] = layout.filter(other => other.tier < p.tier).map(other => ({
      footprint: vacancyFootprint(sizes[other.tv], other.x, other.z, other.yaw), y: other.y, top: other.y + sizes[other.tv].bodyHeight,
    }))
    return { placement: p, support: vacancySupport(sizes[p.tv], p.x, p.z, p.yaw, below) }
  })
}
