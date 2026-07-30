import { FullscreenPass } from '../../shaders/runtime/FullscreenPass'
import { GeometryPass } from '../../shaders/runtime/GeometryPass'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import {
  registerDrmvyzWebGLContext,
  retireDrmvyzWebGLContext,
  type WebGLContextDiagnosticHandle,
} from '../../shaders/runtime/WebGLContextLifecycle'
import { ScopePhosphorTargets } from './ScopePhosphorTargets'
import {
  FULLSCREEN_VERT_SRC,
  SCOPE_BEAM_FRAG_SRC,
  SCOPE_BEAM_VERT_SRC,
  SCOPE_BLOOM_FRAG_SRC,
  SCOPE_COMPOSITE_FRAG_SRC,
  SCOPE_CRT_FRAG_SRC,
  SCOPE_PERSISTENCE_FRAG_SRC,
} from './scopePhosphorShaders'
import {
  SCOPE_PHOSPHOR_COLORS,
  type ScopeBeamSettings,
  type ScopeCrtSettings,
  type ScopePhosphorSettings,
} from '../../../../../audio/scope/scopeTypes'
import {
  probeScopeHdrCapability,
  resolveInitialScopePhosphorQuality,
  scopeEmissionUsesFixedColor,
  resolveScopeHdrTargetStrategy,
  resolveScopePersistenceDecay,
  resolveScopePhosphorPlan,
  type ScopePhosphorPlan,
  type ScopePhosphorQuality,
} from './soundDrawingPhosphorPlan'

// ── ScopePhosphorRuntime ──────────────────────────────────────────────────────
//
// Owns the WebGL2 context and executes the phosphor pass chain:
//
//   beam emission (additive, HDR) → persistence (ping-pong) → bloom levels
//   → composite (tone-mapped, display range)
//
// The context lives on an offscreen canvas the runtime creates and never
// attaches to the DOM. The caller composites the result into the existing Sound
// Drawing 2D output with drawImage — the same boundary WebGL2Renderer uses for
// CANVAS. That keeps ReactPlaceholderCanvas the center-stage owner, leaves the
// recording output canvas untouched, and makes Canvas2D the natural fallback:
// when this runtime is unavailable, nothing is composited and the existing beam
// path draws as before.

/**
 * Emission scale for the beam pass.
 *
 * The nested-Gaussian profile peaks at ~1.35, which the exposure and intensity
 * terms reduce to roughly 0.5 — below display white, so an HDR target would
 * carry no high range at all. These lift a normal stroke into the HDR band so
 * tone mapping has something to compress and intersections can exceed white.
 * The LDR value is far lower because an RGBA8 target clips rather than
 * compressing, and over-driving it would flatten the whole trace to solid white.
 */
const HDR_EXPOSURE_SCALE = 8
const LDR_EXPOSURE_SCALE = 1.4

/**
 * Bloom extraction threshold, in HDR scene units.
 *
 * Sits above the background and below a normal stroke's post-exposure value, so
 * beam bodies bloom while the unexcited tube does not.
 */
const BLOOM_THRESHOLD_HDR = 0.9
const BLOOM_THRESHOLD_LDR = 0.35

/** Texture units. Fixed assignments so no pass can collide with another. */
const UNIT_EMISSION = 0
const UNIT_PREVIOUS = 1
const UNIT_SOURCE = 2
const UNIT_BLOOM_0 = 3
const UNIT_BLOOM_1 = 4
const UNIT_BLOOM_2 = 5
const UNIT_PRESENTATION = 6

/** Maps the graticule style to the CRT shader's integer switch. */
const GRATICULE_STYLE_INDEX: Record<ScopeCrtSettings['graticuleStyle'], number> = {
  none: 0,
  minimal: 1,
  scope: 2,
  vectorscope: 3,
}

/** Parses a hex phosphor colour into linear 0..1 components. */
function hexToRgbTriplet(hex: string): readonly [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const value = match?.[1] ?? 'ffffff'
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ]
}

