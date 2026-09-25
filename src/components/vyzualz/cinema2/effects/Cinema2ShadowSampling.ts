import type { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import type { Cinema2ShadowFrame } from '../runtime/Cinema2ShadowService'

/**
 * Shared GLSL and uniform upload for effects that sample the engine shadow map (roadmap #10). Include `CINEMA2_SHADOW_GLSL_UNIFORMS`
 * and `CINEMA2_SHADOW_GLSL_FUNCTIONS` in a fragment shader, bind the map with `shadowTextureBinding`, and call `uploadCinema2ShadowUniforms`.
 * With `u_shadowIndex < 0` (no shadow map this frame) `shadowVisibility` is never called, but the sampler must still point at a valid
 * depth-comparison texture, hence the fallback texture.
 */
export const CINEMA2_SHADOW_UNIT = 4

export const CINEMA2_SHADOW_GLSL_UNIFORMS = `
uniform highp sampler2DShadow u_shadowMap;
uniform mat4 u_shadowMatrix;
uniform int u_shadowIndex;
// x: depth bias in map depth units, y: filter step in uv, z: strength (0 = shadows ignored), w: 1 when more than one tap is wanted.
uniform vec4 u_shadowParams;
`

export const CINEMA2_SHADOW_GLSL_FUNCTIONS = `
// 1 = lit, 0 = fully shadowed. Points outside the map (or beyond its far plane) are lit.
float shadowVisibility(vec3 p) {
  vec4 clip = u_shadowMatrix * vec4(p, 1.0);
  vec3 s = clip.xyz / clip.w * 0.5 + 0.5;
  if (s.x <= 0.0 || s.x >= 1.0 || s.y <= 0.0 || s.y >= 1.0 || s.z >= 1.0) return 1.0;
  float ref = s.z - u_shadowParams.x;
  float v = texture(u_shadowMap, vec3(s.xy, ref));
  if (u_shadowParams.w > 0.5) {
    float o = u_shadowParams.y;
    v = v * 0.36
      + 0.16 * (texture(u_shadowMap, vec3(s.xy + vec2(o, 0.0), ref)) + texture(u_shadowMap, vec3(s.xy - vec2(o, 0.0), ref))
              + texture(u_shadowMap, vec3(s.xy + vec2(0.0, o), ref)) + texture(u_shadowMap, vec3(s.xy - vec2(0.0, o), ref)));
  }
  return mix(1.0, v, u_shadowParams.z);
}
`

export const CINEMA2_SHADOW_UNIFORM_NAMES = ['u_shadowMap', 'u_shadowMatrix', 'u_shadowIndex', 'u_shadowParams'] as const

/** A 1x1 depth-comparison texture bound when there is no shadow map, so the shadow sampler never points at an incompatible texture. */
export function createCinema2ShadowFallbackTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const texture = gl.createTexture()
  if (!texture) return null
  const previous = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null
  try {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, 1, 1)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL)
    return texture
  } catch {
    // A host without depth textures simply has no shadow support; effects then never sample the map.
    gl.deleteTexture(texture)
    return null
  } finally {
    gl.bindTexture(gl.TEXTURE_2D, previous)
  }
}

/**
 * Uploads the shadow uniforms for one draw. `shadowIndex` is the packed index of the shadow-casting light in the effect's own light
 * arrays (-1 when it is not among them). `strength` is the effect's `shadowStrength` parameter.
 */
export function uploadCinema2ShadowUniforms(
  program: ShaderProgram,
  shadow: Readonly<Cinema2ShadowFrame> | null,
  shadowIndex: number,
  strength: number,
): void {
  const active = shadow != null && shadowIndex >= 0 && strength > 0.001
  program.setInt('u_shadowIndex', active ? shadowIndex : -1)
  if (!active || !shadow) return
  program.setMat4('u_shadowMatrix', shadow.viewProjection)
  const filterStep = Math.max(shadow.softness, 0) / shadow.resolution
  program.setVec4('u_shadowParams', shadow.bias / Math.max(shadow.depthRange, 1e-3), filterStep, strength, shadow.softness > 0.05 ? 1 : 0)
}
