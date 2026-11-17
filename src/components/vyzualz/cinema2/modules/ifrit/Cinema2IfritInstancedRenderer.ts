import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { IFRIT_MAX_BLADES, IFRIT_MAX_FRAGMENTS, IFRIT_MAX_SATELLITES, IFRIT_RING_SLOTS, IFRIT_SECTORS } from './Cinema2IfritDomain'
import { IFRIT_INSTANCE_BYTES, IFRIT_INSTANCE_FLOATS, packIfritComponents, packIfritShards } from './Cinema2IfritInstancePacking'
import {
  IFRIT_MESH_STRIDE_FLOATS, buildIfritBladeMesh, buildIfritGearMesh, buildIfritSatelliteMesh, buildIfritSpokeMesh, type IfritMesh,
} from './Cinema2IfritMechanicsGeometry'
import { buildIfritShardMesh } from './Cinema2IfritShatterGeometry'
import type { IfritComponentPose } from './Cinema2IfritMechanics'
import type { IfritShardPose } from './Cinema2IfritShatter'

const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in float a_role;
layout(location=3) in vec4 i_row0;
layout(location=4) in vec4 i_row1;
layout(location=5) in vec4 i_row2;
layout(location=6) in vec4 i_extra;
uniform mat4 u_viewProjection;
uniform float u_shard;
out vec3 v_normal;
out vec3 v_world;
flat out float v_role;
flat out float v_light;
void main() {
  vec3 p=a_position;
  float role=a_role;
  if(u_shard>.5) {
    // Whole sections tile exactly: each end is slanted by the cut it shares with its neighbour.
    p.x+=(p.x<0.0?i_extra.x:i_extra.y)*p.y;
    if(role>4.5&&i_extra.z<.5) role=-1.0;
  }
  vec4 q=vec4(p,1.0);
  vec3 world=vec3(dot(i_row0,q),dot(i_row1,q),dot(i_row2,q));
  v_normal=vec3(dot(i_row0.xyz,a_normal),dot(i_row1.xyz,a_normal),dot(i_row2.xyz,a_normal));
  v_world=world;v_role=role;v_light=i_extra.w;
  gl_Position=role<-.5?vec4(2.0,2.0,2.0,1.0):u_viewProjection*vec4(world,1.0);
}`
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_world;
flat in float v_role;
flat in float v_light;
uniform vec3 u_portal,u_wall,u_corner;
uniform float u_intensity;
out vec4 outColor;
void main() {
  if(u_intensity<=0.0) discard;
  float light=.4+.6*max(dot(normalize(v_normal),normalize(vec3(-.4,.6,.8))),0.0);
  vec3 color;
  // The same material roles as the tunnel: dark red body, orange emission, corner highlight.
  if(v_role<.5) color=u_wall*.09*light;
  else if(v_role<1.5) color=u_portal*1.35*(.94+.06*light);
  else color=u_corner*1.65;
  float distanceFade=mix(1.0,.68,smoothstep(4.0,14.0,-v_world.z));
  outColor=vec4(color*v_light*distanceFade*u_intensity,1.0);
}`

type Kind = 'spoke' | 'gear' | 'blade' | 'satellite' | 'shard'
interface MeshSet { readonly kind: Kind; readonly vao: WebGLVertexArrayObject; readonly buffers: readonly WebGLBuffer[]; readonly indexCount: number; readonly instances: Float32Array; readonly instanceBuffer: WebGLBuffer; readonly bytes: number }

const CAPACITY: Readonly<Record<Kind, number>> = Object.freeze({
  spoke: IFRIT_RING_SLOTS * IFRIT_SECTORS,
  gear: IFRIT_RING_SLOTS * IFRIT_SECTORS,
  blade: IFRIT_RING_SLOTS * IFRIT_SECTORS * IFRIT_MAX_BLADES,
  satellite: IFRIT_RING_SLOTS * IFRIT_SECTORS * IFRIT_MAX_SATELLITES,
  shard: IFRIT_RING_SLOTS * IFRIT_SECTORS * IFRIT_MAX_FRAGMENTS,
})
const MESHES: readonly (readonly [Kind, () => IfritMesh])[] = [
  ['spoke', buildIfritSpokeMesh], ['gear', buildIfritGearMesh], ['blade', buildIfritBladeMesh], ['satellite', buildIfritSatelliteMesh], ['shard', buildIfritShardMesh],
]
export interface IfritInstancedDrawStats { readonly draws: number; readonly instances: Readonly<Record<Kind, number>> }

/**
 * The instanced half of Ifrit: one static mesh per kind of part, one preallocated per-instance buffer each, uploaded with bufferSubData (only the
 * live instances), and one drawElementsInstanced per kind that has any. Nothing is allocated per frame.
 */