export type ScopePhosphorUnavailableReason =
  | 'context-creation-failed'
  | 'shader-compilation-failed'
  | 'context-lost'
  | 'disposed'

export interface ScopePhosphorFrameInput {
  /** Packed instance data in the GeometryPass layout. */
  segmentData: Float32Array
  segmentCount: number
  /** Backing-store size to render at, in device pixels. */
  width: number
  height: number
  /** Seconds since the previous rendered frame. */
  deltaSeconds: number
  /** Beam core width in pixels, already scaled for dpr and audio reactivity. */
  coreWidthPx: number
  haloWidthPx: number
  /** Beam response curves. */
  beam: ScopeBeamSettings
  /** Phosphor persistence, bloom weighting, and tone response. */
  phosphor: ScopePhosphorSettings
  /** 0..1 master intensity from the engine controls. */
  intensity: number
  /** 0..1 master bloom contribution, multiplying the per-level weights. */
  glow: number
  /** Base trace colour, linear 0..1. */
  traceColor: { r: number; g: number; b: number }
  /** Background tint used for the tube's black level. */
  backgroundColor: { r: number; g: number; b: number }
  /** When true, unlit tube pixels remain transparent for authored layer composition. */
  transparentBackground?: boolean
  /** Optional CRT presentation. Skipped entirely when disabled or unsupported. */
  crt: ScopeCrtSettings
  /** True on seek, loop, or track change: clears persistence before drawing. */
  resetPersistence: boolean
}

export class ScopePhosphorRuntime {
  private readonly canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext | null = null
  private contextHandle: WebGLContextDiagnosticHandle | null = null

  private compiler: ShaderCompiler | null = null
  private beamProgram: ShaderProgram | null = null
  private persistenceProgram: ShaderProgram | null = null
  private bloomProgram: ShaderProgram | null = null
  private compositeProgram: ShaderProgram | null = null
  private crtProgram: ShaderProgram | null = null

  private geometryPass: GeometryPass | null = null
  private fullscreenPass: FullscreenPass | null = null
  private targets: ScopePhosphorTargets | null = null

  /** 1x1 black texture bound to unused bloom samplers. */
  private blackTexture: WebGLTexture | null = null

  private plan: ScopePhosphorPlan | null = null
  private quality: ScopePhosphorQuality = 'high'
  private unavailableReason: ScopePhosphorUnavailableReason | null = 'context-creation-failed'
  private contextLost = false
  private disposed = false

  private readonly onContextLost = (event: Event): void => {
    // Preventing default is what makes restoration possible at all.
    event.preventDefault()
    this.contextLost = true
    this.unavailableReason = 'context-lost'
    // Targets reference GL objects that no longer exist. Release the wrappers
    // but keep this instance alive: the owner outlives the context.
    this.targets?.releaseTargets()
  }

  private readonly onContextRestored = (): void => {
    this.contextLost = false
    // Capabilities can genuinely differ after a restore, so everything derived
    // from them is rebuilt rather than assumed: probe, plan, programs, targets.
    this.releasePrograms()
    this.initializeGlResources()
  }

  constructor(createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')) {
    this.canvas = createCanvas()
    this.canvas.width = 1
    this.canvas.height = 1

    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null

    if (!gl) {
      this.unavailableReason = 'context-creation-failed'
      return
    }
    this.gl = gl

    this.canvas.addEventListener('webglcontextlost', this.onContextLost as EventListener)
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored as EventListener)

    this.contextHandle = registerDrmvyzWebGLContext(gl, {
      lifetime: 'live-reusable',
      role: 'sound-drawing-phosphor',
      engine: 'oscilloscope',
      expectedMaxActive: 1,
    })

