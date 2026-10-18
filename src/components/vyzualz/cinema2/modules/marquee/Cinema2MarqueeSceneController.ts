import type * as ThreeNamespace from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { mergeMarqueeParts, enablePerVertexEmission, type Cinema2MarqueeSourcePart } from './Cinema2MarqueeBatching'
import {
  evaluateCinema2MarqueeFixture,
  type Cinema2MarqueeFixtureAddress,
  type Cinema2MarqueeFixtureKind,
  type Cinema2MarqueePerformanceFrame,
} from './Cinema2MarqueeDomain'
import {
  classifyCinema2MarqueeNode,
  marqueeCreaseDegrees,
  marqueePerimeterProgress,
  type Cinema2MarqueeFace,
  type Cinema2MarqueeFixtureDescriptor,
} from './Cinema2MarqueeFixtureMap'
import { getCinema2MarqueeDebug } from './Cinema2MarqueeDebug'
import { MARQUEE_LOOK } from './Cinema2MarqueeLook'

type Rgb = readonly [number, number, number]
type StandardMaterial = ThreeNamespace.MeshStandardMaterial

export interface Cinema2MarqueeSceneFrame {
  readonly performance: Readonly<Cinema2MarqueePerformanceFrame>
  readonly text: Readonly<{ front: string; left: string; right: string }>
  readonly masterIntensity: number
  readonly signIllumination: number
  readonly zoneIntensity: Readonly<Record<Cinema2MarqueeFixtureKind, number>>
  readonly colors: Readonly<{
    night: Rgb
    marquee: Rgb
    incandescent: Rgb
    blue: Rgb
    architecture: Rgb
  }>
  readonly reflection: number
}

interface FixtureHandle {
  readonly name: string
  readonly address: Cinema2MarqueeFixtureAddress
  /** Vertex range inside the family's batched mesh. */
  readonly start: number
  readonly count: number
  /** 0 = bottom of the panel/tower, 1 = top (LED colour ramp). */
  readonly height: number
}

interface FixtureFamily {
  readonly kind: Cinema2MarqueeFixtureKind
  readonly mesh: ThreeNamespace.Mesh
  readonly emit: ThreeNamespace.BufferAttribute
  readonly fixtures: FixtureHandle[]
}

interface SignHandle {
  readonly face: Cinema2MarqueeFace
  readonly mesh: ThreeNamespace.Mesh
  readonly materials: readonly StandardMaterial[]
  texture: ThreeNamespace.Texture | null
  text: string | null
  colorKey: string | null
}

const TEXT_CANVAS = Object.freeze({ width: 2048, height: 440 })
const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function displayCinema2MarqueeText(value: string, maxCodePoints = 48): string {
  const normalized = value.normalize('NFC').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  const points = Array.from(normalized)
  if (points.length <= maxCodePoints) return normalized
  return `${points.slice(0, Math.max(0, maxCodePoints - 1)).join('')}…`
}

export function estimateCinema2MarqueeFontSize(text: string, width = 1024, height = 220): number {
  if (!text) return Math.round(height * 0.62)
  const approximateGlyphWidth = 0.62
  return Math.max(28, Math.min(Math.round(height * 0.68), Math.floor((width * 0.82) / (Array.from(text).length * approximateGlyphWidth))))
}

const authoredNameOf = (object: ThreeNamespace.Object3D) => (typeof object.userData?.name === 'string' ? object.userData.name : object.name)

export class Cinema2MarqueeSceneController {
  private readonly families = new Map<Cinema2MarqueeFixtureKind, FixtureFamily>()
  private readonly signs = new Map<Cinema2MarqueeFace, SignHandle>()
  private readonly brickMaterials: StandardMaterial[] = []
  private readonly curtainMaterials: StandardMaterial[] = []
  private readonly groundMaterials: StandardMaterial[] = []
  private readonly interiorMaterials: StandardMaterial[] = []
  private readonly glassMaterials: StandardMaterial[] = []
  private readonly carpetMaterials: { material: StandardMaterial; base: Rgb }[] = []
  private readonly allMeshes: ThreeNamespace.Mesh[] = []
  private readonly disposables: { dispose(): void }[] = []
  private readonly diagnostics: string[] = []
  private readonly originalMaterials = new Map<ThreeNamespace.Mesh, ThreeNamespace.Material | ThreeNamespace.Material[]>()
  private materialKey: string | null = null
  private debugKey = ''
  private drawCalls = 0
  private disposed = false

