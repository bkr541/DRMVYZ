export * from './Cinema2GlassfallPhase1Definition'
import { GLASSFALL_PHASE1_MANIFEST } from './Cinema2GlassfallPhase1Definition'
import { cinema2GlassfallPhase1Module } from '../modules/glassfall/Cinema2GlassfallNativeModule'
import { Cinema2ModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2PresetRegistry } from './Cinema2PresetRegistry'
export function createGlassfallPhase1Registries() {
  const presetRegistry = new Cinema2PresetRegistry(), moduleRegistry = new Cinema2ModuleRegistry()
  for (const result of [moduleRegistry.register(cinema2GlassfallPhase1Module), presetRegistry.register(GLASSFALL_PHASE1_MANIFEST)]) {
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  }
  return { presetRegistry, moduleRegistry }
}
