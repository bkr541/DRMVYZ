import type { ShaderDefinition, ShaderParamValues } from '../registry/shaderRegistryTypes'
import { resolveEnginePresetProvenance } from '../../ReactPresetProvenance'

export function resolveShaderSceneProvenance(
  definition: ShaderDefinition,
  values: ShaderParamValues,
) {
  const actualPresetValues = Object.fromEntries(
    Object.keys(definition.defaults).map(key => [key, values[key] ?? definition.defaults[key]]),
  )
  return resolveEnginePresetProvenance({
    presetId: definition.id,
    presetName: definition.name,
    expectedValues: definition.defaults,
    actualValues: actualPresetValues,
  })
}
