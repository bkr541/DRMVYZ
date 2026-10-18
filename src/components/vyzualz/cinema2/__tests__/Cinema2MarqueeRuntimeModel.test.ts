// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mergeMarqueeParts, creaseNormals } from '../modules/marquee/Cinema2MarqueeBatching'
import {
  CINEMA2_MARQUEE_ZERO_IMPULSES,
  CINEMA2_MARQUEE_ZERO_SIGNALS,
  evaluateCinema2MarqueeCrowdFlash,
  type Cinema2MarqueeFixtureKind,
} from '../modules/marquee/Cinema2MarqueeDomain'
import { classifyCinema2MarqueeNode, marqueePerimeterProgress } from '../modules/marquee/Cinema2MarqueeFixtureMap'
import { Cinema2MarqueeSceneController, type Cinema2MarqueeSceneFrame } from '../modules/marquee/Cinema2MarqueeSceneController'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { CINEMA2_ASSET_RECORDS } from '../assets/Cinema2AssetManifest.generated'
import { CINEMA2_MARQUEE_PRESET_MANIFEST } from '../presets/Cinema2MarqueePreset'

const library = { THREE } as unknown as Cinema2ThreeLibrary
const KINDS: readonly Cinema2MarqueeFixtureKind[] = ['marquee-front', 'marquee-left', 'marquee-right', 'canopy', 'tower-left', 'tower-right', 'led-left', 'led-right', 'neon-red', 'neon-amber', 'neon-blue', 'crowd-flash']

/** The shipped GLB, minus its embedded images (nothing here decodes textures), parsed with the real GLTFLoader. */
async function loadShippedModel(): Promise<THREE.Group> {
  const bytes = readFileSync(join(process.cwd(), 'public/cinema2/models/marquee-theater-v2.glb'))
  const io = new NodeIO()
  const document = await io.readBinary(new Uint8Array(bytes))
  for (const texture of document.getRoot().listTextures()) texture.dispose()
  const stripped = await io.writeBinary(document)
  const gltf = await new GLTFLoader().parseAsync(stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength) as ArrayBuffer, '')
  return gltf.scene
}

/** What Cinema2ThreeSceneBridge does before handing the model over: a scene clone with per-mesh material clones. */
function bridgeClone(scene: THREE.Group): THREE.Group {
  const model = scene.clone(true)
  model.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) mesh.material = (mesh.material as THREE.Material).clone()
  })
  return model
}

const zeroZone = Object.fromEntries(KINDS.map(kind => [kind, 1])) as Record<Cinema2MarqueeFixtureKind, number>
function frame(overrides: Partial<Cinema2MarqueeSceneFrame> = {}, pattern: 'opening-night' | 'canopy-cascade' = 'opening-night', beats = 1.3): Cinema2MarqueeSceneFrame {
  return {
    performance: { pattern, beats, patternBeats: beats, signals: { ...CINEMA2_MARQUEE_ZERO_SIGNALS, overall: 0.6, bass: 0.6 }, impulses: { ...CINEMA2_MARQUEE_ZERO_IMPULSES, kick: 0.5 } },
    text: { front: 'DVYDRM', left: 'SHOWINGS', right: 'SHOWINGS' },
    masterIntensity: 1, signIllumination: 0.8, zoneIntensity: zeroZone,
    colors: { night: [0.01, 0.02, 0.03], marquee: [0.86, 0.035, 0.025], incandescent: [1, 0.55, 0.14], blue: [0.04, 0.38, 1], architecture: [0.19, 0.11, 0.075] },
    reflection: 0.7,
    ...overrides,
  }
}

let scene: THREE.Group
beforeAll(async () => { scene = await loadShippedModel() }, 60_000)
afterEach(() => vi.restoreAllMocks())

