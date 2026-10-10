/**
 * Turns the GOONZ master SVG into a scanned-looking point and wire cloud, from the artwork's real vector geometry
 * (not from a raster): every path outline becomes contour points joined by wire segments, every filled shape is
 * stippled by tone, large shapes get a triangulated mesh, and a loose halo of points surrounds the silhouette.
 * Shapes keep their drawing order as depth, so the headphones sit behind the head and the nose and eyes in front.
 */

/** Per-vertex kinds, read by the shader. */
export const ECHOFORM_KIND = Object.freeze({ contour: 0, fill: 1, wire: 2, halo: 3, eye: 4, node: 5 })

export interface Cinema2EchoformGeometry {
  /**
   * Interleaved points: x, y, z, tone, random, order, kind, then the orchestration attributes Mainframe's programs read:
   * route (which artwork shape), bank (0-3, vertical bars), region (0-7, sectors round the figure in Mainframe's numbering),
   * system (which anatomical group) and phase (0 at the middle of the figure to 1 at its edge).
   */
  readonly points: Float32Array
  readonly pointCount: number
  /** Interleaved wire vertices (two per segment): x, y, z, tone, random, order, kind. */
  readonly lines: Float32Array
  readonly lineVertexCount: number
}

export const ECHOFORM_VERTEX_FLOATS = 12

/** Mainframe's Quadrant Relay / Radar Sweep region numbering, clockwise on screen from the bottom: bottom 0, bottom-left 1, left 2, top-left 3, top 7, top-right 6, right 5, bottom-right 4. */
const REGION_BY_SLOT = Object.freeze([0, 1, 2, 3, 7, 6, 5, 4] as const)

/** Anatomical group (the SVG's 01-10 layers) to Mainframe's nine system gains: headphones 1, brows and markings 2, head and ears 3, eyes 6, nose 7, mouth 8. */
const SYSTEM_BY_GROUP = Object.freeze([1, 1, 3, 3, 2, 6, 2, 7, 7, 8] as const)

type Vec = readonly [number, number]

interface Shape {
  readonly rings: Vec[][]
  readonly tone: number
  readonly eye: boolean
  readonly depth: number
  readonly area: number
  readonly group: number
  readonly opaque: boolean
  readonly bounds: readonly [number, number, number, number]
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hexTone(hex: string): number {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map(char => char + char).join('') : value
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function isCyan(hex: string): boolean {
  const value = hex.replace('#', '')
  if (value.length < 6) return false
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return b > 150 && g > 120 && r < 90
}

function parseGradients(svg: string): Map<string, { tone: number; cyan: boolean }> {
  const gradients = new Map<string, { tone: number; cyan: boolean }>()
  for (const match of svg.matchAll(/<(?:linearGradient|radialGradient)\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:linearGradient|radialGradient)>/g)) {
    const stops = [...match[2]!.matchAll(/stop-color="(#[0-9a-fA-F]{3,6})"/g)].map(stop => stop[1]!)
    if (!stops.length) continue
    gradients.set(match[1]!, {
      tone: stops.reduce((sum, stop) => sum + hexTone(stop), 0) / stops.length,
      cyan: stops.some(isCyan),
    })
  }
  return gradients
}

function flattenPath(d: string): Vec[][] {
  const tokens = d.match(/[MLCVHZmlcvhz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  const rings: Vec[][] = []
  let ring: Vec[] = []
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let command = ''
  let index = 0
  const next = () => Number(tokens[index++])
  const close = () => {
    if (ring.length > 2) rings.push(ring)
    ring = []
  }
  while (index < tokens.length) {
    const token = tokens[index]!
    if (/[A-Za-z]/.test(token)) {
      command = token
      index += 1
      if (command === 'Z' || command === 'z') {
        close()
        x = startX
        y = startY
        continue
      }
    }
    if (command === 'M') {
      close()
      x = next()
      y = next()
      startX = x
      startY = y
      ring.push([x, y])
      command = 'L'
    } else if (command === 'L') {
      x = next()
      y = next()
      ring.push([x, y])
    } else if (command === 'H') {
      x = next()
      ring.push([x, y])
    } else if (command === 'V') {
      y = next()
      ring.push([x, y])
    } else if (command === 'C') {
      const x1 = next()
      const y1 = next()
      const x2 = next()
      const y2 = next()
      const x3 = next()
      const y3 = next()
      const steps = 16
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps
        const u = 1 - t
        ring.push([
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ])
      }
      x = x3
      y = y3
    } else {
      index += 1
    }
  }
  close()
  return rings
}

function ringArea(ring: readonly Vec[]): number {
  let sum = 0
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index]!
    const b = ring[(index + 1) % ring.length]!
    sum += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(sum) / 2
}

function pointInRings(x: number, y: number, rings: readonly (readonly Vec[])[]): boolean {
  let inside = false
  for (const ring of rings) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const a = ring[index]!
      const b = ring[previous]!
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
    }
  }
  return inside
}

