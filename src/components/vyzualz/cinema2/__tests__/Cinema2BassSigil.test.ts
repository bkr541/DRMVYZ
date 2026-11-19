import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CINEMA2_BASS_SIGIL_PRESET_MANIFEST as manifest } from '../presets/Cinema2BassSigilPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { CINEMA2_CRATE_ARTIFACTS, CINEMA2_CRATE_PRESET_MANIFESTS } from '../presets/Cinema2CratePresets'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { Cinema2BassSigilModelController } from '../modules/Cinema2BassSigilNativeModule'
import { BASS_SIGIL_PATTERN_IDS, deformBassSigilPoint } from '../modules/bassSigil/Cinema2BassSigilMotion'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { moodMusic } from './support/MoodMigrationHarness'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'

const source='public/cinema2/models/crate/skrillex_-_vj_-_flash_warning.glb'
async function setup() {
  // Browser decodes textures in the production tests; these Node tests inspect the actual geometry/hierarchy.
  const bytes=readFileSync(source),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString())
  json.textures=[];json.images=[]
  for(const material of json.materials) {if(material.pbrMetallicRoughness)delete material.pbrMetallicRoughness.baseColorTexture}
  const text=Buffer.from(JSON.stringify(json)),padded=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),bin=bytes.subarray(28+length),out=Buffer.alloc(28+padded.length+bin.length)
  out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);out.writeUInt32LE(bin.length,20+padded.length);out.writeUInt32LE(0x004e4942,24+padded.length);bin.copy(out,28+padded.length)
  const gltf=await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'')
  const originalSphere=(gltf.scene.getObjectByName('Object_18') as THREE.Mesh).geometry
  const controller=new Cinema2BassSigilModelController({THREE} as Cinema2ThreeLibrary)
  const template=originalSphere.getAttribute('position').array.slice()
  const defaults=Object.fromEntries(Object.entries(manifest.modules![0].parameterBindings!).map(([name,ref])=>[name,manifest.parameters!.find(p=>p.id===ref.$ref)!.defaultValue]))
  const values={...defaults}
  controller.attach(gltf.scene)
  let elapsed=0,editRevision=0
  const edit=()=>{editRevision++}
  const step=(options:{sourcePresent?:boolean;bpm?:number;hostSync?:boolean;paused?:boolean;time?:number;track?:string;event?:string;beat?:number}={}, supplied?:Cinema2ModuleFrameReadContext)=> {
    elapsed=options.time??elapsed+1/30
    const frame=supplied??{deltaTimeSec:1/30,elapsedTimeSec:elapsed,timestampMs:elapsed*1000,contextGeneration:1,transport:{sourcePresent:options.sourcePresent!==false,playing:options.sourcePresent!==false&&!options.paused,animationActive:options.sourcePresent!==false&&!options.paused,paused:options.paused??false,timeSec:elapsed,trackId:options.track??'track',bpm:options.bpm??120,bpmSync:options.hostSync??false},audio:options.event?{upstream:{timeSec:elapsed},rhythm:{beat:{id:options.event},beatIndex:{available:true,value:options.beat??0},fixedClocks:{4:{boundary:null},16:{boundary:null}}},structure:{analyzedPhrases:{available:false},semanticMoments:{available:false}}}:undefined}
    controller.update({frame,parameters:{get:(name:string)=>values[name],getEditRevision:()=>editRevision},targets:{}} as unknown as Cinema2ModuleUpdateContext);controller.beforeDraw();gltf.scene.updateMatrixWorld(true)
  }
  return {controller,root:gltf.scene,originalSphere,template,values,step,edit}
}

