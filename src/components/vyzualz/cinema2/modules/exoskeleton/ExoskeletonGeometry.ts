import { cinema2StableId, type Cinema2ModuleTypeId } from '../../contracts/Cinema2NativePresetManifest'

export const CINEMA2_EXOSKELETON_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('exoskeleton-native')
export const EXOSKELETON_PATTERNS=[
  {value:'armor',label:'Armor'}, {value:'deployment',label:'Deployment'},
  {value:'retraction',label:'Retraction'}, {value:'exposure',label:'Exposure'},
  {value:'mechanical-relay',label:'Mechanical Relay'}, {value:'full-assembly',label:'Full Assembly'},
] as const
export type ExoskeletonPattern=typeof EXOSKELETON_PATTERNS[number]['value']
export const EXOSKELETON_PALETTE={background:[7/255,10/255,16/255,1],structural:[41/255,49/255,58/255,1],primary:[72/255,232/255,1,1],secondary:[149/255,100/255,1,1],accent:[232/255,241/255,1,1]} as const
export const HERO_RADIUS=1.65
export const HERO_OFFSET=.18
export const BANKS=['left','right','top','bottom','rear'] as const
export type Bank=typeof BANKS[number]
export const clamp01=(x:number)=>Math.min(1,Math.max(0,x))
export function armorBankCounts(count:number):readonly number[]{return count===12?[3,3,2,2,2]:count===24?[5,5,4,4,6]:[4,4,3,3,4]}
export function armorHalfExtent(half:number,largest:number,clearance:number){return Math.max(.35,half+Math.max(.12,largest*Math.max(.12,Math.min(.4,clearance)))+.05)}
export interface ArmorInput {pattern:ExoskeletonPattern;previousPattern?:ExoskeletonPattern;blend?:number;phase:number;routePhase:number;opening:number;travel:number;kick:number;snare:number;bass:number;mid:number;build:number;drop:number;vocal:number;safety:number}
export interface ArmorPose {angle:number;travel:number;pulse:number}
function pose(index:number,bank:number,p:ArmorInput):ArmorPose{
  // Each stable ID owns a different mechanical sequence, not a different light color.
  const w=p.phase*Math.PI/4, stagger=index*.65+bank*.85
  const wave=.5+.5*Math.sin(w-stagger), cycle=.5+.5*Math.cos(w*.5)
  const latch=clamp01((cycle-.18)*1.45), ordered=clamp01((cycle*1.8-(index*.12+bank*.07)))
  let opening=0,travel=0,relay=0
  switch(p.pattern){
    case 'armor': // dormant: nested, gently breathing plates
      opening=-.65+.12*wave;travel=-.48+.08*wave;relay=.10*wave;break
    case 'deployment': // expansion: alternating banks unfold in a pressure wave
      opening=.24+.34*wave;travel=.34+.38*wave;relay=wave;break
    case 'retraction': // controlled collapse: hinge closes before carriage retracts
      opening=.36-.95*latch;travel=.42-.92*clamp01((latch-.25)/.75);relay=.15*(1-latch);break
    case 'exposure': // reveal: opposing side shutters park outward, rear stays low
      opening=bank===4?-.44:.38+.18*wave;travel=bank===4?-.30:.43+.12*wave;relay=bank===4?.12:wave;break
    case 'mechanical-relay': // articulated drive: short alternating hinge/piston strokes
      opening=.54*Math.pow(wave,3)-.22;travel=.48*Math.pow(.5+.5*Math.sin(w-stagger-.7),3)-.18;relay=Math.pow(wave,4);break
    case 'full-assembly': // staged assembly: latching starts at the lowest index
      opening=.35-.88*ordered;travel=.35-.75*clamp01((ordered-.2)/.8);relay=ordered;break
  }
  const motion=p.safety*(1-.3*clamp01(p.vocal));const kick=index%2===bank%2?p.kick:0
  const amount=clamp01(p.opening+motion*(opening+.15*p.mid+.25*kick-.20*p.build+.65*p.drop))
  const distance=clamp01(p.travel+motion*(travel+.20*p.bass+.48*p.drop))
  const packet=((p.routePhase-index*.11-bank*.16)%1+1)%1
  return {angle:amount*65*Math.PI/180,travel:distance*.60,pulse:clamp01(.4*relay+.6*Math.max(0,1-packet*5)+.20*p.snare*(index%2===bank%2?1:0)+.45*p.drop)}
}
export function armorPose(index:number,bank:number,p:ArmorInput):ArmorPose{
  const to=pose(index,bank,p);if(!p.previousPattern||p.previousPattern===p.pattern||p.blend===undefined||p.blend>=1)return to
  const from=pose(index,bank,{...p,pattern:p.previousPattern}),t=clamp01(p.blend),k=t*t*(3-2*t)
  return {angle:from.angle+(to.angle-from.angle)*k,travel:from.travel+(to.travel-from.travel)*k,pulse:from.pulse+(to.pulse-from.pulse)*k}
}
