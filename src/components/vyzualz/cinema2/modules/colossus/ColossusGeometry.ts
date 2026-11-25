import { cinema2StableId, type Cinema2ModuleTypeId } from '../../contracts/Cinema2NativePresetManifest'

export const CINEMA2_COLOSSUS_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('colossus-native')
/** Original COLOSSUS choreography domain. World units, Y up, camera on +Z. */
export const COLOSSUS_PATTERNS = [
  { value: 'assembly', label: 'Assembly' }, { value: 'articulation', label: 'Articulation' },
  { value: 'suspension', label: 'Suspension' }, { value: 'mechanical-bloom', label: 'Mechanical Bloom' },
  { value: 'separation', label: 'Separation' }, { value: 'impact', label: 'Impact' },
] as const
export type ColossusPattern = typeof COLOSSUS_PATTERNS[number]['value']
export const COLOSSUS_PALETTE = {
  background: [8/255,11/255,16/255,1], structural: [52/255,61/255,70/255,1],
  primary: [0,216/255,229/255,1], secondary: [1,135/255,57/255,1], accent: [234/255,247/255,1,1],
} as const
export const HERO_RADIUS = 2.85
export const HERO_OFFSET = .4
// Worst case: bounding sphere at scale 1.2, all three offsets, idle movement and 15% clearance.
export const HERO_EXCLUSION = (HERO_RADIUS * 1.2 + Math.sqrt(3)*HERO_OFFSET + .12) * 1.15
export const ARM_MIN_RADIUS = 5.45
export const clamp01 = (n:number) => Math.max(0,Math.min(1,n))
export type Point = readonly [number,number,number]
export interface ArmPose { shoulder:Point; elbow:Point; tip:Point; jaw:number; pulse:number }
export interface ArmInput { pattern:ColossusPattern; previousPattern?:ColossusPattern; blend?:number; phase:number; routePhase:number; reach:number; articulation:number; piston:number; jaw:number; release:number; kick:number; snare:number; bass:number; mid:number; build:number; vocal:number; safety:number }
function poseForPattern(index:number,p:ArmInput):ArmPose {
  const angle=[.43,Math.PI-.43,Math.PI+.43,2*Math.PI-.43][index%4]!
  const pair=index%2, w=p.phase*Math.PI/4, wave=.5+.5*Math.sin(w+pair*Math.PI)
  let inward=0, bend=0, spread=0, chase=0
  switch(p.pattern){
    case 'assembly': inward=.32+.48*wave; bend=.3*wave; chase=pair*.5; break
    case 'articulation': inward=.45+.25*wave; bend=Math.sin(w+index*Math.PI/2); chase=index*.25; break
    case 'suspension': inward=.12+.08*wave; bend=.1*Math.sin(w*.5); chase=0; break
    case 'mechanical-bloom': spread=.5+.5*Math.cos(w); bend=(pair?1:-1)*spread; inward=.25*(1-spread); chase=-index*.25; break
    case 'separation': spread=.7+.25*wave; bend=(pair?1:-1)*.75; inward=.05; chase=index*.5; break
    case 'impact': inward=.25+.65*Math.pow(wave,4); bend=.25*wave; spread=p.release*.7; chase=pair*.5; break
  }
  const motion=p.safety*(1-.30*clamp01(p.vocal)), a=p.articulation*motion
  const rad=ARM_MIN_RADIUS+.85*(1-clamp01(p.reach*(.3+(inward-.3)*motion)+(.20*p.bass+.25*p.kick+.20*p.build)*motion))+.35*spread*a+.48*p.release*motion
  // Each segment lies in the same outward half-space; the closest surface remains outside the exclusion sphere.
  const point=(r:number,t:number,z:number):Point=>[Math.cos(angle)*r-Math.sin(angle)*t,Math.sin(angle)*r+Math.cos(angle)*t,z]
  return {shoulder:point(8.05,0,-3.5),elbow:point(6.65,.75*bend*a+.28*p.mid*motion,-1.75-.36*p.piston*motion),tip:point(rad,.45*bend*a,-.35+.30*p.piston*motion),jaw:.14+.35*clamp01(p.jaw+.15*p.snare*motion),pulse:((p.routePhase+chase)%1+1)%1}
}

/** Blend automatic changes only; both poses and their convex segment interpolation stay outside the hero half-space. */
export function colossusArmPose(index:number,p:ArmInput):ArmPose {
  const to=poseForPattern(index,p)
  if(!p.previousPattern||p.previousPattern===p.pattern||p.blend===undefined||p.blend>=1)return to
  const from=poseForPattern(index,{...p,pattern:p.previousPattern}),t=clamp01(p.blend),k=t*t*(3-2*t)
  const point=(a:Point,b:Point):Point=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k]
  return {shoulder:point(from.shoulder,to.shoulder),elbow:point(from.elbow,to.elbow),tip:point(from.tip,to.tip),jaw:from.jaw+(to.jaw-from.jaw)*k,pulse:to.pulse}
}
