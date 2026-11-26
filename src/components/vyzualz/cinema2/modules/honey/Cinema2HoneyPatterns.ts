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
// Layout cells are immutable and reused by orchestration. Cache only their fixed
// spatial coefficients; weak keys allow the layout to be collected on disposal.
function spatialFields(c:HoneyCell){
  const x=c.x/1.8,y=c.y/1.8,r=Math.hypot(x,y),a=Math.atan2(y,x),seed=honeySeed(c.q,c.r,97)
  const cq=Math.floor(c.q/3),cr=Math.floor(c.r/3),cluster=honeySeed(cq,cr,101)
  const localQ=mod(c.q,3)-1,localR=mod(c.r,3)-1,localRadius=Math.max(Math.abs(localQ),Math.abs(localR),Math.abs(localQ+localR))
  const petal=Math.atan2(localR+localQ*.5,localQ*.866)
  return {x,y,r,a,seed,cluster,localRadius,group:mod(cq-cr,3),petalX:Math.sin(petal),petalY:Math.cos(petal),s:Math.sin(a),t:Math.cos(a),center:1-smooth((r-1.1)/3),vent:smooth((cluster-.45)/.4)}
}
const fields=new WeakMap<HoneyCell,ReturnType<typeof spatialFields>>()
/** Spatial masks are authored, not audio classifiers. The shared clock supplies phase. */
export function sampleHoneyPattern(pattern:HoneyPattern,c:HoneyCell,beat:number,width=1,delay=.125,beatSeconds=.5):HoneyPatternSample{
  let field=fields.get(c)
  if(!field){field=spatialFields(c);fields.set(c,field)}
  const {x,y,r,a,seed,cluster,localRadius,group,petalX,petalY,s,t,center,vent}=field
  const wave=(p:number,period=4)=>pulse(p,period,width,beatSeconds)
  // A longer plateau for architectural formations; use the same shared beat phase.
  const stage=(p:number,period:number,rise:number,hold:number,fall:number)=>{
    const t=mod(p,period),scale=Math.min(width,period*.94/(rise+hold+fall))
    return smooth(t/(rise*scale))*(1-smooth((t-(rise+hold)*scale)/(fall*scale)))
  }
  let v=0,e=0,rot=0,tx=0,ty=0,sep=0,outer=0,inner=0,under=0
  switch(pattern){
    // Cascade: diagonal descending staircase. The preceding row remains seated.
    case 'cascade': {
      const p=beat+.65+(y-x*.38)*delay*3
      v=stage(p,4,.35,.65,1.05);e=v-.48*stage(p-1.4,4,.35,.55,.65)
      tx=v*.9;ty=-v*.25;outer=wave(p+.2)*.9;inner=v*.22;under=v*.92;break
    }
    // Pressure wave: expanding compression trough behind a sharp raised crest.
    case 'shockwave': {
      const p=beat+.6-r*delay*4
      v=wave(p,6);const trough=stage(p-.65,6,.25,.75,1.1)
      e=v-.9*trough;tx=v*s;ty=-v*t;outer=v*.8;inner=trough*.12;under=v;break
    }
    // Fragment: entire islands shear free on staggered clocks, with dark fault lines.
    case 'fracture': {
      const p=beat+cluster*2+localRadius*delay
      const fault=localRadius===2?.28:1
      v=stage(p,6,.45,1.5,1.35)*fault;e=v-.75*stage(p-3,6,.45,.75,.65)
      rot=v*(cluster>.5?1:-1);tx=v*(cluster-.5)*1.7;ty=v*(seed-.5)*1.2;sep=v
      outer=v*.28;inner=v*.15;under=v*.95;break
    }
    // Hive bloom: seven-cell flowers unfold center-first in alternating districts.
    case 'alternating': {
      const p=beat+.55-group*.68-localRadius*delay*3
      v=stage(p,6,.55,1.15,1.4);e=v-.65*stage(p-2.7,6,.4,.7,.9)
      tx=v*petalX;ty=-v*petalY;rot=v*(group===1?-1:1)*.7
      outer=v*.32;inner=localRadius===0?v:v*.28;under=v*.85;break
    }
    // Reconstruction: scattered raised islands align and seat inwards, then rest.
    case 'convergence': {
      const p=beat+.75+r*delay*2+cluster*.55
      v=stage(p,8,.55,1.1,2.1);e=v*(.72+.28*cluster)
      const scattered=v*smooth((v-.6)/.4)
      rot=scattered*(cluster-.5)*1.7;tx=-s*scattered;ty=t*scattered;sep=scattered
      outer=v*.18;inner=wave(p-2,8)*.8;under=v*.66;break
    }
    // Vortex: two winding arms, rotating around a recessed core (not a straight wave).
    case 'current': {
      const phase=a*2+r*.72*(delay/.125)-beat*Math.PI/2
      const crest=Math.cos(phase),threshold=.12+(1-width)*.5
      const arm=smooth((crest-threshold)/(1-threshold))*smooth(r/.9)
      const tail=smooth((-crest-.25)/.75)
      v=arm;e=arm-.8*tail;rot=arm*.95;tx=arm*t;ty=arm*s;sep=arm*.65
      outer=arm*.75;inner=tail*.28;under=arm*.95;break
    }
    // Gravity settle: upper tiers fall into their sleeves, bottom tiers remain raised
    // until the descending front reaches them; reverse is a slow mechanical reload.
    case 'submerge': {
      const p=beat+.8+y*delay*3+cluster*.2
      const raised=stage(p,8,.8,1.7,1.5),settled=stage(p-3.2,8,.5,1.5,1.1)
      v=raised;e=raised-.98*settled;tx=raised*.6;ty=raised*(cluster-.5)*.4
      outer=raised*.22;inner=settled*.08;under=raised*.85;break
    }
    // Eruption: central thrust and staggered satellite vents, separated by deep voids.
    case 'overdrive': {
      const p=beat+.45-r*delay*2
      const core=stage(p,4,.18,.7,1.15)*center,plume=stage(p-cluster*.85,4,.28,.85,1.2)*vent
      v=Math.max(core,plume);e=v-.82*(1-Math.max(center,vent))*stage(p,4,.2,.8,1.2)
      rot=plume*(seed>.5?1:-1);tx=v*s;ty=v*t;sep=plume;outer=core;inner=plume*.5;under=v;break
    }
  }
  // Seeded selective emitters remain independent; even the densest program has dark cells.
  const gate=.48+.52*seed
  return {activation:v,elevation:e,rotation:rot,tiltX:tx,tiltY:ty,separation:sep,outer:outer*gate,inner:inner*gate,under:under*gate}
}
