import { cinema2NamespacedId,cinema2StableId,cinema2Ref,type Cinema2PresetId,type Cinema2ModuleId,type Cinema2NativePresetManifest,type Cinema2ParameterManifest } from '../contracts/Cinema2NativePresetManifest'
import { SWITCH_IT_PHASE2_MANIFEST,switchItParameter } from './Cinema2SwitchItPhase2Preset'
import { cinema2SwitchItPhase3Module,SWITCH_IT_PHASE3_MODULE_TYPE } from '../modules/switchIt/Cinema2SwitchItPhase1Module'
import { SWITCH_IT_AUDIO_CHANNELS,switchItInitialAudioRules } from './Cinema2SwitchItAudioRoutes'
import { Cinema2ModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2PresetRegistry } from './Cinema2PresetRegistry'
export const SWITCH_IT_PHASE3_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.switch-it.phase3')
export const SWITCH_IT_PHASE3_MODULE_ID=cinema2StableId<Cinema2ModuleId>('switch-it-audio-study')
const response:Cinema2ParameterManifest={id:switchItParameter('response'),label:'Audio Response',type:'float',defaultValue:.8,min:0,max:1,step:.01,section:'Design',group:'Playback',designParentGroup:'master-controls',order:4,exposure:'primary',persistence:'preset',reset:'authored-default',modulatable:false,choreographable:false,automatable:false,description:'Amount of shared musical accents on facets, eyes and projection light. Zero restores the authored visual; colors, solid mask and camera remain yours.'}
const moduleId=SWITCH_IT_PHASE3_MODULE_ID
export const SWITCH_IT_PHASE3_MANIFEST:Cinema2NativePresetManifest={
 ...SWITCH_IT_PHASE2_MANIFEST,id:SWITCH_IT_PHASE3_ID,
 metadata:{name:'Switch It — Phase 3 Review',description:'Shared audio response checkpoint; not a released catalog preset.',tags:['internal','diagnostic']},
 capabilities:[...(SWITCH_IT_PHASE2_MANIFEST.capabilities??[]),...(['audio.bands','music.build','music.vocal-presence'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared facts for bounded presentation, without local musical detection.'}))],
 parameters:[...SWITCH_IT_PHASE2_MANIFEST.parameters!,response],
 modules:[{...SWITCH_IT_PHASE2_MANIFEST.modules![0],id:moduleId,typeId:SWITCH_IT_PHASE3_MODULE_TYPE,
  parameters:{...SWITCH_IT_PHASE2_MANIFEST.modules![0].parameters,...SWITCH_IT_AUDIO_CHANNELS,response:.8},
  parameterBindings:{...SWITCH_IT_PHASE2_MANIFEST.modules![0].parameterBindings,response:cinema2Ref(switchItParameter('response'))},
 }],
 scene:{nodes:[{...SWITCH_IT_PHASE2_MANIFEST.scene!.nodes[0],module:cinema2Ref(moduleId)}]},
 choreography:{rules:switchItInitialAudioRules(moduleId)},
}
export function createSwitchItPhase3Registries(){
 const presetRegistry=new Cinema2PresetRegistry(),moduleRegistry=new Cinema2ModuleRegistry()
 for(const result of[moduleRegistry.register(cinema2SwitchItPhase3Module),presetRegistry.register(SWITCH_IT_PHASE3_MANIFEST)])if(!result.ok)throw new Error(JSON.stringify(result.diagnostics))
 return{presetRegistry,moduleRegistry}
}
