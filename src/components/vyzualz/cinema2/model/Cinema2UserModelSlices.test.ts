import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { prepareCinema2UserModel } from './Cinema2UserModelPreparation'
import { buildCinema2UserModelSlices, cinema2SliceSpread, CINEMA2_SLICE_LIMITS } from './Cinema2UserModelSlices'
import { Cinema2UserModelPreviewEffects } from './Cinema2UserModelPreviewEffects'
import { CINEMA2_USER_MODEL_PREVIEWS } from './Cinema2UserModelPreviewPatterns'
import { createCinema2UserModelPreset, cinema2UserModelPreviewParameterId } from '../presets/Cinema2UserModelPresetFactory'
const library = { THREE } as unknown as Cinema2ThreeLibrary
function model(geometry: THREE.BufferGeometry = new THREE.BoxGeometry(2, 2, 2), materials: THREE.Material | THREE.Material[] = new THREE.MeshStandardMaterial()) {
  const root = new THREE.Group(), mesh = new THREE.Mesh(geometry, materials); root.add(mesh); return { root, mesh }
}
function area(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) { return b.clone().sub(a).cross(c.clone().sub(a)).length() / 2 }
function triangles(cut: ReturnType<typeof buildCinema2UserModelSlices>, run: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, cap: boolean) => void) {
  for (const mesh of cut.meshes) {
    const position = mesh.geometry.attributes.position
    for (const group of mesh.geometry.groups) for (let i = group.start; i < group.start + group.count; i += 3) run(...[0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, i + j).add(mesh.position)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3], group.materialIndex === 0)
  }
}

describe('actual model slices and closed cut faces', () => {
  it('clips the original surface exactly, caps both sides, preserves total volume, and winds caps outward', () => {
    const { root, mesh } = model(), prepared = prepareCinema2UserModel(library, root), source = [...mesh.geometry.attributes.position.array]
    const cut = buildCinema2UserModelSlices(library, prepared, [mesh])
    expect(cut.meshes).toHaveLength(14); expect(cut.openContours).toBe(0); expect(cut.capTriangles).toBeGreaterThan(0)
    let exteriorArea = 0, capArea = 0, volume = 0
    triangles(cut, (a, b, c, cap) => { const triangleArea = area(a, b, c); if (cap) capArea += triangleArea; else exteriorArea += triangleArea; volume += a.dot(b.clone().cross(c)) / 6 })
    expect(exteriorArea).toBeCloseTo(24, 4); expect(capArea).toBeCloseTo(13 * 2 * 4, 4); expect(volume).toBeCloseTo(8, 4)
    for (const slice of cut.meshes) {
      const position = slice.geometry.attributes.position, normal = slice.geometry.attributes.normal
      for (const group of slice.geometry.groups.filter(group => group.materialIndex === 0)) for (let i = group.start; i < group.start + group.count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(position, i), b = new THREE.Vector3().fromBufferAttribute(position, i + 1), c = new THREE.Vector3().fromBufferAttribute(position, i + 2)
        const cross = b.sub(a).cross(c.sub(a)); expect(cross.dot(new THREE.Vector3().fromBufferAttribute(normal, i))).toBeGreaterThan(0)
      }
    }
    expect([...mesh.geometry.attributes.position.array]).toEqual(source)
    expect(cut.byteLength).toBeLessThan(CINEMA2_SLICE_LIMITS.bytes); cut.dispose(); prepared.dispose()
  })

  it('triangulates holes without filling them in', () => {
    const shape = new THREE.Shape(); shape.moveTo(-1, -1); shape.lineTo(1, -1); shape.lineTo(1, 1); shape.lineTo(-1, 1); shape.closePath()
    const hole = new THREE.Path(); hole.moveTo(-.5, -.5); hole.lineTo(-.5, .5); hole.lineTo(.5, .5); hole.lineTo(.5, -.5); hole.closePath(); shape.holes.push(hole)
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false, steps: 1 }); geometry.rotateX(-Math.PI / 2)
    const { root, mesh } = model(geometry), prepared = prepareCinema2UserModel(library, root), cut = buildCinema2UserModelSlices(library, prepared, [mesh])
    let middleCaps = 0
    triangles(cut, (a, b, c, cap) => {
      if (!cap || Math.abs(a.y) > 1e-5) return
      middleCaps += area(a, b, c)
      const center = a.clone().add(b).add(c).multiplyScalar(1 / 3)
      expect(Math.abs(center.x) >= .5 - 1e-5 || Math.abs(center.z) >= .5 - 1e-5).toBe(true)
    })
    expect(cut.openContours).toBe(0); expect(middleCaps).toBeCloseTo(6, 4)
    cut.dispose(); prepared.dispose()
  })

  it('interpolates UVs and vertex colors, retains material slots/textures, and reports open surfaces honestly', () => {
    const geometry = new THREE.PlaneGeometry(2, 2), colors = new Float32Array(geometry.attributes.position.count * 3), texture = new THREE.Texture()
    for (let i = 0; i < geometry.attributes.position.count; i++) colors.set([geometry.attributes.uv.getX(i), geometry.attributes.uv.getY(i), .5], i * 3)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('uv1', geometry.attributes.uv.clone())
    texture.channel = 1
    const original = new THREE.MeshPhysicalMaterial({ map: texture, roughness: .17, metalness: .83, vertexColors: true }), { root, mesh } = model(geometry, original)
    const prepared = prepareCinema2UserModel(library, root), cut = buildCinema2UserModelSlices(library, prepared, [mesh])
    expect(cut.openContours).toBeGreaterThan(0); expect(cut.capTriangles).toBe(0)
    const material = cut.materials[1] as THREE.MeshPhysicalMaterial
    expect(material).not.toBe(original); expect(material.map).toBe(texture); expect(material.roughness).toBe(.17); expect(material.metalness).toBe(.83)
    for (const slice of cut.meshes) {
      const { position, uv, uv1, color } = slice.geometry.attributes
      for (let i = 0; i < position.count; i++) {
        expect(uv.getX(i)).toBeCloseTo((position.getX(i) + 1) / 2, 5)
        expect(uv.getY(i)).toBeCloseTo((position.getY(i) + slice.position.y + 1) / 2, 5)
        expect(uv1.getX(i)).toBeCloseTo(uv.getX(i), 5); expect(uv1.getY(i)).toBeCloseTo(uv.getY(i), 5)
        expect(color.getX(i)).toBeCloseTo(uv.getX(i), 5); expect(color.getY(i)).toBeCloseTo(uv.getY(i), 5)
      }
    }
    const sourceDispose = vi.spyOn(geometry, 'dispose'), textureDispose = vi.spyOn(texture, 'dispose'), cloneDispose = vi.spyOn(material, 'dispose')
    cut.dispose(); cut.dispose(); expect(sourceDispose).not.toHaveBeenCalled(); expect(textureDispose).not.toHaveBeenCalled(); expect(cloneDispose).toHaveBeenCalledOnce()
    prepared.dispose()
  })

  it('handles transformed meshes with different material groups', () => {
    const root = new THREE.Group(), a = new THREE.Mesh(new THREE.BoxGeometry(1, 2, .4), [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()])
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .4), new THREE.MeshStandardMaterial()); a.position.x = -1; b.position.set(1, .2, .2); root.add(a, b)
    const prepared = prepareCinema2UserModel(library, root), cut = buildCinema2UserModelSlices(library, prepared, [a, b])
    const slots = new Set(cut.meshes.flatMap(mesh => mesh.geometry.groups.map(group => group.materialIndex)))
    for (let i = 1; i <= 7; i++) expect(slots.has(i)).toBe(true)
    expect(cut.openContours).toBe(0); cut.dispose(); prepared.dispose()
  })
})

