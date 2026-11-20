import {
  cinema2Ref, cinema2StableId,
  type Cinema2CapabilityId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest, type Cinema2ModuleId, type Cinema2ParameterId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'

/** Properties that Auto Performance silences to 10% when the track stops, so a held frame goes quiet instead of staying lit. */
export const GLYPH_SPHERE_SILENCED = ['motionRate', 'intensity', 'coreGlow', 'bandLighting', 'frameLighting', 'tickLighting', 'jointLighting', 'halo'] as const

const kebab = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)

/** Musical choreography (always on, scaled by Audio Reactivity) and mood drives (Auto Performance only) for the glyph sphere. */
export function glyphSpherePerformance(module: Cinema2ModuleId, pid: (name: string) => Cinema2ParameterId) {
  const target = (property: string) => ({ kind: 'module' as const, ref: cinema2Ref(module), property })
  const continuous = (name: string, capability: Cinema2CapabilityId, path: Cinema2ChoreographyContinuousSourcePath, property: string, factor: number): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`glyph-sphere-${name}`), priority: 20, strengthParameter: cinema2Ref(pid('reactivity')),
    source: { signal: 'continuous', capability, path, clamp: [0, 1], smoothingMs: 150 },
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`glyph-sphere-${name}-drive`), target: target(property), operation: 'multiply', value: factor }],
  })
  const accent = (signal: 'kick' | 'snare' | 'drop', property: string, factor: number, release: number): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`glyph-sphere-${signal}-${kebab(property)}`), priority: 30, strengthParameter: cinema2Ref(pid('reactivity')),
    source: { signal, capability: signal === 'drop' ? 'music.drop' : 'music.rhythm-events' },
    conditions: [{ kind: 'once-per-event' }, ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])],
    actions: [{
      id: cinema2StableId<Cinema2ChoreographyActionId>(`glyph-sphere-${signal}-${kebab(property)}-accent`), target: target(property), operation: 'envelope', composition: 'multiply', value: factor,
      envelope: { attack: .015, hold: .035, release, unit: 'seconds' }, retrigger: 'restart',
    }],
  })
  const rules: Cinema2ChoreographyRuleManifest[] = [
    continuous('bass-compression', 'audio.bands', 'audio.bands.bass', 'coreScale', .93),
    continuous('energy-motion', 'audio.features', 'audio.features.overallEnergy', 'motionRate', 1.3),
    continuous('high-shimmer', 'audio.bands', 'audio.bands.high', 'tickLighting', 1.2),
    continuous('vocal-restraint', 'music.vocal-presence', 'audio.features.vocalPresence', 'bandLighting', .8),
    accent('kick', 'frameLighting', 1.45, .25), accent('kick', 'jointLighting', 1.4, .24), accent('kick', 'coreGlow', 1.3, .22),
    accent('snare', 'tickLighting', 1.5, .22), accent('snare', 'halo', 1.45, .3), accent('snare', 'bandLighting', 1.25, .2),
    accent('drop', 'coreScale', 1.12, 1.25), accent('drop', 'bandSpread', 1.1, 1.5), accent('drop', 'coreGlow', 1.5, 1.4),
    { ...continuous('director-wobble', 'visual-director.significance', 'director.intensity', 'bandWobble', 1.3), enabledParameter: cinema2Ref(pid('autoPerformance')) },
  ]
  const drive = (id: string, property: string, source: Cinema2MoodDrive['source'], value: number): Cinema2MoodDrive => ({ id, target: target(property), source, operation: 'multiply', value })
  const drives: Cinema2MoodDrive[] = [
    drive('calm-rate', 'motionRate', 'mood.calm', .6), drive('calm-wobble', 'bandWobble', 'mood.calm', .6), drive('calm-ticks', 'tickLighting', 'mood.calm', .7),
    drive('momentum', 'motionRate', 'mood.momentum', 1.25), drive('energy-bands', 'bandLighting', 'mood.energy', 1.2), drive('energy-core', 'coreGlow', 'mood.energy', 1.25),
    drive('tension-spread', 'bandSpread', 'mood.tension', .95), drive('build-breath', 'coreBreath', 'mood.build', 1.5),
    drive('peak-core', 'coreScale', 'mood.peak', 1.06), drive('peak-halo', 'halo', 'mood.peak', 1.3),
    drive('shock-frame', 'frameLighting', 'mood.shock', 1.5), drive('shock-spread', 'bandSpread', 'mood.shock', 1.1),
  ]
  for (const name of GLYPH_SPHERE_SILENCED) drives.push(drive(`silence-${kebab(name)}`, name, 'mood.silence', .1))
  return { rules, drives }
}
