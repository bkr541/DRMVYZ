import {
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath,
  type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2DesignParentGroup,
  type Cinema2EffectId, type Cinema2MediaSlotId, type Cinema2NativePresetManifest, type Cinema2ParameterId,
  type Cinema2ParameterManifest, type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_EVERYWHERE_MODULE_TYPE_ID } from '../modules/Cinema2EverywhereNativeModule'
import { EVERYWHERE_COLORS, EVERYWHERE_PATTERNS } from '../modules/everywhere/Cinema2EverywhereWall'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { CINEMA2_CORRIDOR_PRESET_MANIFEST } from './Cinema2CorridorPreset'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_EVERYWHERE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.everywhere')
export const CINEMA2_EVERYWHERE_MEDIA_SLOT = cinema2StableId<Cinema2MediaSlotId>('everywhere-screen-media')
const id = (name: string) => cinema2StableId<Cinema2ParameterId>(`everywhere-${name}`)
const ref = (name: string) => cinema2Ref(id(name))
const auto = ref('auto-performance')
const bloom = cinema2StableId<Cinema2EffectId>('everywhere-bloom')

const template = JSON.parse(JSON.stringify(CINEMA2_CORRIDOR_PRESET_MANIFEST)
  .replaceAll('corridor','everywhere').replaceAll('Corridor','EVERYWHERE')) as Cinema2NativePresetManifest
const moduleId = template.modules![0]!.id

