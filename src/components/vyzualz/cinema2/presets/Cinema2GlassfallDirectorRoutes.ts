import { cinema2StableId, cinema2Ref, type Cinema2ChoreographyRuleManifest, type Cinema2ModuleId } from '../contracts/Cinema2NativePresetManifest'
import { GLASSFALL_CHOREOGRAPHY_ENABLED_ID } from './Cinema2GlassfallChoreography'
export const GLASSFALL_DIRECTOR_ROUTES = [
  ['intensity', 'director.intensity', 200],
  ['momentum', 'director.momentum', 240],
  ['build', 'director.build', 240],
  ['impact', 'director.impact', 0],
] as const
export function createGlassfallDirectorRoutes(moduleId: Cinema2ModuleId): readonly Cinema2ChoreographyRuleManifest[] {
  return GLASSFALL_DIRECTOR_ROUTES.map(([name, path, smoothingMs]) => ({
    id: cinema2StableId(`glassfall-director-${name}-route`), priority: 15,
    enabledParameter: cinema2Ref(GLASSFALL_CHOREOGRAPHY_ENABLED_ID),
    source: { signal: 'continuous', path, capability: 'visual-director.significance', smoothingMs, clamp: [0, 1] },
    // Impact is instantaneous shared meaning: an engine-owned edge envelope
    // preserves that significance across the existing audio gesture's tail.
    // The shared edge operation's default threshold is 0.5; zero values prime it.
    actions: [{ id: cinema2StableId(`glassfall-director-${name}-map`), target: { kind: 'module', ref: cinema2Ref(moduleId), property: `director-${name}` },
      ...(name === 'impact' ? { operation: 'envelope' as const, composition: 'replace' as const, value: 1, envelope: { attack: .015, hold: .025, release: .35, unit: 'seconds' as const }, retrigger: 'restart' as const } : { operation: 'replace' as const }) }],
  }))
}
