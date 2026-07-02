import type { BrandPaletteRole } from '../../../../../features/personalization/BrandKitTypes'

// ── Categories ────────────────────────────────────────────────────────────────

export type ShaderCategory =
  | 'generator'
  | 'effect'
  | 'simulation'
  | 'particle'
  | 'raymarch'
  | 'fractal'
  | 'feedback'
  | 'utility'

// ── Quality tiers ─────────────────────────────────────────────────────────────

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra'

// ── Blend / filter / wrap modes ───────────────────────────────────────────────

export type BlendMode  = 'none' | 'alpha' | 'additive' | 'multiply' | 'screen'
export type FilterMode = 'linear' | 'nearest'
export type WrapMode   = 'clamp' | 'repeat' | 'mirror'

// ── Shared value types ────────────────────────────────────────────────────────

/** Normalised RGBA, each channel 0..1. */
export type RGBA = [number, number, number, number]

/** Two-component vector. */
export type Vec2 = [number, number]

/** A single colour stop in a gradient. */
export interface GradientStop {
  /** Position along the gradient, 0..1. */
  position: number
  /** Normalised RGBA colour at this stop. */
  color: RGBA
}

// ── Texture source types ──────────────────────────────────────────────────────

export type TextureSourceType =
  | 'uploaded-image'
  | 'uploaded-video'
  | 'media-output'
  | 'logo'
  | 'album-artwork'
  | 'previous-frame'
  | 'shader-output'
  | 'fft'
  | 'waveform'
  | 'noise'
  | 'mask'

// ── Parameter runtime value union ─────────────────────────────────────────────

export type ShaderParamValue =
  | number          // float, integer
  | boolean         // boolean, trigger
  | string          // enum, texture (source identifier or null-sentinel '')
  | null            // texture (unset / no source selected)
  | Vec2            // vec2
  | RGBA            // color
  | GradientStop[]  // gradient

/** A snapshot of all parameter values for a shader scene. */
export type ShaderParamValues = Record<string, ShaderParamValue>

// ── Parameter definitions ─────────────────────────────────────────────────────

interface ShaderParamBase {
  /** Unique identifier within this shader definition. */
  id: string
  /** Human-readable display label. */
  label: string
  /** Optional detailed description shown in inspector UI. */
  description?: string
  /** UI grouping label. */
  group?: string
  /** Hide in basic UI; show only in advanced view. */
  advanced?: boolean
  /** Whether this parameter can be driven by modulation sources. */
  modulatable?: boolean
  /** Exact GLSL uniform name as it appears in the shader source. */
  uniformName: string
}

export interface FloatParamDef extends ShaderParamBase {
  type: 'float'
  min: number
  max: number
  step?: number
  default: number
  unit?: string
  /** Distribute slider values on a logarithmic scale. */
  logarithmic?: boolean
}

export interface IntegerParamDef extends ShaderParamBase {
  type: 'integer'
  min: number
  max: number
  step?: number
  default: number
  unit?: string
}

export interface BooleanParamDef extends ShaderParamBase {
  type: 'boolean'
  default: boolean
}

export interface ColorParamDef extends ShaderParamBase {
  type: 'color'
  /** Semantic Brand Kit role resolved at render time without mutating presets. */
  brandRole?: BrandPaletteRole
  /** Normalised RGBA default, each channel 0..1. */
  default: RGBA
}

export interface GradientParamDef extends ShaderParamBase {
  type: 'gradient'
  default: GradientStop[]
}

export interface EnumOption {
  value: string
  label: string
}

export interface EnumParamDef extends ShaderParamBase {
  type: 'enum'
  values: EnumOption[]
  default: string
  /** Upload as `int` uniform (uniform1i). Defaults to `float` (uniform1f). */
  uniformType?: 'float' | 'int'
}

export interface Vec2ParamDef extends ShaderParamBase {
  type: 'vec2'
  min: Vec2
  max: Vec2
  step?: Vec2
  default: Vec2
}

/**
 * Trigger — a momentary event rather than a persistent value.
 * The uniform receives 1.0 for one frame when triggered, then 0.0.
 * Trigger params have no default state; `modulatable` is always false.
 */
export interface TriggerParamDef extends ShaderParamBase {
  type: 'trigger'
}

export interface TextureParamDef extends ShaderParamBase {
  type: 'texture'
  /** Texture source types this input will accept. */
  acceptedSources: TextureSourceType[]
}

export type ShaderParamDef =
  | FloatParamDef
  | IntegerParamDef
  | BooleanParamDef
  | ColorParamDef
  | GradientParamDef
  | EnumParamDef
  | Vec2ParamDef
  | TriggerParamDef
  | TextureParamDef

// ── Pass input binding ────────────────────────────────────────────────────────

/**
 * Explicit binding from a texture source to a GLSL sampler uniform.
 * Used when the sampler name in GLSL differs from the logical texture name.
 */
export interface ShaderPassInputBinding {
  /** Logical source name: a textureInputs key or another pass's output name. */
  source: string
  /** Exact GLSL sampler2D uniform name as it appears in the shader source. */
  uniformName: string
}

// ── Render-pass definition ────────────────────────────────────────────────────

/**
 * Metadata for one render pass in a multi-pass shader.
 * Single-pass shaders set `fragSrc` directly on `ShaderDefinition` and
 * leave `passes` empty.
 */
