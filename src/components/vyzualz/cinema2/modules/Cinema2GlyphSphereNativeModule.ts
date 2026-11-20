import type * as THREE from 'three'
import { cinema2StableId, type Cinema2ModuleTypeId, type Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import type { Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { createCinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { GlyphSphereScene, type GlyphSphereControls } from './glyphSphere/GlyphSphereScene'

export const CINEMA2_GLYPH_SPHERE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('glyph-sphere-native')

type Rgb = readonly number[]
export const GLYPH_SPHERE_PALETTE = {
  coreColor: [.976, .957, 1, 1], innerColor: [.478, .937, 1, 1], middleColor: [1, .824, .588, 1], outerColor: [.631, .569, .98, 1],
  frameColor: [.137, .18, .259, 1],
} as const satisfies Record<string, Rgb>
export const GLYPH_SPHERE_BACKGROUND = [.018, .017, .037, 1] as const

/**
 * Drives the glyph armillary from the shared beat clock. The motion phase advances in beats, so a band turns faster on a faster track, holds while
 * playback is paused and idles at the 120 BPM reference with no source. Audio, kicks and the mood conductor reach this module as ordinary
 * parameter changes from choreography; there is no pattern state to track.
 */
export class Cinema2GlyphSphereController {
  readonly afterVisibility = true
  private scene: GlyphSphereScene | null = null
  private context: Cinema2ModuleUpdateContext | null = null
  private readonly clock = new Cinema2BeatClock()
  private phase = 0
  private lastBeat: number | null = null
  private lastTimestamp: number | null = null
  private previousTime: number | null = null
  private identity: string | null = null

  constructor(private readonly library: Cinema2ThreeLibrary) {}

  attach(root: THREE.Object3D): void { this.scene = new GlyphSphereScene(this.library, root) }

  update(context: Cinema2ModuleUpdateContext): void {
    this.context = context
    const { frame, parameters } = context
    const time = frame.transport?.timeSec ?? frame.elapsedTimeSec
    const identity = JSON.stringify([frame.contextGeneration, frame.transport?.trackId, frame.audio?.upstream.sourceId, frame.audio?.upstream.analysisRevision, frame.audio?.upstream.timelineRevision, frame.audio?.discontinuity.generation])
    const reset = identity !== this.identity || (this.previousTime != null && (time < this.previousTime - .01 || time - this.previousTime > .75))
    if (reset) { this.clock.reset(); this.lastBeat = null }
    const dt = this.lastTimestamp == null ? 0 : Math.min(.1, Math.max(0, (frame.timestampMs - this.lastTimestamp) / 1000))
    const active = !frame.transport?.paused && frame.transport?.animationActive !== false
    this.lastTimestamp = frame.timestampMs
    const timingFrame = {
      ...frame, elapsedTimeSec: frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec, deltaTimeSec: active ? dt : 0,
      ...(frame.transport ? { transport: { ...frame.transport, animationActive: active } } : {}),
    }
    const beats = this.clock.update(timingFrame, parameters.get('bpmSync') !== false).beats
    const delta = this.lastBeat == null ? 0 : Math.max(0, beats - this.lastBeat)
    if (active) this.phase += delta * this.number('motionRate', 1, 0, 2) * Math.PI / 4
    this.lastBeat = beats
    this.previousTime = time
    this.identity = identity
  }

  beforeDraw(quality: Cinema2RenderQualityLevel = 'high'): void {
    if (!this.context || !this.scene) return
    this.scene.draw(this.controls(), this.phase, quality)
  }

  inspect(): Readonly<Record<string, unknown>> { return { ...this.scene?.inspect(), phase: this.phase } }

  dispose(): void {
    this.scene?.dispose()
    this.scene = null
    this.context = null
    this.clock.reset()
  }

  private controls(): GlyphSphereControls {
    const n = (name: string, fallback: number, min: number, max: number) => this.number(name, fallback, min, max)
    const c = (name: string, fallback: Rgb): Rgb => {
      const value = this.context!.parameters.get(name)
      return Array.isArray(value) && value.length >= 3 ? value.map(Number) : fallback
    }
    return {
      intensity: n('intensity', 1, 0, 2), coreScale: n('coreScale', 1, .7, 1.3), coreGlow: n('coreGlow', 1, 0, 2), coreBreath: n('coreBreath', .35, 0, 1),
      bandSpread: n('bandSpread', 1, .8, 1.25), bandWobble: n('bandWobble', .35, 0, 1), bandLighting: n('bandLighting', 1, 0, 2),
      frameLighting: n('frameLighting', 1, 0, 1.5), tickLighting: n('tickLighting', 1, 0, 1.5), jointLighting: n('jointLighting', 1, 0, 1.5),
      halo: n('halo', .6, 0, 1.2), starfield: n('starfield', .6, 0, 1),
      coreColor: c('coreColor', GLYPH_SPHERE_PALETTE.coreColor), innerColor: c('innerColor', GLYPH_SPHERE_PALETTE.innerColor),
      middleColor: c('middleColor', GLYPH_SPHERE_PALETTE.middleColor), outerColor: c('outerColor', GLYPH_SPHERE_PALETTE.outerColor),
      frameColor: c('frameColor', GLYPH_SPHERE_PALETTE.frameColor), background: c('background', GLYPH_SPHERE_BACKGROUND),
    }
  }

  private number(name: string, fallback: number, min: number, max: number): number {
    const value = this.context?.parameters.get(name)
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
  }
}

export const cinema2GlyphSphereModuleDefinition = createCinema2ThreeSceneModuleDefinition({
  typeId: CINEMA2_GLYPH_SPHERE_MODULE_TYPE_ID,
  resourceKey: 'glyph-sphere:bridge',
  createModelController: library => new Cinema2GlyphSphereController(library),
})
