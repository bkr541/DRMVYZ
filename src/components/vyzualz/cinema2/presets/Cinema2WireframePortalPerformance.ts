import {
  cinema2Ref, cinema2StableId,
  type Cinema2CapabilityId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest, type Cinema2ModuleId, type Cinema2ParameterId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'

/** Properties that Auto Performance silences to 10% when the track stops, so a held frame goes quiet instead of staying lit. */
export const WIREFRAME_PORTAL_SILENCED = ['motionRate', 'intensity', 'kinetics', 'jointHeat', 'edgeLighting', 'pinLighting', 'rimLighting', 'beamLighting', 'strobe', 'dust'] as const

const kebab = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)

/** Musical choreography (always on, scaled by Audio Reactivity) and mood drives (Auto Performance only) for the wireframe portal. */
export function wireframePortalPerformance(module: Cinema2ModuleId, pid: (name: string) => Cinema2ParameterId) {
  const target = (property: string) => ({ kind: 'module' as const, ref: cinema2Ref(module), property })
  const continuous = (name: string, capability: Cinema2CapabilityId, path: Cinema2ChoreographyContinuousSourcePath, property: string, factor: number): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`wireframe-portal-${name}`), priority: 20, strengthParameter: cinema2Ref(pid('reactivity')),
    source: { signal: 'continuous', capability, path, clamp: [0, 1], smoothingMs: 150 },
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`wireframe-portal-${name}-drive`), target: target(property), operation: 'multiply', value: factor }],
  })
  const accent = (signal: 'kick' | 'snare' | 'drop', property: string, factor: number, release: number): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`wireframe-portal-${signal}-${kebab(property)}`), priority: 30, strengthParameter: cinema2Ref(pid('reactivity')),
    source: { signal, capability: signal === 'drop' ? 'music.drop' : 'music.rhythm-events' },
    conditions: [{ kind: 'once-per-event' }, ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])],
    actions: [{
      id: cinema2StableId<Cinema2ChoreographyActionId>(`wireframe-portal-${signal}-${kebab(property)}-accent`), target: target(property), operation: 'envelope', composition: 'multiply', value: factor,
      envelope: { attack: .015, hold: .035, release, unit: 'seconds' }, retrigger: 'restart',
    }],
  })
  // Writes 1 into a hidden channel when the event lands (a 'replace' envelope), so the scene can read a clean 0-to-1 cue.
  const channel = (signal: 'kick' | 'drop', property: string, release: number): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`wireframe-portal-cue-${signal}-${property}`), priority: 40, strengthParameter: cinema2Ref(pid('reactivity')),
    source: { signal, capability: signal === 'drop' ? 'music.drop' : 'music.rhythm-events' },
    conditions: [{ kind: 'once-per-event' }, ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])],
    actions: [{
      id: cinema2StableId<Cinema2ChoreographyActionId>(`wireframe-portal-cue-${property}`), target: target(property), operation: 'envelope', composition: 'replace', value: 1,
      envelope: { attack: .015, hold: .035, release, unit: 'seconds' }, retrigger: 'restart',
    }],
  })
  const rules: Cinema2ChoreographyRuleManifest[] = [
    // The bass pushes the bays, the energy speeds the sweep, the highs light the edges, and a vocal eases the rims back.
    continuous('bass-kinetics', 'audio.bands', 'audio.bands.bass', 'kinetics', 1.25),
    continuous('energy-sweep', 'audio.features', 'audio.features.overallEnergy', 'motionRate', 1.3),
    continuous('high-edges', 'audio.bands', 'audio.bands.high', 'edgeLighting', 1.25),
    continuous('vocal-restraint', 'music.vocal-presence', 'audio.features.vocalPresence', 'rimLighting', .8),
    accent('kick', 'jointHeat', 1.5, .25), accent('snare', 'beamLighting', 1.5, .2), accent('snare', 'rimLighting', 1.6, .2),
    accent('drop', 'haze', 1.6, 1.4), accent('drop', 'kinetics', 1.3, 1.3),
    // The kick and the drop also fire their own channels: the kick flashes the cores, beams and rims; the drop blasts the bays apart and strobes the beams.
    channel('kick', 'flash', .2), channel('drop', 'blast', 1.6),
    { ...continuous('director-drift', 'visual-director.significance', 'director.intensity', 'emberDrift', 1.4), enabledParameter: cinema2Ref(pid('autoPerformance')) },
  ]
  const drive = (id: string, property: string, source: Cinema2MoodDrive['source'], value: number): Cinema2MoodDrive => ({ id, target: target(property), source, operation: 'multiply', value })
  const drives: Cinema2MoodDrive[] = [
    drive('calm-rate', 'motionRate', 'mood.calm', .6), drive('calm-kinetics', 'kinetics', 'mood.calm', .6), drive('calm-beams', 'beamLighting', 'mood.calm', .7),
    drive('momentum', 'motionRate', 'mood.momentum', 1.25), drive('drive-kinetics', 'kinetics', 'mood.drive', 1.15),
    drive('energy-kinetics', 'kinetics', 'mood.energy', 1.2), drive('energy-beams', 'beamLighting', 'mood.energy', 1.25),
    drive('tension-haze', 'haze', 'mood.tension', 1.4), drive('build-rim', 'rimLighting', 'mood.build', 1.3), drive('build-drift', 'emberDrift', 'mood.build', 1.3),
    drive('activity-dust', 'dust', 'mood.activity', 1.3), drive('peak-heat', 'jointHeat', 'mood.peak', 1.25), drive('peak-rim', 'rimLighting', 'mood.peak', 1.3),
    drive('peak-steel', 'steelRoughness', 'mood.peak', .85), drive('shock-strobe', 'strobe', 'mood.shock', 1.6), drive('shock-pins', 'pinLighting', 'mood.shock', 1.5),
    drive('brightness-edges', 'edgeLighting', 'mood.brightness', 1.15),
  ]
  for (const name of WIREFRAME_PORTAL_SILENCED) drives.push(drive(`silence-${kebab(name)}`, name, 'mood.silence', .1))
  return { rules, drives }
}