export interface ShaderPassDef {
  /** Unique ID within this definition (used in `dependsOn` references). */
  id: string
  /** GLSL 300 es fragment shader source for this pass. */
  fragSrc: string
  /**
   * Optional custom vertex shader.  When absent the shared fullscreen
   * triangle vertex shader (FULLSCREEN_VERT_SRC) is used.
   */
  vertSrc?: string
  /**
   * Inputs consumed by this pass.  Each entry is either:
   *   - A plain string (source name = GLSL sampler name after hyphens→underscores), or
   *   - An explicit `{ source, uniformName }` binding when the GLSL name differs.
   * The source must be a key in the parent definition's `textureInputs` or the
   * `output` name of another pass in the same definition.
   */
  inputs: (string | ShaderPassInputBinding)[]
  /** Name by which later passes (or the final composite) refer to this output. */
  output: string
  /** 0.05..4.0, default 1.0. */
  resolutionScale?: number
  /** Clear the render target before drawing. */
  clearBeforeRender?: boolean
  /** Keep this render target alive between frames (required for feedback effects). */
  persistent?: boolean
  /**
   * When true the render graph allocates a ShaderPingPongBuffer for this pass
   * instead of a single FBO.  The pass reads its own previous output (using
   * this pass's `output` name as an input) and writes to the write buffer.
   * After each frame the buffers are swapped automatically.
   */
  pingPong?: boolean
  blendMode?: BlendMode
  filter?: FilterMode
  wrap?: WrapMode
  /** IDs of passes that must complete before this pass runs. */
  dependsOn?: string[]
}

// ── Texture input declaration ─────────────────────────────────────────────────

/**
 * Declares an external texture that this shader scene can receive.
 * The `name` is used to match entries in `ShaderPassDef.inputs`.
 */
export interface TextureInputDef {
  name: string
  label: string
  source: TextureSourceType
  required?: boolean
  description?: string
}

// ── Quality requirements ──────────────────────────────────────────────────────

export interface QualityRequirements {
  minimumTier?: QualityTier
  recommendedTier?: QualityTier
  /** Ray-march step budget at each quality tier. */
  rayMarchSteps?: { min: number; recommended: number; max: number }
  /** Generic iteration limit (fractals, cellular automata, etc.). */
  iterationLimit?: { min: number; recommended: number; max: number }
  /** Simulation grid resolution scaling. */
  simulationResolution?: { min: number; recommended: number }
  /** Maximum number of simulated particles. */
  particleLimit?: { min: number; recommended: number; max: number }
  /** Approximate number of render passes per frame. */
  estimatedPassCount?: number
  /** Scene requires an fp16/fp32 render target. */
  requiresFloatTarget?: boolean
  /** Scene requires ping-pong or persistent FBOs. */
  requiresPersistentBuffers?: boolean
}

// ── Optional metadata ─────────────────────────────────────────────────────────

export interface ThumbnailMeta {
  /** Fallback solid colour shown before a preview image loads (CSS colour string). */
  color?: string
  /** Path to a static preview image asset. */
  previewSrc?: string
}

export interface FeedbackRequirements {
  /** Number of ping-pong FBO pairs required. */
  pingPongBuffers?: number
  /** Number of historical frames to retain. */
  historyFrames?: number
}

/**
 * Declarative reset conditions for scenes that use ShaderFeedbackController.
 * Mirrors FeedbackResetConfig from the feedback module so shader authors can
 * encode reset behaviour alongside the definition without a circular import.
 */
export interface ShaderFeedbackResetConfig {
  onSceneChange?:       boolean
  onTrackChange?:       boolean
  onPlaybackRestart?:   boolean
  onSectionChange?:     boolean
  onDropImpact?:        boolean
  dropImpactThreshold?: number
  onResolutionChange?:  boolean
  onContextRestore?:    boolean
}

export interface TransitionCompatibility {
  supportsGpuTransitions?: boolean
  /** GPU transition type identifiers compatible with this scene. */
  supportedTransitionTypes?: string[]
}

// ── ShaderDefinition ──────────────────────────────────────────────────────────

/**
 * Complete declarative description of a GLSL shader scene.
 * The registry stores these; the runtime consumes them to compile programs
 * and allocate resources.  No WebGL objects are created here.
 */
export interface ShaderDefinition {
  /** Globally unique stable identifier (kebab-case, e.g. 'my-scene-id'). */
  id: string
  name: string
  description: string
  category: ShaderCategory
  /** Monotonically increasing schema version for forward-compat migrations. */
  version: number

  /**
   * Vertex shader source, or `'shared'` to use the built-in fullscreen
   * triangle vertex shader.  Defaults to `'shared'` when absent.
   */
  vertSrc?: string | 'shared'

  /**
   * Fragment shader source for single-pass scenes.
   * Multi-pass scenes define `passes` instead (or in addition for a final
   * composite pass).  At least one of `fragSrc` or `passes` must be present.
   */
  fragSrc?: string

  /** Parameter schema — order determines display order in the inspector. */
  params: ShaderParamDef[]

  /**
   * Default parameter values keyed by `param.id`.
   * Must include all non-trigger, non-texture params.
   */
  defaults: ShaderParamValues

  /** Multi-pass render pipeline.  Empty or absent for single-pass scenes. */
  passes?: ShaderPassDef[]

  /** External textures this scene can consume. */
  textureInputs?: TextureInputDef[]

  quality?: QualityRequirements

  tags?: string[]

  thumbnail?: ThumbnailMeta

  /** Reset simulation / feedback state when the scene is activated. */
  resetOnActivation?: boolean

  feedback?: FeedbackRequirements

  /** Per-definition reset conditions for ShaderFeedbackController. */
  feedbackReset?: ShaderFeedbackResetConfig

  transitions?: TransitionCompatibility
}

// ── Validation types ──────────────────────────────────────────────────────────

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}
