import { describe, expect, it } from 'vitest'
import { buildCubeCluster, edgesOfGroups, hashShapeData, shapeHash, MAX_WIRE_CUBES } from './XyScopeWireShape'
import { routeEdges } from './XyScopeWireRoute'
import { DEFAULT_WIRE_CAMERA, findHiddenEdges, projectPoint, quatFromAxisAngle, quatMul, quatNormalize, quatRotate } from './XyScopeWireProject'
import { Envelope, SourceRelativeNormalizer, WireModMatrix, silentReading, type WireModSettings, type WireReading } from './XyScopeWireModulation'
import { applyField, constrainWeight, displacementField, measureReadability, placeShape, type CubePlacement } from './XyScopeWireDeformer'
import { BASE_SCENE, WIRE_SCENES, WireDirector, NO_BOUNDARIES, type DirectorInput } from './XyScopeWireDirector'

// ── Shape ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('the cube cluster (immutable shape)', () => {
  const shape = buildCubeCluster()

  it('is five cubes of eight corners, twelve edges and six faces each', () => {
    expect(shape.groups).toHaveLength(MAX_WIRE_CUBES)
    expect(shape.vertices.length).toBe(MAX_WIRE_CUBES * 8 * 3)
    expect(shape.edges.length).toBe(MAX_WIRE_CUBES * 12 * 2)
    expect(shape.faces.length).toBe(MAX_WIRE_CUBES * 6 * 4)
    expect(shape.groups[0].id).toBe('core')
    expect(shape.groups[4].id).toBe('satellite-4')
  })

  it('winds every face outward and gives every edge exactly two faces', () => {
    for (let f = 0; f < shape.faces.length / 4; f++) {
      const c = [0, 0, 0], p = [0, 1, 2, 3].map(i => shape.faces[f * 4 + i] * 3)
      for (const o of p) { c[0] += shape.vertices[o]; c[1] += shape.vertices[o + 1]; c[2] += shape.vertices[o + 2] }
      const u = [0, 1, 2].map(i => shape.vertices[p[1] + i] - shape.vertices[p[0] + i]), v = [0, 1, 2].map(i => shape.vertices[p[2] + i] - shape.vertices[p[1] + i])
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      expect(n[0] * c[0] + n[1] * c[1] + n[2] * c[2]).toBeGreaterThan(0)
    }
    for (let e = 0; e < shape.edges.length / 2; e++) expect([shape.edgeFaces[e * 2], shape.edgeFaces[e * 2 + 1]].filter(f => f >= 0)).toHaveLength(2)
  })

  it('hashes its content: the same shape hashes the same, and changing a corner changes the hash', () => {
    expect(buildCubeCluster().sourceHash).toBe(shape.sourceHash)
    expect(shapeHash(shape)).toBe(shape.sourceHash)
    const moved = shape.vertices.slice(); moved[0] += .001
    expect(hashShapeData(moved, shape.edges, shape.faces)).not.toBe(shape.sourceHash)
  })

  it('takes the edges of the first cubes only', () => {
    expect(edgesOfGroups(shape, 1)).toHaveLength(24)
    expect(edgesOfGroups(shape, 3)).toHaveLength(72)
  })
})

// ── Routing ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Every step starts where the last one ended, unless it is a hop; the whole route loops. */
function assertContinuous(route: ReturnType<typeof routeEdges>) {
  for (let s = 0; s < route.length; s++) {
    const next = (s + 1) % route.length
    if (route.edge[s] >= 0 && route.edge[next] >= 0) expect(route.to[s], `step ${s}`).toBe(route.from[next])
  }
}

