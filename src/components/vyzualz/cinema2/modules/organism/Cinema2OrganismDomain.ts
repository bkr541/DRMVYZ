/** Preset-owned deterministic morphology. Coordinates are in Cinema 2.0 world units. */
export const ORGANISM_PATTERNS = ['respiration','synaptic','bloom','vortex','pulse','entangle','colossus','dormancy'] as const
export type OrganismPattern = typeof ORGANISM_PATTERNS[number]
export const ORGANISM_PALETTE = {
  background: [.012,.016,.024,1], wall: [.24,.27,.32,1], metal: [.38,.43,.49,1],
  strand: [.82,.92,1,1], core: [1,.96,.87,1], hazeTint: [.34,.43,.55,1],
} as const
export const ORGANISM_DEFAULTS = {
  intensity:1, reactivity:1, motionAmount:.8, reach:1, bend:.65, growth:.8, motionRate:.7,
  strandThickness:.032, coreScale:1, projectionIntensity:.85, lightDistance:5.4,
  projectionSpeed:.6, shadowSoftness:1,
  overallEnergy:0, subAmount:0, bassPressure:0, lowMidAmount:0, midAmount:0, highsAmount:0, airAmount:0, fluxAmount:0, vocalPresence:0,
  directorIntensity:0, directorMomentum:0, buildAmount:0, directorImpact:0, variation:0,
  beatAccent:0, kickAccent:0, snareAccent:0, downbeatAccent:0, barAccent:0, phraseAccent:0, sectionAccent:0, dropAccent:0,
} as const
export type OrganismNumber = keyof typeof ORGANISM_DEFAULTS
export type OrganismValues = Record<OrganismNumber,number>
export type Point = readonly [number,number,number]
export type OrganismColor = readonly [number,number,number,number]
export interface OrganismState {
  values: OrganismValues; pattern: OrganismPattern; previous: OrganismPattern; transition: number
  phase: number; motion: number; flash: number; silence: number; projectionPhase: number
  palette: Record<keyof typeof ORGANISM_PALETTE,OrganismColor>
}
export const clamp = (v:number,min=0,max=1) => Math.max(min,Math.min(max,v))
const TAU = Math.PI*2
const mix = (a:number,b:number,t:number) => a+(b-a)*t
// reach, curl, child spread, illumination, wave, projection distance. Deliberately independent signatures.
export const ORGANISM_PATTERN_PROFILES: Readonly<Record<OrganismPattern,readonly [number,number,number,number,number,number]>> = {
  respiration:[1,.65,.75,.68,.3,1], synaptic:[.85,.5,.58,1,.1,1.05], bloom:[1.13,.35,1,.8,.45,1],
  vortex:[1,1.55,.7,.8,.4,1.1], pulse:[.95,.68,.7,.9,1.25,1], entangle:[.83,1.9,1,.68,.55,1.1],
  colossus:[1.12,.48,.92,.85,.35,.77], dormancy:[.57,.3,.36,.28,.1,1.22],
}
export function organismProfile(state:OrganismState):readonly number[] {
  return ORGANISM_PATTERN_PROFILES[state.previous].map((v,i)=>mix(v,ORGANISM_PATTERN_PROFILES[state.pattern][i]!,clamp(state.transition)))
}
/** Fibonacci directions avoid a flat pinwheel; each branch has a distinct deterministic phase. */
export function organismBranchDirection(i:number):Point {
  const y = 1-2*(i+.5)/12, r=Math.sqrt(1-y*y), a=i*Math.PI*(3-Math.sqrt(5))
  return [Math.cos(a)*r,y,Math.sin(a)*r]
}
export function organismBranchPoint(state:OrganismState, branch:number, t:number, child=0):Point {
  const v=state.values, p=organismProfile(state), m=state.motion*(1-.86*state.silence)*(1-.32*clamp(v.vocalPresence)), time=state.phase
  const [x,y,z]=organismBranchDirection(branch), a=Math.atan2(z,x)
  const tt=clamp(t), root=1.02*clamp(v.coreScale,.7,1.3),
    breathing=m*(.09*Math.sin(time*.78)+.1*v.subAmount+.06*v.beatAccent),
    reach=clamp(v.reach,.65,1.25)*(p[0]!+breathing+.12*m*v.bassPressure+.14*m*v.buildAmount+.1*m*v.sectionAccent+.18*m*v.dropAccent),
    wave=m*p[4]!*(.12*Math.sin(time*1.8-tt*TAU+branch*.5)+.14*v.kickAccent*Math.sin(tt*Math.PI)-.10*v.snareAccent*Math.sin(tt*Math.PI)),
    twist=clamp(v.bend,0,1.2)*p[1]!*(.46+.14*m*Math.sin(time+branch*.8)+.24*m*v.lowMidAmount),
    radial=root+tt*3.9*reach+wave,
    angle=a+twist*tt*tt*(branch%2===0?1:-1)+m*.08*Math.sin(time*.6+tt*6+branch),
    horizontal=Math.sqrt(1-y*y), lift=.38*Math.sin(tt*Math.PI*1.5+branch*.8)*tt*twist,
    extension=child===0?0:tt*clamp(v.growth,0,1)*p[2]!*(.52+.24*m*v.midAmount+.17*m*v.buildAmount),
    ca=angle+child*.9
  return [clamp(Math.cos(angle)*horizontal*radial+Math.cos(ca)*extension,-6.2,6.2),clamp(y*radial+lift+child*extension*.65,-4.85,5.5),clamp(Math.sin(angle)*horizontal*radial+Math.sin(ca)*extension,-6.2,6.2)]
}
export function organismChildPoint(state:OrganismState,branch:number,child: -1|1,t:number):Point {
  const anchor=child===-1?.42:.66, start=organismBranchPoint(state,branch,anchor), end=organismBranchPoint(state,branch,anchor+.25*t,child)
  // Child begins exactly on parent. Grow as a lateral arc rather than disconnected rods.
  const growth=clamp(state.values.growth,0,1)*organismProfile(state)[2]!, u=clamp(t)*growth
  const angle=branch*2.39996+child*1.4, lateral=Math.sin(u*Math.PI*.75)*1.15
  return [clamp(mix(start[0],end[0],u)+Math.cos(angle)*lateral,-6.2,6.2),clamp(mix(start[1],end[1],u)+child*lateral*.5,-4.85,5.5),clamp(mix(start[2],end[2],u)+Math.sin(angle)*lateral,-6.2,6.2)]
}
export function organismLightPosition(state:OrganismState,index:number):Point {
  const v=state.values, p=organismProfile(state), angle=.75+index*Math.PI+state.projectionPhase
  const radius=clamp(v.lightDistance*p[5]!-.35*state.motion*v.directorImpact,3.5,7.5)
  return [Math.cos(angle)*radius,1.25+Math.sin(angle*1.7)*.75,Math.sin(angle)*radius]
}
export function organismIllumination(state:OrganismState,branch:number,t:number):number {
  const v=state.values, p=organismProfile(state), f=state.flash, phase=state.phase
  const pulse=Math.pow(.5+.5*Math.sin(t*12-phase*2.3+branch*.64),state.pattern==='synaptic'?6:2)
  return clamp(p[3]!*(.30+.38*pulse+.12*v.highsAmount+.12*t*v.airAmount+.10*v.fluxAmount+.12*f*v.kickAccent+.08*f*v.snareAccent+.08*v.barAccent),0,1.3)
}
