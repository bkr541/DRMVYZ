import { cinema2Ref, cinema2StableId, type Cinema2EffectId, type Cinema2EffectManifest, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2RenderPassId, type Cinema2RenderPassManifest, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2RenderTargetManifest, type Cinema2SceneNodeId, type Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_MODEL_LOOKS, CINEMA2_MODEL_MATERIAL_STYLES } from '../model/Cinema2ModelCinematicMaterials'
import { CINEMA2_MODEL_OPTICAL_EFFECT_ID, CINEMA2_MODEL_OPTICAL_RANGES } from '../effects/Cinema2ModelOpticalEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID } from '../effects/Cinema2BuiltinEffects'
import { CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID } from '../effects/Cinema2ReflectiveFloorEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'

type Id = (property: string) => Cinema2ParameterId
const title = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, s => s.toUpperCase())
const opticalDefaults: Record<string, number> = { symmetry:0, segments:8, mirror:1, centerX:.5, centerY:.5, rotation:0, zoom:1, spin:0, twist:0, radius:.6, twistSpeed:0, falloff:2, melt:0, scale:5, flow:1, complexity:3, direction:0, aberration:0, aberrationDirection:0, radialBias:1, edgeFalloff:1 }
const opticalProperty = (key: string) => `optical${key[0].toUpperCase()}${key.slice(1)}`
export function createCinema2ModelCinematicParameters(id: Id): Cinema2ParameterManifest[] {
  const parameters: Cinema2ParameterManifest[] = []
  const add = (key: string, label: string, type: Cinema2ParameterManifest['type'], defaultValue: Cinema2ParameterManifest['defaultValue'], group: string, extra: Partial<Cinema2ParameterManifest> = {}) => parameters.push({ id:id(key),label,type,defaultValue,section:'Design',designParentGroup:'effects',group,order:parameters.length,exposure:'primary',persistence:'preset',reset:'authored-default',modulatable:false,choreographable:false,automatable:false,...extra })
  const f = (key:string,label:string,v:number,min:number,max:number,group:string,step=.01,mod=true) => add(key,label,'float',v,group,{min,max,step,modulatable:mod,choreographable:mod})
  const b = (key:string,label:string,v:boolean,group:string) => add(key,label,'boolean',v,group)
  const e = (key:string,label:string,v:string,options:readonly string[],group:string) => add(key,label,'enum',v,group,{options:options.map(value=>({value,label:title(value)}))})
  const c = (key:string,label:string,v:[number,number,number,number],group:string) => add(key,label,'color',v,group,{designParentGroup:'palette'})
  const vec = (key:string,label:string,v:[number,number,number],group:string) => add(key,label,'vec3',v,group,{min:-10,max:10,step:.05})
  const m='Cinematic Materials', r='Fresnel Rim', l='Studio Lighting', a='Atmosphere', h='Helix Geometry', o='Optical FX', g='HDR Glow', t='Temporal Trails'
  const neutral: Record<string, Cinema2JsonValue> = { cinematicMaterial:'original',cinematicRim:0,cinematicRimColor:[0,.92,1,1],cinematicBaseColor:[1,1,1,1],cinematicEmissiveColor:[1,1,1,1],cinematicAmbientIntensity:.4,cinematicKeyIntensity:1.2,cinematicFillIntensity:.15,cinematicStageRimIntensity:.5,cinematicAccentIntensity:0,cinematicLightMotion:'static',cinematicFogDensity:.012,cinematicHaze:0,cinematicFloor:0,cinematicBloomEnabled:true,cinematicBloom:.5,cinematicBloomThreshold:1.05,cinematicBloomSpread:.45,cinematicExposure:1,cinematicFinish:1,cinematicOpticalEnabled:false,opticalSymmetry:0,opticalTwist:0,opticalMelt:0,opticalAberration:0,opticalSymmetryEnabled:true,opticalTwistEnabled:true,opticalMeltEnabled:true,opticalAberrationEnabled:true,opticalSpin:0,cinematicTrailsEnabled:false,cinematicHelix:false }
  const looks: Record<keyof typeof CINEMA2_MODEL_LOOKS,Record<string,Cinema2JsonValue>> = {
    manual:{}, darkStudio:{cinematicAmbientIntensity:.18,cinematicKeyIntensity:1.1,cinematicFillIntensity:.05,cinematicRim:.18,cinematicBloom:.2},
    blackChromeNeon:{cinematicAmbientIntensity:.08,cinematicKeyIntensity:1.6,cinematicFillIntensity:.08,cinematicAccentIntensity:5,cinematicLightMotion:'orbit',cinematicRim:2.2,cinematicBloom:1.2},
    goldReflection:{cinematicAmbientIntensity:.3,cinematicKeyIntensity:2,cinematicRim:.3,cinematicRimColor:[1,.64,.16,1],cinematicBloom:.35},
    glassEnergy:{cinematicAmbientIntensity:.15,cinematicRim:1.6,cinematicBloom:1,cinematicFloor:.3},
    electricHologram:{cinematicRim:2.5,cinematicBloom:1.4,cinematicHaze:.18,cinematicRimColor:[.25,.55,1,1]},
    cinematicAtmosphere:{cinematicRim:.7,cinematicHaze:.55,cinematicFloor:.45,cinematicAmbientIntensity:.12,cinematicRimColor:[.72,.2,1,1],cinematicBloom:.65},
    neonKaleidoscope:{cinematicRim:2.8,cinematicBloom:1.6,cinematicOpticalEnabled:true,opticalSymmetry:1,opticalSpin:.18,opticalTwist:1.2,opticalAberration:.006,cinematicTrailsEnabled:true,cinematicAccentIntensity:5},
  }
  const lookPatches = Object.fromEntries(Object.entries(looks).map(([key,values]) => [key, key === 'manual' ? {} : Object.fromEntries(Object.entries({...neutral, cinematicMaterial:CINEMA2_MODEL_LOOKS[key as keyof typeof CINEMA2_MODEL_LOOKS].style,...values}).map(([property,value])=>[id(property),value]))]))
  add('cinematicLook','Load Cinematic Look','enum','manual',m,{options:Object.keys(looks).map(value=>({value,label:title(value)})),metadata:{userEditSetParametersByValue:lookPatches},description:'Loads a saved combination of materials, lighting and effects; individual controls remain editable.'})
  e('cinematicMaterial','Material Style','original',CINEMA2_MODEL_MATERIAL_STYLES,m)
  c('cinematicBaseColor','Material Tint',[1,1,1,1],m); c('cinematicEmissiveColor','Emission Tint',[1,1,1,1],m)
  f('cinematicMetalness','Metalness Multiplier',1,0,2,m); f('cinematicRoughness','Roughness Multiplier',1,.1,4,m); f('cinematicOpacity','Surface Opacity',1,0,1,m); f('cinematicEmission','Emission Multiplier',1,0,4,m); f('cinematicReflection','Reflection Strength',1,0,4,m); f('cinematicIridescence','Iridescence',.8,0,1,m); f('cinematicTransmission','Physical Transmission',.5,0,1,m); f('cinematicClearcoat','Physical Clearcoat',.5,0,1,m); f('cinematicCoatRoughness','Coat Roughness',.2,0,1,m)
  c('cinematicRimColor','Fresnel Color',[0,.92,1,1],r); f('cinematicRim','Rim Brightness',0,0,4,r); f('cinematicRimWidth','Rim Width',1,.25,3,r); f('cinematicRimFalloff','View Angle Falloff',3,.5,10,r); f('cinematicRimBloom','Rim Energy',1,0,2,r)
  for (const [name, intensity, pos, color] of [ ['Ambient',.4,[0,0,0],[1,1,1,1]], ['Key',1.2,[3,6,4],[1,.96,.9,1]], ['Fill',.15,[-4,2,2],[.4,.35,1,1]], ['StageRim',.5,[-3,2,-3],[.15,.6,.8,1]], ['Accent',0,[2,1.5,-2],[0,.92,1,1]] ] as const) {
    f(`cinematic${name}Intensity`,`${title(name)} Intensity`,intensity,0,name==='Accent'?30:8,l)
    c(`cinematic${name}Color`,`${title(name)} Color`,[...color],l)
    if(name!=='Ambient')vec(`cinematic${name}Position`,`${title(name)} Position`,[...pos],l)
  }
  f('cinematicAccentRange','Accent Range',7,1,20,l); f('cinematicLightSpeed','Light Motion Speed',.5,0,3,l); e('cinematicLightMotion','Accent Motion','static',['static','orbit','sway'],l)
  c('cinematicFogColor','Haze Color',[.03,.05,.08,1],a); f('cinematicFogDensity','Depth Fog',.012,0,.16,a); f('cinematicHaze','Atmospheric Light',0,0,1,a); f('cinematicHazeDensity','Atmosphere Density',.015,0,.15,a); f('cinematicHazeDistance','Atmosphere Falloff Distance',12,1,50,a); f('cinematicHazeDrift','Atmosphere Drift',.15,0,2,a); f('cinematicFloor','Reflective Floor',0,0,1,a)
  b('cinematicHelix','Show Helix',false,h); f('cinematicHelixRadius','Radius',1.25,.2,3,h,.01,false); f('cinematicHelixTurns','Turns',3,1,12,h,.25,false); f('cinematicHelixSegments','Segments',192,32,512,h,1,false); f('cinematicHelixThickness','Thickness',.018,.005,.12,h,.001,false); f('cinematicHelixRotation','Rotation',0,-180,180,h,1); f('cinematicHelixEmission','Emission',3,0,8,h)
  b('cinematicBloomEnabled','Enable HDR Bloom',true,g); f('cinematicBloom','Bloom Intensity',.5,0,8,g); f('cinematicBloomThreshold','Threshold',1.05,0,8,g); f('cinematicBloomSpread','Glow Radius / Spread',.45,0,1,g); f('cinematicExposure','Final Exposure',1,.1,4,g); f('cinematicFinish','Tone Mapping Mix',1,0,1,g)
  b('cinematicOpticalEnabled','Enable Optical FX',false,o); f('cinematicOpticalMix','Optical Mix',1,0,1,o)
  const opticalGroups: Record<string,string> = {symmetry:'Symmetry',segments:'Symmetry',mirror:'Symmetry',rotation:'Symmetry',zoom:'Symmetry',spin:'Symmetry',twist:'Twist',radius:'Twist',twistSpeed:'Twist',falloff:'Twist',melt:'Melt',scale:'Melt',flow:'Melt',complexity:'Melt',direction:'Melt',aberration:'Chromatic Aberration',aberrationDirection:'Chromatic Aberration',radialBias:'Chromatic Aberration',edgeFalloff:'Chromatic Aberration'}
  for (const key of ['symmetry','twist','melt','aberration']) b(`${opticalProperty(key)}Enabled`, `Enable ${opticalGroups[key]}`, true, opticalGroups[key]!)
  for (const [key,min,max] of CINEMA2_MODEL_OPTICAL_RANGES) f(opticalProperty(key),title(key),opticalDefaults[key],min,max,opticalGroups[key] ?? o,key==='segments'||key==='complexity'?1:key==='aberration'?.001:.01)
  b('cinematicTrailsEnabled','Enable Trails',false,t); f('cinematicTrails','Trail Opacity',.65,0,1,t); f('cinematicTrailLength','Trail Length',.94,0,.995,t); f('cinematicTrailDecay','Decay Rate',1,.25,4,t); f('cinematicTrailMotion','Motion Sensitivity',.1,0,1,t); c('cinematicTrailColor','Trail Tint',[1,1,1,1],t)
  // Fixed graph: depth-dependent passes precede optical processing, and history is LDR.
  for (const definition of parameters) {
    if (definition.group === g && definition.id !== id('cinematicBloomEnabled') && definition.id !== id('cinematicExposure') && definition.id !== id('cinematicFinish')) definition.visibleWhen = [{kind:'parameter-equals',parameterId:id('cinematicBloomEnabled'),value:true}]
    if (definition.group === t && definition.id !== id('cinematicTrailsEnabled') && definition.designParentGroup === 'effects') definition.visibleWhen = [{kind:'parameter-equals',parameterId:id('cinematicTrailsEnabled'),value:true}]
    if ([o,...Object.values(opticalGroups)].includes(definition.group ?? '') && definition.id !== id('cinematicOpticalEnabled')) definition.visibleWhen = [{kind:'parameter-equals',parameterId:id('cinematicOpticalEnabled'),value:true}]
    if (definition.id === id('cinematicOpticalEnabled')) definition.description = 'Fixed order: reflective floor, atmosphere, bloom, optical operations, tone mapping, feedback. Disable a pass to bypass it; arbitrary reordering is not supported.'
  }
  return parameters
}

