import type { HoneyCueKind } from './Cinema2HoneyAudio'

// Zero-neutral targets from shared choreography, not a parallel significance detector.
export const HONEY_DIRECTOR_DEFAULTS={directorIntensity:0,directorBuild:0,directorImpact:0} as const
export type HoneyDirectorChannels={-readonly [K in keyof typeof HONEY_DIRECTOR_DEFAULTS]:number}
export const clampHoneyPerformance=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0
const smooth=(n:number)=>{const x=clampHoneyPerformance(n);return x*x*(3-2*x)}

/** Presentation-only weights. The existing cue envelope owns timing and identity.
 * Impact is sampled on the cue frame (the shared authority is discrete), not
 * stretched into a second event or used to decide whether a drop occurred. */
export function honeyCuePerformance(kind:HoneyCueKind,director:Readonly<HoneyDirectorChannels>){
  const intensity=clampHoneyPerformance(director.directorIntensity),impact=clampHoneyPerformance(director.directorImpact)
  const significance=kind==='drop'||kind==='kick'||kind==='snare'||kind==='downbeat'?impact:0
  return {weight:1+.15*intensity+.25*significance,coverage:.08*intensity+.14*significance}
}

/** Merge the two views of build context rather than applying two impulses.
 * Concentration is spatial; only the existing canonical drop cue expands it. */
export function honeyBuildPerformance(audioBuild:number,directorBuild:number,region:number){
  const tension=Math.max(clampHoneyPerformance(audioBuild),clampHoneyPerformance(directorBuild))
  const concentration=smooth((region-(.72-.30*tension))*4)
  return {tension,concentration}
}
