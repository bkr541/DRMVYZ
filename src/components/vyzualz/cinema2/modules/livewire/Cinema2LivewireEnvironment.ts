import type { BoxGeometry, Color, Group, InstancedMesh, MeshBasicMaterial, Scene } from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import type { LivewirePerformance } from './Cinema2LivewireBridge'

// World-space stage, independent of the text's scale and alignment. All faces
// are behind the maximum glyph depth and above the existing reflective floor.
interface StagePart {
  position: readonly [number, number, number]
  size: readonly [number, number, number]
  kind: 'shell' | 'spill' | 'conduit'
  lane: number
  height: number
  progress: number
}

export function buildLivewireStage(floorY: number): readonly StagePart[] {
  const parts: StagePart[] = []
  const add = (x: number, y: number, z: number, w: number, h: number, d: number,
    kind: StagePart['kind'], lane: number, progress: number) => {
    parts.push({ position: [x, floorY + y, z], size: [w, h, d], kind, lane, height: y / 4.6, progress })
  }
  // Alternating recessed bays, two depths, open spaces rather than a solid wall.
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 1.48
    const lane = i / 8
    const z = i % 2 === 0 ? -3.8 : -2.65
    const top = 3.55 + (i % 3) * 0.42
    add(x, top / 2, z, 0.96, top, 0.32, 'shell', lane, 0)
    add(x - 0.53, top / 2, z + 0.23, 0.13, top, 0.36, 'shell', lane, 0)
    add(x + 0.53, top / 2, z + 0.23, 0.13, top, 0.36, 'shell', lane, 0)
    // Machined vertical recesses: the wide strip is the local light spill on
    // the surrounding surface, the narrower inset is the actual light source.
    for (let j = 0; j < 5; j++) {
      const y = 0.72 + j * (top - 0.92) / 5
      const progress = j / 5
      add(x + 0.31, y, z + 0.175, 0.25, 0.44, 0.02, 'spill', lane, progress)
      add(x + 0.31, y, z + 0.20, 0.038, 0.40, 0.03, 'conduit', lane, progress)
    }
    // Interrupted overhead feeds and a low service rail link the vertical banks.
    for (const y of [top - 0.13, 0.27]) {
      add(x, y, z + 0.23, 1.24, 0.15, 0.27, 'shell', lane, 0)
      add(x - 0.11, y, z + 0.38, 0.87, 0.065, 0.025, 'spill', lane, 0.85)
      add(x - 0.11, y, z + 0.40, 0.72, 0.027, 0.025, 'conduit', lane, 0.85)
    }
  }
  return parts
}

const wave = (phase: number, offset: number) => Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (phase - offset)), 5)

/** Bounded linear-light output. No clock or musical event detector here: the
 * bridge supplies the same pattern phase and resolved accents as the glyphs. */
export function livewireStageLight(part: StagePart, pattern: number, phase: number,
  look: Readonly<LivewirePerformance>): number {
  if (part.kind === 'shell') return 0.0028
  const motion = look.motion
  const active = look.playing ? motion : 0
  const keep = 1 - look.silence
  const travel = part.lane * 0.65 + part.progress * 0.35
  let bank = wave(phase, travel)
  if (pattern === 1) bank = wave(phase, part.lane + part.progress * 0.16)
  if (pattern === 2) bank = wave(phase, (part.lane < 0.5 ? 0 : 0.5) + part.progress * 0.32)
  if (pattern === 3) bank = wave(phase, travel) * part.height
  if (pattern === 4) bank = wave(phase, travel) * (1 - part.height)
  if (pattern === 5) bank = wave(phase, Math.abs(part.lane - 0.5) * 1.5 + part.progress * 0.28)
  const musical = (look.energy * 0.025 + look.build * 0.065) * bank
    + look.kick * 0.035 * wave(phase, travel) * (1 - part.height)
    + look.snare * 0.04 * part.height * bank
    + look.transient * 0.025 * bank
    + look.drop * 0.12 * bank
  const level = Math.min(0.22, Math.max(0, look.intensity * (0.003 + active * keep
    * (0.025 * bank + musical) * (1 - 0.78 * look.vocal))))
  return level * (part.kind === 'spill' ? 0.23 : 1)
}

/** One depth-tested instanced draw, no new lights, shadows, textures or render
 * targets. Local surface spill is baked into the adjacent geometry's live color,
 * so additional scene lighting cannot wash out the existing wordmark. */
export class Cinema2LivewireEnvironment {
  private readonly root: Group
  private readonly geometry: BoxGeometry
  private readonly material: MeshBasicMaterial
  private readonly mesh: InstancedMesh
  private readonly parts: readonly StagePart[]
  private disposed = false

  constructor(private readonly THREE: Cinema2ThreeLibrary['THREE'], scene: Scene, floorY: number) {
    this.parts = buildLivewireStage(floorY)
    this.root = new THREE.Group()
    this.root.name = 'livewire-recessed-stage'
    this.geometry = new THREE.BoxGeometry(1, 1, 1)
    this.material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.parts.length)
    const transform = new THREE.Object3D()
    const color = new THREE.Color()
    this.parts.forEach((part, index) => {
      transform.position.set(...part.position)
      transform.scale.set(...part.size)
      transform.updateMatrix()
      this.mesh.setMatrixAt(index, transform.matrix)
      this.mesh.setColorAt(index, color.setRGB(0, 0, 0))
    })
    this.mesh.instanceMatrix.needsUpdate = true
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage)
    this.mesh.computeBoundingSphere()
    this.root.add(this.mesh)
    scene.add(this.root)
  }

  // Reuse scratch colors and existing instance buffers; only light values change.
  private tint?: Color
  private color?: Color

  update(pattern: number, phase: number, look: Readonly<LivewirePerformance>,
    outline: readonly [number, number, number]): void {
    if (this.disposed) return
    const tint = this.tint ??= new this.THREE.Color()
    const color = this.color ??= new this.THREE.Color()
    tint.setRGB(...outline, this.THREE.SRGBColorSpace)
    for (let i = 0; i < this.parts.length; i++) {
      const part = this.parts[i]!
      const level = livewireStageLight(part, pattern, phase, look)
      if (part.kind === 'shell') color.setRGB(level * 0.6, level * 0.85, level)
      else color.copy(tint).multiplyScalar(level)
      this.mesh.setColorAt(i, color)
    }
    this.mesh.instanceColor!.needsUpdate = true
  }

  estimateGpuBytes(): number {
    return (this.geometry.index?.array.byteLength ?? 0)
      + Object.values(this.geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0)
      + this.mesh.instanceMatrix.array.byteLength + (this.mesh.instanceColor?.array.byteLength ?? 0)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeFromParent()
    this.mesh.dispose()
    this.geometry.dispose()
    this.material.dispose()
  }
}
