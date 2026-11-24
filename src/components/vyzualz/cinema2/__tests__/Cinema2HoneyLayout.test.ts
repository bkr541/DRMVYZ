import { describe, expect, it } from 'vitest'
import { HONEY_MAX_ELEVATION, HONEY_MAX_ROTATION, HONEY_MAX_SEPARATION, HONEY_MAX_TILT, HONEY_MIN_ELEVATION, HONEY_PITCH } from '../modules/honey/Cinema2HoneyDomain'
import { buildHoneyLayout, constrainHoneyPose, isHoneyPoseSafe } from '../modules/honey/Cinema2HoneyLayout'

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
    for(const elevation of [HONEY_MIN_ELEVATION,.32,.42,.49,.65,.75,.98,HONEY_MAX_ELEVATION])for(const rotation of [-1,0,1])for(const tiltX of [-1,0,1])for(const tiltY of [-1,0,1])for(const x of [-1,0,1])for(const y of [-1,0,1]){
      const pose=constrainHoneyPose({elevation,rotation:rotation*HONEY_MAX_ROTATION,tiltX:tiltX*HONEY_MAX_TILT,tiltY:tiltY*HONEY_MAX_TILT,x:x*HONEY_MAX_SEPARATION,y:y*HONEY_MAX_SEPARATION})
      expect(isHoneyPoseSafe(pose)).toBe(true)
    }
    expect(isHoneyPoseSafe({elevation:.12,rotation:HONEY_MAX_ROTATION,tiltX:HONEY_MAX_TILT,tiltY:HONEY_MAX_TILT,x:0,y:0})).toBe(false)
    expect(constrainHoneyPose({elevation:1,rotation:0,tiltX:0,tiltY:0,x:.01,y:0}).x).toBe(.01)
  })
})
