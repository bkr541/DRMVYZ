import { cinema2StableId, type Cinema2ModuleTypeId } from '../../contracts/Cinema2NativePresetManifest'
export const CINEMA2_MONUMENT_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('monument-native')
export const MONUMENT_PATTERNS=[{value:'reveal',label:'Monumental Reveal'},{value:'trace',label:'Surface Trace'},{value:'edge-relay',label:'Edge Relay'},{value:'ascension',label:'Ascension'},{value:'architectural-pulse',label:'Architectural Pulse'},{value:'exposure',label:'Exposure'}] as const
export type MonumentPattern=typeof MONUMENT_PATTERNS[number]['value']
export const MONUMENT_PALETTE={background:[8/255,9/255,12/255,1],structural:[52/255,56/255,61/255,1],primary:[234/255,244/255,1,1],secondary:[0,199/255,221/255,1],accent:[215/255,165/255,90/255,1],'text-face':[184/255,194/255,203/255,1],'text-side':[54/255,60/255,67/255,1]} as const
export const clamp01=(x:number)=>Math.min(1,Math.max(0,x))
export interface MonumentInput {pattern:MonumentPattern; previousPattern?:MonumentPattern; blend?:number; phase:number; routePhase:number; reveal:number; contour:number; relay:number; kick:number; snare:number; bass:number; mid:number; high:number; build:number; drop:number; vocal:number; intensity:number; downbeat:number; phrase:number; energy:number}
// Five progressively deeper bays leave the central hero volume permanently unobstructed.
export const MONUMENT_BAYS = [
  { z: 2.4, x: 6.05, width: 2.15, depth: 1.55, crown: 4.65 },
  { z: -.8, x: 5.85, width: 1.65, depth: 1.25, crown: 5.15 },
  { z: -4.6, x: 6.25, width: 2.45, depth: 1.85, crown: 5.7 },
  { z: -9.1, x: 6.1, width: 2.0, depth: 1.55, crown: 6.05 },
  { z: -14.2, x: 6.4, width: 2.7, depth: 2.1, crown: 6.5 },
] as const
export const MONUMENT_FLOOR_Y = -2.53
export const MONUMENT_CAMERA = { position: [0, -.65, 10.8], target: [0, -.35, 0], fov: 40, minZ: 10.15, minFov: 40 } as const
function pose(p:MonumentInput,index:number){
  const a=p.phase*Math.PI/4, t=.5+.5*Math.sin(a), wave=.5+.5*Math.sin(p.routePhase*Math.PI*2-index*.8), pulse=Math.pow(wave,4)
  const rise=clamp01(t*1.5-index*.13), impact=p.intensity, restraint=1-.3*p.vocal
  let key=.6, sweep=0, height=0, floor=.3, wall=.25, rim=.25, aperture=.1, crown=.1, shaft=.25
  switch(p.pattern){
    case 'reveal': key=.48+.42*t;sweep=-.65+1.3*t;floor=pulse;wall=.25*t;rim=.45*t;aperture=rise*.78;crown=rise*.65;shaft=t;break
    case 'trace':key=.72;sweep=Math.sin(a);height=.2;floor=.14;wall=pulse*.75;rim=.4;aperture=.12;crown=.08;shaft=.3;break
    case 'edge-relay':key=.6;sweep=Math.cos(a);height=Math.sin(a)*.5;floor=pulse;wall=wave*.65;rim=.35+.6*wave;aperture=pulse;crown=wave*.15;shaft=pulse;break
    case 'ascension':key=.52+.35*t;height=-1+2*t;floor=.3*(1-t);wall=rise;rim=t;aperture=.2;crown=rise;shaft=rise;break
    case 'architectural-pulse':key=.66;floor=wave;wall=wave*.75;rim=.3;aperture=.18+.65*wave;crown=.15+.65*(1-wave);shaft=.25+.5*wave;break
    case 'exposure':key=.92;sweep=.1;height=.3;floor=.12;wall=.12;rim=.72;aperture=.88;crown=.85;shaft=.12;break
  }
  return {
    key:clamp01(.32+key*p.reveal*.72-.16*p.build*impact+.40*p.drop*impact+.14*p.vocal),
    sweep:Math.max(-1,Math.min(1,(sweep+.12*p.mid*impact)*restraint)),height:height*restraint,
    floor:clamp01(p.relay*(.2+floor*.8)+impact*(.2*p.bass+.25*p.kick*pulse+.25*p.drop+.14*p.downbeat)),
    wall:clamp01((wall*.7+impact*(.22*p.snare+.24*p.drop+.12*p.phrase+.08*p.energy))*(.6+.4*p.reveal)),
    rim:clamp01(p.contour*(.4+.6*rim)+impact*(.15*p.high+.25*p.kick+.25*p.drop)),
    aperture:clamp01((aperture*(1-.35*p.build*impact)+.45*p.drop*impact+.09*p.kick*impact)*restraint),
    crown:clamp01((crown*(1-.25*p.build*impact)+.55*p.drop*impact+.12*p.phrase*impact)*restraint),
    shaft:clamp01((.15+shaft*.7)*p.reveal+.2*p.build*impact+.25*p.drop*impact),
  }
}
export function monumentPose(p:MonumentInput,index:number){
  const to=pose(p,index);if(!p.previousPattern||p.previousPattern===p.pattern||p.blend===undefined||p.blend>=1)return to
  const from=pose({...p,pattern:p.previousPattern},index),t=clamp01(p.blend),k=t*t*(3-2*t)
  for(const key of Object.keys(to) as (keyof typeof to)[])to[key]=from[key]+(to[key]-from[key])*k
  return to
}
/** Travel is outward/upward only: neither stone wings nor lintels can enter the hero volume. */
export function monumentArchitectureTravel(pose:ReturnType<typeof monumentPose>,safety:number){
  const gate=clamp01(safety);return {wing:pose.aperture*1.05*gate,crown:pose.crown*1.15*gate}
}
/** Fit the rotated AABB to the pedestal and camera-safe volume, including authored offsets. */
export function monumentGroundedFit(fit:number,width:number,height:number,depth:number,top:number,x:number,y:number,z:number){
  return Math.min(fit,(7.8-2*Math.abs(x))/Math.max(width,1e-6),Math.min(4.4-y,2.1-top-y)/Math.max(height,1e-6),(3.65-2*Math.abs(z))/Math.max(depth,1e-6))
}
/** Uniform conservative fit, including arbitrary yaw and bounded pitch/roll. */
export function monumentFit(width:number,height:number,depth:number){const radius=Math.hypot(width,height,depth)/2;return Number.isFinite(radius)&&radius>1e-6?Math.min(4.0/radius,7.6/Math.max(width,1e-6),4.1/Math.max(height,1e-6),2.6/Math.max(depth,1e-6)):1}
export function monumentLines(text:string,line2='',line3=''){return [text,line2,line3].flatMap(line=>line.normalize('NFC').split(/\r?\n/)).slice(0,3).map(line=>Array.from(line).slice(0,80).join('')).reduce<string[]>((lines,line)=>{const remaining=80-lines.reduce((n,l)=>n+Array.from(l).length,0);lines.push(Array.from(line).slice(0,remaining).join(''));return lines},[])}
