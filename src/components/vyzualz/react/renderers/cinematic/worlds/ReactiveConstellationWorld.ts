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
import { getConstellationMesh, listConstellationMeshStyles } from './reactiveConstellation/ConstellationMeshLibrary'
import {
  clampConstellationEdgeCount,
  clampConstellationNodeCount,
  clampConstellationTrailSamples,
  constellationQualityBudget,
  type ConstellationQualityBudget,
} from './reactiveConstellation/ConstellationQuality'
import { ConstellationSimulation } from './reactiveConstellation/ConstellationSimulation'
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

interface RgbColor {
  r: number
  g: number
  b: number
}

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
  'uAccent', 'uIntensity', 'uGlow', 'uFaceOpacity', 'uRimIntensity', 'uWireframeAmount',
  'uBrightness',
] as const
const BEAM_REQUIRED_UNIFORMS = [
  'uViewProjection', 'uViewport', 'uBeamWidthPx', 'uPassWidthScale', 'uTime', 'uMotion',
  'uCameraOrbit', 'uGeometryRotation', 'uDepthPulse', 'uBeamColor', 'uBeamAccent',
  'uEdgeOpacity', 'uPassBrightness', 'uPassSoftness', 'uBeat', 'uBrightness',
] as const

function parseHexColor(value: string, fallback: RgbColor): RgbColor {
  const normalized = value.trim().replace(/^#/, '')
  const expanded = normalized.length === 3
    ? normalized.split('').map(character => `${character}${character}`).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return fallback
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16) / 255,
    g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
    b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
  }
}

function hotBeamColor(primary: RgbColor, secondary: RgbColor, accent: RgbColor): RgbColor {
  return {
    r: Math.max(0.92, primary.r, secondary.r * 0.9, accent.r),
    g: Math.min(0.22, 0.025 + primary.g * 0.08 + accent.g * 0.05),
    b: Math.max(0.18, primary.b * 0.5, secondary.b * 0.82, accent.b * 0.45),
  }
}

function magentaBeamColor(secondary: RgbColor, accent: RgbColor): RgbColor {
  return {
    r: Math.max(0.94, secondary.r, accent.r),
    g: Math.min(0.16, 0.015 + secondary.g * 0.06),
    b: Math.max(0.58, secondary.b, accent.b * 0.82),
  }
}

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

