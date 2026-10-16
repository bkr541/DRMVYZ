import type { PixGridDeckTransportStrategy } from './PixGridDeckCompilerContracts'
import type { PixGridDeckConfiguration } from './PixGridDeckDomain'
import type { PixGridAudioFrame, PixGridReactionCurve, PixGridReactionSource } from './PixGridTypes'

export const PIX_GRID_MOTION_PROFILE_SCHEMA_VERSION = 1 as const

export type PixGridMotionDirection = 'automatic' | 'inward' | 'outward' | 'left' | 'right' | 'up' | 'down' | 'alternate'
export type PixGridMotionEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
export type PixGridMotionCollisionPolicy = 'weightedBlend' | 'nearestOpen' | 'preserveClusters'
export type PixGridMotionColorInterpolation = 'rgb' | 'sourceHold' | 'targetReveal'
export type PixGridMotionAudioTarget =
  | 'motionIntensity'
  | 'acceleration'
  | 'dispersal'
  | 'reconstruction'
  | 'regionPulse'
  | 'completionEmphasis'

export const PIX_GRID_MOTION_AUDIO_TARGETS: ReadonlySet<PixGridMotionAudioTarget> = new Set([
  'motionIntensity', 'acceleration', 'dispersal', 'reconstruction', 'regionPulse', 'completionEmphasis',
])

export interface PixGridMotionAudioRoute {
  id: string
  enabled: boolean
  source: PixGridReactionSource
  target: PixGridMotionAudioTarget
  amount: number
  threshold?: number
  curve?: PixGridReactionCurve
  smoothing?: number
  gate?: 'always' | 'transitionOnly'
  blend?: 'add' | 'max' | 'replace'
}

export interface PixGridMotionProfile {
  schemaVersion: typeof PIX_GRID_MOTION_PROFILE_SCHEMA_VERSION
  id: string
  name: string
  preferredStrategy: PixGridDeckTransportStrategy | 'automatic'
  direction: PixGridMotionDirection
  pathCurvature: number
  movementSpeed: number
  acceleration: number
  easing: PixGridMotionEasing
  pixelStagger: number
  regionalGrouping: number
  dispersal: number
  reconstruction: number
  collisionPolicy: PixGridMotionCollisionPolicy
  colorInterpolation: PixGridMotionColorInterpolation
  brightnessShift: number
  seed: number
  arrivalBehavior: 'preserve' | 'emphasize'
  reversible: boolean
  audioRoutes: readonly PixGridMotionAudioRoute[]
}

export interface PixGridResolvedMotionProfile {
  profile: PixGridMotionProfile
  source: 'pair' | 'scene' | 'preset' | 'engine'
}

