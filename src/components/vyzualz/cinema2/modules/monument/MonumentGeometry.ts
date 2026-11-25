import { cinema2StableId, type Cinema2ModuleTypeId } from '../../contracts/Cinema2NativePresetManifest'
export const CINEMA2_MONUMENT_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('monument-native')
export const MONUMENT_PATTERNS=[{value:'reveal',label:'Monumental Reveal'},{value:'trace',label:'Surface Trace'},{value:'edge-relay',label:'Edge Relay'},{value:'ascension',label:'Ascension'},{value:'architectural-pulse',label:'Architectural Pulse'},{value:'exposure',label:'Exposure'}] as const
export type MonumentPattern=typeof MONUMENT_PATTERNS[number]['value']
export const MONUMENT_PALETTE={background:[8/255,9/255,12/255,1],structural:[52/255,56/255,61/255,1],primary:[234/255,244/255,1,1],secondary:[0,199/255,221/255,1],accent:[215/255,165/255,90/255,1],'text-face':[184/255,194/255,203/255,1],'text-side':[54/255,60/255,67/255,1]} as const
export const clamp01=(x:number)=>Math.min(1,Math.max(0,x))
export interface MonumentInput {pattern:MonumentPattern; previousPattern?:MonumentPattern; blend?:number; phase:number; routePhase:number; reveal:number; contour:number; relay:number; kick:number; snare:number; bass:number; mid:number; high:number; build:number; drop:number; vocal:number; intensity:number; downbeat:number; phrase:number; energy:number}
function pose(p:MonumentInput,index:number){
  const a=p.phase*Math.PI/4, t=.5+.5*Math.sin(a), wave=.5+.5*Math.sin(p.routePhase*Math.PI*2-index*.58), pulse=Math.pow(wave,4)
  let key=.6, sweep=0, height=0, floor=.3, wall=.25, rim=.25
  switch(p.pattern){
    case 'reveal': key=.35+.55*t;sweep=-1+2*t;floor=pulse;wall=.25*t;rim=.4*t;break
    case 'trace':key=.65;sweep=Math.sin(a);height=.2;floor=.2;wall=.25;rim=.4;break
    case 'edge-relay':key=.48;sweep=Math.cos(a);height=Math.sin(a);floor=pulse;wall=wave*.45;rim=.35+.6*wave;break
    case 'ascension':key=.5+.35*t;height=-1+2*t;floor=.3*(1-t);wall=clamp01(t*2-index*.12);rim=t;break
    case 'architectural-pulse':key=.66;floor=wave;wall=wave;rim=.3;break
    case 'exposure':key=.92;sweep=.15;height=.3;floor=.09;wall=.08;rim=.72;break
  }
  const impact=p.intensity, restraint=1-.3*p.vocal
  return {key:clamp01(.22+key*p.reveal*.85-.20*p.build*impact+.45*p.drop*impact+.14*p.vocal),sweep:Math.max(-1,Math.min(1,(sweep+.12*p.mid*impact)*restraint)),height:height*restraint,floor:clamp01(p.relay*(.2+floor*.8)+impact*(.2*p.bass+.25*p.kick*pulse+.25*p.drop+.14*p.downbeat)),wall:clamp01((wall*.55+impact*(.22*p.snare+.24*p.drop+.12*p.phrase+.08*p.energy))*(.6+.4*p.reveal)),rim:clamp01(p.contour*(.4+.6*rim)+impact*(.15*p.high+.25*p.kick+.25*p.drop))}
}
export function monumentPose(p:MonumentInput,index:number){const to=pose(p,index);if(!p.previousPattern||p.previousPattern===p.pattern||p.blend===undefined||p.blend>=1)return to;const from=pose({...p,pattern:p.previousPattern},index),t=clamp01(p.blend),k=t*t*(3-2*t);return {key:from.key+(to.key-from.key)*k,sweep:from.sweep+(to.sweep-from.sweep)*k,height:from.height+(to.height-from.height)*k,floor:from.floor+(to.floor-from.floor)*k,wall:from.wall+(to.wall-from.wall)*k,rim:from.rim+(to.rim-from.rim)*k}}
/** Uniform conservative fit, including arbitrary yaw and bounded pitch/roll. */
export function monumentFit(width:number,height:number,depth:number){const radius=Math.hypot(width,height,depth)/2;return Number.isFinite(radius)&&radius>1e-6?Math.min(4.0/radius,7.6/Math.max(width,1e-6),4.1/Math.max(height,1e-6),2.6/Math.max(depth,1e-6)):1}
export function monumentLines(text:string,line2='',line3=''){return [text,line2,line3].flatMap(line=>line.normalize('NFC').split(/\r?\n/)).slice(0,3).map(line=>Array.from(line).slice(0,80).join('')).reduce<string[]>((lines,line)=>{const remaining=80-lines.reduce((n,l)=>n+Array.from(l).length,0);lines.push(Array.from(line).slice(0,remaining).join(''));return lines},[])}
