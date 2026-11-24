import { HONEY_CAP_RADIUS, HONEY_CAP_THICKNESS, HONEY_GRID_RADIUS, HONEY_PITCH, HONEY_NEIGHBORS, HONEY_FLOOR, HONEY_SLEEVE_INNER, HONEY_SLEEVE_LIP, HONEY_MIN_ELEVATION, HONEY_MAX_ELEVATION, HONEY_MAX_ROTATION, HONEY_MAX_TILT, HONEY_MAX_SEPARATION, HONEY_FINISHES, type HoneyPose } from './Cinema2HoneyDomain'

export interface HoneyCell { id: string; q: number; r: number; x: number; y: number; elevation: number; finish: typeof HONEY_FINISHES[number]; tone: number; channels: readonly [number, number, number]; neighbors: readonly string[] }
export const honeyCellId = (q: number, r: number) => `${q}:${r}`
export function honeyCenter(q: number, r: number): readonly [number, number] { return [HONEY_PITCH * Math.sqrt(3) / 2 * q, HONEY_PITCH * (r + q / 2)] }
/** Stable integer hash, independent of iteration order, frame time and viewport. */
export function honeySeed(q: number, r: number, salt: number): number {
  let n = Math.imul(q, 374761393) ^ Math.imul(r, 668265263) ^ Math.imul(salt, 1274126177)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
export function buildHoneyLayout(): readonly HoneyCell[] {
  const cells: HoneyCell[] = []
  // Bounded rectangular world coverage with axial identities. Overscan remains fixed on resize.
  for (let q = -HONEY_GRID_RADIUS; q <= HONEY_GRID_RADIUS; q++) {
    for (let row = -HONEY_GRID_RADIUS; row <= HONEY_GRID_RADIUS; row++) {
      const r = row - Math.floor(q / 2)
      const [x, y] = honeyCenter(q, r)
      const value = honeySeed(q, r, 11)
      const cluster = honeySeed(Math.floor(q / 3), Math.floor(r / 3), 29)
      const finishIndex = Math.min(3, Math.floor((.74 * cluster + .26 * honeySeed(q, r, 31)) * 4))
      cells.push({ id: honeyCellId(q, r), q, r, x, y, elevation: value < .15 ? .12 : value < .35 ? .32 : value < .60 ? .49 : value < .86 ? .75 : .98,
        finish: HONEY_FINISHES[finishIndex]!, tone: .9 + .18 * honeySeed(q, r, 17),
        channels: [honeySeed(q, r, 23) < .68 ? 1 : .08, honeySeed(q, r, 41) < .43 ? .85 : .045, value > .60 ? .7 : .06],
        neighbors: HONEY_NEIGHBORS.map(([dq, dr]) => honeyCellId(q+dq, r+dr)) })
    }
  }
  return cells
}

/** Rotate about the moving cap's top centre, then translate. Conservative full-radius prism envelope. */
export function honeyPoseCorners(pose: HoneyPose): readonly (readonly [number,number,number])[] {
  const sx = Math.sin(pose.tiltX), cx = Math.cos(pose.tiltX), sy = Math.sin(pose.tiltY), cy = Math.cos(pose.tiltY), sz = Math.sin(pose.rotation), cz = Math.cos(pose.rotation)
  const points: [number,number,number][] = []
  for (const z of [0, -HONEY_CAP_THICKNESS]) for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, x = HONEY_CAP_RADIUS * Math.cos(a), y = HONEY_CAP_RADIUS * Math.sin(a)
    const y1 = y*cx-z*sx, z1 = y*sx+z*cx, x2 = x*cy+z1*sy, z2 = -x*sy+z1*cy
    points.push([x2*cz-y1*sz+pose.x, x2*sz+y1*cz+pose.y, z2+pose.elevation])
  }
  return points
}
/** Each moving prism must stay inside its own Voronoi half-planes. If any part is below the lip, the entire prism must fit the sleeve's inner hex. */
export function isHoneyPoseSafe(pose: HoneyPose): boolean {
  if (!Object.values(pose).every(Number.isFinite) || pose.elevation < HONEY_MIN_ELEVATION || pose.elevation > HONEY_MAX_ELEVATION || Math.abs(pose.rotation) > HONEY_MAX_ROTATION || Math.abs(pose.tiltX) > HONEY_MAX_TILT || Math.abs(pose.tiltY) > HONEY_MAX_TILT || Math.hypot(pose.x,pose.y) > HONEY_MAX_SEPARATION) return false
  const points = honeyPoseCorners(pose)
  const lowest = Math.min(...points.map(p => p[2]))
  if (lowest < HONEY_FLOOR + .006) return false
  const limit = lowest < HONEY_SLEEVE_LIP + .015 ? HONEY_SLEEVE_INNER*Math.sqrt(3)/2-.003 : HONEY_PITCH/2-.006
  return points.every(([x,y]) => HONEY_NEIGHBORS.every(([q,r]) => { const [nx,ny] = honeyCenter(q,r); return (x*nx+y*ny)/HONEY_PITCH <= limit + 1e-9 }))
}
/** Clamp unsafe combined motion back along the requested pose; never shuffle or move sleeves. */
export function constrainHoneyPose(request: HoneyPose): HoneyPose {
  const elevation = Number.isFinite(request.elevation) ? Math.max(HONEY_MIN_ELEVATION, Math.min(HONEY_MAX_ELEVATION,request.elevation)) : HONEY_MIN_ELEVATION
  const clamp = (v:number, max:number) => Number.isFinite(v) ? Math.max(-max,Math.min(max,v)) : 0
  const x=clamp(request.x,HONEY_MAX_SEPARATION), y=clamp(request.y,HONEY_MAX_SEPARATION), lateral=Math.max(1,Math.hypot(x,y)/HONEY_MAX_SEPARATION)
  const base = { elevation, rotation:clamp(request.rotation,HONEY_MAX_ROTATION), tiltX:clamp(request.tiltX,HONEY_MAX_TILT), tiltY:clamp(request.tiltY,HONEY_MAX_TILT), x:x/lateral, y:y/lateral }
  const scaled = (t:number):HoneyPose => ({ elevation, rotation:base.rotation*t, tiltX:base.tiltX*t, tiltY:base.tiltY*t, x:base.x*t, y:base.y*t })
  if (isHoneyPoseSafe(base)) return base
  let lo=0, hi=1
  for(let i=0;i<20;i++){ const mid=(lo+hi)/2; if(isHoneyPoseSafe(scaled(mid)))lo=mid; else hi=mid }
  return scaled(lo)
}
