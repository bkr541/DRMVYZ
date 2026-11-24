import { describe, expect, it } from 'vitest'
import { CINEMA2_ALLSTAR_PRESET_MANIFEST as manifest, CINEMA2_ALLSTAR_PRESET_ID } from '../presets/Cinema2AllstarPreset'
import { CINEMA2_ALLSTAR_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2AllstarNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { ALLSTAR_PATTERNS, AllstarSelection, type AllstarSelectionInput } from '../modules/allstar/Cinema2AllstarPatterns'
import { AllstarGeometry, ALLSTAR_MAX_INSTANCES } from '../modules/allstar/Cinema2AllstarRenderer'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../modules/Cinema2AfterhoursNativeModule'

const defaults=manifest.modules![0]!.parameters!
const geometry=new AllstarGeometry()
const state:Parameters<AllstarGeometry['update']>[0]={number:(name:string)=>Number(defaults[name]??0),enabled:(name:string)=>defaults[name]!==false,pattern:ALLSTAR_PATTERNS[0],previous:ALLSTAR_PATTERNS[0],transition:1,travel:.4,geometryTravel:.9,spin:.4,morphPhase:.7,chase:.9,wave:.5,segments:24,motion:.75,roll:0,flash:0,silence:0}
const base:AllstarSelectionInput={authored:'infinitePassage',editRevision:0,enabled:true,trigger:'beat',event:null,auto:false,buildEvent:null,dropEvent:null,timeSec:0,beats:0,playing:true,reset:false}

describe('ALLSTAR native review preset',()=>{
  it('compiles and registers through the actual native compiler and authoring gate',()=>{
    expect(cinema2NativeModuleRegistry.get(CINEMA2_ALLSTAR_NATIVE_MODULE_TYPE_ID,1)).not.toBeNull()
    expect(cinema2NativePresetRegistry.get(CINEMA2_ALLSTAR_PRESET_ID)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({role:'keeper',manifest})).toEqual({ok:true,diagnostics:[]})
    const compiled=compileCinema2NativePreset(manifest,{availableCapabilities:manifest.capabilities!.map(c=>c.id)})
    expect(compiled.ok,compiled.diagnostics.map(d=>`${d.path}: ${d.message}`).join('\n')).toBe(true)
  })
  it('has the standard groups, canonical triggers, mood tags and independent palette roles',()=>{
    const params=manifest.parameters!, find=(name:string)=>params.find(p=>p.id===`allstar-${name}`)!
    expect(new Set(params.filter(p=>p.section==='Design').map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    expect(find('pattern').options!.map(o=>o.value)).toEqual(ALLSTAR_PATTERNS)
    expect(find('trigger').options!.map(o=>o.value)).toEqual(CINEMA2_AFTERHOURS_TRIGGER_IDS)
    expect(find('trigger').visibleWhen).toEqual([{kind:'parameter-equals',parameterId:'allstar-pattern-change',value:true}])
    expect(find('auto-performance').metadata?.moodPolicy).toBe('autoPerformance')
    expect(find('pattern-change').metadata?.moodPolicy).toBe('patternChange')
    expect(find('trigger').metadata?.moodPolicy).toBe('trigger')
    expect(params.filter(p=>p.designParentGroup==='palette')).toHaveLength(7)
  })
  it('builds finite distinct world-space geometry for each pattern within the fixed budget',()=>{
    const layouts=new Set<string>()
    for(const pattern of ALLSTAR_PATTERNS){geometry.update({...state,pattern,previous:pattern} as Parameters<AllstarGeometry['update']>[0]);expect(geometry.count).toBeGreaterThan(200);expect(geometry.count).toBeLessThan(ALLSTAR_MAX_INSTANCES);const data=geometry.data.slice(0,geometry.count*12);expect(data.every(Number.isFinite)).toBe(true);layouts.add(JSON.stringify(data))}
    expect(layouts.size).toBe(12)
  })
  it('honors geometry, perimeter, fixture and flash permissions',()=>{
    geometry.update({...state,enabled:name=>!['geometry','perimeterLighting','recessedFixtures'].includes(name)})
    for(let i=0;i<geometry.count;i++)expect(geometry.data[i*12+7]).toBeLessThan(2)
    geometry.update({...state,number:name=>['snareAccent','dropAccent'].includes(name)?1:state.number(name),flash:0});const off=geometry.data.slice(0,geometry.count*12)
    geometry.update({...state,number:name=>['snareAccent','dropAccent'].includes(name)?1:state.number(name),flash:1});expect(geometry.data.slice(0,geometry.count*12)).not.toEqual(off)
  })
  it('advances each trigger once, preserves manual pattern change and restores runtime base after an override',()=>{
    for(const trigger of CINEMA2_AFTERHOURS_TRIGGER_IDS){const select=new AllstarSelection();select.update({...base,trigger});expect(select.update({...base,trigger,event:'new'}).base).toBe('starEruption');expect(select.update({...base,trigger,event:'new'}).base).toBe('starEruption');expect(select.update({...base,trigger,authored:'darkAperture',editRevision:1,event:'new'}).base).toBe('darkAperture');expect(select.update({...base,trigger,authored:'darkAperture',editRevision:1,event:'next'}).base).toBe('chromaticRelay')}
    const select=new AllstarSelection();select.update({...base,auto:true});const active=select.update({...base,auto:true,event:'beat1',dropEvent:'drop1',timeSec:1});expect(active.performing).toBe('radiantDischarge');expect(active.base).toBe('starEruption');expect(select.update({...base,auto:true,event:'beat2',timeSec:1.5}).base).toBe('fracturedPrism');expect(select.update({...base,auto:true,timeSec:3}).performing).toBe('fracturedPrism')
  })
})