const frame = (time: number, values: Record<string, unknown>, paused = false): Cinema2ModuleUpdateContext => ({ frame: { elapsedTimeSec: time, timestampMs: time * 1000, deltaTimeSec: .125, contextGeneration: 1, transport: { trackId: 'logo', sourcePresent: true, playing: !paused, paused, animationActive: !paused, timeSec: time, bpm: 120 }, audio: null }, parameters: { get: (key: string) => values[key], getEditRevision: () => 0 } } as unknown as Cinema2ModuleUpdateContext)

describe('Phase 5 slicing choreography', () => {
  it.each(CINEMA2_USER_MODEL_PREVIEWS.slices)('separates and reconstructs the complete model for %s with Pattern Change off', pattern => {
    const { root, mesh } = model(), controller = new Cinema2UserModelPreviewEffects(library, 'slices'), values = { pattern, patternChange: false, autoPerformance: false, reactivity: 0, movement: .35, speed: 1 }
    controller.attach(root, true); controller.update(frame(0, values)); controller.beforeDraw('high')
    expect(mesh.parent!.visible).toBe(true)
    for (let t = .125; t <= 4; t += .125) controller.update(frame(t, values))
    controller.beforeDraw('high'); expect(controller.inspect().sliceSpread).toBe(1); expect(mesh.parent!.visible).toBe(false)
    expect(controller.inspect().sliceGeometry[0]).toMatchObject({ layers: 14, openContours: 0 })
    const sliced = root.getObjectByName('ActualModelSlices')!, positions = sliced.children.map(child => [...child.position.toArray(), ...child.rotation.toArray().slice(0, 3)])
    controller.update(frame(4.125, values, true)); controller.beforeDraw('low')
    expect(sliced.children.map(child => [...child.position.toArray(), ...child.rotation.toArray().slice(0, 3)])).toEqual(positions)
    for (let t = 4.25; t <= 8.125; t += .125) controller.update(frame(t, values))
    controller.beforeDraw('high'); expect(mesh.parent!.visible).toBe(true); expect(sliced.visible).toBe(false)
    controller.detach(root); expect(root.children).toEqual([mesh]); controller.dispose()
  })

  it('keeps the original visible and emits a diagnostic when actual slicing cannot be prepared', () => {
    const geometry = new THREE.PlaneGeometry(2, 2); geometry.rotateX(-Math.PI / 2)
    const { root, mesh } = model(geometry), controller = new Cinema2UserModelPreviewEffects(library, 'slices')
    controller.attach(root, true); controller.beforeDraw('high')
    expect(mesh.parent!.visible).toBe(true); expect(controller.inspect().sliceGeometry).toEqual([])
    expect(controller.getDiagnostics()[0]).toMatchObject({ code: 'CINEMA2_USER_MODEL_SLICES_LIMIT' })
    controller.dispose()
  })

  it('retains compatible IDs and exposes a bounded slice cycle in the canonical Design group', () => {
    const manifest = createCinema2UserModelPreset('slices'), parameter = manifest.parameters!.find(p => p.id === cinema2UserModelPreviewParameterId('slices', 'sliceCycleBeats'))!
    expect(manifest.revision).toBe(1); expect(parameter).toMatchObject({ defaultValue: 16, min: 8, max: 64, designParentGroup: 'design' })
    expect(manifest.modules![0].config).toMatchObject({ userModelPreview: 'slices', userModel: { neutralFloor: false } })
    expect(cinema2SliceSpread(0)).toBe(0); expect(cinema2SliceSpread(8)).toBe(1); expect(cinema2SliceSpread(16)).toBe(0)
  })
})
