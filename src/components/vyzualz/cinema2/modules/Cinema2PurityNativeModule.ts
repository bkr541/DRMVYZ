import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleInstance, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { PURITY_PATTERNS, PuritySelection, type PurityPattern } from './purity/Cinema2PurityPatterns'
import { PurityFlight } from './purity/Cinema2PurityFlight'
import { PurityGeometry, Cinema2PurityRenderer } from './purity/Cinema2PurityRenderer'

export const CINEMA2_PURITY_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('purity-native')
const clamp=(v:number,a=0,b=1)=>Math.min(b,Math.max(a,v))
const colors:readonly Cinema2Color[]=[[.045,.065,.085,1],[.075,.105,.13,1],[.56,.85,1,1],[.88,.96,1,1],[.96,.99,1,1]]
const colorNames=['metal','panel','perimeter','panelLight','accent'] as const
const scalarDefaults:Readonly<Record<string,number>>={
  intensity:1,reactivity:1,motionAmount:.75,tunnelWidth:4,tunnelDepth:1,frameThickness:.16,structuralDetail:.75,surfaceRoughness:.35,

  travelSpeed:.7,depthWave:.45,
  perimeterIntensity:1,fixtureIntensity:.85,fixtureDensity:.65,lightingChaseSpeed:.6,lightingContrast:.8,blackoutDepth:.75,lightSpill:.65,reflections:.55,depthFalloff:.55,dropStrength:.75,
  overallEnergy:0,subAmount:0,bassPressure:0,lowMidAmount:0,midAmount:0,highsAmount:0,airAmount:0,fluxAmount:0,vocalPresence:0,
  directorIntensity:0,directorMomentum:0,buildAmount:0,directorImpact:0,variation:0,beatAccent:0,kickAccent:0,snareAccent:0,downbeatAccent:0,barAccent:0,phraseAccent:0,sectionAccent:0,dropAccent:0,
}
type PurityRenderer = Pick<Cinema2PurityRenderer,'draw'|'dispose'|'estimateGpuBytes'>
export interface PurityModuleInstance extends Cinema2ModuleInstance { inspect(): Record<string,unknown> }
export function createCinema2PurityNativeModuleDefinition(createRenderer:(gl:WebGL2RenderingContext)=>PurityRenderer=gl=>new Cinema2PurityRenderer(gl)):Readonly<Cinema2ModuleTypeDefinition>{
return Object.freeze<Cinema2ModuleTypeDefinition>({
  typeId:CINEMA2_PURITY_NATIVE_MODULE_TYPE_ID,version:1,
  create(context):PurityModuleInstance{
    const clock=new Cinema2BeatClock(), selection=new PuritySelection(), patternControls=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>(), geometry=new PurityGeometry(), flight=new PurityFlight()
    let renderer:PurityRenderer|null=null, disposed=false
    const values:Record<string,number>={...scalarDefaults}
    const n=(key:string)=>values[key]??0
    const enabled=(key:string)=>context.parameters.get(key)!==false
    const read=(key:string)=>context.parameters.get(key)
    let lastBeat=0, previousTime:number|null=null, identity='', previousPlaying=false, lastPublication:number|null=null, lastDrop:string|null=null
    const seen=new Map<Cinema2AfterhoursTriggerId,string>()
    let chase=0,wave=0,showTime=0,motion=0,flash=0,silence=0
    let selected:ReturnType<PuritySelection['update']>={base:'ignition',performing:'ignition',previous:'ignition',transition:1,overridden:false}
    return {
      lifecycle:{
        update({frame}){
          if(disposed)return
          for(const [key,fallback] of Object.entries(scalarDefaults)){const v=read(key);values[key]=typeof v==='number'&&Number.isFinite(v)?v:fallback}
          const transport=frame.transport,audio=frame.audio,time=audio?.upstream.timeSec??transport?.timeSec??frame.elapsedTimeSec
          const playing=!!audio&&transport?.sourcePresent!==false&&transport?.playing!==false&&!transport?.paused&&transport?.animationActive!==false
          const animating=transport?.animationActive!==false&&!transport?.paused&&transport?.playing!==false&&transport?.sourcePresent!==false
          const nextIdentity=JSON.stringify([frame.contextGeneration,transport?.sourcePresent,transport?.trackId,audio?.upstream.sourceId,audio?.upstream.publisherId,audio?.upstream.trackId,audio?.upstream.analysisRevision,audio?.upstream.timelineRevision,audio?.discontinuity.generation])
          const reset=nextIdentity!==identity||!!(audio?.discontinuity.occurred&&audio.discontinuity.reason!=='activation')||(previousTime!=null&&(time<previousTime-.035||(playing&&time-previousTime>Math.max(1,frame.deltaTimeSec*6))))
          if(reset){clock.reset();selection.reset();patternControls.reset();flight.reset();chase=wave=showTime=lastBeat=0;lastPublication=null;lastDrop=null;seen.clear();previousTime=null;identity=nextIdentity}
          // Reset the independent clock to zero on a source discontinuity, then re-lock smoothly.
          const beat=clock.update(reset?{...frame,elapsedTimeSec:0}:frame,enabled('bpmSync')&&transport?.bpmSync!==false).beats
          const step=animating&&!reset?clamp(beat-lastBeat,0,1):0;lastBeat=beat
          const dt=animating&&!reset?clamp(frame.deltaTimeSec,0,.25):0;showTime+=dt
          const automatic=read('autoPerformance')===true&&transport?.sourcePresent!==false&&n('reactivity')>0
          const rawTrigger=read('trigger') as Cinema2AfterhoursTriggerId
          const trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(rawTrigger)?rawTrigger:'bar4'
          const controls=patternControls.update({saved:{patternChange:read('patternChange')===true,trigger},mood:frame.mood,autoPerformance:automatic})
          const publication=audio?.upstream.publicationSequence??null
          const fresh=playing&&!reset&&previousPlaying&&publication!==lastPublication
          // Resolve musical event identities through the canonical shared resolver, including structural phrase/drop crossings.
          const rawEvent=playing?resolveCinema2AfterhoursTriggerEventIdentity(frame,controls.trigger,previousTime):null
          const rawDrop=playing?(frame.mood?.drop.occurred?frame.mood.drop.eventId:resolveCinema2AfterhoursTriggerEventIdentity(frame,'drop',previousTime)):null
          const dropEvent=rawDrop&&rawDrop!==lastDrop?rawDrop:null
          if(rawDrop)lastDrop=rawDrop
          const event=controls.trigger==='drop'?(rawDrop??rawEvent):rawEvent
          const newEvent=event&&event!==seen.get(controls.trigger)?event:null
          if(event)seen.set(controls.trigger,event)
          const silent=(frame.mood?.silence??0)>=.5
          // Choreography owns the signals. Discard retained targets across pause/source/seek boundaries.
          if(!audio||reset)for(const key of Object.keys(scalarDefaults))if(scalarDefaults[key]===0)values[key]=0
          const authored=read('pattern') as PurityPattern
          const section=audio?.structure.section
          const build=!!audio&&!reset&&!silent&&section?.available&&section.value?.type==='build'?section.value.id:null
          selected=selection.update({authored:PURITY_PATTERNS.includes(authored)?authored:'ignition',editRevision:context.parameters.getEditRevision?.('pattern')??0,enabled:controls.patternChange,trigger:controls.trigger,
            event:(!fresh||silent&&controls.trigger!=='drop')?null:newEvent,auto:automatic,buildEvent:build,dropEvent:fresh?dropEvent:null,timeSec:showTime,beats:beat,playing,reset})
          // No private musical clock: integrate rates using the existing beat clock, keeping phase continuous when controls change.
          motion=clamp(n('motionAmount'))*(read('motionSafety')==='lockoff'?0:read('motionSafety')==='reduced'?.4:1)
          silence=automatic?clamp(frame.mood?.silence??0)*clamp(n('reactivity')):0
          const pace=step*motion*(playing?1:.5)*(1-.85*silence)
          const strength=clamp(n('dropAccent'))*clamp(n('dropStrength'))
          const speed=clamp(n('travelSpeed'),0,2)*motion*(playing?1:.5)*(1-.85*silence)
            *(1+.15*clamp(n('directorMomentum'))+.12*clamp(n('buildAmount'))+.25*strength)
          flight.advance(dt,step,speed,animating&&!reset)
          // Lighting travels toward deeper bay IDs. Lock-off freezes spatial
          // flight, but deliberately retains independently controlled light patterns.
          chase+=step*clamp(n('lightingChaseSpeed'),0,2)*(1+.2*clamp(n('highsAmount'))+.15*clamp(n('barAccent')))*(playing?1:.4)*(1-.9*silence)
          wave+=pace*(.8+.25*n('subAmount')+.18*n('phraseAccent'))
          flash=read('flashAccents')==='full'?1:read('flashAccents')==='reduced'?.28:0
          previousTime=time;previousPlaying=playing;lastPublication=publication
        },
        dispose(){disposed=true;clock.reset();selection.reset();patternControls.reset();seen.clear();renderer=null},
      },
      render:{providers:[{id:`${context.module.id}:purity-world`,moduleId:context.module.id,intent:'world',execute(execution){
        if(disposed)return
        if(!execution.depthAvailable||!execution.camera)throw new Error('PURITY requires a world camera and scene depth attachment')
        if(!renderer){renderer=context.resources.acquire('purity:world:v1','Cinema2PurityRenderer',createRenderer,r=>r.dispose());context.resources.reportGpuBytes(renderer.estimateGpuBytes())}
        const quality=execution.lightingEnvironment?.quality??'high'
        geometry.update({number:n,enabled,pattern:selected.performing,previous:selected.previous,transition:selected.transition,travel:flight.travel,chase,wave,segments:quality==='low'?10:quality==='medium'?16:22,motion,flash,silence})
        renderer.draw({viewProjection:execution.camera.viewProjectionMatrix,cameraPosition:execution.camera.position,colors:colorNames.map((key,i)=>{const c=read(key);return Array.isArray(c)&&c.length===4?c as unknown as Cinema2Color:colors[i]!}),background:execution.lightingEnvironment?.environment.backgroundColor??[.012,.018,.028,1],roughness:n('surfaceRoughness'),reflections:n('reflections'),falloff:n('depthFalloff'),visibility:1-.96*silence,geometry})
      }}]},
      inspect:()=>({...patternControls.inspect(),basePattern:selected.base,performingPattern:selected.performing,previousPattern:selected.previous,transition:selected.transition,overridden:selected.overridden,instanceCount:geometry.count,travel:flight.travel,travelVelocity:flight.velocity,travelCycle:Math.floor(flight.travel/(3.5*n('tunnelDepth'))),chase,wave,beatLocked:clock.getState().locked,estimatedGpuBytes:renderer?.estimateGpuBytes()??0}),
    }
  },
})
}
export const cinema2PurityNativeModuleDefinition=createCinema2PurityNativeModuleDefinition()
