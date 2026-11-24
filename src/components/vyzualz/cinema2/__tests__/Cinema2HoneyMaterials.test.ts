import { describe,expect,it } from 'vitest'
import { HONEY_FINISHES } from '../modules/honey/Cinema2HoneyDomain'
import { buildHoneyLayout,honeySeed,constrainHoneyPose } from '../modules/honey/Cinema2HoneyLayout'
import { HONEY_MATERIALS,honeyFinish } from '../modules/honey/Cinema2HoneyMaterials'
import { HONEY_VERTEX,HONEY_FRAGMENT } from '../modules/honey/Cinema2HoneyShaders'
import { CINEMA2_HONEY_PRESET_MANIFEST as manifest } from '../presets/Cinema2HoneyPreset'

describe('HONEY fixed industrial finishes',()=>{
  it('retains a coherent seeded composition with all four finishes in the default close crop',()=>{
    const cells=buildHoneyLayout(),expected=[.55,.20,.15,.10]
    expect(buildHoneyLayout()).toEqual(cells)
    HONEY_FINISHES.forEach((finish,i)=>expect(Math.abs(cells.filter(c=>c.finish===finish).length/cells.length-expected[i]!)).toBeLessThan(.035))
    expect(new Set(cells.filter(c=>Math.abs(c.x)<3&&Math.abs(c.y)<4.5).map(c=>c.finish)).size).toBe(4)
    expect(new Set(HONEY_MATERIALS.map(m=>`${m.metalness}:${m.roughness}:${m.anisotropy}`)).size).toBe(4)
    expect(manifest.parameters?.some(p=>/material|texture|distribution|randomize/i.test(p.label))).toBe(false)
  })
  it('keeps finish and local grain identity independent of pose, uses no sampled texture assets',()=>{
    const cells=buildHoneyLayout()
    for(const c of cells){
      const pose=constrainHoneyPose({elevation:1,rotation:.1,tiltX:.1,tiltY:-.1,x:.015,y:0})
      const posed={...c,...pose};expect(honeyFinish(posed.q,posed.r)).toBe(c.finish)
      expect(honeySeed(posed.q,posed.r,79)).toBe(honeySeed(c.q,c.r,79))
    }
    expect(HONEY_VERTEX).toContain('v_local=a_position')
    expect(HONEY_FRAGMENT).toContain('grain(v_local.xy,v_finish.y,finish)')
    expect(HONEY_FRAGMENT).toContain('fwidth(x)')
    // P03 introduced a runtime pose data texture, not a material asset. Guard all other 2D samplers.
    expect([...HONEY_FRAGMENT.matchAll(/sampler2D\s+(u_\w+)/g)].map(m=>m[1])).toEqual(['u_poses'])
    expect(HONEY_FRAGMENT).toContain('texelFetch(u_poses')
    expect(HONEY_FRAGMENT).not.toMatch(/texture\s*\(\s*u_poses/)
  })
})
