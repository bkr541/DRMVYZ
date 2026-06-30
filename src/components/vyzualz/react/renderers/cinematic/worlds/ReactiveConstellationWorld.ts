import {
  resolveReactiveConstellationSettings,
  type ReactiveConstellationSettings,
} from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type {
  CinematicFrameContext,
  CinematicRendererResetReason,
  CinematicViewport,
  CinematicWebGLServices,
  CinematicWebGLWorldDefinition,
  CinematicWebGLWorldInitializeInput,
  CinematicWebGLWorldRenderer,
  CinematicWorldRenderTarget,
} from '../../CinematicWorldRenderer'
import { cinematicModulationValue } from '../CinematicAudioModulation'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
import {
  CONSTELLATION_BEAM_ENDPOINT_FLOATS,
  CONSTELLATION_BEAM_INSTANCE_FLOATS,
  writeConstellationBeamInstance,
} from './reactiveConstellation/ConstellationBeamGeometry'
import type { ConstellationMeshStyle } from './reactiveConstellation/ConstellationGraphBuilder'
import { cameraViewProjectionMatrix, hashSeed } from './reactiveConstellation/ConstellationMath'
import {
  CONSTELLATION_MAX_CURTAINS,
  writeConstellationCurtainInstances,
} from './reactiveConstellation/ConstellationCurtains'
import { resolveConstellationPalette } from './reactiveConstellation/ConstellationMaterial'
import {
  isConstellationCameraPoseSafe,
  REACTIVE_CONSTELLATION_SAFE_CAMERA_RANGE,
  REACTIVE_CONSTELLATION_SHOTS,
} from './reactiveConstellation/ConstellationPresentation'
import { getConstellationMesh, listConstellationMeshStyles } from './reactiveConstellation/ConstellationMeshLibrary'
import {
  clampConstellationEdgeCount,
  clampConstellationNodeCount,
  clampConstellationTrailSamples,
  constellationQualityBudget,
  type ConstellationQualityBudget,
} from './reactiveConstellation/ConstellationQuality'
import { ConstellationSimulation } from './reactiveConstellation/ConstellationSimulation'
import { resolveReactiveConstellationComposition } from './reactiveConstellation/ReactiveConstellationChoreography'
import { ReactiveConstellationPerformanceActionRuntime } from './reactiveConstellation/ReactiveConstellationPerformanceActions'
import {
  REACTIVE_CONSTELLATION_BEAM_FRAGMENT_SOURCE,
  REACTIVE_CONSTELLATION_BEAM_VERTEX_SOURCE,
  REACTIVE_CONSTELLATION_FRAGMENT_SOURCE,
  REACTIVE_CONSTELLATION_VERTEX_SOURCE,
} from './reactiveConstellation/ConstellationShaders'
import {
  ConstellationTrailBuffer,
  constellationTrailAgeWeight,
} from './reactiveConstellation/ConstellationTrailBuffer'

interface MeshGpuResource {
  vao: WebGLVertexArrayObject
  buffers: WebGLBuffer[]
  instanceBuffer: WebGLBuffer
  vertexCount: number
  instanceCount: number
}

interface BeamGpuResource {
  vao: WebGLVertexArrayObject
  buffers: WebGLBuffer[]
  instanceBuffer: WebGLBuffer
  instanceCapacity: number
}

interface MeshInstanceLayout {
  nodeIndices: Uint16Array
  values: Float32Array
}

const NODE_INSTANCE_FLOATS = 9
const NODE_INSTANCE_STRIDE = NODE_INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT
const BEAM_INSTANCE_STRIDE = CONSTELLATION_BEAM_INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT
const NODE_ATTRIBUTES = {
  aPosition: 0,
  aNormal: 1,
  aBarycentric: 2,
  aInstancePosition: 3,
  aInstanceScale: 4,
  aInstanceRotation: 5,
  aInstanceProminence: 6,
  aInstancePalette: 7,
} as const
const BEAM_ATTRIBUTES = {
  aCorner: 0,
  aEndpointA: 1,
  aEndpointB: 2,
  aInstanceAlpha: 3,
  aInstanceWidth: 4,
  aInstancePalette: 5,
  aInstanceAge: 6,
} as const

const NODE_REQUIRED_UNIFORMS = [
  'uViewProjection', 'uCameraPosition', 'uTime', 'uNodeScale', 'uNodeSpin', 'uMotion',
  'uCameraOrbit', 'uGeometryRotation', 'uDepthPulse', 'uBeat', 'uPrimary', 'uSecondary',
  'uAccent', 'uFogColor', 'uIntensity', 'uGlow', 'uFaceOpacity', 'uFacetContrast',
  'uInternalGlow', 'uRimIntensity', 'uWireframeAmount', 'uColorVariation', 'uFogAmount',
  'uDepthFade', 'uBrightness', 'uPassMode',
] as const
const BEAM_REQUIRED_UNIFORMS = [
  'uViewProjection', 'uViewport', 'uCameraPosition', 'uBeamWidthPx', 'uPassWidthScale',
  'uTime', 'uMotion', 'uCameraOrbit', 'uGeometryRotation', 'uDepthPulse', 'uBeamColor',
  'uBeamAccent', 'uFogColor', 'uEdgeOpacity', 'uPassBrightness', 'uPassSoftness',
  'uColorVariation', 'uFogAmount', 'uDepthFade', 'uBeat', 'uBrightness',
] as const

