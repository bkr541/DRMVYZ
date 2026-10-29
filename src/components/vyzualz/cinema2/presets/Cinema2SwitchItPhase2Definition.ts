import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2NamespacedId, cinema2StableId, cinema2Ref, type Cinema2NativePresetManifest, type Cinema2PresetId, type Cinema2ModuleId, type Cinema2ParameterId, type Cinema2ParameterManifest } from '../contracts/Cinema2NativePresetManifest'
import { SWITCH_IT_PHASE1_MANIFEST } from './Cinema2SwitchItPhase1Definition'
import { cinema2SwitchItPhase2Module, SWITCH_IT_PHASE2_MODULE_TYPE } from '../modules/switchIt/Cinema2SwitchItPhase1Module'
import { SWITCH_IT_PATTERNS, SWITCH_IT_VISUAL_DEFAULTS } from '../modules/switchIt/Cinema2SwitchItMotion'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

export const SWITCH_IT_PHASE2_ID=cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.switch-it.phase2')
export const switchItParameter=(name:string)=>cinema2StableId<Cinema2ParameterId>(`switch-it-${name.toLowerCase()}`)
const moduleId=cinema2StableId<Cinema2ModuleId>('switch-it-motion-study')
const base={section:'Design',exposure:'primary',persistence:'preset',reset:'authored-default',modulatable:false,choreographable:false,automatable:false} as const
const defaults=SWITCH_IT_VISUAL_DEFAULTS
const numeric=(name:string,label:string,value:number,min:number,max:number,parent:'master-controls'|'design'|'effects',group:string,order:number,description:string):Cinema2ParameterManifest=>({...base,id:switchItParameter(name),label,type:'float',defaultValue:value,min,max,step:max<=.12?.001:.01,designParentGroup:parent,group,order,description})
const toggle=(name:string,label:string,value:boolean,parent:'master-controls'|'design'|'effects',group:string,order:number,description:string):Cinema2ParameterManifest=>({...base,id:switchItParameter(name),label,type:'boolean',defaultValue:value,designParentGroup:parent,group,order,description})
const palette=(name:string,label:string,value:readonly number[],order:number,description:string):Cinema2ParameterManifest=>({...base,id:switchItParameter(name),label,type:'color',defaultValue:[...value,1],designParentGroup:'palette',group:'Colors',order,description})
const parameters: Cinema2ParameterManifest[]=[
  numeric('master','Master Intensity',1,0,1.5,'master-controls','Playback',1,'Scales the character, mask, eyes and projection column. Zero removes all subject light.'),
  numeric('speed','Motion Speed',1,0,2,'master-controls','Playback',2,'Rate of the authored cycle. Zero freezes its current pose; Split Portrait always holds its authored reveal.'),
  toggle('bpmSync','BPM Sync',true,'master-controls','Playback',3,'Four shared beats per cycle when both this toggle and host Sync BPM permit it. OFF or unavailable tempo uses a 2.25-second authored cycle.'),
  {...base,id:switchItParameter('pattern'),label:'Pattern',type:'enum',defaultValue:'switch-cycle',options:SWITCH_IT_PATTERNS,designParentGroup:'design',group:'Pattern',order:1,description:'Six native portrait programs; no camera or palette takeover.'},
  toggle('patternChange','Pattern Change',false,'design','Pattern',2,'Advances the runtime base on a fresh shared selected event. Manual Pattern edits remain authoritative until the next new event.'),
  {...base,id:switchItParameter('trigger'),label:'Trigger',type:'enum',defaultValue:'bar4',options:CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,designParentGroup:'design',group:'Pattern',order:3,visibleWhen:[{kind:'parameter-equals',parameterId:switchItParameter('patternChange'),value:true}],description:'Uses the existing canonical shared event contract. Unavailable musical facts cause no automatic change.'},
  numeric('portraitScale','Portrait Scale',1,.65,1.2,'design','Portrait',4,'Scales both registered subjects around the eye line. Narrow canvases fit the same portrait width; the camera stays fixed.'),
  {...numeric('reveal','Reveal Position',.5,0,1,'design','Portrait',5,'Split Portrait only: zero is human, halfway is the registered hybrid, one is the supplied mask.'),visibleWhen:[{kind:'parameter-equals',parameterId:switchItParameter('pattern'),value:'split-portrait'}]},
  numeric('relief','Facet Relief',0,0,.12,'design','Portrait',7,'Offsets human facets along their stable face normals. Zero preserves the approved intact bust.'),
  numeric('reach','Fragment Reach',defaults.reach,0,.8,'design','Fragments',8,'Maximum local lift of the seeded facets in Facet Peel and Crown Surge. Zero prevents detached geometry.'),
  numeric('eyeIntensity','Eye Intensity',1,0,2,'design','Lighting',9,'Brightness of the character’s eyes, visible through the open mask sockets.'),
  toggle('eyesEnabled','Eyes Enabled',true,'design','Lighting',10,'Enables the character’s eyes. The mask sockets remain open and contain no replacement eye disks.'),
  numeric('columnIntensity','Column Intensity',1,0,2,'design','Lighting',11,'Strength of the red projection mesh. Zero removes it in every program.'),
  numeric('fragmentAmount','Fragment Amount',1,0,1,'effects','Surface Accents',2,'Fraction of stable face identities permitted to lift. Zero retains reveal motion without detached facets.'),
  toggle('flareEnabled','Flare Enabled',false,'effects','Surface Accents',3,'Allows a brief face-local reconstruction accent in Switch Cycle and Crown Surge. OFF is hard.'),
  {...numeric('flareStrength','Flare Strength',defaults.flareStrength,0,1,'effects','Surface Accents',4,'Ceiling of the permitted face-local accent; cannot wash out the entire frame.'),visibleWhen:[{kind:'parameter-equals',parameterId:switchItParameter('flareEnabled'),value:true}]},
  palette('background','Background',[.001,.002,.005],1,'Independent background color; does not recolor the column.'),
  palette('shell','Human Shell',defaults.shell,2,'Base graphite/navy surface of the human triangles.'),
  palette('rim','Facet Rim',defaults.rim,3,'Independent pale facet-edge and facing-plane light.'),
  palette('skull','Skull Mask',defaults.skull,4,'Tint and restrained edge light of the supplied textured Demon Mask.'),
  palette('energy','Energy',defaults.energy,5,'Character eyes and the authorized local flare.'),
  palette('column','Projection Column',defaults.column,6,'Independent color of the projection mesh behind the mask.'),
  CINEMA2_QUALITY_MODE_PARAMETER,
]
const names=['master','speed','bpmSync','pattern','patternChange','trigger','portraitScale','reveal','relief','reach','eyeIntensity','eyesEnabled','columnIntensity','fragmentAmount','flareEnabled','flareStrength','background','shell','rim','skull','energy','column']
/** Private Phase 2 path; catalog release remains gated by later acceptance. */
export const SWITCH_IT_PHASE2_MANIFEST: Cinema2NativePresetManifest={
  ...SWITCH_IT_PHASE1_MANIFEST,id:SWITCH_IT_PHASE2_ID,
  metadata:{name:'Switch It — Phase 2 Review',description:'Native manual control and motion review; not a finished catalog preset.',tags:['internal','diagnostic']},
  capabilities:[...(SWITCH_IT_PHASE1_MANIFEST.capabilities??[]),...(['audio.features','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.drop'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared tempo and existing canonical event selection only; no musical accents.'}))],
  parameters,
  modules:[{id:moduleId,typeId:SWITCH_IT_PHASE2_MODULE_TYPE,version:1,enabled:true,
    parameters:Object.fromEntries(names.map(name=>[name,parameters.find(p=>p.id===switchItParameter(name))!.defaultValue!])),
    parameterBindings:Object.fromEntries(names.map(name=>[name,cinema2Ref(switchItParameter(name))])),
  }],
  scene:{nodes:[{...SWITCH_IT_PHASE1_MANIFEST.scene!.nodes[0],module:cinema2Ref(moduleId)}]},
  environment:{...SWITCH_IT_PHASE1_MANIFEST.environment,controls:{backgroundColor:cinema2Ref(switchItParameter('background'))}},
}
