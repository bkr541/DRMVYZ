import { cinema2StableId, cinema2Ref, type Cinema2ChoreographyRuleManifest, type Cinema2ModuleId, type Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { ELEVHATE_ROUTES } from '../modules/elevhate/Cinema2ElevhatePerformance'

/** Shared Choreography owns facts, smoothing and hit envelopes; the native preset owns presentation. */
export function elevhateAudioRules(module: Cinema2ModuleId, response: Cinema2ParameterId): readonly Cinema2ChoreographyRuleManifest[] {
  return [
    ...ELEVHATE_ROUTES.map(([property, path, capability, smoothingMs], index): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId(`elevhate-${property.toLowerCase()}-route`), priority: 10 + index,
      source: { signal: 'continuous', path, capability, smoothingMs, clamp: [0, 1] },
      actions: [{ id: cinema2StableId(`elevhate-${property.toLowerCase()}-map`), target: { kind: 'module', ref: cinema2Ref(module), property }, operation: 'replace' }],
    })),
    ...(['kick', 'snare', 'downbeat', 'drop'] as const).map((signal): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId(`elevhate-${signal}-event`), priority: 25,
      source: { signal, capability: signal === 'drop' ? 'music.drop' : signal === 'downbeat' ? 'music.downbeat' : 'music.rhythm-events' },
      strengthParameter: cinema2Ref(response), conditions: [{ kind: 'once-per-event' }],
      actions: [{ id: cinema2StableId(`elevhate-${signal}-pulse`),
        target: { kind: 'module', ref: cinema2Ref(module), property: `music${signal[0].toUpperCase()}${signal.slice(1)}` },
        operation: 'envelope', composition: 'add', value: 1,
        envelope: { attack: .025, hold: signal === 'drop' ? .1 : 0, release: signal === 'drop' ? 1.2 : signal === 'snare' ? .3 : signal === 'downbeat' ? .7 : .25, unit: 'seconds' }, retrigger: 'restart' }],
    })),
  ]
}
