import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyRuleManifest, type Cinema2ModuleId, type Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
export const GLASSFALL_CHOREOGRAPHY_ENABLED_ID = cinema2StableId<Cinema2ParameterId>('glassfall-choreography')
export const GLASSFALL_CONTINUOUS_ROUTES = [
  ['energy', 'audio.features.overallEnergy', 'audio.features', 180],
  ['bass', 'audio.bands.bass', 'audio.bands', 120],
  ['high', 'audio.bands.high', 'audio.bands', 90],
  ['vocal', 'audio.features.vocalPresence', 'music.vocal-presence', 250],
  ['build', 'audio.features.buildProgress', 'music.build', 200],
] as const
export const GLASSFALL_EVENT_ENVELOPES = {
  kick: { attack: .012, hold: .018, release: .25 },
  snare: { attack: .008, hold: .012, release: .20 },
  drop: { attack: .025, hold: .060, release: .60 },
} as const
/** All temporary state and smoothing belong to shared Choreography, never the
 * native module. Raw channels are bounded, then Music Reactivity scales the
 * visible result once. Authored geometry/color parameters are never replaced. */
export function createGlassfallChoreography(moduleId: Cinema2ModuleId): readonly Cinema2ChoreographyRuleManifest[] {
  const target = (property: string) => ({ kind: 'module' as const, ref: cinema2Ref(moduleId), property: `choreo-${property}` })
  return [
    ...GLASSFALL_CONTINUOUS_ROUTES.map(([name, path, capability, smoothingMs]): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId(`glassfall-${name}-route`), priority: 10,
      enabledParameter: cinema2Ref(GLASSFALL_CHOREOGRAPHY_ENABLED_ID),
      source: { signal: 'continuous', path, capability, smoothingMs, clamp: [0, 1] },
      actions: [{ id: cinema2StableId(`glassfall-${name}-map`), target: target(name), operation: 'replace' }],
    })),
    ...(['kick', 'snare', 'drop'] as const).map((name): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId(`glassfall-${name}-route`), priority: 20,
      enabledParameter: cinema2Ref(GLASSFALL_CHOREOGRAPHY_ENABLED_ID),
      source: { signal: name, capability: name === 'drop' ? 'music.drop' : 'music.rhythm-events' },
      conditions: [{ kind: 'once-per-event' }, { kind: 'confidence', min: .45 }],
      actions: [{ id: cinema2StableId(`glassfall-${name}-envelope`), target: target(name), operation: 'envelope', composition: 'replace', value: 1,
        envelope: { ...GLASSFALL_EVENT_ENVELOPES[name], unit: 'seconds' }, retrigger: 'restart' }],
    })),
  ]
}
