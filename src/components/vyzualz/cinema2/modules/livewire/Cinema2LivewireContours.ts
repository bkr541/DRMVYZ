import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'

type Point = readonly [number, number]
export interface LivewireStroke {
  start: Point
  end: Point
}

function distanceSquared(x: number, y: number, { start, end }: LivewireStroke): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const t = Math.max(0, Math.min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy)))
  return (x - start[0] - t * dx) ** 2 + (y - start[1] - t * dy) ** 2
}

// Extract closed boundaries of the union of all stroke profiles. Junctions and
// crossings disappear into a single face, and enclosed counters become holes.
function contours(strokes: readonly LivewireStroke[], radius: number): Point[][] {
  const step = 0.025
  const padding = radius + step * 2
  const xmin = Math.min(...strokes.map(({ start, end }) => Math.min(start[0], end[0]))) - padding
  const ymin = Math.min(...strokes.map(({ start, end }) => Math.min(start[1], end[1]))) - padding
  const xmax = Math.max(...strokes.map(({ start, end }) => Math.max(start[0], end[0]))) + padding
  const ymax = Math.max(...strokes.map(({ start, end }) => Math.max(start[1], end[1]))) + padding
  const columns = Math.ceil((xmax - xmin) / step) + 1
  const rows = Math.ceil((ymax - ymin) / step) + 1
  const field = new Float32Array(columns * rows)
  const profiles = strokes.map(({ start, end }) => {
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const length = Math.hypot(dx, dy)
    return { x: (start[0] + end[0]) / 2, y: (start[1] + end[1]) / 2, dx: dx / length, dy: dy / length, halfLength: length / 2 }
  })
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      let union = -Infinity
      for (const profile of profiles) {
        const px = xmin + x * step - profile.x
        const py = ymin + y * step - profile.y
        const axial = Math.abs(px * profile.dx + py * profile.dy) - profile.halfLength
        const lateral = Math.abs(-px * profile.dy + py * profile.dx)
        // Flat ends and a diagonal corner cut give the merged strokes machined chamfers.
        union = Math.max(union, Math.min(radius - lateral, radius * 0.72 - axial, radius * 1.32 - axial - lateral))
      }
      field[y * columns + x] = union
    }
  }

  const points = new Map<number, Point>()
  const neighbors = new Map<number, number[]>()
  const link = (a: number, b: number) => {
    if (!neighbors.has(a)) neighbors.set(a, [])
    if (!neighbors.has(b)) neighbors.set(b, [])
    neighbors.get(a)!.push(b)
    neighbors.get(b)!.push(a)
  }
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < columns - 1; x++) {
      const i = y * columns + x
      const samples = [field[i]!, field[i + 1]!, field[i + columns + 1]!, field[i + columns]!]
      const corners: Point[] = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]
      const edges = [i * 2, (i + 1) * 2 + 1, (i + columns) * 2, i * 2 + 1]
      const crossed = edges.filter((key, edge) => {
        const end = (edge + 1) % 4
        const a = samples[edge]!
        const b = samples[end]!
        if ((a > 0) === (b > 0)) return false
        if (!points.has(key)) {
          const from = corners[edge]!
          const to = corners[end]!
          const t = a / (a - b)
          points.set(key, [xmin + (from[0] + (to[0] - from[0]) * t) * step, ymin + (from[1] + (to[1] - from[1]) * t) * step])
        }
        return true
      })
      if (crossed.length === 2) link(crossed[0]!, crossed[1]!)
      if (crossed.length === 4) {
        // In a saddle cell, preserve connectivity on the side containing its centre.
        const centerInside = samples.reduce((sum, value) => sum + value, 0) > 0
        const offset = (samples[0]! > 0) === centerInside ? 0 : 1
        link(crossed[offset]!, crossed[(offset + 1) % 4]!)
        link(crossed[(offset + 2) % 4]!, crossed[(offset + 3) % 4]!)
      }
    }
  }

  const loops: Point[][] = []
  const seen = new Set<number>()
  for (const first of neighbors.keys()) {
    if (seen.has(first)) continue
    const loop: Point[] = []
    let current: number | undefined = first
    while (current !== undefined && !seen.has(current)) {
      const next: number | undefined = neighbors.get(current)?.find(key => !seen.has(key))
      loop.push(points.get(current)!)
      seen.add(current)
      current = next
    }
    // Collapse the long runs of nearly collinear marching segments while keeping bevel corners.
    for (let index = loop.length - 1; index >= 0 && loop.length > 4; index--) {
      const a = loop[(index + loop.length - 1) % loop.length]!
      const b = loop[index]!
      const c = loop[(index + 1) % loop.length]!
      if (distanceSquared(b[0], b[1], { start: a, end: c }) < 0.000004) loop.splice(index, 1)
    }
    if (loop.length >= 3 && Math.abs(area(loop)) > 0.0004) loops.push(loop)
  }
  return loops.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))
}

function area(points: readonly Point[]) {
  return points.reduce((total, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length]!
    return total + x * nextY - y * nextX
  }, 0) / 2
}

function contains(points: readonly Point[], [x, y]: Point): boolean {
  let inside = false
  for (let index = 0; index < points.length; index++) {
    const [ax, ay] = points[index]!
    const [bx, by] = points[(index + 1) % points.length]!
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside
  }
  return inside
}

export function livewireGlyphShapes(THREE: Cinema2ThreeLibrary['THREE'], strokes: readonly LivewireStroke[], radius: number) {
  const rings = contours(strokes, radius)
  const boundaries: Array<{ ring: Point[]; depth: number; shape: InstanceType<typeof THREE.Shape> }> = []
  const shapes: InstanceType<typeof THREE.Shape>[] = []
  for (const ring of rings) {
    const parent = [...boundaries].reverse().find(boundary => contains(boundary.ring, ring[0]!))
    const depth = parent ? parent.depth + 1 : 0
    const vectors = ring.map(([x, y]) => new THREE.Vector2(x, y))
    if (depth % 2 === 1 && parent) {
      if (THREE.ShapeUtils.isClockWise(vectors)) vectors.reverse()
      parent.shape.holes.push(new THREE.Path(vectors))
      boundaries.push({ ring, depth, shape: parent.shape })
    } else {
      if (!THREE.ShapeUtils.isClockWise(vectors)) vectors.reverse()
      const shape = new THREE.Shape(vectors)
      shapes.push(shape)
      boundaries.push({ ring, depth, shape })
    }
  }
  return shapes
}

export function livewireShapeContains(shape: InstanceType<Cinema2ThreeLibrary['THREE']['Shape']>, point: { x: number; y: number }) {
  return contains(shape.getPoints().map(({ x, y }) => [x, y]), [point.x, point.y])
    && !shape.holes.some(hole => contains(hole.getPoints().map(({ x, y }) => [x, y]), [point.x, point.y]))
}
