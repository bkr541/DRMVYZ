import { HONEY_MAX_ELEVATION,HONEY_MIN_ELEVATION,HONEY_MAX_ROTATION,HONEY_MAX_TILT,HONEY_MAX_SEPARATION,honeySeed,type HoneyPose } from './Cinema2HoneyDomain'
import { constrainHoneyPose,type HoneyCell } from './Cinema2HoneyLayout'
import type { HoneyPatternSample } from './Cinema2HoneyPatterns'

export const HONEY_MOTION_DEFAULTS={motion:.72,rate:1,attack:.14,release:.55,rotation:.65,tilt:.65,separation:.65,elevation:1,coverage:.72,width:1,delay:.125,transition:'1'} as const
export interface HoneyMotionControls {motion:number;rate:number;attack:number;release:number;rotation:number;tilt:number;separation:number;elevation:number;coverage:number;width:number;delay:number;transition:string}
export interface HoneyVisualCell extends HoneyCell { pose:HoneyPose }
export interface HoneyCellState { current:HoneyVisualCell; target:HoneyVisualCell; velocity:HoneyPose }
const keys=['elevation','rotation','tiltX','tiltY','x','y'] as const
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t
const clamp=(v:number)=>Math.max(0,Math.min(1,v))
export function staticHoneyCell(cell:HoneyCell):HoneyVisualCell{return {...cell,pose:{elevation:cell.elevation,rotation:0,tiltX:0,tiltY:0,x:0,y:0}}}
export function blendHoneyCell(a:HoneyVisualCell,b:HoneyVisualCell,t:number):HoneyVisualCell{
  const pose=constrainHoneyPose(Object.fromEntries(keys.map(k=>[k,lerp(a.pose[k],b.pose[k],t)])) as unknown as HoneyPose)
  return {...b,pose,elevation:pose.elevation,channels:[lerp(a.channels[0],b.channels[0],t),lerp(a.channels[1],b.channels[1],t),lerp(a.channels[2],b.channels[2],t)]}
}
export function targetHoneyCell(c:HoneyCell,s:HoneyPatternSample,k:HoneyMotionControls):HoneyVisualCell{
  const m=k.motion*k.elevation, seed=honeySeed(c.q,c.r,107), angle=honeySeed(c.q,c.r,109)*Math.PI*2
  const height=c.elevation+s.elevation*m*(s.elevation>=0?HONEY_MAX_ELEVATION-c.elevation:c.elevation-HONEY_MIN_ELEVATION)
  // Angles and offsets only develop on caps clear of the sleeve. Retracted caps remain seated.
  const raised=clamp((height-.68)/.23)*k.motion
  const pose=constrainHoneyPose({elevation:height,rotation:s.rotation*raised*k.rotation*HONEY_MAX_ROTATION,tiltX:s.tiltX*raised*k.tilt*HONEY_MAX_TILT,tiltY:s.tiltY*raised*k.tilt*HONEY_MAX_TILT,x:Math.cos(angle)*s.separation*raised*k.separation*HONEY_MAX_SEPARATION,y:Math.sin(angle)*s.separation*raised*k.separation*HONEY_MAX_SEPARATION})
  const gate=clamp((k.coverage-seed)*8+.3), channels=[s.outer,s.inner,s.under].map((v,i)=>clamp(c.channels[i]!*.48+v*gate*.85)) as [number,number,number]
  return {...c,pose,elevation:pose.elevation,channels}
}
export function createHoneyCellState(c:HoneyCell):HoneyCellState{const current=staticHoneyCell(c);return {current,target:current,velocity:{elevation:0,rotation:0,tiltX:0,tiltY:0,x:0,y:0}}}
/** Exact first-order response for a constant target over dt, no overshoot. A descending cap aligns before entering the sleeve. */
export function advanceHoneyCell(state:HoneyCellState,target:HoneyVisualCell,dt:number,k:HoneyMotionControls){
  state.target=target
  if(dt<=0)return
  const prior=state.current, rising=target.pose.elevation>=prior.pose.elevation,alpha=1-Math.exp(-dt*3/Math.max(.025,rising?k.attack:k.release))
  const next=blendHoneyCell(prior,target,alpha)
  if(!rising&&target.pose.elevation<.68){
    const align=1-Math.exp(-dt*3/Math.max(.025,k.attack))
    for(const key of ['rotation','tiltX','tiltY','x','y'] as const)next.pose[key]=lerp(prior.pose[key],0,align)
    if(Math.max(Math.abs(next.pose.rotation),Math.abs(next.pose.tiltX),Math.abs(next.pose.tiltY),Math.abs(next.pose.x),Math.abs(next.pose.y))>.001)next.pose.elevation=Math.max(next.pose.elevation,Math.min(prior.pose.elevation,.68))
    next.pose=constrainHoneyPose(next.pose);next.elevation=next.pose.elevation
  }
  if(k.motion===0){next.pose=prior.pose;next.elevation=prior.elevation}
  for(const key of keys)state.velocity[key]=(next.pose[key]-prior.pose[key])/dt
  state.current=next
}
