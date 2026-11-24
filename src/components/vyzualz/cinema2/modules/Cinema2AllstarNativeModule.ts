import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { ALLSTAR_PATTERNS, ALLSTAR_PROFILES, AllstarSelection, type AllstarPattern } from './allstar/Cinema2AllstarPatterns'
import { AllstarGeometry, Cinema2AllstarRenderer } from './allstar/Cinema2AllstarRenderer'

export const CINEMA2_ALLSTAR_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('allstar-native')
const clamp=(v:number,a=0,b=1)=>Math.min(b,Math.max(a,v))
const colors:readonly Cinema2Color[]=[[.145098,.12549,.172549,1],[.25098,.2,.286275,1],[.960784,.164706,.85098,1],[.25098,.87451,1,1],[1,.945098,.988235,1]]
const colorNames=['metal','panel','perimeter','geometryColor','accent'] as const
const scalarDefaults:Readonly<Record<string,number>>={
  intensity:1,reactivity:1,motionAmount:.75,tunnelWidth:4,tunnelDepth:1,frameThickness:.16,structuralDetail:.75,surfaceRoughness:.35,
  geometryLayers:5,geometrySize:1,geometryThickness:.045,morphAmount:.65,geometryIntensity:1,geometricSeparation:.7,
  travelSpeed:.7,geometryTravel:.85,rotationSpeed:.12,counterRotation:.35,expansionAmount:.75,morphSpeed:.6,depthWave:.45,cameraRoll:.02,
  perimeterIntensity:1,fixtureIntensity:.85,fixtureDensity:.65,lightingChaseSpeed:.6,lightingContrast:.8,blackoutDepth:.75,lightSpill:.65,reflections:.55,depthFalloff:.55,dropStrength:.75,
  overallEnergy:0,subAmount:0,bassPressure:0,lowMidAmount:0,midAmount:0,highsAmount:0,airAmount:0,fluxAmount:0,vocalPresence:0,
  directorIntensity:0,directorMomentum:0,buildAmount:0,directorImpact:0,variation:0,beatAccent:0,kickAccent:0,snareAccent:0,downbeatAccent:0,barAccent:0,phraseAccent:0,sectionAccent:0,dropAccent:0,
}
export const cinema2AllstarNativeModuleDefinition:Readonly<Cinema2ModuleTypeDefinition>=Object.freeze<Cinema2ModuleTypeDefinition>({
  typeId:CINEMA2_ALLSTAR_NATIVE_MODULE_TYPE_ID,version:1,
  create(context){
    const clock=new Cinema2BeatClock(), selection=new AllstarSelection(), patternControls=new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>(), geometry=new AllstarGeometry()
    const renderer=context.resources.acquire('allstar:world:v1','Cinema2AllstarRenderer',gl=>new Cinema2AllstarRenderer(gl),r=>r.dispose())
    context.resources.reportGpuBytes(renderer.estimateGpuBytes())
    const values:Record<string,number>={...scalarDefaults}
    const n=(key:string)=>values[key]??0
    const enabled=(key:string)=>context.parameters.get(key)!==false
    const read=(key:string)=>context.parameters.get(key)
    let lastBeat=0, previousTime:number|null=null, identity='', previousPlaying=false, lastPublication:number|null=null
    const seen=new Map<Cinema2AfterhoursTriggerId,string>()
    let travel=0,geometryTravel=0,spin=0,morphPhase=0,chase=0,wave=0,showTime=0,rollPhase=0,motion=0,flash=0,silence=0
    let selected:ReturnType<AllstarSelection['update']>={base:'infinitePassage',performing:'infinitePassage',previous:'infinitePassage',transition:1,overridden:false}
    return {
      lifecycle:{
        update({frame}){
          for(const [key,fallback] of Object.entries(scalarDefaults)){const v=read(key);values[key]=typeof v==='number'&&Number.isFinite(v)?v:fallback}
          const transport=frame.transport,audio=frame.audio,time=audio?.upstream.timeSec??transport?.timeSec??frame.elapsedTimeSec
          const playing=!!audio&&transport?.sourcePresent!==false&&transport?.playing!==false&&!transport?.paused&&transport?.animationActive!==false
          const animating=transport?.animationActive!==false&&!transport?.paused
          const nextIdentity=JSON.stringify([frame.contextGeneration,transport?.trackId,audio?.upstream.sourceId,audio?.upstream.trackId,audio?.upstream.analysisRevision,audio?.upstream.timelineRevision,audio?.discontinuity.generation])
          const reset=nextIdentity!==identity||(previousTime!=null&&time<previousTime-.001)
          if(reset){clock.reset();selection.reset();patternControls.reset();travel=geometryTravel=spin=morphPhase=chase=wave=showTime=rollPhase=lastBeat=0;lastPublication=null;seen.clear();previousTime=null;identity=nextIdentity}
          const beat=clock.update(frame,enabled('bpmSync')&&transport?.bpmSync!==false).beats
          const step=animating&&!reset?clamp(beat-lastBeat,0,1):0;lastBeat=beat
          const dt=animating&&!reset?clamp(frame.deltaTimeSec,0,.1):0;showTime+=dt
          const automatic=read('autoPerformance')===true
          const rawTrigger=read('trigger') as Cinema2AfterhoursTriggerId
          const trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(rawTrigger)?rawTrigger:'bar4'
          const controls=patternControls.update({saved:{patternChange:read('patternChange')===true,trigger},mood:frame.mood,autoPerformance:automatic&&playing})
          const publication=audio?.upstream.publicationSequence??null
          const fresh=playing&&!reset&&previousPlaying&&publication!==lastPublication
          // Resolve musical event identities through the canonical shared resolver, including structural phrase/drop crossings.
          const rawEvent=playing?resolveCinema2AfterhoursTriggerEventIdentity(frame,controls.trigger,previousTime):null
          const rawDrop=playing?(frame.mood?.drop.occurred?frame.mood.drop.eventId:resolveCinema2AfterhoursTriggerEventIdentity(frame,'drop',previousTime)):null
          const event=controls.trigger==='drop'?(rawDrop??rawEvent):rawEvent
          const newEvent=event&&event!==seen.get(controls.trigger)?event:null
          if(event)seen.set(controls.trigger,event)
          const silent=(frame.mood?.silence??0)>=.5
          const authored=read('pattern') as AllstarPattern
          const section=audio?.structure.section
          const build=playing&&section?.available&&section.value?.type==='build'?section.value.id:null
          selected=selection.update({authored:ALLSTAR_PATTERNS.includes(authored)?authored:'infinitePassage',editRevision:context.parameters.getEditRevision?.('pattern')??0,enabled:controls.patternChange,trigger:controls.trigger,
            event:(!fresh||silent&&controls.trigger!=='drop')?null:newEvent,auto:automatic,buildEvent:build,dropEvent:fresh?rawDrop:null,timeSec:showTime,beats:beat,playing,reset})
          // No private musical clock: integrate rates using the existing beat clock, keeping phase continuous when controls change.
          const profile=ALLSTAR_PROFILES[ALLSTAR_PATTERNS.indexOf(selected.performing)]!
          const prev=ALLSTAR_PROFILES[ALLSTAR_PATTERNS.indexOf(selected.previous)]!
          const rate=(i:number)=>prev[i]!+(profile[i]!-prev[i]!)*selected.transition
          motion=clamp(n('motionAmount'))*(read('motionSafety')==='lockoff'?0:read('motionSafety')==='reduced'?.4:1)
          silence=automatic&&playing?clamp(frame.mood?.silence??0)*clamp(n('reactivity')):0
          const pace=step*motion*(playing?1:.5)*(1-.85*silence)
          const strength=n('dropAccent')*n('dropStrength')
          travel+=pace*n('travelSpeed')*rate(4)*(1+.15*n('directorMomentum')+.12*n('buildAmount')+.25*strength)
          geometryTravel+=pace*n('geometryTravel')*rate(4)*(1+.16*n('directorIntensity')+.23*strength)
          spin+=pace*n('rotationSpeed')*.65
          morphPhase+=pace*n('morphSpeed')*1.7*(1+.18*n('variation')+.25*n('midAmount'))
          chase+=step*n('lightingChaseSpeed')*(1+.2*n('highsAmount')+.15*n('barAccent'))*(playing?1:.4)*(1-.9*silence)
          wave+=pace*(.8+.25*n('subAmount')+.18*n('phraseAccent'))
          rollPhase+=pace*.24
          flash=read('flashAccents')==='full'?1:read('flashAccents')==='reduced'?.28:0
          previousTime=time;previousPlaying=playing;lastPublication=publication
        },
        dispose(){clock.reset();selection.reset();patternControls.reset()},
      },
      render:{providers:[{id:`${context.module.id}:allstar-world`,moduleId:context.module.id,intent:'world',execute(execution){
        if(!execution.depthAvailable||!execution.camera)throw new Error('ALLSTAR requires a world camera and scene depth attachment')
        const quality=execution.lightingEnvironment?.quality??'high'
        geometry.update({number:n,enabled,pattern:selected.performing,previous:selected.previous,transition:selected.transition,travel,geometryTravel,spin,morphPhase,chase,wave,segments:quality==='low'?12:quality==='medium'?18:24,motion,roll:enabled('cameraMotion')?Math.sin(rollPhase)*n('cameraRoll')*.21*motion:0,flash,silence})
        renderer.draw({viewProjection:execution.camera.viewProjectionMatrix,cameraPosition:execution.camera.position,colors:colorNames.map((key,i)=>{const c=read(key);return Array.isArray(c)&&c.length===4?c as unknown as Cinema2Color:colors[i]!}),roughness:n('surfaceRoughness'),reflections:n('reflections'),falloff:n('depthFalloff'),visibility:1-.96*silence,geometry})
      }}]},
      inspect:()=>({...patternControls.inspect(),basePattern:selected.base,performingPattern:selected.performing,previousPattern:selected.previous,transition:selected.transition,overridden:selected.overridden,instanceCount:geometry.count,travel,geometryTravel,spin,morphPhase}),
    }
  },
})
