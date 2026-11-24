import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { HONEY_PALETTE_KEYS, type HoneyPalette } from './Cinema2HoneyDomain'
import { buildHoneyGeometry } from './Cinema2HoneyGeometry'
import type { HoneyCell } from './Cinema2HoneyLayout'

const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_part;
layout(location=3) in vec4 i_cell;
layout(location=4) in vec3 i_channels;
uniform mat4 u_viewProjection;
out vec3 v_normal;
flat out int v_role;
flat out float v_tone;
flat out vec3 v_channels;
void main(){
  vec3 world=a_position+vec3(i_cell.xy,i_cell.z*a_part.y);
  gl_Position=u_viewProjection*vec4(world,1.0);
  v_normal=a_normal; v_role=int(a_part.x+0.5); v_tone=i_cell.w; v_channels=i_channels;
}`
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_normal;
flat in int v_role;
flat in float v_tone;
flat in vec3 v_channels;
uniform vec3 u_palette[7];
out vec4 outColor;
void main(){
  vec3 normal=normalize(v_normal);
  float key=max(dot(normal,normalize(vec3(-0.45,0.65,0.9))),0.0);
  float fill=max(dot(normal,normalize(vec3(0.65,-0.2,0.6))),0.0);
  vec3 base=u_palette[v_role];
  float illumination=0.36+0.76*key+0.14*fill;
  if(v_role==0) base*=v_tone;
  if(v_role>=4){
    float selected=v_role==4?v_channels.x:v_role==5?v_channels.y:v_channels.z;
    // Coloured physical seats, not HDR emission or bloom. Phase 02 owns lighting.
    base=mix(u_palette[1]*0.62,base,selected*0.62);
  }
  outColor=vec4(base*illumination,1.0);
}`

/** One mesh buffer and one immutable instance buffer; a single instanced depth-tested world draw. */
export class Cinema2HoneyRenderer {
  private program: ShaderProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private buffers: WebGLBuffer[] = []
  private gpuBytes = 0
  private vertexCount = 0
  private readonly matrix = new Float32Array(16)
  private readonly colors = new Float32Array(21)
  private disposed = false
  constructor(private readonly gl: WebGL2RenderingContext, private readonly cells: readonly HoneyCell[]) {
    try {
      const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/Honey',vertSrc:VERTEX,fragSrc:FRAGMENT,requiredUniforms:['u_viewProjection','u_palette[0]']})
      if(!result.program)throw new Error(`HONEY shader ${result.error.stage}: ${result.error.log}`)
      this.program=result.program
      const vertices:number[]=[]
      for(const part of buildHoneyGeometry()){
        for(let i=0;i<part.vertices.length;i+=6)vertices.push(...part.vertices.subarray(i,i+6),HONEY_PALETTE_KEYS.indexOf(part.role),part.moving?1:0)
      }
      const instances=new Float32Array(cells.length*7)
      cells.forEach((c,i)=>instances.set([c.x,c.y,c.elevation,c.tone,...c.channels],i*7))
      this.vertexCount=vertices.length/8
      this.vao=gl.createVertexArray()
      if(!this.vao)throw new Error('HONEY could not allocate a vertex array.')
      gl.bindVertexArray(this.vao)
      this.buffer(new Float32Array(vertices))
      this.attribute(0,3,32,0);this.attribute(1,3,32,12);this.attribute(2,2,32,24)
      this.buffer(instances)
      this.attribute(3,4,28,0,1);this.attribute(4,3,28,16,1)
      gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null)
      assertCinema2NoGlErrors(gl,'HONEY setup')
    }catch(error){this.dispose();throw error}
  }
  private buffer(data:Float32Array){
    const gl=this.gl,buffer=gl.createBuffer();if(!buffer)throw new Error('HONEY could not allocate a buffer.')
    this.buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data as Float32Array<ArrayBuffer>,gl.STATIC_DRAW);this.gpuBytes+=data.byteLength
  }
  private attribute(index:number,size:number,stride:number,offset:number,divisor=0){const gl=this.gl;gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,stride,offset);gl.vertexAttribDivisor(index,divisor)}
  estimateGpuBytes(){return this.gpuBytes}
  draw(viewProjection:readonly number[],palette:HoneyPalette){
    if(this.disposed||!this.program)return
    if(viewProjection.length!==16||!viewProjection.every(Number.isFinite))throw new Error('HONEY requires a finite final camera matrix.')
    const gl=this.gl;this.matrix.set(viewProjection);HONEY_PALETTE_KEYS.forEach((key,i)=>this.colors.set(palette[key].slice(0,3),i*3))
    this.program.activate();this.program.setMat4('u_viewProjection',this.matrix);gl.uniform3fv(this.program.getUniform('u_palette[0]'),this.colors)
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.colorMask(true,true,true,true)
    gl.bindVertexArray(this.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,this.vertexCount,this.cells.length);gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl,'HONEY draw')
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.gl.bindVertexArray(null);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null)
    if(this.vao)this.gl.deleteVertexArray(this.vao);for(const buffer of this.buffers)this.gl.deleteBuffer(buffer);this.program?.dispose()
    this.vao=null;this.buffers=[];this.program=null;this.gpuBytes=0
  }
}
