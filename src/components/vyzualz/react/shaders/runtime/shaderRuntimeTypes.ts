// ── Dimensions and quality ────────────────────────────────────────────────────

export interface RuntimeDimensions {
  W: number
  H: number
  aspect: number
  pixelRatio: number
}

export interface RuntimeQuality {
  resolutionScale: number
}

// ── Compile and link errors ───────────────────────────────────────────────────

export interface ShaderCompileFailure {
  stage: 'vertex' | 'fragment'
  label: string
  log: string
  /** Source lines around the failing line, with >>> marker on the error line. */
  annotatedSource?: string
}

export interface ShaderLinkError {
  stage: 'link'
  label: string
  log: string
}

export type ShaderProgramError = ShaderCompileFailure | ShaderLinkError

// ── Texture configuration ─────────────────────────────────────────────────────

export type TextureFormat = 'rgba8' | 'r8' | 'rgba16f' | 'rgba32f'

export type TextureWrap = 'clamp' | 'repeat' | 'mirror'

export type TextureFilter = 'linear' | 'nearest'

export interface TextureDescriptor {
  format?: TextureFormat
  wrap?: TextureWrap
  filter?: TextureFilter
}

/** A single texture unit binding for use in a fullscreen render pass. */
export interface TextureBinding {
  unit: number
  texture: WebGLTexture
  uniformName: string
}

// ── Framebuffer configuration ─────────────────────────────────────────────────

export interface FramebufferDescriptor {
  format?: TextureFormat
  filter?: TextureFilter
  wrap?: TextureWrap
  /** Allocate and attach a DEPTH_COMPONENT16 renderbuffer. */
  depth?: boolean
}

// ── Render pass options ───────────────────────────────────────────────────────

export interface RenderPassOptions {
  /** Clear the target framebuffer before drawing. */
  clear?: boolean
  /** Override viewport; defaults to full target dimensions. */
  viewport?: { x: number; y: number; w: number; h: number }
}

// ── Frame state ───────────────────────────────────────────────────────────────

export interface FrameState {
  /** Seconds since runtime creation. */
  time: number
  /** Seconds since the previous frame (capped at 0.1 to avoid spiral-of-death). */
  deltaTime: number
  dims: RuntimeDimensions
}
