import { describe,expect,it,vi } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import { CINEMA2_EVENT_HORIZON_LENSING_RESOLUTION } from '../effects/Cinema2EventHorizonLensingEffect'
import { CINEMA2_EVENT_HORIZON_LOOKS,CINEMA2_EVENT_HORIZON_NATIVE_MODULE_TYPE_ID,Cinema2EventHorizonProgramController,createCinema2EventHorizonLookCycle } from '../modules/Cinema2EventHorizonNativeModule'
import { CINEMA2_EVENT_HORIZON_QUALITY_COUNTS } from '../modules/eventHorizon/Cinema2EventHorizonRenderer'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_EVENT_HORIZON_CAMERA_ID,CINEMA2_EVENT_HORIZON_LOOK_ID,CINEMA2_EVENT_HORIZON_PATTERN_CHANGE_ID,CINEMA2_EVENT_HORIZON_PRESET_ID,CINEMA2_EVENT_HORIZON_PRESET_MANIFEST,CINEMA2_EVENT_HORIZON_TRIGGER_ID } from '../presets/Cinema2EventHorizonPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'

const CAPABILITIES=Object.freeze(['render.webgl2','render.depth','scene.3d','camera.world'] as const)
class FakeCanvas extends EventTarget{width=640;height=360;readonly getContext:ReturnType<typeof vi.fn>;constructor(gl:WebGL2RenderingContext){super();this.getContext=vi.fn((kind:string)=>kind==='webgl2'?gl:null)}}

describe('Cinema 2.0 Event Horizon preset',()=>{
  it('ships the three legacy identities as authored looks and passes native gates',()=>{
    expect(CINEMA2_EVENT_HORIZON_LOOKS).toEqual(['singularityCrown','quasarMaw','binaryCollapse'])
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate=>candidate.manifest.id===CINEMA2_EVENT_HORIZON_PRESET_ID)).toMatchObject({role:'keeper'})
    expect(cinema2NativePresetRegistry.get(CINEMA2_EVENT_HORIZON_PRESET_ID)).not.toBeNull();expect(cinema2NativeModuleRegistry.get(CINEMA2_EVENT_HORIZON_NATIVE_MODULE_TYPE_ID,1)).not.toBeNull()
    expect(CINEMA2_EVENT_HORIZON_PRESET_MANIFEST.parameters?.find(parameter=>parameter.id===CINEMA2_EVENT_HORIZON_LOOK_ID)).toMatchObject({defaultValue:'singularityCrown',options:[{value:'singularityCrown'},{value:'quasarMaw'},{value:'binaryCollapse'}]})
    expect(validateCinema2PresetAuthoringConventions({role:'keeper',manifest:CINEMA2_EVENT_HORIZON_PRESET_MANIFEST})).toEqual({ok:true,diagnostics:[]})
    const compiled=compileCinema2NativePreset(CINEMA2_EVENT_HORIZON_PRESET_MANIFEST,{availableCapabilities:CAPABILITIES});expect(compiled.ok,compiled.diagnostics.map(diagnostic=>`${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  })
  it('provides Mainframe-equivalent Pattern Change and conditional Trigger controls',()=>{
    const compiled=compileCinema2NativePreset(CINEMA2_EVENT_HORIZON_PRESET_MANIFEST,{availableCapabilities:CAPABILITIES});if(!compiled.ok)throw new Error('Expected Event Horizon to compile')
    expect(CINEMA2_EVENT_HORIZON_PRESET_MANIFEST.parameters?.find(parameter=>parameter.id===CINEMA2_EVENT_HORIZON_PATTERN_CHANGE_ID)).toMatchObject({type:'boolean',defaultValue:false})
    expect(CINEMA2_EVENT_HORIZON_PRESET_MANIFEST.parameters?.find(parameter=>parameter.id===CINEMA2_EVENT_HORIZON_TRIGGER_ID)).toMatchObject({type:'enum',defaultValue:'bar4',options:CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,visibleWhen:[{kind:'parameter-equals',parameterId:CINEMA2_EVENT_HORIZON_PATTERN_CHANGE_ID,value:true}]})
    const state=new Cinema2ParameterState(compiled.plan.parameters);const labels=()=>{const effects=createCinema2DesignParentGroupModel(compiled.plan,state.getSnapshot()).find(parent=>parent.id==='effects');return[...(effects?.controls.map(control=>control.definition.label)??[]),...(effects?.groups.flatMap(group=>group.controls.map(control=>control.definition.label))??[])]}
    expect(labels()).not.toContain('Trigger');expect(state.setPersistentValue(CINEMA2_EVENT_HORIZON_PATTERN_CHANGE_ID,true)).toMatchObject({ok:true});expect(labels()).toContain('Trigger')
  })
  it('cycles looks deterministically without immediate repeats',()=>{
    const controller=new Cinema2EventHorizonProgramController(createCinema2EventHorizonLookCycle(index=>[.8,.2][index]??.5));const base={authoredLook:'singularityCrown' as const,patternChange:true,trigger:'bar4' as const}
    expect(controller.update({...base,triggerEventId:'bar:1'}).activeLook).toBe('singularityCrown');const advanced=controller.update({...base,triggerEventId:'bar:2'});expect(advanced.activeLook).not.toBe('singularityCrown');expect(controller.update({...base,triggerEventId:'bar:2'}).changed).toBe(false);expect(controller.update({...base,patternChange:false,triggerEventId:'bar:3'}).activeLook).toBe('singularityCrown')
  })
  it('renders instanced world geometry, a depth-writing core, and the five-pass production graph',()=>{
    expect(CINEMA2_EVENT_HORIZON_QUALITY_COUNTS).toEqual({disk:[1200,2600,5000],star:[280,720,1400],debris:[64,160,400]})
    expect(CINEMA2_EVENT_HORIZON_LENSING_RESOLUTION).toEqual({low:.5,medium:.75,high:1})
    expect(CINEMA2_EVENT_HORIZON_PRESET_MANIFEST.render!.targets!.some(target=>target.descriptor.depthFormat==='depth24')).toBe(true)
    expect(CINEMA2_EVENT_HORIZON_PRESET_MANIFEST.render!.passes.some(pass=>pass.kind==='fullscreen'&&pass.inputs?.some(input=>input.attachment==='depth'))).toBe(true)
    const gl=createCinemaMockWebGL();let scheduled:FrameRequestCallback|null=null;const created=Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement,{presetId:CINEMA2_EVENT_HORIZON_PRESET_ID,requestAnimationFrame:vi.fn(callback=>{scheduled=callback;return 1}),cancelAnimationFrame:vi.fn(),renderQuality:'high'})
    expect(created.error).toBeNull();if(!created.runtime)throw new Error('Expected Event Horizon runtime');expect(created.runtime.getCameraRuntimeSnapshot()).toMatchObject({activeCameraId:CINEMA2_EVENT_HORIZON_CAMERA_ID});expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({estimatedGpuBytes:expect.any(Number)});expect(created.runtime.getModuleRuntimeSnapshot().estimatedGpuBytes).toBeGreaterThan(0)
    created.runtime.resize({width:640,height:360,dpr:1});created.runtime.start();(scheduled as FrameRequestCallback|null)?.(16);expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({frameCount:1,executedPassCount:5,failedPassCount:0});expect(gl.drawArraysInstanced).toHaveBeenCalledTimes(1);expect(gl.drawElementsInstanced).toHaveBeenCalledTimes(2);expect(gl.drawElements).toHaveBeenCalled();expect(gl.depthMask).toHaveBeenCalledWith(true);created.runtime.dispose()
  })
})
