export * from './Cinema2GlassfallPhase2Definition'
import { GLASSFALL_PHASE2_MANIFEST } from './Cinema2GlassfallPhase2Definition'
import { cinema2GlassfallPhase2Module } from '../modules/glassfall/Cinema2GlassfallNativeModule'
import { Cinema2ModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2PresetRegistry } from './Cinema2PresetRegistry'
export function createGlassfallPhase2Registries() {
  const presetRegistry = new Cinema2PresetRegistry(), moduleRegistry = new Cinema2ModuleRegistry()
  for (const result of [moduleRegistry.register(cinema2GlassfallPhase2Module), presetRegistry.register(GLASSFALL_PHASE2_MANIFEST)]) if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return { presetRegistry, moduleRegistry }
}