describe('stroke routing', () => {
  const cube = buildCubeCluster(1)

  it('draws a cube in one continuous stroke by retracing the four edges it must', () => {
    const route = routeEdges(8, cube.edges)
    expect(route.retraced).toBe(4)
    expect(route.length).toBe(16)
    expect(route.hops).toBe(0)
    assertContinuous(route)
    expect(route.to[route.length - 1]).toBe(route.from[0])
    expect(new Set([...route.edge])).toEqual(new Set(Array.from({ length: 12 }, (_, i) => i)))
  })

  it('keeps every edge equally bright: its steps share one unit of brightness', () => {
    const route = routeEdges(8, cube.edges)
    const total = new Float64Array(12)
    for (let s = 0; s < route.length; s++) total[route.edge[s]] += 1 / route.multiplicity[s]
    for (const t of total) expect(t).toBeCloseTo(1, 9)
  })

  it('needs no retracing where every corner already has an even number of edges (an octahedron)', () => {
    const corners = [[0, 2], [0, 4], [0, 3], [0, 5], [1, 2], [1, 4], [1, 3], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]].flat()
    const route = routeEdges(6, corners)
    expect(route.retraced).toBe(0)
    expect(route.length).toBe(12)
    assertContinuous(route)
  })

  it('retraces the fewest edges for a tetrahedron (four odd corners need two)', () => {
    const route = routeEdges(4, [0, 1, 0, 2, 0, 3, 1, 2, 1, 3, 2, 3])
    expect(route.retraced).toBe(2)
    assertContinuous(route)
  })

  it('hops between separate cubes, once between each pair and once to close the loop', () => {
    const route = routeEdges(24, edgesOfGroups(buildCubeCluster(3), 3))
    expect(route.hops).toBe(3)
    expect(route.length).toBe(3 * 16 + 3)
    assertContinuous(route)
    for (let s = 0; s < route.length; s++) if (route.edge[s] < 0) expect(route.multiplicity[s]).toBe(1)
  })

  it('is deterministic', () => {
    const a = routeEdges(8, cube.edges), b = routeEdges(8, cube.edges)
    expect([...a.from]).toEqual([...b.from])
    expect([...a.edge]).toEqual([...b.edge])
  })
})

// ── Projection ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('projection', () => {
  it('rotates with quaternions: a quarter turn about z carries x to y, and rotations compose in order', () => {
    const out = new Float32Array(3)
    quatRotate(quatFromAxisAngle(0, 0, 1, Math.PI / 2), 1, 0, 0, out)
    expect([out[0], out[1], out[2]].map(v => Math.round(v * 1e5) / 1e5 + 0)).toEqual([0, 1, 0])
    const turn = quatNormalize(quatMul(quatFromAxisAngle(0, 1, 0, Math.PI / 2), quatFromAxisAngle(0, 0, 1, Math.PI / 2)))
    quatRotate(turn, 1, 0, 0, out) // z first (x to y), then y (y stays)
    expect([out[0], out[1], out[2]].map(v => Math.round(v * 1e5) / 1e5 + 0)).toEqual([0, 1, 0])
  })

  it('has no foreshortening when orthographic, and nearer points larger when perspective', () => {
    const out = new Float32Array(2)
    const ortho = { ...DEFAULT_WIRE_CAMERA, perspective: 0 }, persp = { ...DEFAULT_WIRE_CAMERA, perspective: 1 }
    projectPoint(1, 0, 3, ortho, out); const near = out[0]
    projectPoint(1, 0, -3, ortho, out); expect(out[0]).toBe(near)
    projectPoint(1, 0, 3, persp, out); const big = out[0]
    projectPoint(1, 0, -3, persp, out); expect(big).toBeGreaterThan(out[0])
  })

  it('stays finite for points at or behind the camera and reports them as not visible', () => {
    const out = new Float32Array(2), camera = { ...DEFAULT_WIRE_CAMERA, perspective: 1 }
    for (const z of [camera.distance - camera.near, camera.distance, camera.distance + 5, 1e6]) {
      const visible = projectPoint(2, 3, z, camera, out)
      expect(Number.isFinite(out[0]) && Number.isFinite(out[1])).toBe(true)
      expect(visible).toBe(z < camera.distance - camera.near + 1e-9)
    }
  })

  it('hides the three edges that meet at a cube\'s far corner, and no others', () => {
    const shape = buildCubeCluster(1)
    const q = quatNormalize(quatMul(quatFromAxisAngle(1, 0, 0, .61), quatFromAxisAngle(0, 1, 0, .79)))
    const world = new Float32Array(24), projected = new Float32Array(16), hidden = new Uint8Array(12)
    placeShape(shape, [{ cx: 0, cy: 0, cz: 0, q, scale: 1 }], world)
    for (let i = 0; i < 8; i++) projectPoint(world[i * 3], world[i * 3 + 1], world[i * 3 + 2], { ...DEFAULT_WIRE_CAMERA, perspective: 0 }, projected, i * 2)
    findHiddenEdges(shape.faces, shape.edgeFaces, projected, 0, 12, hidden)
    expect(hidden.reduce((a, b) => a + b, 0)).toBe(3)
    const hiddenEdges = [...hidden].flatMap((h, e) => h ? [[shape.edges[e * 2], shape.edges[e * 2 + 1]]] : [])
    const shared = hiddenEdges.flat().filter(v => hiddenEdges.flat().filter(w => w === v).length === 3)
    expect(new Set(shared).size).toBe(1) // all three share one corner
  })
})

