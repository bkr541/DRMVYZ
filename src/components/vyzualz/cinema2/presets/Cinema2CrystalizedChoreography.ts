import { cinema2StableId, cinema2Ref, type Cinema2ChoreographyRuleManifest, type Cinema2ModuleId, type Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { CRYSTALIZED_ROUTES } from '../modules/crystalized/Cinema2CrystalizedPerformance'

/** Shared Choreography owns facts, smoothing and hit envelopes; the native preset owns presentation. */
export function crystalizedAudioRules(module: Cinema2ModuleId, response: Cinema2ParameterId): readonly Cinema2ChoreographyRuleManifest[] {
  return [
    ...CRYSTALIZED_ROUTES.map(([property, path, capability, smoothingMs], index): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId(`crystalized-${property.toLowerCase()}-route`), priority: 10 + index,
      source: { signal: 'continuous', path, capability, smoothingMs, clamp: [0, 1] },
      actions: [{ id: cinema2StableId(`crystalized-${property.toLowerCase()}-map`), target: { kind: 'module', ref: cinema2Ref(module), property }, operation: 'replace' }],
    })),
    ...(['kick', 'snare', 'beat', 'drop'] as const).map((signal): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId(`crystalized-${signal}-event`), priority: 25,
      source: { signal, capability: signal === 'drop' ? 'music.drop' : signal === 'beat' ? 'music.beat' : 'music.rhythm-events' },
      strengthParameter: cinema2Ref(response), conditions: [{ kind: 'once-per-event' }],
      actions: [{ id: cinema2StableId(`crystalized-${signal}-pulse`),
        target: { kind: 'module', ref: cinema2Ref(module), property: `music${signal[0].toUpperCase()}${signal.slice(1)}` },
        operation: 'envelope', composition: 'add', value: 1,
        envelope: { attack: .025, hold: signal === 'drop' ? .25 : 0, release: signal === 'drop' ? 3 : .6, unit: 'beats' }, retrigger: 'restart' }],
    })),
  ]
}
