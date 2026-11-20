import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { Cinema2PreparedUserModel, CINEMA2_MODEL_PREPARATION_LIMITS as limits, prepareCinema2UserModel } from './Cinema2UserModelPreparation'
import { Cinema2UserModelPreviewEffects } from './Cinema2UserModelPreviewEffects'
import { CINEMA2_USER_MODEL_PREVIEWS, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'
const library = { THREE } as unknown as Cinema2ThreeLibrary
function triangle(points: number[]) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
}

describe('shared rest-pose model preparation', () => {
  it('uses exact bounds across nested transforms and preserves every source buffer, material and transform', () => {
    const root = new THREE.Group(), group = new THREE.Group(), geometry = new THREE.BoxGeometry(2, 1, .5)
    const mesh = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ roughness: .21, metalness: .8 }))
    mesh.position.set(4, -1, 2); group.rotation.z = .3; group.scale.set(2, 3, 1); group.add(mesh); root.add(group)
    root.position.set(10, -4, 3); root.scale.setScalar(.01); root.updateMatrixWorld(true)
    const source = Array.from(geometry.attributes.position.array), transform = mesh.matrix.toArray(), material = mesh.material.toJSON()
    const expected = new THREE.Box3()
    const relative = root.matrixWorld.clone().invert().multiply(mesh.matrixWorld), vertex = new THREE.Vector3()
    for (let i = 0; i < geometry.attributes.position.count; i++) expected.expandByPoint(vertex.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(relative))
    const prepared = prepareCinema2UserModel(library, root)
    expect(prepared.center.distanceTo(expected.getCenter(new THREE.Vector3()))).toBeLessThan(1e-6)
    expect(prepared.size.distanceTo(expected.getSize(new THREE.Vector3()))).toBeLessThan(1e-6)
    expect(prepared.extent * prepared.scaleToUnit).toBeCloseTo(2)
    expect(prepared.parts[0].triangleCount).toBe(12)
    expect(Array.from(geometry.attributes.position.array)).toEqual(source)
    expect(mesh.matrix.toArray()).toEqual(transform); expect(mesh.material.toJSON()).toEqual(material)
    expect(root.children[0]).toBe(group); prepared.dispose()
  })

  it('samples surface area rather than triangle density and retains triangle, barycentric, UV and normal provenance', () => {
    const root = new THREE.Group()
    const large = triangle([0, 0, 0, 10, 0, 0, 0, 10, 0])
    large.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2))
    const small = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 20, 20), new THREE.MeshStandardMaterial()); small.position.x = 20
    root.add(large, small)
    const prepared = prepareCinema2UserModel(library, root), again = prepareCinema2UserModel(library, root)
    const largeSamples = [...prepared.sampleTriangles].filter(triangle => prepared.meshIndices[triangle] === 0).length
    expect(largeSamples / limits.defaultSamples).toBeCloseTo(50 / 51, 2)
    expect(prepared.samplePositions).toEqual(again.samplePositions)
    for (let sample = 0; sample < limits.defaultSamples; sample++) {
      const tri = prepared.sampleTriangles[sample], weights = prepared.sampleBarycentrics.subarray(sample * 3, sample * 3 + 3)
      expect(weights.reduce((sum, n) => sum + n, 0)).toBeCloseTo(1)
      for (let axis = 0; axis < 3; axis++) expect(prepared.samplePositions[sample * 3 + axis]).toBeCloseTo(weights.reduce((sum, weight, vertex) => sum + weight * prepared.positions[tri * 9 + vertex * 3 + axis], 0), 5)
      expect(new THREE.Vector3().fromArray(prepared.sampleNormals, sample * 3).length()).toBeCloseTo(1)
      if (tri === 0) { expect(prepared.sampleUvs[sample * 2]).toBeCloseTo(weights[1]); expect(prepared.sampleUvs[sample * 2 + 1]).toBeCloseTo(weights[2]) }
    }
    prepared.dispose(); again.dispose()
  })

  it('keeps mesh/material groups and identifies triangles spanning multiple future slicing sections', () => {
    const root = new THREE.Group(), geometry = new THREE.BoxGeometry(2, 4, 1)
    root.add(new THREE.Mesh(geometry, Array.from({ length: 6 }, (_, i) => { const material = new THREE.MeshStandardMaterial(); material.name = 'face-' + i; return material })))
    const prepared = prepareCinema2UserModel(library, root)
    expect([...new Set(prepared.materialIndices.subarray(0, prepared.triangleCount))]).toEqual([0, 1, 2, 3, 4, 5])
    expect(prepared.parts[0].materials).toEqual(['face-0', 'face-1', 'face-2', 'face-3', 'face-4', 'face-5'])
    expect(prepared.sections).toHaveLength(14)
    expect(prepared.sections[0].lower).toBe(-2); expect(prepared.sections[13].upper).toBe(2)
    expect(prepared.sectionRanges[0]).toBe(0); expect(prepared.sectionRanges[1]).toBe(13)
    expect(prepared.sections.every(section => section.crossingTriangleCount > 0)).toBe(true)
    prepared.dispose()
  })

  it('skips degenerate triangles and rejects empty, malformed or over-budget preparation before allocating output', () => {
    const mesh = triangle([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2]), root = new THREE.Group(); root.add(mesh)
    const prepared = prepareCinema2UserModel(library, root)
    expect(prepared.triangleCount).toBe(1); expect(prepared.degenerateTriangleCount).toBe(1)
    expect(prepared.byteLength).toBeLessThan(limits.bytes); prepared.dispose(); prepared.dispose(); expect(prepared.byteLength).toBe(0); expect(prepared.sections).toEqual([])
    expect(() => prepareCinema2UserModel(library, new THREE.Group())).toThrow(/no usable surface/)
    mesh.geometry.setDrawRange(1, 3); expect(() => prepareCinema2UserModel(library, root)).toThrow(/complete triangles/)
    mesh.geometry.setDrawRange(0, Infinity); mesh.geometry.setIndex([0, 1, 100]); expect(() => prepareCinema2UserModel(library, root)).toThrow(/invalid triangle index/)
    mesh.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array((limits.triangles + 1) * 3), 1))
    expect(() => prepareCinema2UserModel(library, root)).toThrow(/budget/)
  })

  it('rolls back a failed attachment and releases only owned preparation/materials', () => {
    const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
    root.add(mesh)
    const failedLibrary = { THREE: { ...THREE, TorusGeometry: class { constructor() { throw new Error('allocation failed') } } } } as unknown as Cinema2ThreeLibrary
    const disposePreparation = vi.spyOn(Cinema2PreparedUserModel.prototype, 'dispose')
    const disposeSource = vi.spyOn(mesh.geometry, 'dispose')
    const controller = new Cinema2UserModelPreviewEffects(failedLibrary, 'dust')
    expect(() => controller.attach(root, true)).toThrow('allocation failed')
    expect(root.children).toEqual([mesh]); expect(controller.inspect().attachmentCount).toBe(0)
    expect(disposePreparation).toHaveBeenCalledOnce(); expect(disposeSource).not.toHaveBeenCalled()
    disposePreparation.mockRestore(); disposeSource.mockRestore(); controller.dispose()
  })

  it.each(Object.keys(CINEMA2_USER_MODEL_PREVIEWS) as Cinema2UserModelPreviewKind[])('shares preparation rules for %s and releases them without losing the source on detach/reattach', kind => {
    const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, .4), new THREE.MeshStandardMaterial())
    root.add(mesh)
    const dispose = vi.spyOn(mesh.geometry, 'dispose'), material = mesh.material.toJSON(), controller = new Cinema2UserModelPreviewEffects(library, kind)
    controller.attach(root, true); const first = controller.inspect().preparations[0]
    controller.attach(root, true); expect(controller.inspect().attachmentCount).toBe(1)
    controller.beforeDraw('low'); controller.beforeDraw('high')
    expect(controller.inspect().preparations[0]).toEqual(first)
    expect(first).toMatchObject({ triangles: 12, samples: kind === 'dust' ? 16384 : 1536, sections: 14 })
    expect(first.cpuBytes).toBeLessThan(limits.bytes)
    controller.detach(root); controller.detach(root)
    expect(root.children).toEqual([mesh]); expect(mesh.material.toJSON()).toEqual(material); expect(dispose).not.toHaveBeenCalled()
    controller.attach(root, true); expect(controller.inspect().preparations[0]).toEqual(first)
    controller.dispose(); controller.dispose(); expect(root.children).toEqual([mesh]); expect(controller.inspect().preparations).toEqual([])
  })
})