function createBuffer(gl: WebGL2RenderingContext, services: CinematicWebGLServices): WebGLBuffer {
  const buffer = gl.createBuffer()
  if (!buffer) throw new Error('Reactive Constellation could not allocate a WebGL buffer')
  return services.resources.trackBuffer(buffer)
}

function createVertexArray(gl: WebGL2RenderingContext, services: CinematicWebGLServices): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()
  if (!vao) throw new Error('Reactive Constellation could not allocate a vertex array')
  return services.resources.trackVAO(vao)
}

function bindStaticAttribute(
  gl: WebGL2RenderingContext,
  services: CinematicWebGLServices,
  location: number,
  size: number,
  data: Float32Array,
): WebGLBuffer {
  const buffer = createBuffer(gl, services)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
  return buffer
}

function bindInstanceAttribute(
  gl: WebGL2RenderingContext,
  location: number,
  size: number,
  stride: number,
  offsetFloats: number,
): void {
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(
    location,
    size,
    gl.FLOAT,
    false,
    stride,
    offsetFloats * Float32Array.BYTES_PER_ELEMENT,
  )
  gl.vertexAttribDivisor(location, 1)
}

function allFinite(values: ArrayLike<number>): boolean {
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) return false
  }
  return true
}

export class ReactiveConstellationWorld implements CinematicWebGLWorldRenderer {
  private services: CinematicWebGLServices | null = null
  private nodeProgram: ShaderProgram | null = null
  private beamProgram: ShaderProgram | null = null
  private readonly meshes = new Map<ConstellationMeshStyle, MeshGpuResource>()
  private readonly instanceLayouts = new Map<ConstellationMeshStyle, MeshInstanceLayout>()
  private beamResource: BeamGpuResource | null = null
  private curtainResource: BeamGpuResource | null = null
  private curtainInstanceValues = new Float32Array(CONSTELLATION_MAX_CURTAINS * CONSTELLATION_BEAM_INSTANCE_FLOATS)
  private curtainInstanceCount = 0
  private readonly simulation = new ConstellationSimulation()
  private readonly trails = new ConstellationTrailBuffer()
  private readonly performanceActions = new ReactiveConstellationPerformanceActionRuntime()
  private beamEdgeIndices = new Uint16Array(0)
  private beamEdgePalette = new Float32Array(0)
  private currentEdgeEndpoints = new Float32Array(0)
  private beamInstanceValues = new Float32Array(0)
  private beamInstanceCount = 0
  private beamGlowInstanceCount = 0
  private beamStructureRevision = -1
  private beamBudgetKey = ''
  private uploadedStructureRevision = -1
  private pendingReset: CinematicRendererResetReason | null = null
  private lastReseedBar = -1
  private lastTrailSamples = -1
  private hasRendered = false
  private heldGeometryRotation = 0
  private heldBrightness = 0
  private heldDepthPulse = 0
  private heldNetworkSpread = 1
  private heldNodeScale = 0.12
  private heldNodeSpin = 0
  private heldEdgeBrightness = 1
  private heldEdgeWidth = 2
  private heldTrailLength = 0
  private heldTopologyMorph = 0
  private heldCollapseForce = 0
  private heldBurstImpulse = 0
  private heldFacetOpacity = 1
  private heldInternalGlow = 0.68
  private heldRimIntensity = 0.88
  private heldSpringStrength = 0.7
  private heldMotionScale = 1
  private heldCameraOrbit = 0
  private diagnostic: string | null = null
  private disposed = false

  initialize(input: CinematicWebGLWorldInitializeInput): void {
    this.services = input.services
    this.disposed = false
    this.nodeProgram = input.services.compileProgram({
      vertSrc: REACTIVE_CONSTELLATION_VERTEX_SOURCE,
      fragSrc: REACTIVE_CONSTELLATION_FRAGMENT_SOURCE,
      label: 'cinematic/world/reactiveConstellation/nodes',
      attributes: NODE_ATTRIBUTES,
      requiredUniforms: [...NODE_REQUIRED_UNIFORMS],
    })
    this.beamProgram = input.services.compileProgram({
      vertSrc: REACTIVE_CONSTELLATION_BEAM_VERTEX_SOURCE,
      fragSrc: REACTIVE_CONSTELLATION_BEAM_FRAGMENT_SOURCE,
      label: 'cinematic/world/reactiveConstellation/beams',
      attributes: BEAM_ATTRIBUTES,
      requiredUniforms: [...BEAM_REQUIRED_UNIFORMS],
    })
    for (const style of listConstellationMeshStyles()) this.meshes.set(style, this.createMeshResource(style))
    this.beamResource = this.createBeamResource()
    this.curtainResource = this.createBeamResource(CONSTELLATION_MAX_CURTAINS)
    this.diagnostic = null
  }

  resize(_viewport: CinematicViewport): void {}

  getDiagnostic(): string | null {
    return this.diagnostic
  }

