import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { SWITCH_IT_PHASE1_ID, SWITCH_IT_PHASE1_MANIFEST, createSwitchItPhase1Registries } from '../presets/Cinema2SwitchItPhase1Preset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { NodeIO } from '@gltf-transform/core'
import { buildSwitchItMaskGeometry, disposeSwitchItMaskSource, SWITCH_IT_MASK_REGISTRATION } from '../modules/switchIt/Cinema2SwitchItMask'
import { buildSwitchItHuman, SWITCH_IT_LANDMARKS } from '../modules/switchIt/Cinema2SwitchItGeometry'
import { SWITCH_IT_HUMAN_METADATA } from '../modules/switchIt/Cinema2SwitchItHuman.generated'

describe('Switch It Phase 1 visual core', () => {
  it('compiles privately without publishing an unfinished preset', () => {
    expect(() => createSwitchItPhase1Registries()).not.toThrow()
    expect(cinema2NativePresetRegistry.has(SWITCH_IT_PHASE1_ID)).toBe(false)
    expect(SWITCH_IT_PHASE1_MANIFEST.effects).toEqual([])
    expect(SWITCH_IT_PHASE1_MANIFEST.choreography?.rules).toEqual([])
    expect(SWITCH_IT_PHASE1_MANIFEST.cameras?.[0].rig).toEqual({ kind: 'static' })
    expect(SWITCH_IT_PHASE1_MANIFEST.parameters?.every(p => p.exposure === 'diagnostic' && !p.choreographable && !p.modulatable && !p.automatable)).toBe(true)
  })
  it('uses the supplied mask topology, UVs and portrait registration', async () => {
    const document=await new NodeIO().read('public/cinema2/models/switch-it-demon-mask.glb')
    const root=new THREE.Group()
    for(const node of document.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()??[]){
      const geometry=new THREE.BufferGeometry()
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(primitive.getAttribute('POSITION')!.getArray()!,3))
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(primitive.getAttribute('NORMAL')!.getArray()!,3))
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(primitive.getAttribute('TEXCOORD_0')!.getArray()!,2))
      geometry.setIndex(Array.from(primitive.getIndices()!.getArray()!))
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial())
      mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(node.getWorldMatrix());root.add(mesh)
    }
    const parts=buildSwitchItMaskGeometry(THREE,root)
    expect(parts).toHaveLength(1)
    const geometry=parts[0].geometry
    expect(geometry.index!.count/3).toBe(5686)
    expect(geometry.getAttribute('uv').count).toBe(3807)
    expect(geometry.getAttribute('normal').count).toBe(3807)
    geometry.computeBoundingBox()
    const size=geometry.boundingBox!.getSize(new THREE.Vector3())
    expect(size.x).toBeCloseTo(SWITCH_IT_MASK_REGISTRATION.width,5)
    expect(size.x).toBeCloseTo(2.806*1.30,5)
    expect(size.z).toBeGreaterThan(1)
    expect(geometry.boundingBox!.min.y).toBeGreaterThan(-1.4)
    expect(geometry.boundingBox!.max.y).toBeLessThan(1.9)
    expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
    geometry.dispose();disposeSwitchItMaskSource(root)
  })
  it('retains finite faceted anatomy and registered facial landmarks', () => {
    const geometry=buildSwitchItHuman(THREE)
    const positions=geometry.getAttribute('position')
    expect(positions.count).toBe(2100*3)
    expect(Array.from(positions.array).every(Number.isFinite)).toBe(true)
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.max.y).toBeCloseTo(SWITCH_IT_LANDMARKS.crown,1)
    for(const eye of SWITCH_IT_HUMAN_METADATA.eyes){
      expect(Math.abs(eye.center[0])).toBeCloseTo(SWITCH_IT_LANDMARKS.eyeX,3)
      expect(eye.center[1]).toBeCloseTo(SWITCH_IT_LANDMARKS.eyes,3)
    }
    const normals=geometry.getAttribute('normal')
    for(let i=0;i<normals.count;i+=3){
      expect(normals.getX(i)).toBe(normals.getX(i+1))
      expect(normals.getY(i)).toBe(normals.getY(i+2))
    }
    geometry.dispose()
  })
})
