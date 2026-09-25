import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleRenderPassProvider } from '../modules/Cinema2ModuleContracts'
import type { Cinema2CameraFrame } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2LightingEnvironmentFrame, Cinema2ResolvedLightFrame } from '../spatial/Cinema2LightingEnvironmentRuntime'
import {
  dotVectors,
  lightBasis,
  multiplyMatrices,
  normalizeVector,
  orthographicMatrix,
  perspectiveMatrix,
  viewMatrixFromBasis,
} from '../spatial/Cinema2LightMatrices'
import { assertCinema2NoGlErrors } from './Cinema2GpuValidation'

/** Everything a consumer needs to sample the shadow map. The texture uses hardware depth comparison (`sampler2DShadow`). */
export interface Cinema2ShadowFrame {
  lightId: string
  texture: WebGLTexture
  /** World -> shadow-map clip space (column-major, float32 for upload). */
  viewProjection: Float32Array
  resolution: number
  /** Depth range in world units (near to far along the light), so a world-unit bias converts to a depth offset. */
  depthRange: number
  /** World-unit depth bias, filter radius in texels, and the size of one texel in world units (directional lights). */
  bias: number
  softness: number
  texelWorldSize: number
}

export interface Cinema2ShadowServiceSnapshot {
  disposed: boolean
  /** True when the current preset authors a shadow-casting light and this tier has a map for it. */
  active: boolean
  lightId: string | null
  resolution: number
  estimatedGpuBytes: number
  renderCount: number
  reuseCount: number
  lastCasterCount: number
  lastDiagnostic: string | null
}

interface ShadowMapResources {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  resolution: number
}

export interface Cinema2ShadowUpdateInput {
  frame: Readonly<Cinema2ModuleFrameReadContext>
  camera: Readonly<Cinema2CameraFrame> | undefined
  lighting: Readonly<Cinema2LightingEnvironmentFrame> | undefined
  providers: readonly Readonly<Cinema2ModuleRenderPassProvider>[]
}

/** Shadow map resolution per quality tier; the low tier renders no shadows at all. */
export const CINEMA2_SHADOW_RESOLUTIONS: Readonly<Record<Cinema2RenderQualityLevel, number>> = Object.freeze({ low: 0, medium: 1024, high: 2048 })
const DEPTH_BYTES_PER_TEXEL = 4

/**
 * Engine-owned shadow map for ONE light per preset (the first light authored with `config.castShadow`, directional or spot).
 * Modules opt in as casters (`renderShadow`), effects and modules sample `getFrame()`. The service owns the depth texture and its
 * framebuffer, budgets them by quality tier, refreshes the map only when the light matrix changes or a caster is dynamic, and drops
 * everything on context loss.
 */
