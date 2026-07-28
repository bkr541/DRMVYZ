import { ShaderPingPongBuffer } from '../../shaders/feedback/ShaderPingPongBuffer'
import { ShaderFramebuffer } from '../../shaders/runtime/ShaderFramebuffer'
import type { ScopePhosphorPlan } from './soundDrawingPhosphorPlan'

// ── ScopePhosphorTargets ──────────────────────────────────────────────────────
//
// Owns every render target the phosphor pipeline draws into: the HDR beam
// emission target, the ping-pong persistence pair, and one target per bloom
// level.
//
// Composed from the engine's existing ShaderFramebuffer and ShaderPingPongBuffer
// rather than reimplementing target management — those already handle format
// resolution, resize-with-clear, and disposal. What this class adds is the part
// specific to this pipeline: sizing each target from the resolved plan, and
// enforcing the feedback-loop rule below.
//
// The rule that matters: a texture currently attached as the draw target must
// never also be bound as a sampler input. In WebGL that is undefined behaviour —
// in practice it silently produces garbage or a black frame, and it is easy to
// introduce by accident in a ping-pong pass. `assertNotSampling` makes the
// invariant checkable, and the tests exercise it directly.

export interface ScopePhosphorTargetSize {
  /** Backing-store width in device pixels. */
  width: number
  /** Backing-store height in device pixels. */
  height: number
}

/** Smallest target dimension. Below this a blur kernel spans the whole target. */
const MIN_TARGET_PX = 4

export class ScopePhosphorTargets {
  private readonly gl: WebGL2RenderingContext

  private scene: ShaderFramebuffer | null = null
  private persistence: ShaderPingPongBuffer | null = null
  private bloom: ShaderFramebuffer[] = []
  /** Intermediate target per bloom level, holding the horizontal blur pass. */
  private bloomScratch: ShaderFramebuffer[] = []
  /** Tone-mapped result, when a CRT pass still has to run over it. */
  private presentation: ShaderFramebuffer | null = null

  private width = 0
  private height = 0
  private planKey = ''
  private disposed = false

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  /**
   * Identity of the target layout a plan implies.
   *
   * Targets are rebuilt only when this changes, so a quality change that keeps
   * the same layout — Ultra to High, which share bloom shape and persistence
   * scale — costs nothing and cannot flash.
   */
  private static planLayoutKey(plan: ScopePhosphorPlan): string {
    const levels = plan.bloomLevels.map(level => level.resolutionScale.toFixed(3)).join(',')
    return `${plan.hdr.targetFormat}:${plan.persistenceResolutionScale}:${levels}`
  }

  /**
   * Ensures targets exist at the right size and format.
   *
   * Returns true when anything was allocated or resized, so the caller can clear
   * persistence deliberately rather than inheriting whatever the driver left in
   * a fresh texture.
   */
  ensure(plan: ScopePhosphorPlan, size: ScopePhosphorTargetSize): boolean {
    if (this.disposed) return false
    const gl = this.gl
    if (gl.isContextLost()) return false

    const width = Math.max(MIN_TARGET_PX, Math.floor(size.width))
    const height = Math.max(MIN_TARGET_PX, Math.floor(size.height))
    const key = ScopePhosphorTargets.planLayoutKey(plan)

    const layoutChanged = key !== this.planKey
    const sizeChanged = width !== this.width || height !== this.height
    if (!layoutChanged && !sizeChanged && this.scene) return false

    if (layoutChanged) this.releaseTargets()

    const format = plan.hdr.targetFormat
    const filter = plan.hdr.linearFiltering ? 'linear' : 'nearest'

    if (!this.scene) {
      this.scene = new ShaderFramebuffer(gl, { format, filter, wrap: 'clamp' })
    }
    this.scene.resize(width, height)

    if (!this.persistence) {
      this.persistence = new ShaderPingPongBuffer(gl, format, filter, 'clamp')
    }
    const persistenceScale = plan.persistenceResolutionScale
    this.persistence.resize(
      Math.max(MIN_TARGET_PX, Math.floor(width * persistenceScale)),
      Math.max(MIN_TARGET_PX, Math.floor(height * persistenceScale)),
    )

    // Bloom targets are read back at a larger size than they were written, so
    // linear filtering matters more here than for the 1:1 scene and persistence
    // targets. Requested wherever the device allows it; when float-linear is
    // missing this falls back to nearest, which with a Gaussian that reaches its
    // tail costs slight stepping rather than a hard-edged footprint.
    const bloomFilter = filter
    while (this.bloom.length < plan.bloomLevels.length) {
      this.bloom.push(new ShaderFramebuffer(gl, { format, filter: bloomFilter, wrap: 'clamp' }))
      this.bloomScratch.push(new ShaderFramebuffer(gl, { format, filter: bloomFilter, wrap: 'clamp' }))
    }
    for (let i = 0; i < plan.bloomLevels.length; i++) {
      const scale = plan.bloomLevels[i].resolutionScale
      const levelWidth = Math.max(MIN_TARGET_PX, Math.floor(width * scale))
      const levelHeight = Math.max(MIN_TARGET_PX, Math.floor(height * scale))
      this.bloom[i].resize(levelWidth, levelHeight)
      // The separable blur needs somewhere to put the horizontal pass; it must
      // match the level exactly so the vertical pass's texel maths is right.
      this.bloomScratch[i].resize(levelWidth, levelHeight)
    }

    // Only allocated when the tier can run CRT; otherwise the composite writes
    // straight to the canvas and this target would be pure cost.
    if (plan.crtEnabled) {
      if (!this.presentation) {
        this.presentation = new ShaderFramebuffer(gl, { format: 'rgba8', filter: 'linear', wrap: 'clamp' })
      }
      this.presentation.resize(width, height)
    } else if (this.presentation) {
      this.presentation.dispose()
      this.presentation = null
    }

    this.width = width
    this.height = height
    this.planKey = key
    return true
  }

