import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import type { Cinema2Color,Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import { honeySeed } from './Cinema2HoneyDomain'
import type { HoneyCell } from './Cinema2HoneyLayout'

export const HONEY_PARTICLE_COLOR: Cinema2Color=[1,156/255,72/255,1]
export const HONEY_PARTICLE_DEFAULTS={particles:true,particleAmount:.42,particleColor:HONEY_PARTICLE_COLOR} as const
export const HONEY_PARTICLE_CAPACITY={low:100,medium:220,high:400} as const
const CAP=HONEY_PARTICLE_CAPACITY.high
const clamp=(x:number)=>Number.isFinite(x)?Math.max(0,Math.min(1,x)):0

/** Fixed slots, evaluated on the native wall's existing lifecycle, never a second clock/RAF. */
export class Cinema2HoneyParticles {
  private age=0
  private lift=0
  private enabled=true
  private amount=.42
  private readonly sources:readonly HoneyCell[]
  readonly data=new Float32Array(CAP*5)
  constructor(cells:readonly HoneyCell[]){
    // Interleave edge sources and occasional foreground slots across the visible central wall.
    this.sources=cells.filter(c=>Math.abs(c.x)<12&&Math.abs(c.y)<12&&c.channels.some(v=>v>.5))
    if(!this.sources.length)this.sources=cells
  }
  update(input:{active:boolean;reset:boolean;deltaSeconds:number;enabled:boolean;amount:number;reactivity:number;high:number;air:number;flux:number;drop:number}){
    if(input.reset||!input.enabled||!this.enabled){this.age=0;this.lift=0}
    this.enabled=input.enabled;this.amount=clamp(input.amount)
    if(!this.enabled)return
    if(clamp(input.reactivity)===0)this.lift=0
    else if(input.active)this.lift=clamp(input.reactivity)*clamp(.30*input.high+.25*input.air+.25*input.flux+.5*input.drop)
    if(input.active&&!input.reset)this.age+=Math.max(0,Math.min(.25,input.deltaSeconds))
  }
  fill(quality:Cinema2RenderQualityLevel):number{
    if(!this.enabled||!this.sources.length||this.amount===0)return 0
    const count=Math.min(HONEY_PARTICLE_CAPACITY[quality],Math.floor(HONEY_PARTICLE_CAPACITY[quality]*this.amount*(.55+.45*this.lift)))
    for(let i=0;i<count;i++){
      const seed=(salt:number)=>honeySeed(i,91,salt),life=2+4*seed(1),t=(this.age+life*seed(2))/life,cycle=Math.floor(t),f=t-cycle
      const cell=this.sources[Math.floor(honeySeed(i,cycle,3)*this.sources.length)]!,angle=seed(4)*Math.PI*2,edge=.88+seed(5)*.12
      const at=i*5,foreground=seed(6)>.91
      this.data[at]=cell.x+Math.cos(angle)*edge+(seed(7)-.5)*f*.65
      this.data[at+1]=cell.y+Math.sin(angle)*edge+f*(.25+seed(8)*.65)
      this.data[at+2]=foreground?1.4+seed(9)*2.2: .25+seed(9)*.95+f*.3
      this.data[at+3]=Math.min(1,f*8,(1-f)*5)*(.22+.48*seed(10))
      this.data[at+4]=.009+.012*seed(11)
    }
    return count
  }
  inspect(){return {age:this.age,lift:this.lift,enabled:this.enabled,amount:this.amount}}
}
const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec2 a_lifeSize;
uniform mat4 u_viewProjection;
uniform float u_height;
out float v_alpha;
void main(){gl_Position=u_viewProjection*vec4(a_position,1.0);gl_PointSize=clamp(a_lifeSize.y*u_height/max(.1,gl_Position.w),1.0,3.5);v_alpha=a_lifeSize.x;}`
const FRAG=`#version 300 es
precision highp float;
uniform vec4 u_color;
in float v_alpha;
out vec4 outColor;
void main(){float r=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.15,1.,r))*v_alpha*u_color.a;outColor=vec4(u_color.rgb*1.25*a,0.);}`

/** Draw into the already-bound HDR/depth world target. Additive RGB, never writes depth/alpha. */
export class Cinema2HoneyParticleRenderer {
  private program:ShaderProgram|null=null
  private vao:WebGLVertexArrayObject|null=null
  private buffer:WebGLBuffer|null=null
  private readonly matrix=new Float32Array(16)
  readonly bytes=CAP*5*4
  constructor(private readonly gl:WebGL2RenderingContext){
    try{
      const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/Honey/Embers',vertSrc:VERT,fragSrc:FRAG,requiredUniforms:['u_viewProjection','u_height','u_color']})
      if(!result.program)throw Error(`HONEY embers: ${result.error.log}`)
      this.program=result.program;this.vao=gl.createVertexArray();this.buffer=gl.createBuffer()
      if(!this.vao||!this.buffer)throw Error('HONEY ember allocation failed')
      gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.bytes,gl.DYNAMIC_DRAW)
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0)
      gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12)
    }catch(e){this.dispose();throw e}finally{gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null)}
  }
  draw(matrix:readonly number[],height:number,color:Cinema2Color,data:Float32Array<ArrayBuffer>,count:number){
    if(!count||!this.program)return
    const gl=this.gl,p=this.program
    this.matrix.set(matrix);p.activate();p.setMat4('u_viewProjection',this.matrix);p.setFloat('u_height',height);p.setVec4('u_color',...color)
    gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data,0,count*5)
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE);gl.colorMask(true,true,true,false)
    try{gl.drawArrays(gl.POINTS,0,count)}finally{gl.colorMask(true,true,true,true);gl.disable(gl.BLEND);gl.depthMask(true);gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null)}
  }
  dispose(){const gl=this.gl;if(this.buffer)gl.deleteBuffer(this.buffer);if(this.vao)gl.deleteVertexArray(this.vao);this.program?.dispose();this.program=null;this.vao=null;this.buffer=null}
}
