import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Cinema2ModuleRuntime } from '../modules/Cinema2ModuleRuntime'
import { Cinema2ModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2EverywherePool } from '../modules/everywhere/Cinema2EverywherePool'
import { Cinema2MediaSlotRuntime } from '../media/Cinema2MediaSlotRuntime'
import { Cinema2ThreeSceneBridge } from '../modules/three/Cinema2ThreeSceneBridge'
import { SpectrumScene, type SpectrumLook } from '../modules/spectrum/SpectrumScene'
import { setCinema2ThreeLibraryLoaderForTests, type Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { SPECTRUM_COLORS } from '../modules/spectrum/SpectrumDomain'
import type { Cinema2ModuleCreateContext, Cinema2ModuleRenderExecutionContext } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_SPECTRUM_PRESET_MANIFEST as manifest } from '../presets/Cinema2SpectrumPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS } from '../../react/canvasPerformance/CanvasPerformanceTypes'
import { SPECTRUM_PATTERNS, bayAngle, spectrumPose, spectrumUv, floorPulse, type SpectrumMotion } from '../modules/spectrum/SpectrumDomain'
import { SpectrumPerformance, cinema2SpectrumNativeModuleDefinition, SPECTRUM_INITIALIZATION_TIMEOUT_MS } from '../modules/Cinema2SpectrumNativeModule'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
const parameter=(name:string)=>manifest.parameters!.find(p=>p.id===`spectrum-${name}`)!
const motion:SpectrumMotion={pattern:'orbit',phase:1.8,opening:.35,tilt:8,floorRelay:.55,sweep:.55,overhead:.35,intensity:.75,safe:true,readability:true,vocal:0,kick:0,snare:0,drop:0,bass:0,mid:0,build:0,downbeat:0,phrase:0,impact:0,high:0,energy:0,beat:0}
describe('SPECTRUM native arena',()=>{
  it('compiles the authored and covered manifests with canonical controls',()=>{
    for(const m of [manifest,withCinema2AutoCoverage(manifest,{exempt:CINEMA2_AUTO_COVERAGE_EXEMPT.spectrum})]){
      expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest:m}).diagnostics).toEqual([])
      const result=compileCinema2NativePreset(m);expect(result.diagnostics).toEqual([]);expect(result.ok).toBe(true)
    }
    expect(new Set(manifest.parameters!.map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    expect(parameter('pattern').options).toEqual(SPECTRUM_PATTERNS)
    expect(parameter('trigger').options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(parameter('pool-trigger').options).toEqual(CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS)
    expect(parameter('pool-automation').defaultValue).toBe(false)
    expect(parameter('media-layout').defaultValue).toBe('continuous')
    expect(parameter('media-fit').defaultValue).toBe('contain')
    expect(manifest.mediaSlots?.[0]?.accepts).toEqual(['image','video'])
    expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette'&&p.type==='color')).toHaveLength(5)
  })
  it('maps contiguous angular UVs, one channel per group and a seam at the front',()=>{
    for(let count=8;count<=16;count++)for(const coverage of ['front-arc','wide-arc','full-wrap'])for(const grouping of ['left-center-right','quadrants'])for(const grouped of [false,true])for(let channels=1;channels<=3;channels++){
      const uvs=Array.from({length:count},(_,i)=>spectrumUv(i,count,7,3.65,coverage,grouping,grouped,channels,2))
      const active=uvs.filter(q=>q.channel>=0)
      expect(active.length).toBe(coverage==='full-wrap'?count:coverage==='front-arc'?Math.ceil(count/3):Math.ceil(count*2/3))
      for(const q of active){expect(q.x).toBeGreaterThanOrEqual(0);expect(q.x+q.w).toBeLessThanOrEqual(1+1e-8);expect(q.channel).toBeLessThan(channels);expect(q.aspect).toBeGreaterThan(0)}
      if(!grouped){expect(active.every(q=>q.channel===2%channels)).toBe(true);expect(active.reduce((s,q)=>s+q.w,0)).toBeCloseTo(1)}
      expect(bayAngle(0,count)).toBeLessThan(0);expect(bayAngle(count-1,count)).toBeGreaterThan(0)
    }
    expect(new Set(Array.from({length:12},(_,i)=>spectrumUv(i,12,7,3.65,'wide-arc','left-center-right',true,3,0).channel).filter(c=>c>=0)).size).toBe(3)
  })
  it('keeps six distinct programs and bounds every physical and light response',()=>{
    const signatures=SPECTRUM_PATTERNS.map(({value})=>JSON.stringify(Array.from({length:12},(_,i)=>spectrumPose(i,12,{...motion,pattern:value}))))
    expect(new Set(signatures).size).toBe(6)
    for(const {value} of SPECTRUM_PATTERNS)for(let i=0;i<16;i++)for(let n=0;n<60;n++){
      const m={...motion,pattern:value,phase:n*.2,opening:1,tilt:25,intensity:1,kick:1,snare:1,bass:1,drop:1},p=spectrumPose(i,16,m)
      expect(Object.values(p).every(Number.isFinite)).toBe(true);expect(Math.abs(p.radial)).toBeLessThanOrEqual(1);expect(Math.abs(p.tilt)).toBeLessThanOrEqual(25*Math.PI/180);expect(p.light).toBeGreaterThanOrEqual(0);expect(p.light).toBeLessThanOrEqual(1);expect(floorPulse(i,m)).toBeLessThanOrEqual(1)
    }
    expect(floorPulse(1,{...motion,kick:1})).toBeGreaterThan(floorPulse(1,motion))
    expect(Math.abs(spectrumPose(2,12,{...motion,vocal:1}).radial)).toBeLessThan(Math.abs(spectrumPose(2,12,motion).radial))
  })
  it('holds authored controls on manual selection and discontinuities',()=>{
    const perf=new SpectrumPerformance(i=>(i%7)/7),controls:Record<string,unknown>={pattern:'orbit','pattern-change':false,'bpm-sync':true,'auto-performance':false}
    const update=(t:number,revision:number)=>perf.update({parameters:{get:(key:string)=>controls[key]},frame:{contextGeneration:1,elapsedTimeSec:t,deltaTimeSec:.05,transport:{trackId:'track',timeSec:t,playing:true,paused:false,animationActive:true,bpmSync:true,bpm:120,sourcePresent:true},audio:{upstream:{sourceId:'track',publisherId:'test',analysisRevision:1,timelineRevision:revision},rhythm:{fixedClocks:{4:{boundary:null}}},structure:{section:{value:null},semanticMoments:{available:false,value:null},analyzedPhrases:{available:false,value:null}},discontinuity:{generation:0}}}} as unknown as Cinema2ModuleUpdateContext)
    update(0,1);update(.05,1);expect(perf.look?.phase).toBeGreaterThan(0);controls.pattern='circumference-relay';update(.1,1);expect(perf.look?.pattern).toBe('circumference-relay');update(.15,2);expect(perf.look?.phase).toBe(0);expect(controls.pattern).toBe('circumference-relay');expect(perf.inspect().patternControlsAutomatic).toBe(false)
  })
})