/** How a different artwork is read into the cloud: shape tones, which shapes are the focal (eye-like) glow, and the figure's longest side. */
export interface Cinema2EchoformGeometryOptions {
  readonly seed?: number
  /** Overrides the tone read from a shape's fill, by path id (0 dark, 1 bright). */
  readonly toneById?: Readonly<Record<string, number>>
  /** Path ids that are the focal feature, lit like the eyes. */
  readonly focalIds?: readonly string[]
  /** Multiplies the tone of every outline, so shapes that are dark mass still read as drawn letters. Default 1. */
  readonly contourBoost?: number
  /** World size of the figure's longest side; the GOONZ figure is 1.8. */
  readonly size?: number
}

function parseShapes(svg: string, options: Cinema2EchoformGeometryOptions = {}): Shape[] {
  const gradients = parseGradients(svg)
  const logoStart = svg.indexOf('<g id="logo"')
  const body = logoStart >= 0 ? svg.slice(logoStart) : svg
  const paths = [...body.matchAll(/<path\b([^>]*?)\/?>/g)]
  const shapes: Shape[] = []
  const groupStarts = [...body.matchAll(/<g id="(\d\d)-/g)].map(group => ({ at: group.index ?? 0, group: Number(group[1]) - 1 }))
  paths.forEach((match, order) => {
    const attributes = match[1]!
    const pathAt = match.index ?? 0
    let group = 0
    for (const start of groupStarts) if (start.at <= pathAt) group = start.group
    const d = /\bd="([^"]+)"/.exec(attributes)?.[1]
    if (!d) return
    const fill = /\bfill="([^"]+)"/.exec(attributes)?.[1] ?? 'none'
    const stroke = /\bstroke="([^"]+)"/.exec(attributes)?.[1] ?? 'none'
    const id = /\bid="([^"]+)"/.exec(attributes)?.[1] ?? ''
    let tone = 0.1
    let eye = /iris|pupil-glint|eye-glint/.test(id)
    if (fill.startsWith('url(#')) {
      const gradient = gradients.get(fill.slice(5, -1))
      if (gradient) {
        tone = gradient.tone
        if (gradient.cyan) eye = true
      }
    } else if (fill.startsWith('#')) {
      tone = hexTone(fill)
      if (isCyan(fill)) eye = true
    } else if (stroke.startsWith('url(#')) {
      tone = gradients.get(stroke.slice(5, -1))?.tone ?? 0.5
    }
    if (options.toneById && id in options.toneById) tone = options.toneById[id]!
    if (options.focalIds?.includes(id)) eye = true
    const rings = flattenPath(d)
    if (!rings.length) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let area = 0
    for (const ring of rings) {
      area += ringArea(ring)
      for (const [px, py] of ring) {
        minX = Math.min(minX, px)
        maxX = Math.max(maxX, px)
        minY = Math.min(minY, py)
        maxY = Math.max(maxY, py)
      }
    }
    shapes.push({ rings, tone, eye, depth: order / Math.max(1, paths.length - 1), area, group: Math.max(0, Math.min(9, group)), opaque: fill !== 'none', bounds: [minX, minY, maxX, maxY] })
  })
  return shapes
}