  constructor(private readonly library: Cinema2ThreeLibrary) {}

  attach(root: ThreeNamespace.Object3D): void {
    if (this.disposed) return
    const { THREE } = this.library
    root.updateMatrixWorld(true)

    interface Source { mesh: ThreeNamespace.Mesh; name: string; materialName: string; descriptor: Cinema2MarqueeFixtureDescriptor | null }
    const statics = new Map<string, Source[]>()
    const fixtureSources = new Map<Cinema2MarqueeFixtureKind, Source[]>()
    const signCounts: Record<Cinema2MarqueeFace, number> = { front: 0, left: 0, right: 0 }

    root.traverse(object => {
      const mesh = object as ThreeNamespace.Mesh
      if (!mesh.isMesh) return
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        .filter(material => (material as StandardMaterial).isMeshStandardMaterial) as StandardMaterial[]
      if (materials.length === 0) return
      const name = authoredNameOf(mesh)
      const materialName = materials[0]!.name
      const cls = classifyCinema2MarqueeNode(name, materialName)

      if (cls.role === 'sign') {
        signCounts[cls.face] += 1
        this.signs.set(cls.face, { face: cls.face, mesh, materials, texture: null, text: null, colorKey: null })
        return
      }
      if (cls.role === 'fixture') {
        const list = fixtureSources.get(cls.fixture.kind) ?? []
        list.push({ mesh, name, materialName, descriptor: cls.fixture })
        fixtureSources.set(cls.fixture.kind, list)
        return
      }
      if (Array.isArray(mesh.material)) { this.allMeshes.push(mesh); this.categorise(materials); return }
      const key = `${materialName}|${(materials[0]!.map as ThreeNamespace.Texture | null)?.uuid ?? ''}`
      const list = statics.get(key) ?? []
      list.push({ mesh, name, materialName, descriptor: null })
      statics.set(key, list)
    })

    for (const face of ['front', 'left', 'right'] as const) {
      if (signCounts[face] !== 1) this.diagnostics.push(`Expected exactly one marquee.${face}.TEXT_SURFACE mesh; found ${signCounts[face]}.`)
    }

    // ── Static architecture: one draw call per material instead of one per authored part ──────────────────────
    for (const sources of statics.values()) {
      const first = sources[0]!
      const material = first.mesh.material as StandardMaterial
      this.categorise([material])
      if (sources.length === 1) { this.allMeshes.push(this.smooth(root, first.mesh, material)); continue }
      sources.sort((a, b) => a.name.localeCompare(b.name))
      const batch = mergeMarqueeParts(THREE, sources.map(source => ({ mesh: source.mesh, creaseDegrees: marqueeCreaseDegrees(source.materialName, source.name) }) satisfies Cinema2MarqueeSourcePart))
      if (!batch) { for (const source of sources) this.allMeshes.push(source.mesh); continue }
      material.flatShading = false
      material.needsUpdate = true
      const merged = new THREE.Mesh(batch.geometry, material)
      merged.name = `marquee-static.${first.materialName}`
      merged.matrixAutoUpdate = false
      for (const source of sources) source.mesh.removeFromParent()
      root.add(merged)
      this.allMeshes.push(merged)
      this.disposables.push(batch.geometry)
    }

    // ── Fixture families: one draw call each, every authored node keeps its own vertex range ─────────────────
    for (const [kind, sources] of fixtureSources) {
      sources.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      const batch = mergeMarqueeParts(THREE, sources.map(source => ({ mesh: source.mesh, creaseDegrees: marqueeCreaseDegrees(source.materialName, source.name) })))
      if (!batch) continue
      const emit = new THREE.BufferAttribute(new Float32Array(batch.geometry.getAttribute('position').count * 3), 3)
      emit.setUsage(THREE.DynamicDrawUsage)
      batch.geometry.setAttribute('cinema2Emit', emit)
      const material = (sources[0]!.mesh.material as StandardMaterial).clone()
      material.name = `marquee-fixtures.${kind}`
      material.flatShading = false
      material.emissive.setRGB(0, 0, 0)
      material.emissiveIntensity = 1
      // An unlit bulb or tube is dark glass; all of its brightness comes from its own per-fixture emission, not from the scene lights washing the cream authored colour.
      material.color.setRGB(0.07, 0.05, 0.035, THREE.SRGBColorSpace)
      material.roughness = 0.22
      material.metalness = 0.1
      enablePerVertexEmission(material)
      const mesh = new THREE.Mesh(batch.geometry, material)
      mesh.name = `marquee-fixtures.${kind}`
      mesh.matrixAutoUpdate = false
      mesh.frustumCulled = false
      for (const source of sources) source.mesh.removeFromParent()
      root.add(mesh)
      this.allMeshes.push(mesh)
      this.disposables.push(batch.geometry, material)
      this.families.set(kind, { kind, mesh, emit, fixtures: this.addressFixtures(kind, sources.map(source => source.descriptor!), sources.map(source => source.name), batch) })
    }

    this.drawCalls = this.allMeshes.length + this.signs.size

    const expectedMinimums: Readonly<Partial<Record<Cinema2MarqueeFixtureKind, number>>> = Object.freeze({
      'marquee-front': 80, 'marquee-left': 60, 'marquee-right': 60, canopy: 400,
      'tower-left': 90, 'tower-right': 90, 'led-left': 160, 'led-right': 160,
      'neon-red': 8, 'neon-amber': 4, 'neon-blue': 4, 'crowd-flash': 40,
    })
    for (const [kind, minimum] of Object.entries(expectedMinimums) as [Cinema2MarqueeFixtureKind, number][]) {
      const count = this.families.get(kind)?.fixtures.length ?? 0
      if (count < minimum) this.diagnostics.push(`Expected at least ${minimum} ${kind} fixtures; found ${count}.`)
    }
  }

