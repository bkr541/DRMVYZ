import { ARC_ANGEL_PATTERNS, clamp01, type ArcAngelPattern } from './ArcAngelDomain'

const TAU=Math.PI*2
const wave=(x:number)=>.5-.5*Math.cos(TAU*x)
const smooth=(x:number)=>{const t=clamp01(x);return t*t*(3-2*t)}
export type ArcAngelStageCue={pillar:number;floor:number;crown:number;fixture:number;fragment:number;conduit:number;gesture:number}
/** Spatial programs use the existing beat phase and pattern crossfade, not another clock. */
export function arcAngelStageCue(pattern:ArcAngelPattern,phase:number,index:number,level:number):ArcAngelStageCue{
  const a=index/12,h=level/4,slow=wave(phase/16),beat=wave(phase),pair=wave(phase/4-a*2)
  switch(pattern){
    case 'awakening': return {pillar:smooth(slow*1.8-h-a*.35),floor:wave(phase/8-h),crown:.15+slow*.4,fixture:.15+slow*.35,fragment:slow*.4,conduit:slow*.45,gesture:slow}
    case 'divine-orbit': return {pillar:wave(phase/4-a),floor:wave(phase/4+a+h),crown:.5,fixture:wave(phase/8-a),fragment:.85,conduit:.45,gesture:wave(phase/8-a)}
    case 'communion': return {pillar:pair*.8,floor:wave(phase/8+h),crown:.55,fixture:pair,fragment:.25,conduit:pair,gesture:wave(phase/8-Math.abs(a-.5))}
    case 'ascension': return {pillar:smooth(slow*1.7-h),floor:wave(phase/8-h),crown:slow,fixture:slow,fragment:slow,conduit:slow,gesture:slow}
    case 'revelation': return {pillar:Math.pow(wave(phase/2-a*2-h),3),floor:wave(phase/2-h),crown:.45+.55*wave(phase/4),fixture:wave(phase/2-a),fragment:.7,conduit:.8,gesture:wave(phase/4)}
    case 'eclipse': return {pillar:index%6===0?.35:0,floor:.06,crown:.12,fixture:index%6===0?.5:0,fragment:.15,conduit:.08,gesture:slow*.4}
    case 'judgment': return {pillar:Math.pow(wave(phase/2-a+h),2),floor:wave(phase/2-h),crown:.8,fixture:wave(phase/2+a),fragment:.95,conduit:beat,gesture:wave(phase/2)}
    case 'transcendence': return {pillar:.35+.65*wave(phase/8-a-h),floor:.45+.55*wave(phase/8-h),crown:.9,fixture:.75,fragment:.8,conduit:.9,gesture:slow}
    case 'procession': return {pillar:Math.pow(wave(phase/4-a-h*.4),4),floor:wave(phase/4+a),crown:.35,fixture:Math.pow(wave(phase/4-a),3),fragment:.65,conduit:wave(phase/4-a),gesture:wave(phase/8-a)}
    case 'incantation': return {pillar:wave(phase/2+(index%2)*.5+h),floor:wave(phase/2+h),crown:wave(phase/4),fixture:wave(phase/2+(index%2)*.5),fragment:.5,conduit:pair,gesture:wave(phase/4+a*2)}
    case 'cathedral': return {pillar:.18+.28*slow,floor:.2,crown:.85,fixture:index%3===0?.6:.12,fragment:.12,conduit:.18,gesture:slow*.25}
    case 'dissolution': return {pillar:smooth((1-slow)*1.5-a-h),floor:1-wave(phase/8-h),crown:(1-slow)*.5,fixture:(1-slow)*.4,fragment:1-slow,conduit:(1-slow)*.3,gesture:1-slow}
  }
}
export function blendArcAngelStage(weights:readonly number[],phase:number,index=0,level=0):ArcAngelStageCue{
  const out:ArcAngelStageCue={pillar:0,floor:0,crown:0,fixture:0,fragment:0,conduit:0,gesture:0}
  ARC_ANGEL_PATTERNS.forEach(({value},i)=>{const w=weights[i]??0;if(w<=0)return;const cue=arcAngelStageCue(value,phase,index,level);for(const k of Object.keys(out) as (keyof ArcAngelStageCue)[])out[k]+=cue[k]*w})
  return out
}
/** Smooth, bounded sampling over the authored clip, without assuming unverified bone axes. */
export function arcAngelClipTime(duration:number,authoredTime:number,delay:number,amount:number):number{
  const center=4/14.58, target=clamp01((4+(authoredTime-4)*1.95+delay)/14.58)
  return Math.max(.001,Math.min(duration-.001,duration*(center+(target-center)*clamp01(amount))))
}