const library = { THREE } as unknown as Cinema2ThreeLibrary
const look:SpectrumLook={...motion,count:12,radius:7,height:3.65,gap:.025,coverage:'wide-arc',locked:false,mode:'auto',visible:true,fit:'contain',layout:'continuous',grouping:'left-center-right',scale:1,offsetX:0,offsetY:0,angle:0,opacity:1,brightness:1,transition:.35,reflection:.25,spill:.3,colors:SPECTRUM_COLORS,dt:1/60,paused:false}

describe('SPE-01 native scene regression',()=>{
  it('writes finite transforms for every bay on the first procedural draw and after quality/count changes',()=>{
    const root=new THREE.Group(),scene=new SpectrumScene(library,root)
    try{
      for(const [count,quality] of [[12,'high'],[8,'low'],[16,'medium']] as const){
        expect(()=>scene.apply({...look,count},[null],0,quality)).not.toThrow()
        const meshes:THREE.InstancedMesh[]=[]
        root.traverse(object=>{if((object as THREE.InstancedMesh).isInstancedMesh)meshes.push(object as THREE.InstancedMesh)})
        expect(meshes).toHaveLength(7)
        const matrix=new THREE.Matrix4()
        for(const mesh of meshes){
          expect(mesh.count).toBe(count)
          for(let i=0;i<count;i++){
            mesh.getMatrixAt(i,matrix)
            expect(matrix.elements.every(Number.isFinite)).toBe(true)
            expect(Math.abs(matrix.determinant())).toBeGreaterThan(0)
          }
        }
        const display=meshes.find(mesh=>mesh.geometry.hasAttribute('aCrop'))!
        expect(display.geometry.getAttribute('aCrop').getZ(0)).toBeGreaterThan(0)
      }
    }finally{scene.dispose();scene.dispose()}
    expect(root.children).toHaveLength(0)
  })
  it('does not retry a rejected lazy load every frame, retries on reactivation, and ignores retired loads',async()=>{
    const acquire=vi.fn(()=>({ready:false,getDiagnostics:()=>[]}))
    const context={module:manifest.modules![0],randomness:{sample:()=>.5},resources:{acquire},media:{get:()=>null}} as unknown as Cinema2ModuleCreateContext
    const execution={} as Cinema2ModuleRenderExecutionContext
    const create=()=>cinema2SpectrumNativeModuleDefinition.create(context)
    const draw=(instance:ReturnType<typeof create>)=>instance.render!.providers[0]!.execute(execution)
    const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve()}
    const load=vi.fn<()=>Promise<Cinema2ThreeLibrary>>()
      .mockRejectedValueOnce(new Error('test chunk failure')).mockResolvedValueOnce(library)
    setCinema2ThreeLibraryLoaderForTests(load)
    try{
      const failed=create();draw(failed);await settle();draw(failed);draw(failed)
      expect(load).toHaveBeenCalledTimes(1)
      expect(failed.getDiagnostics?.()).toEqual([expect.objectContaining({code:'CINEMA2_SPECTRUM_FAILED',message:expect.stringContaining('test chunk failure')})])
      expect(acquire).not.toHaveBeenCalled();failed.lifecycle.dispose()
      const recovered=create();draw(recovered);await settle();draw(recovered)
      expect(load).toHaveBeenCalledTimes(2);expect(acquire).toHaveBeenCalledTimes(1)
      recovered.lifecycle.dispose()
      let resolve!:(value:Cinema2ThreeLibrary)=>void
      setCinema2ThreeLibraryLoaderForTests(()=>new Promise(done=>{resolve=done}))
      const retired=create();draw(retired);retired.lifecycle.dispose();resolve(library);await settle();draw(retired)
      expect(acquire).toHaveBeenCalledTimes(1);expect(retired.getDiagnostics?.()).toEqual([])
    }finally{setCinema2ThreeLibraryLoaderForTests(null)}
  })
})


