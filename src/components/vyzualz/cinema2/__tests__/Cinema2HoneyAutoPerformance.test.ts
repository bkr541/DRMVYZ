import { describe,expect,it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { CINEMA2_HONEY_PRESET_MANIFEST as manifest,honeyParameterId } from '../presets/Cinema2HoneyPreset'
import { computeCinema2AutoCoverage,withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { HONEY_DIRECTOR_ROUTES } from '../presets/Cinema2HoneyChoreography'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { readCinema2MoodPolicy } from '../conductor/Cinema2MoodPolicy'
import { isHoneyPoseSafe } from '../modules/honey/Cinema2HoneyLayout'
import { honeyRuntimeFixture } from './support/HoneyRuntimeFixture'
import { moodTwin } from './support/MoodMigrationHarness'
import type { Cinema2VisualDirectorFrame } from '../director/Cinema2VisualDirector'

const signature=(cells:ReturnType<ReturnType<typeof honeyRuntimeFixture>['tick']>['cells'])=>JSON.stringify(cells.map(c=>[c.pose,c.channels]))
const auto=honeyParameterId('auto-performance')
const covered=withCinema2AutoCoverage(manifest)
const groups=new Set(['master-controls','design','effects'])
const numeric=covered.parameters!.filter(p=>groups.has(p.designParentGroup??'')&&(p.type==='float'||p.type==='integer'))
const flat=(h:ReturnType<typeof honeyRuntimeFixture>)=>createCinema2DesignParentGroupModel(h.plan,h.state.getSnapshot()).flatMap(p=>[...p.controls,...p.groups.flatMap(g=>g.controls)].map(c=>({parent:p.id,control:c})))
const significance=(n:number,available=true)=>(d:Readonly<Cinema2VisualDirectorFrame>):Readonly<Cinema2VisualDirectorFrame>=>({...d,continuous:{...d.continuous,intensity:{...d.continuous.intensity,available,value:available?n:null}},context:{...d.context,build:{...d.context.build,available,value:available?n:null}},authority:{...d.authority,impact:{...d.authority.impact,available,authority:available?n:0}}})

describe('HONEY P05 Director and full standard Auto Performance',()=>{
  it('declares and compiles the three significance routes and completely covers all numeric controls without duplicate coverage',()=>{
    const h=honeyRuntimeFixture(),coverage=computeCinema2AutoCoverage(manifest)
    expect(coverage.drives).toEqual([]);expect(coverage.skipped).toEqual([]);expect(coverage.covered.length).toBe(numeric.length)
    expect(covered.parameters!.filter(p=>readCinema2MoodPolicy(p.metadata)==='autoPerformance')).toHaveLength(1)
    for(const [property,path] of HONEY_DIRECTOR_ROUTES){
      const rule=covered.choreography!.rules.find(r=>r.source.signal==='continuous'&&r.source.path===path)!
      expect(rule.source.capability).toBe('visual-director.significance')
      expect(h.plan.targets.choreographyTargets.some(t=>t.actionId===rule.actions[0]!.id&&t.target.property===property)).toBe(true)
    }
  })
  it('uses identical base audio but different Director authority for distinct, safe spatial output; unavailable routes are neutral',()=>{
    const low=honeyRuntimeFixture(),high=honeyRuntimeFixture(),missing=honeyRuntimeFixture()
    for(let i=0;i<12;i++){low.tick({},false,1/30,significance(0));high.tick({},false,1/30,significance(1));missing.tick({},false,1/30,significance(1,false))}
    const hit={rhythm:{...DEFAULT_MI_FRAME.rhythm,bpm:120,bpmConfidence:1,kickHit:true,kickStrength:1}}
    const a=low.tick(hit,false,1/30,significance(0)),b=high.tick(hit,false,1/30,significance(1)),c=missing.tick(hit,false,1/30,significance(1,false))
    expect(signature(a.cells)).toBe(signature(c.cells));expect(signature(a.cells)).not.toBe(signature(b.cells))
    expect(b.inspection.audio.envelopes[0]!.weight).toBeGreaterThan(a.inspection.audio.envelopes[0]!.weight)
    expect(b.inspection.audio.envelopes[0]!.coverage).toBeGreaterThan(a.inspection.audio.envelopes[0]!.coverage)
    expect(b.cells.every((cell,i)=>isHoneyPoseSafe(cell.pose)&&cell.finish===a.cells[i]!.finish&&cell.channels.every(v=>v>=0&&v<=1))).toBe(true)
  },30000)
  it('uses actual build/drop publications once, decays, clears on manual edit or Auto release and does not replay held cues',()=>{
    const h=honeyRuntimeFixture(true);h.set('auto-performance',true);h.tick();const s=h.getSource()
    let result=h.tick({energy:{...s.energy,instant:.65,buildProgress:.9},semantics:{...s.semantics,buildConfidence:.9}})
    expect(result.inspection.audio.envelopes.some(e=>e.kind==='build')).toBe(true)
    for(let i=0;i<12;i++)result=h.tick({energy:{...s.energy,instant:.65,buildProgress:.9}})
    const drop=h.tick({semanticMoments:[{id:'p05-drop',timeSec:h.getSource().timeSec+1/30,type:'drop',confidence:1}],energy:{...s.energy,instant:1}})
    expect(drop.inspection.audio.envelopes.some(e=>e.kind==='drop')).toBe(true)
    expect(drop.inspection.audio.envelopes.some(e=>e.kind==='build')).toBe(false)
    expect(h.tick({},true).inspection.audio.consumed).toBe(drop.inspection.audio.consumed)
    for(let i=0;i<55;i++)result=h.tick({semanticMoments:[],energy:{...s.energy,instant:.3},semantics:{...s.semantics,buildConfidence:0}})
    expect(result.inspection.audio.envelopes.some(e=>e.kind==='drop'||e.kind==='build')).toBe(false)
    h.set('pattern','fracture');expect(h.tick().inspection.activePattern).toBe('fracture')
    h.set('auto-performance',false);const off=h.tick();expect(off.inspection.activePattern).toBe('fracture');expect(off.inspection.audio.envelopes).toEqual([])
    expect(h.state.getValue(honeyParameterId('pattern'))).toBe('fracture')
  },30000)
  it('moves every bound numeric control in actual shared mood fixtures, leaves saved values intact and restores all on Auto off',()=>{
    const twin=moodTwin(covered,auto),saved=twin.on.state.serialize(),moved=new Set<string>()
    const targets=twin.on.plan.targets.targets.filter(t=>t.kind!=='parameter'&&t.channel==='value'&&numeric.some(p=>p.id===t.parameterId))
    for(const options of [{energy:.08,section:'breakdown'},{energy:.7,section:'verse',bass:.7,spectralFlux:.6,tension:.6},{energy:.65,build:.95,section:'build'},{energy:1,section:'drop',bass:1,high:1}]){
      twin.play(3,options)
      for(const t of targets){const a=Number(twin.on.resolver.resolve(t.id).value),b=Number(twin.off.resolver.resolve(t.id).value);if(Math.abs(a-b)>1e-6)moved.add(String(t.parameterId))}
    }
    twin.once({energy:1,event:'drop',eventId:888,section:'drop'})
    expect(numeric.filter(p=>!moved.has(String(p.id))).map(p=>p.id)).toEqual([])
    expect(twin.on.state.serialize()).toBe(saved)
    twin.on.state.setPersistentValue(auto,false);twin.once({energy:1})
    for(const t of targets)expect(twin.on.resolver.resolve(t.id).value).toEqual(twin.off.resolver.resolve(t.id).value)
  },30000)
  it('follows the real conductor through silence, return of music and missing grid without saving the effective pair',()=>{
    const h=honeyRuntimeFixture(true);h.set('auto-performance',true);h.set('pattern-change',true);h.set('trigger','snare');const saved=h.state.serialize()
    const energetic={energy:{...DEFAULT_MI_FRAME.energy,instant:.85,rms:.85}}
    let result=h.tick(energetic)
    for(let i=0;i<30;i++)result=h.tick(energetic)
    expect(result.inspection.patternControlsAutomatic).toBe(true)
    const pattern=result.inspection.activePattern
    for(let i=0;i<45;i++)result=h.tick({energy:{...DEFAULT_MI_FRAME.energy}})
    expect(result.frame.mood?.silence).toBeGreaterThan(.5)
    expect(result.inspection.effectivePatternChange).toBe(false)
    expect(result.inspection.activePattern).toBe(pattern)
    for(let i=0;i<20;i++)result=h.tick(energetic)
    expect(result.frame.mood?.silence).toBeLessThan(.5);expect(result.inspection.effectivePatternChange).toBe(true)
    result=h.tick({capabilities:{...h.getSource().capabilities!,beatGrid:false},rhythm:{...DEFAULT_MI_FRAME.rhythm}})
    expect(result.inspection).toMatchObject({patternControlsAutomatic:false,effectiveTrigger:'snare',effectivePatternChange:true})
    expect(h.state.serialize()).toBe(saved)
  },30000)
  it('keeps hard-off controls, saved palette, shared lock and fallback authority intact across re-entry',()=>{
    const h=honeyRuntimeFixture(true);h.set('pattern-change',true);h.set('trigger','snare');h.set('camera-motion',false);h.set('motion',0);h.set('bloom',0);h.set('outerGain',0);h.set('auto-performance',true)
    h.set('face',[.1,.2,.3,1]);const saved=h.state.serialize(),base=h.tick();let next=base
    for(let i=0;i<18;i++)next=h.tick({energy:{...DEFAULT_MI_FRAME.energy,instant:1,rms:1}})
    expect(next.cells.map(c=>c.pose)).toEqual(base.cells.map(c=>c.pose));expect(h.parameters.get('outerGain')).toBe(0)
    expect(h.resolver.resolve(h.plan.targets.targets.find(t=>t.kind==='effect'&&t.parameterId===honeyParameterId('bloom'))!.id).value).toBe(0)
    for(const {parent,control} of flat(h)){const editable=parent==='palette'||[auto,honeyParameterId('bpm-sync')].includes(control.definition.id);expect(!!control.locked).toBe(!editable)}
    expect(h.state.serialize()).toBe(saved);expect(next.inspection.patternControlsAutomatic).toBe(true)
    h.set('audio-reactivity',0);expect(h.tick().inspection.audio.envelopes).toEqual([])
    h.present(false);expect(h.tick().inspection).toMatchObject({patternControlsAutomatic:false,effectiveTrigger:'snare',effectivePatternChange:true})
    h.reenter();expect(h.state.getValue(honeyParameterId('face'))).toEqual([.1,.2,.3,1])
    h.set('auto-performance',false);expect(flat(h).every(x=>!x.control.locked)).toBe(true)
    const restored=new Cinema2ParameterState(h.plan.parameters);expect(restored.restore(h.state.serialize()).ok).toBe(true);expect(restored.getValue(honeyParameterId('trigger'))).toBe('snare')
  },30000)
})


describe('HON-03 shared camera shots',()=>{
  it('approaches on build and drop, pulls back on breakdown, holds pause/seek and respects saved camera permissions',()=>{
    const h=honeyRuntimeFixture(true),home=manifest.cameras![0]!.transform!.position!
    h.set('auto-performance',true);h.set('camera-sway',1);h.set('motion',1)
    const saved=h.state.serialize(),d=DEFAULT_MI_FRAME
    const section=(type:'build'|'drop'|'breakdown')=>({...d.section,type,label:type,startSec:0,endSec:120,confidence:1})
    const build={energy:{...d.energy,instant:.65,rms:.65,buildProgress:.95},semantics:{...d.semantics,buildConfidence:.95},section:section('build')}
    let shot=h.tick(build);for(let i=0;i<64;i++)shot=h.tick(build)
    expect(shot.camera.position[2]).toBeLessThan(home[2]-1)
    const buildZ=shot.camera.position[2]
    h.tick({semanticMoments:[{id:'hon03-drop',timeSec:h.getSource().timeSec+1/30,type:'drop',confidence:1}],section:section('drop')})
    for(let i=0;i<30;i++)shot=h.tick({energy:{...d.energy,instant:1,rms:1},semantics:{...d.semantics,buildConfidence:0},semanticMoments:[],section:section('drop')})
    expect(shot.camera.position[2]).toBeLessThan(buildZ-.5)
    for(let i=0;i<120;i++)shot=h.tick({energy:{...d.energy,instant:.3,rms:.3},section:section('breakdown')})
    expect(shot.camera.position[2]).toBeGreaterThan(home[2]+1)
    const before=shot.camera.position;shot=h.tick({timeSec:50});expect(Math.hypot(...shot.camera.position.map((v,i)=>v-before[i]!))).toBeLessThan(.3)
    const beforeSwap=shot.camera.position;shot=h.tick({trackId:'hon03-next-track',timeSec:1});expect(Math.hypot(...shot.camera.position.map((v,i)=>v-beforeSwap[i]!))).toBeLessThan(.35)
    h.pause(true);const paused=h.tick().camera.position;expect(h.tick({timeSec:2}).camera.position).toEqual(paused)
    expect(h.state.serialize()).toBe(saved)
    h.set('camera-motion',false);expect(h.tick().camera.position).toEqual(home)
    h.set('camera-motion',true);h.set('camera-sway',0);expect(h.tick().camera.position).toEqual(home)
    h.set('camera-sway',1);h.pause(false);h.present(false);expect(h.tick().camera.position).toEqual(home)
  },30000)
})
