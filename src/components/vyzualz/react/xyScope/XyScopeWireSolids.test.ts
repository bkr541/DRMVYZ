import { describe, expect, it } from 'vitest'
import { emptyWireCue } from './XyScopeWireCues'
import { placeShape } from './XyScopeWireDeformer'
import { WireEngine, type WireTick } from './XyScopeWireEngine'
import { silentReading, type WireReading } from './XyScopeWireModulation'
import { quatFromAxisAngle } from './XyScopeWireProject'
import { routeEdges } from './XyScopeWireRoute'
import { buildCluster, buildFigure, edgesOfGroups, shapeHash, WIRE_FIGURES, WIRE_KINDS, wireSolidCounts, type WireFigureId, type WireKind } from './XyScopeWireShape'
import { WIRE_DEFAULTS, type WireValues } from './XyScopeWireSettings'

const EXPECTED: Record<WireKind, { vertices: number; edges: number; faces: number }> = {
  tetra: { vertices: 4, edges: 6, faces: 4 }, cube: { vertices: 8, edges: 12, faces: 6 }, octa: { vertices: 6, edges: 12, faces: 8 },
  icosa: { vertices: 12, edges: 30, faces: 20 }, dodeca: { vertices: 20, edges: 30, faces: 12 }, tesseract: { vertices: 16, edges: 32, faces: 0 },
}

