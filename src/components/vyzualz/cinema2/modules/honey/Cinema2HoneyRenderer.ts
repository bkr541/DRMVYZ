import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { HONEY_PALETTE_KEYS, type HoneyPalette } from './Cinema2HoneyDomain'
import { buildHoneyGeometry } from './Cinema2HoneyGeometry'
import { staticHoneyCell,type HoneyVisualCell } from './Cinema2HoneyMotion'
import type { HoneyCell } from './Cinema2HoneyLayout'

import { HONEY_CAMERA,HONEY_FINISHES,honeySeed } from './Cinema2HoneyDomain'
import { HONEY_LIGHT_DEFAULTS,honeyLightInstances,type HoneyLightControls } from './Cinema2HoneyLighting'
import { HONEY_VERTEX,HONEY_FRAGMENT,HONEY_SHADOW_VERTEX,HONEY_SHADOW_FRAGMENT } from './Cinema2HoneyShaders'
import type { Cinema2LightingEnvironmentFrame } from '../../spatial/Cinema2LightingEnvironmentRuntime'
import type { Cinema2ShadowFrame } from '../../runtime/Cinema2ShadowService'

export interface HoneyDrawLighting {
  controls:HoneyLightControls
  eye:readonly [number,number,number]
  environment?:Readonly<Cinema2LightingEnvironmentFrame>
  shadow?:Readonly<Cinema2ShadowFrame>
}
const linear=(v:number)=>Math.pow(Math.max(0,v),2.2)
const fallbackLighting:HoneyDrawLighting={controls:HONEY_LIGHT_DEFAULTS,eye:HONEY_CAMERA.position}

