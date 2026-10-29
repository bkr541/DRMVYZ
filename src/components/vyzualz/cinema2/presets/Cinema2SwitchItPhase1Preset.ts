export * from './Cinema2SwitchItPhase1Definition'
import { SWITCH_IT_PHASE1_MANIFEST } from './Cinema2SwitchItPhase1Definition'
import { Cinema2ModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2PresetRegistry } from './Cinema2PresetRegistry'
import { cinema2SwitchItPhase1Module } from '../modules/switchIt/Cinema2SwitchItPhase1Module'
export function createSwitchItPhase1Registries() {
  const presetRegistry = new Cinema2PresetRegistry(), moduleRegistry = new Cinema2ModuleRegistry()
  const results = [moduleRegistry.register(cinema2SwitchItPhase1Module), presetRegistry.register(SWITCH_IT_PHASE1_MANIFEST)]
  for (const result of results) if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return { presetRegistry, moduleRegistry }
}