describe('MARQUEE V2 fixture map', () => {
  it('classifies the V2 and the legacy blockout names into the same controllable families', () => {
    const kindOf = (name: string, material = '') => { const cls = classifyCinema2MarqueeNode(name, material); return cls.role === 'fixture' ? cls.fixture.kind : cls.role }
    expect(kindOf('bulbs.marquee.front.top.04')).toBe('marquee-front')
    expect(kindOf('bulbs.marquee.left.end.02')).toBe('marquee-left')
    expect(kindOf('bulbs.marquee.right.17')).toBe('marquee-right')
    expect(kindOf('bulbs.canopy.row05.position03')).toBe('canopy')
    expect(kindOf('bulbs.canopy.r05.b03')).toBe('canopy')
    expect(kindOf('bulbs.tower.-1.border.1.04')).toBe('tower-left')
    expect(kindOf('bulbs.tower.1.lens.02')).toBe('tower-right')
    expect(kindOf('bulbs.tower.left.glass.00')).toBe('tower-left')
    expect(kindOf('leds.right.r03.c04')).toBe('led-right')
    expect(kindOf('neon.crown.blue.2', 'mat.neon_blue')).toBe('neon-blue')
    expect(kindOf('crown.layer.1.neon', 'mat.neon_amber')).toBe('neon-amber')
    expect(kindOf('marquee.front.frame.top.neon', 'mat.neon_red')).toBe('neon-red')
    expect(kindOf('crowd.flash.017')).toBe('crowd-flash')
    expect(kindOf('carpet.runner', 'mat.red_carpet')).toBe('static')
    expect(kindOf('marquee.front.TEXT_SURFACE')).toBe('sign')
    expect(kindOf('facade.brick_wall_front', 'mat.brick_textured')).toBe('static')
  })

  it('orders marquee bulbs around the perimeter: top left to right, right end down, bottom right to left, left end up', () => {
    const counts = { top: 4, end: 2, bottom: 4, start: 2 }
    const progress = (part: string, index: number) => marqueePerimeterProgress(part, index, counts)
    expect(progress('top', 0)).toBeLessThan(progress('top', 3))
    expect(progress('top', 3)).toBeLessThan(progress('end', 0))
    expect(progress('end', 1)).toBeLessThan(progress('bottom', 3))
    expect(progress('bottom', 3)).toBeLessThan(progress('bottom', 0))
    expect(progress('bottom', 0)).toBeLessThan(progress('start', 0))
    expect(progress('start', 1)).toBeLessThanOrEqual(1)
  })
})

describe('MARQUEE geometry batching', () => {
  it('smooths round parts, keeps box edges hard, and bakes node transforms into one buffer', () => {
    const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed()
    const boxArrays = creaseNormals(box.getAttribute('position').array, null, 38)
    // A cube's faces meet at 90 degrees, so every corner keeps a separate normal per face.
    expect(boxArrays.position.length / 3).toBe(36)
    // An indexed icosahedron (12 shared vertices) stays 12 vertices when fully smoothed, and splits into 60 when every edge is hard.
    const sphere = mergeVertices(new THREE.IcosahedronGeometry(1, 0).deleteAttribute('normal').deleteAttribute('uv'))
    const smooth = creaseNormals(sphere.getAttribute('position').array, sphere.getIndex()!.array, 180)
    const faceted = creaseNormals(sphere.getAttribute('position').array, sphere.getIndex()!.array, 10)
    expect(smooth.position.length / 3).toBe(12)
    expect(faceted.position.length / 3).toBe(60)

    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).deleteAttribute('normal'), new THREE.MeshStandardMaterial())
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).deleteAttribute('normal'), new THREE.MeshStandardMaterial())
    b.position.set(10, 0, 0)
    a.updateMatrixWorld(true); b.updateMatrixWorld(true)
    const batch = mergeMarqueeParts(THREE, [{ mesh: a, creaseDegrees: 38 }, { mesh: b, creaseDegrees: 38 }])!
    expect(batch.ranges).toHaveLength(2)
    expect(batch.ranges[1]!.start).toBe(batch.ranges[0]!.count)
    expect(batch.centers[1]![0]).toBeCloseTo(10, 4)
  })
})

