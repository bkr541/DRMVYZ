import { cinema2StableId, type Cinema2Color, type Cinema2ModuleManifest, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleRenderExecutionContext, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { resolveCinema2AfterhoursTriggerEventIdentity, CINEMA2_AFTERHOURS_TRIGGER_IDS, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { resolveCinema2MainframePlaybackState, resolveCinema2MainframeSourceIdentity, selectCinema2MainframeAudio } from './mainframe/Cinema2MainframeAudioDelivery'
import { Cinema2MainframeBeatClockResolver, resolveCinema2MainframeTimeSec } from './mainframe/Cinema2MainframePatternEngine'
import { resolveCinema2MainframeTriggerEventIdentity } from './mainframe/Cinema2MainframePatternController'
import { shouldResetCinema2MainframeDropState } from './mainframe/Cinema2MainframeMusicAdapter'
import { Cinema2EventHorizonRenderer } from './eventHorizon/Cinema2EventHorizonRenderer'

export const CINEMA2_EVENT_HORIZON_NATIVE_MODULE_TYPE_ID=cinema2StableId<Cinema2ModuleTypeId>('event-horizon-native')
export const CINEMA2_EVENT_HORIZON_NATIVE_MODULE_VERSION=1 as const
export const CINEMA2_EVENT_HORIZON_LOOKS=Object.freeze(['singularityCrown','quasarMaw','binaryCollapse'] as const)
export type Cinema2EventHorizonLook=typeof CINEMA2_EVENT_HORIZON_LOOKS[number]
export const CINEMA2_EVENT_HORIZON_TRIGGER_IDS=CINEMA2_AFTERHOURS_TRIGGER_IDS
export type Cinema2EventHorizonTriggerId=Cinema2AfterhoursTriggerId
const LOOK_INDEX: Readonly<Record<Cinema2EventHorizonLook,number>>=Object.freeze({singularityCrown:0,quasarMaw:1,binaryCollapse:2})
const DEFAULT_PRIMARY=Object.freeze([0.05,0.86,0.95,1]) as Cinema2Color
const DEFAULT_SECONDARY=Object.freeze([0.42,0.3,1,1]) as Cinema2Color
const DEFAULT_ACCENT=Object.freeze([1,0.68,0.22,1]) as Cinema2Color
const DEFAULT_BACKGROUND=Object.freeze([0.002,0.004,0.012,1]) as Cinema2Color

export function createCinema2EventHorizonLookCycle(sample:(index:number)=>number): readonly Cinema2EventHorizonLook[] {
  const cycle=[...CINEMA2_EVENT_HORIZON_LOOKS]
  for(let index=cycle.length-1,sampleIndex=0;index>0;index-=1,sampleIndex+=1){const swap=Math.floor(Math.min(.999999,Math.max(0,sample(sampleIndex)))*(index+1));[cycle[index],cycle[swap]]=[cycle[swap]!,cycle[index]!]}
  return Object.freeze(cycle)
}

export class Cinema2EventHorizonProgramController {
  private active:Cinema2EventHorizonLook; private authored:Cinema2EventHorizonLook|null=null; private enabled:boolean|null=null; private trigger:Cinema2EventHorizonTriggerId|null=null; private event:string|null=null
  constructor(private readonly cycle:readonly Cinema2EventHorizonLook[],initial:Cinema2EventHorizonLook='singularityCrown'){this.active=initial}
  update(input:Readonly<{authoredLook:Cinema2EventHorizonLook;patternChange:boolean;trigger:Cinema2EventHorizonTriggerId;triggerEventId:string|null;reset?:boolean}>):Readonly<{activeLook:Cinema2EventHorizonLook;changed:boolean}>{
    const authoredChanged=this.authored!=null&&input.authoredLook!==this.authored; const toggled=this.enabled!=null&&input.patternChange!==this.enabled; const triggerChanged=this.trigger!=null&&input.trigger!==this.trigger; let changed=false
    if(input.reset||authoredChanged||toggled||this.authored==null){changed=this.active!==input.authoredLook||authoredChanged||toggled;this.active=input.authoredLook;this.event=input.triggerEventId}
    else if(triggerChanged)this.event=input.triggerEventId
    else if(!input.patternChange){if(this.active!==input.authoredLook){this.active=input.authoredLook;changed=true}this.event=input.triggerEventId}
    else if(input.triggerEventId&&input.triggerEventId!==this.event){const current=this.cycle.indexOf(this.active);this.active=this.cycle[(current<0?0:current+1)%this.cycle.length]??'singularityCrown';this.event=input.triggerEventId;changed=true}
    this.authored=input.authoredLook;this.enabled=input.patternChange;this.trigger=input.trigger;return Object.freeze({activeLook:this.active,changed})
  }
  reset():void{this.authored=null;this.enabled=null;this.trigger=null;this.event=null}
}

export function createCinema2EventHorizonNativeModuleDefinition(options:{createRenderer?:(gl:WebGL2RenderingContext)=>Cinema2EventHorizonRenderer}={}):Readonly<Cinema2ModuleTypeDefinition>{
  const createRenderer=options.createRenderer??(gl=>new Cinema2EventHorizonRenderer(gl))
  return Object.freeze({typeId:CINEMA2_EVENT_HORIZON_NATIVE_MODULE_TYPE_ID,version:CINEMA2_EVENT_HORIZON_NATIVE_MODULE_VERSION,validate:validateModule,create(context:Cinema2ModuleCreateContext){
    const renderer=context.resources.acquire('event-horizon:gravitational-core','Cinema2EventHorizonRenderer',gl=>createRenderer(gl),value=>value.dispose());context.resources.reportGpuBytes(renderer.estimateGpuBytes())
    const initial=readEnum(context.parameters,'look',CINEMA2_EVENT_HORIZON_LOOKS,'singularityCrown');const controller=new Cinema2EventHorizonProgramController(createCinema2EventHorizonLookCycle(index=>context.randomness.sample('event-horizon-look-cycle',index)),initial);const beatClock=new Cinema2MainframeBeatClockResolver();let activeLook=initial
    let previousTimeSec:number|null=null,previousBeat:number|null=null,previousSourceIdentity:string|null=null,previousContextGeneration:number|null=null;let previousTrackId:string|null|undefined;let previousPlayback:ReturnType<typeof resolveCinema2MainframePlaybackState>|null=null
    const provider=Object.freeze({id:`${context.module.id}:event-horizon`,moduleId:context.module.id,intent:'world' as const,execute(execution:Cinema2ModuleRenderExecutionContext){
      if(!execution.depthAvailable)throw new Error(`Cinema 2.0 Event Horizon module "${context.module.id}" requires a depth-writing target.`)
      if(!execution.camera)throw new Error(`Cinema 2.0 Event Horizon module "${context.module.id}" requires a world camera.`)
      const quality=execution.lightingEnvironment?.quality??'high';const auto=readBoolean(context.parameters,'autoPerformance',true);const build=clamp(readNumber(context.parameters,'buildAmount',0),0,1);const drop=clamp(readNumber(context.parameters,'dropAccent',0),0,1);const look=auto&&drop>.08?'quasarMaw':auto&&build>.2?'binaryCollapse':activeLook
      const authored=lookSettings(look);renderer.draw({viewProjection:execution.camera.viewProjectionMatrix,cameraPosition:execution.camera.position,timeSeconds:resolveTime(execution.frame),look:LOOK_INDEX[look],primary:rgb(readColor(context.parameters,'primaryColor',DEFAULT_PRIMARY)),secondary:rgb(readColor(context.parameters,'secondaryColor',DEFAULT_SECONDARY)),accent:rgb(readColor(context.parameters,'accentColor',DEFAULT_ACCENT)),intensity:clamp(readNumber(context.parameters,'intensity',.82),0,2),coreRadius:clamp(readNumber(context.parameters,'coreRadius',.16)+authored.core-.16,.06,.4)*3.3,diskRadius:clamp(readNumber(context.parameters,'diskRadius',.33)+authored.radius-.33,.15,.75)*7.5,diskThickness:clamp(readNumber(context.parameters,'diskThickness',.052)+authored.thickness-.052,.01,.25)*3.2,tilt:clamp(readNumber(context.parameters,'tilt',.48)+authored.tilt-.48,-1.2,1.2),lensing:clamp(readNumber(context.parameters,'lensing',.88)+authored.lensing-.88,0,2.5),rotation:clamp(readNumber(context.parameters,'rotationSpeed',.28)+authored.rotation-.28,-2,2),starDensity:clamp(readNumber(context.parameters,'starDensity',.72)+authored.stars-.72,0,1),debris:clamp(readNumber(context.parameters,'debrisDensity',.12)+authored.debris-.12,0,1),energy:readNumber(context.parameters,'overallEnergy',0),bass:readNumber(context.parameters,'bassPressure',0),kick:readNumber(context.parameters,'kickAccent',0),snare:readNumber(context.parameters,'snareAccent',0),downbeat:readNumber(context.parameters,'downbeatAccent',0),phrase:readNumber(context.parameters,'phraseAccent',0),build,drop,quality})
    }})
    return {lifecycle:{update:({parameters,frame}:Cinema2ModuleUpdateContext)=>{const authoredLook=readEnum(parameters,'look',CINEMA2_EVENT_HORIZON_LOOKS,'singularityCrown');const patternChange=readBoolean(parameters,'patternChange',false);const trigger=readEnum(parameters,'trigger',CINEMA2_EVENT_HORIZON_TRIGGER_IDS,'bar4');const audio=selectCinema2MainframeAudio(frame.audio,frame.transport?.trackId);const accepted=audio===frame.audio?frame:{...frame,audio};const playback=resolveCinema2MainframePlaybackState(accepted,audio);const timeSec=resolveCinema2MainframeTimeSec(accepted);const sourceIdentity=frame.transport?.paused&&!audio&&previousSourceIdentity!=null&&frame.transport.trackId===previousTrackId?previousSourceIdentity:resolveCinema2MainframeSourceIdentity(accepted,audio);const reset=shouldResetCinema2MainframeDropState(accepted,{timeSec,sourceIdentity,playback},{timeSec:previousTimeSec,sourceIdentity:previousSourceIdentity,contextGeneration:previousContextGeneration,playback:previousPlayback});if(reset)beatClock.reset();const timing=beatClock.resolve(accepted,readBoolean(parameters,'bpmSync',true));const triggerFrame=accepted.transport?{...accepted,transport:{...accepted.transport,sourcePresent:true}}:accepted;const dropEventId=playback==='playing'?resolveCinema2AfterhoursTriggerEventIdentity(triggerFrame,'drop',previousTimeSec):null;const eventId=reset?null:resolveCinema2MainframeTriggerEventIdentity(accepted,trigger,previousTimeSec,dropEventId,{previousBeat,current:timing});activeLook=controller.update({authoredLook,patternChange,trigger,triggerEventId:eventId,reset}).activeLook;previousTimeSec=timeSec;previousBeat=timing.beats;previousSourceIdentity=sourceIdentity;previousTrackId=frame.transport?.trackId;previousContextGeneration=frame.contextGeneration;previousPlayback=playback},dispose:()=>{controller.reset();beatClock.reset()}},render:{providers:Object.freeze([provider])}}
  }})
}

export const cinema2EventHorizonNativeModuleDefinition=createCinema2EventHorizonNativeModuleDefinition()
function validateModule(_module:Readonly<Cinema2ModuleManifest>):readonly Cinema2ModuleDiagnostic[]{return Object.freeze([])}
function lookSettings(look:Cinema2EventHorizonLook){return look==='quasarMaw'?{core:.23,radius:.43,thickness:.12,tilt:-.62,lensing:1.24,rotation:-.72,stars:.38,debris:.3}:look==='binaryCollapse'?{core:.12,radius:.29,thickness:.034,tilt:.12,lensing:.56,rotation:.12,stars:.94,debris:.05}:{core:.16,radius:.33,thickness:.052,tilt:.48,lensing:.88,rotation:.28,stars:.72,debris:.12}}
type Parameters=Cinema2ModuleCreateContext['parameters']
function readNumber(parameters:Parameters,name:string,fallback:number):number{const value=parameters.get(name);return typeof value==='number'&&Number.isFinite(value)?value:fallback}
function readBoolean(parameters:Parameters,name:string,fallback:boolean):boolean{const value=parameters.get(name);return typeof value==='boolean'?value:fallback}
function readEnum<const T extends string>(parameters:Parameters,name:string,allowed:readonly T[],fallback:T):T{const value=parameters.get(name);return typeof value==='string'&&allowed.includes(value as T)?value as T:fallback}
function readColor(parameters:Parameters,name:string,fallback:Cinema2Color):Cinema2Color{const value=parameters.get(name);return Array.isArray(value)&&value.length===4&&value.every(component=>typeof component==='number'&&Number.isFinite(component))?value as unknown as Cinema2Color:fallback}
function rgb(value:Cinema2Color):readonly[number,number,number]{return[value[0],value[1],value[2]]}
function resolveTime(frame:Cinema2ModuleRenderExecutionContext['frame']):number{return frame.transport?.sourcePresent&&Number.isFinite(frame.transport.timeSec)?Math.max(0,frame.transport.timeSec):Math.max(0,frame.audio?.upstream.timeSec??frame.elapsedTimeSec)}
function clamp(value:number,min:number,max:number):number{return Math.min(max,Math.max(min,value))}