export class ReactiveConstellationWorld implements CinematicWebGLWorldRenderer {
  private services: CinematicWebGLServices | null = null
  private nodeProgram: ShaderProgram | null = null
  private beamProgram: ShaderProgram | null = null
  private readonly meshes = new Map<ConstellationMeshStyle, MeshGpuResource>()
  private readonly instanceLayouts = new Map<ConstellationMeshStyle, MeshInstanceLayout>()
  private beamResource: BeamGpuResource | null = null
  private readonly simulation = new ConstellationSimulation()
  private readonly trails = new ConstellationTrailBuffer()
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
  private heldImpact = 0
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
  }

  resize(_viewport: CinematicViewport): void {}

  render(frame: CinematicFrameContext, target: CinematicWorldRenderTarget): void {
    if (this.disposed || !this.services || !this.nodeProgram || !this.beamProgram || !this.beamResource) return
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

    if ((this.lastTrailSamples === 0) !== (settings.trailSamples === 0)) this.trails.reset()
    this.lastTrailSamples = settings.trailSamples

    const isPlaying = frame.isPlaying !== false
    if (this.pendingReset) {
      if (isPlaying || !this.hasRendered) {
        this.simulation.resetToAnchors()
        this.pendingReset = null
        this.lastReseedBar = -1
      }
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
    const nextImpact = Math.max(cinematicModulationValue(frame.modulation, 'impact'), frame.beat.hit ? 1 : 0)
    if (isPlaying || !this.hasRendered) {
      this.heldGeometryRotation = nextGeometryRotation
      this.heldBrightness = nextBrightness
      this.heldDepthPulse = nextDepthPulse
      this.heldImpact = nextImpact
    }

    this.simulation.update({
      deltaTimeSec: frame.deltaTimeSec,
      isPlaying,
      timingDiscontinuity: frame.timingDiscontinuity,
      motionScale: Math.max(0, frame.params.motion),
      impact: this.heldImpact,
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
    this.buildBeamInstances(settings, budget)
    this.uploadBeamInstances()

    const gl = this.services.gl
    const camera = frame.camera?.pose ?? {
      position: { x: 0, y: 0, z: 2.4 },
      rotation: { x: 0, y: 0, z: 0 },
      fieldOfView: 58,
    }
    const viewProjection = cameraViewProjectionMatrix({
      position: camera.position,
      rotation: camera.rotation,
      fieldOfView: camera.fieldOfView,
      aspect: target.width / Math.max(1, target.height),
    })
    const primary = parseHexColor(frame.preset.palette.primary, { r: 0.15, g: 0.82, b: 0.92 })
    const secondary = parseHexColor(frame.preset.palette.secondary, { r: 0.45, g: 0.22, b: 0.92 })
    const accent = parseHexColor(frame.preset.palette.accent, { r: 1, g: 0.72, b: 0.26 })
    const background = parseHexColor(frame.preset.palette.background, { r: 0.004, g: 0.012, b: 0.025 })
    const beamColor = hotBeamColor(primary, secondary, accent)
    const beamAccent = magentaBeamColor(secondary, accent)

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
    gl.clearColor(background.r, background.g, background.b, 1)
    gl.clearDepth(1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    this.nodeProgram.activate()
    this.nodeProgram.setMat4('uViewProjection', viewProjection)
    this.nodeProgram.setVec3('uCameraPosition', camera.position.x, camera.position.y, camera.position.z)
    this.nodeProgram.setFloat('uTime', simulationState.simulationTimeSec)
    this.nodeProgram.setFloat('uNodeScale', settings.nodeScale)
    this.nodeProgram.setFloat('uNodeSpin', 0)
    this.nodeProgram.setFloat('uMotion', Math.max(0, frame.params.motion))
    this.nodeProgram.setFloat('uCameraOrbit', settings.cameraOrbit)
    this.nodeProgram.setFloat('uGeometryRotation', this.heldGeometryRotation)
    this.nodeProgram.setFloat('uDepthPulse', this.heldDepthPulse)
    this.nodeProgram.setFloat('uBeat', this.heldImpact)
    this.nodeProgram.setVec3('uPrimary', primary.r, primary.g, primary.b)
    this.nodeProgram.setVec3('uSecondary', secondary.r, secondary.g, secondary.b)
    this.nodeProgram.setVec3('uAccent', accent.r, accent.g, accent.b)
    this.nodeProgram.setFloat('uIntensity', Math.max(0, frame.params.intensity))
    this.nodeProgram.setFloat('uGlow', Math.max(frame.params.glow, frame.config.material.glow))
    this.nodeProgram.setFloat('uFaceOpacity', settings.faceOpacity)
    this.nodeProgram.setFloat('uRimIntensity', settings.rimIntensity)
    this.nodeProgram.setFloat('uWireframeAmount', settings.wireframeAmount)
    this.nodeProgram.setFloat('uBrightness', this.heldBrightness)

    for (const resource of this.meshes.values()) {
      if (resource.instanceCount <= 0) continue
      gl.bindVertexArray(resource.vao)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, resource.vertexCount, resource.instanceCount)
    }

    if (this.beamInstanceCount > 0 && settings.edgeOpacity > 0) {
      gl.disable(gl.CULL_FACE)
      gl.depthMask(false)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
      this.beamProgram.activate()
      this.beamProgram.setMat4('uViewProjection', viewProjection)
      this.beamProgram.setVec2('uViewport', target.width, target.height)
      this.beamProgram.setFloat('uBeamWidthPx', settings.beamWidth)
      this.beamProgram.setFloat('uTime', simulationState.simulationTimeSec)
      this.beamProgram.setFloat('uMotion', Math.max(0, frame.params.motion))
      this.beamProgram.setFloat('uCameraOrbit', settings.cameraOrbit)
      this.beamProgram.setFloat('uGeometryRotation', this.heldGeometryRotation)
      this.beamProgram.setFloat('uDepthPulse', this.heldDepthPulse)
      this.beamProgram.setVec3('uBeamColor', beamColor.r, beamColor.g, beamColor.b)
      this.beamProgram.setVec3('uBeamAccent', beamAccent.r, beamAccent.g, beamAccent.b)
      this.beamProgram.setFloat('uEdgeOpacity', settings.edgeOpacity)
      this.beamProgram.setFloat('uBeat', this.heldImpact)
      this.beamProgram.setFloat('uBrightness', this.heldBrightness)
      gl.bindVertexArray(this.beamResource.vao)

      if (settings.beamGlow > 0 && this.beamGlowInstanceCount > 0) {
        this.beamProgram.setFloat('uPassWidthScale', 3.2 + budget.glowPassComplexity * 1.7)
        this.beamProgram.setFloat('uPassBrightness', settings.beamGlow * (0.36 + budget.glowPassComplexity * 0.22))
        this.beamProgram.setFloat('uPassSoftness', 0.72)
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.beamGlowInstanceCount)
      }

      this.beamProgram.setFloat('uPassWidthScale', 1)
      this.beamProgram.setFloat('uPassBrightness', settings.beamCoreBrightness)
      this.beamProgram.setFloat('uPassSoftness', 0.34)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.beamInstanceCount)
    }

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.BLEND)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(true)

    if (settings.trailSamples > 0 && !frame.timingDiscontinuity) {
      this.trails.capture({
        endpoints: this.currentEdgeEndpoints,
        deltaTimeSec: frame.deltaTimeSec,
        spacingSec: settings.trailSpacing,
        isPlaying,
      })
    }
    this.hasRendered = true
  }

  reset(reason: CinematicRendererResetReason): void {
    if (reason === 'dispose') return
    this.pendingReset = reason
    this.trails.reset()
    this.beamInstanceCount = 0
    this.beamGlowInstanceCount = 0
  }

  onContextLost(): void {
    this.nodeProgram = null
    this.beamProgram = null
    this.meshes.clear()
    this.instanceLayouts.clear()
    this.beamResource = null
    this.uploadedStructureRevision = -1
    this.beamStructureRevision = -1
    this.beamBudgetKey = ''
    this.trails.reset()
    this.pendingReset = 'contextRestored'
  }

  onContextRestored(): void {
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
    }
    this.meshes.clear()
    this.instanceLayouts.clear()
    this.beamResource = null
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

  private createBeamResource(): BeamGpuResource {
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
    gl.bufferData(gl.ARRAY_BUFFER, BEAM_INSTANCE_STRIDE, gl.DYNAMIC_DRAW)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aEndpointA, 3, BEAM_INSTANCE_STRIDE, 0)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aEndpointB, 3, BEAM_INSTANCE_STRIDE, 3)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aInstanceAlpha, 1, BEAM_INSTANCE_STRIDE, 6)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aInstanceWidth, 1, BEAM_INSTANCE_STRIDE, 7)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aInstancePalette, 1, BEAM_INSTANCE_STRIDE, 8)
    bindInstanceAttribute(gl, BEAM_ATTRIBUTES.aInstanceAge, 1, BEAM_INSTANCE_STRIDE, 9)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    return { vao, buffers, instanceBuffer, instanceCapacity: 1 }
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

  private buildBeamInstances(settings: ReactiveConstellationSettings, budget: ConstellationQualityBudget): void {
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

    const requestedHistory = clampConstellationTrailSamples(settings.trailSamples, budget)
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
}

const reactiveConstellationDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked', 'dolly', 'orbit', 'handheld', 'autoDirector'],
  safeCameraRange: { minDistance: 1.15, maxDistance: 6.2, maxLateral: 1.8, minElevation: -1.1, maxElevation: 1.7 },
  shots: [
    { id: 'constellation-establish', rig: 'locked', sections: ['intro', 'breakdown', 'outro'], action: 'establish', pose: { position: { z: 4.1 }, fieldOfView: 66 } },
    { id: 'constellation-drift', rig: 'orbit', sections: ['verse', 'bridge'], action: 'orbit', weight: 1.3 },
    { id: 'constellation-approach', rig: 'dolly', sections: ['build'], action: 'approach', pose: { position: { z: 2.5 }, fieldOfView: 56 } },
    { id: 'constellation-focus', rig: 'locked', sections: ['preDrop'], action: 'focus', pose: { position: { z: 2.05 }, fieldOfView: 48 } },
    { id: 'constellation-reveal', rig: 'orbit', sections: ['drop'], action: 'reveal', pose: { position: { z: 3.0 }, fieldOfView: 68 }, minimumDurationSec: 4 },
    { id: 'constellation-fallback', rig: 'locked', sections: ['unknown'], action: 'hold', pose: { position: { z: 3.4 } } },
  ],
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
    modulationTargets: ['depth', 'geometryRotation', 'environmentBrightness', 'bloom', 'impact'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: false,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new ReactiveConstellationWorld(),
}
