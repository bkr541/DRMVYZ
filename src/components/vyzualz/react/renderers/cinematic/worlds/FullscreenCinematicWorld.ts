import { cinematicQualityLevel, createCinematicSeededVariation, type CinematicSeededVariation } from '../../../CinematicWorldSettings'
import { FULLSCREEN_VERT_SRC } from '../../../shaders/runtime/FullscreenPass'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type {
  CinematicFrameContext,
  CinematicRendererResetReason,
  CinematicViewport,
  CinematicWebGLServices,
  CinematicWebGLWorldInitializeInput,
  CinematicWebGLWorldRenderer,
  CinematicWorldRenderTarget,
} from '../../CinematicWorldRenderer'
import type { CinematicWorldMode } from '../../../CinematicWorldConfig'
import { CINEMATIC_WORLD_COMMON_UNIFORMS } from './CinematicWorldShaders'
import { cinematicModulationValue } from '../CinematicAudioModulation'
import { cinematicDirectionActionValue } from '../CinematicCameraDirector'

interface RgbColor {
  r: number
  g: number
  b: number
}

function parseHexColor(value: string, fallback: RgbColor): RgbColor {
  const normalized = value.trim().replace(/^#/, '')
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return fallback
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16) / 255,
    g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
    b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
  }
}

function sectionIntensity(frame: CinematicFrameContext): number {
  switch (frame.section.type) {
    case 'intro': return 0.70
    case 'verse': return 0.88
    case 'build': return 1.08
    case 'drop': return 1.30
    case 'breakdown': return 0.78
    case 'outro': return 0.64
    default: return 1
  }
}

export abstract class FullscreenCinematicWorld implements CinematicWebGLWorldRenderer {
  protected services: CinematicWebGLServices | null = null
  protected program: ShaderProgram | null = null
  protected viewport: CinematicViewport = { width: 1, height: 1, dpr: 1 }
  protected variation: CinematicSeededVariation = { phase: 0, skew: 0, density: 1, motion: 1 }

  private impactAge = 8
  private downbeatAge = 8
  private paletteKey = ''
  private primary: RgbColor = { r: 0.05, g: 0.86, b: 0.95 }
  private secondary: RgbColor = { r: 0.42, g: 0.16, b: 0.96 }
  private accent: RgbColor = { r: 1, g: 0.68, b: 0.22 }

  protected constructor(
    private readonly worldId: CinematicWorldMode,
    private readonly fragmentSource: string,
    private readonly worldUniforms: readonly string[],
  ) {}

  initialize(input: CinematicWebGLWorldInitializeInput): void {
    this.services = input.services
    this.variation = createCinematicSeededVariation(this.worldId, input.config.seed)
    this.program = input.services.compileProgram({
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: this.fragmentSource,
      label: `cinematic/world/${this.worldId}`,
      optionalUniforms: [...CINEMATIC_WORLD_COMMON_UNIFORMS, ...this.worldUniforms],
    })
  }

  resize(viewport: CinematicViewport): void {
    this.viewport = { ...viewport }
  }

