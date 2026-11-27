import { cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2NativePresetManifest, type Cinema2PresetId, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_GOONZ_CORRIDOR_MODULE_TYPE_ID } from '../modules/Cinema2CorridorNativeModule'
import { GOONZ_CORRIDOR_PATTERNS } from '../modules/corridor/Cinema2CorridorRenderer'
import { CINEMA2_CORRIDOR_PRESET_MANIFEST } from './Cinema2CorridorPreset'

export const CINEMA2_GOONZ_CORRIDOR_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.goonz-corridor')
const original = CINEMA2_CORRIDOR_PRESET_MANIFEST
const id = (name: string) => cinema2StableId<Cinema2ParameterId>(`corridor-${name}`)
const base = (name: string,label: string,parent: 'design'|'effects',group: string,order: number,description: string) => ({
  id:id(name),label,section:'Design' as const,designParentGroup:parent,group,order,description,
  exposure:'primary' as const,persistence:'preset' as const,reset:'authored-default' as const,
})
const slider = (name:string,label:string,parent:'design'|'effects',group:string,order:number,value:number,min:number,max:number,description:string):Cinema2ParameterManifest => ({
  ...base(name,label,parent,group,order,description),type:'float',defaultValue:value,min,max,step:.01,modulatable:true,choreographable:true,
})
const toggle = (name:string,label:string,order:number,description:string):Cinema2ParameterManifest => ({
  ...base(name,label,'design','Panel Media',order,description),type:'boolean',defaultValue:true,
})
const extra = {
  perimeter:slider('perimeter','Perimeter Intensity','design','Panels',3,1.25,0,2.5,'Independent recessed frame LEDs.'),
  rail:slider('rail','Corner Rail Intensity','design','Panels',4,1.10,0,2.5,'Four separately programmed architectural rails.'),
  complexity:slider('complexity','Choreography Complexity','design','Panels',5,.85,0,1,'Fixture recruitment and layered build movements.'),
  spill:slider('wall-spill','Wall Spill','effects','Environmental Lighting',1,1,0,2,'Strength of physically positioned local wall illumination.'),
  reach:slider('spill-reach','Spill Reach','effects','Environmental Lighting',2,.65,.08,1.5,'Distance falloff around each emitting perimeter.'),
  reflection:slider('casing-reflection','Casing Reflection','effects','Environmental Lighting',3,.85,0,2,'Local incident light on machined metal.'),
  screenPower:toggle('screen-power','Screen Power Choreography',3,'Animate media display power independently of frame emission.'),
  readability:toggle('hero-readability','Hero Readability',4,'Hold primary artwork readable during lighting movements.'),
  contentMotion:slider('content-motion','Content Motion','design','Panel Media',5,.75,0,1,'Contained artwork scale, rotation and position motion.'),
  crt:slider('crt-interference','CRT Interference','design','Panel Media',6,.25,0,1,'Amount of tracking, scanlines and interference.'),
}
const extraBindings = Object.fromEntries(Object.entries(extra).map(([key,p])=>[key,cinema2Ref(p.id)]))
const extraDefaults = Object.fromEntries(Object.entries(extra).map(([key,p])=>[key,p.defaultValue]))
const moduleId = original.modules![0]!.id
const pulse = (name:'snare'|'downbeat'|'phrase'|'section-change', property:string, capability:'music.rhythm-events'|'music.downbeat'|'music.phrase'|'music.section',release:number):Cinema2ChoreographyRuleManifest => ({
  id:cinema2StableId<Cinema2ChoreographyRuleId>(`goonz-corridor-${name}`),priority:40,enabledParameter:cinema2Ref(id('auto-performance')),
  source:{signal:name,capability},conditions:[{kind:'once-per-event'},{kind:'not-silent'}],actions:[{
    id:cinema2StableId<Cinema2ChoreographyActionId>(`goonz-corridor-pulse-${name}`),target:{kind:'module',ref:cinema2Ref(moduleId),property},operation:'envelope',value:1,
    envelope:{attack:.016,hold:.04,release,unit:'seconds'},retrigger:'restart',
  }],
})
// Local IDs and source slots remain stable. Only the GOONZ variant gets the
// expanded authoring, while the standard Corridor manifest is untouched.
export const CINEMA2_GOONZ_CORRIDOR_PRESET_MANIFEST: Cinema2NativePresetManifest = {
  ...original,
  id: CINEMA2_GOONZ_CORRIDOR_PRESET_ID,
  metadata: {...original.metadata,name:'GOONZ CORRIDOR',description:'Four-sided industrial CRT installation with twelve rhythmic fixture programs, selective environmental light, and pool-aware artwork choreography.'},
  capabilities:[...(original.capabilities ?? []),
    {id:'music.downbeat',requirement:'optional',purpose:'Architectural accents.'},
    {id:'music.phrase',requirement:'optional',purpose:'Phrase-scale reveals.'},
    {id:'music.section',requirement:'optional',purpose:'Section transitions.'},
  ],
  parameters:[...(original.parameters ?? []).map(p=>{
    if(p.id===id('pattern')&&p.type==='enum') return {...p,options:GOONZ_CORRIDOR_PATTERNS}
    if(p.id===id('intensity')&&p.type==='float') return {...p,defaultValue:1.15,max:2.5,description:'HDR diffuser output; independent of artwork exposure.'}
    if(p.id===id('bloom')&&p.type==='float') return {...p,defaultValue:.55}
    if(p.id===id('pool-trigger')) return {...p,description:'Program uses each pattern’s musical cadence; explicit triggers override it.'}
    return p
  }),...Object.values(extra)],
  modules:original.modules?.map(module=>({...module,typeId:CINEMA2_GOONZ_CORRIDOR_MODULE_TYPE_ID,
    parameters:{...module.parameters,intensity:1.15,...extraDefaults,snare:0,downbeat:0,phrase:0,section:0},
    parameterBindings:{...module.parameterBindings,...extraBindings},
  })),
  effects:original.effects?.map(effect=>({...effect,parameters:{...effect.parameters,...(effect.id==='corridor-bloom'?{threshold:1.15,intensity:.55,spread:.55}:{exposure:.95})}})),
  choreography:{...original.choreography,rules:[...(original.choreography?.rules??[]),
    pulse('snare','snare','music.rhythm-events',.19),pulse('downbeat','downbeat','music.downbeat',.38),
    pulse('phrase','phrase','music.phrase',1.1),pulse('section-change','section','music.section',1.4),
  ]},
}
