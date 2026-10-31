export * from './Cinema2GlassfallPhase3Definition'
import { GLASSFALL_PHASE3_MANIFEST } from './Cinema2GlassfallPhase3Definition'
import { cinema2GlassfallPhase3Module } from '../modules/glassfall/Cinema2GlassfallNativeModule'
import { Cinema2ModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2PresetRegistry } from './Cinema2PresetRegistry'
export function createGlassfallPhase3Registries() {
  const presetRegistry = new Cinema2PresetRegistry(), moduleRegistry = new Cinema2ModuleRegistry()
  for (const result of [moduleRegistry.register(cinema2GlassfallPhase3Module), presetRegistry.register(GLASSFALL_PHASE3_MANIFEST)]) if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return { presetRegistry, moduleRegistry }
}