  get sceneTarget(): ShaderFramebuffer | null {
    return this.scene
  }

  get persistenceBuffer(): ShaderPingPongBuffer | null {
    return this.persistence
  }

  /** Bloom target for a level index, or null when the tier does not run it. */
  bloomTarget(level: number): ShaderFramebuffer | null {
    return this.bloom[level] ?? null
  }

  /** Horizontal-pass scratch target for a bloom level. */
  bloomScratchTarget(level: number): ShaderFramebuffer | null {
    return this.bloomScratch[level] ?? null
  }

  /** Tone-mapped intermediate, present only when a CRT pass follows. */
  get presentationTarget(): ShaderFramebuffer | null {
    return this.presentation
  }

  /**
   * Throws when `texture` is the persistence buffer's current write target.
   *
   * Called before binding a sampler in the persistence pass. Sampling the
   * texture being written is undefined behaviour in WebGL; it typically shows as
   * a black or garbage frame with no error reported, which is a genuinely
   * expensive bug to find by eye. Failing loudly at the bind site is cheaper.
   */
  assertNotSampling(texture: WebGLTexture | null, label: string): void {
    if (!texture || !this.persistence) return
    const writeTexture = this.persistence.writeTexture
    if (writeTexture && texture === writeTexture) {
      throw new Error(
        `[ScopePhosphorTargets] ${label} would sample the texture currently attached ` +
        'as the persistence write target. Swap the ping-pong buffer before reading it.',
      )
    }
  }

  /** Clears persistence to black. Used on reset, resize, and discontinuity. */
  clearPersistence(): void {
    if (this.disposed) return
    this.persistence?.clear()
  }

  /**
   * Releases dimension- and format-dependent targets, keeping the instance
   * reusable. Called on context loss, where the underlying GL objects are gone
   * but the owner outlives them.
   */
  releaseTargets(): void {
    this.scene?.dispose()
    this.scene = null
    this.persistence?.dispose()
    this.persistence = null
    for (const target of this.bloom) target.dispose()
    this.bloom = []
    for (const target of this.bloomScratch) target.dispose()
    this.bloomScratch = []
    this.presentation?.dispose()
    this.presentation = null
    this.width = 0
    this.height = 0
    this.planKey = ''
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.releaseTargets()
  }

  /** Diagnostics for tests and telemetry. Not part of the render contract. */
  getDiagnostics(): {
    width: number
    height: number
    bloomLevelCount: number
    hasScene: boolean
    hasPersistence: boolean
    disposed: boolean
  } {
    return {
      width: this.width,
      height: this.height,
      bloomLevelCount: this.bloom.length,
      hasScene: this.scene != null,
      hasPersistence: this.persistence != null,
      disposed: this.disposed,
    }
  }
}
