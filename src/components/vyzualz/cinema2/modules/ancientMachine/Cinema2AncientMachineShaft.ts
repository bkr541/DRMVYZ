export const ANCIENT_MACHINE_SHAFT_VERTEX_BYTES = 7 * Float32Array.BYTES_PER_ELEMENT
export const ANCIENT_MACHINE_GANTRY_DEPTHS = [-27, -21, -15, -10.25, -5.7, 5.7, 10.25, 15, 21, 27] as const
export const ANCIENT_MACHINE_COLLAR_CENTER_Z = -2.75
export const ANCIENT_MACHINE_COLLAR_INNER_RADIUS = 4.86

const shell = 0
const steel = 1
const bronze = 2
const cyan = 3
const amber = 4
const deck = 5
const TAU = Math.PI * 2
type Position = readonly [number, number, number]

/** Static world-space architecture, batched as one mesh alongside the original mechanism. */
export function buildCinema2AncientMachineShaft(): Float32Array {
  const vertices: number[] = []

  function quad(a: Position, b: Position, c: Position, d: Position, material: number) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const nx = ab[1] * ac[2] - ab[2] * ac[1]
    const ny = ab[2] * ac[0] - ab[0] * ac[2]
    const nz = ab[0] * ac[1] - ab[1] * ac[0]
    const length = Math.hypot(nx, ny, nz)
    for (const position of [a, b, c, a, c, d]) vertices.push(...position, nx / length, ny / length, nz / length, material)
  }

  function arc(inner: number, outer: number, near: number, far: number, start: number, end: number, steps: number, material: number) {
    const point = (radius: number, angle: number, z: number): Position => [Math.cos(angle) * radius, Math.sin(angle) * radius, z]
    for (let segment = 0; segment < steps; segment += 1) {
      const a = start + (end - start) * segment / steps
      const b = start + (end - start) * (segment + 1) / steps
      const an = point(inner, a, near), bn = point(inner, b, near)
      const af = point(inner, a, far), bf = point(inner, b, far)
      const cn = point(outer, a, near), dn = point(outer, b, near)
      const cf = point(outer, a, far), df = point(outer, b, far)
      quad(an, cn, dn, bn, material)
      quad(af, bf, df, cf, material)
      quad(an, bn, bf, af, material)
      quad(cn, cf, df, dn, material)
      if (segment === 0) quad(an, af, cf, cn, material)
      if (segment === steps - 1) quad(bn, dn, df, bf, material)
    }
  }

  function box(x: number, y: number, z: number, width: number, height: number, length: number, material: number) {
    const l = x - width / 2, r = x + width / 2
    const b = y - height / 2, t = y + height / 2
    const f = z + length / 2, n = z - length / 2
    quad([l, b, f], [r, b, f], [r, t, f], [l, t, f], material)
    quad([r, b, n], [l, b, n], [l, t, n], [r, t, n], material)
    quad([l, b, n], [l, b, f], [l, t, f], [l, t, n], material)
    quad([r, b, f], [r, b, n], [r, t, n], [r, t, f], material)
    quad([l, t, f], [r, t, f], [r, t, n], [l, t, n], material)
    quad([l, b, n], [r, b, n], [r, b, f], [l, b, f], material)
  }

  // A continuous curved shell fills the edges, with raised seams marking each bay.
  arc(15.4, 15.55, 32, -32, 0, TAU, 64, shell)
  for (const side of [-1, 1]) {
    box(0, 0, side * 32, 31, 31, .18, shell)
    arc(2.1, 2.8, side * 31.76 + .1, side * 31.76 - .1, 0, TAU, 48, steel)
  }
  for (let z = -30; z <= 30; z += 5) {
    arc(15.11, 15.42, z + .12, z - .12, 0, TAU, 64, steel)
  }
  for (let angle = 0; angle < TAU - .01; angle += TAU / 16) {
    arc(15.0, 15.44, 32, -32, angle - .013, angle + .013, 1, steel)
  }

  // Side gaps in the inner gantries give the orbit a clear line to the crystal.
  for (const z of ANCIENT_MACHINE_GANTRY_DEPTHS) {
    const distance = Math.abs(z)
    const radius = 7.65 + (distance - 5.7) * .25
    for (let segment = 0; segment < 16; segment += 1) {
      const angle = (segment + .5) * TAU / 16
      if (distance < 14 && Math.abs(Math.sin(angle)) < .49) continue
      const half = TAU / 32
      arc(radius, radius + .74, z + .29, z - .29, angle - half + .017, angle + half - .017, 4, steel)
      arc(radius + .68, radius + .91, z + .34, z - .34, angle - half + .024, angle + half - .024, 4, bronze)
      arc(radius + .08, radius + .15, z + .32, z - .32, angle - .085, angle + .085, 3, distance < 6 && segment % 3 === 0 ? amber : cyan)
      if (segment % 4 === 2) {
        arc(radius + .92, 15.39, z + .19, z - .19, angle - .025, angle + .025, 2, steel)
        arc(radius + 1.6, 14.9, z + .21, z - .21, angle - .004, angle + .004, 1, bronze)
      }
    }
  }

  // Anchor the mechanism to the shaft with a collar and heavy side supports.
  const collarZ = ANCIENT_MACHINE_COLLAR_CENTER_Z
  for (let segment = 0; segment < 12; segment += 1) {
    const angle = segment * TAU / 12
    const half = TAU / 24
    arc(ANCIENT_MACHINE_COLLAR_INNER_RADIUS, 5.32, collarZ + .37, collarZ - .37, angle - half + .018, angle + half - .018, 5, steel)
    arc(5.16, 5.32, collarZ + .45, collarZ + .36, angle - half + .028, angle + half - .028, 5, bronze)
  }

  // Service catwalks frame the lower corners and provide a foreground scale cue.
  for (const side of [-1, 1]) {
    box(side * 6.76, 0, -2.76, 3.3, .42, .58, steel)
    box(side * 6.76, 0, -2.43, 3.05, .14, .095, bronze)
    box(side * 6.71, 0, -2.37, 1.15, .055, .045, cyan)
    for (let z = -25; z <= 25; z += 2.5) {
      box(side * 7, -3.87, z, 2.25, .24, 2.47, deck)
      box(side * 5.89, -3.84, z, .12, .3, 2.5, bronze)
      box(side * 5.88, -3.31, z, .095, 1.02, .12, steel)
      box(side * 5.88, -2.8, z, .11, .11, 2.5, bronze)
      box(side * 5.88, -3.24, z, .065, .065, 2.5, steel)
      box(side * 5.87, -2.79, z + .43, .125, .055, .53, amber)
      box(side * 7.45, -4.34, z, 1.45, .74, .21, steel)
    }
  }
  return new Float32Array(vertices)
}