// ── Modulation ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('track-relative normalisation', () => {
  /** A steady pulse: the feature swings between 20% and 100% of `peak`. */
  function swing(peak: number, seconds = 12) {
    const n = new SourceRelativeNormalizer(), values: number[] = []
    for (let i = 0; i < seconds * 60; i++) values.push(n.update(peak * (.6 + .4 * Math.sin(i / 60 * 2 * Math.PI * 1.5))))
    return values.slice(-300)
  }

  it('uses the whole 0..1 range on a quiet track and on a loud one', () => {
    for (const peak of [.12, .95]) {
      const settled = swing(peak)
      expect(Math.max(...settled), `peak ${peak}`).toBeGreaterThan(.8)
      expect(Math.min(...settled), `peak ${peak}`).toBeLessThan(.25)
    }
  })

  it('holds its estimates through silence instead of drifting to zero', () => {
    const n = new SourceRelativeNormalizer()
    for (let i = 0; i < 600; i++) n.update(.6 + .4 * Math.sin(i / 10))
    const before = n.range
    for (let i = 0; i < 600; i++) n.update(0, true)
    expect(n.range).toEqual(before)
  })

  it('is deterministic', () => {
    expect(swing(.5)).toEqual(swing(.5))
  })
})

describe('envelopes', () => {
  it('attacks faster than it releases and settles to exactly zero', () => {
    const e = new Envelope()
    for (let i = 0; i < 6; i++) e.step(1, 1 / 60, 40, 400)
    const risen = e.value
    expect(risen).toBeGreaterThan(.4)
    for (let i = 0; i < 6; i++) e.step(0, 1 / 60, 40, 400)
    expect(e.value).toBeGreaterThan(risen * .6) // the release is slower than the attack
    for (let i = 0; i < 600; i++) e.step(0, 1 / 60, 40, 400)
    expect(e.value).toBe(0)
  })
})