describe('the solids', () => {
  it('builds each solid with the right corners, edges and faces (and Euler\'s formula holds for the five platonic ones)', () => {
    for (const kind of WIRE_KINDS) {
      expect(wireSolidCounts(kind), kind).toEqual(EXPECTED[kind])
      if (kind !== 'tesseract') { const c = EXPECTED[kind]; expect(c.vertices - c.edges + c.faces, kind).toBe(2) }
    }
  })

  it('winds every face outward, gives every edge two faces, and keeps every corner at the cube\'s radius', () => {
    for (const kind of WIRE_KINDS.filter(k => k !== 'tesseract')) {
      const shape = buildCluster([kind])
      for (let f = 0; f < shape.groups[0].faceCount; f++) {
        const from = shape.faceOffsets[f], to = shape.faceOffsets[f + 1]
        const corner = (i: number) => [shape.vertices[shape.faces[from + i] * 3], shape.vertices[shape.faces[from + i] * 3 + 1], shape.vertices[shape.faces[from + i] * 3 + 2]]
        const [a, b, c] = [corner(0), corner(1), corner(2)]
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]]
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        expect(n[0] * a[0] + n[1] * a[1] + n[2] * a[2], `${kind} face ${f}`).toBeGreaterThan(0)
        expect(to - from, kind).toBeGreaterThanOrEqual(3)
      }
      for (let e = 0; e < shape.groups[0].edgeCount; e++) expect([shape.edgeFaces[e * 2], shape.edgeFaces[e * 2 + 1]].every(x => x >= 0), `${kind} edge ${e}`).toBe(true)
      for (let i = 0; i < shape.groups[0].vertexCount; i++) expect(Math.hypot(shape.vertices[i * 3], shape.vertices[i * 3 + 1], shape.vertices[i * 3 + 2]), kind).toBeCloseTo(Math.sqrt(3), 4)
    }
  })

  it('gives the tesseract a fourth coordinate, no faces (so no edge is ever hidden) and three edges per axis pair', () => {
    const shape = buildCluster(['tesseract'])
    expect(shape.groups[0].faceCount).toBe(0)
    expect([...shape.edgeFaces].every(f => f === -1)).toBe(true)
    expect(new Set([...shape.vertexW]).size).toBe(2)
    expect([0, 1, 2].map(axis => [...shape.edgeAxis].filter(a => a === axis).length)).toEqual([8, 8, 16]) // x, y, then z and w together
  })

  it('assigns each edge the axis it mostly lies along', () => {
    const shape = buildCluster(['cube'])
    for (let e = 0; e < 12; e++) {
      const a = shape.edges[e * 2] * 3, b = shape.edges[e * 2 + 1] * 3
      const d = [0, 1, 2].map(i => Math.abs(shape.vertices[a + i] - shape.vertices[b + i]))
      expect(shape.edgeAxis[e]).toBe(d.indexOf(Math.max(...d)))
    }
  })

  it('draws every figure as one continuous route that covers every edge', () => {
    for (const figure of Object.keys(WIRE_FIGURES) as WireFigureId[]) {
      const shape = buildFigure(figure)
      for (const groups of [1, 3, 5]) {
        const edges = edgesOfGroups(shape, groups), edgeCount = edges.length / 2
        const started = performance.now()
        const route = routeEdges(shape.vertices.length / 3, edges)
        expect(performance.now() - started, `${figure}:${groups} routes quickly`).toBeLessThan(1500)
        const drawn = new Set<number>()
        for (let s = 0; s < route.length; s++) if (route.edge[s] >= 0) drawn.add(route.edge[s])
        expect(drawn.size, `${figure}:${groups}`).toBe(edgeCount)
        // The beam never jumps except at the hops: each step starts where the last one ended.
        for (let s = 0; s < route.length; s++) expect(route.from[(s + 1) % route.length], `${figure}:${groups} step ${s}`).toBe(route.to[s])
      }
    }
  })

  it('retraces the fewest edges: none for the even-degree solids, the cheapest set for the rest', () => {
    const retraced = (kind: WireKind) => { const s = buildCluster([kind]); return routeEdges(s.vertices.length / 3, s.edges).retraced }
    expect(retraced('octa')).toBe(0)
    expect(retraced('tesseract')).toBe(0)
    expect(retraced('cube')).toBe(4)
    expect(retraced('tetra')).toBe(2)
    expect(retraced('icosa')).toBeGreaterThan(0)
    expect(retraced('dodeca')).toBeGreaterThan(0)
  })

  it('is immutable: each figure\'s hash is stable, different between figures, and unchanged by a long performance', () => {
    const hashes = (Object.keys(WIRE_FIGURES) as WireFigureId[]).map(figure => shapeHash(buildFigure(figure)))
    expect(new Set(hashes).size).toBe(3)
    expect(shapeHash(buildFigure('solids'))).toBe(buildFigure('solids').sourceHash)
    const engine = new WireEngine()
    const before = hashes.slice()
    for (let f = 0; f < 240; f++) engine.tick(tick({ reading: loud(f), values: { ...WIRE_DEFAULTS, figure: (['cubes', 'solids', 'tesseract'] as const)[Math.floor(f / 80)] } }))
    expect((Object.keys(WIRE_FIGURES) as WireFigureId[]).map(figure => shapeHash(buildFigure(figure)))).toEqual(before)
  })
})

describe('the fourth dimension', () => {
  it('turns the tesseract through 4D (its projected edges change length, as a real hypercube\'s shadow does) without moving it as a whole', () => {
    const shape = buildCluster(['tesseract'])
    const out = new Float32Array(16 * 3), turned = new Float32Array(16 * 3)
    const q = quatFromAxisAngle(0, 1, 0, 0)
    placeShape(shape, [{ cx: 0, cy: 0, cz: 0, q, scale: 1, hyper: [0, 0, 0] }], out)
    placeShape(shape, [{ cx: 0, cy: 0, cz: 0, q, scale: 1, hyper: [.9, .5, .3] }], turned)
    const length = (p: Float32Array, e: number) => { const a = shape.edges[e * 2] * 3, b = shape.edges[e * 2 + 1] * 3; return Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]) }
    const changed = Array.from({ length: 32 }, (_, e) => Math.abs(length(out, e) - length(turned, e))).filter(x => x > 1e-3).length
    expect(changed).toBeGreaterThan(8)
    for (const v of [...out, ...turned]) expect(Number.isFinite(v)).toBe(true)
    // It stays about the size of the other solids at any angle.
    for (const p of [out, turned]) for (let i = 0; i < 16; i++) expect(Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2])).toBeLessThan(3.4)
  })

  it('draws a tesseract figure that stays finite, on screen and never hides an edge', () => {
    const engine = new WireEngine()
    for (let f = 0; f < 200; f++) engine.tick(tick({ reading: loud(f), values: { ...WIRE_DEFAULTS, figure: 'tesseract', satellites: 4, duplicates: 3, chaos: 1 } }))
    expect(engine.figure).toBe('tesseract')
    const out = { x: 0, y: 0, z: 0, energy: 0, q: 0 }
    for (let k = 0; k < 4000; k++) {
      engine.signal(engine.letters[0], 0, k / 4000, 0, 0, out)
      expect(Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.energy)).toBe(true)
      expect(Math.abs(out.x)).toBeLessThan(2.4)
      expect(Math.abs(out.y)).toBeLessThan(2.4)
    }
  })
})

