import {
  createCinematicSeededRandom,
  createLegacyPortalCinematicConfig,
  normalizeCinematicWorldConfig,
} from '../CinematicWorldConfig'
import type { CinematicWorldConfig } from '../CinematicWorldConfig'
import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { hexToRgba } from './reactRenderUtils'
import { CinematicWebGLRuntime } from './cinematic/CinematicWebGLRuntime'
import { cinematicModulationValue } from './cinematic/CinematicAudioModulation'
import { defineCinematicWorldDirection } from './cinematic/CinematicWorldDirection'
import { diagnosticCinematicWorldDefinition } from './cinematic/worlds/DiagnosticCinematicWorld'
import { cinematicWorldDefinitions } from './cinematic/worlds'
import {
  CinematicWorldRendererHost,
  CinematicWorldRendererRegistry,
  cinematicInputFromReactFrame,
} from './CinematicWorldRenderer'
import type {
  CinematicRendererInitializeInput,
  CinematicRendererResetReason,
  CinematicViewport,
  CinematicWorldRenderer,
  CinematicWorldRenderInput,
} from './CinematicWorldRenderer'

interface FogParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  alphaSpeed: number
}

interface Ember {
  x: number
  y: number
  vy: number
  vx: number
  life: number
  maxLife: number
  size: number
}

interface PortalRing {
  r: number
  maxR: number
  alpha: number
}

interface CinematicState {
  fogParticles: FogParticle[]
  embers: Ember[]
  rings: PortalRing[]
  cameraX: number
  cameraY: number
  ringHazard: number
  nextRingThreshold: number
}

const FOG_COUNT = 130
const EMBER_COUNT = 50
const MAX_RINGS = 8
const SIXTY_HZ = 60

export function legacyPortalFrameScale(deltaTimeSec: number): number {
  return Math.max(0, deltaTimeSec) * SIXTY_HZ
}

export function legacyPortalPerFrameDecay(perFrameMultiplier: number, deltaTimeSec: number): number {
  return Math.pow(perFrameMultiplier, legacyPortalFrameScale(deltaTimeSec))
}

function randomThreshold(random: () => number): number {
  return -Math.log(Math.max(1e-7, 1 - random()))
}