  render(frame: CinematicFrameContext, target: CinematicWorldRenderTarget): void {
    if (this.disposed || !this.services || !this.nodeProgram || !this.beamProgram || !this.beamResource || !this.curtainResource) {
      this.diagnostic = 'Reactive Constellation paused because required WebGL resources are unavailable.'
      return
    }
    if (target.width <= 0 || target.height <= 0 || !Number.isFinite(target.width) || !Number.isFinite(target.height)) {
      this.diagnostic = 'Reactive Constellation paused because the render target is invalid.'
      return
    }
    this.diagnostic = null
    const settings = resolveReactiveConstellationSettings(frame.config.worldSettings)
    const budget = constellationQualityBudget(frame.config.qualityTier)
    const effectiveNodeCount = clampConstellationNodeCount(settings.nodeCount, budget)
    const configuration = this.simulation.configure({
      seed: frame.config.seed,
      nodeCount: effectiveNodeCount,
      settings,
    })
    if (configuration.rebuilt) {
      this.lastReseedBar = -1
      this.rebuildInstanceLayouts()
      this.rebuildBeamLayout(budget, frame.config.qualityTier)
    }

    const isPlaying = frame.isPlaying !== false
    const performance = this.performanceActions.update({
      event: frame.params.performanceActionEvent,
      events: frame.params.performanceActionEvents,
      toggleStates: frame.params.performanceActionToggleStates,
      deltaTimeSec: frame.deltaTimeSec,
      timingDiscontinuity: frame.timingDiscontinuity,
    })
    const composition = resolveReactiveConstellationComposition({
      settings,
      audio: frame.musicalAudio,
      modulation: frame.modulation,
      motionScale: Math.max(0, frame.params.motion),
      performanceActionEnvelopes: performance.offsets,
    })
    const next = composition.values
    // Audio and section values are already frozen upstream while paused. Applying the
    // final performance layer every frame lets a DJ release flashes and toggles safely
    // without advancing the transport-driven simulation.
    this.heldNetworkSpread = next.networkSpread
    this.heldNodeScale = next.nodeScale
    this.heldNodeSpin = next.nodeSpin
    this.heldEdgeBrightness = next.edgeBrightness
    this.heldEdgeWidth = next.edgeWidth
    this.heldTrailLength = next.trailLength
    this.heldTopologyMorph = next.topologyMorph
    this.heldCollapseForce = next.collapseForce
    this.heldBurstImpulse = next.burstImpulse
    this.heldFacetOpacity = next.facetOpacity
    this.heldInternalGlow = next.internalGlow
    this.heldRimIntensity = next.rimIntensity
    this.heldSpringStrength = next.springStrength
    this.heldMotionScale = next.motionScale
    this.heldCameraOrbit = next.cameraOrbit
    if ((this.lastTrailSamples === 0) !== (this.heldTrailLength === 0)) this.trails.reset()
    this.lastTrailSamples = this.heldTrailLength

    this.applyPendingReset()

    if (performance.reseedSequence != null) {
      this.simulation.reseed(hashSeed(frame.config.seed, performance.reseedSequence + 0x5f31))
      this.lastReseedBar = -1
      this.rebuildInstanceLayouts()
      this.rebuildBeamLayout(budget, frame.config.qualityTier)
    }

    const musicalTiming = frame.musicalAudio?.timing
    const reseedEveryBars = settings.reseedEveryBars
    const barIndex = musicalTiming?.barIndex ?? -1
    const atBarBoundary = Boolean(frame.musicalAudio?.events.barStart)
    if (
      isPlaying
      && reseedEveryBars > 0
      && atBarBoundary
      && barIndex > 0
      && barIndex % reseedEveryBars === 0
      && barIndex !== this.lastReseedBar
    ) {
      this.simulation.reseed(hashSeed(frame.config.seed, barIndex + 0x3a7))
      this.lastReseedBar = barIndex
      this.rebuildInstanceLayouts()
      this.rebuildBeamLayout(budget, frame.config.qualityTier)
    }

    const nextGeometryRotation = cinematicModulationValue(frame.modulation, 'geometryRotation')
    const nextBrightness = cinematicModulationValue(frame.modulation, 'environmentBrightness')
    const nextDepthPulse = cinematicModulationValue(frame.modulation, 'depth')
    if (isPlaying || !this.hasRendered) {
      this.heldGeometryRotation = nextGeometryRotation
      this.heldBrightness = nextBrightness
      this.heldDepthPulse = nextDepthPulse
    }

    this.simulation.update({
      deltaTimeSec: frame.deltaTimeSec,
      isPlaying: isPlaying && !performance.freeze,
      timingDiscontinuity: frame.timingDiscontinuity,
      motionScale: this.heldMotionScale,
      impact: 0,
      networkSpreadScale: this.heldNetworkSpread / Math.max(0.001, settings.networkSpread),
      nodeScaleMultiplier: this.heldNodeScale / Math.max(0.001, settings.nodeScale),
      nodeSpinOffset: this.heldNodeSpin - settings.nodeSpin,
      springTension: this.heldSpringStrength,
      collapseForce: this.heldCollapseForce,
      burstImpulse: this.heldBurstImpulse,
      topologyMorph: this.heldTopologyMorph,
    })
    const simulationState = this.simulation.getState()
    if (simulationState.structureRevision !== this.uploadedStructureRevision) this.rebuildInstanceLayouts()
    const nextBeamBudgetKey = `${frame.config.qualityTier}:${budget.edgeCountCap}:${budget.trailSampleCap}:${budget.historicalDrawCount}`
    if (
      simulationState.structureRevision !== this.beamStructureRevision
      || nextBeamBudgetKey !== this.beamBudgetKey
    ) this.rebuildBeamLayout(budget, frame.config.qualityTier)

    this.uploadSimulationInstances()
    this.updateCurrentEdgeEndpoints()
    this.buildBeamInstances(settings, budget, this.heldTrailLength)
    this.uploadBeamInstances()
    this.buildCurtainInstances(frame, settings, budget)
    this.uploadCurtainInstances()

    const gl = this.services.gl
    const requestedCamera = frame.camera?.pose ?? {
      position: { x: 0, y: 0, z: 4 },
      rotation: { x: 0, y: 0, z: 0 },
      fieldOfView: 60,
    }
    const camera = isConstellationCameraPoseSafe(requestedCamera)
      ? requestedCamera
      : {
          position: { x: 0, y: 0, z: 4 },
          rotation: { x: 0, y: 0, z: 0 },
          fieldOfView: 60,
        }
    const viewProjection = cameraViewProjectionMatrix({
      position: camera.position,
      rotation: camera.rotation,
      fieldOfView: camera.fieldOfView,
      aspect: target.width / Math.max(1, target.height),
    })
    if (!allFinite(viewProjection)) {
      this.diagnostic = 'Reactive Constellation paused because the camera frame is invalid.'
      return
    }
    if (this.heldTrailLength > 0 && !frame.timingDiscontinuity) {
      this.trails.capture({
        endpoints: this.currentEdgeEndpoints,
        deltaTimeSec: frame.deltaTimeSec,
        spacingSec: settings.trailSpacing,
        isPlaying: isPlaying && !performance.freeze,
      })
    }

    const basePalette = resolveConstellationPalette(frame.preset.palette)
    const flippedPalette = performance.paletteFlip
      ? {
          ...basePalette,
          primary: basePalette.secondary,
          secondary: basePalette.primary,
          beamCore: basePalette.beamAccent,
          beamAccent: basePalette.beamCore,
        }
      : basePalette
    const flash = Math.min(1, Math.max(0, performance.whiteFlash))
    const towardWhite = (color: { r: number; g: number; b: number }) => ({
      r: color.r + (1 - color.r) * flash,
      g: color.g + (1 - color.g) * flash,
      b: color.b + (1 - color.b) * flash,
    })
    const palette = flash > 0
      ? {
          ...flippedPalette,
          primary: towardWhite(flippedPalette.primary),
          secondary: towardWhite(flippedPalette.secondary),
          accent: towardWhite(flippedPalette.accent),
          beamCore: towardWhite(flippedPalette.beamCore),
          beamAccent: towardWhite(flippedPalette.beamAccent),
          fog: towardWhite(flippedPalette.fog),
          background: towardWhite(flippedPalette.background),
        }
      : flippedPalette
    const fogAmount = Math.min(1, Math.max(0, frame.config.environment.fog))
    const motion = this.heldMotionScale
    const materialGlow = Math.max(frame.params.glow, frame.config.material.glow)

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
    gl.clearColor(palette.background.r, palette.background.g, palette.background.b, 1)
    gl.clearDepth(1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (performance.blackout && flash <= 0.001) {
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      this.hasRendered = true
      return
    }
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    this.beamProgram.activate()
    this.beamProgram.setMat4('uViewProjection', viewProjection)
    this.beamProgram.setVec2('uViewport', target.width, target.height)
    this.beamProgram.setVec3('uCameraPosition', camera.position.x, camera.position.y, camera.position.z)
    this.beamProgram.setFloat('uTime', simulationState.simulationTimeSec)
    this.beamProgram.setFloat('uMotion', motion)
    this.beamProgram.setFloat('uCameraOrbit', this.heldCameraOrbit)
    this.beamProgram.setFloat('uGeometryRotation', this.heldGeometryRotation)
    this.beamProgram.setFloat('uDepthPulse', this.heldDepthPulse)
    this.beamProgram.setVec3('uBeamColor', palette.beamCore.r, palette.beamCore.g, palette.beamCore.b)
    this.beamProgram.setVec3('uBeamAccent', palette.beamAccent.r, palette.beamAccent.g, palette.beamAccent.b)
    this.beamProgram.setVec3('uFogColor', palette.fog.r, palette.fog.g, palette.fog.b)
    this.beamProgram.setFloat('uColorVariation', settings.colorVariation)
    this.beamProgram.setFloat('uFogAmount', fogAmount)
    this.beamProgram.setFloat('uDepthFade', settings.depthFade)
    this.beamProgram.setFloat('uBeat', Math.min(1, this.heldBurstImpulse / 2.5))
    this.beamProgram.setFloat('uBrightness', this.heldBrightness)

    // Additive background and network beams are drawn before the ordered face pass.
    // The subsequent dithered opaque coverage lets beams remain visible through
    // translucent facets without unstable per-triangle sorting.
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
    gl.depthMask(false)

    if (!performance.crystalOnly && this.curtainInstanceCount > 0 && settings.backgroundCurtains > 0) {
      this.beamProgram.setFloat('uBeamWidthPx', Math.max(0.8, this.heldEdgeWidth * 0.72))
      this.beamProgram.setFloat('uEdgeOpacity', settings.backgroundCurtains * (0.35 + frame.config.environment.atmosphere * 0.35))
      this.beamProgram.setFloat('uPassWidthScale', 2.4 + budget.glowPassComplexity * 0.8)
      this.beamProgram.setFloat('uPassBrightness', 0.42 + materialGlow * 0.3)
      this.beamProgram.setFloat('uPassSoftness', 0.82)
      gl.bindVertexArray(this.curtainResource.vao)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.curtainInstanceCount)
    }

    if (!performance.crystalOnly && this.beamInstanceCount > 0 && settings.edgeOpacity > 0) {
      this.beamProgram.setFloat('uBeamWidthPx', this.heldEdgeWidth)
      this.beamProgram.setFloat('uEdgeOpacity', settings.edgeOpacity)
      gl.bindVertexArray(this.beamResource.vao)
      if (settings.beamGlow > 0 && this.beamGlowInstanceCount > 0) {
        this.beamProgram.setFloat('uPassWidthScale', 3.2 + budget.glowPassComplexity * 1.7)
        this.beamProgram.setFloat('uPassBrightness', settings.beamGlow * (0.36 + budget.glowPassComplexity * 0.22))
        this.beamProgram.setFloat('uPassSoftness', 0.72)
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.beamGlowInstanceCount)
      }
      this.beamProgram.setFloat('uPassWidthScale', 1)
      this.beamProgram.setFloat('uPassBrightness', this.heldEdgeBrightness)
      this.beamProgram.setFloat('uPassSoftness', 0.34)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.beamInstanceCount)
    }

    this.nodeProgram.activate()
    this.nodeProgram.setMat4('uViewProjection', viewProjection)
    this.nodeProgram.setVec3('uCameraPosition', camera.position.x, camera.position.y, camera.position.z)
    this.nodeProgram.setFloat('uTime', simulationState.simulationTimeSec)
    this.nodeProgram.setFloat('uNodeScale', this.heldNodeScale)
    this.nodeProgram.setFloat('uNodeSpin', this.heldNodeSpin)
    this.nodeProgram.setFloat('uMotion', motion)
    this.nodeProgram.setFloat('uCameraOrbit', this.heldCameraOrbit)
    this.nodeProgram.setFloat('uGeometryRotation', this.heldGeometryRotation)
    this.nodeProgram.setFloat('uDepthPulse', this.heldDepthPulse)
    this.nodeProgram.setFloat('uBeat', Math.min(1, this.heldBurstImpulse / 2.5))
    this.nodeProgram.setVec3('uPrimary', palette.primary.r, palette.primary.g, palette.primary.b)
    this.nodeProgram.setVec3('uSecondary', palette.secondary.r, palette.secondary.g, palette.secondary.b)
    this.nodeProgram.setVec3('uAccent', palette.accent.r, palette.accent.g, palette.accent.b)
    this.nodeProgram.setVec3('uFogColor', palette.fog.r, palette.fog.g, palette.fog.b)
    this.nodeProgram.setFloat('uIntensity', Math.max(0, frame.params.intensity))
    this.nodeProgram.setFloat('uGlow', materialGlow)
    this.nodeProgram.setFloat('uFaceOpacity', this.heldFacetOpacity)
    this.nodeProgram.setFloat('uFacetContrast', settings.facetContrast)
    this.nodeProgram.setFloat('uInternalGlow', this.heldInternalGlow)
    this.nodeProgram.setFloat('uRimIntensity', this.heldRimIntensity)
    this.nodeProgram.setFloat('uWireframeAmount', settings.wireframeAmount)
    this.nodeProgram.setFloat('uColorVariation', settings.colorVariation)
    this.nodeProgram.setFloat('uFogAmount', fogAmount)
    this.nodeProgram.setFloat('uDepthFade', settings.depthFade)
    this.nodeProgram.setFloat('uBrightness', this.heldBrightness)

    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.disable(gl.BLEND)
    gl.depthMask(true)
    this.nodeProgram.setFloat('uPassMode', 0)
    if (!performance.edgesOnly) {
      for (const resource of this.meshes.values()) {
        if (resource.instanceCount <= 0) continue
        gl.bindVertexArray(resource.vao)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, resource.vertexCount, resource.instanceCount)
      }
    }

    if (!performance.edgesOnly && (settings.wireframeAmount > 0 || this.heldRimIntensity > 0 || this.heldInternalGlow > 0)) {
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
      gl.depthMask(false)
      this.nodeProgram.setFloat('uPassMode', 1)
      for (const resource of this.meshes.values()) {
        if (resource.instanceCount <= 0) continue
        gl.bindVertexArray(resource.vao)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, resource.vertexCount, resource.instanceCount)
      }
    }

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.BLEND)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(true)

    this.hasRendered = true
  }

  private applyPendingReset(): void {
    if (!this.pendingReset) return
    // Lifecycle resets must be observable immediately even while transport is
    // paused. Deferring here leaves stale topology/trails visible until play.
    this.simulation.resetToAnchors()
    this.trails.reset()
    this.pendingReset = null
    this.lastReseedBar = -1
  }

  reset(reason: CinematicRendererResetReason): void {
    if (reason === 'dispose') return
    this.pendingReset = reason
    this.performanceActions.reset({ preserveConsumedSequence: true })
    this.trails.reset()
    this.beamInstanceCount = 0
    this.beamGlowInstanceCount = 0
    this.curtainInstanceCount = 0
  }

  onContextLost(): void {
    this.nodeProgram = null
    this.beamProgram = null
    this.meshes.clear()
    this.instanceLayouts.clear()
    this.beamResource = null
    this.curtainResource = null
    this.curtainInstanceCount = 0
    this.uploadedStructureRevision = -1
    this.beamStructureRevision = -1
    this.beamBudgetKey = ''
    this.performanceActions.reset({ preserveConsumedSequence: true })
    this.trails.reset()
    this.pendingReset = 'contextRestored'
  }

  onContextRestored(): void {
    this.performanceActions.reset({ preserveConsumedSequence: true })
    this.trails.reset()
    this.pendingReset = 'contextRestored'
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const services = this.services
    if (services) {
      for (const resource of this.meshes.values()) this.deleteGpuResource(resource.vao, resource.buffers)
      if (this.beamResource) this.deleteGpuResource(this.beamResource.vao, this.beamResource.buffers)
      if (this.curtainResource) this.deleteGpuResource(this.curtainResource.vao, this.curtainResource.buffers)
    }
    this.meshes.clear()
    this.instanceLayouts.clear()
    this.beamResource = null
    this.curtainResource = null
    this.nodeProgram = null
    this.beamProgram = null
    this.services = null
    this.uploadedStructureRevision = -1
    this.beamStructureRevision = -1
    this.beamBudgetKey = ''
    this.pendingReset = null
    this.hasRendered = false
    this.beamEdgeIndices = new Uint16Array(0)
    this.beamEdgePalette = new Float32Array(0)
    this.currentEdgeEndpoints = new Float32Array(0)
    this.beamInstanceValues = new Float32Array(0)
    this.beamInstanceCount = 0
    this.beamGlowInstanceCount = 0
    this.curtainInstanceCount = 0
    this.diagnostic = null
    this.performanceActions.reset()
    this.trails.dispose()
  }

  private createMeshResource(style: ConstellationMeshStyle): MeshGpuResource {
    if (!this.services) throw new Error('Reactive Constellation services are unavailable')
    const gl = this.services.gl
    const mesh = getConstellationMesh(style)
    const vao = createVertexArray(gl, this.services)
    gl.bindVertexArray(vao)
    const buffers = [
      bindStaticAttribute(gl, this.services, NODE_ATTRIBUTES.aPosition, 3, mesh.positions),
      bindStaticAttribute(gl, this.services, NODE_ATTRIBUTES.aNormal, 3, mesh.normals),
      bindStaticAttribute(gl, this.services, NODE_ATTRIBUTES.aBarycentric, 3, mesh.barycentrics),
    ]
    const instanceBuffer = createBuffer(gl, this.services)
    buffers.push(instanceBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, NODE_INSTANCE_STRIDE, gl.DYNAMIC_DRAW)
    bindInstanceAttribute(gl, NODE_ATTRIBUTES.aInstancePosition, 3, NODE_INSTANCE_STRIDE, 0)
    bindInstanceAttribute(gl, NODE_ATTRIBUTES.aInstanceScale, 1, NODE_INSTANCE_STRIDE, 3)
    bindInstanceAttribute(gl, NODE_ATTRIBUTES.aInstanceRotation, 3, NODE_INSTANCE_STRIDE, 4)
    bindInstanceAttribute(gl, NODE_ATTRIBUTES.aInstanceProminence, 1, NODE_INSTANCE_STRIDE, 7)
    bindInstanceAttribute(gl, NODE_ATTRIBUTES.aInstancePalette, 1, NODE_INSTANCE_STRIDE, 8)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    return { vao, buffers, instanceBuffer, vertexCount: mesh.vertexCount, instanceCount: 0 }
  }

  private createBeamResource(instanceCapacity = 1): BeamGpuResource {
    if (!this.services) throw new Error('Reactive Constellation services are unavailable')
    const gl = this.services.gl
    const vao = createVertexArray(gl, this.services)
    gl.bindVertexArray(vao)
    const corners = new Float32Array([
      0, -1,
      0, 1,
      1, -1,
      1, 1,
    ])
    const buffers = [bindStaticAttribute(gl, this.services, BEAM_ATTRIBUTES.aCorner, 2, corners)]
    const instanceBuffer = createBuffer(gl, this.services)
    buffers.push(instanceBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    const safeCapacity = Math.max(1, Math.floor(instanceCapacity))
    gl.bufferData(gl.ARRAY_BUFFER, safeCapacity * BEAM_INSTANCE_STRIDE, gl.DYNAMIC_DRAW)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aEndpointA, 3, BEAM_INSTANCE_STRIDE, 0)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aEndpointB, 3, BEAM_INSTANCE_STRIDE, 3)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aInstanceAlpha, 1, BEAM_INSTANCE_STRIDE, 6)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aInstanceWidth, 1, BEAM_INSTANCE_STRIDE, 7)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aInstancePalette, 1, BEAM_INSTANCE_STRIDE, 8)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aInstanceAge, 1, BEAM_INSTANCE_STRIDE, 9)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    return { vao, buffers, instanceBuffer, instanceCapacity: safeCapacity }
  }

  private deleteGpuResource(vao: WebGLVertexArrayObject, buffers: readonly WebGLBuffer[]): void {
    if (!this.services) return
    const gl = this.services.gl
    this.services.resources.untrackVAO(vao)
    gl.deleteVertexArray(vao)
    for (const buffer of buffers) {
      this.services.resources.untrackBuffer(buffer)
      gl.deleteBuffer(buffer)
    }
  }

  private rebuildInstanceLayouts(): void {
    if (!this.services) return
    const state = this.simulation.getState()
    const indicesByStyle = new Map<ConstellationMeshStyle, number[]>()
    for (const style of listConstellationMeshStyles()) indicesByStyle.set(style, [])
    for (let index = 0; index < state.graph.nodes.length; index += 1) {
      indicesByStyle.get(state.graph.nodes[index].meshStyle)?.push(index)
    }

    const gl = this.services.gl
    for (const [style, resource] of this.meshes) {
      const nodeIndices = new Uint16Array(indicesByStyle.get(style) ?? [])
      const values = new Float32Array(nodeIndices.length * NODE_INSTANCE_FLOATS)
      resource.instanceCount = nodeIndices.length
      this.instanceLayouts.set(style, { nodeIndices, values })
      gl.bindBuffer(gl.ARRAY_BUFFER, resource.instanceBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, Math.max(NODE_INSTANCE_STRIDE, values.byteLength), gl.DYNAMIC_DRAW)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.uploadedStructureRevision = state.structureRevision
  }

  private rebuildBeamLayout(budget: ConstellationQualityBudget, qualityTier: string): void {
    if (!this.services || !this.beamResource) return
    const state = this.simulation.getState()
    const edgeCount = clampConstellationEdgeCount(state.graph.edges.length, budget)
    this.beamEdgeIndices = new Uint16Array(edgeCount)
    this.beamEdgePalette = new Float32Array(edgeCount)
    this.currentEdgeEndpoints = new Float32Array(edgeCount * CONSTELLATION_BEAM_ENDPOINT_FLOATS)

    for (let index = 0; index < edgeCount; index += 1) {
      const graphEdgeIndex = edgeCount === state.graph.edges.length
        ? index
        : Math.min(state.graph.edges.length - 1, Math.floor((index + 0.5) * state.graph.edges.length / edgeCount))
      this.beamEdgeIndices[index] = graphEdgeIndex
      const edge = state.graph.edges[graphEdgeIndex]
      this.beamEdgePalette[index] = edge
        ? (state.graph.nodes[edge.a].paletteMix + state.graph.nodes[edge.b].paletteMix) * 0.5
        : 0
    }

    const maximumInstances = Math.max(1, edgeCount * (1 + budget.historicalDrawCount))
    this.beamInstanceValues = new Float32Array(maximumInstances * CONSTELLATION_BEAM_INSTANCE_FLOATS)
    this.beamResource.instanceCapacity = maximumInstances
    const gl = this.services.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamResource.instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, Math.max(BEAM_INSTANCE_STRIDE, this.beamInstanceValues.byteLength), gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    this.trails.configure({
      edgeCount,
      sampleCapacity: budget.trailSampleCap,
      topologyRevision: state.structureRevision,
    })
    this.beamInstanceCount = 0
    this.beamGlowInstanceCount = 0
    this.beamStructureRevision = state.structureRevision
    this.beamBudgetKey = `${qualityTier}:${budget.edgeCountCap}:${budget.trailSampleCap}:${budget.historicalDrawCount}`
  }

  private uploadSimulationInstances(): void {
    if (!this.services) return
    const state = this.simulation.getState()
    const alpha = state.interpolationAlpha
    const gl = this.services.gl
    for (const [style, resource] of this.meshes) {
      const layout = this.instanceLayouts.get(style)
      if (!layout || layout.nodeIndices.length === 0) {
        resource.instanceCount = 0
        continue
      }
      for (let instance = 0; instance < layout.nodeIndices.length; instance += 1) {
        const nodeIndex = layout.nodeIndices[instance]
        const node = state.graph.nodes[nodeIndex]
        const sourceOffset = nodeIndex * 3
        const targetOffset = instance * NODE_INSTANCE_FLOATS
        layout.values[targetOffset] = state.previousPositions[sourceOffset] + (
          state.positions[sourceOffset] - state.previousPositions[sourceOffset]
        ) * alpha
        layout.values[targetOffset + 1] = state.previousPositions[sourceOffset + 1] + (
          state.positions[sourceOffset + 1] - state.previousPositions[sourceOffset + 1]
        ) * alpha
        layout.values[targetOffset + 2] = state.previousPositions[sourceOffset + 2] + (
          state.positions[sourceOffset + 2] - state.previousPositions[sourceOffset + 2]
        ) * alpha
        layout.values[targetOffset + 3] = state.scaleVariations[nodeIndex]
        layout.values[targetOffset + 4] = state.rotations[sourceOffset]
        layout.values[targetOffset + 5] = state.rotations[sourceOffset + 1]
        layout.values[targetOffset + 6] = state.rotations[sourceOffset + 2]
        layout.values[targetOffset + 7] = node.prominence
        layout.values[targetOffset + 8] = node.paletteMix
      }
      resource.instanceCount = layout.nodeIndices.length
      gl.bindBuffer(gl.ARRAY_BUFFER, resource.instanceBuffer)
      if (typeof gl.bufferSubData === 'function') {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, layout.values)
      } else {
        gl.bufferData(gl.ARRAY_BUFFER, layout.values, gl.DYNAMIC_DRAW)
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
  }

  private updateCurrentEdgeEndpoints(): void {
    const state = this.simulation.getState()
    const alpha = state.interpolationAlpha
    for (let index = 0; index < this.beamEdgeIndices.length; index += 1) {
      const edge = state.graph.edges[this.beamEdgeIndices[index]]
      const target = index * CONSTELLATION_BEAM_ENDPOINT_FLOATS
      if (!edge) {
        this.currentEdgeEndpoints.fill(0, target, target + CONSTELLATION_BEAM_ENDPOINT_FLOATS)
        continue
      }
      const a = edge.a * 3
      const b = edge.b * 3
      this.currentEdgeEndpoints[target] = state.previousPositions[a] + (state.positions[a] - state.previousPositions[a]) * alpha
      this.currentEdgeEndpoints[target + 1] = state.previousPositions[a + 1] + (state.positions[a + 1] - state.previousPositions[a + 1]) * alpha
      this.currentEdgeEndpoints[target + 2] = state.previousPositions[a + 2] + (state.positions[a + 2] - state.previousPositions[a + 2]) * alpha
      this.currentEdgeEndpoints[target + 3] = state.previousPositions[b] + (state.positions[b] - state.previousPositions[b]) * alpha
      this.currentEdgeEndpoints[target + 4] = state.previousPositions[b + 1] + (state.positions[b + 1] - state.previousPositions[b + 1]) * alpha
      this.currentEdgeEndpoints[target + 5] = state.previousPositions[b + 2] + (state.positions[b + 2] - state.previousPositions[b + 2]) * alpha
    }
  }

  private buildBeamInstances(
    settings: ReactiveConstellationSettings,
    budget: ConstellationQualityBudget,
    trailLength: number,
  ): void {
    let instanceCount = 0
    const edgeCount = this.beamEdgeIndices.length
    for (let edge = 0; edge < edgeCount; edge += 1) {
      const endpointOffset = edge * CONSTELLATION_BEAM_ENDPOINT_FLOATS
      if (writeConstellationBeamInstance(
        this.beamInstanceValues,
        instanceCount * CONSTELLATION_BEAM_INSTANCE_FLOATS,
        this.currentEdgeEndpoints,
        endpointOffset,
        this.currentEdgeEndpoints,
        endpointOffset,
        1,
        1,
        1,
        this.beamEdgePalette[edge],
        0,
      )) instanceCount += 1
    }
    let glowInstanceCount = instanceCount

    const requestedHistory = clampConstellationTrailSamples(trailLength, budget)
    const historyCount = Math.min(
      this.trails.getSampleCount(),
      requestedHistory,
      budget.historicalDrawCount,
    )
    const glowHistoryCount = Math.min(
      historyCount,
      Math.max(0, Math.ceil(historyCount * Math.min(1, budget.glowPassComplexity))),
    )
    const storage = this.trails.getStorage()
    for (let age = 0; age < historyCount; age += 1) {
      const sampleOffset = this.trails.getSampleOffset(age)
      if (sampleOffset < 0) continue
      const normalizedAge = (age + 1) / Math.max(1, historyCount)
      const alpha = constellationTrailAgeWeight(age + 1, settings.trailDecay)
      const widthScale = Math.max(0.24, 1 - normalizedAge * 0.68)
      for (let edge = 0; edge < edgeCount; edge += 1) {
        const endpointOffset = edge * CONSTELLATION_BEAM_ENDPOINT_FLOATS
        if (writeConstellationBeamInstance(
          this.beamInstanceValues,
          instanceCount * CONSTELLATION_BEAM_INSTANCE_FLOATS,
          storage,
          sampleOffset + endpointOffset,
          this.currentEdgeEndpoints,
          endpointOffset,
          settings.beamFanAmount,
          alpha,
          widthScale,
          this.beamEdgePalette[edge],
          normalizedAge,
        )) instanceCount += 1
      }
      if (age < glowHistoryCount) glowInstanceCount = instanceCount
    }

    this.beamInstanceCount = instanceCount
    this.beamGlowInstanceCount = Math.min(glowInstanceCount, instanceCount)
  }

  private uploadBeamInstances(): void {
    if (!this.services || !this.beamResource || this.beamInstanceCount <= 0) return
    const gl = this.services.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamResource.instanceBuffer)
    if (typeof gl.bufferSubData === 'function') {
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.beamInstanceValues,
        0,
        this.beamInstanceCount * CONSTELLATION_BEAM_INSTANCE_FLOATS,
      )
    } else {
      gl.bufferData(gl.ARRAY_BUFFER, this.beamInstanceValues, gl.DYNAMIC_DRAW)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
  }

  private buildCurtainInstances(
    frame: CinematicFrameContext,
    settings: ReactiveConstellationSettings,
    budget: ConstellationQualityBudget,
  ): void {
    const requestedCount = Math.min(settings.curtainDensity, budget.curtainCountCap)
    this.curtainInstanceCount = writeConstellationCurtainInstances(this.curtainInstanceValues, {
      seed: frame.config.seed,
      count: requestedCount,
      spread: this.heldNetworkSpread,
      depthSpread: settings.depthSpread,
      timeSec: this.simulation.getState().simulationTimeSec,
      intensity: settings.backgroundCurtains,
    })
  }

  private uploadCurtainInstances(): void {
    if (!this.services || !this.curtainResource || this.curtainInstanceCount <= 0) return
    const gl = this.services.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.curtainResource.instanceBuffer)
    if (typeof gl.bufferSubData === 'function') {
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.curtainInstanceValues,
        0,
        this.curtainInstanceCount * CONSTELLATION_BEAM_INSTANCE_FLOATS,
      )
    } else {
      gl.bufferData(gl.ARRAY_BUFFER, this.curtainInstanceValues, gl.DYNAMIC_DRAW)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
  }
}

const reactiveConstellationDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked', 'dolly', 'orbit', 'handheld', 'autoDirector'],
  safeCameraRange: REACTIVE_CONSTELLATION_SAFE_CAMERA_RANGE,
  shots: REACTIVE_CONSTELLATION_SHOTS,
  dropActions: ['impact', 'reveal', 'open'],
  revealActions: ['reveal', 'open'],
  retreatActions: ['retreat', 'close'],
})

export const reactiveConstellationWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'reactiveConstellation',
  label: 'Reactive Constellation',
  backend: 'webgl2',
  direction: reactiveConstellationDirection,
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'dolly', 'orbit', 'handheld', 'autoDirector'],
    modulationTargets: ['networkSpread', 'nodeScale', 'nodeSpin', 'edgeBrightness', 'edgeWidth', 'trailLength', 'topologyMorph', 'collapseForce', 'burstImpulse', 'facetOpacity', 'depth', 'geometryRotation', 'environmentBrightness', 'cameraPunch', 'bloom', 'impact'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: false,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new ReactiveConstellationWorld(),
}
