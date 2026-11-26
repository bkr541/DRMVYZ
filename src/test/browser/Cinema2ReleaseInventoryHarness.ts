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
export function modelInventory() {
  return cinema2NativePresetRegistry.list().flatMap(manifest => {
    const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(d => d.manifest.id === manifest.id)
    const selector = manifest.parameters?.find(p => p.metadata?.editor === 'user-model-selector')
    const instances = (manifest.modules ?? []).flatMap(m => {
      const config = m.config as { instances?: { asset?: string }[]; userModelPreview?: string } | undefined
      return (config?.instances ?? []).map(i => i.asset).filter(Boolean)
    })
    if (!selector && !instances.length) return []
    const presentation = manifest.parameters?.find(p => p.label === 'Model Presentation')
    return [{ id: manifest.id, role: declaration?.role, selector: selector?.id ?? null, sourcePolicy: selector ? 'selectable' : 'fixed-authored-assets',
      modes: presentation?.options?.map(o => o.value) ?? [], modules: (manifest.modules ?? []).map(m => ({ typeId: m.typeId, config: m.config, bindings: m.parameterBindings })),
      lighting: manifest.lighting, environment: manifest.environment, instances }]
  })
}
Object.assign(window, { __cinema2ResolveReviewedIds: resolveReviewedIds, __cinema2ModelInventory: modelInventory })
