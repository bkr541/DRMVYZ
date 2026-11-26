import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {ARTIFACT_SPECS} from '../modules/artifactSculptures/ArtifactSpecs'
import {defaults,SIGNALS,type ArtifactState} from '../modules/artifactSculptures/ArtifactDomain'
import {relicPose} from '../modules/artifactSculptures/Relic'
import {RelicVolumes} from '../modules/artifactSculptures/RelicVolumes'

const spec=ARTIFACT_SPECS.find(s=>s.id==='relic')!
const base:ArtifactState={values:defaults(spec),pattern:'dormant',previous:'dormant',transition:1,phase:0,motion:0,flash:0,silence:0,projectionPhase:0,extraEnabled:true,palette:spec.palette}
function withVolumes(test:(volumes:RelicVolumes)=>void){
  const geometries=new Set<THREE.BufferGeometry>(),metal=new THREE.MeshStandardMaterial(),secondary=new THREE.MeshStandardMaterial(),core=new THREE.MeshStandardMaterial()
  const volumes=new RelicVolumes(THREE,g=>{geometries.add(g);return g},metal,secondary,core)
  try{test(volumes)}finally{geometries.forEach(g=>g.dispose());[metal,secondary,core].forEach(m=>m.dispose())}
}
describe('Relic volumetric artifact',()=>{
  it('has opaque beveled orbital armor with a true socket opening and a recessed lens',()=>withVolumes(volumes=>{
    volumes.update(base);volumes.root.updateMatrixWorld(true)
    const face=volumes.root.getObjectByName('face:1')!
    const plate=face.getObjectByName('orbital armor') as THREE.Mesh
    const lens=face.getObjectByName('recessed energy lens') as THREE.Mesh
    const ray=new THREE.Raycaster(new THREE.Vector3(1.06,.29,5),new THREE.Vector3(0,0,-1))
    expect(ray.intersectObject(plate)).toHaveLength(0)
    expect(ray.intersectObject(lens).length).toBeGreaterThan(0)
    ray.ray.origin.set(1.87,.26,5)
    expect(ray.intersectObject(plate).length).toBeGreaterThan(0)
    expect(volumes.inspect().relicSolidParts).toBe(6)
    expect(volumes.estimateGpuBytes()).toBeGreaterThan(0)
  }))
  it('articulates the jaw, fractures the paired plates and reconstructs them without replacing geometry',()=>withVolumes(volumes=>{
    const jaw=volumes.root.getObjectByName('jaw:1')!,face=volumes.root.getObjectByName('face:1')!
    const geometries=face.children.map(c=>(c as THREE.Mesh).geometry)
    volumes.update(base);const idleJaw=jaw.matrix.clone(),idleFace=face.matrix.clone()
    const roar={...base,pattern:'roar',previous:'roar'};volumes.update(roar)
    expect(jaw.matrix.equals(idleJaw)).toBe(false)
    expect(relicPose(roar).jawAngle).toBeGreaterThan(relicPose(base).jawAngle)
    volumes.update({...base,pattern:'fracture',previous:'fracture'});expect(face.matrix.equals(idleFace)).toBe(false)
    const reconstruct={...base,pattern:'reconstruct',previous:'reconstruct',phase:Math.PI/(2*.65*base.values.reconstructionSpeed)}
    expect(relicPose(reconstruct).separation).toBeLessThan(relicPose({...base,pattern:'fracture',previous:'fracture'}).separation)
    volumes.update(base);expect(face.matrix.equals(idleFace)).toBe(true)
    expect(face.children.map(c=>(c as THREE.Mesh).geometry)).toEqual(geometries)
  }))
  it('retains finite volume bounds across patterns and control extremes',()=>withVolumes(volumes=>{
    for(const pattern of spec.patterns)for(const extreme of ['min','max'] as const){
      const state={...base,pattern,previous:pattern,phase:3,motion:1,values:{...base.values,...Object.fromEntries(spec.controls.map(c=>[c.key,c[extreme]])),...Object.fromEntries(Object.keys(SIGNALS).map(k=>[k,1]))}}
      volumes.update(state);volumes.root.updateMatrixWorld(true)
      const bounds=new THREE.Box3().setFromObject(volumes.root,true)
      expect([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)).toBe(true)
      expect(bounds.min.y).toBeGreaterThan(spec.room.floor)
      expect(bounds.max.y).toBeLessThan(5)
    }
  }))
  it('keeps only sparse bounded channels when containment is disabled',()=>{
    const roles:number[]=[]
    spec.geometry({...base,extraEnabled:false,pattern:'cataclysm',previous:'cataclysm',values:{...base.values,dropAccent:1}},(_a,_b,_r,role=0,energy=1)=>{roles.push(role);expect(energy).toBeLessThanOrEqual(1.5)},'high')
    expect(roles.length).toBeGreaterThan(0);expect(roles.every(role=>role===2)).toBe(true)
  })
})
