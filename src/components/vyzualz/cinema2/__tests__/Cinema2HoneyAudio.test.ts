import { describe,expect,it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { CINEMA2_HONEY_PRESET_MANIFEST as manifest,honeyParameterId } from '../presets/Cinema2HoneyPreset'
import { HONEY_AUDIO_ROUTES,HONEY_CUE_ROUTES } from '../presets/Cinema2HoneyChoreography'
import { isHoneyPoseSafe } from '../modules/honey/Cinema2HoneyLayout'
import type { HoneyVisualCell } from '../modules/honey/Cinema2HoneyMotion'
import { honeyRuntimeFixture as fixture } from './support/HoneyRuntimeFixture'

const signature=(cells:readonly HoneyVisualCell[])=>JSON.stringify(cells.filter(c=>Math.abs(c.x)<6&&Math.abs(c.y)<4).map(c=>[c.pose,c.channels]))
const poses=(cells:readonly HoneyVisualCell[])=>cells.map(c=>c.pose)
const lights=(cells:readonly HoneyVisualCell[])=>cells.map(c=>c.channels)
const bandKeys=['normalizedSub','normalizedBass','normalizedLowMid','normalizedMid','normalizedHigh','normalizedAir'] as const
function continuous(patch:Partial<MusicIntelligenceFrame>,reactivity=.8){const h=fixture();h.set('audio-reactivity',reactivity);const saved=h.state.serialize();let result=h.tick();for(let i=0;i<15;i++)result=h.tick(patch);expect(h.state.serialize()).toBe(saved);expect(result.cells.every(c=>isHoneyPoseSafe(c.pose)&&c.channels.every(v=>v>=0&&v<=1))).toBe(true);return result}

describe('HONEY canonical audio choreography',()=>{
  it('compiles unique continuous module targets and hidden action bindings with declared capabilities',()=>{
    const rules=manifest.choreography!.rules.filter(r=>r.id.startsWith('honey-audio-')||r.id.startsWith('honey-event-'))
    expect(rules).toHaveLength(HONEY_AUDIO_ROUTES.length+HONEY_CUE_ROUTES.length)
    expect(new Set(rules.map(r=>r.actions[0]!.id)).size).toBe(rules.length)
    for(const rule of rules)expect(manifest.capabilities?.some(c=>c.id===rule.source.capability&&c.requirement==='optional')).toBe(true)
    expect(manifest.parameters?.find(p=>p.id===honeyParameterId('musical-cue'))).toMatchObject({type:'trigger',exposure:'hidden',persistence:'runtime-only'})
    expect(manifest.parameters?.find(p=>p.id===honeyParameterId('audio-reactivity'))).toMatchObject({defaultValue:.8,min:0,max:1,designParentGroup:'master-controls'})
  })
  it('six isolated bands, flux, energy and tension produce distinct matched-time native draw records',()=>{
    const base=continuous({}),patches:Partial<MusicIntelligenceFrame>[]=[...bandKeys.map(key=>({bands:{...DEFAULT_MI_FRAME.bands,[key]:1}})),{energy:{...DEFAULT_MI_FRAME.energy,spectralFlux:1}},{energy:{...DEFAULT_MI_FRAME.energy,instant:1}},{energy:{...DEFAULT_MI_FRAME.energy,buildProgress:1}}]
    const signatures=new Set([signature(base.cells)])
    for(const patch of patches)signatures.add(signature(continuous(patch).cells))
    expect(signatures.size).toBe(patches.length+1)
    const sub=continuous(patches[0]!),high=continuous(patches[4]!)
    expect(poses(sub.cells)).not.toEqual(poses(base.cells));expect(poses(high.cells)).toEqual(poses(base.cells))
    expect(lights(sub.cells)).not.toEqual(lights(high.cells))
    expect(signature(continuous(patches[0]!,0).cells)).toBe(signature(continuous({},0).cells))
  },30000)
  it('keeps unavailable bands neutral, distinguishes availability from measured zero and restrains sustained bass with vocals',()=>{
    const source=fixture().getSource(),silent=continuous({}),missing=continuous({trackId:null,capabilities:{...source.capabilities!,liveBands:false,rhythmEvents:false,stemCurves:false,sections:false},bands:{...source.bands,normalizedSub:1}})
    expect(silent.inspection.audio.available).toBe(true);expect(missing.inspection.audio.available).toBe(false);expect(missing.inspection.audio.channels.sub).toBe(0)
    const patch={bands:{...source.bands,normalizedSub:1,normalizedBass:1}},bass=continuous(patch),vocal=continuous({...patch,stems:{...source.stems,vocalActivity:1}})
    const displacement=(cells:readonly HoneyVisualCell[])=>cells.reduce((s,c,i)=>s+Math.abs(c.elevation-silent.cells[i]!.elevation),0)
    expect(displacement(vocal.cells)).toBeLessThan(displacement(bass.cells));expect(vocal.inspection.audio.channels.vocal).toBeGreaterThan(.9)
  },30000)
  it('dispatches distinct kick, snare, downbeat, phrase and drop cues, once for a held identity',()=>{
    const signatures=new Set<string>()
    for(const kind of ['kick','snare','downbeat','phrase','drop'] as const){
      const h=fixture();h.tick();const s=h.getSource(),time=s.timeSec+.04
      const patch:Partial<MusicIntelligenceFrame>=kind==='phrase'?{phraseMarkers:[{id:'phrase',timeSec:time,phraseLength:4,confidence:1}]}:kind==='drop'?{semanticMoments:[{id:'drop',timeSec:time,type:'drop',confidence:1}]}:{rhythm:{...s.rhythm,...(kind==='kick'?{kickHit:true,kickStrength:1}:kind==='snare'?{snareHit:true,snareStrength:1}:{downbeatHit:true})}}
      const first=h.tick(patch,false,.04);expect(first.inspection.audio.consumed).toBe(1);expect(first.inspection.audio.envelopes[0]?.kind).toBe(kind)
      const held=h.tick({},true,.04);expect(held.inspection.audio.consumed).toBe(1);signatures.add(signature(held.cells));expect(held.cells.every(c=>isHoneyPoseSafe(c.pose))).toBe(true)
    }
    expect(signatures.size).toBe(5)
  },30000)
  it('dispatches beat, bar, build threshold and section transition without replacing the authored pattern',()=>{
    for(const kind of ['beat','bar','build','section'] as const){
      const h=fixture(),source=h.getSource();h.set('pattern','fracture');h.tick(kind==='section'?{section:{...source.section,type:'intro',label:'Intro',startSec:0,endSec:2,confidence:1}}:{})
      const s=h.getSource(),patch:Partial<MusicIntelligenceFrame>=kind==='beat'?{rhythm:{...s.rhythm,beatHit:true,beatIndex:1,beatEventId:1}}:kind==='bar'?{rhythm:{...s.rhythm,phrase4Hit:true,beatIndex:4}}:kind==='build'?{semantics:{...s.semantics,buildConfidence:.9}}:{section:{...s.section,type:'breakdown',label:'Breakdown',startSec:2,endSec:4,confidence:1}}
      const first=h.tick(patch);expect(first.inspection.audio.consumed).toBe(1);expect(first.inspection.audio.envelopes[0]?.kind).toBe(kind);expect(first.inspection.activePattern).toBe('fracture')
      expect(h.tick({},true).inspection.audio.consumed).toBe(1);expect(h.state.getValue(honeyParameterId('pattern'))).toBe('fracture')
    }
  })
  it('keeps pattern switching independent of cue dispatch and both sync switches',()=>{
    const h=fixture();h.set('pattern-change',true);h.set('trigger','kick');h.set('bpm-sync',false);h.sync(false);h.tick();const saved=h.state.serialize()
    const s=h.getSource(),r=h.tick({rhythm:{...s.rhythm,kickHit:true,kickStrength:1}})
    expect(r.inspection).toMatchObject({activePattern:'shockwave',locked:false,transitioning:true});expect(r.inspection.audio.consumed).toBe(1);expect(h.state.serialize()).toBe(saved)
    expect(h.tick({},true).inspection.audio.consumed).toBe(1)
  })
  it('holds pause, consumes resume/seek/track and edit boundaries, freezes poses while retaining light, and resumes on a fresh event',()=>{
    const h=fixture();h.tick();const hit=()=>({rhythm:{...h.getSource().rhythm,kickHit:true,kickStrength:1}})
    const first=h.tick(hit());expect(first.inspection.audio.consumed).toBe(1)
    h.pause(true);expect(signature(h.tick({},true).cells)).toBe(signature(first.cells));h.pause(false)
    expect(h.tick({},true).inspection.audio.envelopes).toHaveLength(0)
    expect(h.tick(hit()).inspection.audio.consumed).toBe(2)
    const sought=h.tick({...hit(),timeSec:.1});expect(sought.inspection.audio.envelopes).toHaveLength(0)
    expect(h.tick({},true).inspection.audio.consumed).toBe(2)
    expect(h.tick(hit()).inspection.audio.consumed).toBe(3)
    expect(h.tick({...hit(),trackId:'other'}).inspection.audio.envelopes).toHaveLength(0)
    h.set('trigger','snare');expect(h.tick(hit()).inspection.audio.envelopes).toHaveLength(0)
    h.set('audio-reactivity',0);expect(h.tick(hit()).inspection.audio.envelopes).toHaveLength(0)
    h.set('audio-reactivity',.8);expect(h.tick({},true).inspection.audio.envelopes).toHaveLength(0)
    const before=h.tick();h.set('motion',0);const frozen=h.tick(hit());expect(poses(frozen.cells)).toEqual(poses(before.cells));expect(lights(frozen.cells)).not.toEqual(lights(before.cells))
    h.present(false);expect(h.tick().inspection.audio.envelopes).toHaveLength(0);h.present(true);h.reenter();expect(h.tick(hit()).inspection.audio.consumed).toBe(0)
  },30000)
})
