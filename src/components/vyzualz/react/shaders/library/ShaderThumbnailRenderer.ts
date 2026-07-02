import type { ShaderDefinition, RGBA, Vec2, EnumParamDef, GradientStop } from '../registry/shaderRegistryTypes'
import type { BrandKit } from '../../../../../features/personalization/BrandKitTypes'
import { applyShaderBrandUniforms, resolveShaderBrandPalette, resolveShaderColorParam, shaderBrandPaletteCacheKey } from '../brand/ShaderBrandPersonalization'
import { ShaderGradientTextureCache } from '../textures/ShaderGradientTextureCache'
import { getShaderReservedTextureUnits } from '../runtime/shaderTextureUnits'
import { FullscreenPass, FULLSCREEN_VERT_SRC } from '../runtime/FullscreenPass'
import { ShaderProgram } from '../runtime/ShaderProgram'
import { ShaderCompiler } from '../runtime/ShaderCompiler'
import {
  MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS,
  claimDrmvyzThumbnailWebGLContext,
  registerDrmvyzWebGLContext,
  releaseDrmvyzThumbnailWebGLContext,
  retireDrmvyzWebGLContext,
  serializeDrmvyzThumbnailWebGLWork,
  type DrmvyzThumbnailWebGLContextLease,
  type WebGLContextDiagnosticHandle,
} from '../runtime/WebGLContextLifecycle'

// ── Constants ─────────────────────────────────────────────────────────────────

const THUMB_W = 128
const THUMB_H = 128

// Deterministic "frozen" time used for all thumbnails.
const PREVIEW_TIME_SEC = 4.0
const PREVIEW_SEED     = 42

// ── ThumbnailResult ───────────────────────────────────────────────────────────

export interface ThumbnailResult {
  dataUrl:  string      // PNG data URL
  sceneId:  string
  cachedAt: string      // ISO 8601
}

type ThumbnailCanvas = HTMLCanvasElement | OffscreenCanvas

interface SharedShaderThumbnailPool {
  canvas: ThumbnailCanvas
  gl: WebGL2RenderingContext
  compiler: ShaderCompiler
  fullscreenPass: FullscreenPass
  gradientCache: ShaderGradientTextureCache
  fallbackTexture: WebGLTexture
  diagnostics: WebGLContextDiagnosticHandle | null
  lease: DrmvyzThumbnailWebGLContextLease
}

let sharedPool: SharedShaderThumbnailPool | null = null
let sharedRenderTail: Promise<void> = Promise.resolve()
let activeSharedJobs = 0
let retireSharedPoolWhenIdle = false
const activeRendererOwners = new Set<ShaderThumbnailRenderer>()

// ── ShaderThumbnailRenderer ───────────────────────────────────────────────────

/**
 * Renders small deterministic previews for shader scenes.
 *
 * Every renderer instance shares one serialized transient WebGL2 context. The
 * context is reused across scene jobs and terminally retired when the final
 * owner is disposed, keeping DRMVYZ's shader-thumbnail context count at one.
 */
export class ShaderThumbnailRenderer {
  private readonly _cache = new Map<string, ThumbnailResult>()
  private _disposed = false

  constructor() {
    activeRendererOwners.add(this)
    retireSharedPoolWhenIdle = false
  }

  /** Return a cached thumbnail for `sceneId`, or `null` if not yet rendered. */
  getCached(sceneId: string, brandKit?: Readonly<BrandKit> | null): ThumbnailResult | null {
    return this._cache.get(shaderBrandPaletteCacheKey(sceneId, brandKit)) ?? null
  }

  /** Render one frame using the shared, bounded thumbnail context. */
  async render(def: ShaderDefinition, brandKit?: Readonly<BrandKit> | null): Promise<ThumbnailResult | null> {
    if (this._disposed) return null

    const cacheKey = shaderBrandPaletteCacheKey(def, brandKit)
    const cached = this._cache.get(cacheKey)
    if (cached) return cached

    const fragSrc = def.fragSrc ?? def.passes?.[0]?.fragSrc
    if (!fragSrc) return null

    const result = await enqueueSharedShaderThumbnail(() => (
      serializeDrmvyzThumbnailWebGLWork(async () => {
        if (this._disposed) return null
        return this._renderOnce(def, fragSrc, brandKit)
      })
    ))
    if (result && !this._disposed) this._cache.set(cacheKey, result)
    return this._disposed ? null : result
  }

