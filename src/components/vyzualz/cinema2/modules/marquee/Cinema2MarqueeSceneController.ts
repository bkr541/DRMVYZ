import type * as ThreeNamespace from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import {
  evaluateCinema2MarqueeFixture,
  type Cinema2MarqueeFixtureAddress,
  type Cinema2MarqueeFixtureKind,
  type Cinema2MarqueePerformanceFrame,
} from './Cinema2MarqueeDomain'

type Rgb = readonly [number, number, number]

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
  readonly mesh: ThreeNamespace.Mesh
  readonly materials: readonly ThreeNamespace.MeshStandardMaterial[]
  address: Cinema2MarqueeFixtureAddress
}

interface SignHandle {
  readonly face: 'front' | 'left' | 'right'
  readonly mesh: ThreeNamespace.Mesh
  readonly materials: readonly ThreeNamespace.MeshStandardMaterial[]
  texture: ThreeNamespace.Texture | null
  text: string | null
  colorKey: string | null
}

const TEXT_NODE_NAMES = Object.freeze({
  front: 'marquee.front.TEXT_SURFACE',
  left: 'marquee.left.TEXT_SURFACE',
  right: 'marquee.right.TEXT_SURFACE',
} as const)

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

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

export class Cinema2MarqueeSceneController {
  private readonly fixtures: FixtureHandle[] = []
  private readonly signs = new Map<'front' | 'left' | 'right', SignHandle>()
  private readonly architecturalMaterials: ThreeNamespace.MeshStandardMaterial[] = []
  private readonly nightMaterials: ThreeNamespace.MeshStandardMaterial[] = []
  private readonly curtainMaterials: ThreeNamespace.MeshStandardMaterial[] = []
  private readonly groundMaterials: ThreeNamespace.MeshStandardMaterial[] = []
  private readonly diagnostics: string[] = []
  private materialKey: string | null = null
  private disposed = false

  constructor(private readonly library: Cinema2ThreeLibrary) {}

  attach(root: ThreeNamespace.Object3D): void {
    if (this.disposed) return
    const signCounts: Record<'front' | 'left' | 'right', number> = { front: 0, left: 0, right: 0 }
    root.traverse(object => {
      const mesh = object as ThreeNamespace.Mesh
      if (!mesh.isMesh) return
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        .filter(material => (material as ThreeNamespace.MeshStandardMaterial).isMeshStandardMaterial) as ThreeNamespace.MeshStandardMaterial[]
      if (materials.length === 0) return

      const authoredFace = mesh.userData?.role === 'replaceableRuntimeText' ? mesh.userData.marqueeFace : null
      const face = (authoredFace === 'front' || authoredFace === 'left' || authoredFace === 'right' ? authoredFace : null)
        ?? (Object.entries(TEXT_NODE_NAMES) as [keyof typeof TEXT_NODE_NAMES, string][]).find(([, name]) => name === mesh.name)?.[0]
      if (face) {
        signCounts[face] += 1
        this.signs.set(face, { face, mesh, materials, texture: null, text: null, colorKey: null })
        return
      }

      const fixtureName = findFixtureName(mesh)
      const kind = fixtureName ? fixtureKind(fixtureName) : null
      if (kind && fixtureName) {
        this.fixtures.push({ name: fixtureName, mesh, materials, address: addressFromName(kind, fixtureName) })
        return
      }

      const materialNames = materials.map(material => material.name.toLowerCase()).join(' ')
      const authoredName = typeof mesh.userData?.name === 'string' ? mesh.userData.name : mesh.name
      if (authoredName.startsWith('environment.') || materialNames.includes('night sky')) this.nightMaterials.push(...materials)
      else if (authoredName.startsWith('curtain.') || materialNames.includes('curtain')) this.curtainMaterials.push(...materials)
      else if (authoredName.startsWith('pavement.') || authoredName.startsWith('road.') || materialNames.includes('pavement') || materialNames.includes('road')) this.groundMaterials.push(...materials)
      else if (authoredName.startsWith('facade.') || authoredName.startsWith('entrance.') || authoredName.startsWith('window.')) this.architecturalMaterials.push(...materials)
    })

    for (const face of Object.keys(TEXT_NODE_NAMES) as (keyof typeof TEXT_NODE_NAMES)[]) {
      if (signCounts[face] !== 1) this.diagnostics.push(`Expected exactly one ${TEXT_NODE_NAMES[face]} mesh; found ${signCounts[face]}.`)
    }

    const byKind = new Map<Cinema2MarqueeFixtureKind, FixtureHandle[]>()
    for (const fixture of this.fixtures) {
      const list = byKind.get(fixture.address.kind) ?? []
      list.push(fixture)
      byKind.set(fixture.address.kind, list)
    }
    for (const list of byKind.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
      list.forEach((fixture, index) => {
        const progress = list.length <= 1 ? 0.5 : index / (list.length - 1)
        fixture.address = Object.freeze({
          ...fixture.address,
          row: Number.isFinite(fixture.address.row) ? fixture.address.row : progress,
          progress: Number.isFinite(fixture.address.progress) ? fixture.address.progress : progress,
        })
      })
    }
    const expectedMinimums: Readonly<Partial<Record<Cinema2MarqueeFixtureKind, number>>> = Object.freeze({
      'marquee-front': 80, 'marquee-left': 68, 'marquee-right': 68, canopy: 718,
      'tower-left': 76, 'tower-right': 76, 'led-left': 160, 'led-right': 160,
    })
    for (const [kind, minimum] of Object.entries(expectedMinimums) as [Cinema2MarqueeFixtureKind, number][]) {
      const count = byKind.get(kind)?.length ?? 0
      if (count < minimum) this.diagnostics.push(`Expected at least ${minimum} ${kind} fixtures; found ${count}.`)
    }
  }

