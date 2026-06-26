import type {
  ShaderParamDef,
  ShaderParamValue,
  FloatParamDef,
  IntegerParamDef,
  BooleanParamDef,
  ColorParamDef,
  GradientParamDef,
  EnumParamDef,
  Vec2ParamDef,
  TriggerParamDef,
  TextureParamDef,
  RGBA,
  Vec2,
  GradientStop,
} from './shaderRegistryTypes'

// ── Type guards ───────────────────────────────────────────────────────────────

export function isFloatParam(p: ShaderParamDef):    p is FloatParamDef    { return p.type === 'float' }
export function isIntegerParam(p: ShaderParamDef):  p is IntegerParamDef  { return p.type === 'integer' }
export function isBooleanParam(p: ShaderParamDef):  p is BooleanParamDef  { return p.type === 'boolean' }
export function isColorParam(p: ShaderParamDef):    p is ColorParamDef    { return p.type === 'color' }
export function isGradientParam(p: ShaderParamDef): p is GradientParamDef { return p.type === 'gradient' }
export function isEnumParam(p: ShaderParamDef):     p is EnumParamDef     { return p.type === 'enum' }
export function isVec2Param(p: ShaderParamDef):     p is Vec2ParamDef     { return p.type === 'vec2' }
export function isTriggerParam(p: ShaderParamDef):  p is TriggerParamDef  { return p.type === 'trigger' }
export function isTextureParam(p: ShaderParamDef):  p is TextureParamDef  { return p.type === 'texture' }

/** Whether the parameter has a numeric range (min/max). */
export function isNumericParam(p: ShaderParamDef): p is FloatParamDef | IntegerParamDef {
  return p.type === 'float' || p.type === 'integer'
}

/** Whether the parameter carries a meaningful default value (triggers don't). */
export function hasDefault(p: ShaderParamDef): p is Exclude<ShaderParamDef, TriggerParamDef> {
  return p.type !== 'trigger'
}

// ── Default value extraction ──────────────────────────────────────────────────

/**
 * Return the built-in default value declared on the parameter definition.
 * Returns `undefined` for trigger params (they have no persistent state).
 */
export function getParamDefault(p: ShaderParamDef): ShaderParamValue | undefined {
  switch (p.type) {
    case 'float':    return p.default
    case 'integer':  return p.default
    case 'boolean':  return p.default
    case 'color':    return p.default
    case 'gradient': return p.default
    case 'enum':     return p.default
    case 'vec2':     return p.default
    case 'trigger':  return undefined
    case 'texture':  return null
  }
}

// ── GLSL uniform type mapping ─────────────────────────────────────────────────

/**
 * Return the GLSL type keyword for the uniform that represents this parameter.
 *
 * Callers use this to verify the shader source contains a matching declaration.
 */
export function getGLSLUniformType(p: ShaderParamDef): string {
  switch (p.type) {
    case 'float':    return 'float'
    case 'integer':  return 'int'
    case 'boolean':  return 'bool'
    case 'color':    return 'vec4'
    case 'gradient': return 'sampler2D'  // uploaded as a 1-D LUT texture
    case 'enum':     return 'int'         // enum maps to integer discriminant
    case 'vec2':     return 'vec2'
    case 'trigger':  return 'float'       // 1.0 when triggered, else 0.0
    case 'texture':  return 'sampler2D'
  }
}

// ── Value validation ──────────────────────────────────────────────────────────

export interface ParamValueError {
  message: string
}

/**
 * Validate a runtime value against a parameter's schema.
 * Returns null when the value is valid, or an error object otherwise.
 */
export function validateParamValue(
  param: ShaderParamDef,
  value: ShaderParamValue,
): ParamValueError | null {
  switch (param.type) {
    case 'float':
    case 'integer': {
      if (typeof value !== 'number') return { message: `expected number, got ${typeof value}` }
      if (value < param.min) return { message: `${value} is below min ${param.min}` }
      if (value > param.max) return { message: `${value} is above max ${param.max}` }
      return null
    }
    case 'boolean':
    case 'trigger': {
      if (typeof value !== 'boolean') return { message: `expected boolean, got ${typeof value}` }
      return null
    }
    case 'color': {
      if (!isRGBA(value)) return { message: 'expected [r, g, b, a] with values in 0..1' }
      for (let i = 0; i < 4; i++) {
        if ((value as RGBA)[i] < 0 || (value as RGBA)[i] > 1) {
          return { message: `color channel ${i} (${(value as RGBA)[i]}) is out of range 0..1` }
        }
      }
      return null
    }
    case 'gradient': {
      if (!Array.isArray(value)) return { message: 'expected GradientStop[]' }
      for (const stop of value as GradientStop[]) {
        if (typeof stop.position !== 'number' || stop.position < 0 || stop.position > 1) {
          return { message: `gradient stop position ${stop.position} is out of range 0..1` }
        }
        if (!isRGBA(stop.color)) {
          return { message: 'gradient stop color must be [r, g, b, a]' }
        }
      }
      return null
    }
    case 'enum': {
      if (typeof value !== 'string') return { message: `expected string, got ${typeof value}` }
      const valid = param.values.some(v => v.value === value)
      if (!valid) {
        const allowed = param.values.map(v => v.value).join(', ')
        return { message: `"${value}" is not a valid enum value (allowed: ${allowed})` }
      }
      return null
    }
    case 'vec2': {
      if (!isVec2(value)) return { message: 'expected [x, y] tuple' }
      const [x, y] = value as Vec2
      if (x < param.min[0]) return { message: `x ${x} is below min ${param.min[0]}` }
      if (x > param.max[0]) return { message: `x ${x} is above max ${param.max[0]}` }
      if (y < param.min[1]) return { message: `y ${y} is below min ${param.min[1]}` }
      if (y > param.max[1]) return { message: `y ${y} is above max ${param.max[1]}` }
      return null
    }
    case 'texture': {
      if (value !== null && typeof value !== 'string') {
        return { message: `expected string or null, got ${typeof value}` }
      }
      return null
    }
  }
}

// ── Internal shape helpers ────────────────────────────────────────────────────

function isRGBA(v: ShaderParamValue): boolean {
  return Array.isArray(v) && v.length === 4 && (v as number[]).every(n => typeof n === 'number')
}

function isVec2(v: ShaderParamValue): boolean {
  return Array.isArray(v) && v.length === 2 && (v as number[]).every(n => typeof n === 'number')
}
