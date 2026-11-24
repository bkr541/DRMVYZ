import { describe,expect,it,vi } from 'vitest'
import { buildHoneyLayout } from '../modules/honey/Cinema2HoneyLayout'
import { HONEY_LIGHT_DEFAULTS,HONEY_SPILL_RADIUS,honeyLightInstances,honeySpillFalloff } from '../modules/honey/Cinema2HoneyLighting'
import { HONEY_PALETTE } from '../modules/honey/Cinema2HoneyDomain'
import { HONEY_FRAGMENT } from '../modules/honey/Cinema2HoneyShaders'
import { Cinema2HoneyRenderer } from '../modules/honey/Cinema2HoneyRenderer'
import { CINEMA2_HONEY_PRESET_MANIFEST as manifest,honeyParameterId } from '../presets/Cinema2HoneyPreset'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'

const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
describe('HONEY bounded local illumination and engine shadows',()=>{
  it('packs exactly self and six known neighbors, zeroing missing emitters and isolating remote cells',()=>{
    const cells=buildHoneyLayout(),byId=new Map(cells.map(c=>[c.id,c])),packed=honeyLightInstances(cells)
    expect(packed.length).toBe(cells.length*28)
    cells.forEach((cell,i)=>[cell.id,...cell.neighbors].forEach((id,j)=>{
      const source=byId.get(id),expected=source?[...source.channels,source.elevation]:[0,0,0,0]
      expect(Array.from(packed.slice(i*28+j*4,i*28+j*4+4))).toEqual(expected.map(Math.fround))
    }))
    const allOff=cells.map(c=>({...c,channels:[0,0,0] as const})),onlyOne=allOff.map(c=>c.id==='0:0'?{...c,channels:[1,0,0] as const}:c),isolated=honeyLightInstances(onlyOne)
    cells.forEach((c,i)=>expect(Array.from({length:7},(_,j)=>isolated[i*28+j*4]).some(v=>v!>0)).toBe(c.id==='0:0'||c.neighbors.includes('0:0')))
  })
  it('uses compact decay, normal-facing and bounded occlusion rather than screen-space glow',()=>{
    expect(honeySpillFalloff(0)).toBe(1);expect(honeySpillFalloff(HONEY_SPILL_RADIUS*.5)).toBeCloseTo(.25)
    expect(honeySpillFalloff(HONEY_SPILL_RADIUS)).toBe(0);expect(honeySpillFalloff(20)).toBe(0)
    expect(HONEY_FRAGMENT).toContain('if(u_spill<=0.0)return vec3(0.0)')
    expect(HONEY_FRAGMENT).toContain('dot(N,delta/max(d,.025))')
    expect(HONEY_FRAGMENT).toContain('crossOcclusion')
    expect(HONEY_FRAGMENT).toContain('min(sum*u_spill,vec3(')
    expect(HONEY_FRAGMENT).toContain('1.006,.413') // stationary sleeve source, independent of cap elevation
  })
  it('uses the shared directional shadow path and samples its map only when provided',()=>{
    const gl=Object.assign(createCinemaMockWebGL(),{uniform3fv:vi.fn()}),renderer=new Cinema2HoneyRenderer(gl,buildHoneyLayout())
    const key=manifest.lighting!.lights.find(l=>l.type==='directional')!,ambient=manifest.lighting!.lights.find(l=>l.type==='ambient')!
    expect(key.config?.castShadow).toBe(true);expect(ambient.controls?.intensity?.$ref).toBe(honeyParameterId('ambient'))
    renderer.drawShadow(matrix);expect(gl.drawArraysInstanced).toHaveBeenCalledTimes(1)
    const texture={} as WebGLTexture
    renderer.draw(matrix,HONEY_PALETTE,{controls:{...HONEY_LIGHT_DEFAULTS,lightSpill:0},eye:[0,0,13],shadow:{lightId:key.id,texture,viewProjection:new Float32Array(matrix),resolution:1024,depthRange:45,bias:.012,softness:1,texelWorldSize:.025}})
    expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_2D,texture)
    expect(gl.uniform3f).toHaveBeenCalledWith(expect.anything(),1,.012/45,1/1024)
    renderer.draw(matrix,HONEY_PALETTE);expect(gl.uniform3f).toHaveBeenCalledWith(expect.anything(),0,0,0)
    expect(gl.drawArraysInstanced).toHaveBeenCalledTimes(3);renderer.dispose()
  })
})
