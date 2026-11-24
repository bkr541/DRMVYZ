import { HONEY_NEIGHBORS,HONEY_PITCH,honeySeed } from './Cinema2HoneyDomain'
import type { HoneyCell } from './Cinema2HoneyLayout'

export const HONEY_LIGHT_DEFAULTS={outerGain:1,innerGain:1,underGain:1,lightSpill:.65,ambient:.48,bloom:.30,ao:.65} as const
export type HoneyLightControls={ [K in keyof typeof HONEY_LIGHT_DEFAULTS]:number }
export const HONEY_LIGHT_RANGES={outerGain:2,innerGain:2,underGain:2,lightSpill:1,ambient:1,bloom:1,ao:1} as const
export const HONEY_CHANNEL_POWER=[2.8,1.45,2.5] as const
export const HONEY_SPILL_RADIUS=1.05
export const HONEY_SPILL_LIMIT=.62
export function honeyStaticChannels(q:number,r:number,heightSeed:number):HoneyCell['channels']{
  const density=honeySeed(Math.floor(q/3),Math.floor(r/3),59)
  const outer=honeySeed(q,r,23)<.36+.40*density
  const inner=honeySeed(q,r,41)<(outer?.47:.14)
  const under=heightSeed>.35&&honeySeed(q,r,61)<.65
  return [outer?.65+.35*honeySeed(q,r,67):0,inner?.6+.3*honeySeed(q,r,71):0,under?.45+.45*honeySeed(q,r,73):0]
}
/** Seven vec4 records per receiver: self and six axial neighbors. xyz are independent
 * channel levels, w is source cap elevation. Missing neighbors have zero emission. */
export function honeyLightInstances(cells:readonly HoneyCell[]):Float32Array{
  const byId=new Map(cells.map(c=>[c.id,c]))
  const values=new Float32Array(cells.length*28)
  cells.forEach((cell,i)=>[cell.id,...cell.neighbors].forEach((id,j)=>{
    const source=byId.get(id);if(source)values.set([...source.channels,source.elevation],i*28+j*4)
  }))
  return values
}
export const HONEY_LIGHT_OFFSETS=[[0,0],...HONEY_NEIGHBORS.map(([q,r])=>[HONEY_PITCH*Math.sqrt(3)/2*q,HONEY_PITCH*(r+q/2)])]
export const HONEY_LIGHT_OFFSET_GLSL=HONEY_LIGHT_OFFSETS.map(([x,y])=>`vec2(${x!.toFixed(7)},${y!.toFixed(7)})`).join(',')
/** Polynomial compact support, mirrored by the shader; no spill beyond radius. */
export function honeySpillFalloff(distance:number):number{
  const t=Math.max(0,1-Math.max(0,distance)/HONEY_SPILL_RADIUS);return t*t
}
export function honeyReadLightControls(get:(key:string)=>unknown):HoneyLightControls{
  return Object.fromEntries(Object.entries(HONEY_LIGHT_DEFAULTS).map(([key,base])=>{
    const value=get(key);return [key,typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(HONEY_LIGHT_RANGES[key as keyof HoneyLightControls],value)):base]
  })) as HoneyLightControls
}

/** Per-cell audio accents preserve authored hue and individual physical channel ceilings.
 * The renderer still applies the user's independent gains and Master Intensity exactly once. */
export function honeyAudioChannels(base:HoneyCell['channels'],accents:HoneyCell['channels'],gain:number,coverage:number):HoneyCell['channels']{
  return accents.map((v,i)=>Math.max(0,Math.min(1,base[i]!+Math.min(.65,v)*gain*coverage*(1-base[i]!*.65)))) as [number,number,number]
}
