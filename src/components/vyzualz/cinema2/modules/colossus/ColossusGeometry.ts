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
// Maximum radial extent of the machined links, collars, pistons and end tools.
export const ARM_SURFACE_ALLOWANCE = 1.02
export const ARM_MIN_RADIUS = 6.05
export const COLOSSUS_FLOOR_Y = -5.25
export const COLOSSUS_CAMERA = {
  position: [0,-1.45,14.1], target: [0,.15,0], fovDegrees: 44,
  minPosition: [-2.8,-2.6,12.3], maxPosition: [2.8,-.65,16.5],
  minFovDegrees: 43, maxFovDegrees: 48,
} as const
export const clamp01 = (n:number) => Math.max(0,Math.min(1,n))
export type Point = readonly [number,number,number]
export interface ArmPose { shoulder:Point; elbow:Point; tip:Point; jaw:number; piston:number; pulse:number; charge:number }
export interface ArmInput { pattern:ColossusPattern; previousPattern?:ColossusPattern; blend?:number; fromWeights?:readonly number[]; phase:number; routePhase:number; reach:number; articulation:number; piston:number; jaw:number; release:number; kick:number; snare:number; bass:number; mid:number; build:number; vocal:number; safety:number }
const smooth = (t:number) => {const x=clamp01(t);return x*x*(3-2*x)}
const cycle = (t:number) => .5+.5*Math.sin(t)
function poseForPattern(index:number,p:ArmInput):ArmPose {
  const angle=[.43,Math.PI-.43,Math.PI+.43,2*Math.PI-.43][index%4]!
  const side=index===0||index===3?1:-1, upper=index<2?1:-1
  const w=p.phase*Math.PI/4, wave=cycle(w), stagger=cycle(w-index*Math.PI/2)
  // Independent travel, sweep, depth, clamp and routing channels; not six gain presets.
  let inward=0, bend=0, depth=0, grip=0, stroke=0, chase=0, charge=0
  switch(p.pattern){
    // Sequential docking: one tool extends after another, closing its jaws at full reach.
    case 'assembly': inward=stagger; bend=side*.45*(1-stagger); depth=stagger; grip=1-stagger; stroke=stagger; chase=-index*.25; charge=stagger; break
    // Alternating counterstroke: upper and lower pairs scissor and pump their cylinders.
    case 'articulation': {const counter=cycle(w*2+(upper===1?0:Math.PI));inward=.35+.55*counter; bend=side*upper*Math.sin(w*2); depth=2*counter-1; grip=counter; stroke=1-counter; chase=upper*.25; charge=counter;break}
    // Compression/hold: all four reach together, then maintain a broad locked-in pose.
    case 'suspension': {const clamp=smooth(wave*1.8);inward=.65+.35*clamp; bend=-side*.75; depth=-.65+.3*clamp; grip=.1*(1-clamp); stroke=clamp; chase=0; charge=.25+.65*clamp;break}
    // Overload: diagonal pairs flare outward, open jaws and chase in opposite directions.
    case 'mechanical-bloom': {const flare=cycle(w+(index%2)*Math.PI);inward=.35*(1-flare); bend=side*(.65+.35*flare); depth=.2+flare; grip=.5+.5*flare; stroke=flare; chase=index*.23+.3*Math.sin(w); charge=flare;break}
    // Release: retract into the service bays in a broad, slow synchronized sweep.
    case 'separation': inward=.08+.18*wave; bend=-side*(.65+.35*wave); depth=-1+.25*wave; grip=.75+.25*wave; stroke=.15+.25*wave; chase=index*.5; charge=1-wave;break
    // Coordinated event: all tools drive forward together, then recoil on the shared drop.
    case 'impact': {const hit=Math.pow(cycle(w),3);inward=.15+.85*hit; bend=side*.35*(1-hit); depth=1.3*hit-.4; grip=1-hit; stroke=hit; chase=0; charge=Math.max(hit,p.release);break}
  }
  const motion=clamp01(p.safety)*(1-.30*clamp01(p.vocal)), a=p.articulation*motion
  const approach=clamp01(.35+(inward-.35)*motion+(.12*p.bass+.18*p.kick+.18*p.build)*motion)
  // A radial/tangential envelope protects the maximum fitted hero, even with a full release.
  const rad=ARM_MIN_RADIUS+2.65*(1-p.reach*approach)+.85*p.release*motion
  const point=(r:number,t:number,z:number):Point=>[Math.cos(angle)*r-Math.sin(angle)*t,Math.max(COLOSSUS_FLOOR_Y+ARM_SURFACE_ALLOWANCE+.16,Math.sin(angle)*r+Math.cos(angle)*t),z]
  const piston=clamp01(p.piston+(stroke-.5)*.85*p.piston*motion)
  return {
    shoulder:point(10.1,0,-5.4),
    elbow:point(8.35+.55*(1-inward)*motion,2.35*bend*a+.45*p.mid*motion,-2.65-1.1*piston*motion+.65*depth*a),
    tip:point(rad,1.85*bend*a,.05+2.2*depth*motion*p.piston+.45*p.release*motion),
    jaw:.14+.65*clamp01(p.jaw+(grip-.5)*1.2*p.jaw*motion+.18*p.snare*motion),
    piston,pulse:p.routePhase+chase,charge:.5+(charge-.5)*motion,
  }
}

/** Retarget from the actual in-flight mixture, so a new trigger cannot snap to a stale endpoint. */
export function colossusPatternWeights(pattern:ColossusPattern,previous:ColossusPattern,blend:number,fromWeights?:readonly number[]):number[]{
  const k=smooth(blend)
  return COLOSSUS_PATTERNS.map(({value},i)=>(1-k)*(fromWeights?.[i]??(value===previous?1:0))+(value===pattern?k:0))
}

/** Convex combinations retain the safe mechanical envelope. All output channels blend together. */
export function colossusArmPose(index:number,p:ArmInput):ArmPose {
  if(p.blend===undefined||p.blend>=1||!p.previousPattern)return poseForPattern(index,p)
  const weights=colossusPatternWeights(p.pattern,p.previousPattern,p.blend,p.fromWeights)
  let result:ArmPose|undefined, total=0
  for(const [i,{value}] of COLOSSUS_PATTERNS.entries()){
    const weight=weights[i]!;if(weight<=0)continue
    const pose=poseForPattern(index,{...p,pattern:value})
    if(!result){result=pose;total=weight;continue}
    const k=weight/(total+weight),from=result;total+=weight
    const mix=(a:number,b:number)=>a+(b-a)*k
    const point=(a:Point,b:Point):Point=>[mix(a[0],b[0]),mix(a[1],b[1]),mix(a[2],b[2])]
    result={shoulder:point(from.shoulder,pose.shoulder),elbow:point(from.elbow,pose.elbow),tip:point(from.tip,pose.tip),jaw:mix(from.jaw,pose.jaw),piston:mix(from.piston,pose.piston),pulse:mix(from.pulse,pose.pulse),charge:mix(from.charge,pose.charge)}
  }
  return result??poseForPattern(index,p)
}
