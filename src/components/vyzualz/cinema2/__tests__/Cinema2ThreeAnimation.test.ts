import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Cinema2ThreeAnimationController, cloneCinema2AssetScene, describeCinema2AnimationClips } from '../modules/three/Cinema2ThreeAnimation'
import { describeCinema2LoadedModel } from '../modules/three/Cinema2ThreeAssetMetadata'

function rig() {
  const root = new THREE.Group()
  const part = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
  part.name = 'part'
  root.add(part)
  const move = new THREE.AnimationClip('move', 2, [new THREE.VectorKeyframeTrack('part.position', [0, 2], [0, 0, 0, 4, 0, 0])])
  const grow = new THREE.AnimationClip('grow', 1, [new THREE.NumberKeyframeTrack('part.morphTargetInfluences[0]', [0, 1], [0, 1])])
  return { root, part, clips: [move, grow] }
}

describe('animation clips and controller', () => {
  it('describes clips by targets and kinds', () => {
    const { clips } = rig()
    const info = describeCinema2AnimationClips(clips)
    expect(info[0]).toMatchObject({ name: 'move', duration: 2, trackCount: 1, targets: ['part'], kinds: ['transform'] })
    expect(info[1]).toMatchObject({ name: 'grow', kinds: ['morph'] })
  })

  it('does nothing until a clip is played', () => {
    const { root, part, clips } = rig()
    const controller = new Cinema2ThreeAnimationController(THREE, root, clips)
    controller.update(1)
    controller.sync(1)
    expect(part.position.x).toBe(0)
    expect(controller.getSnapshot().active).toEqual([])
  })

  it('is a pure function of timeline time under sync(): seeking, replaying and pausing land on the same pose', () => {
    const { root, part, clips } = rig()
    const controller = new Cinema2ThreeAnimationController(THREE, root, clips)
    controller.play('move', { loop: 'repeat' })
    controller.sync(1)
    expect(part.position.x).toBeCloseTo(2, 6)
    controller.sync(0.5)
    expect(part.position.x).toBeCloseTo(1, 6)
    controller.sync(3)
    expect(part.position.x).toBeCloseTo(2, 6)
    controller.pause()
    controller.sync(1)
    expect(part.position.x).toBeCloseTo(2, 6)
    controller.setSpeed(2)
    controller.sync(0.5)
    expect(part.position.x).toBeCloseTo(2, 6)
  })

  it('free-running update honours pause/resume, speed and seek', () => {
    const { root, part, clips } = rig()
    const controller = new Cinema2ThreeAnimationController(THREE, root, clips)
    controller.play('move')
    controller.update(1)
    expect(part.position.x).toBeCloseTo(2, 6)
    controller.pause()
    controller.update(1)
    expect(part.position.x).toBeCloseTo(2, 6)
    controller.resume()
    controller.setSpeed(0.5)
    controller.update(1)
    expect(part.position.x).toBeCloseTo(3, 6)
    controller.seek(0)
    expect(part.position.x).toBeCloseTo(0, 6)
  })

  it('plays once and clamps, and rejects unknown or duplicate clips', () => {
    const { root, part, clips } = rig()
    const controller = new Cinema2ThreeAnimationController(THREE, root, clips)
    controller.play('move', { loop: 'once' })
    controller.update(5)
    expect(part.position.x).toBeCloseTo(4, 6)
    expect(() => controller.play('nope')).toThrow(/no clip/)
    expect(() => new Cinema2ThreeAnimationController(THREE, root, [clips[0]!, clips[0]!])).toThrow(/two clips/)
  })

  it('releases the mixer on dispose and ignores later calls', () => {
    const { root, part, clips } = rig()
    const controller = new Cinema2ThreeAnimationController(THREE, root, clips)
    controller.play('move')
    controller.dispose()
    controller.dispose()
    controller.update(1)
    controller.sync(1)
    expect(part.position.x).toBe(0)
    expect(controller.getSnapshot().disposed).toBe(true)
  })

  it('clones a plain template without the skeleton helper and a skinned one with it', async () => {
    const { root } = rig()
    const copy = await cloneCinema2AssetScene(root)
    expect(copy).not.toBe(root)
    expect(copy.children[0]).not.toBe(root.children[0])
    expect((copy.children[0] as THREE.Mesh).geometry).toBe((root.children[0] as THREE.Mesh).geometry)

    const bones = [new THREE.Bone(), new THREE.Bone()]
    bones[0]!.add(bones[1]!)
    const geometry = new THREE.BoxGeometry()
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(geometry.attributes.position!.count * 4).fill(0), 4))
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(geometry.attributes.position!.count * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4))
    const skinned = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial())
    skinned.add(bones[0]!)
    skinned.bind(new THREE.Skeleton(bones))
    const template = new THREE.Group()
    template.add(skinned)
    const cloned = await cloneCinema2AssetScene(template)
    const clonedSkin = cloned.children[0] as THREE.SkinnedMesh
    expect(clonedSkin.skeleton).not.toBe(skinned.skeleton)
    expect(clonedSkin.skeleton.bones[0]).not.toBe(bones[0])
  })
})

describe('loaded model metadata', () => {
  it('lists names, hierarchy depth, custom attributes, morph targets, materials and clips', () => {
    const root = new THREE.Group()
    root.userData = { sceneExtra: 1 }
    const geometry = new THREE.BoxGeometry()
    geometry.setAttribute('_glow_phase', new THREE.Float32BufferAttribute(new Array(geometry.attributes.position!.count).fill(0), 1))
    const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() })
    material.name = 'shiny'
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = 'body'
    mesh.morphTargetDictionary = { inflate: 0 }
    const holder = new THREE.Group()
    holder.name = 'holder'
    holder.add(mesh)
    root.add(holder)
    const metadata = describeCinema2LoadedModel(root, [new THREE.AnimationClip('idle', 1, [])], { generator: 'Blender', extensionsUsed: ['KHR_materials_clearcoat'] })
    expect(metadata.nodeNames).toEqual(['holder', 'body'])
    expect(metadata.maxDepth).toBe(2)
    expect(metadata.meshes[0]).toMatchObject({ name: 'body', triangles: 12, materialNames: ['shiny'], customAttributes: ['_glow_phase'], morphTargets: ['inflate'], skinned: false })
    expect(metadata.extras).toEqual({ sceneExtra: 1 })
    expect(metadata.generator).toBe('Blender')
    expect(metadata.textureCount).toBe(1)
    expect(metadata.animations[0]).toMatchObject({ name: 'idle' })
  })
})
