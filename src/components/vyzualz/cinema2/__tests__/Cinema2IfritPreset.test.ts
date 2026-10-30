import { describe, expect, it } from 'vitest'
import { CINEMA2_IFRIT_PRESET_ID, CINEMA2_IFRIT_PRESET_MANIFEST } from '../presets/Cinema2IfritPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_IFRIT_MODULE_TYPE } from '../modules/Cinema2IfritNativeModule'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { IFRIT_PATTERNS, ifritParameterId as pid } from '../modules/ifrit/Cinema2IfritDomain'
import { IfritPerformance, type IfritPerformanceInput } from '../modules/ifrit/Cinema2IfritPerformance'

const defaults: IfritPerformanceInput = { authored:'infernalPassage',editRevision:0,enabled:true,trigger:'beat',event:null,auto:true,buildEvent:null,dropEvent:null,timeSec:0,beats:0,playing:true,reset:false }
describe('Ifrit authoring and performance authority',()=>{
  it('compiles through production registration without claiming final human acceptance',()=>{
    const declaration=CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(d=>d.manifest.id===CINEMA2_IFRIT_PRESET_ID)!
    expect(declaration.role).toBe('reference')
    expect(validateCinema2PresetAuthoringConventions(declaration)).toEqual({ok:true,diagnostics:[]})
    const result=cinema2NativePresetRegistry.compile(CINEMA2_IFRIT_PRESET_ID,{availableCapabilities:['render.webgl2','render.depth','scene.3d','camera.world']})
    expect(result.diagnostics.filter(d=>d.severity==='error')).toEqual([])
    expect(result.ok).toBe(true)
    expect(cinema2NativeModuleRegistry.get(CINEMA2_IFRIT_MODULE_TYPE,1)).not.toBeNull()
  })
  it('declares canonical controls, four independent Palette roles and generic placement',()=>{
    const parameters=CINEMA2_IFRIT_PRESET_MANIFEST.parameters!
    const get=(key:string)=>parameters.find(p=>p.id===pid(key))!
    expect(get('pattern').options?.map(p=>p.value)).toEqual(IFRIT_PATTERNS)
    expect(get('pattern-change')).toMatchObject({type:'boolean',defaultValue:false,designParentGroup:'design'})
    expect(get('trigger')).toMatchObject({options:CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,designParentGroup:'design',visibleWhen:[{kind:'parameter-equals',parameterId:pid('pattern-change'),value:true}]})
    expect(get('bpm-sync')).toMatchObject({type:'boolean',designParentGroup:'master-controls'})
    expect(CINEMA2_IFRIT_PRESET_MANIFEST.choreography?.tempoSyncParameter).toEqual({$ref:pid('bpm-sync')})
    expect(parameters.filter(p=>p.type==='color'&&p.designParentGroup==='palette')).toHaveLength(4)
    expect(parameters.every(p=>['master-controls','design','effects','palette'].includes(p.designParentGroup!))).toBe(true)
    expect(get('pattern').metadata).toBeUndefined()
  })
  it('suppresses stale events, accepts repeated manual selection and rebases Trigger edits',()=>{
    const c=new IfritPerformance(),u=(p:Partial<IfritPerformanceInput>)=>c.update({...defaults,auto:false,...p})
    u({event:'held'})
    expect(u({event:'held'}).base).toBe('infernalPassage')
    expect(u({event:'fresh'}).base).toBe('twistedDescent')
    expect(u({event:'fresh',editRevision:1}).base).toBe('infernalPassage')
    expect(u({event:'fresh',editRevision:1,trigger:'kick'}).base).toBe('infernalPassage')
    expect(u({event:'next',editRevision:1,trigger:'kick'}).base).toBe('twistedDescent')
    expect(u({event:'next',editRevision:1,trigger:'kick',enabled:false}).base).toBe('infernalPassage')
  })
  it('advances underneath overrides and restores the correct runtime base',()=>{
    const c=new IfritPerformance(),u=(p:Partial<IfritPerformanceInput>)=>c.update({...defaults,...p})
    u({})
    expect(u({buildEvent:'build-a',timeSec:.1}).performing).toBe('compressionChamber')
    expect(u({buildEvent:'build-a',event:'a',timeSec:.2})).toMatchObject({base:'twistedDescent',performing:'compressionChamber'})
    expect(u({buildEvent:'build-a',event:'b',timeSec:.3})).toMatchObject({base:'counterfire',performing:'compressionChamber'})
    expect(u({event:'b',timeSec:.4})).toMatchObject({base:'counterfire',performing:'counterfire',overridden:false})
  })
  it('bounds override duration and never allows an active event to cancel a manual edit',()=>{
    const c=new IfritPerformance(),u=(p:Partial<IfritPerformanceInput>)=>c.update({...defaults,...p})
    u({})
    u({buildEvent:'build-a',timeSec:1})
    expect(u({buildEvent:'build-a',timeSec:5.1}).overridden).toBe(false)
    u({dropEvent:'drop-a',timeSec:5.2})
    expect(u({dropEvent:'drop-a',authored:'emberRelay',editRevision:1,timeSec:5.3}).performing).toBe('emberRelay')
    expect(u({dropEvent:'drop-a',authored:'emberRelay',editRevision:1,timeSec:5.4}).performing).toBe('emberRelay')
    expect(u({dropEvent:'drop-b',authored:'emberRelay',editRevision:1,timeSec:5.5}).performing).toBe('riftLock')
    expect(u({dropEvent:'drop-b',authored:'emberRelay',editRevision:1,timeSec:6.8}).performing).toBe('emberRelay')
  })
  it('honors paused manual takeover and resets volatile state on re-entry',()=>{
    const c=new IfritPerformance(),u=(p:Partial<IfritPerformanceInput>)=>c.update({...defaults,...p})
    u({});u({dropEvent:'a',timeSec:.1})
    expect(u({dropEvent:'a',auto:false,playing:false,timeSec:.1}).performing).toBe('infernalPassage')
    c.reset()
    expect(u({dropEvent:'a',reset:true,timeSec:0})).toMatchObject({base:'infernalPassage',performing:'infernalPassage',overridden:false})
  })
})
