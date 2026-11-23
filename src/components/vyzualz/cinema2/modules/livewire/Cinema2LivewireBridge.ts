import type { MeshStandardMaterial } from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2SayItBridge, type Cinema2SayItDrawState } from '../sayIt/Cinema2SayItBridge'
import { CINEMA2_SAY_IT_PATTERN_IDS } from '../sayIt/Cinema2SayItPatternController'
import type { Cinema2SayItQualityProfile } from '../sayIt/Cinema2SayItQuality'
import type { Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { LIVEWIRE_GLYPH_MESHES, LIVEWIRE_GLYPH_METRICS, LIVEWIRE_MAX_BARS } from './Cinema2LivewireGlyphs'

import { applyLivewireLedMaterial, applyLivewireMetalMaterial, type LivewireLightUniforms } from './Cinema2LivewireMaterials'

export const LIVEWIRE_FLOOR_Y = -0.91
export const LIVEWIRE_PATTERNS = [
  { value: 'trace', label: 'Trace' },
  { value: 'relay', label: 'Relay' },
  { value: 'split', label: 'Split' },
  { value: 'crown', label: 'Crown' },
  { value: 'groundline', label: 'Groundline' },
  { value: 'crossfire', label: 'Crossfire' },
] as const

export interface LivewirePerformance {
  coverage: number
  intensity: number
  period: number
  motion: number
  playing: boolean
  energy: number
  vocal: number
  kick: number
  snare: number
  transient: number
  build: number
  drop: number
}

export class Cinema2LivewireBridge extends Cinema2SayItBridge {
  private phase = 0
  private patternBeats = 0
  private pattern: Cinema2SayItDrawState['pattern'] | null = null
  private readonly uniforms = new WeakMap<MeshStandardMaterial, LivewireLightUniforms>()

  constructor(gl: WebGL2RenderingContext, library: Cinema2ThreeLibrary, asset: Readonly<Cinema2ThreeLoadedAsset>,
    private readonly getPerformance: () => Readonly<LivewirePerformance>) {
    super(gl, library, asset, LIVEWIRE_GLYPH_MESHES)
  }

  protected override applyState(
    exec: Cinema2ModuleRenderExecutionContext & { camera: NonNullable<Cinema2ModuleRenderExecutionContext['camera']>; lightingEnvironment: NonNullable<Cinema2ModuleRenderExecutionContext['lightingEnvironment']> },
    draw: Readonly<Cinema2SayItDrawState>,
    profile: Readonly<Cinema2SayItQualityProfile>,
  ): void {
    const { THREE } = this.library
    const look = this.getPerformance()
    const patternDelta = draw.patternPhaseBeats - this.patternBeats
    if (this.pattern !== draw.pattern || patternDelta < 0 || !look.playing || look.motion === 0) this.phase = 0
    else this.phase = (this.phase + patternDelta * look.motion * (1 - look.vocal * 0.62) / (look.period * 2)) % 1
    this.pattern = draw.pattern
    this.patternBeats = draw.patternPhaseBeats
    const coverage = Math.min(1, look.coverage + look.motion * (look.energy * 0.19 + look.build * 0.35))
    const pattern = CINEMA2_SAY_IT_PATTERN_IDS.indexOf(draw.pattern)
    const floorOffset = draw.poses.length ? LIVEWIRE_FLOOR_Y + 0.027 - Math.min(...draw.poses.map(pose => {
      const glyph = LIVEWIRE_GLYPH_METRICS.glyphs[pose.character.codePointAt(0)!]!
      return pose.position[1] + (glyph.minY - glyph.centerY) * pose.scale
    })) : 0

    super.applyState(exec, {
      ...draw,
      poses: draw.poses.map(pose => ({ ...pose, position: [pose.position[0], pose.position[1] + floorOffset, pose.position[2]] })),
      pattern: 'solid',
      ledMusicIntensity: 1,
    }, profile)

    for (const [index, glyph] of this.glyphs.entries()) {
      const material = glyph.ledMaterial
      let inputs = this.uniforms.get(material)
      if (!inputs) {
        const barEndpoints = glyph.mesh.geometry.userData.livewireBars as ReadonlyArray<readonly [number, number, number, number]>
        inputs = {
          program: { value: new THREE.Vector4() },
          accent: { value: new THREE.Vector4() },
          bars: { value: Array.from({ length: LIVEWIRE_MAX_BARS }, (_, bar) => new THREE.Vector4(...(barEndpoints[bar] ?? [0, 0, 0, 0]))) },
          count: { value: barEndpoints.length },
          tint: { value: new THREE.Color() },
          intensity: { value: 0 },
        }
        applyLivewireLedMaterial(material, inputs)
        applyLivewireMetalMaterial(glyph.material, inputs)
        this.uniforms.set(material, inputs)
      }
      inputs.program.value.set(pattern, this.phase, coverage, index / Math.max(1, this.glyphs.length - 1))
      inputs.accent.value.set(look.kick, look.snare, look.transient, look.drop).multiplyScalar(look.motion)
      inputs.tint.value.setRGB(...draw.outlineColor, THREE.SRGBColorSpace)
      inputs.intensity.value = look.intensity * (1 + look.drop * look.motion * 0.32)
      material.emissiveIntensity = look.intensity * (7.4 + look.drop * look.motion * 2.2)
      glyph.material.metalness = 0.84
      glyph.material.roughness = draw.roughness
      glyph.material.emissive.setRGB(0, 0, 0)
      glyph.material.emissiveIntensity = 0
    }
  }
}
