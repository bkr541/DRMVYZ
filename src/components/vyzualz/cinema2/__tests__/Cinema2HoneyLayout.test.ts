import { describe, expect, it } from 'vitest'
import { HONEY_MAX_ELEVATION, HONEY_MAX_ROTATION, HONEY_MAX_SEPARATION, HONEY_MAX_TILT, HONEY_MIN_ELEVATION, HONEY_PITCH,HONEY_FLOAT_START,HONEY_FLOAT_FULL,HONEY_SLEEVE_LIP,HONEY_CAP_THICKNESS,HONEY_CAMERA,honeyStemTop } from '../modules/honey/Cinema2HoneyDomain'
import { buildHoneyLayout, constrainHoneyPose, isHoneyPoseSafe,honeyPoseCorners } from '../modules/honey/Cinema2HoneyLayout'

import { advanceHoneyCell,createHoneyCellState,HONEY_MOTION_DEFAULTS,honeyAudioPose,staticHoneyCell,targetHoneyCell } from '../modules/honey/Cinema2HoneyMotion'

const crest={activation:1,elevation:1,rotation:1,tiltX:1,tiltY:-1,separation:1,outer:1,inner:0,under:1}

describe('HONEY axial wall',()=>{
  it('has stable identities, reciprocal neighbors, four seeded finishes and safe static depth',()=>{
    const cells=buildHoneyLayout(),byId=new Map(cells.map(cell=>[cell.id,cell]))
    expect(cells).toEqual(buildHoneyLayout());expect(cells).toHaveLength(625);expect(byId.size).toBe(625)
    expect(new Set(cells.map(cell=>cell.finish)).size).toBe(4);expect(new Set(cells.map(cell=>cell.elevation)).size).toBe(5)
    for(const cell of cells){
      expect(cell.neighbors).toHaveLength(6)
      expect(isHoneyPoseSafe({elevation:cell.elevation,rotation:0,tiltX:0,tiltY:0,x:0,y:0})).toBe(true)
      for(const id of cell.neighbors){const n=byId.get(id);if(n){expect(n.neighbors).toContain(cell.id);expect(Math.hypot(n.x-cell.x,n.y-cell.y)).toBeCloseTo(HONEY_PITCH,10)}}
    }
  })
  it('keeps combined requested extremes inside the safe prism and sleeve bounds',()=>{
    for(const elevation of [HONEY_MIN_ELEVATION,.32,.42,.49,.65,.75,.98,1.5,HONEY_FLOAT_START,HONEY_FLOAT_START+.02,HONEY_FLOAT_FULL,HONEY_MAX_ELEVATION])for(const rotation of [-1,0,1])for(const tiltX of [-1,0,1])for(const tiltY of [-1,0,1])for(const x of [-1,0,1])for(const y of [-1,0,1]){
      const pose=constrainHoneyPose({elevation,rotation:rotation*HONEY_MAX_ROTATION,tiltX:tiltX*HONEY_MAX_TILT,tiltY:tiltY*HONEY_MAX_TILT,x:x*HONEY_MAX_SEPARATION,y:y*HONEY_MAX_SEPARATION})
      expect(isHoneyPoseSafe(pose)).toBe(true)
    }
    expect(isHoneyPoseSafe({elevation:.12,rotation:HONEY_MAX_ROTATION,tiltX:HONEY_MAX_TILT,tiltY:HONEY_MAX_TILT,x:0,y:0})).toBe(false)
    expect(constrainHoneyPose({elevation:1,rotation:0,tiltX:0,tiltY:0,x:.01,y:0}).x).toBe(0)
    expect(constrainHoneyPose({elevation:HONEY_FLOAT_FULL,rotation:0,tiltX:0,tiltY:0,x:.01,y:0}).x).toBe(.01)
  })
  it('moves actual prism corners toward camera at default depth, leaves zero depth at home, and returns without sleeve overlap',()=>{
    const cell=buildHoneyLayout().find(c=>c.elevation===.49)!, home=staticHoneyCell(cell), k=HONEY_MOTION_DEFAULTS
    const raised=targetHoneyCell(cell,crest,k), zero=targetHoneyCell(cell,crest,{...k,elevation:0})
    expect(zero.pose).toEqual(home.pose)
    const front=(pose:typeof home.pose)=>Math.max(...honeyPoseCorners(pose).map(p=>p[2]))
    expect(front(raised.pose)-front(home.pose)).toBeGreaterThan(1.8)
    expect(front(raised.pose)).toBeLessThan(HONEY_CAMERA.position[2]-.1)
    expect(Math.min(...honeyPoseCorners(raised.pose).map(p=>p[2]))-honeyStemTop(raised.elevation)).toBeGreaterThan(.5)
    expect(honeyAudioPose(zero,{...k,elevation:0},1,.38,1,.025)).toEqual(zero.pose)
    const state=createHoneyCellState(cell)
    for(const target of [raised,targetHoneyCell(cell,{...crest,elevation:-1},{...k,motion:1}),home]){
      for(let frame=0;frame<240;frame++){
        advanceHoneyCell(state,target,1/60,k)
        expect(isHoneyPoseSafe(state.current.pose)).toBe(true)
        expect(state.current.id).toBe(cell.id)
        const pose=state.current.pose
        if(pose.elevation<=HONEY_FLOAT_START)expect([pose.rotation,pose.tiltX,pose.tiltY,pose.x,pose.y]).toEqual([0,0,0,0,0])
      }
    }
    expect(state.current.pose.elevation).toBeCloseTo(home.pose.elevation,6)
    expect(honeyStemTop(HONEY_SLEEVE_LIP)).toBeCloseTo(HONEY_SLEEVE_LIP-HONEY_CAP_THICKNESS+.018)
  })
})
