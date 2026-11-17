import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import { cinema2NamespacedId,cinema2StableId,cinema2Ref,type Cinema2PresetId,type Cinema2ModuleId,type Cinema2NativePresetManifest,type Cinema2ParameterManifest,type Cinema2RenderTargetId,type Cinema2RenderPassId,type Cinema2RenderSlotId,type Cinema2EffectId,type Cinema2ChoreographyRuleId,type Cinema2ChoreographyActionId } from '../contracts/Cinema2NativePresetManifest'
import { SWITCH_IT_PHASE2_MANIFEST,switchItParameter } from './Cinema2SwitchItPhase2Definition'
import { SWITCH_IT_MODULE_TYPE } from '../modules/switchIt/Cinema2SwitchItPhase1Module'
import { SWITCH_IT_AUDIO_CHANNELS,switchItInitialAudioRules } from './Cinema2SwitchItAudioRoutes'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
export const CINEMA2_SWITCH_IT_PRESET_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.switch-it')
export const SWITCH_IT_MODULE_ID=cinema2StableId<Cinema2ModuleId>('switch-it-world')
const moduleId=SWITCH_IT_MODULE_ID
const numeric=(name:string,label:string,value:number,min:number,max:number,parent:'master-controls'|'effects',order:number,description:string):Cinema2ParameterManifest=>({id:switchItParameter(name),label,type:'float',defaultValue:value,min,max,step:.01,section:'Design',designParentGroup:parent,group:parent==='effects'?'Finishing':'Playback',order,description,exposure:'primary',persistence:'preset',reset:'authored-default',modulatable:false,choreographable:false,automatable:false})
const response=numeric('response','Audio Response',.8,0,1,'master-controls',4,'Bounded shared musical accents. Zero restores authored geometry and lighting; colors, mask surface and framing remain yours.')
const director=numeric('directorStrength','Director Influence',.35,0,1,'master-controls',5,'Allows bounded macro tension and impact emphasis inside your geometry and effect limits. Does not choose patterns or change colors/camera.')
const auto:Cinema2ParameterManifest={...response,id:switchItParameter('autoPerformance'),label:'Auto Performance',type:'boolean',defaultValue:false,min:undefined,max:undefined,step:undefined,order:6,description:'Allows temporary build/drop performance families while the underlying Pattern Change sequence continues. A reveal edit turns this OFF.'}
const bloom=numeric('bloom','Bloom',0,0,.6,'effects',5,'Contained light-source glow. Zero bypasses it and preserves the approved solid-mask look.')
const flecks=numeric('flecks','Local Flecks',0,0,1,'effects',6,'Optional face-local flecks during peel/crown/audio gestures, bounded by Fragment Reach and Fragment Amount. Zero removes them.')
const parameters=[...SWITCH_IT_PHASE2_MANIFEST.parameters!.map(p=>p.id===switchItParameter('reveal')?{...p,metadata:{...p.metadata,userEditSetParameters:{[switchItParameter('autoPerformance')]:false}}}:p),response,director,auto,bloom,flecks]
const directorRoutes=[['directorIntensity','director.intensity',200],['directorMomentum','director.momentum',240],['directorBuild','director.build',240]] as const
const effect=cinema2StableId<Cinema2EffectId>('switch-it-bloom')
const outputTarget=cinema2StableId<Cinema2RenderTargetId>('switch-it-bloom-target'),outputPass=cinema2StableId<Cinema2RenderPassId>('switch-it-bloom-pass'),input=cinema2StableId<Cinema2RenderSlotId>('switch-it-bloom-input')
const scenePass=SWITCH_IT_PHASE2_MANIFEST.render!.passes[0]
const CINEMA2_SWITCH_IT_AUTHORED_PRESET_MANIFEST:Cinema2NativePresetManifest={
 ...SWITCH_IT_PHASE2_MANIFEST,id:CINEMA2_SWITCH_IT_PRESET_ID,
 metadata:{name:'Switch It',description:'A faceted portrait beneath a solid horned mask, with six native reveal programs and bounded musical performance.',author:'DRMVYZ; Demon Mask by egorova.e (CC BY 4.0)',tags:['3d','portrait','switch-it','keeper']},
 capabilities:[...SWITCH_IT_PHASE2_MANIFEST.capabilities!,...(['audio.bands','music.build','music.vocal-presence','visual-director.significance'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared intelligence inside explicit user permissions.'}))],
 parameters,
 modules:[{...SWITCH_IT_PHASE2_MANIFEST.modules![0],id:moduleId,typeId:SWITCH_IT_MODULE_TYPE,
  parameters:{...SWITCH_IT_PHASE2_MANIFEST.modules![0].parameters,...SWITCH_IT_AUDIO_CHANNELS,response:.8,directorStrength:.35,autoPerformance:false,flecks:0,directorIntensity:0,directorMomentum:0,directorBuild:0,directorAccent:0},
  parameterBindings:{...SWITCH_IT_PHASE2_MANIFEST.modules![0].parameterBindings,response:cinema2Ref(response.id),directorStrength:cinema2Ref(director.id),autoPerformance:cinema2Ref(auto.id),flecks:cinema2Ref(flecks.id)},
 }],
 scene:{nodes:[{...SWITCH_IT_PHASE2_MANIFEST.scene!.nodes[0],module:cinema2Ref(moduleId)}]},
 choreography:{rules:[...switchItInitialAudioRules(moduleId),
  ...directorRoutes.map(([property,path,smoothingMs],i)=>({id:cinema2StableId<Cinema2ChoreographyRuleId>(`switch-it-${property.toLowerCase()}-route`),priority:50+i,source:{signal:'continuous' as const,path,capability:'visual-director.significance' as const,smoothingMs,clamp:[0,1] as const},actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`switch-it-${property.toLowerCase()}-map`),target:{kind:'module' as const,ref:cinema2Ref(moduleId),property},operation:'replace' as const}]})),
  {id:cinema2StableId('switch-it-director-impact-route'),priority:55,source:{signal:'continuous',path:'director.impact',capability:'visual-director.significance',threshold:.45},conditions:[{kind:'confidence',min:.45}],actions:[{id:cinema2StableId('switch-it-director-impact-envelope'),target:{kind:'module',ref:cinema2Ref(moduleId),property:'directorAccent'},operation:'envelope',composition:'add',value:1,envelope:{attack:.025,hold:.02,release:.45,unit:'seconds'},retrigger:'restart'}]},
 ]},
 effects:[{id:effect,typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,enabled:true,order:0,scope:'output',parameters:{mix:1,intensity:0,threshold:.75,knee:.15,spread:.2,levels:3,clampMax:3},parameterBindings:{intensity:cinema2Ref(bloom.id)}}],
 render:{targets:[...(SWITCH_IT_PHASE2_MANIFEST.render!.targets??[]),{id:outputTarget,ownership:'transient',descriptor:{size:{kind:'viewport'},colorFormat:'rgba8'}}],passes:[scenePass,{id:outputPass,kind:'fullscreen',dependsOn:[cinema2Ref(scenePass.id)],effect:cinema2Ref(effect),inputs:[{id:input,source:{pass:cinema2Ref(scenePass.id),output:scenePass.outputs![0].id},attachment:'color'}],outputs:[{id:cinema2StableId<Cinema2RenderSlotId>('switch-it-final-color'),target:cinema2Ref(outputTarget),attachment:'color'}]}],outputPass:cinema2Ref(outputPass)},
 output:{...SWITCH_IT_PHASE2_MANIFEST.output!,renderPass:cinema2Ref(outputPass)},
}

