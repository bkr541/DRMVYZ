export * from './Cinema2GlassfallPhase5Definition'
import { GLASSFALL_PHASE5_MANIFEST } from './Cinema2GlassfallPhase5Definition'
import { cinema2GlassfallPhase5Module } from '../modules/glassfall/Cinema2GlassfallNativeModule'
import { Cinema2ModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2PresetRegistry } from './Cinema2PresetRegistry'
export function createGlassfallPhase5Registries() {
  const presetRegistry = new Cinema2PresetRegistry(), moduleRegistry = new Cinema2ModuleRegistry()
  for (const result of [moduleRegistry.register(cinema2GlassfallPhase5Module), presetRegistry.register(GLASSFALL_PHASE5_MANIFEST)]) if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return { presetRegistry, moduleRegistry }
}