describe('mixed figures in the engine', () => {
  it('draws every figure with every satellite count, within the stage and with a bounded brightness', () => {
    for (const figure of ['cubes', 'solids', 'tesseract'] as const) for (const satellites of [0, 2, 4]) {
      const engine = new WireEngine()
      for (let f = 0; f < 90; f++) engine.tick(tick({ reading: loud(f), values: { ...WIRE_DEFAULTS, figure, satellites } }))
      const out = { x: 0, y: 0, z: 0, energy: 0, q: 0 }
      let peak = 0
      for (let k = 0; k < 3000; k++) { engine.signal(engine.letters[0], 0, k / 3000, 0, 0, out); peak = Math.max(peak, Math.hypot(out.x, out.y)); expect(out.energy).toBeLessThan(30) }
      expect(peak, `${figure} ${satellites}`).toBeGreaterThan(.2)
      expect(peak, `${figure} ${satellites}`).toBeLessThan(2.4)
      expect(engine.pointCount).toBeGreaterThan(0)
    }
  })

  it('grows a new figure in rather than popping it, and the figure that was chosen is the one drawn', () => {
    const engine = new WireEngine()
    for (let f = 0; f < 30; f++) engine.tick(tick({ reading: loud(f), values: { ...WIRE_DEFAULTS, figure: 'cubes' } }))
    const settled = engine.base[0]
    engine.tick(tick({ reading: loud(31), values: { ...WIRE_DEFAULTS, figure: 'solids' } }))
    expect(engine.shape.id).toBe('solids')
    expect(engine.shape.groups[0].kind).toBe('dodeca')
    expect(Math.hypot(engine.base[0], engine.base[1], engine.base[2])).toBeLessThan(Math.sqrt(3) * .9)
    for (let f = 0; f < 60; f++) engine.tick(tick({ reading: loud(f), values: { ...WIRE_DEFAULTS, figure: 'solids' } }))
    expect(Number.isFinite(settled)).toBe(true)
    expect(Math.hypot(...[0, 1, 2].map(i => engine.base[i]))).toBeGreaterThan(1)
  })
})

function tick(over: Partial<WireTick> = {}): WireTick {
  return { dt: 1 / 60, reading: loud(0), cue: emptyWireCue(), values: WIRE_DEFAULTS as WireValues, auto: false, discontinuity: false, ...over }
}
function loud(frame: number): WireReading {
  const swing = .5 + .5 * Math.sin(frame / 60 * 7)
  return {
    ...silentReading(), playing: true, confidence: .9,
    features: { sub: swing, bass: swing, lowMid: swing, mid: swing * .8, air: swing * .6, flux: swing, level: .4 + swing * .5 },
    available: { sub: true, bass: true, lowMid: true, mid: true, air: true, flux: true, level: true },
    hits: { kick: frame % 30 === 0 ? 1 : 0, snare: frame % 60 === 30 ? .9 : 0, hat: 0 },
  }
}
