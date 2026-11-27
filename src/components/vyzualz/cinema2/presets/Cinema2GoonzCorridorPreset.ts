import { cinema2NamespacedId, type Cinema2NativePresetManifest, type Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_GOONZ_CORRIDOR_MODULE_TYPE_ID } from '../modules/Cinema2CorridorNativeModule'
import { CINEMA2_CORRIDOR_PRESET_MANIFEST } from './Cinema2CorridorPreset'

export const CINEMA2_GOONZ_CORRIDOR_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.goonz-corridor')

// The native manifest's stable IDs are local to each preset. Keeping them
// preserves every parameter binding, media slot, choreography rule and effect;
// workspace state is keyed by the distinct preset ID, not by the local IDs.
export const CINEMA2_GOONZ_CORRIDOR_PRESET_MANIFEST: Cinema2NativePresetManifest = {
  ...CINEMA2_CORRIDOR_PRESET_MANIFEST,
  id: CINEMA2_GOONZ_CORRIDOR_PRESET_ID,
  metadata: {
    ...CINEMA2_CORRIDOR_PRESET_MANIFEST.metadata,
    name: 'GOONZ CORRIDOR',
    description: 'An industrial passage with staggered oversized square lighting and media panels, deep machined steel casings, and reactive recessed LEDs on all four surfaces.',
  },
  modules: CINEMA2_CORRIDOR_PRESET_MANIFEST.modules?.map(module => ({
    ...module, typeId: CINEMA2_GOONZ_CORRIDOR_MODULE_TYPE_ID,
  })),
}
