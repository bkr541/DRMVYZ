import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2EffectManifest,
  type Cinema2EffectTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import { cinema2RenderQualityProfile, type Cinema2AntiAliasingMode } from '../render/Cinema2RenderQualityProfiles'
import { assertCinema2NoGlErrors } from '../runtime/Cinema2GpuValidation'
import { getCinema2RenderTargetPool, type Cinema2PooledTarget } from '../runtime/Cinema2RenderTargetPool'
import type {
  Cinema2EffectCreateContext,
  Cinema2EffectInstance,
  Cinema2EffectRenderExecutionContext,
  Cinema2EffectTypeDefinition,
} from './Cinema2EffectContracts'
import {
  clampEffectValue as clamp,
  readEffectNumber as number,
  validateEffectParameters,
  type Cinema2EffectNumericRange,
} from './Cinema2EffectParameterHelpers'

/**
 * Anti-aliasing for the finished image: `fxaa` (one pass, cheap), `smaa` (three passes, sharper on thin geometry and metal outlines), `off`, or
 * `auto` (the quality tier's choice: FXAA on low, SMAA on medium and high).
 *
 * The shaders are Three.js's own (`FXAAShader`, `SMAAShader` and the SMAA lookup tables from `SMAAPass`), adapted at load time to run as plain
 * WebGL2 passes inside the Render Graph rather than through Three's EffectComposer, which would take over the framebuffer. They are fetched with
 * a dynamic `import()` the first time the effect renders, so Three stays out of the main bundle and presets that do not use the effect never
 * load it; until the shaders are ready the image passes through unchanged.
 *
 * Place it last in the output chain (after bloom and `cinematic-finish`): anti-aliasing belongs on the final composited image, and it applies
 * no tone mapping or gamma of its own. Edge detection looks at a log-compressed copy of the pixels, so an HDR input does not turn every bright
 * region into an "edge"; ordinary 0..1 pixels are detected exactly as in Three, and the output is always the input's own unmodified color blended
 * along the detected edges.
 */
export const CINEMA2_ANTI_ALIASING_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('anti-aliasing')
export const CINEMA2_ANTI_ALIASING_EFFECT_VERSION = 1 as const

export type Cinema2AntiAliasingEffectMode = Cinema2AntiAliasingMode | 'auto'
const MODES: readonly string[] = Object.freeze(['auto', 'off', 'fxaa', 'smaa'])

/** Shapes of the Three modules this effect adapts (only the fields it reads). */
export interface Cinema2ThreeShaderSource { defines?: Record<string, string>; vertexShader: string; fragmentShader: string }
export interface Cinema2SmaaThreeSources {
  edges: Cinema2ThreeShaderSource
  weights: Cinema2ThreeShaderSource
  blend: Cinema2ThreeShaderSource
  /** `data:` URIs of the SMAA area and search lookup images. */
  areaImageUrl: string
  searchImageUrl: string
}
export interface Cinema2AntiAliasingSources {
  fxaa: Cinema2ThreeShaderSource
  smaa: Cinema2SmaaThreeSources
}

export interface Cinema2PortedProgram { vertex: string; fragment: string }

// Log-compression of values above 1: identity on ordinary (LDR) pixels, so edge detection there is exactly Three's.
const COMPRESS_FN = `
vec3 aaCompress(vec3 c) { return mix(c, vec3(1.0) + 0.25 * log2(max(c, vec3(1.0))), step(vec3(1.0), c)); }
float aaCompress(float c) { return c < 1.0 ? c : 1.0 + 0.25 * log2(c); }
`

const FRAGMENT_PREFIX = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define texture2D texture
`

const FULLSCREEN_VERTEX_MAIN = (call: string) => `
void main() {
  vec2 pos = vec2(float(gl_VertexID == 1 ? 1 : 0) * 4.0 - 1.0, float(gl_VertexID == 2 ? 1 : 0) * 4.0 - 1.0);
  vUv = pos * 0.5 + 0.5;
  ${call}
  gl_Position = vec4(pos, 0.0, 1.0);
}`

function defineBlock(defines: Record<string, string> | undefined, drop: readonly string[] = []): string {
  return Object.entries(defines ?? {}).filter(([key]) => !drop.includes(key)).map(([key, value]) => `#define ${key} ${value}\n`).join('')
}

