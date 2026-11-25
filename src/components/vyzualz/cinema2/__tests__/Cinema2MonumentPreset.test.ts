import { describe, expect, it } from 'vitest'
import { CINEMA2_MONUMENT_PRESET_MANIFEST as manifest } from '../presets/Cinema2MonumentPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { MONUMENT_PATTERNS, monumentFit, monumentLines, monumentPose, type MonumentInput } from '../modules/monument/MonumentGeometry'
import { MonumentPerformance } from '../modules/monument/MonumentPerformance'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import fonts from '../modules/monument/MonumentFonts.generated.json'
const param=(name:string)=>manifest.parameters!.find(p=>p.id===`monument-${name}`)!
const input:MonumentInput={pattern:'reveal',phase:2.3,routePhase:.2,reveal:.65,contour:.4,relay:.45,kick:0,snare:0,bass:0,mid:0,high:0,build:0,drop:0,vocal:0,intensity:.75,downbeat:0,phrase:0,energy:0}
describe('MONUMENT',()=>{
  it('compiles authored and covered manifests with canonical source and pattern controls',()=>{
    const covered=withCinema2AutoCoverage(manifest,{exempt:CINEMA2_AUTO_COVERAGE_EXEMPT.monument})
    for(const m of [manifest,covered]){
      expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest:m}).diagnostics).toEqual([])
      expect(compileCinema2NativePreset(m).diagnostics).toEqual([])
      expect(new Set(m.parameters!.filter(p=>p.designParentGroup).map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
      expect(m.modules![0].parameterBindings?.userModel.$ref).toBe('monument-model')
    }
    expect(param('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(param('pattern').options).toEqual(MONUMENT_PATTERNS)
    expect(param('content-type').defaultValue).toBe('text')
    expect(param('text').defaultValue).toBe('STAGELESS')
    expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette'&&p.type==='color')).toHaveLength(7)
  })
  it('keeps six distinct bounded lighting programs',()=>{
    expect(new Set(MONUMENT_PATTERNS.map(({value})=>JSON.stringify([0,1,2,3].map(i=>monumentPose({...input,pattern:value},i))))).size).toBe(6)
    for(const {value} of MONUMENT_PATTERNS)for(let phase=0;phase<16;phase+=.25){const pose=monumentPose({...input,pattern:value,phase,kick:1,drop:1,snare:1,bass:1,high:1},4);for(const key of ['key','floor','wall','rim'] as const){expect(pose[key]).toBeGreaterThanOrEqual(0);expect(pose[key]).toBeLessThanOrEqual(1)}}
    expect(monumentPose({...input,drop:1},0).key).toBeGreaterThan(monumentPose(input,0).key)
  })
  it('preserves uniform fit, limits text and includes actual multi-contour Latin glyphs',()=>{
    for(const [w,h,d] of [[20,1,.2],[1,20,.5],[1,1,20],[2,3,4]]){const f=monumentFit(w,h,d);expect(w*f).toBeLessThanOrEqual(7.60001);expect(h*f).toBeLessThanOrEqual(4.10001);expect(d*f).toBeLessThanOrEqual(2.60001)}
    expect(monumentLines('Étage','Second','Third')).toEqual(['Étage','Second','Third'])
    expect(monumentLines('x'.repeat(100),'extra').join('').length).toBe(80)
    for(const font of [fonts.anton,fonts.stageless]){expect(font.glyphs.O.commands.filter(cmd=>cmd[0]==='m').length).toBeGreaterThanOrEqual(2);expect(font.glyphs['é'].commands.length).toBeGreaterThan(0)}
  })
  it('preserves saved source values and manual pattern edits, freezes pause and resets on track change',()=>{
    const p=new MonumentPerformance(i=>(i%7)/7),values:Record<string,unknown>={pattern:'reveal','content-type':'text',userModel:'saved-model','bpm-sync':true,'pattern-change':false,'auto-performance':false}
    const update=(time:number,paused=false,trackId='track')=>p.update({parameters:{get:(key:string)=>values[key]},frame:{contextGeneration:1,frameId:Math.round(time*60),timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:.05,audio:null,director:null,mood:null,transport:{trackId,timeSec:time,playing:!paused,paused,animationActive:!paused,bpmSync:true,bpm:120,sourcePresent:true}}} as unknown as Cinema2ModuleUpdateContext)
    update(0);update(.05);expect(p.phase).toBeGreaterThan(0);expect(p.model).toBe('default-model')
    values['content-type']='model';values.pattern='trace';update(.1);expect(p.model).toBe('saved-model');expect(p.pattern).toBe('trace')
    const phase=p.phase;update(.15,true);expect(p.phase).toBe(phase);update(.2,false,'new');expect(p.phase).toBe(0)
  })
})
