import type { Cinema2CameraPathPointManifest, Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'

/** The route and architecture share these world-space vertices. The floor remains
 * at the original reflective-floor height; eye height is 1.7 world units. */
export const PURITY_FLOOR = -2.4
export const PURITY_EYE = PURITY_FLOOR + 1.7
export const PURITY_JUNCTION = 7.7
export const PURITY_ZONES = ['threshold','crosswire','prism','zigzag','cathedral','obsidian','slalom','nexus'] as const
export type PurityZone = typeof PURITY_ZONES[number]
export const PURITY_VERTICES = [[0,20],[0,-30],[28,-30],[28,-58],[58,-58],[58,-10],[36,-10],[36,20]] as const
export const PURITY_EDGES = PURITY_VERTICES.map(([x,z],i) => {
  const [ex,ez]=PURITY_VERTICES[(i+1)%PURITY_VERTICES.length]!
  const length=Math.hypot(ex-x,ez-z), dx=(ex-x)/length,dz=(ez-z)/length
  return {x,z,dx,dz,length,yaw:Math.atan2(-dx,-dz),zone:PURITY_ZONES[i]!}
})
export const PURITY_ROUTE_LENGTH = PURITY_EDGES.reduce((sum,e)=>sum+e.length,0)
export function purityWorld(edge:typeof PURITY_EDGES[number], x:number,y:number, distance:number):Cinema2Vector3 {
  return [edge.x-edge.dz*x+edge.dx*distance,y,edge.z+edge.dx*x+edge.dz*distance]
}
/** Evenly spaced straight samples + rounded 90-degree corners. Catmull-Rom
 * interpolation cannot cut across the closed walls because every corner lies
 * well inside its 15.4-unit junction and straight samples are collinear. */
export const PURITY_ROUTE: readonly Cinema2CameraPathPointManifest[] = (()=>{
  const points: Cinema2Vector3[]=[]
  const radius=3.0
  for(let i=0;i<PURITY_EDGES.length;i++){
    const e=PURITY_EDGES[i]!, next=PURITY_EDGES[(i+1)%PURITY_EDGES.length]!
    const start=radius, end=e.length-radius, count=Math.ceil((end-start)/2.0)
    for(let k=0;k<=count;k++)points.push(purityWorld(e,0,PURITY_EYE,start+(end-start)*k/count))
    const a=points[points.length-1]!, b=purityWorld(next,0,PURITY_EYE,radius)
    // Quadratic corner inside the room, tangent to both incoming/outgoing legs.
    for(let k=1;k<5;k++){const t=k/5,u=1-t;points.push([u*u*a[0]+2*u*t*next.x+t*t*b[0],PURITY_EYE,u*u*a[2]+2*u*t*next.z+t*t*b[2]])}
  }
  // Start in the straight Threshold passage, not at a junction.
  const start=4; const ordered=points.slice(start).concat(points.slice(0,start))
  return ordered.map((position,i)=>({position,target:ordered[(i+2)%ordered.length]!}))
})()
export function purityRouteAddress(x:number,z:number):number {
  let nearest=Infinity, result=0
  PURITY_EDGES.forEach((e,i)=>{const d=Math.max(0,Math.min(e.length,(x-e.x)*e.dx+(z-e.z)*e.dz));const distance=Math.hypot(x-e.x-e.dx*d,z-e.z-e.dz*d);if(distance<nearest){nearest=distance;result=i+d/e.length}})
  return result
}
export function purityZoneAt(x:number,z:number):number { return Math.floor(purityRouteAddress(x,z))%PURITY_EDGES.length }
export function purityHalfWidth(width:number,zone:PurityZone):number {
  return Math.min(PURITY_JUNCTION-.25, width*(zone==='cathedral'?1.35:zone==='obsidian'?.78:1))
}
