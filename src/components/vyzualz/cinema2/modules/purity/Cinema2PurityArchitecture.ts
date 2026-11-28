import type { PurityZone } from './Cinema2PurityMaze'

export type PurityBar = readonly [number,number,number,number,number?]
/** Coordinates are normalized to half-width and height above the floor.
 * No bars cross the walking envelope below 2.4 units. */
export function purityBars(zone:PurityZone,index:number):readonly PurityBar[] {
  const side=(s:number):PurityBar[]=>[[s*.83,.02,s*.83,.96],[s*.83,.96,s*.42,.96]]
  switch(zone){
    case 'threshold': return [[-.72,.02,-.72,.95],[-.72,.95,.72,.95],[.72,.95,.72,.02],[-.94,.02,-.94,.68],[.94,.02,.94,.68]]
    case 'crosswire': return [-1,1].flatMap(s=>[[s*.93,.03,s*.56,.98],[s*.56,.03,s*.93,.98]] as PurityBar[])
    case 'prism': return [[-.9,.02,0,.96],[0,.96,.9,.02],[-.98,.02,-.98,.61],[.98,.02,.98,.61]]
    case 'zigzag': {const s=index%2?1:-1;return [[s*.94,.02,s*.62,.48],[s*.62,.48,s*.86,.98],[s*.86,.98,-s*.15,.8],[-s*.15,.8,-s*.92,1.02],[-s*.94,.02,-s*.8,.66]]}
    case 'cathedral': return [...side(-1),...side(1),[-.72,.95,0,.72],[0,.72,.72,.95],[-.96,.05,-.96,.8],[.96,.05,.96,.8]]
    case 'obsidian': return [[-.92,.03,-.72,.71],[.92,.03,.72,.71]]
    case 'slalom': {const s=index%2?1:-1;return [[s*.58,.02,s*.58,.86,2.2],[s*.72,.02,s*.72,.86,2.2],[s*.58,.86,s*.72,.86,2.2],[-s*.92,.1,-s*.92,.96]]}
    case 'nexus': return [[-.88,.05,-.88,.65],[-.88,.65,-.5,.96],[-.5,.96,.5,.96],[.5,.96,.88,.65],[.88,.65,.88,.05],[-.98,.95,.98,.95]]
  }
}
export function purityArchitecture(zone:PurityZone,layout:string,index:number):PurityZone {
  if(layout==='angular' && zone!=='cathedral')return (['crosswire','prism','zigzag','nexus'] as const)[index%4]!
  if(layout==='geometric' && zone!=='cathedral')return (['threshold','prism','nexus','slalom'] as const)[index%4]!
  if(layout==='minimal' && zone!=='cathedral')return index%3===0?'obsidian':zone
  return zone
}