export function createCinema2ModelCinematicGraph(prefix:string, id:Id, root:Cinema2SceneNodeId): Pick<Cinema2NativePresetManifest,'effects'|'render'|'output'> {
  const passId=(name:string)=>cinema2StableId<Cinema2RenderPassId>(`${prefix}-${name}`), targetId=(name:string)=>cinema2StableId<Cinema2RenderTargetId>(`${prefix}-${name}-target`), slot=(name:string)=>cinema2StableId<Cinema2RenderSlotId>(`${prefix}-${name}`)
  const scenePass=passId('pass'), sceneTarget=cinema2StableId<Cinema2RenderTargetId>(`${prefix}-target`), sceneColor=slot('color'), sceneDepth=slot('depth')
  const targets:Cinema2RenderTargetManifest[]=[{id:sceneTarget,descriptor:{size:{kind:'viewport'},colorFormat:'rgba16f',fallbackColorFormat:'rgba8',depthFormat:'depth24'},ownership:'transient'}]
  const passes:Cinema2RenderPassManifest[]=[{id:scenePass,kind:'scene',scene:cinema2Ref(root),outputs:[{id:sceneColor,target:cinema2Ref(sceneTarget),attachment:'color'},{id:sceneDepth,target:cinema2Ref(sceneTarget),attachment:'depth'}]}]
  const effects:Cinema2EffectManifest[]=[]
  let previousPass=scenePass, previousColor=sceneColor
  const append=(name:string,typeId:Cinema2EffectManifest['typeId'],parameters:Record<string,Cinema2JsonValue>,bindings:Record<string,string>,depth=false,ldr=false)=>{
    const effect=cinema2StableId<Cinema2EffectId>(`${prefix}-${name}-effect`), pass=passId(`${name}-pass`), target=targetId(name), color=slot(`${name}-color`)
    effects.push({id:effect,typeId,version:1,enabled:true,scope:'output',order:effects.length,parameters,parameterBindings:Object.fromEntries(Object.entries(bindings).map(([property,key])=>[property,cinema2Ref(id(key))]))})
    targets.push({id:target,descriptor:{size:{kind:'viewport'},colorFormat:ldr?'rgba8':'rgba16f',...(!ldr?{fallbackColorFormat:'rgba8' as const}:{})},ownership:'transient'})
    passes.push({id:pass,kind:'fullscreen',effect:cinema2Ref(effect),dependsOn:[cinema2Ref(previousPass)],inputs:[{id:slot(`${name}-source`),source:{pass:cinema2Ref(previousPass),output:previousColor},attachment:'color'},...(depth?[{id:slot(`${name}-depth`),source:{pass:cinema2Ref(scenePass),output:sceneDepth},attachment:'depth' as const}]:[])],outputs:[{id:color,target:cinema2Ref(target),attachment:'color'}]})
    previousPass=pass;previousColor=color
  }
  append('floor',CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID,{mix:0,floorY:0,reflectivity:.65,roughness:.25,fresnel:2.4,baseColor:[.012,.016,.024,1],skyColor:[.012,.016,.024,1],maxReflection:12,fadeDistance:15},{mix:'cinematicFloor'},true)
  append('atmosphere',CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,{mix:0,density:.015,beamIntensity:.4,ambientHaze:.2,hazeColor:[.03,.05,.08,1],maxDistance:12,noiseScale:.6,noiseStrength:.35,drift:.15,reactivity:0},{mix:'cinematicHaze',density:'cinematicHazeDensity',hazeColor:'cinematicFogColor',maxDistance:'cinematicHazeDistance',drift:'cinematicHazeDrift'},true)
  append('bloom',CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,{mix:1,threshold:1.05,knee:.25,intensity:.5,spread:.45,levels:5,clampMax:16},{enabled:'cinematicBloomEnabled',threshold:'cinematicBloomThreshold',intensity:'cinematicBloom',spread:'cinematicBloomSpread'})
  append('optical',CINEMA2_MODEL_OPTICAL_EFFECT_ID,{mix:1,...opticalDefaults,symmetryEnabled:true,twistEnabled:true,meltEnabled:true,aberrationEnabled:true},{enabled:'cinematicOpticalEnabled',mix:'cinematicOpticalMix',...Object.fromEntries(Object.keys(opticalDefaults).map(key=>[key,opticalProperty(key)])),...Object.fromEntries(['symmetry','twist','melt','aberration'].map(key=>[`${key}Enabled`,`${opticalProperty(key)}Enabled`]))})
  append('finish',CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,{mix:1,toneMap:1,exposure:1,contrast:1,saturation:1,vignette:0,grain:0,aberration:0},{mix:'cinematicFinish',exposure:'cinematicExposure'},false,true)
  append('trails',CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID,{mix:.65,persistence:.94,drift:0,cinematic:true,decay:1,motionSensitivity:.1,trailColor:[1,1,1,1]},{enabled:'cinematicTrailsEnabled',mix:'cinematicTrails',persistence:'cinematicTrailLength',decay:'cinematicTrailDecay',motionSensitivity:'cinematicTrailMotion',trailColor:'cinematicTrailColor'},false,true)
  const output=passId('output'); passes.push({id:output,kind:'output',inputs:[{id:slot('input'),source:{pass:cinema2Ref(previousPass),output:previousColor},attachment:'color'}]})
  return {effects,render:{targets,passes,outputPass:cinema2Ref(output)},output:{renderPass:cinema2Ref(output),colorSpace:'srgb',alphaMode:'opaque'}}
}
