export * from './Cinema2GlassfallPhase4Definition'
import { GLASSFALL_PHASE4_MANIFEST } from './Cinema2GlassfallPhase4Definition'
import { cinema2GlassfallPhase4Module } from '../modules/glassfall/Cinema2GlassfallNativeModule'
import { Cinema2ModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2PresetRegistry } from './Cinema2PresetRegistry'
export function createGlassfallPhase4Registries() {
  const presetRegistry = new Cinema2PresetRegistry(), moduleRegistry = new Cinema2ModuleRegistry()
  for (const result of [moduleRegistry.register(cinema2GlassfallPhase4Module), presetRegistry.register(GLASSFALL_PHASE4_MANIFEST)]) if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return { presetRegistry, moduleRegistry }
}