export function buildCinema2EchoformGeometry(svg: string, options: Cinema2EchoformGeometryOptions = {}): Cinema2EchoformGeometry {
  const random = rng(options.seed ?? 20240611)
  const shapes = parseShapes(svg, options)
  if (!shapes.length) return { points: new Float32Array(0), pointCount: 0, lines: new Float32Array(0), lineVertexCount: 0 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const shape of shapes) {
    minX = Math.min(minX, shape.bounds[0])
    minY = Math.min(minY, shape.bounds[1])
    maxX = Math.max(maxX, shape.bounds[2])
    maxY = Math.max(maxY, shape.bounds[3])
  }
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const scale = (options.size ?? 1.8) / Math.max(maxX - minX, maxY - minY)
  const toWorld = (x: number, y: number): Vec => [(x - centerX) * scale, -(y - centerY) * scale]
  const maxRadius = Math.hypot((maxX - minX) / 2, (maxY - minY) / 2)

  const points: number[] = []
  const lines: number[] = []
  const spanX = Math.max(1, maxX - minX)
  const push = (target: number[], x: number, y: number, z: number, tone: number, rand: number, order: number, kind: number, shapeIndex = 0) => {
    const [wx, wy] = toWorld(x, y)
    const dx = x - centerX
    const dy = y - centerY
    const route = shapeIndex
    const bank = Math.min(7, Math.max(0, Math.floor(((x - minX) / spanX) * 8))) % 4
    const angle = Math.atan2(-dx, dy)
    const slot = Math.floor((((angle + Math.PI / 8) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4)) % 8
    const system = SYSTEM_BY_GROUP[shapes[shapeIndex]?.group ?? 0] ?? 1
    const phase = Math.min(1, Math.hypot(dx / (spanX / 2), dy / ((maxY - minY) / 2)) / 1.15)
    target.push(wx, wy, z, tone, rand, order, kind, route, bank, REGION_BY_SLOT[slot]!, system, phase)
  }
  // Reveal order: the middle of the figure assembles first, the edges and the scatter last.
  const orderOf = (x: number, y: number, rand: number, spread: number) =>
    Math.min(1, Math.max(0, (Math.hypot(x - centerX, y - centerY) / maxRadius) * (1 - spread) + rand * spread))
  const depthOf = (shape: Shape) => (shape.depth - 0.5) * 0.46

  // Painter's algorithm baked into the cloud: anything covered by a later (nearer) opaque shape is never emitted,
  // so the figure reads as the logo's visible surface with clean hidden-line removal.
  const occluded = (x: number, y: number, index: number): boolean => {
    for (let other = index + 1; other < shapes.length; other += 1) {
      const front = shapes[other]!
      if (!front.opaque) continue
      const [bx0, by0, bx1, by1] = front.bounds
      if (x < bx0 || x > bx1 || y < by0 || y > by1) continue
      if (pointInRings(x, y, front.rings)) return true
    }
    return false
  }

  const total = shapes.reduce((sum, shape) => sum + shape.area, 0)
  const fillBudget = 42000

  for (const [shapeIndex, shape] of shapes.entries()) {
    const z = depthOf(shape)
    const visible = shape.tone > 0.035 || shape.eye
    const contourWeight = shape.eye ? 1 : (0.35 + shape.tone) * (options.contourBoost ?? 1)

    // Contours: points and wire segments along every outline.
    for (const ring of shape.rings) {
      const spacing = 2.6
      const samples: Vec[] = []
      let carry = 0
      for (let index = 0; index < ring.length; index += 1) {
        const a = ring[index]!
        const b = ring[(index + 1) % ring.length]!
        const length = Math.hypot(b[0] - a[0], b[1] - a[1])
        let distance = carry
        while (distance < length) {
          const t = length === 0 ? 0 : distance / length
          samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
          distance += spacing
        }
        carry = distance - length
      }
      for (let index = 0; index < samples.length; index += 1) {
        const a = samples[index]!
        const b = samples[(index + 1) % samples.length]!
        const rand = random()
        if (occluded(a[0], a[1], shapeIndex) || occluded(b[0], b[1], shapeIndex)) continue
        const order = orderOf(a[0], a[1], rand, 0.28) * 0.55
        const tone = Math.min(1, contourWeight)
        if (visible || rand < 0.45) push(points, a[0], a[1], z, tone, rand, order, shape.eye ? ECHOFORM_KIND.eye : ECHOFORM_KIND.contour, shapeIndex)
        push(lines, a[0], a[1], z, tone, rand, order, ECHOFORM_KIND.wire, shapeIndex)
        push(lines, b[0], b[1], z, tone, rand, order, ECHOFORM_KIND.wire, shapeIndex)
      }
    }

    // Stipple fill, density following the shape's area; dark shapes get the sparse magenta stipple.
    const share = shape.area / total
    const count = Math.min(5200, Math.floor(fillBudget * share * (shape.eye ? 3 : 1)))
    const [x0, y0, x1, y1] = shape.bounds
    const nodes: Vec[] = []
    for (let attempt = 0, made = 0; made < count && attempt < count * 14; attempt += 1) {
      const x = x0 + random() * (x1 - x0)
      const y = y0 + random() * (y1 - y0)
      if (!pointInRings(x, y, shape.rings)) continue
      made += 1
      if (occluded(x, y, shapeIndex)) continue
      const rand = random()
      push(points, x, y, z + (random() - 0.5) * 0.02, shape.tone, rand, orderOf(x, y, rand, 0.5), shape.eye ? ECHOFORM_KIND.eye : ECHOFORM_KIND.fill, shapeIndex)
      if (made % 16 === 0) nodes.push([x, y])
    }

    // Triangulated wire: each node joins its nearest neighbours inside the same shape.
    if (shape.area > 900 && visible) {
      for (const ring of shape.rings) {
        for (let index = 0; index < ring.length; index += 14) nodes.push(ring[index]!)
      }
      for (let index = 0; index < nodes.length; index += 1) {
        const a = nodes[index]!
        const near = nodes
          .map((b, other) => ({ other, distance: other === index ? Infinity : Math.hypot(a[0] - b[0], a[1] - b[1]) }))
          .sort((p, q) => p.distance - q.distance)
          .slice(0, 1)
        for (const { other, distance } of near) {
          const b = nodes[other]!
          if (distance > 36 || occluded(a[0], a[1], shapeIndex) || !pointInRings((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, shape.rings)) continue
          const rand = random()
          const order = orderOf(a[0], a[1], rand, 0.45) * 0.8
          push(lines, a[0], a[1], z, shape.tone, rand, order, ECHOFORM_KIND.wire, shapeIndex)
          push(lines, b[0], b[1], z, shape.tone, rand, order, ECHOFORM_KIND.wire, shapeIndex)
        }
        if (random() < 0.6) push(points, a[0], a[1], z, shape.tone, random(), orderOf(a[0], a[1], random(), 0.4) * 0.8, ECHOFORM_KIND.node, shapeIndex)
      }
    }
  }

  // Halo: loose points scattered around the silhouette at varied depth.
  const halo = 4200
  for (let made = 0; made < halo; made += 1) {
    const angle = random() * Math.PI * 2
    const rx = (maxX - minX) / 2
    const ry = (maxY - minY) / 2
    const spread = 1.02 + Math.pow(random(), 1.7) * 0.28
    const x = centerX + Math.cos(angle) * rx * spread * (0.86 + 0.14 * Math.abs(Math.sin(angle * 2)))
    const y = centerY + Math.sin(angle) * ry * spread
    const rand = random()
    push(points, x, y, (random() - 0.5) * 0.7, 0.35 + random() * 0.3, rand, 0.55 + rand * 0.45, ECHOFORM_KIND.halo)
  }

  return {
    points: new Float32Array(points),
    pointCount: points.length / ECHOFORM_VERTEX_FLOATS,
    lines: new Float32Array(lines),
    lineVertexCount: lines.length / ECHOFORM_VERTEX_FLOATS,
  }
}