describe('QA-03 bounded initialization',()=>{
  const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
  const execution={} as Cinema2ModuleRenderExecutionContext
  const create=(acquire:ReturnType<typeof vi.fn>,withPool=false)=>cinema2SpectrumNativeModuleDefinition.create({
    module:manifest.modules![0],randomness:{sample:()=>.5},resources:{acquire},media:{get:()=>null},
    ...(withPool?{mediaPoolSource:{getSelection:()=>null,resolve:()=>null}}:{}),
  } as unknown as Cinema2ModuleCreateContext)
  const draw=(instance:ReturnType<typeof create>)=>instance.render!.providers[0]!.execute(execution)
  const inspect=(instance:ReturnType<typeof create>)=>(instance as unknown as {inspect:()=>unknown}).inspect()
  it('bounds unresolved imports without leasing the pool and ignores late completion',async()=>{
    const clock=vi.spyOn(globalThis.performance,'now').mockReturnValue(0)
    const acquire=vi.fn();let resolve!:(value:Cinema2ThreeLibrary)=>void
    const load=vi.fn(()=>new Promise<Cinema2ThreeLibrary>(done=>{resolve=done}))
    setCinema2ThreeLibraryLoaderForTests(load)
    try{
      const first=create(acquire,true);draw(first);draw(first)
      expect(load).toHaveBeenCalledTimes(1);expect(acquire).not.toHaveBeenCalled()
      clock.mockReturnValue(SPECTRUM_INITIALIZATION_TIMEOUT_MS)
      draw(first);expect(inspect(first)).toMatchObject({renderState:'recoverable-failure',renderReady:false})
      expect(first.getDiagnostics?.()).toEqual([expect.objectContaining({message:expect.stringContaining('timed out')})])
      resolve(library);await settle();draw(first)
      expect(acquire).not.toHaveBeenCalled();expect(inspect(first)).toMatchObject({renderState:'recoverable-failure'})
      first.lifecycle.dispose()
      acquire.mockReturnValue({ready:false,getDiagnostics:()=>[]})
      const next=create(acquire);draw(next);await settle();draw(next)
      expect(acquire).toHaveBeenCalledTimes(1);expect(inspect(next)).toMatchObject({renderState:'warming'})
      next.lifecycle.dispose()
    }finally{clock.mockRestore();setCinema2ThreeLibraryLoaderForTests(null)}
  })
  it('does not retain a warming bridge forever and propagates failure to the resource-owning host',async()=>{
    const clock=vi.spyOn(globalThis.performance,'now').mockReturnValue(0)
    const acquire=vi.fn(()=>({ready:false,getDiagnostics:()=>[]}))
    setCinema2ThreeLibraryLoaderForTests(async()=>library)
    try{
      const instance=create(acquire);draw(instance);await settle();draw(instance)
      expect(acquire).toHaveBeenCalledTimes(1)
      clock.mockReturnValue(SPECTRUM_INITIALIZATION_TIMEOUT_MS)
      expect(()=>draw(instance)).toThrow('warmup deadline exceeded')
      expect(inspect(instance)).toMatchObject({renderState:'fatal',renderReady:false})
      draw(instance);expect(acquire).toHaveBeenCalledTimes(1);instance.lifecycle.dispose()
    }finally{clock.mockRestore();setCinema2ThreeLibraryLoaderForTests(null)}
  })
  it('retires real host-owned pool leases on fatal arena construction',async()=>{
    const compiled=compileCinema2NativePreset(manifest);if(!compiled.ok)throw Error(JSON.stringify(compiled.diagnostics))
    const registry=new Cinema2ModuleRegistry();expect(registry.register(cinema2SpectrumNativeModuleDefinition).ok).toBe(true)
    const gl={} as WebGL2RenderingContext,media=new Cinema2MediaSlotRuntime(gl,manifest.mediaSlots??[])
    const host=new Cinema2ModuleRuntime(gl,compiled.plan,{} as ConstructorParameters<typeof Cinema2ModuleRuntime>[2],registry,media,
      {sample:()=>.5} as unknown as ConstructorParameters<typeof Cinema2ModuleRuntime>[5],undefined,{getSelection:()=>null,resolve:async()=>null})
    const dispose=vi.spyOn(Cinema2EverywherePool.prototype,'dispose')
    const badLibrary={...library,THREE:{...THREE,Group:class {constructor(){throw Error('fixture arena failure')}}}} as unknown as Cinema2ThreeLibrary
    setCinema2ThreeLibraryLoaderForTests(async()=>badLibrary)
    try{
      host.activate();const provider=host.getRenderPassProviders()[0]!
      provider.execute(execution);await settle()
      expect(()=>provider.execute(execution)).toThrow('fixture arena failure')
      expect(dispose).toHaveBeenCalledTimes(1)
      expect(host.getSnapshot()).toMatchObject({failedModuleCount:1,activeResourceLeaseCount:0,estimatedGpuBytes:0})
      expect(host.getSnapshot().modules[0]!.diagnostics).toEqual([expect.objectContaining({message:expect.stringContaining('fixture arena failure')})])
      provider.execute(execution);expect(dispose).toHaveBeenCalledTimes(1)
    }finally{host.dispose();media.dispose();dispose.mockRestore();setCinema2ThreeLibraryLoaderForTests(null)}
  })
  it('never treats a rejected strict shader warmup as ready or publishes an error after disposal',async()=>{
    // Invoke the real preparation boundary with an injected compile promise; no fake rendered frame.
    const setup=()=>{
      let reject!:(reason:Error)=>void
      const bridge=Object.assign(Object.create(Cinema2ThreeSceneBridge.prototype),{
        stage:'compile',compiling:false,disposed:false,preparationGeneration:0,
        shaderPreparationError:null,options:{strictShaderPreparation:true},
        renderer:{compileAsync:()=>new Promise<void>((_,fail)=>{reject=fail})},
      }) as Cinema2ThreeSceneBridge
      // Private method access is confined to this fixture, not production callers.
      ;(bridge as unknown as {warmUp:()=>void}).warmUp()
      return {bridge,reject}
    }
    const active=setup();active.reject(new Error('fixture shader failure'));await settle()
    expect(active.bridge.ready).toBe(false)
    expect(()=>active.bridge.draw(execution,{} as Parameters<Cinema2ThreeSceneBridge['draw']>[1])).toThrow('fixture shader failure')
    const retired=setup();Object.assign(retired.bridge,{disposed:true});retired.reject(new Error('stale shader failure'));await settle()
    expect(retired.bridge.ready).toBe(false)
    expect(()=>retired.bridge.draw(execution,{} as Parameters<Cinema2ThreeSceneBridge['draw']>[1])).not.toThrow()
    expect(retired.bridge).toHaveProperty('shaderPreparationError',null)
  })
})
