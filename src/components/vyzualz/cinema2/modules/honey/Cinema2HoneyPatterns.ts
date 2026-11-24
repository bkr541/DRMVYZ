import { HONEY_PATTERN_IDS, honeySeed } from './Cinema2HoneyDomain'
import type { HoneyCell } from './Cinema2HoneyLayout'

export type HoneyPattern = typeof HONEY_PATTERN_IDS[number]
export interface HoneyPatternSample {
  activation:number; elevation:number; rotation:number; tiltX:number; tiltY:number; separation:number;
  outer:number; inner:number; under:number
}
export const HONEY_PATTERNS=HONEY_PATTERN_IDS.map(value=>({value,label:value[0]!.toUpperCase()+value.slice(1)}))
const clamp=(v:number)=>Math.max(0,Math.min(1,v))
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t)}
const mod=(v:number,n:number)=>((v%n)+n)%n
/** Continuous travelling envelope: attack, crest hold, trailing release. All lengths in beats. */
function pulse(phase:number,period:number,width:number,beatSeconds:number){
  const t=mod(phase,period),attack=Math.max(.04,.14/beatSeconds)*width,hold=.09/beatSeconds*width,release=.55/beatSeconds*width
  const scale=Math.min(1,period*.94/(attack+hold+release))
  return smooth(t/(attack*scale))*(1-smooth((t-(attack+hold)*scale)/(release*scale)))
}
/** Spatial masks are authored, not audio classifiers. The shared clock supplies phase. */
export function sampleHoneyPattern(pattern:HoneyPattern,c:HoneyCell,beat:number,width=1,delay=.125,beatSeconds=.5):HoneyPatternSample{
  const x=c.x/1.8,y=c.y/1.8,r=Math.hypot(x,y),a=Math.atan2(y,x),seed=honeySeed(c.q,c.r,97),cluster=honeySeed(Math.floor(c.q/3),Math.floor(c.r/3),101)
  const wave=(p:number,period=4)=>pulse(p,period,width,beatSeconds)
  const s=Math.sin(a+seed*.6),t=Math.cos(a+seed*.6)
  let v=0,e=0,rot=0,tx=0,ty=0,sep=0,outer=0,inner=0,under=0
  switch(pattern){
    case 'cascade': v=wave(beat-x*delay*3-y*delay*.65);e=v;tx=v*.55;ty=v*.25;outer=v;inner=v*.35;under=wave(beat-x*delay*3-y*delay*.65-.38)*.8;break
    case 'shockwave': v=wave(beat-r*delay*4,6);e=v;rot=v*s*.6;tx=v*s;ty=v*t;outer=v;under=v*.95;inner=v*.18;break
    case 'fracture': {const field=Math.sin(x*.64+y*.38+beat*.46)+Math.cos(y*.85-x*.32-beat*.29)+(cluster-.5)*.9;v=smooth((field+.25)/1.6);e=v*2-1;rot=v*(seed-.5)*1.5;tx=v*s*.65;ty=v*t*.65;sep=v*.8;outer=v*.38;inner=(1-v)*.45;under=v*.8;break}
    case 'alternating': {const group=mod(c.q-c.r,3),p=.5+.5*Math.cos(beat*Math.PI/2+group*Math.PI*2/3);v=smooth(p);e=2*v-1;tx=(v-.5)*1.2;ty=(.5-v)*.65;outer=v*.8;inner=(1-v)*.8;under=v*.3;break}
    case 'convergence': {const focus=Math.hypot(x-1.3,y+.65);v=wave(beat+focus*delay*4,6);e=v;tx=-s*v*.55;ty=-t*v*.55;outer=v*.28;inner=v;under=wave(beat+focus*delay*4-.2);break}
    case 'current': {const p=beat-(x+y*.72)*delay*4-Math.sin(y*.6)*.38;v=wave(p,5);e=v*.83;rot=v*t*.8;tx=v*.75;ty=-v*.5;outer=v*.65;inner=v;under=wave(p-.5,5)*.65;break}
    case 'submerge': {const region=.5+.5*Math.sin(x*.29+y*.36+beat*.36);v=smooth((region-.25)/.65);const island=smooth((cluster-.58)/.32);e=-v*(1-island)+island*.72;sep=island*.65;tx=island*s*.5;ty=island*t*.5;outer=island*.6;inner=(1-v)*.2;under=island*.9;break}
    case 'overdrive': {const f=wave(beat-x*delay*4,3),g=wave(beat-Math.hypot(x+2,y-1)*delay*3,5),h=wave(beat+y*delay*3+cluster*.55,4);v=clamp(f*.75+g*.85+h*.4);e=v;rot=v*s*.95;tx=v*t*.85;ty=v*s*.85;sep=v*.95;outer=v;inner=clamp(g*.85+h*.35);under=clamp(f*.8+g*.6);break}
  }
  // Seeded selective emitters remain independent; even the densest program has dark cells.
  const gate=.48+.52*seed
  return {activation:v,elevation:e,rotation:rot,tiltX:tx,tiltY:ty,separation:sep,outer:outer*gate,inner:inner*gate,under:under*gate}
}
