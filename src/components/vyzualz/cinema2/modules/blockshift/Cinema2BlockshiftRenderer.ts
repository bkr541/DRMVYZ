import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { CINEMA2_BLOCKSHIFT_BLOCK_COUNT } from './Cinema2BlockshiftDomain'
import { CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS } from './Cinema2BlockshiftLayout'
import type { Cinema2BlockshiftModel } from './Cinema2BlockshiftModels'
import { CINEMA2_BLOCKSHIFT_LED_FLOATS } from './Cinema2BlockshiftLeds'

const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 i_centerSize;
layout(location=3) in vec4 i_edge;
layout(location=4) in vec4 i_rotation;
layout(location=5) in vec3 a_led;
uniform mat4 u_viewProjection;
out vec3 v_normal;
flat out vec3 v_edge;
flat out float v_emission;
out vec2 v_led;
flat out int v_circuit;
vec3 rotate(vec3 point) {
  vec3 s = sin(i_rotation.xyz), c = cos(i_rotation.xyz);
  point.yz = mat2(c.x, s.x, -s.x, c.x) * point.yz;
  point.xz = mat2(c.y, -s.y, s.y, c.y) * point.xz;
  point.xy = mat2(c.z, s.z, -s.z, c.z) * point.xy;
  return point;
}
void main() {
  gl_Position = u_viewProjection * vec4(i_centerSize.xyz + rotate(a_position) * i_centerSize.w, 1.0);
  v_normal = rotate(a_normal);
  v_edge = i_edge.rgb;
  v_emission = i_edge.a;
  v_led = a_led.xy;
  v_circuit = int(i_rotation.w + 0.5) * 12 + int(a_led.z + 0.5);
}`
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_normal;
flat in vec3 v_edge;
flat in float v_emission;
in vec2 v_led;
flat in int v_circuit;
uniform vec3 u_body;
uniform float u_edges;
uniform float u_intensity;
uniform vec4 u_led[180];
out vec4 outColor;
void main() {
  float key = max(dot(normalize(v_normal), normalize(vec3(-0.42,0.68,0.58))), 0.0);
  vec3 matte = u_body * (0.52 + 1.15 * key) * u_intensity;
  if (u_edges < 0.5) { outColor = vec4(matte, 1.0); return; }
  vec4 led = u_led[clamp(v_circuit, 0, 179)];
  // Actual model faces form a dark housing around a segmented, self-lit diffuser.
  float diffuser = smoothstep(0.10, 0.22, v_led.y) * (1.0 - smoothstep(0.78, 0.90, v_led.y));
  float core = smoothstep(0.28, 0.42, v_led.y) * (1.0 - smoothstep(0.58, 0.72, v_led.y));
  float pixel = abs(fract(v_led.x * 24.0) - 0.5);
  float aa = max(fwidth(v_led.x) * 24.0, 0.015);
  float cells = 1.0 - smoothstep(0.40 - aa, 0.48 + aa, pixel);
  float chase = 1.0 - smoothstep(led.z - 0.025, led.z + 0.025, fract(v_led.x - led.y + 1.0));
  // Fully occupied bars have no moving seam; Audio Reactivity zero is a steady LED fixture.
  chase = mix(chase, 1.0, step(0.999, led.z));
  float power = led.x * (0.13 + 0.87 * chase) * v_emission;
  vec3 housing = mix(u_body * 0.38, v_edge * 0.035, 0.45) * (0.5 + 0.5 * key);
  float colorPeak = max(v_edge.r, max(v_edge.g, v_edge.b));
  vec3 light = v_edge * (0.9 + 4.6 * power) + vec3(core * (0.22 + 0.45 * led.w) * power * colorPeak);
  outColor = vec4(mix(housing, light, diffuser * cells) * u_intensity, 1.0);
}`

interface Batch { vao: WebGLVertexArrayObject; count: number; instances: number; edges: number }
export class Cinema2BlockshiftRenderer {
  private program: ShaderProgram | null = null
  private readonly buffers: WebGLBuffer[] = []
  private readonly batches: Batch[] = []
  private gpuBytes = 0
  private disposed = false
  private readonly instanceBuffers: WebGLBuffer[] = []
  private readonly instanceData = [new Float32Array((CINEMA2_BLOCKSHIFT_BLOCK_COUNT - 1) * CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS), new Float32Array(CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS)]
  private readonly matrix = new Float32Array(16)
  private readonly idleLeds = Float32Array.from({ length: CINEMA2_BLOCKSHIFT_LED_FLOATS }, (_, i) => i % 4 === 0 ? 0.36 : i % 4 === 2 ? 1 : 0)