  render(frame: CinematicFrameContext, target: CinematicWorldRenderTarget): void {
    if (!this.services || !this.program) return
    if (frame.beat.hit) this.impactAge = 0
    else this.impactAge = Math.min(8, this.impactAge + frame.deltaTimeSec)
    if (frame.beat.downbeat) this.downbeatAge = 0
    else this.downbeatAge = Math.min(8, this.downbeatAge + frame.deltaTimeSec)

    const paletteKey = `${frame.preset.palette.primary}|${frame.preset.palette.secondary}|${frame.preset.palette.accent}`
    if (paletteKey !== this.paletteKey) {
      this.paletteKey = paletteKey
      this.primary = parseHexColor(frame.preset.palette.primary, this.primary)
      this.secondary = parseHexColor(frame.preset.palette.secondary, this.secondary)
      this.accent = parseHexColor(frame.preset.palette.accent, this.accent)
    }
    const musical = frame.musicalAudio?.values
    const drop = musical?.dropState ?? (frame.section.type === 'drop' ? 1 : 0)
    const mappedImpact = Math.max(
      cinematicModulationValue(frame.modulation, 'impact'),
      cinematicModulationValue(frame.modulation, 'cameraPunch'),
    )
    const brightness = cinematicModulationValue(frame.modulation, 'environmentBrightness')
    const impact = Math.max(Math.exp(-this.impactAge * 5.5), mappedImpact)
    const downbeat = Math.exp(-this.downbeatAge * 4.0)

    this.program.activate()
    this.program.setVec2('uResolution', target.width, target.height)
    this.program.setFloat('uTime', frame.elapsedTimeSec)
    this.program.setFloat('uTransportTime', frame.transportTimeSec)
    this.program.setFloat('uBass', musical?.bass ?? frame.audio.smoothed.bass)
    this.program.setFloat('uMid', musical?.mid ?? frame.audio.smoothed.mid)
    this.program.setFloat('uHigh', musical?.highs ?? frame.audio.smoothed.high)
    this.program.setFloat('uVolume', Math.min(1, (musical?.overallEnergy ?? frame.audio.smoothed.volume) + brightness * 0.28))
    this.program.setFloat('uBeat', Math.max(frame.beat.hit ? 1 : 0, impact))
    this.program.setFloat('uBeatPhase', frame.beat.phase)
    this.program.setFloat('uKick', frame.beat.kick)
    this.program.setFloat('uSnare', frame.beat.snare)
    this.program.setFloat('uTransient', frame.beat.transient)
    this.program.setFloat('uBarProgress', frame.beat.barProgress)
    this.program.setFloat('uImpactAge', this.impactAge)
    this.program.setFloat('uDownbeat', Math.max(frame.beat.downbeat ? 1 : 0, downbeat))
    this.program.setFloat('uSectionIntensity', sectionIntensity(frame) * (1 + brightness * 0.32))
    this.program.setFloat('uDrop', drop)
    this.program.setFloat('uSeed', frame.randomSeed)
    this.program.setFloat('uQuality', cinematicQualityLevel(frame.config.qualityTier))
    this.program.setVec4(
      'uVariation',
      this.variation.phase,
      this.variation.skew,
      this.variation.density,
      this.variation.motion,
    )
    this.program.setVec3('uPrimary', this.primary.r, this.primary.g, this.primary.b)
    this.program.setVec3('uSecondary', this.secondary.r, this.secondary.g, this.secondary.b)
    this.program.setVec3('uAccent', this.accent.r, this.accent.g, this.accent.b)
    const camera = frame.camera
    this.program.setVec3(
      'uCameraPosition',
      camera?.pose.position.x ?? 0,
      camera?.pose.position.y ?? 0,
      camera?.pose.position.z ?? 1.8,
    )
    this.program.setVec3(
      'uCameraRotation',
      camera?.pose.rotation.x ?? 0,
      camera?.pose.rotation.y ?? 0,
      camera?.pose.rotation.z ?? 0,
    )
    this.program.setFloat('uCameraFieldOfView', camera?.pose.fieldOfView ?? 58)
    this.program.setFloat('uCameraRoute', camera?.routeProgress ?? 0)
    this.program.setFloat('uCameraAction', cinematicDirectionActionValue(camera?.action ?? 'hold'))
    this.setWorldUniforms(this.program, frame)

    this.services.fullscreenPass.run(
      this.program,
      target.framebuffer,
      target.width,
      target.height,
      [],
      { clear: true },
    )
  }

  reset(_reason: CinematicRendererResetReason): void {
    this.impactAge = 8
    this.downbeatAge = 8
  }

  onContextLost(): void {
    this.program = null
  }

  dispose(): void {
    this.program = null
    this.services = null
  }

  protected abstract setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void
}