    this.initializeGlResources()
  }

  /**
   * Compiles programs and derives the plan from a live capability probe.
   *
   * Called once at construction and again on context restore. Programs are
   * compiled exactly once per context: recompiling during playback would stall
   * the frame it happens on.
   */
  private initializeGlResources(): void {
    const gl = this.gl
    if (!gl || this.disposed) return

    const probe = probeScopeHdrCapability(gl)
    const hdr = resolveScopeHdrTargetStrategy(probe)
    this.quality = resolveInitialScopePhosphorQuality({
      hdrAvailable: hdr.hdrEnabled,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      devicePixelRatio: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
    })
    this.plan = resolveScopePhosphorPlan(this.quality, hdr)

    this.compiler = new ShaderCompiler(gl)
    const beam = ShaderProgram.create(gl, this.compiler, {
      label: 'scope-beam', vertSrc: SCOPE_BEAM_VERT_SRC, fragSrc: SCOPE_BEAM_FRAG_SRC,
    })
    const persistence = ShaderProgram.create(gl, this.compiler, {
      label: 'scope-persistence', vertSrc: FULLSCREEN_VERT_SRC, fragSrc: SCOPE_PERSISTENCE_FRAG_SRC,
    })
    const bloom = ShaderProgram.create(gl, this.compiler, {
      label: 'scope-bloom', vertSrc: FULLSCREEN_VERT_SRC, fragSrc: SCOPE_BLOOM_FRAG_SRC,
    })
    const composite = ShaderProgram.create(gl, this.compiler, {
      label: 'scope-composite', vertSrc: FULLSCREEN_VERT_SRC, fragSrc: SCOPE_COMPOSITE_FRAG_SRC,
    })
    const crt = ShaderProgram.create(gl, this.compiler, {
      label: 'scope-crt', vertSrc: FULLSCREEN_VERT_SRC, fragSrc: SCOPE_CRT_FRAG_SRC,
    })

    if (!beam.program || !persistence.program || !bloom.program || !composite.program || !crt.program) {
      beam.program?.dispose()
      persistence.program?.dispose()
      bloom.program?.dispose()
      composite.program?.dispose()
      crt.program?.dispose()
      this.unavailableReason = 'shader-compilation-failed'
      return
    }

    this.beamProgram = beam.program
    this.persistenceProgram = persistence.program
    this.bloomProgram = bloom.program
    this.compositeProgram = composite.program
    this.crtProgram = crt.program

    this.geometryPass = new GeometryPass(gl)
    this.fullscreenPass = new FullscreenPass(gl)
    this.targets = new ScopePhosphorTargets(gl)
    this.blackTexture = this.createBlackTexture(gl)
    this.unavailableReason = null
  }

  /**
   * A 1x1 opaque-black texture for unused bloom samplers.
   *
   * Binding a real texture with a zero weight keeps one composite program valid
   * at every quality tier. The alternative — a program variant per level count —
   * would recompile on tier changes, which is exactly what must not happen mid-
   * playback. Sampling an unbound unit is also undefined behaviour.
   */
  private createBlackTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
    const texture = gl.createTexture()
    if (!texture) return null
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
  }

  get available(): boolean {
    return !this.disposed && !this.contextLost && this.unavailableReason == null
  }

  get unavailable(): ScopePhosphorUnavailableReason | null {
    return this.unavailableReason
  }

  get outputCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  get currentQuality(): ScopePhosphorQuality {
    return this.quality
  }

  /** Applies a new quality tier. Targets rebuild only if the layout changed. */
  setQuality(quality: ScopePhosphorQuality): void {
    if (!this.plan || quality === this.quality) return
    this.quality = quality
    this.plan = resolveScopePhosphorPlan(quality, this.plan.hdr)
  }

  /**
   * Renders one frame into the runtime's own canvas.
   *
   * Returns false when nothing was drawn, which the caller reads as "composite
   * nothing and let the Canvas2D path stand".
   */
  renderFrame(input: ScopePhosphorFrameInput): boolean {
    const gl = this.gl
    const plan = this.plan
    if (!gl || !plan || !this.available) return false
    if (gl.isContextLost()) return false
    if (!this.targets || !this.geometryPass || !this.fullscreenPass) return false
    if (!this.beamProgram || !this.persistenceProgram || !this.bloomProgram || !this.compositeProgram) {
      return false
    }

    const width = Math.max(1, Math.floor(input.width))
    const height = Math.max(1, Math.floor(input.height))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }

    const allocated = this.targets.ensure(plan, { width, height })
    // A freshly allocated persistence pair holds whatever the driver left in it.
    if (allocated || input.resetPersistence) this.targets.clearPersistence()

    const scene = this.targets.sceneTarget
    const persistence = this.targets.persistenceBuffer
    if (!scene || !persistence) return false

    // Every sampler this frame binds must resolve to a real texture. Binding an
    // unbound unit is undefined behaviour, so a missing target means skip the
    // frame and let the Canvas2D path stand rather than draw something invalid.
    const black = this.blackTexture
    const sceneTexture = scene.texture
    if (!sceneTexture || !black) return false

    const aspect = width / height

    // ── Pass 1: beam emission, additive into the HDR scene target ────────────
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    this.beamProgram.activate()
    this.beamProgram.setVec2('uResolution', width, height)
    this.beamProgram.setFloat('uAspect', aspect)
    this.beamProgram.setFloat('uCoreWidthPx', input.coreWidthPx)
    this.beamProgram.setFloat('uHaloWidthPx', input.haloWidthPx)
    this.beamProgram.setFloat('uMasterIntensity', input.intensity)
    this.beamProgram.setFloat('uVelocityBrightness', input.beam.velocityBrightness)
    this.beamProgram.setFloat('uCornerDwell', input.beam.cornerDwell)
    // Emission must land well above 1 on an HDR target. The profile's own peak
    // is ~1.35 before the exposure and intensity terms scale it down to roughly
    // 0.5, which is not high-dynamic-range at all: Reinhard would map it to a
    // dim third of display white and the bloom threshold would barely trigger.
    // This lifts a normal stroke to ~3, so tone mapping returns it near 0.75 and
    // overlapping strokes have real headroom to push toward white.
    this.beamProgram.setFloat('uExposureScale', plan.hdr.hdrEnabled ? HDR_EXPOSURE_SCALE : LDR_EXPOSURE_SCALE)
    this.beamProgram.setVec4('uTraceColor',
      input.traceColor.r, input.traceColor.g, input.traceColor.b, 1)
    this.beamProgram.setFloat(
      'uFixedPhosphorColor',
      scopeEmissionUsesFixedColor(input.crt) ? 1 : 0,
    )

    this.geometryPass.run(
      this.beamProgram, scene.framebuffer, width, height, [],
      { data: input.segmentData, count: input.segmentCount },
      { clear: true },
    )
    gl.disable(gl.BLEND)

    // ── Pass 2: persistence ─────────────────────────────────────────────────
    // Read the previous frame, write the other buffer, then swap. Asserting
    // here catches a mis-ordered swap at the bind site rather than as a black
    // frame with no reported error.
    const previousTexture = persistence.readTexture
    if (!previousTexture) return false
    this.targets.assertNotSampling(previousTexture, 'persistence read')
    this.targets.assertNotSampling(sceneTexture, 'persistence emission')

    this.persistenceProgram.activate()
    this.persistenceProgram.setFloat('uDecay',
      resolveScopePersistenceDecay(input.phosphor.persistenceSeconds, input.deltaSeconds))
    this.persistenceProgram.setFloat('uMaxSceneValue', plan.hdr.maximumSceneValue)

    this.fullscreenPass.run(
      this.persistenceProgram, persistence.writeFbo, persistence.width, persistence.height,
      [
        { unit: UNIT_PREVIOUS, texture: previousTexture, uniformName: 'u_previous' },
        { unit: UNIT_EMISSION, texture: sceneTexture, uniformName: 'u_emission' },
      ],
    )
    persistence.swap()

    // ── Pass 3: bloom levels, separable Gaussian ────────────────────────────
    // Two passes per level: horizontal into scratch (extracting highlights),
    // then vertical into the level target. A single-radius ring kernel is not a
    // blur — it convolves with a circle, which rendered a circular trace as a
    // rosette of displaced copies.
    const persisted = persistence.readTexture
    if (!persisted) return false
    const threshold = plan.hdr.hdrEnabled ? BLOOM_THRESHOLD_HDR : BLOOM_THRESHOLD_LDR

    for (let level = 0; level < plan.bloomLevels.length; level++) {
      const target = this.targets.bloomTarget(level)
      const scratch = this.targets.bloomScratchTarget(level)
      if (!target || !scratch) continue
      const config = plan.bloomLevels[level]
      const sigma = config.sigmaPx * config.resolutionScale
      const gain = 1 / Math.max(config.resolutionScale, 0.01)

      this.bloomProgram.activate()
      this.bloomProgram.setVec2('uResolution', target.width, target.height)
      this.bloomProgram.setFloat('uSigmaPx', sigma)
      this.bloomProgram.setVec3('uChannelRadiusScale',
        config.channelRadiusScale[0], config.channelRadiusScale[1], config.channelRadiusScale[2])
      this.bloomProgram.setFloat('uThreshold', threshold)
      this.bloomProgram.setFloat('uGain', gain)

      // Horizontal. Every level reads the persistence texture directly: chaining
      // levels compounds the kernel's averaging loss and left the widest level
      // at a fraction of a percent of the trace, invisible against black.
      this.bloomProgram.setVec2('uDirection', 1, 0)
      this.bloomProgram.setFloat('uExtract', 1)
      this.fullscreenPass.run(
        this.bloomProgram, scratch.framebuffer, scratch.width, scratch.height,
        [{ unit: UNIT_SOURCE, texture: persisted, uniformName: 'u_source' }],
      )

      const scratchTexture = scratch.texture
      if (!scratchTexture) continue

      // Vertical. Highlights are already extracted, and the gain is applied here
      // only so the two passes do not square it.
      this.bloomProgram.setVec2('uDirection', 0, 1)
      this.bloomProgram.setFloat('uExtract', 0)
      this.fullscreenPass.run(
        this.bloomProgram, target.framebuffer, target.width, target.height,
        [{ unit: UNIT_SOURCE, texture: scratchTexture, uniformName: 'u_source' }],
      )
    }

    // ── Pass 4: composite to the runtime canvas ─────────────────────────────
    // Plan weight sets each level's share of the bloom shape; the user control
    // scales that share. Multiplying rather than replacing keeps the tuned
    // relationship between tight, medium, and wide intact at any setting.
    const userBloom = [input.phosphor.tightBloom, input.phosphor.mediumBloom, input.phosphor.wideBloom]
    const weights: [number, number, number] = [0, 0, 0]
    for (let level = 0; level < plan.bloomLevels.length && level < 3; level++) {
      weights[level] = plan.bloomLevels[level].weight * userBloom[level]
    }

    this.compositeProgram.activate()
    this.compositeProgram.setVec3('uBloomWeights', weights[0], weights[1], weights[2])
    this.compositeProgram.setFloat('uGlow', input.glow)
    this.compositeProgram.setFloat('uWhitenStrength', input.phosphor.whiteHot)
    this.compositeProgram.setVec3('uBackgroundColor',
      input.backgroundColor.r, input.backgroundColor.g, input.backgroundColor.b)
    this.compositeProgram.setFloat('uBackgroundLift', input.phosphor.backgroundLift)
    this.compositeProgram.setFloat('uTransparentBackground', input.transparentBackground === true ? 1 : 0)

    // CRT runs after tone mapping, on display-range colour: curving or
    // scanlining HDR values before compression would let a bright intersection
    // survive a scanline that should have dimmed it. When CRT is off the
    // composite writes straight to the canvas and costs nothing extra.
    const presentation = this.targets.presentationTarget
    const runsCrt =
      input.crt.enabled && plan.crtEnabled && this.crtProgram != null && presentation != null

    this.fullscreenPass.run(
      this.compositeProgram,
      runsCrt ? presentation!.framebuffer : null,
      width, height,
      [
        { unit: UNIT_PREVIOUS, texture: persisted, uniformName: 'u_persistence' },
        { unit: UNIT_BLOOM_0, texture: this.targets.bloomTarget(0)?.texture ?? black, uniformName: 'u_bloom0' },
        { unit: UNIT_BLOOM_1, texture: this.targets.bloomTarget(1)?.texture ?? black, uniformName: 'u_bloom1' },
        { unit: UNIT_BLOOM_2, texture: this.targets.bloomTarget(2)?.texture ?? black, uniformName: 'u_bloom2' },
      ],
      { clear: true },
    )

    if (!runsCrt) return true

    // ── Pass 5: CRT presentation ────────────────────────────────────────────
    const presentationTexture = presentation!.texture
    if (!presentationTexture) return true

    const crt = input.crt
    const phosphor = crt.phosphorModel === 'custom'
      ? hexToRgbTriplet(crt.customPhosphorColor)
      : SCOPE_PHOSPHOR_COLORS[crt.phosphorModel]

    this.crtProgram!.activate()
    this.crtProgram!.setVec2('uResolution', width, height)
    this.crtProgram!.setFloat('uScanlineStrength', crt.scanlineStrength)
    this.crtProgram!.setFloat('uScanlineDensity', crt.scanlineDensity)
    this.crtProgram!.setFloat('uCurvature', crt.curvature)
    this.crtProgram!.setFloat('uVignette', crt.vignette)
    this.crtProgram!.setFloat('uEdgeDefocus', crt.edgeDefocus)
    this.crtProgram!.setFloat('uGrain', crt.grain)
    this.crtProgram!.setFloat('uTransparentBackground', input.transparentBackground === true ? 1 : 0)
    this.crtProgram!.setVec3('uPhosphorColor', phosphor[0], phosphor[1], phosphor[2])
    // 'rgb' is a colour vector display: it keeps the trace's own hue rather than
    // driving everything to one emission colour.
    this.crtProgram!.setFloat('uPhosphorTint', crt.phosphorModel === 'rgb' ? 0 : 1)
    this.crtProgram!.setFloat('uGraticuleBrightness', crt.graticuleBrightness)
    this.crtProgram!.setInt('uGraticuleStyle', GRATICULE_STYLE_INDEX[crt.graticuleStyle])

    this.fullscreenPass.run(
      this.crtProgram!, null, width, height,
      [{ unit: UNIT_PRESENTATION, texture: presentationTexture, uniformName: 'u_source' }],
      { clear: true },
    )

    return true
  }

  private releasePrograms(): void {
    this.beamProgram?.dispose()
    this.persistenceProgram?.dispose()
    this.bloomProgram?.dispose()
    this.compositeProgram?.dispose()
    this.crtProgram?.dispose()
    this.crtProgram = null
    this.beamProgram = null
    this.persistenceProgram = null
    this.bloomProgram = null
    this.compositeProgram = null
    this.geometryPass?.dispose()
    this.geometryPass = null
    this.fullscreenPass?.dispose()
    this.fullscreenPass = null
    if (this.blackTexture && this.gl && !this.gl.isContextLost()) {
      this.gl.deleteTexture(this.blackTexture)
    }
    this.blackTexture = null
    this.targets?.dispose()
    this.targets = null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unavailableReason = 'disposed'

    this.canvas.removeEventListener('webglcontextlost', this.onContextLost as EventListener)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored as EventListener)

    this.releasePrograms()
    retireDrmvyzWebGLContext(this.contextHandle, 'terminal-retire')
    this.contextHandle = null
    this.gl = null
  }

  /** Diagnostics for tests and telemetry. Not part of the render contract. */
  getDiagnostics(): {
    available: boolean
    quality: ScopePhosphorQuality
    hdrFormat: string | null
    bloomLevelCount: number
    unavailableReason: ScopePhosphorUnavailableReason | null
    contextLost: boolean
  } {
    return {
      available: this.available,
      quality: this.quality,
      hdrFormat: this.plan?.hdr.targetFormat ?? null,
      bloomLevelCount: this.plan?.bloomLevels.length ?? 0,
      unavailableReason: this.unavailableReason,
      contextLost: this.contextLost,
    }
  }
}
