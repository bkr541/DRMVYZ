import type { Cinema2ParameterId, Cinema2ParameterManifest } from '../contracts/Cinema2NativePresetManifest'

export type Cinema2ModelPresentation = 'original' | 'integrated' | 'stylized'

/** Existing native material mode IDs remain valid; stylization is still performed by the owning preset. */
export function resolveCinema2ModelPresentation(value: unknown): Cinema2ModelPresentation {
  if (value === 'integrated') return 'integrated'
  if (value === 'brushed' || value === 'edge' || value === 'stylized') return 'stylized'
  return 'original'
}

/** Imported-only lighting selection for scenes without an existing material control. */
export function createCinema2ModelPresentationParameter(id: Cinema2ParameterId): Cinema2ParameterManifest {
  return { id, label: 'Model Presentation', type: 'enum', defaultValue: 'original', section: 'Design', designParentGroup: 'design',
    group: 'Model', order: 10, exposure: 'primary', persistence: 'preset', reset: 'authored-default',
    modulatable: false, automatable: false, choreographable: false,
    options: [{ value: 'original', label: 'Original' }, { value: 'integrated', label: 'Scene Integrated' }],
    description: 'Original adds neutral model-only reflections and fill. Scene Integrated uses the scene lighting. Both retain the saved material colors, textures and transparency.' }
}
