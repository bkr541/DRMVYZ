import { describe,expect,it } from 'vitest'
import { CINEMA2_HUD_PRESET_MANIFEST as manifest,CINEMA2_HUD_PRESET_ID,hudParameterId } from '../presets/Cinema2HudPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../modules/Cinema2AfterhoursNativeModule'
import { HUD_COLOR_KEYS,HUD_DEFAULTS,HUD_PATTERNS,HUD_PERIPHERAL_PRIMITIVES,HUD_STRIDE,blendHud,buildHudMesh,sampleHud,zeroHudSignals } from '../modules/hud/Cinema2HudGeometry'
import { hudRuntimeFixture } from './support/HudRuntimeFixture'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'

const signals=zeroHudSignals()
const difference=(a:Float32Array,b:Float32Array)=>a.some((v,i)=>v!==b[i])

describe('HUD native preset',()=>{
  it('compiles through the first-party gate with canonical controls and a real depth render graph',()=>{
    const result=compileCinema2NativePreset(withCinema2AutoCoverage(manifest));expect(result.ok).toBe(true)
    expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest}).ok).toBe(true)
    const params=manifest.parameters!
    expect(new Set(params.map(p=>p.id)).size).toBe(params.length)
    expect(new Set(params.map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    expect(params.find(p=>p.id===hudParameterId('trigger'))?.options?.map(v=>v.value)).toEqual(CINEMA2_AFTERHOURS_TRIGGER_IDS)
    expect(params.find(p=>p.id===hudParameterId('pattern'))?.options?.map(v=>v.value)).toEqual(HUD_PATTERNS)
    for(const key of HUD_COLOR_KEYS)expect(params.find(p=>p.id===hudParameterId(key))?.type).toBe('color')
    expect(manifest.id).toBe(CINEMA2_HUD_PRESET_ID)
    expect(manifest.render?.targets?.[0]?.descriptor.depthFormat).toBe('depth24')
  })
  it('authors nine distinct animated programs with bounded, finite, stable geometry',()=>{
    const mesh=buildHudMesh();expect(mesh.length%9).toBe(0);expect(mesh.every(Number.isFinite)).toBe(true)
    const samples=HUD_PATTERNS.map(p=>sampleHud(p,2.31,HUD_DEFAULTS,signals))
    for(const [i,a] of samples.entries()){
      expect(a.length%HUD_STRIDE).toBe(0);expect(a.every(Number.isFinite)).toBe(true);expect(a.length).toBe(samples[0]!.length)
      expect(difference(a,sampleHud(HUD_PATTERNS[i]!,3.11,HUD_DEFAULTS,signals))).toBe(true)
      for(const b of samples.slice(i+1))expect(difference(a,b)).toBe(true)
    }
    expect(mesh.length/9*samples[0]!.length/HUD_STRIDE).toBeLessThan(300000)
  })
  it('appends a stable peripheral instrument layer without changing the core or its aspect behavior',()=>{
    const peripheralSize=HUD_PERIPHERAL_PRIMITIVES*HUD_STRIDE
    const wide=sampleHud('reactor',2,HUD_DEFAULTS,signals,16/9)
    expect(wide.length/HUD_STRIDE).toBe(1068+HUD_PERIPHERAL_PRIMITIVES)
    const core=wide.slice(0,-peripheralSize),outer=wide.slice(-peripheralSize)
    for(const aspect of [21/9,4/3,1,9/16]){
      const geometry=sampleHud('reactor',2,HUD_DEFAULTS,signals,aspect)
      expect(geometry.slice(0,-peripheralSize)).toEqual(core)
      expect(difference(geometry.slice(-peripheralSize),outer)).toBe(true)
      expect(geometry.length).toBe(wide.length)
    }
    for(const pattern of HUD_PATTERNS){
      const next=sampleHud(pattern,2,HUD_DEFAULTS,signals,9/16)
      const mixed=blendHud(wide,next,.5)
      expect(mixed.every(Number.isFinite)).toBe(true)
      for(let i=wide.length-peripheralSize;i<wide.length;i+=HUD_STRIDE){
        expect(next[i+8]).toBe(wide[i+8]) // stable palette role
        expect(next[i+10]).toBe(wide[i+10]) // stable geometry kind
      }
    }
  })
  it('separates peripheral highs and snare from bass-driven core meters, with bounded gains and framing',()=>{
    const sample=(s=signals,aspect=16/9)=>sampleHud('reactor',2,HUD_DEFAULTS,s,aspect)
    const size=HUD_PERIPHERAL_PRIMITIVES*HUD_STRIDE,base=sample()
    const outer=(g:Float32Array)=>g.slice(-size)
    const bass=sample({...signals,bass:1})
    expect(difference(base.slice(0,-size),bass.slice(0,-size))).toBe(true)
    expect(outer(bass)).toEqual(outer(base))
    for(const key of ['high','air','flux','snare','phrase','drop'] as const){
      expect(difference(outer(sample({...signals,[key]:1})),outer(base))).toBe(true)
      expect(outer(sampleHud('reactor',2,{...HUD_DEFAULTS,reactivity:0},{...signals,[key]:1}))).toEqual(outer(sampleHud('reactor',2,{...HUD_DEFAULTS,reactivity:0},signals)))
    }
    // Conservative centered-camera bounds, including solid primitive extents,
    // across the existing min-aspect fit and maximum normalized signal input.
    const peak=Object.fromEntries(Object.keys(signals).map(key=>[key,1])) as typeof signals
    for(const aspect of [21/9,16/9,4/3,1,9/16])for(const pattern of HUD_PATTERNS){
      const g=outer(sampleHud(pattern,3.7,HUD_DEFAULTS,peak,aspect))
      for(let i=0;i<g.length;i+=HUD_STRIDE){
        const [x,y,z,r,angle,span,width,depth,role,gain,mode]=g.subarray(i,i+HUD_STRIDE)
        expect(gain).toBeGreaterThanOrEqual(0);expect(gain).toBeLessThan(2)
        const halfY=(13-z!-depth!/2)*Math.tan(38*Math.PI/360)*Math.max(1,1.3/aspect)
        const halfX=halfY*aspect
        const count=mode===1?2:13
        for(let j=0;j<count;j++){
          const u=j/(count-1),theta=mode===1?angle!:angle!+span!*u
          const dist=mode===1?r!*(u-.5):r!
          expect(Math.abs(x!+Math.cos(theta)*dist)+width!/2).toBeLessThan(halfX)
          expect(Math.abs(y!+Math.sin(theta)*dist)+width!/2).toBeLessThan(halfY)
        }
        expect(role).toBeGreaterThanOrEqual(1);expect(role).toBeLessThanOrEqual(4)
      }
    }
  })
  it('changes geometry with each authored numeric design control and distinct audio routes',()=>{
    const base=sampleHud('reactor',2,HUD_DEFAULTS,signals)
    for(const key of ['intensity','separation','coverage','satelliteAmount','shutter','meterTravel'] as const)expect(difference(base,sampleHud('reactor',2,{...HUD_DEFAULTS,[key]:0},signals))).toBe(true)
    for(const key of ['sub','bass','mid','high','air','flux','vocal','build','directorIntensity','directorBuild','directorImpact','kick','snare','beat','downbeat','bar','phrase','section','drop'] as const){
      expect(difference(base,sampleHud('reactor',2,HUD_DEFAULTS,{...signals,[key]:1}))).toBe(true)
      expect(sampleHud('reactor',2,{...HUD_DEFAULTS,reactivity:0},{...signals,[key]:1})).toEqual(sampleHud('reactor',2,{...HUD_DEFAULTS,reactivity:0},signals))
    }
  })
  it('uses the shared clock, pauses, permits manual selection while cycling, and resets on re-entry',()=>{
    const f=hudRuntimeFixture();f.set('patternChange',true);f.set('trigger','kick');f.tick();const first=f.tick();expect(first.inspection.locked).toBe(true)
    f.set('pattern','orbital');expect(f.tick().inspection.activePattern).toBe('orbital');expect(f.state.getValue(hudParameterId('patternChange'))).toBe(true)
    f.set('bpmSync',false);expect(f.tick().inspection.locked).toBe(false)
    f.pause(true);const held=f.tick();expect(f.tick({},true).inspection.phase).toBe(held.inspection.phase)
    f.pause(false);f.reenter();expect(f.tick().inspection.activePattern).toBe('orbital')
  })
  it('routes actual MI bass and kick through the compiled choreography and keeps saved values unchanged',()=>{
    const f=hudRuntimeFixture();f.set('motion',0);f.set('patternChange',true);f.set('trigger','kick');f.tick();f.tick()
    const before=f.tick(),saved=f.state.serialize()
    let after=f.tick({bands:{...DEFAULT_MI_FRAME.bands,normalizedBass:1}})
    for(let i=0;i<8;i++)after=f.tick()
    expect(f.parameters.get('bass')).toBeGreaterThan(.5);expect(difference(before.geometry,after.geometry)).toBe(true)
    const kick={...f.getSource().rhythm,kickHit:true,kickStrength:1,transientConfidence:1}
    const changed=f.tick({rhythm:kick});expect(changed.inspection.activePattern).not.toBe(before.inspection.activePattern)
    const held=f.tick({},true);expect(held.inspection.activePattern).toBe(changed.inspection.activePattern)
    expect(f.state.serialize()).toBe(saved)
    f.set('pattern','reactor');expect(f.tick({},true).inspection.activePattern).toBe('reactor')
    expect(f.state.getValue(hudParameterId('patternChange'))).toBe(true)
  })
  it('preserves persisted controls when the shared conductor is enabled and releases them when disabled',()=>{
    const f=hudRuntimeFixture(true);f.set('autoPerformance',true);const saved=f.state.serialize();f.tick()
    for(let i=0;i<18;i++)f.tick({energy:{...DEFAULT_MI_FRAME.energy,instant:.85,rms:.85,buildProgress:.7}})
    expect(f.state.serialize()).toBe(saved);expect(f.tick().inspection.patternControlsAutomatic).toBe(true)
    f.set('autoPerformance',false);expect(f.tick().inspection.patternControlsAutomatic).toBe(false)
    expect(f.parameters.get('intensity')).toBe(f.state.getValue(hudParameterId('intensity')))
  })
})
