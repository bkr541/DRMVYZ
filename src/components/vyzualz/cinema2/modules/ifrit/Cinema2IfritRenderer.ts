import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import type { Cinema2ModuleParameterReadFacet } from '../Cinema2ModuleContracts'
import { IFRIT_COLORS, IFRIT_NUMBERS } from './Cinema2IfritDomain'
import type { IfritVisualFrame } from './Cinema2IfritMotion'
import { IFRIT_PASSAGE_SPAN } from './Cinema2IfritMotion'
import { buildIfritGeometry } from './Cinema2IfritGeometry'

const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_material;
layout(location=3) in vec2 a_identity;
layout(location=4) in vec3 a_spine;
uniform mat4 u_viewProjection;
uniform vec4 u_pose[12];
uniform float u_count,u_aperture,u_thickness,u_spacing,u_wallDensity,u_wallTravel,u_wallRoll,u_span;
out vec3 v_normal;
out vec3 v_world;
flat out vec2 v_material;
flat out float v_visible;
void main() {
  bool portal=a_identity.x>=0.0;
  vec3 p=a_position;
  float angle=u_wallRoll, gain=a_material.y;
  v_visible=portal?step(a_identity.x+.5,u_count):step(a_identity.y,u_wallDensity);
  if(portal) {
    vec4 pose=u_pose[int(clamp(a_identity.x,0.0,11.0))];
    p=a_spine+(a_position-a_spine)*u_thickness;
    p.xy*=pose.z;
    p.z-=pose.x;
    angle=pose.y;
    gain*=pose.w;
    float farEnd=u_span-.8;
    gain*=1.0-smoothstep(farEnd-1.8*u_spacing,farEnd,pose.x);
  } else {
    // Rigid segment recycling uses one midpoint for both endpoints. Walls and
    // portals share the same axial phase, so the environment has real parallax.
    float distance=mod(-a_spine.z+.8-u_wallTravel,u_span)-.8;
    p.z+=-distance-a_spine.z;
    float farEnd=u_span-.8;
    gain*=1.0-smoothstep(farEnd-1.8*u_spacing,farEnd,distance);
  }
  float c=cos(angle),s=sin(angle);
  mat2 rotation=mat2(c,s,-s,c);
  p.xy=rotation*p.xy*u_aperture;
  vec3 normal=a_normal;normal.xy=rotation*normal.xy;
  gl_Position=u_viewProjection*vec4(p,1.0);
  v_world=p;v_normal=normal;v_material=vec2(a_material.x,gain);
}`
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_world;
flat in vec2 v_material;
flat in float v_visible;
uniform vec3 u_portal,u_wall,u_corner;
uniform vec4 u_pose[12];
uniform float u_intensity,u_wallActivity,u_leftAccent,u_rightAccent,u_wallShimmer,u_wallTravel,u_count;
out vec4 outColor;
void main() {
  if(v_visible<.5||u_intensity<=0.0) discard;
  float role=v_material.x,gain=v_material.y;
  float light=.4+.6*max(dot(normalize(v_normal),normalize(vec3(-.4,.6,.8))),0.0);
  vec3 color;
  if(role<.5) color=u_wall*.07*light;
  else if(role<1.5) color=u_portal*1.35*(.94+.06*light);
  else if(role>3.5) color=u_wall*.09*light;
  else if(role<2.5) {
    float bank=v_world.x<0.0?u_leftAccent:u_rightAccent;
    float shimmer=pow(.5+.5*sin(v_world.z*8.0+v_world.y*3.0+u_wallTravel*2.0),6.0)*u_wallShimmer;
    float localLight=0.0;
    for(int i=0;i<12;i++) if(float(i)<u_count) localLight+=exp(-abs(-v_world.z-u_pose[i].x)*1.8)*u_pose[i].w*.12;
    color=u_wall*(.12+.65*pow(light,3.0))*u_wallActivity*(.65+localLight+bank*.8+shimmer);
  } else color=u_corner*1.65;
  float distanceFade=mix(1.0,.68,smoothstep(4.0,14.0,-v_world.z));
  outColor=vec4(color*gain*distanceFade*u_intensity,1.0);
}`

/** Fixed GPU geometry; resolved controls and shared musical channels supply all variation. */
export class Cinema2IfritRenderer {
  private readonly program: ShaderProgram
  private readonly buffer: WebGLBuffer
  private readonly vao: WebGLVertexArrayObject
  private readonly vertexCount: number
  readonly gpuBytes: number
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Ifrit/Tunnel', vertSrc: VERTEX, fragSrc: FRAGMENT, requiredUniforms: ['u_viewProjection'],
    })
    if (!result.program) throw new Error(`Ifrit shader failed: ${result.error.log}`)
    this.program = result.program
    const buffer = gl.createBuffer(), vao = gl.createVertexArray()
    if (!buffer || !vao) {
      if (buffer) gl.deleteBuffer(buffer)
      if (vao) gl.deleteVertexArray(vao)
      this.program.dispose()
      throw new Error('Ifrit geometry allocation failed.')
    }
    this.buffer = buffer; this.vao = vao
    const geometry = buildIfritGeometry()
    this.vertexCount = geometry.length / 13
    this.gpuBytes = geometry.byteLength
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW)
    for (const [location, size, offset] of [[0, 3, 0], [1, 3, 12], [2, 2, 24], [3, 2, 32], [4, 3, 40]]) {
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 52, offset)
    }
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null)
  }

  draw(exec: Cinema2ModuleRenderExecutionContext, parameters: Cinema2ModuleParameterReadFacet, state: IfritVisualFrame) {
    if (this.disposed) return
    if (!exec.camera || !exec.depthAvailable) throw new Error('Ifrit requires a world camera and depth attachment.')
    const gl = this.gl
    this.program.activate()
    this.program.setMat4('u_viewProjection', new Float32Array(exec.camera.viewProjectionMatrix))
    const number=(key: string, fallback: number) => { const v=parameters.get(key); return typeof v==='number' && Number.isFinite(v) ? v : fallback }
    for(const [key, range] of Object.entries(IFRIT_NUMBERS)) this.program.setFloat(`u_${key}`,number(key,range[1]))
    for(let i=0;i<12;i++) {
      const pose=state.rings[i]??{distance:15,angle:0,radius:1,illumination:0}
      this.program.setVec4(`u_pose[${i}]`,pose.distance,pose.angle,pose.radius,pose.illumination)
    }
    for(const [key,value] of Object.entries({wallTravel:state.wallTravel,wallRoll:state.wallRoll,wallDensity:state.wallDensity,wallActivity:state.wallActivity,leftAccent:state.leftAccent,rightAccent:state.rightAccent,wallShimmer:state.wallShimmer,span:IFRIT_PASSAGE_SPAN*number('spacing',1)})) this.program.setFloat(`u_${key}`,value)
    for(const [key,fallback] of Object.entries(IFRIT_COLORS)) {
      const value=parameters.get(key)
      const color=Array.isArray(value) ? value as number[] : fallback
      this.program.setVec3(`u_${key}`,color[0],color[1],color[2])
    }

    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true)
    gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE)
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount)
    gl.bindVertexArray(null)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.gl.deleteBuffer(this.buffer); this.gl.deleteVertexArray(this.vao); this.program.dispose()
  }
}
