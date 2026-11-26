import { cinema2NativePresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../../components/vyzualz/cinema2/presets/Cinema2FirstPartyPresetCatalog'
import type { Cinema2PresetId } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'

// No canvas or runtime is created here: resolve the complete reviewed set before rendering.
export function resolveReviewedIds(ids: string[]) {
  return ids.map(id => {
    const compiled = cinema2NativePresetRegistry.compile(id as Cinema2PresetId)
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(d => d.manifest.id === id)
    return { id, compiled: compiled.ok && compiled.plan?.manifest.id === id, active: !!declaration && declaration.role !== 'foundation' && !declaration.manifest.metadata.tags?.includes('internal') && cinema2NativePresetRegistry.has(id as Cinema2PresetId), role: declaration?.role, diagnostics: compiled.diagnostics }
  })
}
Object.assign(window, { __cinema2ResolveReviewedIds: resolveReviewedIds })
