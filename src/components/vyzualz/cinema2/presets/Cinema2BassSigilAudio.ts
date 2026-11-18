import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyRuleManifest, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyActionId, type Cinema2ModuleId, type Cinema2ParameterId, type Cinema2ParameterConditionManifest } from '../contracts/Cinema2NativePresetManifest'

/** P3 basic audio response. Shared Choreography owns smoothing, envelopes, event identity and playback resets. */
export function createBassSigilAudioRules(moduleId: Cinema2ModuleId, parameterId: (name: string) => Cinema2ParameterId): readonly Cinema2ChoreographyRuleManifest[] {
  const target = (property: string) => ({ kind: 'module' as const, ref: cinema2Ref(moduleId), property })
  const motion: Cinema2ParameterConditionManifest[] = [{ kind: 'parameter-equals', parameterId: parameterId('geometryMotion'), value: true }]
  const logo: Cinema2ParameterConditionManifest[] = [{ kind: 'parameter-equals', parameterId: parameterId('logoMotion'), value: true }]
  const nonzero = (name: string): Cinema2ParameterConditionManifest => ({ kind: 'parameter-not-equals', parameterId: parameterId(name), value: 0 })
  const continuous = (name: string, capability: NonNullable<Cinema2ChoreographyRuleManifest['source']['capability']>, path: NonNullable<Cinema2ChoreographyRuleManifest['source']['path']>, property: string, factor: number, smoothingMs: number, enabledWhen?: Cinema2ParameterConditionManifest[]): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`bass-sigil-audio-${name}`), priority: 20,
    strengthParameter: cinema2Ref(parameterId('reactivity')), enabledWhen,
    source: { signal: 'continuous', capability, path, clamp: [0,1], smoothingMs },
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`bass-sigil-audio-${name}-value`), target: target(property), operation: 'multiply', value: factor }],
  })
  const event = (signal: 'kick'|'snare'|'downbeat', property: string, amount: number, attack: number, hold: number, release: number, enabledWhen: Cinema2ParameterConditionManifest[]): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`bass-sigil-audio-${signal}`), priority: 30,
    strengthParameter: cinema2Ref(parameterId('reactivity')), enabledWhen,
    source: { signal, capability: signal==='downbeat'?'music.downbeat':'music.rhythm-events' },
    conditions: [{kind:'once-per-event'},{kind:'not-silent'},{kind:'capability',capability:signal==='downbeat'?'music.downbeat':'music.rhythm-events',available:true}],
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`bass-sigil-audio-${signal}-accent`), target: target(property), operation:'envelope', composition:'add', value:amount, envelope:{attack,hold,release,unit:'seconds'}, retrigger:'restart' }],
  })
  return [
    continuous('bass','audio.bands','audio.bands.bass','membraneScale',1.12,100,motion),
    continuous('energy','audio.features','audio.features.overallEnergy','motionRate',1.25,180,motion),
    continuous('highs','audio.bands','audio.bands.high','membraneOpacity',.8,60),
    continuous('vocals','music.vocal-presence','audio.features.vocalPresence','particleDensity',.65,180),
    event('kick','coreTravel',.16,.015,.025,.22,[...motion,nonzero('coreTravel')]),
    event('snare','logoRoll',4,.01,.02,.18,logo),
    event('downbeat','heroScale',.035,.015,.025,.25,logo),
  ]
}