const base = (name: string,label: string,parent: Cinema2DesignParentGroup,group: string,order: number,description: string) => ({
  id:id(name),label,description,section:'Design' as const,designParentGroup:parent,group,order,
  exposure:'primary' as const,persistence:'preset' as const,reset:'authored-default' as const,
})
const slider = (name: string,label: string,parent: Cinema2DesignParentGroup,group: string,order: number,value: number,min: number,max: number,description: string):Cinema2ParameterManifest=>({
  ...base(name,label,parent,group,order,description),type:'float',defaultValue:value,min,max,step:.01,modulatable:true,choreographable:true,
})
const swatch = (name: keyof typeof EVERYWHERE_COLORS,label: string,order: number,description: string):Cinema2ParameterManifest=>({
  ...base(name,label,'palette','Wall Colors',order,description),type:'color',defaultValue:EVERYWHERE_COLORS[name],
})
const parameters: readonly Cinema2ParameterManifest[] = [
  CINEMA2_QUALITY_MODE_PARAMETER,
  slider('motion','Motion Amount','master-controls','Playback',1,.72,0,1,'Controls screen timing, wall movement and musical accents.'),
  {...base('bpm-sync','BPM Sync','master-controls','Playback',2,'Locks the screen program to the shared track tempo when Audio Dock sync is on.'),type:'boolean',defaultValue:true},
  {...base('auto-performance','Auto Performance','master-controls','Playback',3,'Lets the music drive the wall and follows System Settings on preset load.'),type:'boolean',defaultValue:false},
  slider('brightness','Screen Brightness','design','Cabinets',1,1.06,0,1.8,'Exposure of pictures on the CRT screens.'),
  slider('coverage','Screen Coverage','design','Cabinets',2,.86,.18,1,'Adjusts how many surrounding screens stay fully lit.'),
  slider('angle','Cabinet Angle','design','Cabinets',3,.84,0,1.25,'Sets how much the surrounding cabinets tilt and turn.'),
  {...base('pattern','Pattern','design','Pattern',1,'Choose a screen program for the whole wall.'),type:'enum',defaultValue:'all-eyes',options:EVERYWHERE_PATTERNS},
  {...base('pattern-change','Pattern Change','design','Pattern',2,'Advance the pattern on the selected shared musical event.'),type:'boolean',defaultValue:false},
  {...base('trigger','Trigger','design','Pattern',3,'Choose the musical event that advances the pattern.'),type:'enum',defaultValue:'bar4',
    options:CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,visibleWhen:[{kind:'parameter-equals',parameterId:id('pattern-change'),value:true}]},
  {...base('screen-media','Screen Media','design','Screen Media',1,'Select a feed in the Source tab’s Media Library.'),type:'media',defaultValue:null,mediaSlot:cinema2Ref(CINEMA2_EVERYWHERE_MEDIA_SLOT)},
  {...base('media-layout','Media Layout','design','Screen Media',2,'Repeat the same picture on each television or spread it across the whole wall.'),type:'enum',
    defaultValue:'repeat',options:[{value:'repeat',label:'Repeat on each screen'},{value:'wall',label:'Span the wall'}]},
  slider('bloom','Bloom','effects','CRT Finish',1,.34,0,1.2,'Optical glow around the brightest screen and cabinet highlights.'),
  slider('scan','Scanlines','effects','CRT Finish',2,.20,0,1,'Strength of the fine CRT raster.'),
  slider('glare','Glass Glare','effects','CRT Finish',3,.65,0,1,'Intensity of the glass reflection and recessed lip highlights.'),
  swatch('background','Background',1,'Dark background visible in gaps between the cabinets.'),
  swatch('cabinet','Cabinet',2,'Base color of the molded television cases.'),
  swatch('cool','Cool Rim',3,'Color of the light along the left edges.'),
  swatch('warm','Warm Rim',4,'Color of the warm light along the opposite edges.'),
  swatch('screen','Screen Tint',5,'Color balance of the default and assigned screen feeds.'),
]
const bindings = {
  motion:ref('motion'), bpmSync:ref('bpm-sync'), autoPerformance:auto, brightness:ref('brightness'),
  coverage:ref('coverage'), angle:ref('angle'), pattern:ref('pattern'), patternChange:ref('pattern-change'),
  trigger:ref('trigger'), mediaLayout:ref('media-layout'), scan:ref('scan'), glare:ref('glare'),
  background:ref('background'),cabinet:ref('cabinet'),cool:ref('cool'),warm:ref('warm'),screen:ref('screen'),
}
const defaults=Object.fromEntries(Object.entries(bindings).map(([key,binding])=>[key,parameters.find(parameter=>parameter.id===binding.$ref)!.defaultValue]))
const ruleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`everywhere-${name}`)
const actionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`everywhere-${name}`)
const route = (name: string,path: Cinema2ChoreographyContinuousSourcePath,capability: 'audio.features'|'audio.bands'|'visual-director.significance',smoothingMs: number):Cinema2ChoreographyRuleManifest=>({
  id:ruleId(name),priority:15,enabledParameter:auto,source:{signal:'continuous',path,capability,clamp:[0,1],smoothingMs},
  conditions:[{kind:'not-silent'}],actions:[{id:actionId(`read-${name}`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'replace'}],
})
const event = (name: 'kick'|'snare'|'drop',hold: number,release: number):Cinema2ChoreographyRuleManifest=>({
  id:ruleId(name),priority:35,enabledParameter:auto,source:{signal:name,capability:name==='drop'?'music.drop':'music.rhythm-events'},
  conditions:[{kind:'once-per-event'},...(name==='drop'?[]:[{kind:'not-silent' as const}])],
  actions:[{id:actionId(`pulse-${name}`),target:{kind:'module',ref:cinema2Ref(moduleId),property:name},operation:'envelope',
    value:1,envelope:{attack:.016,hold,release,unit:'seconds'},retrigger:'restart'}],
})

const manifest: Cinema2NativePresetManifest = {
  ...template,id:CINEMA2_EVERYWHERE_PRESET_ID,revision:1,
  metadata:{name:'EVERYWHERE',author:'STAGELESS',category:'Architecture',
    description:'An edge-to-edge wall of modeled CRTs with an eye feed, replaceable user media and six musical screen programs.',
    tags:['3d','televisions','media-wall','screens','audio-reactive']},
  capabilities:[
    ...template.capabilities!,
    ...(['media.image','media.video','media.svg'] as const).map(media=>({id:media,requirement:'optional' as const,purpose:'Shared Image, Video and SVG Media Library assignment.'})),
  ],
  parameters,
  mediaSlots:[{id:CINEMA2_EVERYWHERE_MEDIA_SLOT,label:'Screen Media',accepts:['image','video','svg']}],
  modules:[{id:moduleId,typeId:CINEMA2_EVERYWHERE_MODULE_TYPE_ID,version:1,
    parameters:{...defaults,energy:0,bass:0,high:0,vocal:0,build:0,kick:0,snare:0,drop:0},
    parameterBindings:bindings,media:{screenMedia:cinema2Ref(CINEMA2_EVERYWHERE_MEDIA_SLOT)},
  }],
  cameras:template.cameras!.map(camera=>({...camera,label:'Front Wall',fovDegrees:40,minAspect:1.50,near:.2,far:40,
    transform:{position:[0,0,10.8]},rig:{kind:'static'}})),
  scene:{...template.scene!,nodes:template.scene!.nodes.map(node=>node.id==='everywhere-aim'
    ? {...node,transform:{position:[0,0,0]}}
    : node)},
  environment:{backgroundColor:EVERYWHERE_COLORS.background,exposure:1,controls:{backgroundColor:ref('background')}},
  effects:template.effects!.map(effect=>effect.id===bloom ? {...effect,parameterBindings:{intensity:ref('bloom')},
    parameters:{...effect.parameters,threshold:1.25,intensity:.34,spread:.32,tint:[1,.91,.81,1]}}
    : {...effect,parameters:{...effect.parameters,mix:.46,exposure:1.02,contrast:1.08,vignette:.22}}),
  choreography:{tempoSyncParameter:ref('bpm-sync'),rules:[
    route('energy','audio.features.overallEnergy','audio.features',145),
    route('bass','audio.bands.bass','audio.bands',95),
    route('high','audio.bands.high','audio.bands',70),
    route('vocal','audio.features.vocalPresence','audio.features',207),
    route('build','director.build','visual-director.significance',140),
    event('kick',.04,.24),event('snare',.018,.21),event('drop',.17,1.02),
  ]},
}

export const CINEMA2_EVERYWHERE_PRESET_MANIFEST = withCinema2MoodDrives(manifest,{
  idPrefix:'everywhere-auto',enabledParameter:id('auto-performance'),strengthParameter:id('motion'),
  patternControls:{patternChange:id('pattern-change'),trigger:id('trigger')},
  drives:[
    {id:'coverage-activity',target:cinema2AutoTargets.module(moduleId,'coverage'),source:'mood.activity',operation:'add',value:.18},
    {id:'coverage-silence',target:cinema2AutoTargets.module(moduleId,'coverage'),source:'mood.silence',operation:'add',value:-.47},
    {id:'brightness-activity',target:cinema2AutoTargets.module(moduleId,'brightness'),source:'mood.activity',operation:'add',value:.20},
    {id:'bloom-peak',target:cinema2AutoTargets.effect(bloom,'intensity'),source:'mood.peak',operation:'add',value:.22},
    {id:'bloom-silence',target:cinema2AutoTargets.effect(bloom,'intensity'),source:'mood.silence',operation:'add',value:-.20},
  ],
})
