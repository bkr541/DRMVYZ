import { Cinema2BeatClock } from '../Cinema2BeatClock'
import type { Cinema2ModuleParameterReadFacet, Cinema2ModuleUpdateContext } from '../Cinema2ModuleContracts'
import { Cinema2MainframePatternController } from '../mainframe/Cinema2MainframePatternController'
import { resolveNightshiftPatternEvent, selectNightshiftAudio } from '../nightshift/Cinema2NightshiftAudio'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../Cinema2AfterhoursNativeModule'

export const SWITCH_IT_PATTERNS = [
  { value: 'switch-cycle', label: 'Switch Cycle' }, { value: 'split-portrait', label: 'Split Portrait' },
  { value: 'twin-reveal', label: 'Twin Reveal' }, { value: 'facet-peel', label: 'Facet Peel' },
  { value: 'skull-projection', label: 'Skull Projection' }, { value: 'crown-surge', label: 'Crown Surge' },
] as const
export type SwitchItPattern = typeof SWITCH_IT_PATTERNS[number]['value']
export interface SwitchItPose {
  /** Signed-field weights: lateral reveal, opposing fronts, seeded peel, crown peel. */
  weights: readonly [number, number, number, number]
  reveal: number; peel: number; crown: number; column: number; flare: number
}
export type SwitchItColor = readonly [number, number, number]
export interface SwitchItVisualControls {
  audioLift: number; audioCrest: number; audioGlint: number; audioFlare: number
  flecks: number; particlePhase: number
  master: number; portraitScale: number; relief: number; reach: number
  eyeIntensity: number; eyesEnabled: boolean; columnIntensity: number
  fragmentAmount: number; flareEnabled: boolean; flareStrength: number
  shell: SwitchItColor; rim: SwitchItColor; skull: SwitchItColor; energy: SwitchItColor; column: SwitchItColor
}
export const SWITCH_IT_VISUAL_DEFAULTS: SwitchItVisualControls = {
  audioLift:0,audioCrest:0,audioGlint:0,audioFlare:0,flecks:0,particlePhase:0,
  master: 1, portraitScale: 1, relief: 0, reach: .35,
  eyeIntensity: 1, eyesEnabled: true, columnIntensity: 1,
  fragmentAmount: 1, flareEnabled: false, flareStrength: .35,
  shell: [.012,.023,.045], rim: [.66,.79,.9], skull: [.95,.12,.19], energy: [.85,.98,1], column: [.8,.005,.09],
}
const clamp = (v: number, a=0, b=1) => Math.max(a, Math.min(b,v))
export const switchItNumber = (p: Cinema2ModuleParameterReadFacet, name: string, fallback: number, min=0, max=1) => {
  const value=p.get(name);return typeof value==='number'&&Number.isFinite(value)?clamp(value,min,max):fallback
}
export function readSwitchItVisualControls(p: Cinema2ModuleParameterReadFacet): SwitchItVisualControls {
  const d=SWITCH_IT_VISUAL_DEFAULTS
  const color=(name: string,fallback: SwitchItColor):SwitchItColor=>{
    const v=p.get(name);return Array.isArray(v)&&v.length===4&&v.every(x=>typeof x==='number'&&Number.isFinite(x))?[clamp(v[0] as number),clamp(v[1] as number),clamp(v[2] as number)]:fallback
  }
  return {
    audioLift:0,audioCrest:0,audioGlint:0,audioFlare:0,flecks:0,particlePhase:0,
    master:switchItNumber(p,'master',1,0,1.5),portraitScale:switchItNumber(p,'portraitScale',1,.65,1.2),
    relief:switchItNumber(p,'relief',0,0,.12),reach:switchItNumber(p,'reach',.35,0,.8),
    eyeIntensity:switchItNumber(p,'eyeIntensity',1,0,2),eyesEnabled:p.get('eyesEnabled')!==false,columnIntensity:switchItNumber(p,'columnIntensity',1,0,2),
    fragmentAmount:switchItNumber(p,'fragmentAmount',1),flareEnabled:p.get('flareEnabled')===true,flareStrength:switchItNumber(p,'flareStrength',.35),
    shell:color('shell',d.shell),rim:color('rim',d.rim),skull:color('skull',d.skull),energy:color('energy',d.energy),column:color('column',d.column),
  }
}
const ease=(t:number)=>{const v=clamp(t);return v*v*(3-2*v)}
function curve(phase:number,keys:readonly (readonly [number,number])[]):number {
  for(let i=1;i<keys.length;i++)if(phase<=keys[i][0]){
    const [a,x]=keys[i-1],[b,y]=keys[i];return x+(y-x)*ease((phase-a)/(b-a))
  }
  return keys[keys.length-1][1]
}
export function sampleSwitchItProgram(pattern:SwitchItPattern,phase:number,reveal=.5):SwitchItPose {
  const t=((phase%1)+1)%1
  const pose:SwitchItPose={weights:[1,0,0,0],reveal:0,peel:0,crown:0,column:1,flare:0}
  if(pattern==='split-portrait')return{...pose,reveal}
  if(pattern==='skull-projection')return{...pose,reveal:1,column:.85+.15*Math.cos(t*Math.PI*2)}
  if(pattern==='switch-cycle'){
    const r=curve(t,[[0,0],[.12,0],[.28,.5],[.42,.5],[.58,1],[.72,1],[.9,0],[1,0]])
    return{...pose,reveal:r,flare:Math.pow(Math.sin(Math.PI*clamp((t-.72)/.18)),8)}
  }
  if(pattern==='twin-reveal')return{...pose,weights:[0,1,0,0],reveal:curve(t,[[0,0],[.12,0],[.45,1],[.6,1],[.94,0],[1,0]])}
  const strength=curve(t,[[0,0],[.12,0],[.45,1],[.6,1],[.94,0],[1,0]])
  if(pattern==='facet-peel')return{...pose,weights:[0,0,1,0],peel:strength}
  return{...pose,weights:[0,0,0,1],peel:strength*.78,crown:strength,flare:Math.pow(strength,8)}
}
export function mixSwitchItPose(a:SwitchItPose,b:SwitchItPose,t:number):SwitchItPose {
  const k=ease(t),mix=(x:number,y:number)=>x+(y-x)*k
  return{weights:a.weights.map((v,i)=>mix(v,b.weights[i])) as [number,number,number,number],reveal:mix(a.reveal,b.reveal),peel:mix(a.peel,b.peel),crown:mix(a.crown,b.crown),column:mix(a.column,b.column),flare:mix(a.flare,b.flare)}
}

