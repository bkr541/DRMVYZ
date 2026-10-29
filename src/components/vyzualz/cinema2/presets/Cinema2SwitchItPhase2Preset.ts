export * from './Cinema2SwitchItPhase2Definition'
import { SWITCH_IT_PHASE2_MANIFEST } from './Cinema2SwitchItPhase2Definition'
import { Cinema2ModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { Cinema2PresetRegistry } from './Cinema2PresetRegistry'
import { cinema2SwitchItPhase2Module } from '../modules/switchIt/Cinema2SwitchItPhase1Module'
export function createSwitchItPhase2Registries(){
  const presetRegistry=new Cinema2PresetRegistry(),moduleRegistry=new Cinema2ModuleRegistry()
  for(const result of [moduleRegistry.register(cinema2SwitchItPhase2Module),presetRegistry.register(SWITCH_IT_PHASE2_MANIFEST)])if(!result.ok)throw new Error(JSON.stringify(result.diagnostics))
  return{presetRegistry,moduleRegistry}
}
