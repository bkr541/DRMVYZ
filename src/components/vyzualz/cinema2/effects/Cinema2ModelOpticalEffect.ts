import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import { cinema2StableId, type Cinema2EffectTypeId, type Cinema2EffectManifest } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2EffectCreateContext, Cinema2EffectInstance, Cinema2EffectRenderExecutionContext, Cinema2EffectTypeDefinition } from './Cinema2EffectContracts'
import { clampEffectValue, readEffectNumber, validateEffectParameters, type Cinema2EffectNumericRange } from './Cinema2EffectParameterHelpers'

export const CINEMA2_MODEL_OPTICAL_EFFECT_ID = cinema2StableId<Cinema2EffectTypeId>('model-optical')
export const CINEMA2_MODEL_OPTICAL_RANGES: readonly Cinema2EffectNumericRange[] = [
  ['symmetry',0,1], ['segments',2,16], ['mirror',0,1], ['centerX',0,1], ['centerY',0,1], ['rotation',-180,180], ['zoom',.5,3], ['spin',-2,2],
  ['twist',-8,8], ['radius',.05,1.5], ['twistSpeed',-2,2], ['falloff',.25,4], ['melt',0,1], ['scale',1,20], ['flow',0,4], ['complexity',1,4], ['direction',-180,180], ['aberration',0,.04], ['aberrationDirection',-180,180], ['radialBias',0,1], ['edgeFalloff',.25,4],
]
export const CINEMA2_MODEL_OPTICAL_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform float u_mix, u_time, u_aspect, u_symmetry, u_segments, u_mirror, u_rotation, u_zoom, u_spin, u_twist, u_radius, u_twistSpeed, u_falloff, u_melt, u_scale, u_flow, u_complexity, u_direction, u_aberration, u_aberrationDirection, u_radialBias, u_edgeFalloff;
uniform vec2 u_center;
out vec4 outColor;
const float PI = 3.14159265359;
mat2 rot(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
vec2 uvOf(vec2 p){return p / vec2(u_aspect,1.) + u_center;}
vec4 sampleAt(vec2 uv){return texture(u_source,clamp(uv,vec2(0.),vec2(1.)));}
void main(){
 vec2 p=(v_uv-u_center)*vec2(u_aspect,1.); float r=length(p);
 float angle=u_twist*pow(max(0.,1.-r/u_radius),u_falloff)*(1.+.35*sin(u_time*u_twistSpeed));
 vec2 q=rot(angle)*p;
 if(u_melt>0.){
   vec2 flowDir=vec2(cos(u_direction),sin(u_direction)); vec2 n=vec2(0.); float f=u_scale, a=.055;
   for(int i=0;i<4;i++){if(float(i)>=u_complexity) break; n+=a*vec2(sin(q.y*f+u_time*u_flow+q.x*f*.5),cos(q.x*f-u_time*u_flow+q.y*f*.7)); f*=2.;a*=.48;}
   q+=u_melt*(n+flowDir*.035*sin(dot(q,flowDir)*u_scale-u_time*u_flow));
 }
 vec4 base=sampleAt(v_uv); vec2 uv=uvOf(q);
 vec2 direction=mix(vec2(cos(u_aberrationDirection),sin(u_aberrationDirection)),p/max(r,.0001),u_radialBias);
 vec2 offset=direction*u_aberration*pow(clamp(r*1.5,0.,1.),u_edgeFalloff)/vec2(u_aspect,1.);
 vec4 warped=sampleAt(uv); warped.rgb=vec3(sampleAt(uv+offset).r,warped.g,sampleAt(uv-offset).b);
 if(u_symmetry>0.){
   float sector=2.*PI/max(2.,floor(u_segments+.5)); float theta=(length(q) > .00001 ? atan(q.y,q.x) : 0.)+u_rotation+u_time*u_spin;
   float wedge=mod(theta,sector); wedge=mix(wedge,min(wedge,sector-wedge),u_mirror);
   vec2 sym=uvOf(vec2(cos(wedge),sin(wedge))*length(q)/u_zoom); vec4 mirrored=sampleAt(sym);
   mirrored.rgb=vec3(sampleAt(sym+offset).r,mirrored.g,sampleAt(sym-offset).b);
   warped=mix(warped,mirrored,u_symmetry);
 }
 outColor=mix(base,warped,u_mix);
}`
const defaults: Record<string, number> = { symmetry:0, segments:8, mirror:1, centerX:.5, centerY:.5, rotation:0, zoom:1, spin:0, twist:0, radius:.6, twistSpeed:0, falloff:2, melt:0, scale:5, flow:1, complexity:3, direction:0, aberration:0, aberrationDirection:0, radialBias:1, edgeFalloff:1 }
class ModelOpticalEffect implements Cinema2EffectInstance {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass
  constructor(private readonly gl: WebGL2RenderingContext) {
    const result = ShaderProgram.create(gl,new ShaderCompiler(gl),{ label:'Cinema2/ModelOptical',vertSrc:FULLSCREEN_VERT_SRC,fragSrc:CINEMA2_MODEL_OPTICAL_FRAGMENT,requiredUniforms:['u_source','u_mix','u_time','u_aspect','u_center',...CINEMA2_MODEL_OPTICAL_RANGES.filter(([key])=>!key.startsWith('center')).map(([key])=>`u_${key}`)] })
    if (!result.program) throw new Error(`Model optical shader: ${result.error.log}`)
    this.program=result.program; this.pass=new FullscreenPass(gl)
  }
  render(c: Readonly<Cinema2EffectRenderExecutionContext>): void {
    const gl=this.gl, p=this.program
    gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.DEPTH_TEST); gl.colorMask(true,true,true,true)
    p.activate(); p.setFloat('u_mix',c.mix); p.setFloat('u_time',c.frame.timestampMs/1000); p.setFloat('u_aspect',c.width/Math.max(1,c.height))
    const value=(key:string,min:number,max:number)=>clampEffectValue(readEffectNumber(c.parameters,key,defaults[key]),min,max)
    p.setVec2('u_center',value('centerX',0,1),value('centerY',0,1))
    for(const [key,min,max] of CINEMA2_MODEL_OPTICAL_RANGES){ if(key.startsWith('center'))continue; let v=value(key,min,max); if(c.parameters[`${key}Enabled`]===false)v=0; if(['direction','aberrationDirection','rotation'].includes(key))v*=Math.PI/180; if(key==='complexity' && c.quality==='low')v=Math.min(v,2); p.setFloat(`u_${key}`,v) }
    this.pass.run(p,c.target,c.width,c.height,[{unit:0,texture:c.input.texture,uniformName:'u_source'}])
  }
  dispose():void{this.pass.dispose();this.program.dispose()}
}
export const cinema2ModelOpticalEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({typeId:CINEMA2_MODEL_OPTICAL_EFFECT_ID,version:1,label:'Model optical effects',validate:(effect:Readonly<Cinema2EffectManifest>)=>validateEffectParameters(effect,CINEMA2_MODEL_OPTICAL_RANGES),create:({gl}:Readonly<Cinema2EffectCreateContext>)=>new ModelOpticalEffect(gl)})
