import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {expect,it} from 'vitest'
import * as THREE from 'three'
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'
import {CINEMA2_MOIRE_ORB_PRESET_MANIFEST as manifest} from '../presets/Cinema2MoireOrbPreset'
import {cinema2NativePresetRegistry} from '../presets/Cinema2PresetRegistry'
import {Cinema2MoireOrbController} from '../modules/Cinema2MoireOrbNativeModule'
import {MoireOrbReactorScene,type ReactorControls} from '../modules/moireOrb/MoireOrbReactorScene'
import {MOIRE_ORB_PATTERN_IDS,reactorPattern} from '../modules/moireOrb/MoireOrbPatterns'
import type {Cinema2ThreeLibrary} from '../modules/three/Cinema2ThreeLibrary'
import type {Cinema2ModuleUpdateContext,Cinema2ModuleFrameReadContext} from '../modules/Cinema2ModuleContracts'
import {CINEMA2_AFTERHOURS_TRIGGER_OPTIONS} from '../presets/Cinema2AfterhoursPreset'
import {moodMusic} from './support/MoodMigrationHarness'
const source='public/cinema2/models/crate/geometry_texture_effect_spheres.glb'
async function setup(){
 const bytes=readFileSync(source),scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene
 const values:Record<string,unknown>={...manifest.modules![0].parameters}
 const controller=new Cinema2MoireOrbController({THREE} as Cinema2ThreeLibrary),original:THREE.BufferGeometry[]=[]
 scene.traverse(o=>{if(o instanceof THREE.Mesh)original.push(o.geometry)})
 controller.attach(scene)
 let time=0,revision=0
 const step=(provided?:Cinema2ModuleFrameReadContext)=>{time+=1/30;const frame=provided??{frameId:time*30,timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:1/30,contextGeneration:1,audio:null,director:null,mood:null,transport:{sourcePresent:false,playing:false,paused:false,animationActive:true,timeSec:time,trackId:null,bpm:120}};controller.update({frame,parameters:{get:(name:string)=>values[name],getEditRevision:()=>revision},targets:{}} as unknown as Cinema2ModuleUpdateContext);controller.beforeDraw('high');scene.updateMatrixWorld(true)}
 return {controller,scene,values,step,original,edit:()=>{revision++}}
}
it('registers under the original preset identity, preserving the original source and six real programs',()=>{
 const compiled=cinema2NativePresetRegistry.compile(manifest.id);expect(compiled.ok,JSON.stringify(compiled)).toBe(true)
 const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex')
 expect(hash(source)).toBe(hash('3D Cinema 2.0 Crate/geometry_texture_effect_spheres.glb'))
 expect(manifest.parameters!.filter(p=>p.designParentGroup==='palette')).toHaveLength(5)
 expect(new Set(MOIRE_ORB_PATTERN_IDS.map(id=>JSON.stringify([0,.7,1.8].flatMap(phase=>[0,7,23,44].map(i=>reactorPattern(id,phase,i)))))).size).toBe(6)
})
it('builds exactly 48 segments and twelve physical fixture/beam/light rigs around the original five meshes',async()=>{
 const s=await setup();s.step();expect(s.controller.inspect()).toMatchObject({sourceMeshes:5,ringSegments:48,movingFixtures:12,activeDirectLights:12,chamberRadius:17,chamberCells:144,coreElectrodeCells:48,equipmentBays:12,totalLightingCells:240})
 expect(s.scene.getObjectByName('reactor-original-moire-core')).toBeDefined()
 for(let i=0;i<12;i++)expect(s.scene.getObjectByName(`reactor-moving-fixture-${i}`)).toBeDefined()
 const ring=s.scene.getObjectByName('reactor-gimbal-0')!,frame=s.scene.getObjectByName('reactor-ring-frame-0')!,strip=s.scene.getObjectByName('reactor-segment-0')!
 const start=ring.localToWorld(new THREE.Vector3(Math.cos(.14)*4.6,Math.sin(.14)*4.6,0)),end=ring.localToWorld(new THREE.Vector3())
 const hits=new THREE.Raycaster(start,end.sub(start).normalize()).intersectObjects([frame,strip],false)
 expect(hits[0]?.object).toBe(strip) // A light strip must be visible outside its metal support.
 const coreCells=s.scene.getObjectByName('reactor-core-electrode-cells')!,coreMachinery=s.scene.getObjectByName('reactor-containment-machinery')!
 const electrodeHits=new THREE.Raycaster(new THREE.Vector3(0,-1.45,4.5),new THREE.Vector3(0,0,-1)).intersectObjects([coreCells,coreMachinery],true)
 expect(electrodeHits[0]?.object).toBe(coreCells)
 const coreBounds=new THREE.Box3().setFromObject(s.scene.getObjectByName('reactor-source-lattice')!).getSize(new THREE.Vector3());expect(Math.max(coreBounds.x,coreBounds.y,coreBounds.z)).toBeGreaterThan(6.2)
 const shell=s.scene.getObjectByName('reactor-complete-chamber')!;expect(shell.children.length).toBeGreaterThan(70);expect(s.controller.inspect().mechanicalDetailPieces).toBeGreaterThan(2000)
 s.controller.dispose();expect(s.controller.inspect()).not.toHaveProperty('ownedGeometryCount')
})
it('moves real layers, rings and fixture heads, freezes both motion domains and honors hard lighting zeros',async()=>{
 const s=await setup();s.step();const ring=s.scene.getObjectByName('reactor-gimbal-1')!,head=s.scene.getObjectByName('reactor-moving-fixture-2')!,first=ring.matrixWorld.clone(),aim=head.quaternion.clone()
 for(let i=0;i<12;i++)s.step();expect(ring.matrixWorld.elements).not.toEqual(first.elements);expect(head.quaternion.toArray()).not.toEqual(aim.toArray())
 s.values.fixtureSpeed=0;s.step();const held=head.quaternion.clone();for(let i=0;i<10;i++)s.step();expect(head.quaternion.toArray()).toEqual(held.toArray())
 s.values.motionRate=0;s.values.fixtureSpeed=0;s.values.ringTravel=0;s.step();const frozen=ring.matrixWorld.clone();for(let i=0;i<10;i++)s.step();expect(ring.matrixWorld.elements).toEqual(frozen.elements)
 s.values.ringLighting=0;s.values.fixtureLighting=0;s.values.chamberLighting=0;s.values.coreDetailLighting=0;s.step();expect(s.scene.getObjectByName('reactor-segment-0')!.visible).toBe(false);expect(s.controller.inspect().activeDirectLights).toBe(0)
 const bank=s.scene.getObjectByName('reactor-chamber-lighting-cells') as THREE.InstancedMesh;const led=new THREE.Color();bank.getColorAt(0,led);expect(led.toArray()).toEqual([0,0,0])
 s.values.intensity=0;s.step();expect(s.scene.getObjectByName('reactor-complete-chamber')!.visible).toBe(false)
 s.controller.dispose()
})
it('keeps the twelve visible fixture rigs at every tier, owns procedural resources, and preserves source geometry on disposal',async()=>{
 const s=await setup();s.step();for(const [quality,count]of [['low',4],['medium',6],['high',12]] as const){s.controller.beforeDraw(quality);expect(s.controller.inspect()).toMatchObject({movingFixtures:12,ringSegments:48,activeDirectLights:count})}
 let sourceDisposed=false,ownedDisposed=false;s.original[0].addEventListener('dispose',()=>{sourceDisposed=true});(s.scene.getObjectByName('reactor-segment-0') as THREE.Mesh).geometry.addEventListener('dispose',()=>{ownedDisposed=true})
 s.controller.dispose();expect(ownedDisposed).toBe(true);expect(sourceDisposed).toBe(false)
})
it('uses shared Mood policy and bounded drop overrides, preserves manual authority, and holds pause',async()=>{
 const s=await setup(),music=moodMusic();s.values.autoPerformance=true;s.values.reactivity=1
 const step=(options={})=>s.step(music.next(options));for(let i=0;i<30;i++)step({energy:.7,section:'verse'})
 expect(s.controller.inspect().patternControlsAutomatic).toBe(true);expect(s.values.patternChange).toBe(false)
 step({energy:.8,section:'drop',event:'drop',eventId:1});expect(s.controller.inspect()).toMatchObject({pattern:'radial-discharge',overrideReason:'drop'})
 const phase=s.controller.inspect().phase;for(let i=0;i<4;i++){const f=music.next({energy:.8,section:'drop'});s.step({...f,transport:{...f.transport!,paused:true,playing:false,animationActive:false}})}
 expect(s.controller.inspect().phase).toBe(phase);expect(s.controller.inspect().overrideReason).toBe('drop')
 s.values.autoPerformance=false;step({energy:.8,section:'drop'});expect(s.controller.inspect()).toMatchObject({overrideReason:null,pattern:'core-ignition',patternWeights:[1,0,0,0,0,0]})
 s.values.autoPerformance=true;step({energy:.8,section:'drop',event:'drop',eventId:9});expect(s.controller.inspect().overrideReason).toBe('drop')
 s.values.pattern='ring-chase';s.edit();step({energy:.8,section:'drop'});expect(s.controller.inspect()).toMatchObject({pattern:'ring-chase',overrideReason:null})
 step({energy:.8,section:'drop',event:'drop',eventId:2});for(let i=0;i<135;i++)step({energy:.8,section:'drop'});expect(s.controller.inspect().overrideReason).toBeNull()
 s.values.reactivity=0;step({energy:1,section:'drop',event:'drop',eventId:3});expect(s.controller.inspect()).toMatchObject({patternControlsAutomatic:false,overrideReason:null})
 s.controller.dispose()
})


