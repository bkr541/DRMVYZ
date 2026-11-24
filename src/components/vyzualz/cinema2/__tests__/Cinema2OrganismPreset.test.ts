import { describe, expect, it } from 'vitest'
import { CINEMA2_ORGANISM_PRESET_MANIFEST as manifest, CINEMA2_ORGANISM_PRESET_ID } from '../presets/Cinema2OrganismPreset'
import { CINEMA2_ORGANISM_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2OrganismNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage, computeCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { ORGANISM_DEFAULTS, ORGANISM_PALETTE, ORGANISM_PATTERNS, organismBranchPoint, organismChildPoint, organismIllumination, organismLightPosition, type OrganismState } from '../modules/organism/Cinema2OrganismDomain'
import { OrganismSelection, type OrganismSelectionInput } from '../modules/organism/Cinema2OrganismPatterns'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../modules/Cinema2AfterhoursNativeModule'

const state:OrganismState={values:{...ORGANISM_DEFAULTS},pattern:'respiration',previous:'respiration',transition:1,phase:1,motion:.8,flash:.28,silence:0,projectionPhase:0,palette:{...ORGANISM_PALETTE}}
const base:OrganismSelectionInput={authored:'respiration',revision:0,patternChange:true,trigger:'beat',event:null,auto:false,buildEvent:null,dropEvent:null,time:0,beat:0,active:true,reset:false}

describe('ORGANISM native review preset',()=>{
  it('registers and validates native and catalog-covered manifests',()=>{
    expect(cinema2NativeModuleRegistry.get(CINEMA2_ORGANISM_NATIVE_MODULE_TYPE_ID,1)).not.toBeNull()
    expect(cinema2NativePresetRegistry.get(CINEMA2_ORGANISM_PRESET_ID)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest})).toEqual({ok:true,diagnostics:[]})
    for(const candidate of [manifest,withCinema2AutoCoverage(manifest)]){
      const result=compileCinema2NativePreset(candidate,{availableCapabilities:candidate.capabilities!.map(c=>c.id)})
      expect(result.ok,JSON.stringify(result.diagnostics)).toBe(true)
    }
    expect(computeCinema2AutoCoverage(manifest).skipped).toEqual([])
  })
  it('uses the four shared Design groups, six palette roles, and canonical trigger controls',()=>{
    const params=manifest.parameters!,find=(name:string)=>params.find(p=>p.id===`organism-${name}`)!
    expect(new Set(params.filter(p=>p.section==='Design').map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    expect(find('pattern').options!.map(o=>o.value)).toEqual(ORGANISM_PATTERNS)
    expect(find('trigger').options!.map(o=>o.value)).toEqual(CINEMA2_AFTERHOURS_TRIGGER_IDS)
    expect(find('trigger').visibleWhen).toEqual([{kind:'parameter-equals',parameterId:'organism-pattern-change',value:true}])
    expect(find('auto-performance').metadata?.moodPolicy).toBe('autoPerformance')
    expect(params.filter(p=>p.designParentGroup==='palette')).toHaveLength(6)
  })
  it('keeps all patterns bounded and distinct even at high music energy',()=>{
    const signatures=new Set<string>()
    for(const pattern of ORGANISM_PATTERNS){
      const s={...state,pattern,previous:pattern,values:{...state.values,reach:1.25,bend:1.2,growth:1,coreScale:1.3,subAmount:1,bassPressure:1,dropAccent:1,buildAmount:1}}
      const coords:number[]=[]
      for(let i=0;i<12;i++)for(let j=0;j<=16;j++){
        const t=j/16
        for(const p of [organismBranchPoint(s,i,t),organismChildPoint(s,i,-1,t),organismChildPoint(s,i,1,t)]){
          expect(p.every(Number.isFinite)).toBe(true)
          expect(Math.abs(p[0])<=6.2&&Math.abs(p[2])<=6.2&&p[1]>=-4.85&&p[1]<=5.5).toBe(true)
          coords.push(...p)
        }
      }
      signatures.add(JSON.stringify([...coords,organismIllumination(s,2,.7),organismLightPosition(s,0)]))
    }
    expect(signatures.size).toBe(8)
  })
  it('deduplicates eleven triggers, respects manual takeover and resets on source changes',()=>{
    for(const trigger of CINEMA2_AFTERHOURS_TRIGGER_IDS){
      const select=new OrganismSelection();select.update({...base,trigger})
      expect(select.update({...base,trigger,event:'one'}).base).toBe('synaptic')
      expect(select.update({...base,trigger,event:'one'}).base).toBe('synaptic')
      expect(select.update({...base,trigger,event:'one',authored:'vortex',revision:1}).base).toBe('vortex')
      expect(select.update({...base,trigger,event:'two',authored:'vortex',revision:1}).base).toBe('pulse')
      select.reset();expect(select.update({...base,trigger,event:'two',authored:'vortex',revision:1}).base).toBe('vortex')
    }
  })
  it('temporarily performs build/drop patterns without changing the authored base',()=>{
    const select=new OrganismSelection();select.update({...base,auto:true})
    expect(select.update({...base,auto:true,buildEvent:'b1',time:.5}).performing).toBe('bloom')
    const drop=select.update({...base,auto:true,event:'one',dropEvent:'d1',time:1})
    expect(drop.performing).toBe('colossus');expect(drop.base).toBe('synaptic')
    expect(select.update({...base,auto:true,event:'two',time:1.2}).base).toBe('bloom')
    expect(select.update({...base,auto:true,time:3}).performing).toBe('bloom')
    expect(select.update({...base,auto:false,time:4}).performing).toBe('respiration')
  })
})
