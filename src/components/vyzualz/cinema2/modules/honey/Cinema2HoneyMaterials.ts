import { HONEY_FINISHES } from './Cinema2HoneyDomain'
import { honeySeed } from './Cinema2HoneyDomain'

/** Fixed spatial finish selection. No user-facing material or distribution parameter. */
export function honeyFinish(q:number,r:number):typeof HONEY_FINISHES[number] {
  const cluster=honeySeed(Math.floor(q/3),Math.floor(r/3),63)
  const accent=honeySeed(q,r,31)
  const value=accent<.25?honeySeed(q,r,37):cluster
  return HONEY_FINISHES[value<.55?0:value<.75?1:value<.90?2:3]!
}
export const HONEY_MATERIALS = [
  {metalness:.65,roughness:.48,tint:1,anisotropy:.12},
  {metalness:.83,roughness:.38,tint:1.25,anisotropy:.72},
  {metalness:.16,roughness:.58,tint:.84,anisotropy:.08},
  {metalness:.05,roughness:.53,tint:.95,anisotropy:0},
] as const
/** Shared CPU/GPU parameter source, relative to the editable face color. */
export const HONEY_MATERIAL_GLSL = HONEY_MATERIALS.map(m=>`vec4(${m.metalness.toFixed(3)},${m.roughness.toFixed(3)},${m.tint.toFixed(3)},${m.anisotropy.toFixed(3)})`).join(',')
