import { describe, expect, it } from 'vitest'
import { IfritTimeline, createIfritVisualFrame, ifritStroke } from '../modules/ifrit/Cinema2IfritMotion'
import { IFRIT_PATTERNS } from '../modules/ifrit/Cinema2IfritDomain'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'

const controls={count:4,spacing:1,twist:.6,detail:1}
const phase={travel:1.3,spin:.37,score:2.7}
function frame(time:number,bpm=120): Cinema2ModuleFrameReadContext {
  const beats=time*bpm/60
  return {transport:{sourcePresent:true},audio:{rhythm:{beatIndex:{available:true,value:Math.floor(beats)},beatPhase:{available:true,value:beats%1},bpm:{available:true,value:bpm}}}} as unknown as Cinema2ModuleFrameReadContext
}
describe('Ifrit reference composition and authored motion',()=>{
  it('uses a larger terminal opening and a short passage instead of a deep stack',()=>{
    const visual=createIfritVisualFrame({travel:0,spin:0,score:0},controls,{},'infernalPassage')
    visual.rings.forEach((r,i)=>expect(r.distance).toBeCloseTo([2.4,4,6.6,10.8][i],10))
    const projectedRadius=3.08*Math.cos(Math.PI/6)/(10.8*Math.tan(35*Math.PI/180)*2)
    expect(projectedRadius).toBeGreaterThan(.17)
    expect(projectedRadius).toBeLessThan(.20)
  })
  it('gives six patterns different depth/angle/radius/illumination performances',()=>{
    const poses=IFRIT_PATTERNS.map(p=>createIfritVisualFrame(phase,controls,{},p))
    for(let i=0;i<poses.length;i++) for(let j=0;j<i;j++) expect(poses[i].rings).not.toEqual(poses[j].rings)
    expect(poses[0].wallTravel).toBe(phase.travel)
  })
  it('authors anticipation, a sustained hold, then recovery rather than a sine sweep',()=>{
    expect(ifritStroke(.05)).toBe(0)
    expect(ifritStroke(.60)).toBe(1)
    expect(ifritStroke(.70)).toBe(1)
    expect(ifritStroke(.9)).toBeLessThan(ifritStroke(.8))
  })
  it('separates near/middle/far kick gestures instead of translating every ring together',()=>{
    const base=createIfritVisualFrame(phase,controls,{},'infernalPassage')
    const near=createIfritVisualFrame(phase,controls,{kickNear:1},'infernalPassage')
    const far=createIfritVisualFrame(phase,controls,{kickFar:1},'infernalPassage')
    expect(near.rings[0].distance).toBeLessThan(base.rings[0].distance)
    expect(near.rings[3]).toEqual(base.rings[3])
    expect(far.rings[0]).toEqual(base.rings[0])
    expect(far.rings[3].distance).toBeLessThan(base.rings[3].distance)
  })
  it('drops expand foreground, align actual angles, then return to the authored pose',()=>{
    const base=createIfritVisualFrame(phase,controls,{},'counterfire')
    const expanded=createIfritVisualFrame(phase,controls,{dropExpand:1},'counterfire')
    const aligned=createIfritVisualFrame(phase,controls,{dropAlign:1},'counterfire')
    expect(expanded.rings[0].radius).toBeGreaterThan(base.rings[0].radius)
    const error=(angle:number)=>Math.abs(angle-Math.round(angle/(Math.PI/3))*(Math.PI/3))
    expect(error(aligned.rings[0].angle)).toBeLessThan(error(base.rings[0].angle))
    expect(createIfritVisualFrame(phase,controls,{},'counterfire')).toEqual(base)
  })
  it('reassigns near/far roles when a portal recycles to the back of the passage',()=>{
    const recycled={...phase,travel:4}
    const base=createIfritVisualFrame(recycled,controls,{},'infernalPassage')
    const near=createIfritVisualFrame(recycled,controls,{kickNear:1},'infernalPassage')
    const far=createIfritVisualFrame(recycled,controls,{kickFar:1},'infernalPassage')
    expect(base.rings[0].distance).toBeGreaterThan(11)
    expect(near.rings[0]).toEqual(base.rings[0])
    expect(far.rings[0].distance).toBeLessThan(base.rings[0].distance)
  })
  it('changes build geometry in stages and restrains actual wall occupancy for vocals',()=>{
    const gathering=createIfritVisualFrame(phase,controls,{build:.25},'infernalPassage')
    const winding=createIfritVisualFrame(phase,controls,{build:.65},'infernalPassage')
    const braced=createIfritVisualFrame(phase,controls,{build:1},'infernalPassage')
    expect(gathering.rings).not.toEqual(winding.rings)
    expect(winding.rings).not.toEqual(braced.rings)
    expect(createIfritVisualFrame(phase,controls,{vocal:1},'infernalPassage').wallDensity).toBeLessThan(controls.detail)
  })
  it('renders intermediate pattern poses and finishes at the new native pose',()=>{
    const before=createIfritVisualFrame(phase,controls,{},'counterfire','infernalPassage',0)
    const during=createIfritVisualFrame(phase,controls,{},'counterfire','infernalPassage',.5)
    const after=createIfritVisualFrame(phase,controls,{},'counterfire','infernalPassage',1)
    expect(before.rings).toEqual(createIfritVisualFrame(phase,controls,{},'infernalPassage').rings)
    expect(during.rings).not.toEqual(before.rings)
    expect(during.rings).not.toEqual(after.rings)
    expect(after.rings[0].distance).toBeCloseTo(createIfritVisualFrame(phase,controls,{},'counterfire').rings[0].distance)
  })
  it('keeps build chapters reachable at reduced reactivity while zero disables geometry modulation',()=>{
    const base=createIfritVisualFrame(phase,controls,{},'infernalPassage')
    const muted=createIfritVisualFrame(phase,controls,{buildPhase:1,build:0},'infernalPassage')
    const brace=createIfritVisualFrame(phase,controls,{buildPhase:1,build:.3},'infernalPassage')
    expect(muted.rings).toEqual(base.rings)
    expect(brace.rings[0].radius).toBeLessThan(base.rings[0].radius)
  })
  it('uses Director impact to shape an authorized gesture without moving its musical position',()=>{
    const restrained=createIfritVisualFrame(phase,controls,{kickNear:1,directorImpact:0},'infernalPassage')
    const significant=createIfritVisualFrame(phase,controls,{kickNear:1,directorImpact:1},'infernalPassage')
    expect(significant.rings[0].distance).toBeLessThan(restrained.rings[0].distance)
    expect(significant.wallTravel).toBe(restrained.wallTravel)
  })
})
describe('Ifrit canonical position reconstruction',()=>{
  const settings={travel:.6,rotation:.15,sync:true}
  it('reconstructs the same pose after playback, seek, loop and re-entry',()=>{
    const timeline=new IfritTimeline()
    let playing
    for(let t=0;t<=10;t+=.25) playing=timeline.update(frame(t),t,settings,t===0)
    const sought=timeline.update(frame(10),10,settings,true)
    const reentry=new IfritTimeline().update(frame(10),10,settings,true)
    expect(sought).toEqual(playing)
    expect(reentry).toEqual(playing)
    timeline.update(frame(12),12,settings,false)
    expect(timeline.update(frame(10),10,settings,true)).toEqual(playing)
  })
  it('holds a paused position and preserves phase on manual speed/sync edits',()=>{
    const timeline=new IfritTimeline()
    const initial=timeline.update(frame(3,70),3,settings,true)
    expect(timeline.update(frame(3,70),3,settings,false)).toEqual(initial)
    const edited=timeline.update(frame(3,70),3,{...settings,travel:0,sync:false},false)
    expect(edited).toEqual(initial)
    expect(timeline.update(frame(4,70),4,{...settings,travel:0,sync:false},false).travel).toBe(initial.travel)
  })
  it('uses shared beat position instead of host Sync or an energy-integrated speed',()=>{
    const a=new IfritTimeline().update(frame(2,70),2,settings,true)
    const b=new IfritTimeline().update(frame(2,70),2,{...settings,sync:false},true)
    expect(a.travel).toBeLessThan(b.travel)
    expect(a.travel).toBeCloseTo((2*70/60)*.6*2.3)
  })
})