  apply(frame: Readonly<Cinema2MarqueeSceneFrame>): void {
    if (this.disposed) return
    const debug = getCinema2MarqueeDebug()
    this.applyDebugGeometry(debug.geometry)
    this.applyMaterialPalette(frame)
    const emission = debug.emission !== 'off'
    for (const face of ['front', 'left', 'right'] as const) this.applySign(face, frame.text[face], frame, emission)

    const interior = emission ? clamp01(frame.masterIntensity) : 0
    for (const material of this.interiorMaterials) material.emissiveIntensity = MARQUEE_LOOK.interiorEmission * interior

    for (const family of this.families.values()) {
      const array = family.emit.array as Float32Array
      const zone = clamp01(frame.zoneIntensity[family.kind] ?? 1)
      for (const fixture of family.fixtures) {
        const gain = emission ? evaluateCinema2MarqueeFixture(fixture.address, frame.performance) : 0
        const intensity = clamp01(frame.masterIntensity) * zone * gain
        const level = emission ? MARQUEE_LOOK.fixtureBase[family.kind] * clamp01(frame.masterIntensity) * zone + Math.pow(intensity, MARQUEE_LOOK.fixtureCurve) * MARQUEE_LOOK.fixturePeak[family.kind] : 0
        const color = fixtureColor(family.kind, frame.colors, fixture.height)
        const r = level * srgbToLinear(color[0])
        const g = level * srgbToLinear(color[1])
        const b = level * srgbToLinear(color[2])
        for (let vertex = fixture.start; vertex < fixture.start + fixture.count; vertex += 1) {
          array[vertex * 3] = r; array[vertex * 3 + 1] = g; array[vertex * 3 + 2] = b
        }
      }
      family.emit.needsUpdate = true
    }
  }

  getDiagnostics(): readonly string[] {
    return Object.freeze([...this.diagnostics])
  }

