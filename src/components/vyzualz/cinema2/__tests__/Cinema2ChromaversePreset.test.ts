import { describe, expect, it } from 'vitest'
import { CHROMAVERSE_PRESET_MANIFESTS } from '../presets/Cinema2ChromaversePresets'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { chromaverseModuleTypeId, createChromaverseModuleDefinition, type ChromaverseModuleInstance } from '../modules/Cinema2ChromaverseNativeModule'
import * as THREE from 'three'
import { ChromaverseChoreography } from '../modules/chromaverse/ChromaverseChoreography'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ThreeLoadedAsset } from '../modules/three/Cinema2ThreeAssetCache'
import type { Cinema2CameraFrame } from '../spatial/Cinema2CameraRuntime'
import { PROFILES, patterns, patternPose, defaults, palette, type ChromaverseState } from '../modules/chromaverse/ChromaverseDomain'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import type { Cinema2ModuleCreateContext, Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'

describe('Cinema 2.0 CHROMAVERSE', () => {
 it('registers ten independent native manifests with unique assets and canonical inspector authority', () => {
  expect(CHROMAVERSE_PRESET_MANIFESTS).toHaveLength(10)
  expect(new Set(CHROMAVERSE_PRESET_MANIFESTS.map(m=>m.id)).size).toBe(10)
  for(const [i,profile] of PROFILES.entries()){
   const manifest=CHROMAVERSE_PRESET_MANIFESTS[i]!
   expect(compileCinema2NativePreset(manifest).ok).toBe(true)
   expect(cinema2NativePresetRegistry.compile(manifest.id).ok).toBe(true)
   expect(cinema2NativeModuleRegistry.get(chromaverseModuleTypeId(profile),1)).toBeTruthy()
   expect(cinema2ThreeAssetRegistry.get(`cinema2-chromaverse-${profile.key}`)).toBeTruthy()
   expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest}).diagnostics).toEqual([])
   expect(new Set(manifest.parameters!.map(p=>p.designParentGroup).filter(Boolean))).toEqual(new Set(['master-controls','design','effects','palette']))
   expect(manifest.parameters!.find(p=>p.label==='Pattern')?.options).toHaveLength(10)
   expect(manifest.parameters!.find(p=>p.label==='Trigger')?.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
   expect(manifest.parameters!.find(p=>p.label==='Auto Performance')?.defaultValue).toBe(false)
   expect(manifest.variations).toHaveLength(8)
  }
 })
 it('has ten finite and distinct spatial programs per source asset',()=>{
  for(const p of PROFILES){
   const poses=patterns(p).map(pattern=>[.1,.35,.65,.9].map(i=>patternPose(p,pattern,i,.37,.8,.5)))
   expect(new Set(poses.map(pose=>JSON.stringify(pose))).size).toBe(10)
   expect(poses.flatMap(group=>group.flatMap(pose=>Object.values(pose))).every(Number.isFinite)).toBe(true)
  }
 })
 it('deduplicates kick events, pauses time and retains manual selection for every profile',()=>{
  for(const [i,p] of PROFILES.entries()){
   const module=CHROMAVERSE_PRESET_MANIFESTS[i]!.modules![0]!,values=new Map(Object.entries(module.parameters!))
   values.set('patternChange',true);values.set('trigger','kick')
   const parameters={get:(key:string)=>values.get(key),getAuthored:(key:string)=>values.get(key),resolve:()=>null}
   const instance=createChromaverseModuleDefinition(p).create({module,parameters} as unknown as Cinema2ModuleCreateContext) as ChromaverseModuleInstance
   let tick=0,time=0
   const update=(kick:string|null,paused=false)=>{
    tick++;if(!paused)time+=1/60
    const audio={upstream:{timeSec:time,trackId:'track',publicationSequence:tick},rhythm:{kick:kick?{id:kick}:null},structure:{semanticMoments:{available:false},section:{available:false}}}
    instance.lifecycle.update({parameters,targets:{},frame:{frameId:tick,elapsedTimeSec:time,timestampMs:tick*1000/60,deltaTimeSec:1/60,viewport:{width:840,height:525,dpr:1},contextGeneration:1,audio,director:null,transport:{sourcePresent:true,playing:!paused,analysisActive:true,paused,animationActive:!paused,trackId:'track',timeSec:time}}} as unknown as Cinema2ModuleUpdateContext)
    return instance.inspect()
   }
   expect(update(null).performingPattern).toBe(patterns(p)[0]);const next=update('kick-1');expect(next.performingPattern).toBe(patterns(p)[1]);expect(update('kick-1').performingPattern).toBe(next.performingPattern);const held=update(null);expect(update('kick-2',true).phase).toBe(held.phase)
   expect(values.get('pattern')).toBe(patterns(p)[0]);values.set('pattern',patterns(p)[7]!);expect(update(null).performingPattern).toBe(patterns(p)[7]);instance.lifecycle.dispose()
  }
 })
})

// These tests exercise artistic model content without a WebGL context. Only the shared
// bridge is allowed to turn that content into pixels; the artwork generator exercises it.
describe('CHROMAVERSE shared bridge choreography', () => {
 it('authors finite, repeatable poses across all profiles without owning a renderer', () => {
  const library = { THREE } as unknown as Cinema2ThreeLibrary
  for (const profile of PROFILES) {
   const container = new THREE.Group(), source = new THREE.Group()
   const geometry = new THREE.BoxGeometry(.5,.5,.5), material = new THREE.MeshStandardMaterial({color:0xffffff})
   const a = new THREE.Mesh(geometry,material.clone()), b = new THREE.Mesh(geometry,material.clone())
   a.name='plane-a';b.name='plane-b';a.position.x=-1;b.position.x=1;source.add(a,b);container.add(source)
   const asset = {id:`cinema2-chromaverse-${profile.key}`,scene:source,animations:[],gpuBytes:0} as unknown as Cinema2ThreeLoadedAsset
   const art = new ChromaverseChoreography(library,asset,container,profile)
   const camera = {position:profile.camera,projectionMatrix:new THREE.PerspectiveCamera(42,16/9,.12,60).projectionMatrix.elements} as unknown as Cinema2CameraFrame
   const state:ChromaverseState={values:defaults(profile),palette:palette(profile),pattern:patterns(profile)[0]!,previous:patterns(profile)[0]!,transition:1,phase:.37,clipTime:0,motion:1,flash:.2,silence:0,cameraMode:'float'}
   expect('draw' in art).toBe(false)
   for (const pattern of patterns(profile)) {
    state.pattern=state.previous=pattern
    art.pose(state,'high',0,camera)
    const first=a.matrixWorld.elements.slice()
    expect(first.every(Number.isFinite)).toBe(true)
    expect(art.inspect().activeSurfaces).toBeGreaterThan(0)
    art.pose(state,'high',0,camera)
    expect(a.matrixWorld.elements).toEqual(first)
   }
   art.dispose();art.dispose();a.material.dispose();b.material.dispose();material.dispose();geometry.dispose()
  }
 })
})
