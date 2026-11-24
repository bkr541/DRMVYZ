import { honeySeed } from './Cinema2HoneyDomain'
import { honeyAudioPose,type HoneyMotionControls,type HoneyVisualCell } from './Cinema2HoneyMotion'
import { honeyAudioChannels } from './Cinema2HoneyLighting'

// These are zero-neutral native numeric targets, populated solely by shared choreography.
export const HONEY_AUDIO_DEFAULTS={sub:0,bass:0,lowMid:0,mid:0,high:0,air:0,flux:0,energy:0,vocal:0,tension:0} as const
export type HoneyAudioChannels={ -readonly [K in keyof typeof HONEY_AUDIO_DEFAULTS]:number }
export const HONEY_AUDIO_REACTIVITY=.8
// Seconds: attack, hold, release. Visual envelopes, not musical event detectors.
export const HONEY_CUE_TIMES={kick:[.035,.045,.24],snare:[.025,.06,.23],beat:[.045,.025,.15],downbeat:[.07,.09,.4],bar:[.12,.1,.55],phrase:[.2,.18,.75],section:[.18,.22,.85],build:[.25,.2,.65],drop:[.055,.14,.8]} as const
export type HoneyCueKind=keyof typeof HONEY_CUE_TIMES
export interface HoneyCue { kind:HoneyCueKind;id:string;strength:number }
interface Envelope extends HoneyCue {age:number;salt:number}
const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0
const smooth=(n:number)=>{const x=clamp(n);return x*x*(3-2*x)}
const saltFor=(id:string)=>{let h=2166136261;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);return h|0}
function envelope(e:Envelope){const [a,h,r]=HONEY_CUE_TIMES[e.kind];return e.strength*(e.age<a?smooth(e.age/a):e.age<a+h?1:1-smooth((e.age-a-h)/r))}
export function isHoneyCueKind(value:unknown):value is HoneyCueKind{return typeof value==='string'&&Object.prototype.hasOwnProperty.call(HONEY_CUE_TIMES,value)}

/** Native visual state only. No raw audio sampling, clock, trigger policy or authored writes. */
export class Cinema2HoneyAudio {
  private channels:HoneyAudioChannels={...HONEY_AUDIO_DEFAULTS}
  private envelopes:Envelope[]=[]
  private seen=new Set<string>()
  private active=false
  private enabled=false
  private consumed=0
  private available=false
  private gain=0
  update(input:{channels:HoneyAudioChannels; cues:readonly HoneyCue[]; active:boolean;reset:boolean;boundary:boolean;deltaSeconds:number;reactivity:number;available:boolean}){
    const gain=clamp(input.reactivity), enabled=gain>0
    if(input.reset)this.seen.clear()
    const fresh=input.cues.filter(c=>{
      if(this.seen.has(c.id))return false
      this.seen.add(c.id)
      if(this.seen.size>2048)this.seen.delete(this.seen.values().next().value!)
      return true
    })
    const resume=input.active&&!this.active
    const changed=enabled!==this.enabled
    if(input.reset||!enabled){this.channels={...HONEY_AUDIO_DEFAULTS};this.envelopes=[]}
    else if(input.boundary||resume||changed){this.envelopes=[]}
    this.gain=gain;this.available=input.available
    if(input.active&&enabled){
      const dt=Math.max(0,Math.min(.25,input.deltaSeconds))
      for(const key of Object.keys(this.channels) as (keyof HoneyAudioChannels)[]){
        const old=this.channels[key],next=clamp(input.channels[key]);this.channels[key]=old+(next-old)*(1-Math.exp(-dt/(next>old?.075:.22)))
      }
      for(const e of this.envelopes)e.age+=dt
      this.envelopes=this.envelopes.filter(e=>e.age<HONEY_CUE_TIMES[e.kind].reduce<number>((a,b)=>a+b,0))
      if(!input.reset&&!input.boundary&&!resume&&!changed){
        for(const cue of fresh){this.envelopes.push({...cue,strength:clamp(cue.strength),age:Math.min(dt,.025),salt:saltFor(cue.id)});this.consumed++}
        // Bounded visual envelope storage under dense event streams.
        if(this.envelopes.length>64)this.envelopes.splice(0,this.envelopes.length-64)
      }
    }
    this.active=input.active;this.enabled=enabled
  }
  apply(base:HoneyVisualCell,k:HoneyMotionControls):HoneyVisualCell{
    const g=this.gain;if(g===0||(!this.envelopes.length&&Object.values(this.channels).every(v=>v===0)))return base
    const c=this.channels, q=base.q,r=base.r,cluster=(s:number)=>honeySeed(Math.floor(q/3),Math.floor(r/3),s),cell=(s:number)=>honeySeed(q,r,s)
    const low=cluster(211),bass=cluster(223),regional=cluster(227),fine=cell(229),side=(q+r)%2===0?1:-1
    // Independent spatial masks: sustained axial pressure, clustered offsets, regional coverage, and fine light detail.
    let z=c.sub*.18*(.35+.65*low)+c.bass*.24*(bass>.52?1:-.45)+c.lowMid*.13*(regional>.48?1:0)-c.tension*.13*(.3+low*.7)
    let tilt=c.mid*.36*side*(.3+.7*fine), lateral=c.bass*.008*(bass>.52?1:-1)
    let outer=c.lowMid*.26*(regional>.48?1:0)+c.energy*.18*smooth((.4+.5*c.energy-cell(233))*3)+c.flux*.21*(fine>.7?1:0)
    let inner=c.mid*.27*(side>0?1:.12)+c.high*.20*(cell(239)>.7?1:0)+c.air*.15*(cell(241)>.83?1:0)
    let under=c.sub*.30*(.15+.85*low)+c.bass*.12*(bass>.52?1:0)+c.tension*.12*regional
    for(const e of this.envelopes){
      const v=envelope(e),region=cluster(e.salt),local=cell(e.salt),selected=region>.57,opposite=region<.38
      switch(e.kind){
        case 'kick':if(selected&&side>0){z+=v*.28;under+=v*.48}break
        case 'snare':if(opposite&&side<0){z-=v*.20;inner+=v*.62}break
        case 'beat':if(local>.83){outer+=v*.28;z+=v*.035}break
        case 'downbeat':if(region>.43){z+=v*.21;outer+=v*.25;under+=v*.18}break
        case 'bar':if(selected){tilt+=v*.19*side;outer+=v*.22}break
        case 'phrase':if(region>.55){z+=v*.16;under+=v*.29}else if(opposite){z-=v*.10}break
        case 'section':if(selected){tilt-=v*.24*side;inner+=v*.31}break
        case 'build':if(selected){z-=v*.15;under+=v*.24}break
        case 'drop':if(region>.48){z+=v*.34;outer+=v*.34;under+=v*.38}else if(opposite){z-=v*.12;inner+=v*.18}break
      }
    }
    const kinetic=g*k.motion*(1-c.vocal*.55), coverage=clamp((k.coverage-cell(247))*5+.3)
    const pose=honeyAudioPose(base,k,kinetic,z,tilt,lateral)
    const channels=honeyAudioChannels(base.channels,[outer,inner,under],g,coverage)
    return {...base,pose,elevation:pose.elevation,channels}
  }
  inspect(){return {channels:{...this.channels},available:this.available,active:this.active,consumed:this.consumed,envelopes:this.envelopes.map(e=>({kind:e.kind,id:e.id,level:envelope(e)}))}}
}