export interface PixGridMotionDynamics {
  motionIntensity: number
  acceleration: number
  dispersal: number
  reconstruction: number
  regionPulse: number
  completionEmphasis: number
  pathCurvature?: number
  movementSpeed?: number
  pixelStagger?: number
  regionalGrouping?: number
  brightnessShift?: number
  colorInterpolation?: PixGridMotionColorInterpolation
  easing?: PixGridMotionEasing
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
const clamp01 = (value: number) => clamp(value, 0, 1)

function route(id: string, source: PixGridReactionSource, target: PixGridMotionAudioTarget, amount: number, extras: Partial<PixGridMotionAudioRoute> = {}): PixGridMotionAudioRoute {
  return { id, enabled: true, source, target, amount, curve: 'smoothstep', smoothing: 0, gate: 'transitionOnly', blend: 'max', ...extras }
}

function profile(input: Omit<PixGridMotionProfile, 'schemaVersion'>): PixGridMotionProfile {
  return Object.freeze({
    ...input,
    schemaVersion: PIX_GRID_MOTION_PROFILE_SCHEMA_VERSION,
    pathCurvature: clamp(input.pathCurvature, 0, 2),
    movementSpeed: clamp(input.movementSpeed, 0.25, 4),
    acceleration: clamp01(input.acceleration),
    pixelStagger: clamp01(input.pixelStagger),
    regionalGrouping: clamp01(input.regionalGrouping),
    dispersal: clamp01(input.dispersal),
    reconstruction: clamp01(input.reconstruction),
    brightnessShift: clamp(input.brightnessShift, -1, 1),
    seed: Math.max(0, Math.min(0x7fffffff, Math.round(input.seed))),
    audioRoutes: Object.freeze([...input.audioRoutes]),
  })
}

export const PIX_GRID_MOTION_PROFILES: readonly PixGridMotionProfile[] = Object.freeze([
  profile({
    id: 'balanced', name: 'Balanced Morph', preferredStrategy: 'automatic', direction: 'automatic',
    pathCurvature: 0.72, movementSpeed: 1, acceleration: 0.45, easing: 'easeInOut', pixelStagger: 0.5,
    regionalGrouping: 0.5, dispersal: 0.35, reconstruction: 0.55, collisionPolicy: 'weightedBlend',
    colorInterpolation: 'rgb', brightnessShift: 0, seed: 101, arrivalBehavior: 'preserve', reversible: false,
    audioRoutes: [
      route('balanced-energy-motion', 'trackRelativeEnergy', 'motionIntensity', 0.5),
      route('balanced-energy-acceleration', 'energy', 'acceleration', 0.65),
      route('balanced-build-dispersal', 'buildProgress', 'dispersal', 0.7),
      route('balanced-snare-dispersal', 'snare', 'dispersal', 0.3),
      route('balanced-phrase-reconstruction', 'phraseProgress', 'reconstruction', 0.45),
      route('balanced-kick-reconstruction', 'kick', 'reconstruction', 0.2),
      route('balanced-kick-regions', 'kick', 'regionPulse', 0.65),
      route('balanced-snare-regions', 'snare', 'regionPulse', 0.35),
      route('balanced-drop-arrival', 'dropImpact', 'completionEmphasis', 0.35),
    ],
  }),
  profile({
    id: 'flow', name: 'Flow', preferredStrategy: 'directionalFlow', direction: 'alternate',
    pathCurvature: 1.25, movementSpeed: 0.86, acceleration: 0.28, easing: 'easeInOut', pixelStagger: 0.38,
    regionalGrouping: 0.35, dispersal: 0.15, reconstruction: 0.42, collisionPolicy: 'nearestOpen',
    colorInterpolation: 'rgb', brightnessShift: 0.04, seed: 211, arrivalBehavior: 'preserve', reversible: false,
    audioRoutes: [route('flow-bass-motion', 'bass', 'motionIntensity', 0.82), route('flow-high-regions', 'high', 'regionPulse', 0.28), route('flow-phrase-rebuild', 'phraseProgress', 'reconstruction', 0.52)],
  }),
  profile({
    id: 'explosive-reconstruction', name: 'Explosive Reconstruction', preferredStrategy: 'disperseReconstruct', direction: 'outward',
    pathCurvature: 1.5, movementSpeed: 1.35, acceleration: 0.78, easing: 'easeOut', pixelStagger: 0.76,
    regionalGrouping: 0.7, dispersal: 0.9, reconstruction: 0.82, collisionPolicy: 'preserveClusters',
    colorInterpolation: 'targetReveal', brightnessShift: 0.12, seed: 307, arrivalBehavior: 'emphasize', reversible: false,
    audioRoutes: [route('explosive-kick-regions', 'kick', 'regionPulse', 0.9), route('explosive-snare-disperse', 'snare', 'dispersal', 0.75), route('explosive-build-rebuild', 'buildProgress', 'reconstruction', 0.84), route('explosive-drop-arrival', 'dropImpact', 'completionEmphasis', 0.8)],
  }),
  profile({
    id: 'clustered-morph', name: 'Clustered Morph', preferredStrategy: 'clusteredMorph', direction: 'automatic',
    pathCurvature: 0.48, movementSpeed: 0.9, acceleration: 0.4, easing: 'easeInOut', pixelStagger: 0.24,
    regionalGrouping: 1, dispersal: 0.18, reconstruction: 0.62, collisionPolicy: 'preserveClusters',
    colorInterpolation: 'sourceHold', brightnessShift: -0.02, seed: 401, arrivalBehavior: 'preserve', reversible: false,
    audioRoutes: [route('cluster-kick-pulse', 'kick', 'regionPulse', 0.72), route('cluster-low-motion', 'lowMid', 'motionIntensity', 0.58), route('cluster-build-rebuild', 'buildProgress', 'reconstruction', 0.62)],
  }),
  profile({
    id: 'directional-assembly', name: 'Directional Assembly', preferredStrategy: 'assemble', direction: 'inward',
    pathCurvature: 0.82, movementSpeed: 1.08, acceleration: 0.58, easing: 'easeOut', pixelStagger: 0.66,
    regionalGrouping: 0.6, dispersal: 0.08, reconstruction: 0.92, collisionPolicy: 'nearestOpen',
    colorInterpolation: 'targetReveal', brightnessShift: 0.08, seed: 503, arrivalBehavior: 'emphasize', reversible: false,
    audioRoutes: [route('assembly-bass-motion', 'bass', 'motionIntensity', 0.68), route('assembly-build-rebuild', 'buildProgress', 'reconstruction', 0.9), route('assembly-downbeat-regions', 'downbeat', 'regionPulse', 0.62), route('assembly-drop-arrival', 'dropImpact', 'completionEmphasis', 0.72)],
  }),
])

export const PIX_GRID_MOTION_PROFILE_BY_ID = new Map(PIX_GRID_MOTION_PROFILES.map(candidate => [candidate.id, candidate]))
export const PIX_GRID_DEFAULT_MOTION_PROFILE_ID = 'balanced'

export function getPixGridMotionProfile(id: unknown): PixGridMotionProfile {
  return PIX_GRID_MOTION_PROFILE_BY_ID.get(typeof id === 'string' ? id : '')
    ?? PIX_GRID_MOTION_PROFILE_BY_ID.get(PIX_GRID_DEFAULT_MOTION_PROFILE_ID)!
}

export function resolvePixGridMotionProfile(input: {
  configuration: Pick<PixGridDeckConfiguration, 'motionProfileId' | 'sceneMotionProfileIds' | 'transitionPolicy'>
  sceneId?: string | null
  sourceItemId: string
  targetItemId: string
}): PixGridResolvedMotionProfile {
  const pair = input.configuration.transitionPolicy.pairOverrides?.find(candidate => candidate.sourceItemId === input.sourceItemId && candidate.targetItemId === input.targetItemId)
  if (pair?.motionProfileId && PIX_GRID_MOTION_PROFILE_BY_ID.has(pair.motionProfileId)) return { profile: getPixGridMotionProfile(pair.motionProfileId), source: 'pair' }
  const sceneProfileId = input.sceneId ? input.configuration.sceneMotionProfileIds?.[input.sceneId] : undefined
  if (sceneProfileId && PIX_GRID_MOTION_PROFILE_BY_ID.has(sceneProfileId)) return { profile: getPixGridMotionProfile(sceneProfileId), source: 'scene' }
  if (input.configuration.motionProfileId && PIX_GRID_MOTION_PROFILE_BY_ID.has(input.configuration.motionProfileId)) return { profile: getPixGridMotionProfile(input.configuration.motionProfileId), source: 'preset' }
  return { profile: getPixGridMotionProfile(PIX_GRID_DEFAULT_MOTION_PROFILE_ID), source: 'engine' }
}

function sourceValue(frame: PixGridAudioFrame, source: PixGridReactionSource): number {
  const routed = frame.sourceValues?.[source]
  if (routed != null) return clamp01(routed)
  const events: Partial<Record<PixGridReactionSource, boolean | undefined>> = {
    beat: frame.beatHit, downbeat: frame.downbeatHit, kick: frame.kickHit, snare: frame.snareHit, hat: frame.hatHit,
    transient: frame.transientHit, barEntry: frame.barEntry, phraseEntry: frame.phraseEntry, sectionEntry: frame.sectionEntry,
    sectionExit: frame.sectionExit, dropImpact: frame.dropImpactHit, trackMapCueEvent: frame.trackMapCueEvent,
  }
  if (source in events) return events[source] ? 1 : 0
  const continuous: Partial<Record<PixGridReactionSource, number | undefined>> = {
    sub: frame.sub, bass: frame.bass, lowMid: frame.lowMid, mid: frame.mid, high: frame.high, air: frame.air,
    volume: frame.volume, energy: frame.energy, trackRelativeEnergy: frame.trackRelativeEnergy,
    spectralFlux: frame.spectralFlux, spectralBrightness: frame.spectralBrightness, tension: frame.tension,
    complexity: frame.complexity, buildProgress: frame.buildProgress, sectionProgress: frame.sectionProgress,
    phraseProgress: frame.phraseProgress, barProgress: frame.barProgress, beatPhase: frame.beatPhase,
    sectionRelativeEnergy: frame.sectionRelativeEnergy, sectionConfidence: frame.sectionConfidence,
    phraseConfidence: frame.phraseConfidence, vocalEnergy: frame.vocalEnergy, vocalActivity: frame.vocalActivity,
    drumActivity: frame.drumActivity, bassStemActivity: frame.bassStemActivity, melodyActivity: frame.melodyActivity,
    semanticMomentStrength: frame.semanticMomentStrength,
  }
  return clamp01(continuous[source] ?? 0)
}

function curved(value: number, curve: PixGridReactionCurve | undefined): number {
  const x = clamp01(value)
  if (curve === 'easeIn' || curve === 'exponential') return x * x
  if (curve === 'easeOut' || curve === 'logarithmic') return 1 - (1 - x) * (1 - x)
  if (curve === 'smoothstep' || curve === 'easeInOut') return x * x * (3 - 2 * x)
  if (curve === 'gate' || curve === 'stepped') return x > 0 ? 1 : 0
  if (curve === 'inverse') return 1 - x
  return x
}

export function resolvePixGridMotionDynamics(input: {
  profile: PixGridMotionProfile
  audioFrame: PixGridAudioFrame
  choreography: { motionScale: number; energy: number; impact: number }
  transitionActive?: boolean
}): PixGridMotionDynamics {
  const profile = input.profile
  const values: Record<PixGridMotionAudioTarget, number> = {
    motionIntensity: clamp01(input.choreography.motionScale / 2.25),
    acceleration: clamp01(profile.acceleration * 0.45 + input.choreography.energy * 0.55),
    dispersal: profile.dispersal * 0.35,
    reconstruction: profile.reconstruction * 0.45,
    regionPulse: 0,
    completionEmphasis: clamp01(input.choreography.impact),
  }
  const seen = new Set<string>()
  for (const route of profile.audioRoutes) {
    if (!route.enabled || seen.has(route.id) || (route.gate === 'transitionOnly' && input.transitionActive === false)) continue
    seen.add(route.id)
    const raw = sourceValue(input.audioFrame, route.source)
    const threshold = clamp01(route.threshold ?? 0)
    const normalized = raw <= threshold ? 0 : (raw - threshold) / Math.max(0.0001, 1 - threshold)
    const contribution = curved(normalized, route.curve) * clamp(route.amount, -2, 2)
    values[route.target] = route.blend === 'replace'
      ? contribution
      : route.blend === 'add'
        ? values[route.target] + contribution
        : Math.max(values[route.target], contribution)
  }
  return {
    motionIntensity: clamp01(values.motionIntensity), acceleration: clamp01(values.acceleration),
    dispersal: clamp01(values.dispersal), reconstruction: clamp01(values.reconstruction),
    regionPulse: clamp01(values.regionPulse), completionEmphasis: clamp01(values.completionEmphasis),
    pathCurvature: profile.pathCurvature, movementSpeed: profile.movementSpeed,
    pixelStagger: profile.pixelStagger, regionalGrouping: profile.regionalGrouping,
    brightnessShift: profile.brightnessShift, colorInterpolation: profile.colorInterpolation, easing: profile.easing,
  }
}

export function pixGridMotionProfileCompileSignature(profile: PixGridMotionProfile): string {
  return [profile.preferredStrategy, profile.direction, profile.regionalGrouping, profile.collisionPolicy, profile.seed].join(':')
}
