import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2EffectId, type Cinema2ModuleId, type Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'

/** Transient response targets. User control limits are applied by the native consumer afterwards. */
export function vacancyMusicRules(moduleId: Cinema2ModuleId): Cinema2ChoreographyRuleManifest[] {
  const continuous = [
    ['audioEnergy', 'audio.features.overallEnergy', 'audio.features', 160],
    ['bassPressure', 'audio.bands.bass', 'audio.bands', 100],
    ['highSparkle', 'audio.bands.high', 'audio.bands', 100],
    ['vocalRestraint', 'audio.features.vocalPresence', 'music.vocal-presence', 240],
    ['buildPressure', 'audio.features.buildProgress', 'music.build', 220],
    ['directorIntensity', 'director.intensity', 'visual-director.significance', 200],
    ['directorMomentum', 'director.momentum', 'visual-director.significance', 240],
    ['directorBuild', 'director.build', 'visual-director.significance', 220],
  ] as const
  const rules: Cinema2ChoreographyRuleManifest[] = continuous.map(([property, path, capability, smoothingMs], i) => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`vacancy-${property.toLowerCase()}-route`), priority: 10 + i,
    source: { signal: 'continuous', path, capability, clamp: [0, 1], smoothingMs },
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`vacancy-${property.toLowerCase()}-map`),
      target: { kind: 'module', ref: cinema2Ref(moduleId), property }, operation: 'replace' }],
  }))
  for (const [signal, capability, property, releaseSeconds] of [
    ['kick', 'music.rhythm-events', 'kickAccent', .26], ['snare', 'music.rhythm-events', 'snareAccent', .18],
    ['downbeat', 'music.downbeat', 'downbeatAccent', .32], ['phrase', 'music.phrase', 'phraseAccent', .6], ['drop', 'music.drop', 'dropAccent', .65],
  ] as const) rules.push({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`vacancy-${signal}-rule`), priority: 30,
    source: { signal, capability }, conditions: [{ kind: 'once-per-event' }],
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`vacancy-${signal}-envelope`),
      target: { kind: 'module', ref: cinema2Ref(moduleId), property }, operation: 'envelope', composition: 'add', value: 1,
      envelope: { attack: .015, release: releaseSeconds, unit: 'seconds' }, retrigger: 'restart' }],
  })
  return rules
}

export function vacancyFinishGates(master: Cinema2ParameterId, effects: readonly Cinema2EffectId[]): Cinema2ChoreographyRuleManifest[] {
  return effects.map((effect, i) => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`vacancy-finish-master-${i}`), priority: 100,
    source: { signal: 'parameter', parameter: cinema2Ref(master), scale: -1 / .85, offset: 1, clamp: [0, 1] },
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`vacancy-finish-master-${i}-map`),
      target: { kind: 'effect', ref: cinema2Ref(effect), property: 'mix' }, operation: 'multiply', value: 0 }],
  }))
}