export class Cinema2ShadowService {
  private resources: ShadowMapResources | null = null
  private current: Readonly<Cinema2ShadowFrame> | null = null
  private lastMatrixKey = ''
  private lastCasterCount = 0
  private renderCount = 0
  private reuseCount = 0
  private lastDiagnostic: string | null = null
  private contextAvailable = true
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, private quality: Cinema2RenderQualityLevel) {}

  setQuality(quality: Cinema2RenderQualityLevel): void {
    if (quality === this.quality) return
    this.quality = quality
    this.releaseResources()
  }

  /** The frame's shadow map, or null when there is no shadow-casting light, no casters or this tier has no map. */
  getFrame(): Readonly<Cinema2ShadowFrame> | null {
    return this.disposed ? null : this.current
  }

  update(input: Readonly<Cinema2ShadowUpdateInput>): void {
    this.current = null
    if (this.disposed || !this.contextAvailable) return
    const resolution = CINEMA2_SHADOW_RESOLUTIONS[this.quality]
    const light = input.lighting?.lights.find(candidate => candidate.shadow != null && candidate.intensity > 0) ?? null
    const casters = input.providers.filter(provider => provider.intent === 'world' && typeof provider.renderShadow === 'function')
    if (resolution <= 0 || !light || !input.camera || casters.length === 0) {
      if (resolution <= 0 || !light || casters.length === 0) this.releaseResources()
      this.lastCasterCount = 0
      return
    }

    const fit = fitLight(light, input.camera, resolution)
    if (!fit) return
    const resources = this.ensureResources(resolution)
    if (!resources) return

    const matrixKey = fit.viewProjection.map(value => value.toFixed(6)).join(',')
    const dynamic = casters.some(provider => provider.dynamicShadowCaster === true)
    if (dynamic || matrixKey !== this.lastMatrixKey) {
      this.renderMap(resources, fit, casters, input)
      this.lastMatrixKey = matrixKey
      this.renderCount += 1
    } else {
      this.reuseCount += 1
    }
    this.lastCasterCount = casters.length
    const shadow = light.shadow!
    this.current = Object.freeze({
      lightId: light.id,
      texture: resources.texture,
      viewProjection: new Float32Array(fit.viewProjection),
      resolution,
      depthRange: fit.depthRange,
      bias: shadow.bias,
      softness: shadow.softness,
      texelWorldSize: fit.texelWorldSize,
    })
  }

  getSnapshot(): Readonly<Cinema2ShadowServiceSnapshot> {
    return Object.freeze({
      disposed: this.disposed,
      active: this.current != null,
      lightId: this.current?.lightId ?? null,
      resolution: this.resources?.resolution ?? 0,
      estimatedGpuBytes: this.resources ? this.resources.resolution * this.resources.resolution * DEPTH_BYTES_PER_TEXEL : 0,
      renderCount: this.renderCount,
      reuseCount: this.reuseCount,
      lastCasterCount: this.lastCasterCount,
      lastDiagnostic: this.lastDiagnostic,
    })
  }

  /** Every GL object is invalid after a loss: forget them without deleting. */
  handleContextLost(): void {
    if (this.disposed) return
    this.contextAvailable = false
    this.resources = null
    this.current = null
    this.lastMatrixKey = ''
  }

  handleContextRestored(): void {
    if (this.disposed) return
    this.contextAvailable = true
    this.lastMatrixKey = ''
  }

  dispose(): void {
    if (this.disposed) return
    this.releaseResources()
    this.disposed = true
    this.current = null
  }

  private ensureResources(resolution: number): ShadowMapResources | null {
    if (this.resources?.resolution === resolution) return this.resources
    this.releaseResources()
    const { gl } = this
    const texture = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    if (!texture || !framebuffer) {
      if (texture) gl.deleteTexture(texture)
      if (framebuffer) gl.deleteFramebuffer(framebuffer)
      this.lastDiagnostic = 'Cinema 2.0 could not allocate the shadow map; shadows are off.'
      return null
    }
    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null
    const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, resolution, resolution)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      // Hardware comparison: sampling with a reference depth returns a bilinearly filtered 0..1 visibility.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0)
      gl.drawBuffers([gl.NONE])
      gl.readBuffer(gl.NONE)
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
      if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`shadow map framebuffer is incomplete (0x${status.toString(16)})`)
      assertCinema2NoGlErrors(gl, 'shadow map allocation')
    } catch (error) {
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(texture)
      this.lastDiagnostic = `Cinema 2.0 could not create the shadow map (${error instanceof Error ? error.message : String(error)}); shadows are off.`
      return null
    } finally {
      gl.bindTexture(gl.TEXTURE_2D, previousTexture)
      gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer)
    }
    this.lastDiagnostic = null
    this.resources = { texture, framebuffer, resolution }
    this.lastMatrixKey = ''
    return this.resources
  }

  private releaseResources(): void {
    if (this.resources && this.contextAvailable) {
      this.gl.deleteFramebuffer(this.resources.framebuffer)
      this.gl.deleteTexture(this.resources.texture)
    }
    this.resources = null
    this.lastMatrixKey = ''
  }

  private renderMap(
    resources: ShadowMapResources,
    fit: Readonly<LightFit>,
    casters: readonly Readonly<Cinema2ModuleRenderPassProvider>[],
    input: Readonly<Cinema2ShadowUpdateInput>,
  ): void {
    const { gl } = this
    const previous = {
      framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null,
      viewport: gl.getParameter(gl.VIEWPORT) as Int32Array,
      scissor: gl.isEnabled(gl.SCISSOR_TEST),
      blend: gl.isEnabled(gl.BLEND),
      depthTest: gl.isEnabled(gl.DEPTH_TEST),
      cull: gl.isEnabled(gl.CULL_FACE),
      offset: gl.isEnabled(gl.POLYGON_OFFSET_FILL),
      depthMask: gl.getParameter(gl.DEPTH_WRITEMASK) as boolean,
      colorMask: gl.getParameter(gl.COLOR_WRITEMASK) as boolean[],
      depthFunc: gl.getParameter(gl.DEPTH_FUNC) as number,
    }
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer)
      gl.viewport(0, 0, resources.resolution, resources.resolution)
      gl.disable(gl.SCISSOR_TEST)
      gl.disable(gl.BLEND)
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.depthMask(true)
      gl.colorMask(false, false, false, false)
      // Front faces are drawn (no culling: the casters are thin slabs and open boxes); slope-scaled offset keeps acne away.
      gl.disable(gl.CULL_FACE)
      gl.enable(gl.POLYGON_OFFSET_FILL)
      gl.polygonOffset(1.5, 2)
      gl.clearDepth(1)
      gl.clear(gl.DEPTH_BUFFER_BIT)
      for (const caster of casters) {
        try {
          caster.renderShadow!({
            gl,
            frame: input.frame,
            lightViewProjection: fit.viewProjection,
            lightDirection: fit.direction,
            resolution: resources.resolution,
            camera: input.camera!,
            lightingEnvironment: input.lighting!,
          })
        } catch (error) {
          // One broken caster must not take the frame down: it simply casts nothing this frame.
          this.lastDiagnostic = `Shadow caster "${caster.id}" failed: ${error instanceof Error ? error.message : String(error)}`
        }
      }
      assertCinema2NoGlErrors(gl, 'shadow map render')
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, previous.framebuffer)
      gl.viewport(previous.viewport[0]!, previous.viewport[1]!, previous.viewport[2]!, previous.viewport[3]!)
      if (previous.scissor) gl.enable(gl.SCISSOR_TEST)
      if (previous.blend) gl.enable(gl.BLEND)
      if (!previous.depthTest) gl.disable(gl.DEPTH_TEST)
      if (previous.cull) gl.enable(gl.CULL_FACE)
      if (!previous.offset) gl.disable(gl.POLYGON_OFFSET_FILL)
      gl.depthMask(previous.depthMask)
      gl.depthFunc(previous.depthFunc)
      gl.colorMask(previous.colorMask[0]!, previous.colorMask[1]!, previous.colorMask[2]!, previous.colorMask[3]!)
    }
  }
}

