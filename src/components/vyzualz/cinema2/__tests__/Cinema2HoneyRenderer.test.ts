import { describe,expect,it,vi } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import { Cinema2HoneyRenderer } from '../modules/honey/Cinema2HoneyRenderer'
import { Cinema2HoneyParticles,HONEY_PARTICLE_COLOR } from '../modules/honey/Cinema2HoneyParticles'
import { HONEY_VERTEX,HONEY_SHADOW_VERTEX } from '../modules/honey/Cinema2HoneyShaders'
import { HONEY_PALETTE } from '../modules/honey/Cinema2HoneyDomain'
import { staticHoneyCell } from '../modules/honey/Cinema2HoneyMotion'
import { buildHoneyLayout } from '../modules/honey/Cinema2HoneyLayout'
const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
describe('HONEY ember resource lifetime and depth draw contract',()=>{
  it('draws the same telescoping geometry and uploaded forward pose in world and shadow without extra draw calls',()=>{
    const gl=Object.assign(createCinemaMockWebGL(),{uniform3fv:vi.fn()}),cells=buildHoneyLayout(),renderer=new Cinema2HoneyRenderer(gl,cells)
    const visual=cells.map(staticHoneyCell);visual[0]!.pose.elevation=2.8;visual[0]!.elevation=2.8
    renderer.updateCells(visual)
    const uploads=vi.mocked(gl.bufferSubData).mock.calls
    const instance=uploads[uploads.length-1]![2] as Float32Array
    expect(instance[2]).toBeCloseTo(2.8)
    const common='honeyPosition(a_position,a_part.y,i_cell,i_angles,i_offset)'
    expect(HONEY_VERTEX).toContain(common);expect(HONEY_SHADOW_VERTEX).toContain(common)
    renderer.drawShadow(matrix);renderer.draw(matrix,HONEY_PALETTE)
    expect(gl.drawArraysInstanced).toHaveBeenCalledTimes(2)
    expect(gl.drawArraysInstanced).toHaveBeenNthCalledWith(1,gl.TRIANGLES,0,renderer.inspectDraw().triangles*3/cells.length,cells.length)
    expect(gl.drawArraysInstanced).toHaveBeenNthCalledWith(2,gl.TRIANGLES,0,renderer.inspectDraw().triangles*3/cells.length,cells.length)
    renderer.dispose()
  })
  it('leases one lazy GPU pool, uses depth test without depth writes and releases every object',()=>{
    const gl=Object.assign(createCinemaMockWebGL(),{uniform3fv:vi.fn(),blendEquation:vi.fn(),POINTS:0,FUNC_ADD:0x8006}),cells=buildHoneyLayout(),renderer=new Cinema2HoneyRenderer(gl,cells),pool=new Cinema2HoneyParticles(cells)
    const before=renderer.estimateGpuBytes(),buffers=gl.__calls.createdBuffers
    renderer.drawParticles(matrix,1080,HONEY_PARTICLE_COLOR,pool,'high');expect(renderer.estimateGpuBytes()-before).toBe(8000);expect(gl.__calls.createdBuffers).toBe(buffers+1)
    expect(gl.enable).toHaveBeenCalledWith(gl.DEPTH_TEST);expect(gl.depthMask).toHaveBeenCalledWith(false);expect(gl.depthMask).toHaveBeenLastCalledWith(true)
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.POINTS,0,renderer.inspectDraw().particleCount)
    renderer.drawParticles(matrix,540,[0,1,0,1],pool,'low');expect(gl.uniform4f).toHaveBeenLastCalledWith(expect.anything(),0,1,0,1);expect(gl.__calls.createdBuffers).toBe(buffers+1)
    pool.update({active:false,reset:false,enabled:false,amount:1,reactivity:1,high:1,air:1,flux:1,drop:1,deltaSeconds:0});renderer.drawParticles(matrix,540,HONEY_PARTICLE_COLOR,pool,'high');expect(renderer.inspectDraw().particleCount).toBe(0);expect(gl.drawArrays).toHaveBeenCalledTimes(2)
    renderer.dispose();renderer.dispose();expect(renderer.estimateGpuBytes()).toBe(0);expect(gl.__calls.deletedBuffers).toBe(gl.__calls.createdBuffers);expect(gl.__calls.deletedVertexArrays).toBe(gl.__calls.createdVertexArrays);expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms);expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
  })
})
