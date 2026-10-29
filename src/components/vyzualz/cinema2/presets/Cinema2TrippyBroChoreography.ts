import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2ModuleId } from '../contracts/Cinema2NativePresetManifest'
import { trippyBroParameterId as pid } from '../modules/trippyBro/Cinema2TrippyBroDomain'

const moduleId = cinema2StableId<Cinema2ModuleId>('trippy-bro-system')
export const TRIPPY_BRO_CHANNELS = ['energy','bass','highs','vocal','kick','snare','build','drop','directorIntensity','directorMomentum','directorBuild','directorImpact'] as const
const stableName = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
const target = (property: string) => ({ kind: 'module' as const, ref: cinema2Ref(moduleId), property })
const continuous = (name: string, capability: NonNullable<Cinema2ChoreographyRuleManifest['source']['capability']>, path: NonNullable<Cinema2ChoreographyRuleManifest['source']['path']>, smoothingMs: number): Cinema2ChoreographyRuleManifest => ({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`trippy-bro-${stableName(name)}-rule`), priority: 10,
  strengthParameter: cinema2Ref(pid('reactivity')),
  source: { signal: 'continuous', capability, path, smoothingMs, clamp: [0,1] },
  actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`trippy-bro-${stableName(name)}-action`), target: target(name), operation: 'replace', value: 1 }],
})
const event = (name: 'kick'|'snare'|'drop', release: number): Cinema2ChoreographyRuleManifest => ({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`trippy-bro-${stableName(name)}-rule`), priority: 20,
  strengthParameter: cinema2Ref(pid('reactivity')),
  source: { signal: name, capability: name === 'drop' ? 'music.drop' : 'music.rhythm-events' },
  conditions: [{ kind: 'once-per-event' }],
  actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`trippy-bro-${stableName(name)}-action`), target: target(name), operation: 'envelope', composition: 'replace', value: 1,
    envelope: { attack: name === 'snare' ? 0.01 : 0.015, hold: 0, release, unit: 'seconds' }, retrigger: 'restart' }],
})
export const TRIPPY_BRO_CHOREOGRAPHY: readonly Cinema2ChoreographyRuleManifest[] = [
  continuous('energy','audio.features','audio.features.overallEnergy',180),
  continuous('bass','audio.bands','audio.bands.bass',120),
  continuous('highs','audio.bands','audio.bands.high',90),
  continuous('vocal','music.vocal-presence','audio.features.vocalPresence',250),
  continuous('build','music.build','audio.features.buildProgress',200),
  continuous('directorIntensity','visual-director.significance','director.intensity',200),
  continuous('directorMomentum','visual-director.significance','director.momentum',200),
  continuous('directorBuild','visual-director.significance','director.build',200),
  continuous('directorImpact','visual-director.significance','director.impact',90),
  event('kick',0.18), event('snare',0.14), event('drop',0.45),
]
