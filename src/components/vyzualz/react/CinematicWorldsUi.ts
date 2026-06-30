import type {
  CinematicAudioSource,
  CinematicAudioTarget,
} from './CinematicWorldConfig'
import type { ReactPreset } from './ReactTypes'

export type { CinematicWorldCategory } from './CinematicWorldControlSchema'

import {
  CINEMATIC_WORLD_CATALOG,
  CINEMATIC_WORLD_CATALOG_LIST,
  type AnyCinematicWorldCatalogEntry,
} from './CinematicWorldControlSchema'

export type CinematicWorldUiDefinition = AnyCinematicWorldCatalogEntry

export const CINEMATIC_WORLD_UI: readonly CinematicWorldUiDefinition[] = CINEMATIC_WORLD_CATALOG_LIST

export const CINEMATIC_WORLD_BY_ID = CINEMATIC_WORLD_CATALOG

export const CINEMATIC_SOURCE_LABELS: Record<CinematicAudioSource, string> = {
  overallEnergy: 'Overall Energy', subBass: 'Sub Bass', bass: 'Bass', lowMid: 'Low Mid', mid: 'Mid', highMid: 'High Mid', highs: 'Highs',
  transientIntensity: 'Transient Intensity', kickStrength: 'Kick Strength', snareStrength: 'Snare Strength', beatPhase: 'Beat Phase', barPosition: 'Bar Position',
  phraseProgress: 'Phrase Progress', sectionProgress: 'Section Progress', buildProgress: 'Build Progress', dropState: 'Drop State', trackEnergy: 'Track Energy Curve',
  vocalEnergy: 'Vocal Energy', volume: 'Volume', high: 'Highs (Legacy)', sectionEnergy: 'Section Energy (Legacy)', beat: 'Beat', kick: 'Kick', snare: 'Snare',
  downbeat: 'Downbeat', barStart: 'Bar Start', sectionChange: 'Section Change', dropEntry: 'Drop Entry',
}

export const CINEMATIC_TARGET_LABELS: Record<CinematicAudioTarget, string> = {
  portalAperture: 'Portal Aperture', depth: 'World Depth', cameraPunch: 'Camera Punch', cameraTravel: 'Camera Travel', lensing: 'Gravitational Lensing',
  distortion: 'Distortion', refraction: 'Refraction', geometryRotation: 'Geometry Rotation', fractureAmount: 'Fracture Amount', fogDensity: 'Fog Density',
  particleEmission: 'Particle Emission', lightning: 'Lightning', bloom: 'Bloom', chromaticAberration: 'Chromatic Aberration', environmentBrightness: 'Environment Brightness',
  feedback: 'Feedback', impact: 'Impact', fog: 'Fog (Legacy)', debris: 'Debris (Legacy)', atmosphere: 'Atmosphere (Legacy)', glow: 'Glow (Legacy)',
  cameraMotion: 'Camera Motion (Legacy)', portalPulse: 'Portal Pulse (Legacy)',
}

export const CINEMATIC_SOURCE_CAPABILITY: Partial<Record<CinematicAudioSource, 'liveBands' | 'rhythmEvents' | 'beatGrid' | 'sections' | 'trackEnergyCurve' | 'stemCurves'>> = {
  beat: 'rhythmEvents', kick: 'rhythmEvents', snare: 'rhythmEvents', downbeat: 'beatGrid', barStart: 'beatGrid', beatPhase: 'beatGrid', barPosition: 'beatGrid',
  phraseProgress: 'sections', sectionProgress: 'sections', buildProgress: 'sections', dropState: 'sections', sectionChange: 'sections', dropEntry: 'sections', sectionEnergy: 'sections',
  trackEnergy: 'trackEnergyCurve', vocalEnergy: 'stemCurves',
}

export function getCinematicPresetMood(preset: ReactPreset): 'Ambient' | 'Driving' | 'Peak' {
  const intensity = Number(preset.params.intensity ?? 0.6)
  const motion = Number(preset.params.motion ?? 0.5)
  if (intensity >= 0.82 || motion >= 0.84) return 'Peak'
  if (intensity <= 0.52 && motion <= 0.48) return 'Ambient'
  return 'Driving'
}

export function humanizeCinematicKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, value => value.toUpperCase())
}

export function nextCinematicVariationSeed(seed: number, direction: -1 | 1 = 1): number {
  const value = Math.trunc(seed) >>> 0
  return direction < 0 ? (value - 1) >>> 0 : (value + 1) >>> 0
}

export function randomizeCinematicVariationSeed(seed: number): number {
  let value = (Math.trunc(seed) >>> 0) || 0x9e3779b9
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return value >>> 0
}
