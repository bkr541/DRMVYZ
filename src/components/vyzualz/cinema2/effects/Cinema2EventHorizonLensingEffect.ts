import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import { cinema2StableId, type Cinema2EffectManifest, type Cinema2EffectTypeId, type Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import { assertCinema2NoGlErrors } from '../runtime/Cinema2GpuValidation'
import type { Cinema2EffectCreateContext, Cinema2EffectInstance, Cinema2EffectRenderExecutionContext, Cinema2EffectTypeDefinition } from './Cinema2EffectContracts'
import { clampEffectValue as clamp, readEffectColor as color, readEffectNumber as number, validateEffectParameters, type Cinema2EffectNumericRange } from './Cinema2EffectParameterHelpers'

export const CINEMA2_EVENT_HORIZON_LENSING_EFFECT_TYPE_ID=cinema2StableId<Cinema2EffectTypeId>('event-horizon-lensing')
export const CINEMA2_EVENT_HORIZON_LENSING_EFFECT_VERSION=1 as const
export const CINEMA2_EVENT_HORIZON_LENSING_RESOLUTION:Readonly<Record<Cinema2RenderQualityLevel,number>>=Object.freeze({low:.5,medium:.75,high:1})

const LENS_SOURCE=`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_depth;
uniform vec2 u_coreUv;
uniform float u_coreDepth;
uniform float u_strength;
uniform float u_coreRadius;
uniform float u_aspect;
uniform float u_mix;
uniform vec3 u_primary;
uniform vec3 u_accent;
out vec4 outColor;
void main(){
  vec2 delta=v_uv-u_coreUv;delta.x*=u_aspect;
  float radius=length(delta);
  float influence=smoothstep(u_coreRadius*4.8,u_coreRadius*1.04,radius);
  vec2 direction=normalize(delta+vec2(0.000001));
  float bend=u_strength*u_coreRadius*influence*influence/(0.32+radius*7.0);
  vec2 offset=direction*bend;offset.x/=u_aspect;
  float sceneDepth=texture(u_depth,v_uv).r;
  float coreOrForeground=step(sceneDepth,u_coreDepth+0.025);
  vec2 warped=mix(v_uv-offset,v_uv,coreOrForeground);
  float chroma=bend*0.1*(1.0-coreOrForeground);
  vec3 lensed=vec3(texture(u_source,warped+direction*chroma).r,texture(u_source,warped).g,texture(u_source,warped-direction*chroma).b);
  vec4 base=texture(u_source,v_uv);
  float photonRing=exp(-pow((radius-u_coreRadius*1.18)/max(0.001,u_coreRadius*0.12),2.0))*(1.0-coreOrForeground);
  vec2 opposite=u_coreUv-direction*(u_coreRadius*1.42);opposite.x=u_coreUv.x-(direction.x/u_aspect)*(u_coreRadius*1.42);
  vec3 wrapped=texture(u_source,opposite).rgb;
  float wrappedLight=max(wrapped.r,max(wrapped.g,wrapped.b));
  vec3 photonColor=mix(u_primary,u_accent,0.3)*(0.16+wrappedLight*1.8)*u_strength;
  vec3 composite=mix(lensed,max(lensed,wrapped*1.35+photonColor),photonRing*0.82);
  outColor=vec4(mix(base.rgb,composite,clamp(u_mix,0.0,1.0)),base.a);
}`

const UPSAMPLE_SOURCE=`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texel;
out vec4 outColor;
void main(){vec3 c=texture(u_source,v_uv).rgb*4.0;c+=texture(u_source,v_uv+vec2(u_texel.x,0)).rgb+texture(u_source,v_uv-vec2(u_texel.x,0)).rgb+texture(u_source,v_uv+vec2(0,u_texel.y)).rgb+texture(u_source,v_uv-vec2(0,u_texel.y)).rgb;outColor=vec4(c/8.0,1);}`

const NUMERIC:readonly Cinema2EffectNumericRange[]=Object.freeze([['strength',0,2.5],['coreRadius',.06,.4]])

class EventHorizonLensingEffectInstance implements Cinema2EffectInstance{
  private readonly lens:ShaderProgram
  private readonly upsample:ShaderProgram
  private readonly pass:FullscreenPass
  private texture:WebGLTexture|null=null
  private framebuffer:WebGLFramebuffer|null=null
  private width=0
  private height=0
  private disposed=false
  constructor(private readonly gl:WebGL2RenderingContext,effect:Readonly<Cinema2EffectManifest>){const label=`Cinema2/Effect/EventHorizonLensing/${effect.id}`;this.lens=createProgram(gl,`${label}/lens`,LENS_SOURCE,['u_source','u_depth','u_coreUv','u_coreDepth','u_strength','u_coreRadius','u_aspect','u_mix','u_primary','u_accent']);this.upsample=createProgram(gl,`${label}/composite`,UPSAMPLE_SOURCE,['u_source','u_texel']);this.pass=new FullscreenPass(gl)}
  render(context:Readonly<Cinema2EffectRenderExecutionContext>):void{
    if(this.disposed)return
    const depth=context.inputs.find(input=>input.attachment==='depth')??null,camera=context.camera
    if(!depth||!camera){this.copy(context);return}
    const scale=CINEMA2_EVENT_HORIZON_LENSING_RESOLUTION[context.quality],width=Math.max(1,Math.round(context.width*scale)),height=Math.max(1,Math.round(context.height*scale));this.ensureTarget(width,height)
    const matrix=camera.viewProjectionMatrix,aspect=context.width/Math.max(1,context.height),projection=projectCore(matrix,clamp(number(context.parameters,'coreRadius',.16),.06,.4)*3.3,aspect)
    const primary=color(context.parameters.primaryColor,[.05,.86,.95]),accent=color(context.parameters.accentColor,[1,.68,.22])
    const program=this.lens;program.activate();program.setVec2('u_coreUv',projection.x,projection.y);program.setFloat('u_coreDepth',projection.depth);program.setFloat('u_strength',clamp(number(context.parameters,'strength',.88),0,2.5));program.setFloat('u_coreRadius',projection.radius);program.setFloat('u_aspect',aspect);program.setFloat('u_mix',context.mix);program.setVec3('u_primary',...primary);program.setVec3('u_accent',...accent)
    this.pass.run(program,this.framebuffer,width,height,[{unit:0,texture:context.input.texture,uniformName:'u_source'},{unit:1,texture:depth.texture,uniformName:'u_depth'}])
    this.upsample.activate();this.upsample.setVec2('u_texel',1/width,1/height);this.pass.run(this.upsample,context.target,context.width,context.height,[{unit:0,texture:this.texture!,uniformName:'u_source'}]);assertCinema2NoGlErrors(this.gl,'Event Horizon lensing composite')
  }
  dispose():void{if(this.disposed)return;this.disposed=true;this.releaseTarget();this.pass.dispose();this.lens.dispose();this.upsample.dispose()}
  private copy(context:Readonly<Cinema2EffectRenderExecutionContext>):void{this.upsample.activate();this.upsample.setVec2('u_texel',1/context.width,1/context.height);this.pass.run(this.upsample,context.target,context.width,context.height,[{unit:0,texture:context.input.texture,uniformName:'u_source'}])}
  private ensureTarget(width:number,height:number):void{if(this.texture&&this.width===width&&this.height===height)return;this.releaseTarget();const {gl}=this,texture=gl.createTexture(),framebuffer=gl.createFramebuffer();if(!texture||!framebuffer)throw new Error('Event Horizon lensing could not allocate its quality-scaled target.');gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,width,height,0,gl.RGBA,gl.HALF_FLOAT,null);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Event Horizon lensing target is incomplete.');gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.texture=texture;this.framebuffer=framebuffer;this.width=width;this.height=height}
  private releaseTarget():void{if(this.texture)this.gl.deleteTexture(this.texture);if(this.framebuffer)this.gl.deleteFramebuffer(this.framebuffer);this.texture=null;this.framebuffer=null;this.width=0;this.height=0}
}

function createProgram(gl:WebGL2RenderingContext,label:string,fragSrc:string,requiredUniforms:string[]):ShaderProgram{const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label,vertSrc:FULLSCREEN_VERT_SRC,fragSrc,requiredUniforms});if(!result.program)throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`);return result.program}
function projectCore(matrix:readonly number[],worldRadius:number,aspect:number):Readonly<{x:number;y:number;depth:number;radius:number}>{const project=(x:number,y:number,z:number)=>{const w=matrix[3]! * x+matrix[7]! * y+matrix[11]! * z+matrix[15]!||1;return{x:(matrix[0]! * x+matrix[4]! * y+matrix[8]! * z+matrix[12]!)/w*.5+.5,y:(matrix[1]! * x+matrix[5]! * y+matrix[9]! * z+matrix[13]!)/w*.5+.5,depth:(matrix[2]! * x+matrix[6]! * y+matrix[10]! * z+matrix[14]!)/w*.5+.5}};const center=project(0,0,0),horizontal=project(worldRadius,0,0),vertical=project(0,worldRadius,0),dx=(horizontal.x-center.x)*aspect,dy=horizontal.y-center.y,vx=(vertical.x-center.x)*aspect,vy=vertical.y-center.y;return Object.freeze({...center,radius:Math.max(.001,Math.hypot(dx,dy),Math.hypot(vx,vy))})}

export const cinema2EventHorizonLensingEffectDefinition:Readonly<Cinema2EffectTypeDefinition>=Object.freeze({typeId:CINEMA2_EVENT_HORIZON_LENSING_EFFECT_TYPE_ID,version:CINEMA2_EVENT_HORIZON_LENSING_EFFECT_VERSION,label:'Event Horizon Lensing',validate:(effect:Readonly<Cinema2EffectManifest>)=>validateEffectParameters(effect,NUMERIC,['primaryColor','accentColor']),create:({gl,effect}:Readonly<Cinema2EffectCreateContext>)=>new EventHorizonLensingEffectInstance(gl,effect)})