  /** Remove a single cached entry (forces re-render on next call). */
  clearCache(sceneId?: string): void {
    if (!sceneId) {
      this._cache.clear()
      return
    }
    for (const key of this._cache.keys()) {
      if (key === sceneId || key.startsWith(`${sceneId}:`)) this._cache.delete(key)
    }
  }

  /** All currently cached scene IDs. */
  get cachedIds(): string[] { return Array.from(this._cache.keys()) }

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this._cache.clear()
    activeRendererOwners.delete(this)
    if (activeRendererOwners.size === 0) {
      retireSharedPoolWhenIdle = true
      if (activeSharedJobs === 0) terminallyDisposeSharedShaderThumbnailPool()
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _renderOnce(def: ShaderDefinition, fragSrc: string, brandKit?: Readonly<BrandKit> | null): Promise<ThumbnailResult | null> {
    const sceneId = def.id
    const pool = acquireSharedShaderThumbnailPool()
    if (!pool) return null

    const { canvas, gl, compiler, fullscreenPass } = pool
    let program: ShaderProgram | null = null
    let terminalFailure = false
    try {
      resetSharedShaderThumbnailState(gl)
      const result = ShaderProgram.create(gl, compiler, {
        vertSrc: FULLSCREEN_VERT_SRC,
        fragSrc,
        label: `thumb:${sceneId}`,
        optionalUniforms: ['uTime', 'uSeed', 'uResolution', 'uAspect'],
      })
      if (!result.program) return null
      program = result.program

      gl.viewport(0, 0, THUMB_W, THUMB_H)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      program.activate()
      program.setFloat('uTime', PREVIEW_TIME_SEC)
      program.setFloat('uSeed', PREVIEW_SEED)
      program.setVec2('uResolution', THUMB_W, THUMB_H)
      program.setFloat('uAspect', THUMB_W / THUMB_H)
      applyThumbnailPreviewUniforms(program)
      bindThumbnailFallbackTextures(program, def, gl, pool.fallbackTexture)

      const brandContext = resolveShaderBrandPalette(def, def.defaults, brandKit)
      applyShaderBrandUniforms(program, brandContext)
      const reservedUnits = getShaderReservedTextureUnits(gl)
      const gradientUnits = pool.gradientCache.buildUnitMap(
        def,
        def.defaults,
        gl,
        def.textureInputs?.length ?? 0,
        reservedUnits.firstReserved,
      )
      applyThumbnailParamUniforms(program, def, gradientUnits, brandContext)
      fullscreenPass.run(program, null, THUMB_W, THUMB_H, [])
      gl.flush()

      const dataUrl = await thumbnailCanvasToDataUrl(canvas)
      return { dataUrl, sceneId, cachedAt: new Date().toISOString() }
    } catch {
      // Unexpected canvas/context failures can leave opaque driver state behind.
      // Retire rather than returning a potentially corrupted shared context.
      terminalFailure = true
      return null
    } finally {
      try { program?.dispose() } catch { /* Context may already be lost. */ }
      if (terminalFailure) terminallyDisposeSharedShaderThumbnailPool(pool)
      else if (sharedPool === pool) {
        pool.gradientCache.clearAll()
        resetSharedShaderThumbnailState(gl)
      }
    }
  }
}


function applyThumbnailPreviewUniforms(program: ShaderProgram): void {
  const preview: Record<string, number> = {
    uDeltaTime: 1 / 60,
    uPlaybackTime: PREVIEW_TIME_SEC,
    uPlaybackProgress: 0.42,
    uSub: 0.52,
    uBass: 0.68,
    uLowMid: 0.44,
    uMid: 0.38,
    uHighMid: 0.32,
    uHigh: 0.28,
    uAir: 0.2,
    uKick: 0.72,
    uSnare: 0.48,
    uHat: 0.35,
    uKickHit: 0.65,
    uSnareHit: 0.2,
    uHatHit: 0.15,
    uBeatHit: 0.55,
    uDownbeatHit: 0.35,
    uBeatPhase: 0.28,
    uBarPhase: 0.57,
    uPhrasePhase: 0.44,
    uPhrase4Progress: 0.63,
    uPhrase8Progress: 0.44,
    uPhrase16Progress: 0.72,
    uPhrase32Progress: 0.36,
    uSectionPhase: 0.58,
    uSectionProgress: 0.58,
    uSectionType: 5,
    uSectionIntensity: 0.82,
    uEnergy: 0.7,
    uEnergyShort: 0.68,
    uEnergyShortTerm: 0.68,
    uEnergyLong: 0.53,
    uEnergyLongTerm: 0.53,
    uEnergyDelta: 0.15,
    uBuildProgress: 0.36,
    uDropImpact: 0.78,
    uBuildConfidence: 0.25,
    uDropConfidence: 0.86,
    uFakeoutConfidence: 0.08,
    uVocalHookConfidence: 0.4,
    uSpectralCentroid: 0.52,
    uSpectralFlux: 0.42,
    uSpectralSpread: 0.48,
    uSpectralRolloff: 0.62,
    uSpectralFlatness: 0.21,
    uVocalEnergy: 0.35,
    uDrumEnergy: 0.72,
    uBassStemEnergy: 0.66,
    uInstrumentEnergy: 0.48,
    uLyricActivity: 0.3,
    uLyricLineProgress: 0.55,
    uLyricWordProgress: 0.72,
    uLyricWordHit: 0.2,
    uChordChangeHit: 0.15,
    uPitchNormalized: 0.56,
    uHasStems: 1,
    uHasLyrics: 1,
    uHasHarmonics: 1,
    uSpectrumAvailable: 0,
    uWaveformAvailable: 0,
    uBrandLogoAvailable: 0,
    uBrandTextureAvailable: 0,
    uBrandBackgroundAvailable: 0,
    uMasterIntensity: 1,
    uMasterMotion: 1,
    uMasterGlow: 1,
    uMasterBassReactivity: 1,
    uMasterTrailDecay: 0.35,
    uMasterFogDensity: 1,
    uMasterParticleDensity: 1,
  }
  for (const [name, value] of Object.entries(preview)) program.setFloat(name, value)
}

function applyThumbnailParamUniforms(
  program: ShaderProgram,
  def: ShaderDefinition,
  gradientUnits: ReadonlyMap<string, number>,
  brandContext: ReturnType<typeof resolveShaderBrandPalette>,
): void {
  for (const param of def.params) {
    const value = def.defaults[param.id]
    switch (param.type) {
      case 'float':
      case 'integer':
        program.setFloat(param.uniformName, typeof value === 'number' ? value : param.default)
        break
      case 'boolean':
        program.setFloat(param.uniformName, value ? 1 : 0)
        break
      case 'color': {
        const authored = (Array.isArray(value) ? value : param.default) as RGBA
        const color = resolveShaderColorParam(authored, param.brandRole, brandContext)
        program.setVec4(param.uniformName, color[0], color[1], color[2], color[3])
        break
      }
      case 'vec2': {
        const vec = (Array.isArray(value) ? value : param.default) as Vec2
        program.setVec2(param.uniformName, vec[0], vec[1])
        break
      }
      case 'enum': {
        const enumDef = param as EnumParamDef
        const selected = typeof value === 'string' ? value : enumDef.default
        const index = Math.max(0, enumDef.values.findIndex(option => option.value === selected))
        if (enumDef.uniformType === 'int') program.setInt(param.uniformName, index)
        else program.setFloat(param.uniformName, index)
        break
      }
      case 'gradient': {
        const unit = gradientUnits.get(param.id)
        if (unit !== undefined) {
          program.setSampler(param.uniformName, unit)
          program.setFloat(`${param.uniformName}StopCount`, ((value as GradientStop[] | undefined) ?? param.default).length)
        }
        break
      }
      case 'trigger':
        program.setFloat(param.uniformName, 0)
        break
      case 'texture':
        break
    }
  }
}

// ── Shared pool ───────────────────────────────────────────────────────────────

function enqueueSharedShaderThumbnail<T>(work: () => Promise<T>): Promise<T> {
  const run = async () => {
    activeSharedJobs += 1
    try {
      return await work()
    } finally {
      activeSharedJobs = Math.max(0, activeSharedJobs - 1)
      if (retireSharedPoolWhenIdle && activeSharedJobs === 0) {
        terminallyDisposeSharedShaderThumbnailPool()
      }
    }
  }
  const task = sharedRenderTail.then(run, run)
  sharedRenderTail = task.then(() => undefined, () => undefined)
  return task
}

function acquireSharedShaderThumbnailPool(): SharedShaderThumbnailPool | null {
  if (sharedPool) return sharedPool

  const lease = claimDrmvyzThumbnailWebGLContext(
    'shader-scene-thumbnail',
    () => terminallyDisposeSharedShaderThumbnailPool(),
  )
  const canvas = createThumbnailCanvas()
  if (!canvas) {
    releaseDrmvyzThumbnailWebGLContext(lease)
    return null
  }
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  }) as WebGL2RenderingContext | null
  if (!gl) {
    releaseDrmvyzThumbnailWebGLContext(lease)
    return null
  }

  try {
    sharedPool = {
      canvas,
      gl,
      compiler: new ShaderCompiler(gl),
      fullscreenPass: new FullscreenPass(gl),
      gradientCache: new ShaderGradientTextureCache(gl),
      fallbackTexture: createThumbnailFallbackTexture(gl),
      diagnostics: registerDrmvyzWebGLContext(gl, {
        lifetime: 'transient-thumbnail',
        role: 'shader-scene-thumbnail',
        engine: 'shader-engine',
        expectedMaxActive: MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS,
      }),
      lease,
    }
    return sharedPool
  } catch {
    try { gl.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* Best effort. */ }
    releaseDrmvyzThumbnailWebGLContext(lease)
    try {
      canvas.width = 1
      canvas.height = 1
    } catch { /* Offscreen canvas may already be detached. */ }
    return null
  }
}


function createThumbnailFallbackTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture()
  if (!texture) throw new Error('Unable to allocate Shader thumbnail fallback texture')
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return texture
}

function bindThumbnailFallbackTextures(
  program: ShaderProgram,
  def: ShaderDefinition,
  gl: WebGL2RenderingContext,
  fallbackTexture: WebGLTexture,
): void {
  for (const [unit, input] of (def.textureInputs ?? []).entries()) {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, fallbackTexture)
    program.setSampler(input.name, unit)
    program.setFloat(`${input.name}Available`, 0)
    program.setVec2(`${input.name}Resolution`, 1, 1)
    program.setFloat(`${input.name}Aspect`, 1)
    program.setVec2(`${input.name}UvScale`, 1, 1)
    program.setVec2(`${input.name}UvOffset`, 0, 0)
  }

  const units = getShaderReservedTextureUnits(gl)
  const universal: ReadonlyArray<readonly [number, string]> = [
    [units.brandLogo, 'uBrandLogoTexture'],
    [units.brandTexture, 'uBrandTexture'],
    [units.brandBackground, 'uBrandBackgroundTexture'],
    [units.spectrum, 'uSpectrumTexture'],
    [units.waveform, 'uWaveformTexture'],
  ]
  for (const [unit, sampler] of universal) {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, fallbackTexture)
    program.setSampler(sampler, unit)
  }
}

