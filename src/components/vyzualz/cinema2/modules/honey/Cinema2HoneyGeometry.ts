import { HONEY_BEVEL, HONEY_CAP_RADIUS, HONEY_CAP_THICKNESS, HONEY_FLOOR, HONEY_PITCH, HONEY_SLEEVE_INNER, HONEY_SLEEVE_LIP, HONEY_SLEEVE_OUTER, HONEY_STEM_RADIUS } from './Cinema2HoneyDomain'

export type HoneyMeshRole = 'face' | 'edge' | 'cavity' | 'substrate' | 'outer' | 'inner' | 'under'
export interface HoneyMesh { name: string; role: HoneyMeshRole; moving: boolean; telescoping?: boolean; vertices: Float32Array }
type Point = readonly [number, number, number]
const ringPoint = (r:number,z:number,i:number):Point => [r*Math.cos(i*Math.PI/3),r*Math.sin(i*Math.PI/3),z]
function triangle(out:number[], a:Point,b:Point,c:Point) {
  const u=b.map((v,i)=>v-a[i]!), v=c.map((v,i)=>v-a[i]!)
  const n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!]
  const length=Math.hypot(...n)
  if(length<1e-9)throw new Error('Degenerate HONEY surface')
  for(const p of [a,b,c])out.push(...p,...n.map(k=>k/length))
}
/** Connect two rings: outer→inner for upward faces; bottom→top for outer walls. Reverse for cavity walls. */
function band(out:number[], a:number,az:number,b:number,bz:number,reverse=false) {
  for(let i=0;i<6;i++){
    const p=ringPoint(a,az,i),q=ringPoint(a,az,i+1),r=ringPoint(b,bz,i+1),s=ringPoint(b,bz,i)
    if(reverse){triangle(out,p,r,q);triangle(out,p,s,r)}else{triangle(out,p,q,r);triangle(out,p,r,s)}
  }
}
function disk(out:number[],r:number,z:number,reverse=false){for(let i=0;i<6;i++){const a=ringPoint(r,z,i),b=ringPoint(r,z,i+1);triangle(out,[0,0,z],reverse?b:a,reverse?a:b)}}
function mesh(name:string,role:HoneyMeshRole,moving:boolean,write:(out:number[])=>void):HoneyMesh {const out:number[]=[];write(out);return {name,role,moving,vertices:new Float32Array(out)}}
export function buildHoneyGeometry():readonly HoneyMesh[]{
  const r=HONEY_CAP_RADIUS, top=r-HONEY_BEVEL, bottom=-HONEY_CAP_THICKNESS, lip=HONEY_SLEEVE_LIP, outer=HONEY_SLEEVE_OUTER, inner=HONEY_SLEEVE_INNER
  return [
    mesh('substrate','substrate',false,o=>disk(o,HONEY_PITCH/Math.sqrt(3),HONEY_FLOOR-.065)),
    mesh('cavity-floor','cavity',false,o=>disk(o,inner,HONEY_FLOOR)),
    mesh('sleeve-interior','cavity',false,o=>band(o,inner,HONEY_FLOOR,inner,lip,true)),
    mesh('sleeve-exterior','edge',false,o=>band(o,outer,HONEY_FLOOR-.065,outer,lip)),
    mesh('sleeve-rim','edge',false,o=>{band(o,outer,lip,outer-.012,lip);band(o,inner+.009,lip,inner,lip)}),
    mesh('lower-channel-seat','under',false,o=>{band(o,outer-.012,lip,outer-.012,lip-.007);band(o,outer-.012,lip-.007,inner+.009,lip-.007);band(o,inner+.009,lip-.007,inner+.009,lip)}),
    // Normalized Z is expanded by the shared world/shadow vertex transform.
    // The base remains fixed inside the sleeve; the top follows the cap.
    {...mesh('telescoping-body','edge',false,o=>{band(o,HONEY_STEM_RADIUS,0,HONEY_STEM_RADIUS,1);disk(o,HONEY_STEM_RADIUS,1)}),telescoping:true},
    mesh('body','cavity',true,o=>{band(o,r,bottom,r,-.065);disk(o,r,bottom,true)}),
    mesh('outer-channel-seat','outer',true,o=>{band(o,r,-.065,r-.008,-.059);band(o,r-.008,-.059,r-.034,-.034);band(o,r-.034,-.034,r-.040,-.028)}),
    mesh('plate-bevel','edge',true,o=>band(o,r-.040,-.028,top,0)),
    mesh('plate-face','face',true,o=>{disk(o,.79,0);band(o,top,0,.808,0)}),
    mesh('inner-channel-seat','inner',true,o=>{band(o,.808,0,.808,-.004);band(o,.808,-.004,.79,-.004);band(o,.79,-.004,.79,0)}),
  ]
}