export class Cinema2IfritInstancedRenderer {
  private readonly program: ShaderProgram
  private readonly sets: readonly MeshSet[]
  readonly gpuBytes: number
  lastStats: IfritInstancedDrawStats = { draws: 0, instances: { spoke: 0, gear: 0, blade: 0, satellite: 0, shard: 0 } }
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Ifrit/Instanced', vertSrc: VERTEX, fragSrc: FRAGMENT, requiredUniforms: ['u_viewProjection'],
    })
    if (!result.program) throw new Error(`Ifrit instanced shader failed: ${result.error.log}`)
    this.program = result.program
    const built: MeshSet[] = []
    try {
      for (const [kind, make] of MESHES) built.push(this.createSet(kind, make()))
    } catch (error) {
      for (const set of built) this.release(set)
      this.program.dispose()
      throw error
    }
    this.sets = built
    this.gpuBytes = built.reduce((sum, set) => sum + set.bytes, 0)
  }

  private createSet(kind: Kind, mesh: IfritMesh): MeshSet {
    const { gl } = this
    const vao = gl.createVertexArray(), vertex = gl.createBuffer(), index = gl.createBuffer(), instance = gl.createBuffer()
    if (!vao || !vertex || !index || !instance) {
      if (vao) gl.deleteVertexArray(vao); if (vertex) gl.deleteBuffer(vertex); if (index) gl.deleteBuffer(index); if (instance) gl.deleteBuffer(instance)
      throw new Error('Ifrit instanced geometry allocation failed.')
    }
    const instances = new Float32Array(CAPACITY[kind] * IFRIT_INSTANCE_FLOATS)
    const stride = IFRIT_MESH_STRIDE_FLOATS * 4
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 24)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, instance)
    gl.bufferData(gl.ARRAY_BUFFER, instances.byteLength, gl.DYNAMIC_DRAW)
    for (let row = 0; row < 4; row++) {
      gl.enableVertexAttribArray(3 + row)
      gl.vertexAttribPointer(3 + row, 4, gl.FLOAT, false, IFRIT_INSTANCE_BYTES, row * 16)
      gl.vertexAttribDivisor(3 + row, 1)
    }
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null)
    return { kind, vao, buffers: [vertex, index, instance], indexCount: mesh.indices.length, instances, instanceBuffer: instance, bytes: mesh.vertices.byteLength + mesh.indices.byteLength + instances.byteLength }
  }

  private release(set: MeshSet): void {
    this.gl.deleteVertexArray(set.vao)
    for (const buffer of set.buffers) this.gl.deleteBuffer(buffer)
  }

  /** Uploads the live poses and draws each non-empty kind. The tunnel pass's depth state is kept: opaque, depth-tested, depth-written. */
  draw(
    viewProjection: Float32Array, colors: Readonly<{ portal: readonly number[]; wall: readonly number[]; corner: readonly number[] }>, intensity: number,
    mechanics: readonly IfritComponentPose[], shards: readonly IfritShardPose[],
  ): IfritInstancedDrawStats {
    const counts: Record<Kind, number> = { spoke: 0, gear: 0, blade: 0, satellite: 0, shard: 0 }
    if (this.disposed || (mechanics.length === 0 && shards.length === 0)) return (this.lastStats = { draws: 0, instances: counts })
    const { gl } = this
    this.program.activate()
    this.program.setMat4('u_viewProjection', viewProjection)
    this.program.setVec3('u_portal', colors.portal[0]!, colors.portal[1]!, colors.portal[2]!)
    this.program.setVec3('u_wall', colors.wall[0]!, colors.wall[1]!, colors.wall[2]!)
    this.program.setVec3('u_corner', colors.corner[0]!, colors.corner[1]!, colors.corner[2]!)
    this.program.setFloat('u_intensity', intensity)
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true)
    gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE)
    let draws = 0
    for (const set of this.sets) {
      const count = set.kind === 'shard' ? packIfritShards(shards, set.instances) : packIfritComponents(mechanics, set.kind, set.instances)
      counts[set.kind] = count
      if (count === 0) continue
      this.program.setFloat('u_shard', set.kind === 'shard' ? 1 : 0)
      gl.bindVertexArray(set.vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, set.instanceBuffer)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, set.instances, 0, count * IFRIT_INSTANCE_FLOATS)
      gl.drawElementsInstanced(gl.TRIANGLES, set.indexCount, gl.UNSIGNED_SHORT, 0, count)
      draws++
    }
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null)
    return (this.lastStats = { draws, instances: counts })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const set of this.sets) this.release(set)
    this.program.dispose()
  }
}
