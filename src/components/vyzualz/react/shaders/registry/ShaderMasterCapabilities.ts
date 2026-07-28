import type { ShaderDefinition, ShaderMasterCapabilities } from './shaderRegistryTypes'

const MASTER_UNIFORMS: Readonly<Record<keyof ShaderMasterCapabilities, string>> = Object.freeze({
  intensity: 'uMasterIntensity',
  motion: 'uMasterMotion',
  glow: 'uMasterGlow',
  bassReactivity: 'uMasterBassReactivity',
})

function shaderSources(definition: ShaderDefinition): string {
  return [
    definition.vertSrc === 'shared' ? '' : definition.vertSrc ?? '',
    definition.fragSrc ?? '',
    ...(definition.passes ?? []).flatMap(pass => [pass.vertSrc ?? '', pass.fragSrc ?? '']),
  ].join('\n')
}

function executableSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\buniform\s+[^;]+;/g, '')
}

/** Generate capability truth from actual executable uniform references. */
export function detectShaderMasterCapabilities(definition: ShaderDefinition): ShaderMasterCapabilities {
  const source = executableSource(shaderSources(definition))
  return Object.freeze(Object.fromEntries(
    Object.entries(MASTER_UNIFORMS).map(([key, uniform]) => [
      key,
      new RegExp(`\\b${uniform}\\b`).test(source),
    ]),
  ) as unknown as ShaderMasterCapabilities)
}

export function shaderMasterCapabilitiesMatchSource(definition: ShaderDefinition): boolean {
  const detected = detectShaderMasterCapabilities(definition)
  const declared = definition.masterCapabilities ?? detected
  return (Object.keys(MASTER_UNIFORMS) as Array<keyof ShaderMasterCapabilities>)
    .every(key => declared[key] === detected[key])
}
