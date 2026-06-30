import {
  cinematicQualityProfile,
  resolveReactiveConstellationSettings,
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
import type { ConstellationMeshStyle } from './reactiveConstellation/ConstellationGraphBuilder'
import { cameraViewProjectionMatrix, hashSeed } from './reactiveConstellation/ConstellationMath'
import { getConstellationMesh, listConstellationMeshStyles } from './reactiveConstellation/ConstellationMeshLibrary'
import { ConstellationSimulation } from './reactiveConstellation/ConstellationSimulation'
import {
  REACTIVE_CONSTELLATION_FRAGMENT_SOURCE,
  REACTIVE_CONSTELLATION_VERTEX_SOURCE,
} from './reactiveConstellation/ConstellationShaders'

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

interface MeshInstanceLayout {
  nodeIndices: Uint16Array
  values: Float32Array
}

const INSTANCE_FLOATS = 9
const INSTANCE_STRIDE = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT
const ATTRIBUTES = {
  aPosition: 0,
  aNormal: 1,
  aBarycentric: 2,
  aInstancePosition: 3,
  aInstanceScale: 4,
  aInstanceRotation: 5,
  aInstanceProminence: 6,
  aInstancePalette: 7,
} as const

const REQUIRED_UNIFORMS = [
  'uViewProjection', 'uCameraPosition', 'uTime', 'uNodeScale', 'uNodeSpin', 'uMotion',
  'uCameraOrbit', 'uGeometryRotation', 'uDepthPulse', 'uBeat', 'uPrimary', 'uSecondary',
  'uAccent', 'uIntensity', 'uGlow', 'uFaceOpacity', 'uRimIntensity', 'uWireframeAmount',
  'uBrightness',
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
  data: Float32Array,
): WebGLBuffer {
  const buffer = createBuffer(gl, services)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0)
  return buffer
}

function bindInstanceAttribute(
  gl: WebGL2RenderingContext,
  location: number,
  size: number,
  offsetFloats: number,
): void {
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(
    location,
    size,
    gl.FLOAT,
    false,
    INSTANCE_STRIDE,
    offsetFloats * Float32Array.BYTES_PER_ELEMENT,
  )
  gl.vertexAttribDivisor(location, 1)
}

class ReactiveConstellationWorld implements CinematicWebGLWorldRenderer {
  private services: CinematicWebGLServices | null = null
  private program: ShaderProgram | null = null
  private readonly meshes = new Map<ConstellationMeshStyle, MeshGpuResource>()
  private readonly instanceLayouts = new Map<ConstellationMeshStyle, MeshInstanceLayout>()
  private readonly simulation = new ConstellationSimulation()
  private uploadedStructureRevision = -1
  private pendingReset: CinematicRendererResetReason | null = null
  private lastReseedBar = -1
  private hasRendered = false
  private heldGeometryRotation = 0
  private heldBrightness = 0
  private heldDepthPulse = 0
  private heldImpact = 0
  private disposed = false

  initialize(input: CinematicWebGLWorldInitializeInput): void {
    this.services = input.services
    this.disposed = false
    this.program = input.services.compileProgram({
      vertSrc: REACTIVE_CONSTELLATION_VERTEX_SOURCE,
      fragSrc: REACTIVE_CONSTELLATION_FRAGMENT_SOURCE,
      label: 'cinematic/world/reactiveConstellation',
      attributes: ATTRIBUTES,
      requiredUniforms: [...REQUIRED_UNIFORMS],
    })
    for (const style of listConstellationMeshStyles()) this.meshes.set(style, this.createMeshResource(style))
  }

  resize(_viewport: CinematicViewport): void {}

