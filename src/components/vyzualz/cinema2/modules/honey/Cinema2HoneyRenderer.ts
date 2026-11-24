import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { HONEY_PALETTE_KEYS, type HoneyPalette } from './Cinema2HoneyDomain'
import { buildHoneyGeometry } from './Cinema2HoneyGeometry'
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

/** One mesh buffer and one immutable instance buffer; a single instanced depth-tested world draw. */
export class Cinema2HoneyRenderer {
  private program: ShaderProgram | null = null
  private shadowProgram: ShaderProgram | null = null
  private fallbackShadow: WebGLTexture | null = null
  private vao: WebGLVertexArrayObject | null = null
  private buffers: WebGLBuffer[] = []
  private gpuBytes = 0
  private vertexCount = 0
  private readonly matrix = new Float32Array(16)
  private readonly colors = new Float32Array(21)
  private disposed = false
  constructor(private readonly gl: WebGL2RenderingContext, private readonly cells: readonly HoneyCell[]) {
    try {
      const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/Honey',vertSrc:HONEY_VERTEX,fragSrc:HONEY_FRAGMENT,requiredUniforms:['u_viewProjection','u_palette[0]','u_gain','u_spill','u_ambient','u_key','u_lightDir','u_eye','u_shadow','u_shadowMatrix','u_shadowSettings']})
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
      const instances=new Float32Array(cells.length*34),lights=honeyLightInstances(cells)
      cells.forEach((c,i)=>{
        instances.set([c.x,c.y,c.elevation,c.tone,HONEY_FINISHES.indexOf(c.finish),honeySeed(c.q,c.r,79)],i*34)
        instances.set(lights.subarray(i*28,(i+1)*28),i*34+6)
      })
      this.vertexCount=vertices.length/8
      this.vao=gl.createVertexArray()
      if(!this.vao)throw new Error('HONEY could not allocate a vertex array.')
      gl.bindVertexArray(this.vao)
      this.buffer(new Float32Array(vertices))
      this.attribute(0,3,32,0);this.attribute(1,3,32,12);this.attribute(2,2,32,24)
      this.buffer(instances)
      this.attribute(3,4,136,0,1);this.attribute(4,2,136,16,1)
      for(let i=0;i<7;i++)this.attribute(5+i,4,136,24+i*16,1)
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
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.colorMask(true,true,true,true)
      this.geometry();assertCinema2NoGlErrors(gl,'HONEY draw')
    }finally{gl.bindTexture(gl.TEXTURE_2D,priorTexture);gl.activeTexture(priorUnit)}
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.gl.bindVertexArray(null);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null)
    if(this.vao)this.gl.deleteVertexArray(this.vao);for(const buffer of this.buffers)this.gl.deleteBuffer(buffer);this.program?.dispose();this.shadowProgram?.dispose();if(this.fallbackShadow)this.gl.deleteTexture(this.fallbackShadow)
    this.vao=null;this.buffers=[];this.program=null;this.shadowProgram=null;this.fallbackShadow=null;this.gpuBytes=0
  }
}