function terminallyDisposeSharedShaderThumbnailPool(
  expectedPool: SharedShaderThumbnailPool | null = sharedPool,
): void {
  const pool = sharedPool
  if (!pool || (expectedPool && expectedPool !== pool)) return
  sharedPool = null
  retireSharedPoolWhenIdle = false

  try { pool.gradientCache.dispose() } catch { /* Best effort. */ }
  try { pool.gl.deleteTexture(pool.fallbackTexture) } catch { /* Best effort. */ }
  try { pool.fullscreenPass.dispose() } catch { /* Best effort. */ }
  try { pool.gl.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* Already lost or unsupported. */ }
  retireDrmvyzWebGLContext(pool.diagnostics, 'terminal-retire')
  releaseDrmvyzThumbnailWebGLContext(pool.lease)
  try {
    pool.canvas.width = 1
    pool.canvas.height = 1
  } catch { /* Offscreen canvas may already be detached. */ }
}

function createThumbnailCanvas(): ThumbnailCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(THUMB_W, THUMB_H)
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = THUMB_H
  return canvas
}

function resetSharedShaderThumbnailState(gl: WebGL2RenderingContext): void {
  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    gl.useProgram(null)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.disable(gl.BLEND)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.STENCIL_TEST)
    gl.colorMask(true, true, true, true)
    gl.depthMask(true)
    gl.stencilMask(0xffffffff)
    gl.viewport(0, 0, THUMB_W, THUMB_H)
    gl.scissor(0, 0, THUMB_W, THUMB_H)
    gl.clearColor(0, 0, 0, 1)
    gl.clearDepth(1)
    gl.clearStencil(0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
  } catch {
    // Context loss makes state repair illegal; terminal retirement handles it.
  }
}

async function thumbnailCanvasToDataUrl(canvas: ThumbnailCanvas): Promise<string> {
  if (isOffscreenCanvas(canvas)) {
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return blobToDataUrl(blob)
  }
  return canvas.toDataURL('image/png')
}

function isOffscreenCanvas(canvas: ThumbnailCanvas): canvas is OffscreenCanvas {
  return typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

export function getShaderThumbnailContextDiagnosticsForTests(): Readonly<{
  activeContextCount: number
  contextLimit: number
  ownerCount: number
}> {
  return {
    activeContextCount: sharedPool ? 1 : 0,
    contextLimit: MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS,
    ownerCount: activeRendererOwners.size,
  }
}
