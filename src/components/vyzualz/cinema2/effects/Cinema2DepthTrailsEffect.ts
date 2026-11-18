import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import { cinema2StableId, type Cinema2EffectTypeId, type Cinema2EffectId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2EffectCreateContext, Cinema2EffectRenderExecutionContext, Cinema2EffectTypeDefinition } from './Cinema2EffectContracts'
import { assertCinema2NoGlErrors } from '../runtime/Cinema2GpuValidation'

/** Depth-masked background persistence: opaque hero pixels are never stored in history. */
const fragment=`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_history;
uniform sampler2D u_depth;
uniform float u_mix;
uniform float u_valid;
uniform float u_retention;
uniform float u_store;
out vec4 outColor;
void main(){
 vec4 base=texture(u_source,v_uv);
 if(texture(u_depth,v_uv).r<.99999){outColor=u_store>.5?vec4(0.):base;return;}
 vec4 old=texture(u_history,v_uv);
 vec3 echo=max(base.rgb,old.rgb*u_retention);
 outColor=vec4(mix(base.rgb,echo,u_mix*u_valid*old.a),base.a);
}`
export const CINEMA2_DEPTH_TRAILS_EFFECT_TYPE_ID=cinema2StableId<Cinema2EffectTypeId>('depth-trails')
export const cinema2DepthTrailsEffectDefinition: Readonly<Cinema2EffectTypeDefinition>={
 typeId:CINEMA2_DEPTH_TRAILS_EFFECT_TYPE_ID,version:1,label:'Depth-masked background trails',
 create(context:Cinema2EffectCreateContext){
  const {gl}=context,result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/DepthTrails',vertSrc:FULLSCREEN_VERT_SRC,fragSrc:fragment,requiredUniforms:['u_source','u_history','u_depth','u_mix','u_valid','u_retention','u_store']})
  if(!result.program)throw new Error('Depth trails shader failed')
  const program=result.program,pass=new FullscreenPass(gl),name=`effect.${context.effect.id as Cinema2EffectId}.depth-trails`
  return {
   render(frame:Readonly<Cinema2EffectRenderExecutionContext>){
    const depth=frame.inputs.find(i=>i.attachment==='depth'),active=frame.mix>0&&!!depth&&!frame.frame.transport?.paused&&frame.frame.transport?.sourcePresent!==false
    gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.SCISSOR_TEST);gl.colorMask(true,true,true,true)
    program.activate();program.setFloat('u_mix',active?frame.mix:0);program.setFloat('u_retention',Math.pow(.86,Math.min(.1,Math.max(0,frame.frame.deltaTimeSec))*60))
    if(!active){const old=context.history.getSnapshot().buffers.find(b=>b.name===name);if(old?.valid)context.history.resetBuffer(name,'deactivation')}
    const history=active?context.history.beginFrame(name,frame.width,frame.height):null
    program.setFloat('u_valid',history?.valid?1:0)
    const textures=[{unit:0,texture:frame.input.texture,uniformName:'u_source'},{unit:1,texture:history?.read.colorTexture??frame.input.texture,uniformName:'u_history'},{unit:2,texture:depth?.texture??frame.input.texture,uniformName:'u_depth'}]
    program.setFloat('u_store',0);pass.run(program,frame.target,frame.width,frame.height,textures)
    if(history){program.setFloat('u_store',1);pass.run(program,history.write.framebuffer,frame.width,frame.height,textures);context.history.commit(name)}
    assertCinema2NoGlErrors(gl,'Depth-masked trails')
   },
   dispose(){context.history.releaseBuffer(name);pass.dispose();program.dispose()},
  }
 },
}