it('compiles once under its existing identity and restores the complete original environment',()=>{
  const compiled=cinema2NativePresetRegistry.compile(manifest.id)
  expect(compiled.ok,JSON.stringify(compiled)).toBe(true)
  expect(CINEMA2_CRATE_PRESET_MANIFESTS.filter(p=>p.id===manifest.id)).toEqual([manifest])
  expect(CINEMA2_CRATE_PRESET_MANIFESTS).toHaveLength(CINEMA2_CRATE_ARTIFACTS.length)
  expect(manifest.modules?.[0].config?.instances).toEqual([{asset:'cinema2-crate-bass-sigil',node:'bass-sigil-model',preserveMaterials:true,spin:false}])
  expect(createHash('sha256').update(readFileSync(source)).digest('hex')).toBe('3b74af78b57b0dd24727a06f41a16064af3044ded52118700fbe6008cb1843cc')
  expect(manifest.effects??[]).toHaveLength(5);expect(manifest.choreography!.rules.length).toBeGreaterThan(20)
})
it('exposes canonical shared controls, six distinct colors, and eight real programs',()=>{
  const parameters=manifest.parameters!
  expect(parameters.find(p=>p.label==='BPM Sync')).toMatchObject({type:'boolean',designParentGroup:'master-controls'})
  expect(parameters.find(p=>p.label==='Trigger')?.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
  expect(parameters.filter(p=>p.type==='color'&&p.designParentGroup==='palette')).toHaveLength(6)
  expect(parameters.find(p=>p.label==='Pattern')?.options).toHaveLength(8)
  const samples=BASS_SIGIL_PATTERN_IDS.map(pattern=>[0,.8,1.5].flatMap(phase=>deformBassSigilPoint(pattern,.6,.4,.7,phase,1)))
  expect(new Set(samples.map(p=>JSON.stringify(p))).size).toBe(8)
})
it('preserves original mesh counts, UVs and template geometry while animating private instances',async()=>{
  const {root,controller,step,originalSphere,template}=await setup()
  let count=0;root.traverse(o=>{if((o as THREE.Mesh).isMesh)count++});expect(count).toBe(11)
  const sphere=root.getObjectByName('Object_18') as THREE.Mesh
  expect(sphere.geometry).not.toBe(originalSphere)
  expect(sphere.geometry.getAttribute('uv').array).toEqual(originalSphere.getAttribute('uv').array)
  step();const before=root.getObjectByName('Object_22')!.matrixWorld.clone();for(let i=0;i<20;i++)step()
  expect(root.getObjectByName('Object_22')!.matrixWorld.elements).not.toEqual(before.elements)
  expect(originalSphere.getAttribute('position').array).toEqual(template)
  controller.dispose()
})
it('honors the preset BPM Sync independently of host sync, and holds pause, zero rate and Motion OFF',async()=>{
  const run=async(sync:boolean,bpm:number,hostSync:boolean)=>{const s=await setup();s.values.bpmSync=sync;for(let i=0;i<31;i++)s.step({bpm,hostSync});const phase=s.controller.inspect().phase;s.controller.dispose();return phase}
  expect(await run(true,180,false)).toBeGreaterThan(await run(true,90,true)*1.8)
  expect(await run(false,180,false)).toBeCloseTo(await run(false,90,true),6)
  const s=await setup();s.step();s.step();const phase=s.controller.inspect().phase
  for(let i=0;i<10;i++)s.step({paused:true});expect(s.controller.inspect().phase).toBe(phase)
  s.values.motionRate=0;for(let i=0;i<10;i++)s.step();expect(s.controller.inspect().phase).toBe(phase)
  s.values.motionRate=0;s.values.logoSpinRate=0;s.values.logoSway=0;s.step();const pose=s.root.getObjectByName('Object_10')!.matrixWorld.clone()
  for(let i=0;i<10;i++)s.step();expect(s.root.getObjectByName('Object_10')!.matrixWorld.elements).toEqual(pose.elements)
  s.controller.dispose()
})
it('manual pattern edits hold through duplicate events without turning Pattern Change off',async()=>{
  const s=await setup();s.values.patternChange=true;s.values.trigger='beat';s.step({event:'beat1'})
  s.step({event:'beat2'});expect(s.controller.inspect().pattern).toBe('countercurrent')
  s.values.pattern='lens-collapse';s.step({event:'beat2'});expect(s.controller.inspect().pattern).toBe('lens-collapse');expect(s.values.patternChange).toBe(true)
  s.step({event:'beat2'});expect(s.controller.inspect().pattern).toBe('lens-collapse')
  s.step({event:'beat3'});expect(s.controller.inspect().pattern).toBe('shock-bloom')
  s.edit();s.step({event:'beat3'});expect(s.controller.inspect().pattern).toBe('lens-collapse')
  s.step({event:'beat3'});expect(s.controller.inspect().pattern).toBe('lens-collapse')
  s.step({event:'beat4'});expect(s.controller.inspect().pattern).toBe('shock-bloom');s.controller.dispose()
})
it('clears motion and pattern progression on track/seek discontinuities and disposes clones',async()=>{
  const s=await setup();for(let i=0;i<20;i++)s.step();s.step({time:0});expect(s.controller.inspect().phase).toBe(0)
  s.step({track:'new'});expect(s.controller.inspect().phase).toBe(0)
  const owned=(s.root.getObjectByName('Object_18') as THREE.Mesh).geometry;let disposed=false;owned.addEventListener('dispose',()=>{disposed=true})
  s.controller.dispose();expect(disposed).toBe(true);expect(s.controller.inspect().ownedGeometryCount).toBe(0)
})

it('rotates and sways the complete original logo independently, with real manual orientation and spin and sway at zero',async()=>{
  const s=await setup();s.values.motionRate=0;s.step()
  const logo=s.root.getObjectByName('Object_6')!,sphere=s.root.getObjectByName('Object_18')!
  const before=logo.matrixWorld.clone(),shell=sphere.matrixWorld.clone()
  for(let i=0;i<20;i++)s.step()
  expect(logo.matrixWorld.elements).not.toEqual(before.elements)
  expect(sphere.matrixWorld.elements).toEqual(shell.elements)
  s.values.logoSpinRate=0;const spin=s.controller.inspect().logoSpinPhase
  for(let i=0;i<10;i++)s.step();expect(s.controller.inspect().logoSpinPhase).toBe(spin)
  expect(s.controller.inspect().logoPhase).toBeGreaterThan(0)
  s.values.logoSpinRate=0;s.values.logoSway=0;s.values.logoHeading=45;s.values.logoPitch=20;s.values.logoRoll=10;s.step()
  const manual=logo.matrixWorld.clone();for(let i=0;i<10;i++)s.step();expect(logo.matrixWorld.elements).toEqual(manual.elements)
  s.values.logoHeading=-45;s.step();expect(logo.matrixWorld.elements).not.toEqual(manual.elements)
  s.controller.dispose()
})

it('gives the logo ambient idle motion while respecting an explicit idle pause',async()=>{
  const s=await setup();s.step({sourcePresent:false});for(let i=0;i<10;i++)s.step({sourcePresent:false})
  expect(s.controller.inspect().logoSpinPhase).toBeGreaterThan(0)
  const held=s.controller.inspect().logoSpinPhase
  for(let i=0;i<10;i++)s.step({sourcePresent:false,paused:true})
  expect(s.controller.inspect().logoSpinPhase).toBe(held);s.controller.dispose()
})


it('uses actual shared Mood policy in the source-model controller, restores after a drop, and honors manual cancellation',async()=>{
 const s=await setup(),music=moodMusic();s.values.autoPerformance=true;s.values.reactivity=1
 const step=(options={})=>s.step({},music.next(options))
 for(let i=0;i<60;i++)step({energy:.7,section:'verse'})
 expect(s.controller.inspect().patternControlsAutomatic).toBe(true)
 expect(s.values.patternChange).toBe(false)
 step({energy:.8,event:'drop',eventId:51,section:'drop'})
 expect(s.controller.inspect()).toMatchObject({overrideReason:'drop',pattern:'shock-bloom'})
 const held=s.root.getObjectByName('Object_18')!.matrixWorld.clone()
 for(let i=0;i<5;i++){const f=music.next({energy:.8,section:'drop'});s.step({}, {...f,deltaTimeSec:0,transport:{...f.transport!,paused:true,playing:false,animationActive:false}})}
 expect(s.controller.inspect().overrideReason).toBe('drop')
 expect(s.root.getObjectByName('Object_18')!.matrixWorld.elements).toEqual(held.elements)
 for(let i=0;i<10;i++)step({energy:.8,section:'drop'})
 s.values.pattern='tidal-ribbon';s.edit();step({energy:.8,section:'drop'})
 expect(s.controller.inspect()).toMatchObject({overrideReason:null,pattern:'tidal-ribbon'})
 step({energy:.8,event:'drop',eventId:52,section:'drop'})
 expect(s.controller.inspect().overrideReason).toBe('drop')
 for(let i=0;i<130;i++)step({energy:.8,section:'drop'})
 expect(s.controller.inspect().overrideReason).toBeNull()
 s.values.reactivity=0;step({energy:1,event:'drop',eventId:53,section:'drop'})
 expect(s.controller.inspect()).toMatchObject({overrideReason:null,patternControlsAutomatic:false,effectivePatternChange:false,effectiveTrigger:'bar4'})
 s.controller.dispose()
})

it('routes all eleven canonical Triggers through the native controller without replaying duplicate events',async()=>{
 for(const option of CINEMA2_AFTERHOURS_TRIGGER_OPTIONS) {
  const s=await setup(),music=moodMusic();s.values.patternChange=true;s.values.trigger=option.value
  const frame=(id:string)=>{
   const f=music.next({energy:.6}),audio=f.audio!,boundary={id,timeSec:audio.upstream.timeSec}
   return {...f,audio:{...audio,rhythm:{...audio.rhythm,beat:boundary,kick:boundary,snare:boundary,downbeat:boundary,beatIndex:{available:true,value:32},barIndex:{available:true,value:8},fixedClocks:{...audio.rhythm.fixedClocks,4:{...audio.rhythm.fixedClocks[4],boundary},16:{...audio.rhythm.fixedClocks[16],boundary}}},structure:{...audio.structure,analyzedPhrases:{available:true,value:[boundary]},semanticMoments:{available:true,value:[{...boundary,type:'drop_impact'}]}}}} as unknown as Cinema2ModuleFrameReadContext
  }
  const first=frame('first');s.step({},first)
  const second=frame('second');s.step({},second)
  expect(s.controller.inspect().pattern,option.value).toBe('countercurrent')
  // Structural crossings cannot re-cross a time; rhythm identity deduplication holds the same event too.
  s.step({},second);expect(s.controller.inspect().pattern,option.value).toBe('countercurrent')
  s.controller.dispose()
 }
})
