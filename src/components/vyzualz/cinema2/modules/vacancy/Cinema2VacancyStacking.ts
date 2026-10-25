import {
  VACANCY_PYRAMID_SIDES, VACANCY_TIER_HEIGHTS, VACANCY_TOWER_LAYOUTS,
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
export const VACANCY_MIN_SUPPORT_MARGIN = 0.06
export const VACANCY_MIN_CONTACT_SHARE = 0.65
export const VACANCY_MIN_SUPPORT_COUNT = 2
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

interface LoadedBody extends Body { x: number; z: number; mass: number }

/** Conservative load audit: carry each set's weight and the load above it down through its actual contact patches.
 * Cabinet volume approximates mass. Splitting bridge loads by contact area keeps the whole upper stack in the audit,
 * instead of treating a heavily loaded lower cabinet as an isolated, empty TV.
 */
function loadMargins(bodies: readonly LoadedBody[]): number[] {
  const loads = bodies.map(body => ({ mass: body.mass, x: body.x * body.mass, z: body.z * body.mass }))
  const margins = bodies.map(() => Infinity)
  const order = bodies.map((_, i) => i).sort((a, b) => bodies[b]!.y - bodies[a]!.y)
  for (const i of order) {
    const body = bodies[i]!, load = loads[i]!
    if (body.y === 0) continue
    const contacts = bodies.flatMap((below, index) => {
      if (index === i || below.y >= body.y || Math.abs(below.top - body.y) > SUPPORT_TOLERANCE) return []
      const patch = clip(body.footprint, below.footprint)
      const contactArea = area(patch)
      return contactArea > 1e-4 ? [{ index, patch, contactArea }] : []
    })
    margins[i] = insideMargin([load.x / load.mass, load.z / load.mass], convexHull(contacts.flatMap(contact => contact.patch)))
    const total = contacts.reduce((sum, contact) => sum + contact.contactArea, 0)
    for (const contact of contacts) {
      const share = contact.contactArea / total, lower = loads[contact.index]!
      lower.mass += load.mass * share; lower.x += load.x * share; lower.z += load.z * share
    }
  }
  return margins
}

function loadedBody(p: VacancyPlacement, size: VacancyTvSize): LoadedBody {
  return { footprint: vacancyFootprint(size, p.x, p.z, p.yaw), y: p.y, top: p.y + size.bodyHeight,
    x: p.x, z: p.z, mass: size.width * size.depth * size.bodyHeight }
}

export function vacancyLoadMargins(layout: readonly VacancyPlacement[], sizes: Readonly<Record<VacancyTvId, VacancyTvSize>>): number[] {
  return loadMargins(layout.map(p => loadedBody(p, vacancyPlacementSize(p, sizes))))
}

export interface VacancySupport {
  /** Height the set rests at. */
  y: number
  /** Distance the centre of mass sits inside the support polygon; negative means it would tip. */
  margin: number
  /** Share of the footprint in contact with what is beneath. */
  contactShare: number
  /** Supporting cabinets with at least 3% of the upper cabinet's base in contact. */
  supportCount: number
}

/** Where a set at (x, z) would rest on the bodies below it, and how securely. The floor always supports. */
export function vacancySupport(size: VacancyTvSize, x: number, z: number, yaw: number, below: readonly Body[]): VacancySupport {
  const footprint = vacancyFootprint(size, x, z, yaw)
  const footArea = area(footprint)
  let y = 0
  const touching: Body[] = []
  for (const body of below) if (vacancyOverlapArea(footprint, body.footprint) > 1e-4) { touching.push(body); y = Math.max(y, body.top) }
  if (y === 0) return { y: 0, margin: Infinity, contactShare: 1, supportCount: 0 }
  const patches = touching.filter(body => body.top >= y - SUPPORT_TOLERANCE).map(body => clip(footprint, body.footprint)).filter(patch => patch.length >= 3)
  if (patches.length === 0) return { y, margin: -Infinity, contactShare: 0, supportCount: 0 }
  const contact = patches.reduce((sum, patch) => sum + area(patch), 0)
  return { y, margin: insideMargin([x, z], convexHull(patches.flat())), contactShare: Math.min(1, contact / footArea),
    supportCount: patches.filter(patch => area(patch) >= footArea * 0.03).length }
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

/** Actual cabinet dimensions after the placement's uniform model scale. */
export function vacancyPlacementSize(p: VacancyPlacement, sizes: Readonly<Record<VacancyTvId, VacancyTvSize>>): VacancyTvSize {
  const size = sizes[p.tv], scale = p.scale ?? 1
  return { width: size.width * scale, height: size.height * scale, depth: size.depth * scale, bodyHeight: size.bodyHeight * scale }
}

/**
 * A staggered tetrahedral pile: each level has several rows in depth and each raised cabinet bridges lower sets.
 * The reference's broadly forward-facing screens stay consistent throughout the pile; actual backs remain at the rear.
 * Rows nest using their real rotated footprints rather than leaving bounding-box channels between them.
 */
export function buildVacancyLayout(size: VacancyTowerSize, sizes: Readonly<Record<VacancyTvId, VacancyTvSize>>, seed = 7): VacancyPlacement[] {
  const random = mulberry32(seed), out: VacancyPlacement[] = []
  const tierHeight = VACANCY_TIER_HEIGHTS[size], turn = 0.18, c = Math.cos(turn), s = Math.sin(turn)
  VACANCY_TOWER_LAYOUTS[size].forEach((tier, tierIndex) => {
    const side = VACANCY_PYRAMID_SIDES[tierIndex]!
    let index = 0
    const items = [] as { tv: VacancyTvId; row: number; column: number; count: number; yaw: number; size: VacancyTvSize }[]
    for (let row = 0; row < side; row += 1) for (let column = 0; column < side - row; column += 1) {
      const count = side - row, tv = tier[index++]!, middle = (count - 1) / 2
      const direction = column < middle ? 1 : column > middle ? -1 : tierIndex % 2 ? -1 : 1
      const yaw = direction * (0.12 + random() * 0.04)
      const scale = tierHeight / sizes[tv].bodyHeight
      const scaled = vacancyPlacementSize({ tv, tier: tierIndex, index: 0, x: 0, y: 0, z: 0, yaw, scale }, sizes)
      items.push({ tv, row, column, count, yaw, size: scaled })
    }
    const pitchX = Math.max(...items.map(item => item.size.width * Math.cos(item.yaw) + item.size.depth * Math.abs(Math.sin(item.yaw)))) + GAP
    const makeLayer = (pitchZ: number, world: boolean): VacancyPlacement[] => items.map((item, index) => {
      const x = (item.column - (item.count - 1) / 2) * pitchX
      const z = ((side - 1) / 3 - item.row) * pitchZ
      return { tv: item.tv, tier: tierIndex, index, x: world ? x * c + z * s : x, y: tierIndex * tierHeight,
        z: world ? -x * s + z * c : z, yaw: item.yaw + (world ? turn : 0), scale: tierHeight / sizes[item.tv].bodyHeight }
    })
    let low = 0, high = Math.max(...items.map(item => item.size.depth * Math.cos(item.yaw) + item.size.width * Math.abs(Math.sin(item.yaw))))
    for (let step = 0; step < 24 && side > 1; step += 1) {
      const pitch = (low + high) / 2, layer = makeLayer(pitch, false)
      const collision = layer.some((p, i) => layer.slice(0, i).some(other => vacancyOverlapArea(
        vacancyFootprint(vacancyPlacementSize(p, sizes), p.x, p.z, p.yaw),
        vacancyFootprint(vacancyPlacementSize(other, sizes), other.x, other.z, other.yaw),
      ) > 1e-8))
      if (collision) low = pitch
      else high = pitch
    }
    const local = makeLayer(high + GAP, false)
    if (tierIndex === 0) {
      const apex = local[local.length - 1]!, apexSize = vacancyPlacementSize(apex, sizes)
      const apexWidth = apexSize.width * Math.cos(apex.yaw) + apexSize.depth * Math.abs(Math.sin(apex.yaw))
      for (const [tv, direction] of [['old-school', -1], ['retro', 1]] as const) {
        const scale = tierHeight / sizes[tv].bodyHeight, yaw = -direction * .14
        const cabinet = vacancyPlacementSize({ ...apex, tv, scale }, sizes)
        const width = cabinet.width * Math.cos(yaw) + cabinet.depth * Math.abs(Math.sin(yaw))
        const extra: VacancyPlacement = { tv, tier: 0, index: local.length, x: direction * ((apexWidth + width) / 2 + GAP), y: 0, z: apex.z, yaw, scale }
        for (let step = 0; step < 40; step += 1) {
          const footprint = vacancyFootprint(cabinet, extra.x, extra.z, extra.yaw)
          if (!local.some(p => vacancyOverlapArea(footprint, vacancyFootprint(vacancyPlacementSize(p, sizes), p.x, p.z, p.yaw)) > 1e-6)) break
          extra.z -= .01
        }
        local.push(extra)
      }
    }
    const layer = local.map(p => ({ ...p, x: p.x * c + p.z * s, z: -p.x * s + p.z * c, yaw: p.yaw + turn }))
    const below = out.map(p => loadedBody(p, vacancyPlacementSize(p, sizes)))
    let candidate: VacancyPlacement[] | null = null
    for (let radius = 0; radius <= 12 && !candidate; radius += 1) {
      for (let dx = -radius; dx <= radius && !candidate; dx += 1) {
        if (side === 1 && dx !== 0) continue
        for (const dz of radius === 0 ? [0] : [radius - Math.abs(dx), Math.abs(dx) - radius]) {
          const moved = layer.map(p => ({ ...p, x: p.x + dx * .01, z: p.z + dz * .01 }))
          if (!moved.every(p => {
            const support = vacancySupport(vacancyPlacementSize(p, sizes), p.x, p.z, p.yaw, below)
            return Math.abs(support.y - p.y) < 1e-6 && support.margin >= VACANCY_MIN_SUPPORT_MARGIN && support.contactShare >= VACANCY_MIN_CONTACT_SHARE
              && (tierIndex === 0 || support.supportCount >= VACANCY_MIN_SUPPORT_COUNT)
          })) continue
          if (vacancyLoadMargins([...out, ...moved], sizes).every(margin => margin >= VACANCY_MIN_SUPPORT_MARGIN)) { candidate = moved; break }
        }
      }
    }
    if (!candidate) throw new Error(`VACANCY tier ${tierIndex} lacks stable multi-cabinet support.`)
    out.push(...candidate)
  })
  return out
}

/** The tower's footprint, for framing and for the stack-wall media layout. */
export function vacancyTowerBounds(layout: readonly VacancyPlacement[], sizes: Readonly<Record<VacancyTvId, VacancyTvSize>>) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0
  for (const p of layout) {
    const s = vacancyPlacementSize(p, sizes)
    const footprint = vacancyFootprint(s, p.x, p.z, p.yaw)
    minX = Math.min(minX, ...footprint.map(point => point[0])); maxX = Math.max(maxX, ...footprint.map(point => point[0]))
    minZ = Math.min(minZ, ...footprint.map(point => point[1])); maxZ = Math.max(maxZ, ...footprint.map(point => point[1]))
    maxY = Math.max(maxY, p.y + s.height)
  }
  return { minX, maxX, minZ, maxZ, height: maxY }
}

/** Audit used by tests and diagnostics: every set's support in a finished layout, judged against the sets that were placed before it. */
export function vacancyAuditLayout(layout: readonly VacancyPlacement[], sizes: Readonly<Record<VacancyTvId, VacancyTvSize>>) {
  return layout.map(p => {
    const below = layout.filter(other => other.tier < p.tier).map(other => loadedBody(other, vacancyPlacementSize(other, sizes)))
    return { placement: p, support: vacancySupport(vacancyPlacementSize(p, sizes), p.x, p.z, p.yaw, below) }
  })
}