it('advances only on fresh events for each canonical Trigger and accepts immediate manual edits while Pattern Change stays on',async()=>{
 const s=await setup()
 for(const option of CINEMA2_AFTERHOURS_TRIGGER_OPTIONS){
  const music=moodMusic();s.values.pattern='core-ignition';s.values.patternChange=true;s.values.trigger=option.value;s.edit()
  const frame=(id:string)=>{const f=music.next({energy:.6,trackId:`trigger-${option.value}`}),a=f.audio!,event={id,timeSec:a.upstream.timeSec};return {...f,audio:{...a,rhythm:{...a.rhythm,beat:event,kick:event,snare:event,downbeat:event,beatIndex:{available:true,value:32},barIndex:{available:true,value:8},fixedClocks:{...a.rhythm.fixedClocks,4:{...a.rhythm.fixedClocks[4],boundary:event},16:{...a.rhythm.fixedClocks[16],boundary:event}}},structure:{...a.structure,analyzedPhrases:{available:true,value:[event]},semanticMoments:{available:true,value:[{...event,type:'drop_impact'}]}}}} as unknown as Cinema2ModuleFrameReadContext}
  s.step(frame('first'));const second=frame('second');s.step(second);expect(s.controller.inspect().pattern,option.value).toBe('counter-rotation');s.step(second);expect(s.controller.inspect().pattern).toBe('counter-rotation')
  s.values.pattern='ring-chase';s.edit();s.step(second);expect(s.controller.inspect().pattern).toBe('ring-chase');expect(s.values.patternChange).toBe(true)
 }
 s.controller.dispose()
})


it('blends along the short rotation arc after a long performance instead of adding accumulated full turns',async()=>{
 const bytes=readFileSync(source),root=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene
 const scene=new MoireOrbReactorScene({THREE} as Cinema2ThreeLibrary,root),controls={...manifest.modules![0].parameters} as unknown as ReactorControls
 scene.draw(controls,4000,4000,[1,0,0,0,0,0],'medium');const before=root.getObjectByName('reactor-gimbal-0')!.quaternion.clone()
 scene.draw(controls,4000,4000,[0,0,0,0,1,0],'medium');const after=root.getObjectByName('reactor-gimbal-0')!.quaternion.clone()
 scene.draw(controls,4000,4000,[.5,0,0,0,.5,0],'medium');const middle=root.getObjectByName('reactor-gimbal-0')!.quaternion
 expect(before.angleTo(middle)).toBeCloseTo(before.angleTo(after)/2,5)
 expect(middle.angleTo(after)).toBeCloseTo(before.angleTo(after)/2,5)
 scene.dispose()
})
