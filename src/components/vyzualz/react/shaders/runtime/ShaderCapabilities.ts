import type { TextureFormat } from './shaderRuntimeTypes'

// ── ShaderCapabilities ────────────────────────────────────────────────────────
//
// Detects the two WebGL2 extensions that gate safe use of floating-point
// render targets:
//
//   EXT_color_buffer_float — required to render INTO (attach as a framebuffer
//     color attachment) an rgba16f/rgba32f texture. Without it, allocating an
//     FBO with a float format will produce FRAMEBUFFER_INCOMPLETE_ATTACHMENT
//     on many drivers even though the texture itself uploads fine.
//   EXT_float_blend — required to enable gl.BLEND while the draw target is a
//     float format. Some drivers support float render targets but reject
//     blending into them (additive bloom accumulation needs this).
//
// Detection is cheap (a cached getExtension call) but is still centralised
// here so every float-target consumer (framebuffers, ping-pong buffers, the
// two-channel waveform texture) shares one source of truth instead of each
// re-deriving its own fallback policy.

export interface ShaderFloatTargetCapability {
  /** True when rendering into an rgba16f/rgba32f framebuffer is safe. */
  readonly colorBufferFloat: boolean
  /** True when gl.BLEND is safe while drawing into a float target. */
  readonly floatBlend: boolean
}

export function detectShaderFloatTargetCapability(gl: WebGL2RenderingContext): ShaderFloatTargetCapability {
  return {
    colorBufferFloat: gl.getExtension('EXT_color_buffer_float') !== null,
    floatBlend: gl.getExtension('EXT_float_blend') !== null,
  }
}

/**
 * Resolve the texture format a pass should actually use, downgrading to
 * 'rgba8' when the device cannot safely support the requested float format.
 *
 * `needsBlending` should be true whenever the pass's resolved BlendMode is
 * anything other than 'none' — additive bloom accumulation is exactly the
 * case EXT_float_blend exists for.
 */
export function resolveShaderTextureFormat(
  requested: TextureFormat,
  needsBlending: boolean,
  capability: ShaderFloatTargetCapability,
  warn?: (message: string) => void,
): TextureFormat {
  if (requested !== 'rgba16f' && requested !== 'rgba32f') return requested

  if (!capability.colorBufferFloat) {
    warn?.(`[ShaderCapabilities] ${requested} render target requested but EXT_color_buffer_float is unavailable — falling back to rgba8.`)
    return 'rgba8'
  }

  if (needsBlending && !capability.floatBlend) {
    warn?.(`[ShaderCapabilities] ${requested} render target with blending requested but EXT_float_blend is unavailable — falling back to rgba8.`)
    return 'rgba8'
  }

  return requested
}
