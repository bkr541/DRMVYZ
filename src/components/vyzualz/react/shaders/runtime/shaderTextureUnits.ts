export interface ShaderReservedTextureUnits {
  brandLogo: number
  brandTexture: number
  brandBackground: number
  spectrum: number
  waveform: number
  firstReserved: number
  maxUnits: number
}

const CACHE = new WeakMap<WebGL2RenderingContext, ShaderReservedTextureUnits>()

/**
 * Reserve the top five fragment texture units so scene inputs and gradients can
 * grow upward from unit zero without colliding with universal engine inputs.
 * WebGL2 guarantees at least 16 fragment texture units.
 */
export function getShaderReservedTextureUnits(
  gl: WebGL2RenderingContext,
): ShaderReservedTextureUnits {
  const cached = CACHE.get(gl)
  if (cached) return cached
  const reported = Number(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS))
  const maxUnits = Number.isFinite(reported) ? Math.max(16, Math.floor(reported)) : 16
  const units: ShaderReservedTextureUnits = {
    brandLogo: maxUnits - 5,
    brandTexture: maxUnits - 4,
    brandBackground: maxUnits - 3,
    spectrum: maxUnits - 2,
    waveform: maxUnits - 1,
    firstReserved: maxUnits - 5,
    maxUnits,
  }
  CACHE.set(gl, units)
  return units
}