  render(frame: CinematicFrameContext, target: CinematicWorldRenderTarget): void {
    if (this.disposed || !this.services || !this.program) return
    const settings = resolveReactiveConstellationSettings(frame.config.worldSettings)
    const quality = cinematicQualityProfile(frame.config.qualityTier)
    const effectiveNodeCount = Math.max(8, Math.min(settings.nodeCount, Math.round(settings.nodeCount * quality.geometryScale)))
    const configuration = this.simulation.configure({
      seed: frame.config.seed,
      nodeCount: effectiveNodeCount,
      settings,
    })
    if (configuration.rebuilt) {
      this.lastReseedBar = -1
      this.rebuildInstanceLayouts()
    }

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
      isPlaying &&
      reseedEveryBars > 0 &&
      atBarBoundary &&
      barIndex > 0 &&
      barIndex % reseedEveryBars === 0 &&
      barIndex !== this.lastReseedBar
    ) {
      this.simulation.reseed(hashSeed(frame.config.seed, barIndex + 0x3a7))
      this.lastReseedBar = barIndex
      this.rebuildInstanceLayouts()
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
    this.uploadSimulationInstances()

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

    this.program.activate()
    this.program.setMat4('uViewProjection', viewProjection)
    this.program.setVec3('uCameraPosition', camera.position.x, camera.position.y, camera.position.z)
    this.program.setFloat('uTime', simulationState.simulationTimeSec)
    this.program.setFloat('uNodeScale', settings.nodeScale)
    this.program.setFloat('uNodeSpin', 0)
    this.program.setFloat('uMotion', Math.max(0, frame.params.motion))
    this.program.setFloat('uCameraOrbit', settings.cameraOrbit)
    this.program.setFloat('uGeometryRotation', this.heldGeometryRotation)
    this.program.setFloat('uDepthPulse', this.heldDepthPulse)
    this.program.setFloat('uBeat', this.heldImpact)
    this.program.setVec3('uPrimary', primary.r, primary.g, primary.b)
    this.program.setVec3('uSecondary', secondary.r, secondary.g, secondary.b)
    this.program.setVec3('uAccent', accent.r, accent.g, accent.b)
    this.program.setFloat('uIntensity', Math.max(0, frame.params.intensity))
    this.program.setFloat('uGlow', Math.max(frame.params.glow, frame.config.material.glow))
    this.program.setFloat('uFaceOpacity', settings.faceOpacity)
    this.program.setFloat('uRimIntensity', settings.rimIntensity)
    this.program.setFloat('uWireframeAmount', settings.wireframeAmount)
    this.program.setFloat('uBrightness', this.heldBrightness)

    for (const resource of this.meshes.values()) {
      if (resource.instanceCount <= 0) continue
      gl.bindVertexArray(resource.vao)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, resource.vertexCount, resource.instanceCount)
    }

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.disable(gl.BLEND)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(true)
    this.hasRendered = true
  }

  reset(reason: CinematicRendererResetReason): void {
    if (reason === 'dispose') return
    this.pendingReset = reason
  }

  onContextLost(): void {
    this.program = null
    this.meshes.clear()
    this.instanceLayouts.clear()
    this.uploadedStructureRevision = -1
    this.pendingReset = 'contextRestored'
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const services = this.services
    if (services) {
      const gl = services.gl
      for (const resource of this.meshes.values()) {
        services.resources.untrackVAO(resource.vao)
        gl.deleteVertexArray(resource.vao)
        for (const buffer of resource.buffers) {
          services.resources.untrackBuffer(buffer)
          gl.deleteBuffer(buffer)
        }
      }
    }
    this.meshes.clear()
    this.instanceLayouts.clear()
    this.program = null
    this.services = null
    this.uploadedStructureRevision = -1
    this.pendingReset = null
    this.hasRendered = false
  }

  private createMeshResource(style: ConstellationMeshStyle): MeshGpuResource {
    if (!this.services) throw new Error('Reactive Constellation services are unavailable')
    const gl = this.services.gl
    const mesh = getConstellationMesh(style)
    const vao = createVertexArray(gl, this.services)
    gl.bindVertexArray(vao)
    const buffers = [
      bindStaticAttribute(gl, this.services, ATTRIBUTES.aPosition, mesh.positions),
      bindStaticAttribute(gl, this.services, ATTRIBUTES.aNormal, mesh.normals),
      bindStaticAttribute(gl, this.services, ATTRIBUTES.aBarycentric, mesh.barycentrics),
    ]
    const instanceBuffer = createBuffer(gl, this.services)
    buffers.push(instanceBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, INSTANCE_STRIDE, gl.DYNAMIC_DRAW)
    bindInstanceAttribute(gl, ATTRIBUTES.aInstancePosition, 3, 0)
    bindInstanceAttribute(gl, ATTRIBUTES.aInstanceScale, 1, 3)
    bindInstanceAttribute(gl, ATTRIBUTES.aInstanceRotation, 3, 4)
    bindInstanceAttribute(gl, ATTRIBUTES.aInstanceProminence, 1, 7)
    bindInstanceAttribute(gl, ATTRIBUTES.aInstancePalette, 1, 8)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    return { vao, buffers, instanceBuffer, vertexCount: mesh.vertexCount, instanceCount: 0 }
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
      const values = new Float32Array(nodeIndices.length * INSTANCE_FLOATS)
      resource.instanceCount = nodeIndices.length
      this.instanceLayouts.set(style, { nodeIndices, values })
      gl.bindBuffer(gl.ARRAY_BUFFER, resource.instanceBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, Math.max(INSTANCE_STRIDE, values.byteLength), gl.DYNAMIC_DRAW)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.uploadedStructureRevision = state.structureRevision
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
        const targetOffset = instance * INSTANCE_FLOATS
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
