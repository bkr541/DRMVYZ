import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { MonumentScene } from '../modules/monument/MonumentScene'
import { MonumentPerformance } from '../modules/monument/MonumentPerformance'
import { MONUMENT_CAMERA, MONUMENT_PATTERNS } from '../modules/monument/MonumentGeometry'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { fitCinema2FovToMinAspect } from '../spatial/Cinema2CameraRuntime'

const library={THREE} as unknown as Cinema2ThreeLibrary
function fixture(){
  const root=new THREE.Group(),scene=new MonumentScene(library,root),performance=new MonumentPerformance(i=>(i%7)/7)
  const values:Record<string,unknown>={'motion-safety':'full','content-type':'text',pattern:'reveal','auto-performance':false}
  let time=0
  function draw(quality='high'){
    time+=.05
    performance.update({parameters:{get:(key:string)=>values[key]},frame:{contextGeneration:1,frameId:Math.round(time*60),timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:.05,audio:null,director:null,mood:null,transport:{trackId:'test',timeSec:time,playing:true,paused:false,animationActive:true,bpmSync:true,bpm:120,sourcePresent:true}}} as unknown as Cinema2ModuleUpdateContext)
    scene.apply(performance,quality);root.updateMatrixWorld(true)
  }
  return {root,scene,values,draw}
}
function assertFramed(hero:THREE.Object3D){
  const bounds=new THREE.Box3().setFromObject(hero)
  expect(bounds.isEmpty()).toBe(false)
  expect(bounds.min.y).toBeGreaterThan(-2.53);expect(bounds.max.y).toBeLessThanOrEqual(2.116)
  for(const aspect of [16/9,9/16])for(const x of [-1.2,1.2])for(const y of [-1.1,.1]){
    const camera=new THREE.PerspectiveCamera(fitCinema2FovToMinAspect(MONUMENT_CAMERA.minFov,aspect,16/9),aspect,.12,80)
    camera.position.set(x,y,MONUMENT_CAMERA.minZ);camera.lookAt(...MONUMENT_CAMERA.target);camera.updateMatrixWorld(true)
    for(const px of [bounds.min.x,bounds.max.x])for(const py of [bounds.min.y,bounds.max.y])for(const pz of [bounds.min.z,bounds.max.z]){
      const p=new THREE.Vector3(px,py,pz).project(camera);expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1)
    }
  }
}
describe('Monument native scene (CPU geometry, not WebGL)',()=>{
  it('fits default and multiline glyphs and distinct tall/wide imported models without rewriting original material',()=>{
    const {root,scene,values,draw}=fixture()
    try{
      draw();const text=root.getObjectByName('monument-hero-text')!;assertFramed(text)
      values.text='STAGELESS STUDIO';values['line-2']='MONUMENT';values['line-3']='LIVE';draw();assertFramed(text)
      values['content-type']='model';values['model-yaw']=35;values['model-scale']=1.2
      for(const dims of [[2,20,1],[20,2,1]] as const){
        const geometry=new THREE.BoxGeometry(...dims),material=new THREE.MeshStandardMaterial({color:0x597aa3,transparent:true,opacity:.6,roughness:.73,metalness:.18}),model=new THREE.Mesh(geometry,material)
        scene.attachModel(model);root.add(model)
        try{draw();expect(text.visible).toBe(false);assertFramed(model);expect(material.color.getHex()).toBe(0x597aa3);expect(material.opacity).toBe(.6);expect(material.transparent).toBe(true);expect(material.roughness).toBe(.73)}
        finally{scene.detachModel(model);root.remove(model);geometry.dispose();material.dispose()}
      }
      values['content-type']='text';draw();expect(text.visible).toBe(true);assertFramed(text)
    }finally{scene.dispose()}
  })
  it('keeps the authored text and font geometry through model loading, replacement and removal',()=>{
    const {root,scene,values,draw}=fixture()
    const first=new THREE.Mesh(new THREE.BoxGeometry(2,3,1),new THREE.MeshStandardMaterial({color:0x123456,transparent:true,opacity:.5}))
    const second=new THREE.Mesh(new THREE.BoxGeometry(3,1,2),new THREE.MeshStandardMaterial({color:0xaabbcc}))
    try{
      values.text='LIVE';values.font='stageless';values['line-2']='NOW';draw()
      const text=root.getObjectByName('monument-hero-text')!
      const glyphs=[...text.children];expect(glyphs).toHaveLength(7)
      values['content-type']='model';draw();expect(text.visible).toBe(true);expect(text.children).toEqual(glyphs)
      root.add(first);scene.attachModel(first);draw();expect(text.visible).toBe(false);expect(first.visible).toBe(true)
      expect(first.material.color.getHex()).toBe(0x123456);expect(first.material.opacity).toBe(.5)
      scene.detachModel(first);root.remove(first);draw();expect(text.visible).toBe(true);expect(text.children).toEqual(glyphs)
      root.add(second);scene.attachModel(second);draw();expect(text.visible).toBe(false);expect(second.visible).toBe(true)
      scene.detachModel(second);root.remove(second);values['content-type']='text';draw()
      expect(text.visible).toBe(true);expect(text.children).toEqual(glyphs)
      expect(values.font).toBe('stageless');expect(values.text).toBe('LIVE')
    }finally{scene.dispose();for(const mesh of [first,second]){mesh.geometry.dispose();mesh.material.dispose()}}
  })
  it('applies architectural pattern travel to real scene groups and retains crown lights at low quality',()=>{
    const {root,scene,values,draw}=fixture()
    try{
      const wing=root.getObjectByName('monument-wing-right-2')!,crown=root.getObjectByName('monument-crown-2')!
      const poses=new Set<string>()
      for(const {value} of MONUMENT_PATTERNS){values.pattern=value;draw();poses.add(`${wing.position.x.toFixed(3)}:${crown.position.y.toFixed(3)}`)}
      expect(poses.size).toBe(6)
      values['motion-safety']='lockoff';draw('low');expect(wing.position.x).toBe(0);expect(crown.position.y).toBe(0)
      expect(root.getObjectByName('monument-relay-crown-1')!.visible).toBe(true)
      expect(root.getObjectByName('monument-relay-floor-1')!.visible).toBe(false)
      draw('high');expect(root.getObjectByName('monument-relay-floor-1')!.visible).toBe(true)
    }finally{scene.dispose()}
  })
})