  apply(frame: Readonly<Cinema2MarqueeSceneFrame>): void {
    if (this.disposed) return
    this.applyMaterialPalette(frame)
    this.applySign('front', frame.text.front, frame)
    this.applySign('left', frame.text.left, frame)
    this.applySign('right', frame.text.right, frame)

    for (const fixture of this.fixtures) {
      const gain = evaluateCinema2MarqueeFixture(fixture.address, frame.performance)
      const authored = clamp01(frame.zoneIntensity[fixture.address.kind] ?? 1)
      const intensity = clamp01(frame.masterIntensity) * authored * gain
      const color = fixtureColor(fixture.address.kind, frame.colors)
      for (const material of fixture.materials) {
        material.color.setRGB(color[0] * 0.3, color[1] * 0.3, color[2] * 0.3, this.library.THREE.SRGBColorSpace)
        material.emissive.setRGB(color[0], color[1], color[2], this.library.THREE.SRGBColorSpace)
        material.emissiveIntensity = 0.04 + intensity * (fixture.address.kind.startsWith('neon-') ? 6.4 : 5.2)
      }
    }
  }

  getDiagnostics(): readonly string[] {
    return Object.freeze([...this.diagnostics])
  }

  getFixtureCounts(): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {}
    for (const fixture of this.fixtures) counts[fixture.address.kind] = (counts[fixture.address.kind] ?? 0) + 1
    return Object.freeze(counts)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const sign of this.signs.values()) sign.texture?.dispose()
    this.signs.clear()
    this.fixtures.length = 0
    this.architecturalMaterials.length = 0
    this.nightMaterials.length = 0
    this.curtainMaterials.length = 0
    this.groundMaterials.length = 0
  }

  private applyMaterialPalette(frame: Readonly<Cinema2MarqueeSceneFrame>): void {
    const key = JSON.stringify([frame.colors.night, frame.colors.marquee, frame.colors.incandescent, frame.colors.blue, frame.colors.architecture, frame.reflection])
    if (key === this.materialKey) return
    this.materialKey = key
    const { THREE } = this.library
    for (const material of this.nightMaterials) {
      material.color.setRGB(frame.colors.night[0], frame.colors.night[1], frame.colors.night[2], THREE.SRGBColorSpace)
      material.emissive.setRGB(frame.colors.night[0] * 0.12, frame.colors.night[1] * 0.12, frame.colors.night[2] * 0.12, THREE.SRGBColorSpace)
    }
    for (const material of this.architecturalMaterials) {
      const brick = material.name.toLowerCase().includes('masonry')
      const source = brick ? frame.colors.architecture : frame.colors.night
      material.color.setRGB(source[0], source[1], source[2], THREE.SRGBColorSpace)
    }
    for (const material of this.curtainMaterials) {
      material.color.setRGB(frame.colors.marquee[0] * 0.46, frame.colors.marquee[1] * 0.18, frame.colors.marquee[2] * 0.18, THREE.SRGBColorSpace)
      material.roughness = 0.74
    }
    for (const material of this.groundMaterials) {
      material.color.setRGB(frame.colors.night[0] * 0.56, frame.colors.night[1] * 0.56, frame.colors.night[2] * 0.6, THREE.SRGBColorSpace)
      material.roughness = 0.84 - clamp01(frame.reflection) * 0.54
      material.metalness = clamp01(frame.reflection) * 0.14
    }
  }

  private applySign(face: 'front' | 'left' | 'right', value: string, frame: Readonly<Cinema2MarqueeSceneFrame>): void {
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
          material.color.setRGB(1, 1, 1, this.library.THREE.SRGBColorSpace)
          material.needsUpdate = true
        }
        previous?.dispose()
      }
      sign.text = text
      sign.colorKey = colorKey
    }
    for (const material of sign.materials) {
      material.emissive.setRGB(1, 0.88, 0.64, this.library.THREE.SRGBColorSpace)
      material.emissiveIntensity = 0.015 + 0.32 * clamp01(frame.signIllumination) * clamp01(frame.masterIntensity)
    }
  }

  private createTextTexture(text: string, face: 'front' | 'left' | 'right', red: Rgb): ThreeNamespace.Texture | null {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 220
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillStyle = '#dfd3b5'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = 'rgba(92,64,42,0.18)'
    context.lineWidth = 2
    for (let y = 36; y < canvas.height; y += 36) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke()
    }
    if (text) {
      let size = estimateCinema2MarqueeFontSize(text, canvas.width, canvas.height)
      const font = 'Anton, Impact, "Arial Narrow", sans-serif'
      context.font = `700 ${size}px ${font}`
      const safeWidth = canvas.width * 0.84
      while (size > 28 && context.measureText(text).width > safeWidth) {
        size -= 2
        context.font = `700 ${size}px ${font}`
      }
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineJoin = 'round'
      const redCss = `rgb(${Math.round(red[0] * 255)},${Math.round(red[1] * 255)},${Math.round(red[2] * 255)})`
      context.strokeStyle = face === 'front' ? '#2b0504' : '#dfd3b5'
      context.lineWidth = face === 'front' ? 10 : 8
      context.strokeText(text, canvas.width / 2, canvas.height / 2 + size * 0.03)
      context.fillStyle = face === 'front' ? redCss : '#0e0c09'
      context.fillText(text, canvas.width / 2, canvas.height / 2 + size * 0.03)
    }
    const texture = new this.library.THREE.CanvasTexture(canvas)
    texture.name = `MARQUEE runtime text · ${face}`
    texture.flipY = false
    texture.colorSpace = this.library.THREE.SRGBColorSpace
    texture.generateMipmaps = true
    texture.minFilter = this.library.THREE.LinearMipmapLinearFilter
    texture.magFilter = this.library.THREE.LinearFilter
    texture.needsUpdate = true
    return texture
  }
}