describe('MARQUEE scene controller on the shipped V2 model', () => {
  it('addresses every authored fixture family and batches the theater into a small number of draw calls', () => {
    const controller = new Cinema2MarqueeSceneController(library)
    const model = bridgeClone(scene)
    const meshesBefore = (() => { let count = 0; model.traverse(object => { if ((object as THREE.Mesh).isMesh) count += 1 }); return count })()
    controller.attach(model)
    const counts = controller.getFixtureCounts()
    expect(controller.getDiagnostics()).toEqual([])
    expect(counts).toMatchObject({ 'marquee-front': 90, 'marquee-left': 70, 'marquee-right': 70, canopy: 444, 'led-left': 171, 'led-right': 171 })
    expect(counts['crowd-flash']).toBeGreaterThanOrEqual(60)
    expect(counts['tower-left']).toBe(counts['tower-right'])
    expect(counts['tower-left']).toBeGreaterThanOrEqual(90)
    for (const kind of ['neon-red', 'neon-amber', 'neon-blue']) expect(counts[kind]).toBeGreaterThan(3)
    let meshesAfter = 0
    model.traverse(object => { if ((object as THREE.Mesh).isMesh) meshesAfter += 1 })
    expect(meshesBefore).toBeGreaterThan(1500)
    expect(meshesAfter).toBeLessThan(120)
    expect(controller.getDrawCallEstimate()).toBeLessThan(120)
    controller.dispose()
  })

  it('drives each bulb independently: a canopy wave lights some bulbs and not others, and zero intensity is dark', () => {
    const controller = new Cinema2MarqueeSceneController(library)
    const model = bridgeClone(scene)
    controller.attach(model)
    const family = (name: string) => model.getObjectByName(name) as THREE.Mesh
    controller.apply(frame({}, 'canopy-cascade', 0.9))
    const emit = family('marquee-fixtures.canopy').geometry.getAttribute('cinema2Emit').array as Float32Array
    const levels = new Set<string>()
    for (let i = 0; i < emit.length; i += 3) levels.add(emit[i]!.toFixed(2))
    expect(levels.size).toBeGreaterThanOrEqual(3)
    expect(Math.max(...Array.from(emit))).toBeGreaterThan(Math.min(...Array.from(emit)) + 0.5)

    controller.apply(frame({ masterIntensity: 0 }, 'canopy-cascade', 0.9))
    const dim = Math.max(...Array.from(family('marquee-fixtures.canopy').geometry.getAttribute('cinema2Emit').array as Float32Array))
    expect(dim).toBe(0)
    controller.dispose()
  })

  it('keeps bulb families, neon families and the three sign faces as separate meshes', () => {
    const controller = new Cinema2MarqueeSceneController(library)
    const model = bridgeClone(scene)
    controller.attach(model)
    for (const kind of KINDS) expect(model.getObjectByName(`marquee-fixtures.${kind}`), kind).toBeTruthy()
    const faces = ['front', 'left', 'right'].map(face => model.getObjectByProperty('name', `marquee.${face}.TEXT_SURFACE`) ?? model.children.flatMap(function find(child: THREE.Object3D): THREE.Object3D[] { return [child, ...child.children.flatMap(find)] }).find(object => object.userData?.name === `marquee.${face}.TEXT_SURFACE`))
    expect(faces.every(Boolean)).toBe(true)
    expect(new Set(faces.map(face => (face as THREE.Mesh).material)).size).toBe(3)
    controller.dispose()
  })

  it('updates only the face whose text changed, and never rebuilds the model for a text edit', () => {
    const drawn: string[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
      const noop = () => undefined
      return {
        canvas: this, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineJoin: '', miterLimit: 1,
        fillRect: noop, save: noop, restore: noop, translate: noop, scale: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
        measureText: () => ({ width: 100 }), createLinearGradient: () => ({ addColorStop: noop }),
        strokeText: (text: string) => { drawn.push(text) }, fillText: noop,
      } as unknown as CanvasRenderingContext2D
    })
    const controller = new Cinema2MarqueeSceneController(library)
    const model = bridgeClone(scene)
    controller.attach(model)
    const textures = () => (['front', 'left', 'right'] as const).map(face => {
      let found: THREE.MeshStandardMaterial | null = null
      model.traverse(object => { if (object.userData?.name === `marquee.${face}.TEXT_SURFACE`) found = (object as THREE.Mesh).material as THREE.MeshStandardMaterial })
      return (found as THREE.MeshStandardMaterial | null)?.map ?? null
    })
    const meshCount = () => { let count = 0; model.traverse(object => { if ((object as THREE.Mesh).isMesh) count += 1 }); return count }
    controller.apply(frame({ text: { front: 'FRONT 123!', left: 'LEFT ONLY?', right: 'RIGHT: 9 PM' } }))
    const first = textures()
    expect(first.every(texture => texture != null)).toBe(true)
    expect(new Set(first).size).toBe(3)
    const meshes = meshCount()

    controller.apply(frame({ text: { front: 'FRONT 123!', left: 'CHANGED', right: 'RIGHT: 9 PM' } }))
    const second = textures()
    expect(second[0]).toBe(first[0])
    expect(second[2]).toBe(first[2])
    expect(second[1]).not.toBe(first[1])
    expect(meshCount()).toBe(meshes)
    expect(drawn.filter(text => text === 'CHANGED')).toHaveLength(1)
    // Text is never touched by the lighting program.
    controller.apply(frame({ text: { front: 'FRONT 123!', left: 'CHANGED', right: 'RIGHT: 9 PM' } }, 'canopy-cascade', 4))
    expect(textures()[1]).toBe(second[1])
    controller.dispose()
  })
})