  constructor(private readonly gl: WebGL2RenderingContext, packed: Float32Array, models: readonly Cinema2BlockshiftModel[]) {
    if (packed.length !== CINEMA2_BLOCKSHIFT_BLOCK_COUNT * CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS || !packed.every(Number.isFinite)) throw new Error('BLOCKSHIFT requires fifteen finite instance records.')
    if (models.length !== 2) throw new Error('BLOCKSHIFT requires both supplied models.')
    try {
      const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
        label: 'Cinema2/Blockshift', vertSrc: VERTEX, fragSrc: FRAGMENT,
        requiredUniforms: ['u_viewProjection', 'u_body', 'u_edges', 'u_intensity', 'u_led[0]'],
      })
      if (!result.program) throw new Error(`BLOCKSHIFT shader ${result.error.stage}: ${result.error.log}`)
      this.program = result.program
      this.splitInstances(packed)
      models.forEach((model, modelIndex) => {
        const instances = this.buffer(gl.ARRAY_BUFFER, this.instanceData[modelIndex]!, gl.DYNAMIC_DRAW)
        this.instanceBuffers.push(instances)
        for (const [edges, mesh] of [[0, model.body], [1, model.frame]] as const) {
          const vao = gl.createVertexArray()
          if (!vao) throw new Error('BLOCKSHIFT could not allocate a vertex array.')
          this.batches.push({ vao, count: mesh.indices.length, instances: modelIndex === 0 ? CINEMA2_BLOCKSHIFT_BLOCK_COUNT - 1 : 1, edges })
          gl.bindVertexArray(vao)
          this.buffer(gl.ARRAY_BUFFER, mesh.vertices)
          for (let attribute = 0; attribute < 2; attribute++) {
            gl.enableVertexAttribArray(attribute)
            gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 24, attribute * 12)
          }
          this.buffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices)
          if (edges) {
            if (!mesh.ledCoordinates || mesh.ledCoordinates.length !== mesh.vertices.length / 2) throw new Error('BLOCKSHIFT frame requires physical LED bar coordinates.')
            this.buffer(gl.ARRAY_BUFFER, mesh.ledCoordinates)
            gl.enableVertexAttribArray(5)
            gl.vertexAttribPointer(5, 3, gl.FLOAT, false, 12, 0)
          }
          gl.bindBuffer(gl.ARRAY_BUFFER, instances)
          for (let attribute = 2; attribute < 5; attribute++) {
            gl.enableVertexAttribArray(attribute)
            gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS * 4, (attribute - 2) * 16)
            gl.vertexAttribDivisor(attribute, 1)
          }
        }
      })
      gl.bindVertexArray(null)
      gl.bindBuffer(gl.ARRAY_BUFFER, null)
      assertCinema2NoGlErrors(gl, 'BLOCKSHIFT setup')
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  estimateGpuBytes(): number { return this.gpuBytes }

  updateInstances(packed: Float32Array): void {
    if (this.disposed) return
    if (packed.length !== CINEMA2_BLOCKSHIFT_BLOCK_COUNT * CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS || !packed.every(Number.isFinite)) throw new Error('BLOCKSHIFT requires fifteen finite instance records.')
    this.splitInstances(packed)
    this.instanceBuffers.forEach((buffer, index) => {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.instanceData[index]! as Float32Array<ArrayBuffer>)
    })
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
  }

  private splitInstances(packed: Float32Array): void {
    let outer = 0
    for (let index = 0; index < CINEMA2_BLOCKSHIFT_BLOCK_COUNT; index++) {
      const record = packed.subarray(index * CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS, (index + 1) * CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS)
      if (index === 4) this.instanceData[1]!.set(record)
      else this.instanceData[0]!.set(record, outer++ * CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS)
    }
  }

  draw(viewProjection: readonly number[], body: Cinema2Color, intensity = 1, leds = this.idleLeds): void {
    if (this.disposed || !this.program) return
    if (viewProjection.length !== 16 || !viewProjection.every(Number.isFinite)) throw new Error('BLOCKSHIFT requires a finite final camera matrix.')
    const { gl, program } = this
    this.matrix.set(viewProjection)
    program.activate()
    program.setMat4('u_viewProjection', this.matrix)
    program.setVec3('u_body', body[0], body[1], body[2])
    program.setFloat('u_intensity', intensity)
    if (leds.length !== CINEMA2_BLOCKSHIFT_LED_FLOATS || !leds.every(Number.isFinite)) throw new Error('BLOCKSHIFT requires finite LED circuit records.')
    gl.uniform4fv(program.getUniform('u_led[0]'), leds as Float32Array<ArrayBuffer>)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    // Both supplied assets author double-sided materials.
    gl.disable(gl.CULL_FACE)
    gl.colorMask(true, true, true, true)
    this.batches.forEach(batch => {
      program.setFloat('u_edges', batch.edges)
      gl.bindVertexArray(batch.vao)
      gl.drawElementsInstanced(gl.TRIANGLES, batch.count, gl.UNSIGNED_SHORT, 0, batch.instances)
    })
    gl.bindVertexArray(null)
    gl.disable(gl.CULL_FACE)
    assertCinema2NoGlErrors(gl, 'BLOCKSHIFT draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.gl.bindVertexArray(null)
    for (const batch of this.batches) this.gl.deleteVertexArray(batch.vao)
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer)
    this.program?.dispose()
  }

  private buffer(target: number, data: Float32Array | Uint16Array, usage: number = this.gl.STATIC_DRAW): WebGLBuffer {
    const buffer = this.gl.createBuffer()
    if (!buffer) throw new Error('BLOCKSHIFT could not allocate a buffer.')
    this.buffers.push(buffer)
    this.gl.bindBuffer(target, buffer)
    this.gl.bufferData(target, data as ArrayBufferView<ArrayBuffer>, usage)
    this.gpuBytes += data.byteLength
    return buffer
  }
}
