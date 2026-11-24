import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { buildHudMesh, HUD_COLOR_KEYS, HUD_STRIDE, type HudPalette } from './Cinema2HudGeometry'

const vertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_local;
layout(location=1) in vec4 a_shape;
layout(location=2) in vec4 a_profile;
layout(location=3) in vec4 a_material;
uniform mat4 u_viewProjection;
out vec3 v_world;
flat out int v_role;
flat out float v_gain;
void main(){
  float angle=a_profile.x+a_local.x*a_profile.y;
  vec2 radial=vec2(cos(angle),sin(angle));
  vec2 point=radial*(a_shape.w+a_local.y*a_profile.z);
  if(a_material.z>.5){
    vec2 direction=vec2(cos(a_profile.x),sin(a_profile.x));
    point=direction*(a_shape.w*(a_local.x-.5))+vec2(-direction.y,direction.x)*a_local.y*a_profile.z;
  }
  v_world=vec3(a_shape.xy+point,a_shape.z+a_local.z*a_profile.w);
  v_role=int(a_material.x+.5);v_gain=a_material.y;
  gl_Position=u_viewProjection*vec4(v_world,1.);
}`
const fragment=`#version 300 es
precision highp float;
in vec3 v_world;
flat in int v_role;
flat in float v_gain;
uniform vec3 u_palette[6];
uniform vec3 u_eye;
out vec4 color;
void main(){
  vec3 normal=normalize(cross(dFdx(v_world),dFdy(v_world)));
  vec3 viewDir=normalize(u_eye-v_world);
  if(dot(normal,viewDir)<0.) normal=-normal;
  vec3 light=normalize(vec3(-.45,.65,.8));
  float diffuse=max(0.,dot(normal,light));
  float spec=pow(max(0.,dot(normal,normalize(light+viewDir))),36.);
  float rim=pow(1.-max(0.,dot(normal,viewDir)),2.);
  vec3 base=u_palette[v_role];
  float metal=v_role==3?1.:0.;
  // Dark metal retains machined edge definition, even when the emitter is inactive.
  vec3 surface=base*(.22+.46*diffuse)+vec3(.045,.055,.085)*(spec*.8+rim*.25);
  vec3 luminous=base*(.06+max(0.,v_gain)*1.7)*( .72+.28*max(0.,normal.z));
  color=vec4(mix(luminous+surface*.14,surface,metal),1.);
}`

/** Single native instanced world draw. No independent canvas, framebuffer, clock or post chain. */
export class Cinema2HudRenderer {
  private program:ShaderProgram|null=null
  private vao:WebGLVertexArrayObject|null=null
  private mesh:WebGLBuffer|null=null
  private instances:WebGLBuffer|null=null
  private count=0
  private capacity=0
  private disposed=false
  private readonly matrix=new Float32Array(16)
  private readonly colors=new Float32Array(18)
  private readonly vertices=buildHudMesh()
  constructor(private readonly gl:WebGL2RenderingContext){
    try{
      const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/HUD',vertSrc:vertex,fragSrc:fragment,requiredUniforms:['u_viewProjection','u_palette[0]','u_eye']})
      if(!result.program)throw Error(`HUD shader ${result.error.stage}: ${result.error.log}`)
      this.program=result.program
      this.vao=gl.createVertexArray();this.mesh=gl.createBuffer();this.instances=gl.createBuffer()
      if(!this.vao||!this.mesh||!this.instances)throw Error('HUD resource allocation failed')
      gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.mesh);gl.bufferData(gl.ARRAY_BUFFER,this.vertices,gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0)
      gl.bindBuffer(gl.ARRAY_BUFFER,this.instances)
      for(let i=0;i<3;i++){gl.enableVertexAttribArray(i+1);gl.vertexAttribPointer(i+1,4,gl.FLOAT,false,HUD_STRIDE*4,i*16);gl.vertexAttribDivisor(i+1,1)}
      gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null)
      assertCinema2NoGlErrors(gl,'HUD setup')
    }catch(error){this.dispose();throw error}
  }
  draw(matrix:readonly number[],eye:readonly [number,number,number],palette:HudPalette,geometry:Float32Array){
    if(this.disposed||!this.program)return
    const gl=this.gl,p=this.program
    this.matrix.set(matrix);HUD_COLOR_KEYS.forEach((key,i)=>this.colors.set(palette[key].slice(0,3).map(v=>Math.pow(v,2.2)),i*3))
    p.activate();p.setMat4('u_viewProjection',this.matrix);p.setVec3('u_eye',...eye);gl.uniform3fv(p.getUniform('u_palette[0]'),this.colors)
    gl.bindBuffer(gl.ARRAY_BUFFER,this.instances)
    if(this.capacity<geometry.byteLength){this.capacity=geometry.byteLength;gl.bufferData(gl.ARRAY_BUFFER,this.capacity,gl.DYNAMIC_DRAW)}
    gl.bufferSubData(gl.ARRAY_BUFFER,0,geometry as Float32Array<ArrayBuffer>);gl.bindBuffer(gl.ARRAY_BUFFER,null)
    this.count=geometry.length/HUD_STRIDE
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.colorMask(true,true,true,true)
    gl.bindVertexArray(this.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,this.vertices.length/3,this.count);gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl,'HUD draw')
  }
  estimateGpuBytes(){return this.vertices.byteLength+this.capacity}
  inspect(){return {drawCalls:this.count?1:0,triangles:this.vertices.length/9*this.count,primitiveCount:this.count,estimatedGpuBytes:this.estimateGpuBytes()}}
  dispose(){
    if(this.disposed)return;this.disposed=true
    const gl=this.gl;gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null)
    if(this.vao)gl.deleteVertexArray(this.vao);if(this.mesh)gl.deleteBuffer(this.mesh);if(this.instances)gl.deleteBuffer(this.instances);this.program?.dispose()
    this.vao=null;this.mesh=null;this.instances=null;this.program=null;this.count=0;this.capacity=0
  }
}