interface LightFit {
  viewProjection: number[]
  direction: [number, number, number]
  depthRange: number
  texelWorldSize: number
}

/** Light view/projection for the shadow-casting light: directional lights cover a texel-snapped square ahead of the camera, spots use their cone. */
export function fitLight(light: Readonly<Cinema2ResolvedLightFrame>, camera: Readonly<Cinema2CameraFrame>, resolution: number): LightFit | null {
  const settings = light.shadow
  if (!settings) return null
  const direction = normalizeVector([light.direction[0], light.direction[1], light.direction[2]])
  const basis = lightBasis(direction)
  if (light.type === 'spot') {
    const outer = light.spot?.outerAngleDegrees ?? 30
    const far = Math.max(1, light.range)
    const near = Math.max(0.1, far * 0.01)
    const view = viewMatrixFromBasis(light.position, basis)
    const projection = perspectiveMatrix((Math.min(170, outer * 2) * Math.PI) / 180, 1, near, far)
    return { viewProjection: multiplyMatrices(projection, view), direction, depthRange: far - near, texelWorldSize: (2 * far * Math.tan((outer * Math.PI) / 180)) / resolution }
  }
  const forward = normalizeVector([camera.target[0] - camera.position[0], camera.target[1] - camera.position[1], camera.target[2] - camera.position[2]])
  const focus: [number, number, number] = [
    camera.position[0] + forward[0] * settings.focusAhead,
    camera.position[1] + forward[1] * settings.focusAhead,
    camera.position[2] + forward[2] * settings.focusAhead,
  ]
  const extent = settings.extent
  const texel = (2 * extent) / resolution
  // Snap the focus to whole texels in light space so the map does not shimmer as the camera moves.
  const snappedRight = Math.round(dotVectors(focus, basis.right) / texel) * texel
  const snappedUp = Math.round(dotVectors(focus, basis.up) / texel) * texel
  // The depth axis is snapped coarsely too (a shift along the light does not move the map's texels), so a slowly moving camera keeps the same matrix for many frames.
  const depthStep = settings.depth / 64
  const alongLight = Math.round(dotVectors(focus, basis.forward) / depthStep) * depthStep
  const center: [number, number, number] = [
    basis.right[0] * snappedRight + basis.up[0] * snappedUp + basis.forward[0] * alongLight,
    basis.right[1] * snappedRight + basis.up[1] * snappedUp + basis.forward[1] * alongLight,
    basis.right[2] * snappedRight + basis.up[2] * snappedUp + basis.forward[2] * alongLight,
  ]
  const eye: [number, number, number] = [
    center[0] - direction[0] * settings.depth * 0.5,
    center[1] - direction[1] * settings.depth * 0.5,
    center[2] - direction[2] * settings.depth * 0.5,
  ]
  const view = viewMatrixFromBasis(eye, basis)
  const projection = orthographicMatrix(-extent, extent, -extent, extent, 0, settings.depth)
  return { viewProjection: multiplyMatrices(projection, view), direction, depthRange: settings.depth, texelWorldSize: texel }
}
