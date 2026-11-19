import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {expect,it} from 'vitest'
import * as THREE from 'three'
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'
import {Cinema2BeamLatticeController} from '../modules/Cinema2BeamLatticeNativeModule'
import {cinema2NativePresetRegistry} from '../presets/Cinema2PresetRegistry'
import {CINEMA2_CRATE_PRESET_MANIFESTS} from '../presets/Cinema2CratePresets'
import {BEAM_LATTICE_PATTERN_IDS} from '../modules/beamLattice/BeamLatticePatterns'
import type {Cinema2ThreeLibrary} from '../modules/three/Cinema2ThreeLibrary'
import type {Cinema2ModuleUpdateContext,Cinema2ModuleFrameReadContext} from '../modules/Cinema2ModuleContracts'
import {CINEMA2_AFTERHOURS_TRIGGER_OPTIONS} from '../presets/Cinema2AfterhoursPreset'
import {moodMusic} from './support/MoodMigrationHarness'
const manifest=CINEMA2_CRATE_PRESET_MANIFESTS.find(m=>m.id==='drmvyz.cinema2.crate-beam-lattice')!
async function setup(){
 const b=readFileSync('public/cinema2/models/crate/lasers_-_vj.glb'),gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),original:THREE.Mesh[]=[];gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh)original.push(o)})
 const values:Record<string,unknown>={...manifest.modules![0].parameters},controller=new Cinema2BeamLatticeController({THREE} as Cinema2ThreeLibrary);controller.attach(gltf.scene,false,gltf.animations)
 let time=0,revision=0
 const step=(provided?:Cinema2ModuleFrameReadContext)=>{time+=1/30;const frame=provided??{frameId:Math.round(time*30),timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:1/30,contextGeneration:1,audio:null,director:null,mood:null,transport:{sourcePresent:false,playing:false,paused:false,animationActive:true,timeSec:time,trackId:null,bpm:120}};controller.update({frame,parameters:{get:(name:string)=>values[name],getEditRevision:()=>revision},targets:{}} as unknown as Cinema2ModuleUpdateContext);controller.beforeDraw();gltf.scene.updateMatrixWorld(true)}
 return {controller,values,step,root:gltf.scene,original,gltf,edit:()=>{revision++}}
}
it('preserves source identity and reference framing while exposing seven real programs and canonical controls',()=>{
 expect(cinema2NativePresetRegistry.compile(manifest.id).ok).toBe(true);expect(manifest.parameters!.find(p=>p.label==='Trigger')!.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
 expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette')).toHaveLength(5);expect(manifest.cameras![0].fovDegrees).toBe(154)
 expect(createHash('sha256').update(readFileSync('public/cinema2/models/crate/lasers_-_vj.glb')).digest('hex')).toBe('b2dd79d39bc3caee20898bf0f863a2327b9fca8bef7b4558f8091c0fe1979e87')
})
it('keeps the default reference clip pose and all source geometry and releases only its own animation state',async()=>{
 const s=await setup(),expected=s.root.clone(true),mixer=new THREE.AnimationMixer(expected);mixer.clipAction(s.gltf.animations[0]).play();s.values.referenceBeamThickness=1
 for(let i=0;i<30;i++){s.step();mixer.setTime(s.controller.inspect().phase);expected.updateMatrixWorld(true);s.root.traverse(o=>{if(o instanceof THREE.Mesh){expect(o.quaternion.toArray()).toEqual(expected.getObjectByName(o.name)!.quaternion.toArray());expect(o.scale.z).toBe(4)}else expect(o.matrixWorld.toArray(),o.name).toEqual(expected.getObjectByName(o.name)!.matrixWorld.toArray())})}
 let disposed=0;s.original.forEach(m=>m.geometry.addEventListener('dispose',()=>disposed++));expect(s.controller.inspect()).toMatchObject({sourceMeshes:4,addedGeometry:0,clipTracks:8});s.controller.dispose();s.controller.dispose();expect(disposed).toBe(0);mixer.stopAllAction();mixer.uncacheRoot(expected)
})
it('produces distinct physical geometry for every pattern and keeps width calibration nonaccumulating',async()=>{
 const s=await setup(),poses=[]
 for(const pattern of BEAM_LATTICE_PATTERN_IDS){s.values.pattern=pattern;s.edit();s.step();poses.push(JSON.stringify(s.original.map(m=>[...m.quaternion.toArray(),...m.scale.toArray()])))}expect(new Set(poses).size).toBe(7)
 s.step();expect(s.original.every(m=>m.scale.y===2)).toBe(true);s.controller.dispose()
})
it('has no freeze setting (a saved one is ignored) and honors independent lighting zeros',async()=>{
 const s=await setup();s.values.pattern='scissor-cross';s.step();s.values.geometryMotion=false;s.step();const pose=s.original.map(m=>m.matrixWorld.toArray())
 s.values.aperture=.65;s.values.bankTravel=1.5;for(let i=0;i<20;i++)s.step();expect(s.original.map(m=>m.matrixWorld.toArray())).not.toEqual(pose)
 for(const role of ['upper','lower','right','left'])s.values[role+'Lighting']=0;s.step();expect(s.original.every(m=>(m.material as THREE.MeshStandardMaterial).emissiveIntensity===0)).toBe(true)
 s.controller.dispose()
})
it('uses shared BPM Sync, pauses exactly, and holds speed zero',async()=>{
 const a=await setup(),b=await setup(),music=moodMusic();b.values.bpmSync=false
 for(let i=0;i<60;i++){const f=music.next();const fast={...f,audio:null,transport:{...f.transport!,bpm:180}};a.step(fast);b.step(fast)}expect(a.controller.inspect().phase-b.controller.inspect().phase).toBeGreaterThan(.8)
 const f=music.next();a.step({...f,transport:{...f.transport!,paused:true,animationActive:false}});const held=a.controller.inspect().phase;for(let i=0;i<10;i++){const next=music.next();a.step({...next,transport:{...next.transport!,paused:true,animationActive:false}})}expect(a.controller.inspect().phase).toBe(held)
 a.values.motionRate=0;a.step(music.next());expect(a.controller.inspect().phase).toBe(held);a.controller.dispose();b.controller.dispose()
})
it('runs bounded Auto substitutions, restores manual/zero-strength authority and resets on track change',async()=>{
 const s=await setup(),music=moodMusic();s.values.autoPerformance=true;s.values.reactivity=1
 const step=(options={})=>s.step(music.next(options));for(let i=0;i<30;i++)step({energy:.7,section:'verse'})
 step({energy:.8,section:'drop',event:'drop',eventId:1});expect(s.controller.inspect()).toMatchObject({pattern:'radial-release',overrideReason:'drop'})
 s.values.autoPerformance=false;step({energy:.8});expect(s.controller.inspect()).toMatchObject({pattern:'reference-fan',overrideReason:null,patternWeights:[1,0,0,0,0,0,0]})
 s.values.autoPerformance=true;step({energy:.8,event:'drop',eventId:2});s.values.pattern='iris-gate';s.edit();step({energy:.8});expect(s.controller.inspect()).toMatchObject({pattern:'iris-gate',overrideReason:null})
 step({energy:.8,event:'drop',eventId:3});for(let i=0;i<135;i++)step({energy:.8});expect(s.controller.inspect().overrideReason).not.toBe('drop')
 s.values.reactivity=0;step({energy:1,event:'drop',eventId:4});expect(s.controller.inspect().overrideReason).toBeNull();step({trackId:'new-track'});expect(s.controller.inspect().overrideReason).toBeNull();s.controller.dispose()
})
it('advances only on fresh events for all eleven canonical Triggers and accepts immediate edits with cycling enabled',async()=>{
 const s=await setup()
 for(const option of CINEMA2_AFTERHOURS_TRIGGER_OPTIONS){
  const music=moodMusic();s.values.pattern='reference-fan';s.values.patternChange=true;s.values.trigger=option.value;s.edit()
  const frame=(id:string)=>{const f=music.next({energy:.6,trackId:`trigger-${option.value}`}),a=f.audio!,event={id,timeSec:a.upstream.timeSec};return {...f,audio:{...a,rhythm:{...a.rhythm,beat:event,kick:event,snare:event,downbeat:event,beatIndex:{available:true,value:32},barIndex:{available:true,value:8},fixedClocks:{...a.rhythm.fixedClocks,4:{...a.rhythm.fixedClocks[4],boundary:event},16:{...a.rhythm.fixedClocks[16],boundary:event}}},structure:{...a.structure,analyzedPhrases:{available:true,value:[event]},semanticMoments:{available:true,value:[{...event,type:'drop_impact'}]}}}} as unknown as Cinema2ModuleFrameReadContext}
  s.step(frame('first'));const second=frame('second');s.step(second);expect(s.controller.inspect().pattern,option.value).toBe('counter-sweep');s.step(second);expect(s.controller.inspect().pattern).toBe('counter-sweep');s.values.pattern='iris-gate';s.edit();s.step(second);expect(s.controller.inspect().pattern).toBe('iris-gate');expect(s.values.patternChange).toBe(true)
 }
 s.controller.dispose()
})

it('allows explicit idle movement without a loaded source and freezes an inactive loaded source',async()=>{
 const s=await setup(),music=moodMusic();const first=music.silent();s.step({...first,transport:{...first.transport!,animationActive:false}});const before=s.controller.inspect().phase
 for(let i=0;i<15;i++){const f=music.silent();s.step({...f,transport:{...f.transport!,animationActive:false}})}expect(s.controller.inspect().phase).toBeGreaterThan(before+.4)
 const loaded=music.next();s.step({...loaded,transport:{...loaded.transport!,playing:false,analysisActive:false,animationActive:false}});const held=s.controller.inspect().phase
 for(let i=0;i<5;i++){const f=music.next();s.step({...f,transport:{...f.transport!,playing:false,analysisActive:false,animationActive:false}})}expect(s.controller.inspect().phase).toBe(held);s.controller.dispose()
})

it('keeps all bank emitter centres fixed through pattern rotations and aperture changes',async()=>{
 const s=await setup(),centre=new THREE.Vector3(23.931602746248245,0,0)
 for(const pattern of BEAM_LATTICE_PATTERN_IDS){s.values.pattern=pattern;s.values.aperture=.65;s.edit();s.step();for(const mesh of s.original){const actual=mesh.localToWorld(centre.clone()),expected=mesh.parent!.localToWorld(centre.clone());expect(actual.distanceTo(expected),pattern).toBeLessThan(1e-6)}}s.controller.dispose()
})
it('advances triggers using shared tempo when live audio has no explicit beat events and transport time is coarse',async()=>{
 const s=await setup(),music=moodMusic();s.values.patternChange=true;s.values.trigger='beat'
 for(let i=0;i<40;i++){const f=music.next({energy:.6}),a=f.audio!;s.step({...f,transport:{...f.transport!,timeSec:Math.floor(f.transport!.timeSec)},audio:{...a,rhythm:{...a.rhythm,beat:null,downbeat:null,beatPhase:{available:false,value:null},beatIndex:{available:false,value:null},barIndex:{available:false,value:null},beatInBar:{available:false,value:null}}}} as unknown as Cinema2ModuleFrameReadContext)}
 expect(s.controller.inspect().pattern).not.toBe('reference-fan');s.controller.dispose()
})

it('does not accumulate Bank Travel when the audio timestamp is held across renders',async()=>{
 const s=await setup(),music=moodMusic();s.values.bankTravel=1.5;s.values.pattern='counter-sweep'
 for(let i=0;i<50;i++)s.step(music.next())
 const frame=music.next();s.step({...frame,transport:{...frame.transport!,paused:true,animationActive:false}})
 const pose=s.original.map(mesh=>mesh.matrixWorld.toArray())
 for(let i=0;i<20;i++){s.controller.beforeDraw();s.root.updateMatrixWorld(true);expect(s.original.map(mesh=>mesh.matrixWorld.toArray())).toEqual(pose)}
 s.controller.dispose()
})

it('keeps pattern tilts bounded despite the source fan normal being stretched twentyfold',async()=>{
 const s=await setup(),reference=s.root.clone(true),mixer=new THREE.AnimationMixer(reference);mixer.clipAction(s.gltf.animations[0]).play()
 for(const pattern of BEAM_LATTICE_PATTERN_IDS){s.values.pattern=pattern;s.edit();for(let i=0;i<35;i++)s.step();mixer.setTime(s.controller.inspect().phase);reference.updateMatrixWorld(true)
  for(const mesh of s.original){const actual=new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld),authored=new THREE.Vector3(0,0,1).transformDirection(reference.getObjectByName(mesh.name)!.matrixWorld);expect(actual.angleTo(authored),pattern).toBeLessThan(.22)}
 }
 s.controller.dispose();mixer.stopAllAction();mixer.uncacheRoot(reference)
})