/** Replaces a Three vertex shader's attribute-driven `main()` with a gl_VertexID fullscreen triangle that calls the same SMAA setup function. */
export function portSmaaVertex(shader: Cinema2ThreeShaderSource): string {
  const body = shader.vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{[\s\S]*$/, '')
  const call = /(SMAA\w+VS)\s*\(\s*vUv\s*\)/.exec(shader.vertexShader)?.[1]
  if (!call) throw new Error('Cinema 2.0 anti-aliasing could not find the SMAA vertex setup call in the installed Three.js shader.')
  return `#version 300 es
precision highp float;
#define varying out
${defineBlock(shader.defines)}${body}${FULLSCREEN_VERTEX_MAIN(`${call}( vUv );`)}`
}

export function portSmaaFragment(shader: Cinema2ThreeShaderSource, options: { hdrEdges?: boolean } = {}): string {
  let source = shader.fragmentShader
  let extra = ''
  if (options.hdrEdges) {
    const before = source
    source = source.replace(/texture2D\(\s*colorTex\s*,\s*([^()]*?)\s*\)\.rgb/g, 'aaCompress( texture2D( colorTex, $1 ).rgb )')
    if (source === before) throw new Error('Cinema 2.0 anti-aliasing could not adapt the SMAA edge shader (installed Three.js changed).')
    source = source.replace(/vec2\(\s*SMAA_THRESHOLD\s*,\s*SMAA_THRESHOLD\s*\)/, 'vec2( u_smaaThreshold )')
    extra = `${COMPRESS_FN}\nuniform float u_smaaThreshold;\n`
  }
  return `${FRAGMENT_PREFIX}${defineBlock(shader.defines, ['SMAA_THRESHOLD'])}${extra}${source}`
}

export function portFxaaFragment(shader: Cinema2ThreeShaderSource): string {
  const before = shader.fragmentShader
  const source = before.replace(
    /return\s+dot\(\s*Sample\(\s*tex2D\s*,\s*uv\s*\)\.rgb\s*,\s*vec3\(\s*0\.3\s*,\s*0\.59\s*,\s*0\.11\s*\)\s*\)\s*;/,
    'return aaCompress( dot( Sample( tex2D, uv ).rgb, vec3( 0.3, 0.59, 0.11 ) ) );',
  )
  if (source === before) throw new Error('Cinema 2.0 anti-aliasing could not adapt the FXAA shader (installed Three.js changed).')
  return `${FRAGMENT_PREFIX}${COMPRESS_FN}${defineBlock(shader.defines)}${source}`
}

const FXAA_VERTEX = `#version 300 es
precision highp float;
out vec2 vUv;
${FULLSCREEN_VERTEX_MAIN('')}`