/** One mesh buffer and one dynamic instance buffer; a single instanced depth-tested world draw. */
export class Cinema2HoneyRenderer {
  private program: ShaderProgram | null = null
  private shadowProgram: ShaderProgram | null = null
  private fallbackShadow: WebGLTexture | null = null
  private vao: WebGLVertexArrayObject | null = null
  private buffers: WebGLBuffer[] = []
  private gpuBytes = 0
  private instanceBuffer:WebGLBuffer|null=null
  private poseTexture:WebGLTexture|null=null
  private readonly instanceData:Float32Array<ArrayBuffer>
  private readonly poseData:Float32Array<ArrayBuffer>
  private lastCells:readonly HoneyVisualCell[]|null=null
  private vertexCount = 0
  private readonly matrix = new Float32Array(16)
  private readonly colors = new Float32Array(21)
  private disposed = false
  constructor(private readonly gl: WebGL2RenderingContext, private readonly cells: readonly HoneyCell[]) {
    this.instanceData=new Float32Array(cells.length*39)
    this.poseData=new Float32Array(cells.length*8)
    try {
      const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/Honey',vertSrc:HONEY_VERTEX,fragSrc:HONEY_FRAGMENT,requiredUniforms:['u_viewProjection','u_palette[0]','u_gain','u_spill','u_ambient','u_key','u_lightDir','u_eye','u_shadow','u_shadowMatrix','u_shadowSettings','u_poses']})
      if(!result.program)throw new Error(`HONEY shader ${result.error.stage}: ${result.error.log}`)
      this.program=result.program
      const shadow=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/Honey/Shadow',vertSrc:HONEY_SHADOW_VERTEX,fragSrc:HONEY_SHADOW_FRAGMENT,requiredUniforms:['u_viewProjection']})
      if(!shadow.program)throw new Error(`HONEY shadow shader ${shadow.error.stage}: ${shadow.error.log}`)
      this.shadowProgram=shadow.program
      // WebGL requires a complete depth comparison texture even on tiers without an engine shadow map.
      this.fallbackShadow=gl.createTexture()
      if(!this.fallbackShadow)throw new Error('HONEY could not allocate fallback shadow texture.')
      const previous=gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture|null
      try{
        gl.bindTexture(gl.TEXTURE_2D,this.fallbackShadow)
        gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT16,1,1,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_SHORT,new Uint16Array([65535]))
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL)
        this.gpuBytes+=2
      }finally{gl.bindTexture(gl.TEXTURE_2D,previous)}
      const vertices:number[]=[]
      for(const part of buildHoneyGeometry()){
        for(let i=0;i<part.vertices.length;i+=6)vertices.push(...part.vertices.subarray(i,i+6),HONEY_PALETTE_KEYS.indexOf(part.role),part.moving?1:0)
      }
      this.vertexCount=vertices.length/8
      this.vao=gl.createVertexArray()
      if(!this.vao)throw new Error('HONEY could not allocate a vertex array.')
      gl.bindVertexArray(this.vao)
      this.buffer(new Float32Array(vertices))
      this.attribute(0,3,32,0);this.attribute(1,3,32,12);this.attribute(2,2,32,24)
      this.instanceBuffer=this.buffer(this.instanceData,gl.DYNAMIC_DRAW)
      this.attribute(3,4,156,0,1);this.attribute(4,2,156,16,1)
      for(let i=0;i<7;i++)this.attribute(5+i,4,156,24+i*16,1)
      this.attribute(12,3,156,136,1);this.attribute(13,2,156,148,1)
      this.poseTexture=gl.createTexture()
      if(!this.poseTexture)throw new Error('HONEY could not allocate pose texture.')
      gl.bindTexture(gl.TEXTURE_2D,this.poseTexture)
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST)
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,cells.length,2,0,gl.RGBA,gl.FLOAT,this.poseData)
      gl.bindTexture(gl.TEXTURE_2D,previous);this.gpuBytes+=this.poseData.byteLength
      this.updateCells(cells.map(staticHoneyCell))
      gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null)
      assertCinema2NoGlErrors(gl,'HONEY setup')
    }catch(error){this.dispose();throw error}
  }
  private buffer(data:Float32Array,usage:number=this.gl.STATIC_DRAW){
    const gl=this.gl,buffer=gl.createBuffer();if(!buffer)throw new Error('HONEY could not allocate a buffer.')
    this.buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data as Float32Array<ArrayBuffer>,usage);this.gpuBytes+=data.byteLength;return buffer
  }
  /** One upload per distinct simulation frame; world and shadow consume the same pose. */
  updateCells(cells:readonly HoneyVisualCell[]){
    if(this.disposed||cells===this.lastCells)return
    const gl=this.gl,lights=honeyLightInstances(cells),count=cells.length
    cells.forEach((c,i)=>{
      this.instanceData.set([c.x,c.y,c.pose.elevation,c.tone,HONEY_FINISHES.indexOf(c.finish),honeySeed(c.q,c.r,79)],i*39)
      this.instanceData.set(lights.subarray(i*28,(i+1)*28),i*39+6)
      this.instanceData.set([c.pose.rotation,c.pose.tiltX,c.pose.tiltY,c.pose.x,c.pose.y],i*39+34)
      this.poseData.set([c.pose.rotation,c.pose.tiltX,c.pose.tiltY,c.pose.x],i*4)
      this.poseData.set([c.pose.y,0,0,0],(count+i)*4)
    })
    const previousBuffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING) as WebGLBuffer|null
    gl.bindBuffer(gl.ARRAY_BUFFER,this.instanceBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.instanceData);gl.bindBuffer(gl.ARRAY_BUFFER,previousBuffer)
    const previousTexture=gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture|null
    gl.bindTexture(gl.TEXTURE_2D,this.poseTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,count,2,gl.RGBA,gl.FLOAT,this.poseData);gl.bindTexture(gl.TEXTURE_2D,previousTexture)
    this.lastCells=cells
  }
  private attribute(index:number,size:number,stride:number,offset:number,divisor=0){const gl=this.gl;gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,stride,offset);gl.vertexAttribDivisor(index,divisor)}
  estimateGpuBytes(){return this.gpuBytes}
  private geometry(){const gl=this.gl;gl.bindVertexArray(this.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,this.vertexCount,this.cells.length);gl.bindVertexArray(null)}
  drawShadow(viewProjection:readonly number[]){
    if(this.disposed||!this.shadowProgram)return
    this.matrix.set(viewProjection);this.shadowProgram.activate();this.shadowProgram.setMat4('u_viewProjection',this.matrix)
    // ShadowService owns the bound depth target and raster state.
    this.geometry()
  }
  draw(viewProjection:readonly number[],palette:HoneyPalette,lighting:HoneyDrawLighting=fallbackLighting){
    if(this.disposed||!this.program)return
    if(viewProjection.length!==16||!viewProjection.every(Number.isFinite))throw new Error('HONEY requires a finite final camera matrix.')
    const gl=this.gl,p=this.program,c=lighting.controls
    this.matrix.set(viewProjection);HONEY_PALETTE_KEYS.forEach((key,i)=>this.colors.set(palette[key].slice(0,3).map(linear),i*3))
    p.activate();p.setMat4('u_viewProjection',this.matrix);gl.uniform3fv(p.getUniform('u_palette[0]'),this.colors)
    p.setVec3('u_gain',c.outerGain,c.innerGain,c.underGain);p.setFloat('u_spill',c.lightSpill)
    const ambient=lighting.environment?.lights.find(l=>l.type==='ambient'),key=lighting.environment?.lights.find(l=>l.type==='directional')
    const ambientColor=ambient?.color??[.76,.86,1,1],keyColor=key?.color??[.83,.91,1,1]
    const ambientGain=ambient?.intensity??c.ambient,keyGain=key?.intensity??1.1
    p.setVec3('u_ambient',...([0,1,2].map(i=>linear(ambientColor[i]!)*ambientGain) as [number,number,number]))
    p.setVec3('u_key',...([0,1,2].map(i=>linear(keyColor[i]!)*keyGain) as [number,number,number]))
    const direction=key?.direction??[.45,-.65,-.9]
    p.setVec3('u_lightDir',-direction[0],-direction[1],-direction[2]);p.setVec3('u_eye',...lighting.eye)
    const shadow=lighting.shadow
    p.setMat4('u_shadowMatrix',shadow?.viewProjection??this.matrix)
    p.setVec3('u_shadowSettings',shadow?1:0,shadow?shadow.bias/shadow.depthRange:0,shadow?shadow.softness/shadow.resolution:0)
    const priorUnit=gl.getParameter(gl.ACTIVE_TEXTURE) as number
    gl.activeTexture(gl.TEXTURE0);const priorTexture=gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture|null
    try{
      gl.bindTexture(gl.TEXTURE_2D,shadow?.texture??this.fallbackShadow);p.setSampler('u_shadow',0)
      gl.activeTexture(gl.TEXTURE0+1);const priorPose=gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture|null
      gl.bindTexture(gl.TEXTURE_2D,this.poseTexture);p.setSampler('u_poses',1)
      try{
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.colorMask(true,true,true,true)
      this.geometry();assertCinema2NoGlErrors(gl,'HONEY draw')
      }finally{gl.bindTexture(gl.TEXTURE_2D,priorPose);gl.activeTexture(gl.TEXTURE0)}
    }finally{gl.bindTexture(gl.TEXTURE_2D,priorTexture);gl.activeTexture(priorUnit)}
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.gl.bindVertexArray(null);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null)
    if(this.vao)this.gl.deleteVertexArray(this.vao);for(const buffer of this.buffers)this.gl.deleteBuffer(buffer);this.program?.dispose();this.shadowProgram?.dispose();if(this.fallbackShadow)this.gl.deleteTexture(this.fallbackShadow);if(this.poseTexture)this.gl.deleteTexture(this.poseTexture)
    this.vao=null;this.buffers=[];this.program=null;this.shadowProgram=null;this.fallbackShadow=null;this.poseTexture=null;this.instanceBuffer=null;this.lastCells=null;this.gpuBytes=0
  }
}
