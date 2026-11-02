import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyRuleManifest, type Cinema2ModuleId } from '../contracts/Cinema2NativePresetManifest'

// These channels are transient facts/actions, never bindings to user controls.
// -1 distinguishes unavailable continuous analysis from a measured zero.
export const PSYLO_CHOREOGRAPHY_DEFAULTS = {
  choreoEnergy: -1, choreoBass: -1, choreoHigh: -1, choreoVocal: -1, choreoBuild: -1, choreoBuildConfidence: -1,
  choreoKick: 0, choreoSnare: 0, choreoBeat: 0, choreoDrop: 0,
  choreoDirectorIntensity: -1, choreoDirectorMomentum: -1, choreoDirectorBuild: -1, choreoDirectorImpact: -1, choreoDirectorTransition: 0,
} as const
export type PsyloChoreography = { -readonly [K in keyof typeof PSYLO_CHOREOGRAPHY_DEFAULTS]: number }
export const PSYLO_CONTINUOUS_ROUTES = [
  ['choreoEnergy', 'audio.features.overallEnergy', 'audio.features', 180],
  ['choreoBass', 'audio.bands.bass', 'audio.bands', 120],
  ['choreoHigh', 'audio.bands.high', 'audio.bands', 90],
  ['choreoVocal', 'audio.features.vocalPresence', 'music.vocal-presence', 200],
  ['choreoBuild', 'audio.features.buildProgress', 'music.build', 250],
  ['choreoBuildConfidence', 'audio.structure.buildConfidence', 'music.build', 0],
] as const
export const PSYLO_DIRECTOR_ROUTES = [
  ['choreoDirectorIntensity', 'director.intensity', 'visual-director.significance', 240],
  ['choreoDirectorMomentum', 'director.momentum', 'visual-director.significance', 320],
  ['choreoDirectorBuild', 'director.build', 'visual-director.significance', 300],
  // Sample authority immediately, so its fresh identity can qualify an existing
  // shared envelope even on an event publication with zero visual delta.
  ['choreoDirectorImpact', 'director.impact', 'visual-director.significance', 0],
] as const
export const PSYLO_DIRECTOR_TRANSITION = { maximum: .04, attack: .12, release: .6 } as const
export const PSYLO_EVENT_ACTIONS = {
  kick: { property: 'choreoKick', maximum: .12, attack: .02, release: .22 },
  snare: { property: 'choreoSnare', maximum: .15, attack: .01, release: .18 },
  beat: { property: 'choreoBeat', maximum: .06, attack: .01, release: .25 },
  drop: { property: 'choreoDrop', maximum: .25, attack: .02, release: .8 },
} as const

/** Shared Choreography owns smoothing, event deduplication and attack/release.
 * Native consumers validate freshness, apply Music Response once, and interpret
 * actions spatially inside each pattern and the user's final hard limits. */
export function createPsyloChoreography(moduleId: Cinema2ModuleId): readonly Cinema2ChoreographyRuleManifest[] {
  const target = (property: string) => ({ kind: 'module' as const, ref: cinema2Ref(moduleId), property })
  return [
    ...[...PSYLO_CONTINUOUS_ROUTES, ...PSYLO_DIRECTOR_ROUTES].map(([property, path, capability, smoothingMs]): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId(`psylo-${property.toLowerCase()}-route`), priority: 10,
      source: { signal: 'continuous', path, capability, clamp: [0, 1], smoothingMs },
      actions: [{ id: cinema2StableId(`psylo-${property.toLowerCase()}-map`), target: target(property), operation: 'replace' }],
    })),
    { id: cinema2StableId('psylo-director-transition-route'), priority: 20,
      source: { signal: 'section-change', capability: 'music.section' },
      conditions: [{ kind: 'once-per-event' }, { kind: 'confidence', min: .45 }],
      actions: [{ id: cinema2StableId('psylo-director-transition-envelope'), target: target('choreoDirectorTransition'),
        operation: 'envelope', composition: 'replace', value: PSYLO_DIRECTOR_TRANSITION.maximum,
        envelope: { unit: 'seconds', attack: PSYLO_DIRECTOR_TRANSITION.attack, hold: 0, release: PSYLO_DIRECTOR_TRANSITION.release }, retrigger: 'restart' }],
    },
    ...(['kick', 'snare', 'beat', 'drop'] as const).map((signal): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId(`psylo-${signal}-route`), priority: 20,
      source: { signal, capability: signal === 'drop' ? 'music.drop' : signal === 'beat' ? 'music.beat' : 'music.rhythm-events' },
      conditions: [{ kind: 'once-per-event' }, { kind: 'confidence', min: .45 }],
      actions: [{ id: cinema2StableId(`psylo-${signal}-envelope`), target: target(PSYLO_EVENT_ACTIONS[signal].property),
        operation: 'envelope', composition: 'replace', value: PSYLO_EVENT_ACTIONS[signal].maximum,
        envelope: { unit: 'seconds', attack: PSYLO_EVENT_ACTIONS[signal].attack, hold: 0, release: PSYLO_EVENT_ACTIONS[signal].release }, retrigger: 'restart' }],
    })),
  ]
}