/** Presentation programs use the shared clock and canonical event identities; no musical detector or Director consumer. */
export class Cinema2SwitchItMotion {
  private readonly clock=new Cinema2BeatClock()
  private readonly patterns=new Cinema2MainframePatternController<SwitchItPattern>(SWITCH_IT_PATTERNS.map(p=>p.value),'switch-cycle')
  private lastTime:number|null=null
  private lastTimestamp:number|null=null
  private track:string|null|undefined
  private generation=-1
  private audioGeneration=-1
  private previousBeats=0
  private phase=0
  private cycles=0
  private epoch=0
  private revision=-1
  private authored='switch-cycle'
  private patternChange=false
  private allowPausedTransition=false
  private readonly events=new Set<string>()
  private transition=1
  private from=sampleSwitchItProgram('switch-cycle',0)
  pose=this.from
  state={pattern:'switch-cycle' as SwitchItPattern,phase:0,cycles:0,epoch:0,locked:false,bpm:null as number|null,transition:1}
  update({frame:input,parameters:p}:Cinema2ModuleUpdateContext):void{
    const audio=selectNightshiftAudio(input)
    const frame={...input,audio,director:null}
    const time=frame.transport?.timeSec??audio?.upstream.timeSec??0
    const track=frame.transport?.trackId??audio?.upstream.trackId
    const active=frame.transport?frame.transport.playing&&!frame.transport.paused:true
    const elapsed=this.lastTimestamp==null?0:clamp((frame.timestampMs-this.lastTimestamp)/1000,0,.25)
    const reset=this.generation!==frame.contextGeneration||this.track!==track||
      (this.lastTime!=null&&(time<this.lastTime-.05||time-this.lastTime>Math.max(.75,elapsed+.5)))||
      (audio?.discontinuity.occurred===true&&audio.discontinuity.reason!=='activation'&&audio.discontinuity.generation!==this.audioGeneration)
    if(reset){this.clock.reset();this.previousBeats=0;this.phase=0;this.cycles=0;this.epoch++;this.patterns.reset();this.transition=1;this.events.clear()}
    const dt=reset||!active?0:elapsed
    const beat=this.clock.update({...frame,deltaTimeSec:dt,elapsedTimeSec:0,transport:frame.transport?{...frame.transport,animationActive:active}:undefined},p.get('bpmSync')!==false&&frame.transport?.bpmSync!==false,60/2.25*4)
    const advance=(Math.max(0,beat.beats-this.previousBeats)/4)*switchItNumber(p,'speed',1,0,2)
    this.phase+=advance;this.cycles+=advance
    this.previousBeats=beat.beats
    const authored=SWITCH_IT_PATTERNS.find(option=>option.value===p.get('pattern'))?.value??'switch-cycle'
    const trigger=CINEMA2_AFTERHOURS_TRIGGER_IDS.find(value=>value===p.get('trigger'))??'bar4'
    const revision=p.getEditRevision?.('pattern')??0
    const edited=this.revision!==-1&&revision!==this.revision
    const eventFrame=!active&&frame.transport?{...frame,transport:{...frame.transport,paused:false,playing:true}}:frame
    const observed=resolveNightshiftPatternEvent(eventFrame,trigger,reset?null:this.lastTime)
    const event=active&&observed&&!this.events.has(observed)?observed:null
    if(observed)this.events.add(observed)
    while(this.events.size>128)this.events.delete(this.events.values().next().value!)
    const selection=this.patterns.update({authoredPattern:authored,patternChange:p.get('patternChange')===true,trigger,triggerEventId:event,absoluteBeat:beat.beats,reset:reset||edited})
    if(selection.changed||reset){
      this.phase=0;this.from=this.pose;this.transition=reset?1:0
      this.allowPausedTransition=edited||authored!==this.authored||this.patternChange!==(p.get('patternChange')===true)
    }
    // Manual edits still take effect while paused; authored motion itself stays frozen.
    this.transition=clamp(this.transition+(active||this.allowPausedTransition?elapsed:0)/.24)
    const target=sampleSwitchItProgram(selection.activePattern,this.phase,switchItNumber(p,'reveal',.5))
    this.pose=mixSwitchItPose(this.from,target,this.transition)
    this.state={pattern:selection.activePattern,phase:this.phase,cycles:this.cycles,epoch:this.epoch,locked:beat.locked,bpm:beat.bpm,transition:this.transition}
    this.lastTime=time;this.lastTimestamp=frame.timestampMs;this.track=track;this.generation=frame.contextGeneration;this.revision=revision
    this.authored=authored;this.patternChange=p.get('patternChange')===true
    if(audio)this.audioGeneration=audio.discontinuity.generation
  }
}