describe('the modulation matrix', () => {
  const settings = (over: Partial<WireModSettings> = {}): WireModSettings => ({ reactivity: 1, attackMs: 45, releaseMs: 240, response: {}, ...over })
  const reading = (over: Partial<WireReading> = {}): WireReading => ({
    ...silentReading(), playing: true, confidence: 1,
    features: { sub: .5, bass: .5, lowMid: .5, mid: .5, air: .5, flux: .5, level: .6 },
    available: { sub: true, bass: true, lowMid: true, mid: true, air: true, flux: true, level: true },
    ...over,
  })
  /** Feeds a swinging feature so the normaliser sees a range, then returns the strongest targets seen. */
  function run(over: Partial<WireReading>, s = settings(), seconds = 6) {
    const matrix = new WireModMatrix(), peak = { cubeScale: 0, expand: 0, rotation: 0, shear: 0, wobble: 0, beamWidth: 0, brightness: 0 }
    for (let i = 0; i < seconds * 60; i++) {
      const swing = .5 + .5 * Math.sin(i / 60 * 6)
      const features = { sub: swing, bass: swing, lowMid: swing, mid: swing, air: swing, flux: swing, level: .6 }
      const t = matrix.resolve(reading({ features, ...over }), 1 / 60, s)
      for (const key of Object.keys(peak) as (keyof typeof peak)[]) peak[key] = Math.max(peak[key], t[key])
    }
    return { peak, matrix }
  }

  it('drives each target from its own feature, inside its bound', () => {
    const { peak } = run({})
    expect(peak.cubeScale).toBeGreaterThan(.03)
    expect(peak.cubeScale).toBeLessThanOrEqual(.08 + .03 + 1e-9)
    expect(peak.rotation).toBeGreaterThan(.05)
    expect(peak.rotation).toBeLessThanOrEqual(10 * Math.PI / 180 + 1e-9)
    expect(peak.shear).toBeLessThanOrEqual(.08 + 1e-9)
    expect(peak.wobble).toBeLessThanOrEqual(.03 + 1e-9)
    expect(peak.expand).toBe(0) // no kick
  })

  it('does nothing at Audio Reactivity zero', () => {
    const { peak } = run({ hits: { kick: 1, snare: 1, hat: 0 } }, settings({ reactivity: 0 }))
    for (const value of Object.values(peak)) expect(value).toBe(0)
  })

  it('goes neutral, not to a made-up value, when a feature is not a real measurement', () => {
    const { peak } = run({ available: { sub: false, bass: false, lowMid: false, mid: false, air: false, flux: false, level: true } })
    for (const value of Object.values(peak)) expect(value).toBe(0)
  })

  it('ignores the flux rule below its confidence floor', () => {
    const low = run({ confidence: .1, available: { sub: false, bass: false, lowMid: false, mid: false, air: false, flux: true, level: true } })
    expect(low.peak.wobble).toBe(0)
    const high = run({ confidence: .9, available: { sub: false, bass: false, lowMid: false, mid: false, air: false, flux: true, level: true } })
    expect(high.peak.wobble).toBeGreaterThan(0)
  })

  it('answers a kick with an expansion and a wider beam that release to exactly zero', () => {
    const matrix = new WireModMatrix()
    let t = matrix.resolve(reading({ hits: { kick: 1, snare: 0, hat: 0 } }), 1 / 60, settings())
    expect(t.expand).toBeGreaterThan(.03)
    expect(t.expand).toBeLessThanOrEqual(.05 + 1e-9)
    expect(t.beamWidth).toBeGreaterThan(.3)
    for (let i = 0; i < 120; i++) t = matrix.resolve(reading(), 1 / 60, settings())
    expect(t.expand).toBe(0)
    expect(t.beamWidth).toBe(0)
  })

  it('scales a source with its response, including to zero', () => {
    const full = run({ hits: { kick: 0, snare: 0, hat: 0 } }).peak.cubeScale
    const half = run({}, settings({ response: { bass: .5, sub: .5 } })).peak.cubeScale
    const none = run({}, settings({ response: { bass: 0, sub: 0 } })).peak.cubeScale
    expect(half).toBeLessThan(full)
    expect(none).toBe(0)
  })
})

// ── Deformation, readability and recovery ──────────────────────────────────────────────────────────────────────

