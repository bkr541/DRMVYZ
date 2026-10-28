import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { buildElevhateInstances } from './Cinema2ElevhateGeometry'

const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_uv;
layout(location=3) in vec4 i_cell;
uniform mat4 u_viewProjection;
uniform vec3 u_camera;
uniform float u_opening;
uniform float u_from;
uniform float u_to;
uniform float u_blend;
uniform float u_phase;
uniform float u_build;
uniform float u_pressure;
uniform float u_drop;
out vec2 v_uv;
out vec3 v_normal;
out vec3 v_relative;
flat out float v_kind;
flat out float v_mode;
float hash(vec3 p) { return fract(sin(dot(p,vec3(12.9898,78.233,39.425)))*43758.5453); }
void shape(float mode, vec3 cell, float kind, out vec3 center, out vec3 size) {
  float side = 12.0 - u_opening;
  center = (cell + .5) * 12.0;
  size = vec3(side);
  if(kind < .5) {
    if(mode > 1.5 && mode < 2.5) size *= mix(.64, 1.0, step(.5, mod(cell.x+cell.y+cell.z,2.0)));
    if(mode > 2.5 && mode < 3.5) size.y *= .55;
    if(mode > 3.5 && mode < 4.5) {
      vec3 offset = vec3(hash(cell),hash(cell.yzx),hash(cell.zxy))*.9-.45;
      center += offset; size -= 2.0*abs(offset);
    }
    if(mode > 4.5) size *= vec3(.8,.92,.8);
    return;
  }
  float k = mod(kind-1.0,12.0), axis = floor(k/4.0), bar = mod(k,4.0), layer=step(12.5,kind);
  float separation = mode < 1.5 ? 1.0 : mode < 2.5 ? 2.5 : mode < 3.5 ? 1.5 : .3;
  float along = 6.0 + mix(-separation,separation,layer);
  float halfOpening=u_opening*.5 + .12 + u_pressure*.08;
  float thick = mode > 4.5 ? .045 : .075;
  float s = bar < 2.0 ? -1.0 : 1.0;
  bool vertical = mod(bar,2.0)<.5;
  vec3 local = vec3(vertical ? s*halfOpening : 0.0, vertical ? 0.0 : s*halfOpening, along);
  vec3 dims = vec3(vertical ? thick : halfOpening*2.0+thick, vertical ? halfOpening*2.0+thick : thick, thick);
  if(axis<.5) { center=cell*12.0+local; size=dims; }
  else if(axis<1.5) { center=cell*12.0+local.zxy; size=dims.zxy; }
  else { center=cell*12.0+local.yzx; size=dims.yzx; }
  if(mode < .5 || (mode > 3.5 && mode < 4.5)) size=vec3(0.0);
  // Only cosmetic collar depth compresses: the clear aperture never contracts.
  size *= 1.0 - .08*u_build + .08*u_drop;
}
void main() {
  vec3 cell = i_cell.xyz + floor(u_camera/12.0);
  vec3 a,sa,b,sb;
  shape(u_from,cell,i_cell.w,a,sa); shape(u_to,cell,i_cell.w,b,sb);
  vec3 center=mix(a,b,u_blend), size=mix(sa,sb,u_blend);
  v_uv=a_uv; v_normal=a_normal; v_relative=center+a_position*size-u_camera; v_kind=i_cell.w; v_mode=u_to;
  if(max(size.x,max(size.y,size.z))<.001) { gl_Position=vec4(2.0,2.0,2.0,1.0); return; }
  gl_Position=u_viewProjection*vec4(center+a_position*size,1.0);
}`
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_normal;
in vec3 v_relative;
flat in float v_kind;
flat in float v_mode;
uniform vec3 u_void;
uniform vec3 u_body;
uniform vec3 u_primary;
uniform vec3 u_junction;
uniform vec3 u_secondary;
uniform float u_master;
uniform float u_width;
uniform float u_haze;
uniform float u_radius;
uniform float u_phase;
uniform float u_energy;
uniform float u_kick;
uniform float u_snare;
uniform float u_drop;
uniform float u_wave;
uniform float u_high;
uniform float u_vocal;
uniform float u_significance;
out vec4 outColor;
void main() {
  float distance=length(v_relative);
  vec2 edge=min(v_uv,1.0-v_uv)/max(fwidth(v_uv),vec2(.000001));
  float width=clamp(u_width*(1.0+.12*u_kick),.6,3.0);
  float line=1.0-smoothstep(width*.5,width*.5+1.0,min(edge.x,edge.y));
  vec3 tint=edge.x<edge.y ? u_primary : u_junction;
  tint=mix(tint,u_secondary,smoothstep(25.0,48.0,distance));
  if(v_kind>.5) {
    tint=u_secondary;
    if(v_mode>1.5 && v_mode<2.5) tint=u_junction;
    if(v_mode>4.5 && abs(v_uv.x-.5)<.11 && abs(v_uv.y-.5)<.44) discard;
    line=max(line,.5);
    if(distance>23.0) discard;
    tint*=1.0-smoothstep(14.0,23.0,distance);
  }
  float wave=exp(-pow((distance-mod(u_phase*12.0,60.0))/8.0,2.0))*u_wave;
  float accent=.45*u_kick+.35*u_snare*abs(v_normal.x)+.65*u_drop+wave*.35;
  float sparkle=.1*u_high*pow(max(0.0,sin(u_phase*9.0+v_uv.y*120.0)),12.0);
  float detail = v_kind>.5 || distance>25.0 ? 1.0 : 0.0;
  float emission=2.2*(1.0+.15*u_energy*detail+accent+sparkle)*mix(1.0,u_significance,detail);
  if(v_kind>.5) emission*=1.0-.2*u_vocal;
  vec3 color=mix(u_body*(.65+.35*abs(v_normal.y)),tint*emission,line)*u_master;
  float boundary=max(abs(v_relative.x),max(abs(v_relative.y),abs(v_relative.z)));
  float fade=smoothstep(u_radius*12.0-15.0,u_radius*12.0-2.0,boundary);
  fade=max(fade,1.0-exp(-distance*u_haze));
  color=mix(color,u_void,fade);
  outColor=vec4(color,1.0);
}`
export interface ElevhateDrawState {
  viewProjection: readonly number[]; camera: readonly [number, number, number]
  opening: number; from: number; to: number; blend: number; phase: number; build: number; pressure: number
  master: number; width: number; haze: number
  void: readonly [number, number, number]; body: readonly [number, number, number]; primary: readonly [number, number, number]; junction: readonly [number, number, number]; secondary: readonly [number, number, number]
  energy: number; kick: number; snare: number; drop: number; wave: number; high: number; vocal: number; significance: number
}
export class Cinema2ElevhateRenderer {
  private readonly program: ShaderProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly buffers: WebGLBuffer[] = []
  private readonly count: number
  private readonly bytes: number
  private disposed = false
  constructor(private readonly gl: WebGL2RenderingContext, private readonly radius = 7) {
    const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/Elevhate/Lattice',vertSrc:VERTEX,fragSrc:FRAGMENT,
      requiredUniforms:['u_viewProjection','u_camera','u_opening','u_from','u_to','u_blend','u_build','u_pressure','u_void','u_body','u_primary','u_junction','u_secondary','u_master','u_width','u_haze','u_radius','u_phase','u_energy','u_kick','u_snare','u_drop','u_wave','u_high','u_vocal','u_significance']})
    if(!result.program) throw new Error(JSON.stringify(result.error))
    this.program=result.program
    const vao=gl.createVertexArray(); if(!vao) throw new Error('Elevhate VAO allocation failed.'); this.vao=vao
    const faces=[[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]],[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]]]
    const vertices:number[]=[], indices:number[]=[]
    faces.forEach(([n,t,b],face)=>{ for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]) vertices.push(...n.map((value,axis)=>value*.5+t[axis]*(u-.5)+b[axis]*(v-.5)),...n,u,v); const i=face*4; indices.push(i,i+1,i+2,i,i+2,i+3) })
    const instances=buildElevhateInstances(radius,2)
    const positions=new Float32Array(vertices), elements=new Uint16Array(indices)
    gl.bindVertexArray(vao)
    this.buffer(gl.ARRAY_BUFFER,positions)
    for(const [location,size,offset] of [[0,3,0],[1,3,12],[2,2,24]]) {gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,32,offset)}
    this.buffer(gl.ELEMENT_ARRAY_BUFFER,elements); this.buffer(gl.ARRAY_BUFFER,instances)
    gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,4,gl.FLOAT,false,16,0);gl.vertexAttribDivisor(3,1)
    gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null)
    this.count=instances.length/4;this.bytes=positions.byteLength+elements.byteLength+instances.byteLength
    assertCinema2NoGlErrors(gl,'Elevhate setup')
  }
  private buffer(target:number,data:Float32Array|Uint16Array) {const b=this.gl.createBuffer();if(!b)throw new Error('Elevhate buffer allocation failed.');this.buffers.push(b);this.gl.bindBuffer(target,b);this.gl.bufferData(target,data as ArrayBufferView<ArrayBuffer>,this.gl.STATIC_DRAW)}
  estimateGpuBytes(){return this.bytes}
  draw(s:ElevhateDrawState) {
    if(this.disposed)return
    const p=this.program,g=this.gl;p.activate();p.setMat4('u_viewProjection',new Float32Array(s.viewProjection));p.setVec3('u_camera',...s.camera)
    for(const name of ['opening','from','to','blend','phase','build','pressure','master','width','haze','energy','kick','snare','drop','wave','high','vocal','significance'] as const)p.setFloat(`u_${name}`,s[name])
    p.setFloat('u_radius',this.radius)
    for(const name of ['void','body','primary','junction','secondary'] as const)p.setVec3(`u_${name}`,...s[name])
    g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.depthMask(true);g.disable(g.BLEND);g.enable(g.CULL_FACE);g.cullFace(g.BACK);g.colorMask(true,true,true,true)
    g.bindVertexArray(this.vao);g.drawElementsInstanced(g.TRIANGLES,36,g.UNSIGNED_SHORT,0,this.count);g.bindVertexArray(null);g.disable(g.CULL_FACE)
    assertCinema2NoGlErrors(g,'Elevhate draw')
  }
  dispose(){if(this.disposed)return;this.disposed=true;for(const b of this.buffers)this.gl.deleteBuffer(b);this.gl.deleteVertexArray(this.vao);this.program.dispose()}
}