describe('MARQUEE shipped asset and preset', () => {
  it('ships the V2 model, keeps the rollback blockout out of the runtime bundle, and defaults to the approved sign copy', () => {
    const record = CINEMA2_ASSET_RECORDS.find(item => item.id === 'cinema2-marquee-theater')!
    expect((record.files as { high: { url: string } }).high.url).toBe('/cinema2/models/marquee-theater-v2.glb')
    const defaults = (CINEMA2_MARQUEE_PRESET_MANIFEST.parameters ?? []).filter(parameter => /text$/.test(parameter.id)).map(parameter => (parameter as { defaultValue: string }).defaultValue)
    expect(defaults).toEqual(['DVYDRM', 'SHOWINGS', 'SHOWINGS'])
  })

  it('keeps the hero camera, and adds authored three-quarter and low-canopy views without changing the default', () => {
    const cameras = CINEMA2_MARQUEE_PRESET_MANIFEST.cameras ?? []
    expect(cameras.map(camera => camera.id)).toEqual(['marquee-hero-camera', 'marquee-left-three-quarter-camera', 'marquee-right-three-quarter-camera', 'marquee-low-canopy-camera'])
    expect(CINEMA2_MARQUEE_PRESET_MANIFEST.defaults?.camera?.$ref).toBe('marquee-hero-camera')
  })
})

describe('MARQUEE paparazzi flashes', () => {
  const flashes = Array.from({ length: 96 }, (_, i) => ({ kind: 'crowd-flash' as const, progress: i / 95, row: ((i * 37) % 96) / 95 }))
  const at = (beats: number, impulses: Partial<typeof CINEMA2_MARQUEE_ZERO_IMPULSES>, overall = 0.6) => flashes.map(address => evaluateCinema2MarqueeCrowdFlash(address, {
    pattern: 'opening-night', beats, patternBeats: beats,
    signals: { ...CINEMA2_MARQUEE_ZERO_SIGNALS, overall }, impulses: { ...CINEMA2_MARQUEE_ZERO_IMPULSES, ...impulses },
  }))

  it('fires only a share of the crowd on a kick, more on a drop, and never all or none', () => {
    const lit = (values: number[]) => values.filter(value => value > 0.3).length
    const kick = lit(at(3.3, { kick: 1 }))
    const drop = lit(at(3.3, { drop: 1 }))
    expect(kick).toBeGreaterThan(10)
    expect(kick).toBeLessThan(80)
    expect(drop).toBeGreaterThan(kick)
  })

  it('twinkles sparsely with no music, and stays within 0..1', () => {
    for (let beats = 0; beats < 8; beats += 0.37) {
      const values = at(beats, {}, 0)
      expect(Math.max(...values)).toBeLessThanOrEqual(1)
      expect(values.filter(value => value > 0.3).length).toBeLessThan(25)
    }
    expect(Math.max(...Array.from({ length: 24 }, (_, i) => Math.max(...at(i * 0.25, {}, 0))))).toBeGreaterThan(0.3)
  })
})
