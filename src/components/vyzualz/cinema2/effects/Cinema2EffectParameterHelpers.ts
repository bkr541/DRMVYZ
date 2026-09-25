import type { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import type { Cinema2EffectManifest, Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2EffectDiagnostic } from './Cinema2EffectContracts'

/** Shared parameter validation/reading for built-in effects with many optional numeric controls. */

export type Cinema2EffectNumericRange = readonly [name: string, min: number, max: number]

export function clampEffectValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function readEffectNumber(values: Readonly<Record<string, Cinema2JsonValue>>, name: string, fallback: number): number {
  const value = values[name]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** An [r, g, b] or [r, g, b, a] color with 0..1 components. */
export function isEffectColor(value: unknown): value is readonly number[] {
  return Array.isArray(value)
    && (value.length === 3 || value.length === 4)
    && value.every(component => typeof component === 'number' && Number.isFinite(component) && component >= 0 && component <= 1)
}

export function readEffectColor(value: Cinema2JsonValue | undefined, fallback: readonly [number, number, number]): readonly [number, number, number] {
  return isEffectColor(value) ? [value[0], value[1], value[2]] : fallback
}

/** `mix` is required; every listed numeric parameter and color is validated only when authored. */
export function validateEffectParameters(
  effect: Readonly<Cinema2EffectManifest>,
  numbers: readonly Cinema2EffectNumericRange[],
  colors: readonly string[] = [],
): readonly Cinema2EffectDiagnostic[] {
  const diagnostics: Cinema2EffectDiagnostic[] = []
  const mix = effect.parameters?.mix
  if (typeof mix !== 'number' || !Number.isFinite(mix) || mix < 0 || mix > 1) {
    diagnostics.push({ code: 'CINEMA2_EFFECT_MIX_INVALID', path: '$.parameters.mix', message: 'Effect mix must be a finite number between 0 and 1.' })
  }
  for (const [name, min, max] of numbers) {
    const value = effect.parameters?.[name]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      diagnostics.push({ code: 'CINEMA2_EFFECT_PARAMETER_INVALID', path: `$.parameters.${name}`, message: `Effect parameter "${name}" must be between ${min} and ${max}.` })
    }
  }
  for (const name of colors) {
    const value = effect.parameters?.[name]
    if (value !== undefined && !isEffectColor(value)) {
      diagnostics.push({ code: 'CINEMA2_EFFECT_PARAMETER_INVALID', path: `$.parameters.${name}`, message: `Effect parameter "${name}" must be an [r, g, b] or [r, g, b, a] color with components between 0 and 1.` })
    }
  }
  return Object.freeze(diagnostics)
}

/** Uploads a `float[]` / `vec4[]` uniform array by its `name[0]` location; a missing (optimized-out) uniform is skipped. */
export function setEffectUniformArray(
  gl: WebGL2RenderingContext,
  program: ShaderProgram,
  name: string,
  data: Float32Array,
  components: 1 | 4,
): void {
  const location = program.getUniform(name)
  if (location === null) return
  if (components === 4) gl.uniform4fv(location, data)
  else gl.uniform1fv(location, data)
}
