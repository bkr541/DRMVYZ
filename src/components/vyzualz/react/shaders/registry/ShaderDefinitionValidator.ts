import type { ShaderDefinition, ValidationResult, ValidationError } from './shaderRegistryTypes'
import { validateParamValue, isNumericParam } from './ShaderParameterSchema'

const PASS_RESOLUTION_SCALE_MIN = 0.05
const PASS_RESOLUTION_SCALE_MAX = 4.0

// ── ShaderDefinitionValidator ─────────────────────────────────────────────────

export class ShaderDefinitionValidator {
  /**
   * Validate a single ShaderDefinition.
   * Returns a `ValidationResult` with all accumulated errors; never throws.
   */
  static validate(def: ShaderDefinition): ValidationResult {
    const errors: ValidationError[] = []
    const e = (field: string, message: string) => errors.push({ field, message })

    // ── Identity ─────────────────────────────────────────────────────────────
    if (!def.id || def.id.trim().length === 0) {
      e('id', 'id must be a non-empty string')
    }
    if (!def.name || def.name.trim().length === 0) {
      e('name', 'name must be a non-empty string')
    }

    // ── Fragment source ───────────────────────────────────────────────────────
    const hasSinglePassFrag  = typeof def.fragSrc === 'string' && def.fragSrc.trim().length > 0
    const hasMultiPassPasses = Array.isArray(def.passes) && def.passes.length > 0
    if (!hasSinglePassFrag && !hasMultiPassPasses) {
      e('fragSrc', 'at least one of fragSrc or passes[] must be provided')
    }

    // ── Parameters ────────────────────────────────────────────────────────────
    const paramIds     = new Set<string>()
    const uniformNames = new Set<string>()

    for (const param of def.params) {
      if (paramIds.has(param.id)) {
        e(`params.${param.id}`, `duplicate param id "${param.id}"`)
      }
      paramIds.add(param.id)

      if (uniformNames.has(param.uniformName)) {
        e(`params.${param.id}.uniformName`, `duplicate uniformName "${param.uniformName}"`)
      }
      uniformNames.add(param.uniformName)

      // Numeric range validation
      if (isNumericParam(param)) {
        if (param.min >= param.max) {
          e(`params.${param.id}`, `min (${param.min}) must be less than max (${param.max})`)
        }
        if (param.step !== undefined && param.step <= 0) {
          e(`params.${param.id}.step`, `step must be > 0, got ${param.step}`)
        }
        if (param.default < param.min || param.default > param.max) {
          e(`params.${param.id}.default`,
            `default ${param.default} is outside range [${param.min}, ${param.max}]`)
        }
      }

      // Vec2 range and default validation
      if (param.type === 'vec2') {
        if (param.min[0] >= param.max[0]) {
          e(`params.${param.id}`, `vec2 x: min (${param.min[0]}) must be < max (${param.max[0]})`)
        }
        if (param.min[1] >= param.max[1]) {
          e(`params.${param.id}`, `vec2 y: min (${param.min[1]}) must be < max (${param.max[1]})`)
        }
        const [dx, dy] = param.default
        if (dx < param.min[0] || dx > param.max[0]) {
          e(`params.${param.id}.default`, `x default ${dx} outside range [${param.min[0]}, ${param.max[0]}]`)
        }
        if (dy < param.min[1] || dy > param.max[1]) {
          e(`params.${param.id}.default`, `y default ${dy} outside range [${param.min[1]}, ${param.max[1]}]`)
        }
      }

      // Enum default validation
      if (param.type === 'enum') {
        const validValues = param.values.map(v => v.value)
        if (!validValues.includes(param.default)) {
          e(`params.${param.id}.default`,
            `default "${param.default}" is not in enum values [${validValues.join(', ')}]`)
        }
        if (param.values.length === 0) {
          e(`params.${param.id}.values`, 'enum must define at least one value')
        }
      }

      // Color channel validation
      if (param.type === 'color') {
        const err = validateParamValue(param, param.default)
        if (err) e(`params.${param.id}.default`, err.message)
      }

      // Gradient stop validation
      if (param.type === 'gradient') {
        if (param.default.length === 0) {
          e(`params.${param.id}.default`, 'gradient must have at least one stop')
        }
        for (let i = 0; i < param.default.length; i++) {
          const stop = param.default[i]
          if (stop.position < 0 || stop.position > 1) {
            e(`params.${param.id}.default[${i}]`,
              `gradient stop position ${stop.position} must be in 0..1`)
          }
        }
      }
    }

    // ── defaults map validation ───────────────────────────────────────────────
    for (const key of Object.keys(def.defaults)) {
      if (!paramIds.has(key)) {
        e(`defaults.${key}`, `defaults key "${key}" does not correspond to any param id`)
      } else {
        const param = def.params.find(p => p.id === key)!
        const err = validateParamValue(param, def.defaults[key])
        if (err) {
          e(`defaults.${key}`, `invalid default value for "${key}": ${err.message}`)
        }
      }
    }

    // ── Render-pass validation ────────────────────────────────────────────────
    const passIds  = new Set<string>()
    const passOutputs = new Set<string>()
    const textureInputNames = new Set<string>(
      (def.textureInputs ?? []).map(ti => ti.name),
    )

    for (const pass of def.passes ?? []) {
      if (passIds.has(pass.id)) {
        e(`passes.${pass.id}`, `duplicate pass id "${pass.id}"`)
      }
      passIds.add(pass.id)
      passOutputs.add(pass.output)

      const scale = pass.resolutionScale
      if (scale !== undefined) {
        if (scale < PASS_RESOLUTION_SCALE_MIN || scale > PASS_RESOLUTION_SCALE_MAX) {
          e(`passes.${pass.id}.resolutionScale`,
            `resolutionScale ${scale} is outside valid range [${PASS_RESOLUTION_SCALE_MIN}, ${PASS_RESOLUTION_SCALE_MAX}]`)
        }
      }
    }

    // Second pass: validate dependencies and inputs (requires all pass IDs to be collected first)
    for (const pass of def.passes ?? []) {
      for (const dep of pass.dependsOn ?? []) {
        if (!passIds.has(dep)) {
          e(`passes.${pass.id}.dependsOn`,
            `dependency "${dep}" does not reference an existing pass id`)
        }
        if (dep === pass.id) {
          e(`passes.${pass.id}.dependsOn`, `pass "${pass.id}" cannot depend on itself`)
        }
      }

      for (const input of pass.inputs) {
        const isFromTexInput    = textureInputNames.has(input)
        // Ping-pong passes may read their own output name (the READ side of the buffer);
        // all other passes must read from a different pass's output.
        const isSelfPingPong    = pass.pingPong === true && input === pass.output
        const isFromPassOutput  = passOutputs.has(input) && (input !== pass.output || isSelfPingPong)
        if (!isFromTexInput && !isFromPassOutput) {
          e(`passes.${pass.id}.inputs`,
            `input "${input}" is not declared in textureInputs or produced by any pass output`)
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Validate every definition in the provided array.
   * Duplicate IDs across definitions are reported as errors on the second
   * occurrence.  Returns a map of id → ValidationResult.
   */
  static validateMany(
    defs: ShaderDefinition[],
  ): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {}
    const seenIds = new Set<string>()

    for (const def of defs) {
      const result = ShaderDefinitionValidator.validate(def)

      if (seenIds.has(def.id)) {
        result.valid = false
        result.errors.unshift({ field: 'id', message: `duplicate id "${def.id}"` })
      }
      seenIds.add(def.id)
      results[def.id ?? `_unnamed_${Object.keys(results).length}`] = result
    }

    return results
  }
}
