import type {
  CinematicAudioSource,
  CinematicAudioTarget,
  CinematicCameraRig,
  CinematicWorldMode,
} from './CinematicWorldConfig'
import type { ReactPreset } from './ReactTypes'

export type CinematicWorldCategory = 'Cosmic' | 'Architectural' | 'Organic' | 'Mechanical' | 'Storm' | 'Media' | 'Legacy'

export interface CinematicWorldUiDefinition {
  id: CinematicWorldMode
  label: string
  description: string
  category: CinematicWorldCategory
  cameraRigs: readonly CinematicCameraRig[]
  modulationTargets: readonly CinematicAudioTarget[]
  supportsPortalShape: boolean
}

const COMMON_TARGETS = ['portalAperture', 'depth', 'cameraPunch', 'environmentBrightness', 'bloom', 'impact'] as const

export const CINEMATIC_WORLD_UI: readonly CinematicWorldUiDefinition[] = [
  { id: 'eventHorizon', label: 'Event Horizon', category: 'Cosmic', description: 'Black-hole core, accretion light and gravitational shockwaves.', cameraRigs: ['locked', 'orbit', 'autoDirector'], modulationTargets: ['portalAperture', 'depth', 'lensing', 'distortion', 'geometryRotation', 'bloom', 'chromaticAberration', 'environmentBrightness', 'feedback', 'impact'], supportsPortalShape: true },
  { id: 'infiniteCorridor', label: 'Infinite Corridor', category: 'Architectural', description: 'Repeating structures and forward travel through real perspective depth.', cameraRigs: ['dolly', 'flyThrough', 'handheld', 'autoDirector'], modulationTargets: ['depth', 'cameraPunch', 'cameraTravel', 'fogDensity', 'environmentBrightness', 'bloom', 'impact'], supportsPortalShape: false },
  { id: 'fractureRift', label: 'Fracture Rift', category: 'Organic', description: 'A dimensional tear with shards, cracks and a living opening.', cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'], modulationTargets: ['portalAperture', 'depth', 'fractureAmount', 'particleEmission', 'distortion', 'refraction', 'chromaticAberration', 'environmentBrightness', 'impact'], supportsPortalShape: true },
  { id: 'monolithGate', label: 'Monolith Gate', category: 'Architectural', description: 'Massive stone geometry, glyphs and a ceremonial gateway.', cameraRigs: ['locked', 'dolly', 'orbit', 'autoDirector'], modulationTargets: COMMON_TARGETS, supportsPortalShape: true },
  { id: 'liquidMembrane', label: 'Liquid Membrane', category: 'Organic', description: 'Elastic fluid surface with ripples, tearing and refraction.', cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'], modulationTargets: ['portalAperture', 'distortion', 'refraction', 'environmentBrightness', 'feedback', 'bloom', 'chromaticAberration', 'impact'], supportsPortalShape: true },
  { id: 'celestialCathedral', label: 'Celestial Cathedral', category: 'Architectural', description: 'Cosmic arches, pillars, stars and deep light shafts.', cameraRigs: ['locked', 'dolly', 'flyThrough', 'autoDirector'], modulationTargets: ['depth', 'cameraTravel', 'fogDensity', 'particleEmission', 'environmentBrightness', 'bloom', 'impact'], supportsPortalShape: false },
  { id: 'mirrorDimension', label: 'Mirror Dimension', category: 'Cosmic', description: 'Symmetrical mirrored chambers with controlled recursive depth.', cameraRigs: ['locked', 'orbit', 'autoDirector'], modulationTargets: ['depth', 'geometryRotation', 'feedback', 'distortion', 'chromaticAberration', 'environmentBrightness', 'bloom', 'impact'], supportsPortalShape: false },
  { id: 'ancientMachine', label: 'Ancient Machine', category: 'Mechanical', description: 'Interlocking rings, gears, glyphs and a mechanical unlock sequence.', cameraRigs: ['locked', 'dolly', 'orbit', 'autoDirector'], modulationTargets: ['portalAperture', 'depth', 'geometryRotation', 'cameraPunch', 'cameraTravel', 'environmentBrightness', 'bloom', 'impact'], supportsPortalShape: true },
  { id: 'stormGateway', label: 'Storm Gateway', category: 'Storm', description: 'Cloud vortex, debris, turbulence and branching lightning.', cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'], modulationTargets: ['portalAperture', 'depth', 'cameraPunch', 'fogDensity', 'particleEmission', 'lightning', 'environmentBrightness', 'distortion', 'bloom', 'chromaticAberration', 'impact'], supportsPortalShape: true },
  { id: 'mediaPortal', label: 'Media Portal', category: 'Media', description: 'Places images, video, logos or SVG artwork inside a reactive gateway.', cameraRigs: ['locked', 'dolly', 'orbit', 'autoDirector'], modulationTargets: ['portalAperture', 'distortion', 'refraction', 'bloom', 'chromaticAberration', 'feedback', 'impact'], supportsPortalShape: true },
  { id: 'legacyPortal', label: 'Legacy Portal', category: 'Legacy', description: 'Compatibility renderer for projects created before Cinematic Worlds.', cameraRigs: ['locked'], modulationTargets: ['portalAperture', 'cameraPunch', 'fogDensity', 'particleEmission', 'environmentBrightness', 'impact', 'fog', 'debris', 'atmosphere', 'glow', 'cameraMotion', 'portalPulse'], supportsPortalShape: true },
]

export const CINEMATIC_WORLD_BY_ID = Object.fromEntries(
  CINEMATIC_WORLD_UI.map(world => [world.id, world]),
) as Record<CinematicWorldMode, CinematicWorldUiDefinition>

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