const COPY_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
out vec4 outColor;
void main() { outColor = texture(u_source, v_uv); }`

const NUMERIC: readonly Cinema2EffectNumericRange[] = Object.freeze([
  ['threshold', 0.02, 0.5],
])

type Loader = () => Promise<Cinema2AntiAliasingSources>

const defaultLoader: Loader = async () => {
  const [fxaa, smaa, pass] = await Promise.all([
    import('three/examples/jsm/shaders/FXAAShader.js'),
    import('three/examples/jsm/shaders/SMAAShader.js'),
    import('three/examples/jsm/postprocessing/SMAAPass.js'),
  ])
  // The lookup tables are private methods of SMAAPass that return `data:` URIs and use no instance state.
  const proto = pass.SMAAPass.prototype as unknown as { _getAreaTexture(): string; _getSearchTexture(): string }
  return {
    fxaa: fxaa.FXAAShader as unknown as Cinema2ThreeShaderSource,
    smaa: {
      edges: smaa.SMAAEdgesShader as unknown as Cinema2ThreeShaderSource,
      weights: smaa.SMAAWeightsShader as unknown as Cinema2ThreeShaderSource,
      blend: smaa.SMAABlendShader as unknown as Cinema2ThreeShaderSource,
      areaImageUrl: proto._getAreaTexture(),
      searchImageUrl: proto._getSearchTexture(),
    },
  }
}

let sourceLoader: Loader = defaultLoader
let pendingSources: Promise<Cinema2AntiAliasingSources> | null = null

/** Loads (once) the Three shader sources this effect adapts. A failed load is not cached. */
export function loadCinema2AntiAliasingSources(): Promise<Cinema2AntiAliasingSources> {
  if (!pendingSources) {
    pendingSources = sourceLoader().catch(error => { pendingSources = null; throw error })
  }
  return pendingSources
}

/** Test seam: replace the loader (and forget any loaded sources). */
export function setCinema2AntiAliasingSourceLoaderForTests(next: Loader | null): void {
  sourceLoader = next ?? defaultLoader
  pendingSources = null
}

export function resolveCinema2AntiAliasingMode(requested: unknown, quality: Parameters<typeof cinema2RenderQualityProfile>[0]): Cinema2AntiAliasingMode {
  if (requested === 'off' || requested === 'fxaa' || requested === 'smaa') return requested
  return cinema2RenderQualityProfile(quality).antiAliasing.auto
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Cinema 2.0 anti-aliasing could not decode an SMAA lookup image.'))
    image.src = url
  })
}

function createProgram(gl: WebGL2RenderingContext, label: string, vertSrc: string, fragSrc: string, required: string[], optional: string[]): ShaderProgram {
  const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label, vertSrc, fragSrc, requiredUniforms: required, optionalUniforms: optional })
  if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
  return result.program
}

interface SmaaPrograms {
  edges: ShaderProgram
  weights: ShaderProgram
  blend: ShaderProgram
  area: WebGLTexture
  search: WebGLTexture
}

class AntiAliasingEffectInstance implements Cinema2EffectInstance {
  private readonly label: string
  private readonly pass: FullscreenPass
  private copy: ShaderProgram | null = null
  private fxaa: ShaderProgram | null = null
  private smaa: SmaaPrograms | null = null
  private sources: Cinema2AntiAliasingSources | null = null
  private images: { area: HTMLImageElement; search: HTMLImageElement } | null = null
  private loadStarted = false
  private loadError: Error | null = null
  private smaaError: Error | null = null
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, effect: Readonly<Cinema2EffectManifest>) {
    this.label = `Cinema2/Effect/AntiAliasing/${effect.id}`
    this.pass = new FullscreenPass(gl)
  }

  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    if (this.disposed) return
    const { gl } = this
    const mode = resolveCinema2AntiAliasingMode(context.parameters.mode, context.quality)
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.colorMask(true, true, true, true)

    if (mode === 'off') { this.runCopy(context); return }
    if (this.loadError) throw this.loadError
    if (mode === 'smaa' && this.smaaError) throw this.smaaError
    this.startLoad()
    if (!this.sources || (mode === 'smaa' && !this.images)) { this.runCopy(context); return }

    if (mode === 'fxaa') this.runFxaa(context)
    else this.runSmaa(context)
    assertCinema2NoGlErrors(gl, 'Anti-aliasing draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const { gl } = this
    this.pass.dispose()
    this.copy?.dispose()
    this.fxaa?.dispose()
    if (this.smaa) {
      this.smaa.edges.dispose()
      this.smaa.weights.dispose()
      this.smaa.blend.dispose()
      gl.deleteTexture(this.smaa.area)
      gl.deleteTexture(this.smaa.search)
    }
    this.smaa = null
    this.sources = null
    this.images = null
    getCinema2RenderTargetPool(gl).flush()
  }

  private startLoad(): void {
    if (this.loadStarted) return
    this.loadStarted = true
    loadCinema2AntiAliasingSources().then(
      async sources => {
        if (this.disposed) return
        try {
          const [area, search] = await Promise.all([loadImage(sources.smaa.areaImageUrl), loadImage(sources.smaa.searchImageUrl)])
          if (this.disposed) return
          this.images = { area, search }
        } catch (error) {
          // FXAA does not need the lookup images; only SMAA reports their failure.
          this.smaaError = error instanceof Error ? error : new Error(String(error))
        }
        this.sources = sources
      },
      error => { this.loadError = error instanceof Error ? error : new Error(String(error)) },
    )
  }

  private runCopy(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    const program = this.copy ??= createProgram(this.gl, `${this.label}/copy`, FULLSCREEN_VERT_SRC, COPY_SOURCE, ['u_source'], [])
    this.pass.run(program, context.target, context.width, context.height, [{ unit: 0, texture: context.input.texture, uniformName: 'u_source' }])
  }

  private runFxaa(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    const program = this.fxaa ??= createProgram(this.gl, `${this.label}/fxaa`, FXAA_VERTEX, portFxaaFragment(this.sources!.fxaa), ['tDiffuse'], ['resolution'])
    program.activate()
    program.setVec2('resolution', 1 / context.width, 1 / context.height)
    this.pass.run(program, context.target, context.width, context.height, [{ unit: 0, texture: context.input.texture, uniformName: 'tDiffuse' }])
  }

  private runSmaa(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    const programs = this.smaa ??= this.createSmaa()
    const pool = getCinema2RenderTargetPool(this.gl)
    const threshold = clamp(number(context.parameters, 'threshold', cinema2RenderQualityProfile(context.quality).antiAliasing.smaaThreshold), 0.02, 0.5)
    const texel: [number, number] = [1 / context.width, 1 / context.height]
    let edges: Cinema2PooledTarget | null = null
    let weights: Cinema2PooledTarget | null = null
    try {
      edges = pool.acquire(context.width, context.height, 'rgba8', 'linear')
      weights = pool.acquire(context.width, context.height, 'rgba8', 'linear')
      programs.edges.activate()
      programs.edges.setVec2('resolution', texel[0], texel[1])
      programs.edges.setFloat('u_smaaThreshold', threshold)
      // The edge pass discards pixels without an edge, so its target must start cleared.
      this.pass.run(programs.edges, edges.framebuffer, context.width, context.height, [{ unit: 0, texture: context.input.texture, uniformName: 'tDiffuse' }], { clear: true })

      programs.weights.activate()
      programs.weights.setVec2('resolution', texel[0], texel[1])
      this.pass.run(programs.weights, weights.framebuffer, context.width, context.height, [
        { unit: 0, texture: edges.texture, uniformName: 'tDiffuse' },
        { unit: 1, texture: programs.area, uniformName: 'tArea' },
        { unit: 2, texture: programs.search, uniformName: 'tSearch' },
      ], { clear: true })

      programs.blend.activate()
      programs.blend.setVec2('resolution', texel[0], texel[1])
      this.pass.run(programs.blend, context.target, context.width, context.height, [
        { unit: 0, texture: weights.texture, uniformName: 'tDiffuse' },
        { unit: 1, texture: context.input.texture, uniformName: 'tColor' },
      ])
    } finally {
      if (edges) pool.release(edges)
      if (weights) pool.release(weights)
    }
  }


  private createSmaa(): SmaaPrograms {
    const { gl } = this
    const sources = this.sources!.smaa
    const images = this.images!
    const edges = createProgram(gl, `${this.label}/smaa-edges`, portSmaaVertex(sources.edges), portSmaaFragment(sources.edges, { hdrEdges: true }), ['tDiffuse'], ['resolution', 'u_smaaThreshold'])
    const weights = createProgram(gl, `${this.label}/smaa-weights`, portSmaaVertex(sources.weights), portSmaaFragment(sources.weights), ['tDiffuse', 'tArea', 'tSearch'], ['resolution'])
    const blend = createProgram(gl, `${this.label}/smaa-blend`, portSmaaVertex(sources.blend), portSmaaFragment(sources.blend), ['tDiffuse', 'tColor'], ['resolution'])
    return { edges, weights, blend, area: this.uploadLookup(images.area, gl.LINEAR), search: this.uploadLookup(images.search, gl.NEAREST) }
  }

  private uploadLookup(image: HTMLImageElement, filter: number): WebGLTexture {
    const { gl } = this
    const texture = gl.createTexture()
    if (!texture) throw new Error('Cinema 2.0 anti-aliasing could not allocate an SMAA lookup texture.')
    const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)
    const premultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL)
    const colorspace = gl.getParameter(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, colorspace)
    return texture
  }
}

export const cinema2AntiAliasingEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_ANTI_ALIASING_EFFECT_TYPE_ID,
  version: CINEMA2_ANTI_ALIASING_EFFECT_VERSION,
  label: 'Anti-Aliasing',
  validate: (effect: Readonly<Cinema2EffectManifest>) => {
    const diagnostics = [...validateEffectParameters(effect, NUMERIC)]
    const mode = effect.parameters?.mode
    if (mode !== undefined && (typeof mode !== 'string' || !MODES.includes(mode))) {
      diagnostics.push({ code: 'CINEMA2_EFFECT_PARAMETER_INVALID', path: '$.parameters.mode', message: `Effect parameter "mode" must be one of ${MODES.join(', ')}.` })
    }
    return Object.freeze(diagnostics)
  },
  create: ({ gl, effect }: Readonly<Cinema2EffectCreateContext>) => new AntiAliasingEffectInstance(gl, effect),
})