function fixtureKind(name: string): Cinema2MarqueeFixtureKind | null {
  if (name.startsWith('bulbs.marquee.front.')) return 'marquee-front'
  if (name.startsWith('bulbs.marquee.left.')) return 'marquee-left'
  if (name.startsWith('bulbs.marquee.right.')) return 'marquee-right'
  if (name.startsWith('bulbs.canopy.')) return 'canopy'
  if (name.startsWith('bulbs.tower.left.')) return 'tower-left'
  if (name.startsWith('bulbs.tower.right.')) return 'tower-right'
  if (name.startsWith('leds.left.')) return 'led-left'
  if (name.startsWith('leds.right.')) return 'led-right'
  if (name.startsWith('neon.red.') || name.startsWith('roof_neon_ornament.red')) return 'neon-red'
  if (name.startsWith('neon.amber.') || name.startsWith('roof_neon_ornament.amber')) return 'neon-amber'
  if (name.startsWith('neon.blue.') || name.startsWith('roof_neon_ornament.blue')) return 'neon-blue'
  if (name.startsWith('marquee.') && name.includes('.red_neon_')) return 'neon-red'
  if (name.startsWith('roof_neon_ornament.')) return 'neon-red'
  if (name.startsWith('roof_neon.central.gold.')) return 'neon-amber'
  if (name.startsWith('roof_neon.central.blue.')) return 'neon-blue'
  return null
}

function findFixtureName(object: ThreeNamespace.Object3D): string | null {
  let candidate: ThreeNamespace.Object3D | null = object
  while (candidate) {
    const authoredName = typeof candidate.userData?.name === 'string' ? candidate.userData.name : candidate.name
    if (fixtureKind(authoredName)) return authoredName
    candidate = candidate.parent
  }
  return null
}

function addressFromName(kind: Cinema2MarqueeFixtureKind, name: string): Cinema2MarqueeFixtureAddress {
  const canopy = /\.r(\d+)\.b(\d+)/.exec(name)
  if (canopy) return Object.freeze({ kind, row: Number(canopy[1]) / 42, progress: Number(canopy[2]) / 20 })
  const led = /\.r(\d+)\.c(\d+)/.exec(name)
  if (led) return Object.freeze({ kind, row: Number(led[1]) / 19, progress: Number(led[2]) / 7 })
  return Object.freeze({ kind, row: Number.NaN, progress: Number.NaN })
}

function fixtureColor(kind: Cinema2MarqueeFixtureKind, colors: Cinema2MarqueeSceneFrame['colors']): Rgb {
  if (kind === 'neon-blue') return colors.blue
  if (kind === 'neon-red' || kind.startsWith('marquee-')) return colors.marquee
  if (kind === 'neon-amber' || kind.startsWith('tower-') || kind === 'canopy') return colors.incandescent
  if (kind.startsWith('led-')) return colors.architecture
  return colors.incandescent
}