const moduleTarget=(property:string)=>cinema2AutoTargets.module(SWITCH_IT_MODULE_ID as string,property)
/**
 * Switch It with the shared Mood Conductor and Auto Performance. With Auto Performance on, the passage's mood moves the portrait around its authored
 * values and the music chooses Pattern Change and the Trigger. Master Intensity, Motion Speed and the Column and Eye Intensity follow how active
 * the passage is and flare on a drop; the fragments reach further on a peak and a drop; Fragment Amount only comes down (it is at its maximum by
 * default); Bloom, Local Flecks and Facet Relief open on a peak, a drop or tension. Reveal Position, Portrait Scale, the eye and flare switches and
 * every color stay the user's, and Audio Response scales every drive (zero silences them).
 */
export const CINEMA2_SWITCH_IT_PRESET_MANIFEST:Cinema2NativePresetManifest=withCinema2MoodDrives(CINEMA2_SWITCH_IT_AUTHORED_PRESET_MANIFEST,{
  idPrefix:'switch-it-auto',
  enabledParameter:auto.id,
  strengthParameter:response.id,
  patternControls:{patternChange:switchItParameter('patternchange'),trigger:switchItParameter('trigger')},
  drives:[
    {id:'master-activity',target:moduleTarget('master'),source:'mood.activity',operation:'add',value:.12},
    {id:'master-calm',target:moduleTarget('master'),source:'mood.calm',operation:'add',value:-.1},
    {id:'master-shock',target:moduleTarget('master'),source:'mood.shock',operation:'add',value:.2},
    {id:'speed-activity',target:moduleTarget('speed'),source:'mood.activity',operation:'add',value:.2},
    {id:'speed-calm',target:moduleTarget('speed'),source:'mood.calm',operation:'add',value:-.15},
    {id:'reach-peak',target:moduleTarget('reach'),source:'mood.peak',operation:'add',value:.2},
    {id:'reach-shock',target:moduleTarget('reach'),source:'mood.shock',operation:'add',value:.15},
    {id:'eyes-peak',target:moduleTarget('eyeIntensity'),source:'mood.peak',operation:'add',value:.3},
    {id:'eyes-shock',target:moduleTarget('eyeIntensity'),source:'mood.shock',operation:'add',value:.4},
    {id:'eyes-calm',target:moduleTarget('eyeIntensity'),source:'mood.calm',operation:'add',value:-.2},
    {id:'column-activity',target:moduleTarget('columnIntensity'),source:'mood.activity',operation:'add',value:.25},
    {id:'column-shock',target:moduleTarget('columnIntensity'),source:'mood.shock',operation:'add',value:.3},
    {id:'amount-calm',target:moduleTarget('fragmentAmount'),source:'mood.calm',operation:'add',value:-.15},
    {id:'relief-tense',target:moduleTarget('relief'),source:'mood.tense',operation:'add',value:.04},
    {id:'bloom-peak',target:cinema2AutoTargets.effect('switch-it-bloom','intensity'),source:'mood.peak',operation:'add',value:.1},
    {id:'bloom-shock',target:cinema2AutoTargets.effect('switch-it-bloom','intensity'),source:'mood.shock',operation:'add',value:.25},
    {id:'flecks-peak',target:moduleTarget('flecks'),source:'mood.peak',operation:'add',value:.2},
  ],
})