describe('bounded deformation', () => {
  const shape = buildCubeCluster()
  const placements: CubePlacement[] = [
    { cx: 0, cy: 0, cz: 0, q: [0, 0, 0, 1], scale: 1 },
    { cx: 3, cy: 0, cz: 0, q: quatFromAxisAngle(0, 1, 0, .7), scale: .42 },
  ]
  const base = new Float32Array(shape.vertices.length), field = new Float32Array(shape.vertices.length), out = new Float32Array(shape.vertices.length)
  placeShape(shape, placements, base)
  const wild = { cubeScale: .11, expand: .05, shear: .08, wobble: .03, time: 1.7 }

  it('never moves a corner farther than the limit, however hard it is driven', () => {
    for (const limit of [.04, .12, .3]) {
      displacementField(shape, base, placements, { ...wild, cubeScale: 5, expand: 5, shear: 5, wobble: 5 }, limit, field)
      placements.forEach((p, k) => {
        const g = shape.groups[k], bound = limit * shape.edgeLength * p.scale
        for (let i = 0; i < g.vertexCount; i++) {
          const v = (g.vertexStart + i) * 3
          expect(Math.hypot(field[v], field[v + 1], field[v + 2])).toBeLessThanOrEqual(bound * (1 + 1e-6))
        }
      })
    }
  })

  it('draws exactly the placed cubes at weight zero or with nothing driving it', () => {
    displacementField(shape, base, placements, wild, .12, field)
    applyField(shape, base, field, 0, 2, out)
    expect([...out.slice(0, 16 * 3)]).toEqual([...base.slice(0, 16 * 3)])
    displacementField(shape, base, placements, { cubeScale: 0, expand: 0, shear: 0, wobble: 0, time: 3 }, .12, field)
    applyField(shape, base, field, 1, 2, out)
    expect([...out.slice(0, 16 * 3)]).toEqual([...base.slice(0, 16 * 3)])
  })

  it('scores an undisturbed figure 1 and loses readability as the drive grows', () => {
    displacementField(shape, base, placements, { cubeScale: 0, expand: 0, shear: 0, wobble: 0, time: 0 }, .12, field)
    expect(measureReadability(shape, base, field, 1, placements, .12).score).toBe(1)
    let previous = 1
    for (const w of [.25, .5, .75, 1]) {
      displacementField(shape, base, placements, wild, .12, field)
      const score = measureReadability(shape, base, field, w, placements, .12).score
      expect(score).toBeLessThan(previous + 1e-12)
      previous = score
    }
    expect(previous).toBeLessThan(.9)
  })

  it('eases the weight back until the figure holds its floor, and not further than it must', () => {
    displacementField(shape, base, placements, wild, .12, field)
    const floor = .8
    const { weight, readability } = constrainWeight(shape, base, field, placements, .12, floor)
    expect(weight).toBeLessThan(1)
    expect(weight).toBeGreaterThan(0)
    expect(readability.score).toBeGreaterThanOrEqual(floor - 1e-9)
    // A little more weight would break the floor (so the guard did not give up more than it had to).
    expect(measureReadability(shape, base, field, Math.min(1, weight + .02), placements, .12).score).toBeLessThan(floor + .01)
  })

  it('lets a gentle drive through untouched', () => {
    displacementField(shape, base, placements, { cubeScale: .01, expand: 0, shear: 0, wobble: 0, time: 1 }, .12, field)
    expect(constrainWeight(shape, base, field, placements, .12, .72).weight).toBe(1)
  })
})

// ── Director ───────────────────────────────────────────────────────────────────────────────────────────────────

const input = (over: Partial<DirectorInput> = {}): DirectorInput => ({
  dt: 1 / 60, playing: true, auto: true, cadence: 'bar8', seed: 7, minReadable: .65, trackIdentity: 'track-a', structure: { confidence: .8, build: 0 },
  gridConfident: true, bpm: 120, boundaries: NO_BOUNDARIES, drop: false, hit: 0, discontinuity: false, ...over,
})
const bar = (n: number) => ({ section: false, phrase: false, bar4: n % 4 === 0, bar8: n % 8 === 0, id: `bar8:${n}` })