  getFixtureCounts(): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {}
    for (const family of this.families.values()) counts[family.kind] = family.fixtures.length
    return Object.freeze(counts)
  }

  /** Meshes the model draws after batching (fixture families + merged architecture + the three sign faces). */
  getDrawCallEstimate(): number {
    return this.drawCalls
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const sign of this.signs.values()) sign.texture?.dispose()
    for (const disposable of this.disposables) disposable.dispose()
    this.signs.clear()
    this.families.clear()
    for (const list of [this.brickMaterials, this.curtainMaterials, this.groundMaterials, this.interiorMaterials, this.glassMaterials, this.carpetMaterials, this.allMeshes]) list.length = 0
    this.disposables.length = 0
    this.originalMaterials.clear()
  }

  /** Files each material into the palette group that owns it, once. */
  private categorise(materials: readonly StandardMaterial[]): void {
    for (const material of materials) {
      const name = material.name
      if (/red_carpet|red_rope/i.test(name) && !this.carpetMaterials.some(entry => entry.material === material)) {
        this.carpetMaterials.push({ material, base: [material.color.r, material.color.g, material.color.b] })
      }
      const list = /brick/i.test(name) ? this.brickMaterials
        : /velvet|curtain/i.test(name) ? this.curtainMaterials
          : /pavement_polished|^Pavement/i.test(name) ? this.groundMaterials
            : /interior_warm/i.test(name) ? this.interiorMaterials : /glass_smoke/i.test(name) ? this.glassMaterials : null
      if (list && !list.includes(material)) list.push(material)
      if (/brick_textured|Masonry/i.test(name)) this.enhanceBrick(material)
      if (/glass_smoke/i.test(name)) this.glaze(material)
    }
  }

  /** A lone, normal-less part gets smoothed normals too; it is re-parented to the model root because its world transform is baked in. */
  /** Entrance and window glazing is translucent so the lit interior shows through, with a darker, glossier tint than the authored opaque glass. */
  private glaze(material: StandardMaterial): void {
    material.transparent = true
    material.opacity = MARQUEE_LOOK.glassOpacity
    material.depthWrite = false
    material.color.setRGB(0.012, 0.03, 0.035, this.library.THREE.SRGBColorSpace)
    material.roughness = 0.08
    material.metalness = 0.55
    material.needsUpdate = true
  }

  private smooth(root: ThreeNamespace.Object3D, mesh: ThreeNamespace.Mesh, material: StandardMaterial): ThreeNamespace.Mesh {
    if (mesh.geometry.getAttribute('normal')) return mesh
    const batch = mergeMarqueeParts(this.library.THREE, [{ mesh, creaseDegrees: marqueeCreaseDegrees(material.name, authoredNameOf(mesh)) }])
    if (!batch) return mesh
    mesh.removeFromParent()
    mesh.geometry = batch.geometry
    mesh.position.set(0, 0, 0); mesh.quaternion.identity(); mesh.scale.set(1, 1, 1)
    mesh.matrixAutoUpdate = false
    mesh.matrix.identity()
    root.add(mesh)
    material.flatShading = false
    material.needsUpdate = true
    this.disposables.push(batch.geometry)
    return mesh
  }

  /** Gives masonry relief: a normal map derived from the brick albedo's luminance, and mortar-aware roughness. */
  private enhanceBrick(material: StandardMaterial): void {
    if (material.normalMap || typeof document === 'undefined') return
    const image = (material.map as ThreeNamespace.Texture | null)?.image as CanvasImageSource & { width?: number; height?: number } | undefined
    if (!image || !image.width || !image.height) return
    const width = Math.min(1024, image.width)
    const height = Math.round(width * (image.height / image.width))
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return
    context.drawImage(image, 0, 0, width, height)
    let source: ImageData
    try { source = context.getImageData(0, 0, width, height) } catch { return }
    const luma = new Float32Array(width * height)
    for (let i = 0; i < luma.length; i += 1) luma[i] = (source.data[i * 4]! * 0.3 + source.data[i * 4 + 1]! * 0.59 + source.data[i * 4 + 2]! * 0.11) / 255
    const out = context.createImageData(width, height)
    const strength = MARQUEE_LOOK.brickRelief
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const l = luma[y * width + ((x + width - 1) % width)]!, r = luma[y * width + ((x + 1) % width)]!
        const u = luma[((y + height - 1) % height) * width + x]!, d = luma[((y + 1) % height) * width + x]!
        let nx = (l - r) * strength, ny = (u - d) * strength
        const nz = 1
        const length = Math.hypot(nx, ny, nz)
        nx /= length; ny /= length
        const at = (y * width + x) * 4
        out.data[at] = Math.round((nx * 0.5 + 0.5) * 255)
        out.data[at + 1] = Math.round((ny * 0.5 + 0.5) * 255)
        out.data[at + 2] = Math.round((nz / length * 0.5 + 0.5) * 255)
        out.data[at + 3] = 255
      }
    }
    context.putImageData(out, 0, 0)
    const { THREE } = this.library
    const normal = new THREE.CanvasTexture(canvas)
    normal.name = 'MARQUEE brick relief (derived from albedo)'
    normal.wrapS = THREE.RepeatWrapping
    normal.wrapT = THREE.RepeatWrapping
    const source0 = material.map as ThreeNamespace.Texture
    normal.repeat.copy(source0.repeat); normal.offset.copy(source0.offset); normal.center.copy(source0.center); normal.rotation = source0.rotation
    normal.colorSpace = THREE.NoColorSpace
    normal.anisotropy = 8
    normal.needsUpdate = true
    material.normalMap = normal
    material.normalScale.set(MARQUEE_LOOK.brickNormalScale, MARQUEE_LOOK.brickNormalScale)
    material.needsUpdate = true
    this.disposables.push(normal)
  }

  /** Normalises authored names into 0..1 rows/progress and builds the fixture handles for one family. */
  private addressFixtures(
    kind: Cinema2MarqueeFixtureKind,
    descriptors: readonly Cinema2MarqueeFixtureDescriptor[],
    names: readonly string[],
    batch: { ranges: readonly { start: number; count: number }[]; centers: readonly (readonly [number, number, number])[] },
  ): FixtureHandle[] {
    const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    for (const center of batch.centers) {
      bounds.minX = Math.min(bounds.minX, center[0]); bounds.maxX = Math.max(bounds.maxX, center[0])
      bounds.minY = Math.min(bounds.minY, center[1]); bounds.maxY = Math.max(bounds.maxY, center[1])
    }
    const norm = (value: number, min: number, max: number) => (max - min < 1e-6 ? 0.5 : (value - min) / (max - min))
    const maxRow = Math.max(1, ...descriptors.map(d => d.rowIndex ?? 0))
    const maxColumn = Math.max(1, ...descriptors.map(d => d.columnIndex ?? 0))
    const edgeCounts: Record<string, number> = {}
    for (const descriptor of descriptors) if (descriptor.index != null) edgeCounts[descriptor.part] = (edgeCounts[descriptor.part] ?? 0) + 1

    return descriptors.map((descriptor, index) => {
      const center = batch.centers[index]!
      const height = norm(center[1], bounds.minY, bounds.maxY)
      let row: number
      let progress: number
      if (kind.startsWith('marquee-')) {
        progress = descriptor.part === 'perimeter' ? norm(center[0], bounds.minX, bounds.maxX) : marqueePerimeterProgress(descriptor.part, descriptor.index ?? 0, edgeCounts)
        row = descriptor.part === 'bottom' || descriptor.part === 'start' ? 1 : 0
      } else if (kind === 'canopy') {
        // Ribs run across the width (rowIndex), bulbs step from the facade toward the street (columnIndex).
        row = (descriptor.columnIndex ?? 0) / maxColumn
        progress = (descriptor.rowIndex ?? 0) / maxRow
      } else if (kind.startsWith('led-')) {
        row = (descriptor.rowIndex ?? 0) / maxRow
        progress = (descriptor.columnIndex ?? 0) / maxColumn
      } else {
        row = height
        progress = norm(center[0], bounds.minX, bounds.maxX)
      }
      return Object.freeze({
        name: names[index]!,
        address: Object.freeze({ kind, row: clamp01(row), progress: clamp01(progress) }),
        start: batch.ranges[index]!.start,
        count: batch.ranges[index]!.count,
        height,
      })
    })
  }

  private applyMaterialPalette(frame: Readonly<Cinema2MarqueeSceneFrame>): void {
    const key = JSON.stringify([frame.colors.marquee, frame.colors.architecture, frame.reflection])
    if (key === this.materialKey) return
    this.materialKey = key
    const { THREE } = this.library
    const ratio = (value: Rgb, reference: Rgb, cap: number): Rgb => [0, 1, 2].map(i => Math.min(cap, value[i]! / Math.max(0.004, reference[i]!))) as unknown as Rgb
    // At the authored default the tint is exactly 1, so the textures keep their authored look; changing the palette shifts it.
    const brick = ratio(frame.colors.architecture, MARQUEE_LOOK.defaultArchitecture, 2.2)
    for (const material of this.brickMaterials) material.color.setRGB(Math.min(1.4, brick[0]), Math.min(1.4, brick[1]), Math.min(1.4, brick[2]), THREE.SRGBColorSpace)
    const velvet = ratio(frame.colors.marquee, MARQUEE_LOOK.defaultMarquee, 1.6)
    for (const material of this.curtainMaterials) {
      material.color.setRGB(Math.min(1.3, velvet[0]), Math.min(1.6, velvet[1]), Math.min(1.6, velvet[2]), THREE.SRGBColorSpace)
      material.roughness = 0.82
    }
    // Carpet and rope follow Marquee Red: unchanged at the authored default, re-tinted when the palette changes.
    for (const { material, base } of this.carpetMaterials) {
      material.color.setRGB(Math.min(1, base[0] * velvet[0]), Math.min(1, base[1] * velvet[1]), Math.min(1, base[2] * velvet[2]), THREE.LinearSRGBColorSpace)
    }
    for (const material of this.groundMaterials) {
      material.roughness = lerp(0.62, 0.22, clamp01(frame.reflection))
      material.metalness = lerp(0.04, 0.3, clamp01(frame.reflection))
    }
  }

  private applyDebugGeometry(mode: 'normal' | 'wireframe' | 'normals'): void {
    if (mode === this.debugKey) return
    this.debugKey = mode
    const { THREE } = this.library
    const meshes = [...this.allMeshes, ...[...this.signs.values()].map(sign => sign.mesh)]
    for (const mesh of meshes) {
      if (mode === 'normals') {
        if (!this.originalMaterials.has(mesh)) this.originalMaterials.set(mesh, mesh.material)
        mesh.material = new THREE.MeshNormalMaterial({ flatShading: false })
      } else {
        const original = this.originalMaterials.get(mesh)
        if (original) { (mesh.material as ThreeNamespace.Material).dispose(); mesh.material = original; this.originalMaterials.delete(mesh) }
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          (material as StandardMaterial).wireframe = mode === 'wireframe'
          material.needsUpdate = true
        }
      }
    }
  }

  private applySign(face: Cinema2MarqueeFace, value: string, frame: Readonly<Cinema2MarqueeSceneFrame>, emission: boolean): void {
    const sign = this.signs.get(face)
    if (!sign) return
    const text = displayCinema2MarqueeText(value)
    const colorKey = frame.colors.marquee.join(',')
    if (sign.text !== text || sign.colorKey !== colorKey) {
      const next = this.createTextTexture(text, face, frame.colors.marquee)
      if (next) {
        const previous = sign.texture
        sign.texture = next
        for (const material of sign.materials) {
          material.map = next
          // The same texture drives emission, so the letterboard glows and the lettering stays dark where it should.
          material.emissiveMap = next
          material.color.setRGB(1, 1, 1, this.library.THREE.SRGBColorSpace)
          material.emissive.setRGB(1, 0.97, 0.9, this.library.THREE.SRGBColorSpace)
          material.roughness = 0.62
          material.metalness = 0
          material.needsUpdate = true
        }
        previous?.dispose()
      }
      sign.text = text
      sign.colorKey = colorKey
    }
    const illumination = clamp01(frame.signIllumination) * clamp01(frame.masterIntensity)
    for (const material of sign.materials) {
      material.emissiveIntensity = emission ? MARQUEE_LOOK.signBase * clamp01(frame.masterIntensity) + MARQUEE_LOOK.signPeak * illumination : 0
    }
  }

  private createTextTexture(text: string, face: Cinema2MarqueeFace, red: Rgb): ThreeNamespace.Texture | null {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = TEXT_CANVAS.width
    canvas.height = TEXT_CANVAS.height
    const context = canvas.getContext('2d')
    if (!context) return null
    const { width, height } = canvas
    // Letterboard: warm ivory with faint horizontal rails, as on the reference signs.
    context.fillStyle = '#f5f0e2'
    context.fillRect(0, 0, width, height)
    const board = context.createLinearGradient(0, 0, 0, height)
    board.addColorStop(0, 'rgba(255,255,255,0.28)')
    board.addColorStop(0.5, 'rgba(255,255,255,0)')
    board.addColorStop(1, 'rgba(120,96,60,0.18)')
    context.fillStyle = board
    context.fillRect(0, 0, width, height)
    context.strokeStyle = 'rgba(110,86,56,0.16)'
    context.lineWidth = 3
    for (let y = 40; y < height; y += 44) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke()
    }
    if (text) {
      const family = 'Anton, Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif'
      const safeWidth = width * 0.9
      let size = Math.round(height * (face === 'front' ? 0.74 : 0.78))
      context.font = `${size}px ${family}`
      // Long copy is first condensed (down to 62% width, like the condensed marquee type it imitates) and only then shrunk, so it stays large and legible.
      let squeeze = 1
      const natural = context.measureText(text).width
      if (natural > safeWidth) {
        const need = safeWidth / natural
        squeeze = Math.max(0.62, need)
        size = Math.max(56, Math.floor(size * (need / squeeze)))
        context.font = `${size}px ${family}`
      }
      context.save()
      context.translate(width / 2, height / 2 + size * 0.04)
      context.scale(squeeze, 1)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineJoin = 'round'
      context.miterLimit = 2
      const neon = `rgb(${Math.round(red[0] * 255)},${Math.round(red[1] * 255)},${Math.round(red[2] * 255)})`
      if (face === 'front') {
        // Red letters with a darker outline and a thin bright rim: the neon-outlined lettering of the front board.
        context.strokeStyle = '#3a0907'
        context.lineWidth = Math.max(8, size * 0.1)
        context.strokeText(text, 0, 0)
        context.fillStyle = neon
        context.fillText(text, 0, 0)
        context.strokeStyle = 'rgba(255,170,150,0.55)'
        context.lineWidth = Math.max(2, size * 0.014)
        context.strokeText(text, 0, 0)
      } else {
        context.strokeStyle = '#f7efdc'
        context.lineWidth = Math.max(8, size * 0.07)
        context.strokeText(text, 0, 0)
        context.fillStyle = '#0c0a08'
        context.fillText(text, 0, 0)
      }
      context.restore()
    }
    const { THREE } = this.library
    const texture = new THREE.CanvasTexture(canvas)
    texture.name = `MARQUEE runtime text · ${face}`
    // glTF UV origin is top-left, matching the authored plane.
    texture.flipY = false
    texture.colorSpace = THREE.SRGBColorSpace
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 16
    texture.needsUpdate = true
    return texture
  }
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
}

/** Colour each family emits. Bulbs follow Incandescent Gold, red trim and neon follow Marquee Red, the crown's blue follows Neon Blue, LEDs ramp between them. */
function fixtureColor(kind: Cinema2MarqueeFixtureKind, colors: Cinema2MarqueeSceneFrame['colors'], height: number): Rgb {
  if (kind === 'crowd-flash') return [1, 0.97, 0.9]
  if (kind === 'neon-blue') return colors.blue
  if (kind === 'neon-red') return colors.marquee
  if (kind === 'neon-amber') return mix(colors.incandescent, colors.marquee, 0.15)
  if (kind.startsWith('led-')) {
    // Reference: red at the top of each LED column through amber to a pale hot yellow at the bottom.
    const t = clamp01(height)
    return t > 0.5 ? mix(colors.incandescent, colors.marquee, (t - 0.5) * 2) : mix([1, 0.92, 0.62], colors.incandescent, t * 2)
  }
  if (kind.startsWith('tower-') || kind.startsWith('marquee-') || kind === 'canopy') return mix(colors.incandescent, [1, 0.92, 0.72], 0.35)
  return colors.incandescent
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}
