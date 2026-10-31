import { describe, expect, it } from 'vitest'
import { CINEMA2_TRIPPY_BRO_PRESET_ID, CINEMA2_TRIPPY_BRO_PRESET_MANIFEST } from '../presets/Cinema2TrippyBroPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { CINEMA2_TRIPPY_BRO_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2TrippyBroNativeModule'
import { TRIPPY_BRO_PATTERNS, trippyBroParameterId as pid } from '../modules/trippyBro/Cinema2TrippyBroDomain'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { TrippyBroPerformance, type TrippyBroPerformanceInput } from '../modules/trippyBro/Cinema2TrippyBroPerformance'

const defaults: TrippyBroPerformanceInput = { authored:'prismLattice',editRevision:0,enabled:false,trigger:'beat',event:null,auto:false,buildEvent:null,dropEvent:null,timeSec:0,beats:0,playing:true,reset:false }
describe('Trippy, Bro native performance', () => {
  it('ships as an approved keeper and compiles through production registration', () => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(entry => entry.manifest.id === CINEMA2_TRIPPY_BRO_PRESET_ID)
    expect(declaration?.role).toBe('keeper')
    expect(validateCinema2PresetAuthoringConventions(declaration!)).toEqual({ok:true,diagnostics:[]})
    expect(CINEMA2_TRIPPY_BRO_PRESET_MANIFEST.metadata.tags).not.toContain('reference')
    expect(CINEMA2_TRIPPY_BRO_PRESET_MANIFEST.metadata.tags).not.toContain('internal')
    const result = cinema2NativePresetRegistry.compile(CINEMA2_TRIPPY_BRO_PRESET_ID,{availableCapabilities:['render.webgl2','render.history']})
    expect(result.diagnostics.filter(d=>d.severity==='error')).toEqual([])
    expect(result.ok).toBe(true)
    expect(cinema2NativeModuleRegistry.get(CINEMA2_TRIPPY_BRO_NATIVE_MODULE_TYPE_ID,1)).not.toBeNull()
  })
  it('authors mandatory controls, canonical triggers, independent colors and four-parent placement', () => {
    const p=CINEMA2_TRIPPY_BRO_PRESET_MANIFEST.parameters!
    const byId=(name:string)=>p.find(p=>p.id===pid(name))!
    expect(byId('pattern').options?.map(o=>o.value)).toEqual(TRIPPY_BRO_PATTERNS)
    expect(byId('pattern-change')).toMatchObject({defaultValue:false,designParentGroup:'design'})
    expect(byId('trigger')).toMatchObject({options:CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,visibleWhen:[{kind:'parameter-equals',parameterId:pid('pattern-change'),value:true}]})
    expect(byId('bpm-sync').designParentGroup).toBe('master-controls')
    expect(byId('auto-performance').defaultValue).toBe(false)
    expect(p.filter(p=>p.type==='color'&&p.designParentGroup==='palette')).toHaveLength(6)
    expect(p.filter(p=>p.exposure==='primary').every(p=>['master-controls','design','effects','palette'].includes(p.designParentGroup!))).toBe(true)
    expect(byId('pattern').metadata).toBeUndefined() // no implicit toggle edits
  })
  it('holds manual selections, suppresses duplicate/stale triggers, and allows immediate manual selection while cycling', () => {
    const controller=new TrippyBroPerformance()
    const update=(p:Partial<TrippyBroPerformanceInput>)=>controller.update({...defaults,enabled:true,...p})
    update({event:'a'})
    expect(update({event:'a'}).base).toBe('prismLattice')
    expect(update({event:'b'}).base).toBe('goldenFold')
    expect(update({event:'b'}).base).toBe('goldenFold')
    expect(update({authored:'liquidWeave',editRevision:1,event:'b'}).performing).toBe('liquidWeave')
    expect(update({authored:'liquidWeave',editRevision:1,event:'b'}).base).toBe('liquidWeave')
    expect(update({authored:'liquidWeave',editRevision:1,event:'c'}).base).toBe('prismLattice')
    expect(update({authored:'liquidWeave',editRevision:1,enabled:false,event:'d'}).base).toBe('liquidWeave')
  })
  it('stages automatic transitions, preserves immediate manual edits, and foregrounds the reference families', () => {
    const c = new TrippyBroPerformance()
    const u = (p: Partial<TrippyBroPerformanceInput>) => c.update({...defaults, enabled: true, ...p})
    u({})
    const first = u({event:'beat-1', timeSec:1})
    expect(first).toMatchObject({performing:'goldenFold',previous:'prismLattice',transition:0,changed:true})
    expect(u({event:'beat-1', timeSec:1.24}).transition).toBeCloseTo(0.5)
    expect(u({event:'beat-1', timeSec:1.5}).transition).toBe(1)
    expect(u({event:'beat-2', timeSec:2}).performing).toBe('quadBloom')
    expect(u({event:'beat-3', timeSec:3}).performing).toBe('neonCross')
    expect(u({event:'beat-4', timeSec:4}).performing).toBe('liquidWeave')
    expect(u({event:'beat-5', timeSec:5}).performing).toBe('prismLattice')
    const manual = u({event:'beat-5', timeSec:5.1, authored:'chromaticKnot', editRevision:1})
    expect(manual.performing).toBe('chromaticKnot')
    expect(manual.transition).toBeCloseTo(1)
    expect(u({event:'beat-6', timeSec:6, authored:'chromaticKnot', editRevision:1}).performing).toBe('prismLattice')
  })

  it('rebases trigger edits, resets and repeated edits of the same authored selection', () => {
    const c=new TrippyBroPerformance()
    const u=(p:Partial<TrippyBroPerformanceInput>)=>c.update({...defaults,enabled:true,...p})
    u({});u({event:'a'})
    expect(u({trigger:'kick',event:'kick-a'}).base).toBe('goldenFold')
    expect(u({trigger:'kick',event:'kick-a',editRevision:1}).base).toBe('prismLattice')
    expect(u({trigger:'kick',event:'kick-a',editRevision:1,reset:true}).base).toBe('prismLattice')
    c.reset()
    expect(u({event:'a'}).base).toBe('prismLattice')
  })
  it('maintains the advancing base under a bounded override and suppresses active events after a manual edit', () => {
    const c=new TrippyBroPerformance()
    const u=(p:Partial<TrippyBroPerformanceInput>)=>c.update({...defaults,auto:true,enabled:true,...p})
    u({})
    expect(u({buildEvent:'build-a',timeSec:1}).performing).toBe('goldenFold')
    const drop=u({buildEvent:'build-a',dropEvent:'drop-a',event:'beat-a',timeSec:2})
    expect(drop).toMatchObject({base:'goldenFold',performing:'quadBloom',overridden:true})
    expect(u({event:'beat-b',timeSec:2.2}).base).toBe('quadBloom')
    expect(u({event:'beat-c',timeSec:3.3})).toMatchObject({base:'neonCross',performing:'neonCross',overridden:false})
    expect(u({authored:'orbitalLace',editRevision:1,buildEvent:'build-a',timeSec:3.4}).performing).toBe('orbitalLace')
    expect(u({authored:'orbitalLace',editRevision:1,buildEvent:'build-a',timeSec:3.5}).performing).toBe('orbitalLace')
    expect(u({authored:'orbitalLace',editRevision:1,dropEvent:'drop-b',timeSec:3.6}).performing).toBe('quadBloom')
    expect(u({authored:'orbitalLace',editRevision:1,auto:false,timeSec:3.7}).performing).toBe('orbitalLace')
    expect(u({authored:'orbitalLace',editRevision:1,auto:false,timeSec:3.7,playing:false}).transition).toBe(1)
  })
})