function particleRandom(seed: number, index: number): () => number {
  return createCinematicSeededRandom((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0)
}

function createFogParticle(seed: number, index: number): FogParticle {
  const random = particleRandom(seed, index)
  return {
    x: random() * 2 - 1,
    y: random() * 2 - 1,
    vx: (random() - 0.5) * 0.0006,
    vy: (random() - 0.5) * 0.0004,
    size: random() * 5 + 2,
    alpha: random() * 0.3 + 0.05,
    alphaSpeed: (random() - 0.5) * 0.002,
  }
}

function createEmber(
  random: () => number,
  width: number,
  height: number,
  initial = false,
): Ember {
  const maxLife = random() * 120 + 60
  return {
    x: (random() - 0.5) * width * 0.6 + width * 0.5,
    y: height * 0.8 + random() * height * 0.2,
    vx: (random() - 0.5) * 0.8,
    vy: -(random() * 1.2 + 0.4),
    life: initial ? random() * maxLife : 0,
    maxLife,
    size: random() * 2.5 + 0.5,
  }
}

function createState(seed: number, random: () => number): CinematicState {
  return {
    fogParticles: Array.from({ length: FOG_COUNT }, (_, index) => createFogParticle(seed, index)),
    embers: [],
    rings: [],
    cameraX: 0,
    cameraY: 0,
    ringHazard: 0,
    nextRingThreshold: randomThreshold(random),
  }
}

interface SectionAtmosphere {
  fogIntensity: number
  portalGlow: number
  ringRate: number
  cameraShake: number
  emberRate: number
}

function atmosphereForSection(type: ReactSectionType | null): SectionAtmosphere {
  switch (type) {
    case 'intro': return { fogIntensity: 0.30, portalGlow: 0.35, ringRate: 0.02, cameraShake: 0.0, emberRate: 0.3 }
    case 'verse': return { fogIntensity: 0.50, portalGlow: 0.55, ringRate: 0.04, cameraShake: 0.0, emberRate: 0.5 }
    case 'build': return { fogIntensity: 0.70, portalGlow: 0.75, ringRate: 0.08, cameraShake: 0.2, emberRate: 0.7 }
    case 'drop': return { fogIntensity: 1.00, portalGlow: 1.00, ringRate: 0.25, cameraShake: 1.0, emberRate: 1.0 }
    case 'breakdown': return { fogIntensity: 0.55, portalGlow: 0.45, ringRate: 0.03, cameraShake: 0.0, emberRate: 0.4 }
    case 'outro': return { fogIntensity: 0.25, portalGlow: 0.28, ringRate: 0.01, cameraShake: 0.0, emberRate: 0.2 }
    default: return { fogIntensity: 0.50, portalGlow: 0.50, ringRate: 0.05, cameraShake: 0.0, emberRate: 0.5 }
  }
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  preset: ReactPreset,
  params: ReactRenderParams,
  atmosphere: SectionAtmosphere,
): void {
  ctx.fillStyle = preset.palette.background
  ctx.fillRect(0, 0, width, height)

  const centerX = width / 2
  const centerY = height / 2
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY * 0.7,
    0,
    centerX,
    centerY,
    Math.max(width, height) * 0.7,
  )
  gradient.addColorStop(0, hexToRgba(preset.palette.primary, 0.04 * atmosphere.fogIntensity * params.glow))
  gradient.addColorStop(0.4, hexToRgba(preset.palette.secondary, 0.02 * atmosphere.fogIntensity * params.glow))
  gradient.addColorStop(1, 'transparent')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

function drawPortal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  preset: ReactPreset,
  params: ReactRenderParams,
  bass: number,
  atmosphere: SectionAtmosphere,
  legacyTick: number,
): void {
  const { primary, secondary, accent } = preset.palette
  const centerX = width / 2
  const centerY = height / 2
  const portalWidth = Math.min(width * 0.22, 180 * dpr)
  const portalHeight = Math.min(height * 0.58, 360 * dpr)
  const glow = atmosphere.portalGlow * params.glow * (1 + bass * 0.6)
  const portalX = centerX - portalWidth / 2
  const portalY = centerY - portalHeight / 2

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  for (let layer = 4; layer >= 1; layer--) {
    const expand = layer * 18 * dpr * glow
    const layerAlpha = (glow * 0.18 / layer) * params.intensity
    const layerGradient = ctx.createLinearGradient(portalX, portalY, portalX + portalWidth, portalY)
    layerGradient.addColorStop(0, hexToRgba(primary, layerAlpha))
    layerGradient.addColorStop(0.5, hexToRgba(secondary, layerAlpha * 1.4))
    layerGradient.addColorStop(1, hexToRgba(primary, layerAlpha))
    ctx.fillStyle = layerGradient
    ctx.beginPath()
    ctx.roundRect(
      portalX - expand,
      portalY - expand,
      portalWidth + expand * 2,
      portalHeight + expand * 2,
      4 * dpr,
    )
    ctx.fill()
  }

  ctx.globalCompositeOperation = 'source-over'
  const innerGradient = ctx.createRadialGradient(
    centerX,
    portalY + portalHeight * 0.3,
    0,
    centerX,
    portalY + portalHeight * 0.5,
    portalHeight * 0.6,
  )
  innerGradient.addColorStop(0, hexToRgba(primary, 0.12 + Math.sin(legacyTick * 0.003) * 0.04))
  innerGradient.addColorStop(0.4, hexToRgba(preset.palette.background, 0.85))
  innerGradient.addColorStop(1, hexToRgba(preset.palette.background, 0.97))
  ctx.fillStyle = innerGradient
  ctx.beginPath()
  ctx.rect(portalX, portalY, portalWidth, portalHeight)
  ctx.fill()

  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = hexToRgba(accent, 0.7 * glow)
  ctx.lineWidth = 1.5 * dpr
  ctx.shadowColor = accent
  ctx.shadowBlur = 16 * params.glow
  ctx.beginPath()
  ctx.rect(portalX, portalY, portalWidth, portalHeight)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()
}