describe('the choreography director', () => {
  /** Plays a list of bars through a fresh director, returning the scene chosen at each. */
  function scenes(over: Partial<DirectorInput> = {}, bars = 8) {
    const d = new WireDirector(), chosen: string[] = []
    for (let b = 1; b <= bars; b++) {
      const out = d.update(input({ ...over, boundaries: bar(b * 8) }))
      chosen.push(out.sceneId)
      for (let i = 0; i < 30; i++) d.update(input(over))
    }
    return chosen
  }

  it('is deterministic: the same seed, track and boundaries give the same show', () => {
    expect(scenes()).toEqual(scenes())
  })

  it('depends on the seed and the track, and never repeats a scene within the last two', () => {
    const base = scenes({ seed: 7 }, 12)
    expect(new Set([...Array.from({ length: 20 }, (_, i) => scenes({ seed: i }, 4).join())]).size).toBeGreaterThan(5)
    expect(scenes({ trackIdentity: 'track-b' }, 6).join()).not.toBe(scenes({ trackIdentity: 'track-a' }, 6).join())
    for (let i = 2; i < base.length; i++) expect(base[i] !== base[i - 1] && base[i] !== base[i - 2]).toBe(true)
    for (const id of base) expect(WIRE_SCENES.map(s => s.id)).toContain(id)
  })

  it('keeps the user\'s own baseline when Auto Performance is off', () => {
    const d = new WireDirector()
    for (let b = 1; b <= 6; b++) { d.update(input({ auto: false, boundaries: bar(b * 8) })); for (let i = 0; i < 30; i++) d.update(input({ auto: false })) }
    const out = d.update(input({ auto: false }))
    expect(out.sceneId).toBe(BASE_SCENE.id)
    expect(out.state === 'READABLE' || out.state === 'ACCENT').toBe(true)
    expect(out.abstract).toBe(0)
  })

  it('never invents structure on a live microphone: no section or phrase scenes, no build, no abstraction', () => {
    for (const cadence of ['section', 'phrase'] as const) {
      const d = new WireDirector()
      for (let b = 1; b <= 6; b++) {
        d.update(input({ cadence, structure: null, gridConfident: false, boundaries: { section: true, phrase: true, bar4: true, bar8: true, id: `x:${b}` }, drop: true }))
        for (let i = 0; i < 30; i++) d.update(input({ cadence, structure: null, gridConfident: false, drop: true }))
      }
      const out = d.update(input({ cadence, structure: null, gridConfident: false }))
      expect(out.sceneId).toBe(BASE_SCENE.id)
      expect(out.abstract).toBe(0)
      expect(['BUILD', 'ABSTRACT', 'REASSEMBLE']).not.toContain(out.state)
    }
  })

  it('changes scene on a live microphone only on bars the beat grid vouches for', () => {
    const live = { structure: null, cadence: 'phrase' as const }
    expect(new Set(scenes({ ...live, gridConfident: false }, 4))).toEqual(new Set([BASE_SCENE.id]))
    expect(new Set(scenes({ ...live, gridConfident: true }, 4)).size).toBeGreaterThan(1)
  })

  it('breaks the cluster apart only on a confident drop after a build, with enough readable time, then reassembles exactly', () => {
    const d = new WireDirector()
    const build = { structure: { confidence: .8, build: .8 } }
    for (let i = 0; i < 30; i++) d.update(input(build))
    expect(d.update(input(build)).state).toBe('BUILD')
    // A drop with too little recent readable time is held back, not obeyed.
    const weary = new WireDirector()
    ;(weary as unknown as { readable: number }).readable = .3
    for (let i = 0; i < 30; i++) weary.update(input(build))
    const held = weary.update(input({ ...build, drop: true }))
    expect(held.state).toBe('BUILD')
    expect(held.lastEvent).toContain('HELD')
    // With the readable time in hand it abstracts, for a bounded time, and returns to exactly zero.
    const out = d.update(input({ ...build, drop: true }))
    expect(out.state).toBe('ABSTRACT')
    let peak = 0, abstractFrames = 0, last = out
    for (let i = 0; i < 60 * 12; i++) { last = d.update(input({ structure: { confidence: .8, build: .05 } })); peak = Math.max(peak, last.abstract); if (last.state === 'ABSTRACT') abstractFrames++ }
    expect(peak).toBeGreaterThan(.9)
    expect(abstractFrames / 60).toBeLessThanOrEqual(3.6)
    expect(last.state).toBe('READABLE')
    expect(last.abstract).toBe(0)
  })

  it('does not abstract on weak structural evidence', () => {
    const d = new WireDirector()
    const weak = { structure: { confidence: .3, build: .9 } }
    for (let i = 0; i < 60; i++) d.update(input(weak))
    expect(d.update(input({ ...weak, drop: true })).state).not.toBe('ABSTRACT')
  })

  it('reassembles at once when the evidence goes, and starts again from the readable figure after a seek', () => {
    const d = new WireDirector()
    const build = { structure: { confidence: .8, build: .8 } }
    for (let i = 0; i < 30; i++) d.update(input(build))
    d.update(input({ ...build, drop: true }))
    for (let i = 0; i < 10; i++) d.update(input(build))
    expect(d.update(input({ ...build, structure: null })).state).toBe('REASSEMBLE')
    const seeked = d.update(input({ discontinuity: true }))
    expect(seeked.state).toBe('READABLE')
    expect(seeked.abstract).toBe(0)
    expect(seeked.sceneId).toBe(BASE_SCENE.id)
  })

  it('shows a hit as an accent that passes, and rests when the music stops', () => {
    const d = new WireDirector()
    expect(d.update(input({ hit: .9 })).state).toBe('ACCENT')
    for (let i = 0; i < 20; i++) d.update(input())
    expect(d.update(input()).state).toBe('READABLE')
    expect(d.update(input({ playing: false })).state).toBe('REST')
  })
})
