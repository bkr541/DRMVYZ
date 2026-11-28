import { cinema2StableId, type Cinema2ModuleTypeId } from '../../contracts/Cinema2NativePresetManifest'

export const CINEMA2_ARC_ANGEL_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('arc-angel-native')
export const ARC_ANGEL_PATTERNS = [
  {value:'awakening',label:'Awakening'}, {value:'divine-orbit',label:'Divine Orbit'},
  {value:'communion',label:'Communion'}, {value:'ascension',label:'Ascension'},
  {value:'revelation',label:'Revelation'}, {value:'eclipse',label:'Eclipse'},
  {value:'judgment',label:'Judgment'}, {value:'transcendence',label:'Transcendence'},
  {value:'procession',label:'Procession'}, {value:'incantation',label:'Incantation'},
  {value:'cathedral',label:'Cathedral'}, {value:'dissolution',label:'Dissolution'},
] as const
export type ArcAngelPattern = typeof ARC_ANGEL_PATTERNS[number]['value']
export const ARC_ANGEL_PALETTE = {
  background:[.018,.009,.012,1], structural:[.27,.16,.09,1], primary:[1,.43,.09,1],
  secondary:[1,.075,.035,1], accent:[1,.85,.55,1], body:[1,.94,.84,1],
} as const
export const ARC_ANGEL_CAMERA = {
  position:[0,1.5,14.5], target:[0,.35,0], fovDegrees:48,
  minPosition:[-16,-2.2,-16], maxPosition:[16,7,16], minFovDegrees:40,maxFovDegrees:65,
} as const
export const clamp01=(x:number)=>Math.max(0,Math.min(1,x))
const wave=(x:number)=>.5+.5*Math.sin(x*Math.PI*2)
export function arcAngelPatternWeights(pattern:ArcAngelPattern,previous:ArcAngelPattern,blend:number,from?:readonly number[]):number[]{
  const t=clamp01(blend),k=t*t*(3-2*t)
  return ARC_ANGEL_PATTERNS.map(({value},i)=>(1-k)*(from?.[i]??(value===previous?1:0))+(value===pattern?k:0))
}
export interface ArcAngelPose { time:number; armDelay:number; ringTilt:number; ringSpeed:number; lift:number; emission:number; shock:number; trail:number }
/** Authored beat-space programs. Phase is delivered by the shared clock, never by a local beat detector. */
export function arcAngelPose(pattern:ArcAngelPattern,phase:number,arm:number,ring:number):ArcAngelPose {
  const a=arm/10,r=ring/6,side=arm<5?0:.5,pair=(arm%5)/5,slow=wave(phase/16),pulse=wave(phase/4)
  switch(pattern){
    case 'awakening': return {time:2.5+1.45*slow,armDelay:.65*wave(phase/8-a),ringTilt:.12*r,ringSpeed:.12, lift:.12*slow,emission:.18+.62*wave(phase/8-r),shock:.08,trail:.25}
    case 'divine-orbit': return {time:3.65+.55*wave(phase/8),armDelay:.45*wave(phase/8-a),ringTilt:.32*Math.sin(phase*.15+ring),ringSpeed:(ring%2?-.52:.42),lift:.2*slow,emission:.22+.78*wave(phase/4-r),shock:.15,trail:.55}
    case 'communion': return {time:2.8+1.6*pulse,armDelay:.75*wave(phase/4-pair),ringTilt:.15*Math.sin(phase*.2),ringSpeed:.14,lift:.12*pulse,emission:.24+.7*wave(phase/4-Math.abs(r-.5)),shock:.1,trail:.35}
    case 'ascension': return {time:4.1+2.5*slow,armDelay:.55*wave(phase/16-a),ringTilt:.38*slow,ringSpeed:.24+.18*slow,lift:.45*slow,emission:.35+.65*wave(phase/8-r),shock:.3*slow,trail:.65}
    case 'revelation': return {time:3.4+.9*wave(phase/2),armDelay:.6*wave(phase/2-a*2),ringTilt:.26*Math.sin(phase*.6+ring),ringSpeed:.65, lift:.16*pulse,emission:.12+.88*Math.pow(wave(phase/2-r*2),3),shock:.5*pulse,trail:.8}
    case 'eclipse': return {time:1.2+2.5*slow,armDelay:.25*wave(phase/8+side),ringTilt:.68*slow,ringSpeed:-.16,lift:-.12*slow,emission:.05+.45*Math.pow(wave(phase/8-r),4),shock:.05,trail:.15}
    case 'judgment': return {time:3.8+.8*Math.pow(pulse,3),armDelay:.65*wave(phase/2+side),ringTilt:.28*Math.sin(phase*.4+ring),ringSpeed:ring%2?-.72:.72,lift:.24*pulse,emission:.28+.72*Math.pow(wave(phase/2-r),2),shock:.8*pulse,trail:1}
    case 'transcendence': return {time:3.2+4.2*slow,armDelay:.8*wave(phase/16-pair),ringTilt:.42*Math.sin(phase*.18+ring),ringSpeed:.34,lift:.35*slow,emission:.45+.55*wave(phase/8-r),shock:.45*slow,trail:.9}
    case 'procession': return {time:2.5+2.3*wave(phase/8),armDelay:1.15*wave(phase/8-a),ringTilt:.18*Math.sin(phase*.2-ring),ringSpeed:.27,lift:.18*slow,emission:.1+.9*Math.pow(wave(phase/4-r),4),shock:.2,trail:.75}
    case 'incantation': return {time:3.2+1.1*wave(phase/4+side),armDelay:.9*wave(phase/2-pair+side),ringTilt:.38*Math.sin(phase*.4+ring*Math.PI/2),ringSpeed:-.38,lift:.16*pulse,emission:.16+.84*wave(phase/2+ring*.5),shock:.35*pulse,trail:.55}
    case 'cathedral': return {time:4+.3*slow,armDelay:.18*wave(phase/16-a),ringTilt:.08,ringSpeed:.08,lift:.06*slow,emission:.48+.42*wave(phase/16-r),shock:.1,trail:.2}
    case 'dissolution': return {time:1.6+2.5*wave(phase/16),armDelay:.85*wave(phase/16+a),ringTilt:.55*Math.sin(phase*.12+ring),ringSpeed:-.23,lift:-.24*slow,emission:.08+.6*(1-wave(phase/8-r)),shock:.12,trail:.45}
  }
}
export function blendArcAngelPose(weights:readonly number[],phase:number,arm=0,ring=0):ArcAngelPose {
  const result:ArcAngelPose={time:0,armDelay:0,ringTilt:0,ringSpeed:0,lift:0,emission:0,shock:0,trail:0}
  for(const [i,{value}] of ARC_ANGEL_PATTERNS.entries()){
    const w=weights[i]??0;if(w<=0)continue
    const pose=arcAngelPose(value,phase,arm,ring)
    for(const key of Object.keys(result) as (keyof ArcAngelPose)[])result[key]+=pose[key]*w
  }
  return result
}