function updateAndDrawRings(
  ctx: CanvasRenderingContext2D,
  input: CinematicWorldRenderInput,
  state: CinematicState,
  random: () => number,
  bass: number,
  atmosphere: SectionAtmosphere,
  frameScale: number,
): void {
  const { width, height } = input.resolution
  const dpr = input.devicePixelRatio
  const { preset, params } = input
  const centerX = width / 2
  const centerY = height / 2
  const portalWidth = Math.min(width * 0.22, 180 * dpr)
  const portalHeight = Math.min(height * 0.58, 360 * dpr)

  const spawnRing = () => {
    if (state.rings.length >= MAX_RINGS) return
    state.rings.push({
      r: 1,
      maxR: Math.max(width, height) * (0.4 + random() * 0.4),
      alpha: 0.6 * atmosphere.portalGlow * params.glow,
    })
  }

  if (input.beat.hit) {
    spawnRing()
  } else if (state.rings.length < MAX_RINGS) {
    const eventsPerSecond = atmosphere.ringRate * (1 + bass * 2) * 3
    state.ringHazard += eventsPerSecond * input.deltaTimeSec
    if (state.ringHazard >= state.nextRingThreshold) {
      state.ringHazard -= state.nextRingThreshold
      state.nextRingThreshold = randomThreshold(random)
      spawnRing()
    }
  }

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  for (let index = state.rings.length - 1; index >= 0; index--) {
    const ring = state.rings[index]
    ring.r += (1.5 * params.motion + bass * 3) * frameScale
    ring.alpha *= legacyPortalPerFrameDecay(0.965, input.deltaTimeSec)

    if (ring.alpha < 0.005) {
      state.rings.splice(index, 1)
      continue
    }

    const radiusX = ring.r * (portalWidth / portalHeight)
    ctx.strokeStyle = hexToRgba(preset.palette.primary, ring.alpha)
    ctx.shadowColor = preset.palette.primary
    ctx.shadowBlur = 10 * params.glow
    ctx.lineWidth = (1.2 + bass) * dpr
    ctx.beginPath()
    ctx.ellipse(centerX, centerY, radiusX, ring.r, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.shadowBlur = 0
  ctx.restore()
}

function updateAndDrawFog(
  ctx: CanvasRenderingContext2D,
  input: CinematicWorldRenderInput,
  state: CinematicState,
  bass: number,
  atmosphere: SectionAtmosphere,
  frameScale: number,
  seed: number,
): void {
  const { width, height } = input.resolution
  const dpr = input.devicePixelRatio
  const { preset, params } = input
  const count = Math.floor(FOG_COUNT * atmosphere.fogIntensity * params.fogDensity)
  if (count < 1) return

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  for (let index = 0; index < count; index++) {
    const particle = state.fogParticles[index]
    particle.x += particle.vx * (1 + bass) * params.motion * frameScale
    particle.y += particle.vy * (1 + bass) * params.motion * frameScale
    particle.alpha += particle.alphaSpeed * frameScale
    if (particle.alpha > 0.45 || particle.alpha < 0.02) particle.alphaSpeed *= -1
    particle.alpha = Math.max(0.02, Math.min(0.45, particle.alpha))

    if (particle.x > 1.15 || particle.x < -1.15 || particle.y > 1.15 || particle.y < -1.15) {
      Object.assign(particle, createFogParticle(seed, index))
      continue
    }

    const x = (particle.x + 1) * 0.5 * width
    const y = (particle.y + 1) * 0.5 * height
    const radius = (particle.size + bass * 3) * dpr
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3)
    gradient.addColorStop(0, hexToRgba(
      preset.palette.secondary,
      particle.alpha * atmosphere.fogIntensity * params.glow,
    ))
    gradient.addColorStop(1, 'transparent')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, radius * 3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function updateAndDrawEmbers(
  ctx: CanvasRenderingContext2D,
  input: CinematicWorldRenderInput,
  state: CinematicState,
  random: () => number,
  bass: number,
  atmosphere: SectionAtmosphere,
  frameScale: number,
): void {
  const { width, height } = input.resolution
  const dpr = input.devicePixelRatio
  const { preset, params } = input
  const count = Math.floor(EMBER_COUNT * atmosphere.emberRate * params.particleDensity)
  if (count < 1) return

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.shadowColor = preset.palette.accent
  ctx.shadowBlur = 6 * params.glow

  for (let index = 0; index < count; index++) {
    const ember = state.embers[index]
    ember.life += (1 + bass * 2) * frameScale
    if (ember.life >= ember.maxLife) {
      Object.assign(ember, createEmber(random, width, height))
      continue
    }

    ember.x += ember.vx * params.motion * frameScale
    ember.y += ember.vy * (1 + bass) * params.motion * frameScale

    const progress = ember.life / ember.maxLife
    const alpha = Math.sin(progress * Math.PI) * 0.7 * atmosphere.emberRate * params.glow
    const radius = ember.size * (1 - progress * 0.5) * dpr

    ctx.globalAlpha = alpha
    ctx.fillStyle = progress < 0.5 ? preset.palette.accent : preset.palette.primary
    ctx.beginPath()
    ctx.arc(ember.x, ember.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  ctx.restore()
}

function drawLightBeams(
  ctx: CanvasRenderingContext2D,
  input: CinematicWorldRenderInput,
  bass: number,
  legacyTick: number,
  atmosphere: SectionAtmosphere,
): void {
  if (atmosphere.portalGlow < 0.2) return
  const { width, height } = input.resolution
  const { preset, params } = input

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  const centerX = width / 2
  const centerY = height * 0.15
  const beamCount = 7

  for (let index = 0; index < beamCount; index++) {
    const angle = ((index / beamCount) - 0.5) * 0.9 + Math.sin(legacyTick * 0.001 + index) * 0.03
    const length = Math.max(width, height) * (0.7 + bass * 0.3)
    const endX = centerX + Math.sin(angle) * length
    const endY = centerY + Math.cos(angle) * length
    const alpha = atmosphere.portalGlow * params.glow * 0.06 * (1 + bass * 0.5)

    const gradient = ctx.createLinearGradient(centerX, centerY, endX, endY)
    gradient.addColorStop(0, hexToRgba(preset.palette.primary, alpha))
    gradient.addColorStop(1, 'transparent')

    const beamWidth = width * 0.06 * (1 + index * 0.03)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(endX - beamWidth, endY)
    ctx.lineTo(endX + beamWidth, endY)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

class LegacyPortalWorldRenderer implements CinematicWorldRenderer {
  private context: CanvasRenderingContext2D | null = null
  private config: CinematicWorldConfig | null = null
  private viewport: CinematicViewport = { width: 0, height: 0, dpr: 1 }
  private random: () => number = createCinematicSeededRandom(1337)
  private state: CinematicState = createState(1337, this.random)

  initialize(input: CinematicRendererInitializeInput): void {
    this.context = input.context
    this.config = input.config
    this.random = createCinematicSeededRandom(input.config.seed)
    this.state = createState(input.config.seed, this.random)
  }

  resize(viewport: CinematicViewport): void {
    this.viewport = { ...viewport }
    if (this.state.embers.length === 0) {
      this.state.embers = Array.from(
        { length: EMBER_COUNT },
        () => createEmber(this.random, viewport.width, viewport.height, true),
      )
    }
  }

  render(input: CinematicWorldRenderInput): void {
    if (!this.context || !this.config) return

    const ctx = this.context
    const { width, height } = input.resolution
    const dpr = input.devicePixelRatio
    const params = input.params
    const mappedAperture = cinematicModulationValue(input.modulation, 'portalAperture')
    const mappedImpact = cinematicModulationValue(input.modulation, 'impact')
    const mappedBrightness = cinematicModulationValue(input.modulation, 'environmentBrightness')
    const mappedFog = cinematicModulationValue(input.modulation, 'fogDensity')
    const mappedParticles = cinematicModulationValue(input.modulation, 'particleEmission')
    const mappedPunch = cinematicModulationValue(input.modulation, 'cameraPunch')
    const bass = Math.min(1.5, input.audio.smoothed.bass * params.bassReactivity + mappedAperture * 0.65 + mappedImpact * 0.35)
    const baseAtmosphere = atmosphereForSection(input.section.type)
    const atmosphere: SectionAtmosphere = {
      fogIntensity: Math.min(1.5, baseAtmosphere.fogIntensity + mappedFog * 0.5),
      portalGlow: Math.min(1.6, baseAtmosphere.portalGlow + mappedBrightness * 0.6 + mappedImpact * 0.25),
      ringRate: Math.min(0.8, baseAtmosphere.ringRate + mappedImpact * 0.22),
      cameraShake: Math.min(1.5, baseAtmosphere.cameraShake + mappedPunch),
      emberRate: Math.min(1.8, baseAtmosphere.emberRate + mappedParticles * 0.75),
    }
    const frameScale = legacyPortalFrameScale(input.deltaTimeSec)
    const legacyTick = input.elapsedTimeSec * SIXTY_HZ

    const shakeX = atmosphere.cameraShake > 0 && input.beat.hit
      ? (this.random() - 0.5) * 6 * dpr * atmosphere.cameraShake
      : 0
    const shakeY = atmosphere.cameraShake > 0 && input.beat.hit
      ? (this.random() - 0.5) * 4 * dpr * atmosphere.cameraShake
      : 0
    const cameraBlend = 1 - legacyPortalPerFrameDecay(0.85, input.deltaTimeSec)
    this.state.cameraX += (shakeX - this.state.cameraX) * cameraBlend
    this.state.cameraY += (shakeY - this.state.cameraY) * cameraBlend

    ctx.save()
    const camera = input.camera?.pose
    if (camera) {
      const zoom = Math.max(0.72, Math.min(1.35, 58 / camera.fieldOfView + (1.8 - camera.position.z) * 0.05))
      ctx.translate(width * 0.5, height * 0.5)
      ctx.rotate(camera.rotation.z)
      ctx.scale(zoom, zoom)
      ctx.translate(-width * 0.5 + camera.position.x * width * 0.08, -height * 0.5 - camera.position.y * height * 0.08)
    }
    if (Math.abs(this.state.cameraX) + Math.abs(this.state.cameraY) > 0.1) {
      ctx.translate(this.state.cameraX, this.state.cameraY)
    }

    drawBackground(ctx, width, height, input.preset, params, atmosphere)
    drawLightBeams(ctx, input, bass, legacyTick, atmosphere)
    drawPortal(ctx, width, height, dpr, input.preset, params, bass, atmosphere, legacyTick)
    updateAndDrawRings(ctx, input, this.state, this.random, bass, atmosphere, frameScale)
    updateAndDrawFog(ctx, input, this.state, bass, atmosphere, frameScale, this.config.seed)
    updateAndDrawEmbers(ctx, input, this.state, this.random, bass, atmosphere, frameScale)

    ctx.restore()
  }

  reset(_reason: CinematicRendererResetReason): void {
    if (!this.config) return
    this.random = createCinematicSeededRandom(this.config.seed)
    this.state = createState(this.config.seed, this.random)
    if (this.viewport.width > 0 && this.viewport.height > 0) {
      this.resize(this.viewport)
    }
  }

  dispose(): void {
    this.context = null
    this.config = null
    this.state.rings = []
    this.state.embers = []
    this.state.fogParticles = []
  }
}

const legacyPortalDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked'],
  safeCameraRange: { minDistance: 1.1, maxDistance: 3.2, maxLateral: 0.65, minElevation: -0.55, maxElevation: 0.55 },
  shots: [
    { id: 'legacy-locked', rig: 'locked', sections: ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown'], action: 'hold' },
  ],
  dropActions: ['impact'],
  revealActions: ['reveal'],
  retreatActions: ['retreat'],
})

export const cinematicWorldRendererRegistry = new CinematicWorldRendererRegistry({ validateSharedCatalog: true })
cinematicWorldRendererRegistry.register({
  id: 'legacyPortal',
  label: 'Legacy Portal',
  backend: 'canvas2d',
  direction: legacyPortalDirection,
  capabilities: {
    backend: 'canvas2d',
    cameraRigs: ['locked'],
    modulationTargets: ['portalAperture', 'cameraPunch', 'fogDensity', 'particleEmission', 'environmentBrightness', 'impact'],
    supportsGeometryPasses: false,
    supportsFullscreenPasses: false,
    supportsTextureInputs: false,
    supportsPostProcessing: false,
    supportsFeedback: false,
  },
  create: () => new LegacyPortalWorldRenderer(),
})
for (const definition of cinematicWorldDefinitions) {
  cinematicWorldRendererRegistry.register(definition)
}
cinematicWorldRendererRegistry.register(diagnosticCinematicWorldDefinition)

const hostByContext = new WeakMap<CanvasRenderingContext2D, CinematicWorldRendererHost>()

function getHost(context: CanvasRenderingContext2D): CinematicWorldRendererHost {
  let host = hostByContext.get(context)
  if (!host) {
    host = new CinematicWorldRendererHost(
      context,
      cinematicWorldRendererRegistry,
      'legacyPortal',
      outputContext => CinematicWebGLRuntime.create(outputContext),
    )
    hostByContext.set(context, host)
  }
  return host
}

function resolvePresetConfig(preset: ReactPreset): CinematicWorldConfig {
  const legacyValues = {
    params: { ...preset.params },
    renderSettings: preset.renderSettings ? { ...preset.renderSettings } : {},
  }
  return preset.cinematicConfig
    ? normalizeCinematicWorldConfig(preset.cinematicConfig, legacyValues)
    : createLegacyPortalCinematicConfig({ ...preset.params, ...preset.renderSettings }, legacyValues)
}

/** Existing Canvas 2D integration retained as the legacy cinematic world. */
export function renderCinematicPortal(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  sectionType: ReactSectionType | null,
): void {
  const config = resolvePresetConfig(preset)
  getHost(ctx).render(cinematicInputFromReactFrame(frame, preset, params, sectionType, config))
}

export function resetCinematicPortalRenderer(ctx: CanvasRenderingContext2D): void {
  hostByContext.get(ctx)?.reset()
}

export function disposeCinematicPortalRenderer(ctx: CanvasRenderingContext2D): void {
  const host = hostByContext.get(ctx)
  host?.dispose()
  hostByContext.delete(ctx)
}
