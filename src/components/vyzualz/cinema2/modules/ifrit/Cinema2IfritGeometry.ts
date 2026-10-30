type Point = readonly [number, number, number]

export const IFRIT_RING_DEPTHS = [-2.4, -4.0, -6.6, -10.8] as const
export const IFRIT_RADIUS = 3.15

/** Fixed mesh: position, normal, material role/gain, ring/detail identity and
 * spine/midpoint anchor. Native poses supply the final world-space arrangement. */
export function buildIfritGeometry(): Float32Array {
  const vertices: number[] = []
  let ringIndex = -1, detailRank = 0
  const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  const scale = (a: Point, s: number): Point => [a[0] * s, a[1] * s, a[2] * s]
  const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const unit = (a: Point): Point => scale(a, 1 / Math.hypot(...a))
  function beam(a: Point, b: Point, width: number, depth: number, role: number, gain = 1) {
    const axis = unit(sub(b, a))
    const u = scale(unit(cross(axis, Math.abs(axis[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1])), width / 2)
    const v = scale(unit(cross(axis, u)), depth / 2)
    const corners = [a, b].flatMap(p => [add(add(p, u), v), add(sub(p, u), v), sub(sub(p, u), v), add(sub(p, v), u)])
    for (const face of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) {
      const normal = unit(cross(sub(corners[face[1]], corners[face[0]]), sub(corners[face[2]], corners[face[0]])))
      for (const i of [0, 1, 2, 0, 2, 3]) vertices.push(...corners[face[i]], ...normal, role, gain, ringIndex, detailRank, ...(ringIndex >= 0 ? (face[i] < 4 ? a : b) : scale(add(a,b),0.5)))
    }
  }
  const point = (side: number, radius: number, z: number, rotation = 0): Point => {
    const angle = Math.PI / 2 + side * Math.PI / 3 + rotation
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, z]
  }
  // Thick dark structural beams; front/rear contours and corner links reveal extrusion.
  Array.from({ length: 12 }, (_, ring) => ring).forEach(ring => {
    ringIndex = ring
    const z = 0
    const rotation = 0
    const gain = 1
    for (let side = 0; side < 6; side++) {
      beam(point(side, IFRIT_RADIUS, z, rotation), point(side + 1, IFRIT_RADIUS, z, rotation), 0.12, 0.30, 0, gain)
      // Trace both edges of the front annulus. A centerline on the rear face
      // would be occluded by its own structural body from this axial camera.
      for (const radius of [IFRIT_RADIUS - 0.07, IFRIT_RADIUS + 0.07]) {
        beam(point(side, radius, z + 0.17, rotation), point(side + 1, radius, z + 0.17, rotation), 0.045, 0.045, 1, gain)
      }
      beam(point(side, IFRIT_RADIUS + 0.07, z - 0.17, rotation), point(side + 1, IFRIT_RADIUS + 0.07, z - 0.17, rotation), 0.045, 0.045, 1, gain)
      beam(point(side, IFRIT_RADIUS - 0.07, z + 0.19, rotation), point(side, IFRIT_RADIUS + 0.07, z + 0.19, rotation), 0.04, 0.04, 3, gain)
      beam(point(side, IFRIT_RADIUS + 0.07, z - 0.17, rotation), point(side, IFRIT_RADIUS + 0.07, z + 0.19, rotation), 0.04, 0.04, 3, gain)
    }
  })
  // Three radial layers: fragmented conduits, transverse braces and irregular
  // panel edges. Every beam carries a common midpoint for rigid axial recycling.
  ringIndex = -1
  for (let side = 0; side < 6; side++) {
    for(let layer=0;layer<3;layer++) {
      const a=point(side,3.9+layer*.22,0),b=point(side+1,3.9+layer*.22,0)
      const onWall=(t:number,z:number):Point=>[a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,z]
      for(let lane=0;lane<11;lane++) for(let segment=0;segment<16;segment++) {
        if(layer>0&&(lane+segment+side+layer)%3===0) continue
        const hash=((side*71+lane*37+segment*19+layer*43)%101)/101
        const t=(lane+.5)/11, z=-.8-segment*.9-hash*.35
        detailRank=(lane+.5)/11*.75+layer*.08
        beam(onWall(t,z),onWall(t,z-.28-hash*.65),.035+hash*.07,.045+layer*.035,2,.75+hash*.85)
        if((segment+lane+layer)%3===0) {
          // Short bright panel edges interrupt long rails, producing depth texture.
          beam(onWall(Math.max(.01,t-.045),z),onWall(Math.min(.99,t+.09),z-.13),.19,.14,4,.7)
          beam(onWall(Math.max(.01,t-.045),z+.08),onWall(Math.min(.99,t+.09),z-.05),.025,.025,2,.8+hash*.6)
        }
      }
      for(let rib=0;rib<22;rib++) {
        const z=-1-rib*.62
        detailRank=(rib+.5)/22*.8+layer*.06
        const t0=((rib+side)%4)*.09
        beam(onWall(t0,z),onWall(.58+t0,z),.045+layer*.02,.08,2,rib%3===0?1.2:.6)
      }
    }
  }
  return new Float32Array(vertices)
}
