import {
  createDefaultCinematicAudioRoutes,
  createDefaultCinematicCameraConfig,
  normalizeCinematicWorldConfig,
  type CinematicAudioRoute,
  type CinematicCameraConfig,
  type CinematicCameraRig,
  type CinematicEnvironmentControls,
  type CinematicMaterialControls,
  type CinematicWorldConfig,
} from './CinematicWorldConfig'
import {
  REACTIVE_CONSTELLATION_DEFAULTS,
  REACTIVE_CONSTELLATION_MACRO_KEYS,
  normalizeCinematicWorldSettings,
  resolveReactiveConstellationSettings,
  type ReactiveConstellationMacroKey,
  type ReactiveConstellationSettings,
  type ReactiveConstellationVisualDnaProfile,
} from './CinematicWorldSettings'

type ProfileSettings = Partial<Omit<ReactiveConstellationSettings,
  'visualDnaProfile' | ReactiveConstellationMacroKey
>>

type CameraPatch = {
  [Key in keyof CinematicCameraConfig]?: Partial<CinematicCameraConfig[Key]>
}

export interface ReactiveConstellationVisualDnaDefinition {
  id: Exclude<ReactiveConstellationVisualDnaProfile, 'custom'>
  label: string
  description: string
  settings: ProfileSettings
  environment: Partial<CinematicEnvironmentControls>
  material: Partial<CinematicMaterialControls>
  cameraRig: CinematicCameraRig
  camera: CameraPatch
  audio: {
    smoothingMs: number
    amountScale: number
    attackScale: number
    releaseScale: number
    targetScale?: Partial<Record<CinematicAudioRoute['target'], number>>
    sourceScale?: Partial<Record<CinematicAudioRoute['source'], number>>
    addRoutes?: CinematicAudioRoute[]
  }
}

const neutralMacros = {
  macroStructure: 0.5,
  macroMotion: 0.5,
  macroImpact: 0.5,
  macroTrails: 0.5,
  macroMaterial: 0.5,
  macroCamera: 0.5,
} satisfies Pick<ReactiveConstellationSettings, ReactiveConstellationMacroKey>

function profileSettingsFromDefaults(): ProfileSettings {
  const {
    visualDnaProfile: _visualDnaProfile,
    macroStructure: _macroStructure,
    macroMotion: _macroMotion,
    macroImpact: _macroImpact,
    macroTrails: _macroTrails,
    macroMaterial: _macroMaterial,
    macroCamera: _macroCamera,
    ...settings
  } = REACTIVE_CONSTELLATION_DEFAULTS
  return { ...settings }
}

export const REACTIVE_CONSTELLATION_VISUAL_DNA_CATALOG: Record<
  Exclude<ReactiveConstellationVisualDnaProfile, 'custom'>,
  ReactiveConstellationVisualDnaDefinition
> = {
  melodicBass: {
    id: 'melodicBass',
    label: 'Melodic Bass',
    description: 'Large luminous crystals, elastic expansion through builds, and a softer cinematic recovery after impacts.',
    settings: {
      nodeCount: 38, topologyStyle: 'cluster', polyhedronStyle: 'mixed', networkSpread: 1.34,
      depthSpread: 0.92, neighborCount: 4, nodeScale: 0.15, nodeScaleVariation: 0.5,
      faceOpacity: 0.76, facetContrast: 1.18, internalGlow: 0.94, rimIntensity: 1.16,
      wireframeAmount: 0.22, colorVariation: 0.72, nodeSpin: 0.22,
      backgroundCurtains: 0.36, curtainDensity: 10, depthFade: 0.64,
      beamWidth: 2.45, beamCoreBrightness: 2.8, beamGlow: 1.38, edgeOpacity: 0.8,
      trailSamples: 16, trailDecay: 0.84, trailSpacing: 0.034, beamFanAmount: 1.12,
      centralGravity: 0.12, cameraOrbit: 0.14, springStrength: 0.66, damping: 0.68,
      driftAmount: 0.24, turbulence: 0.12, orbitAmount: 0.18, elasticity: 0.78,
      topologyStability: 0.76, collapseAmount: 0.04, burstStrength: 0.5, reseedEveryBars: 16,
    },
    environment: { depth: 0.88, fog: 0.22, debris: 0.05, stars: 0.52, atmosphere: 0.62 },
    material: { distortion: 0.025, refraction: 0.06, bloom: 0.82, chromaticAberration: 0.025, feedback: 0.04, glow: 0.9 },
    cameraRig: 'autoDirector',
    camera: { autoDirector: { strength: 0.72, cameraActivity: 0.48, transitionFrequency: 0.42, dropImpact: 0.68, buildIntensity: 0.88, minimumShotDurationSec: 5 } },
    audio: { smoothingMs: 105, amountScale: 1, attackScale: 1.08, releaseScale: 1.18, targetScale: { networkSpread: 1.22, trailLength: 1.18, burstImpulse: 0.82, nodeScale: 1.12 } },
  },
  heavyDubstep: {
    id: 'heavyDubstep',
    label: 'Heavy Dubstep',
    description: 'Fewer oversized nodes, sharp beam cores, violent impact envelopes, and hard camera punctuation.',
    settings: {
      nodeCount: 28, topologyStyle: 'starburst', polyhedronStyle: 'irregularCrystal', networkSpread: 1.14,
      depthSpread: 0.82, neighborCount: 3, nodeScale: 0.185, nodeScaleVariation: 0.64,
      faceOpacity: 0.9, facetContrast: 1.75, internalGlow: 1.16, rimIntensity: 1.52,
      wireframeAmount: 0.5, colorVariation: 0.86, nodeSpin: 0.58,
      backgroundCurtains: 0.58, curtainDensity: 13, depthFade: 0.42,
      beamWidth: 2.05, beamCoreBrightness: 4.15, beamGlow: 1.58, edgeOpacity: 0.94,
      trailSamples: 10, trailDecay: 0.7, trailSpacing: 0.022, beamFanAmount: 1.42,
      centralGravity: 0.34, cameraOrbit: 0.42, springStrength: 1.18, damping: 0.4,
      driftAmount: 0.12, turbulence: 0.58, orbitAmount: 0.62, elasticity: 0.92,
      topologyStability: 0.46, collapseAmount: 0.18, burstStrength: 1.45, reseedEveryBars: 8,
    },
    environment: { depth: 0.84, fog: 0.12, debris: 0.16, stars: 0.28, atmosphere: 0.46 },
    material: { distortion: 0.09, refraction: 0.02, bloom: 0.96, chromaticAberration: 0.09, feedback: 0.025, glow: 1 },
    cameraRig: 'autoDirector',
    camera: { autoDirector: { strength: 0.96, cameraActivity: 0.86, transitionFrequency: 0.82, dropImpact: 1, buildIntensity: 0.62, minimumShotDurationSec: 2.5 }, handheld: { impactShake: 0.34, strength: 0.74 } },
    audio: { smoothingMs: 42, amountScale: 1.2, attackScale: 0.66, releaseScale: 0.72, targetScale: { burstImpulse: 1.5, edgeBrightness: 1.22, edgeWidth: 1.18, trailLength: 0.72, topologyMorph: 1.2 } },
  },
  hybridTrap: {
    id: 'hybridTrap',
    label: 'Hybrid Trap',
    description: 'Asymmetric split networks, quick collapses, sparse negative space, and snare-led rotational snaps.',
    settings: {
      nodeCount: 34, topologyStyle: 'splitClusters', polyhedronStyle: 'mixed', networkSpread: 1.48,
      depthSpread: 1.14, neighborCount: 2, nodeScale: 0.135, nodeScaleVariation: 0.82,
      faceOpacity: 0.8, facetContrast: 1.48, internalGlow: 0.82, rimIntensity: 1.34,
      wireframeAmount: 0.4, colorVariation: 0.94, nodeSpin: 0.78,
      backgroundCurtains: 0.28, curtainDensity: 7, depthFade: 0.5,
      beamWidth: 2.35, beamCoreBrightness: 3.35, beamGlow: 1.1, edgeOpacity: 0.84,
      trailSamples: 8, trailDecay: 0.62, trailSpacing: 0.018, beamFanAmount: 1.5,
      centralGravity: 0.26, cameraOrbit: -0.32, springStrength: 0.98, damping: 0.46,
      driftAmount: 0.28, turbulence: 0.72, orbitAmount: -0.56, elasticity: 0.84,
      topologyStability: 0.42, collapseAmount: 0.32, burstStrength: 1.08, reseedEveryBars: 8,
    },
    environment: { depth: 0.9, fog: 0.16, debris: 0.1, stars: 0.18, atmosphere: 0.42 },
    material: { distortion: 0.08, refraction: 0.03, bloom: 0.86, chromaticAberration: 0.075, feedback: 0.06, glow: 0.92 },
    cameraRig: 'handheld',
    camera: { handheld: { driftStrength: 0.12, impactShake: 0.28, damping: 11, strength: 0.68, frequency: 0.56, maxTranslation: 0.12, maxRotation: 0.08 } },
    audio: {
      smoothingMs: 34, amountScale: 1.08, attackScale: 0.58, releaseScale: 0.7,
      targetScale: { nodeSpin: 1.55, collapseForce: 1.35, trailLength: 0.7, topologyMorph: 1.28 },
      sourceScale: { snare: 1.42, highs: 0.82 },
      addRoutes: [{ id: 'constellation-trap-snare-collapse', enabled: true, source: 'snare', target: 'collapseForce', amount: 0.54, attackMs: 0, releaseMs: 150, beatHoldMs: 8, decayMs: 180, responseCurve: 'easeOut' }],
    },
  },
  house: {
    id: 'house',
    label: 'House',
    description: 'Symmetrical motion, smooth orbiting, shorter trails, and dependable bar-level evolution for long blends.',
    settings: {
      nodeCount: 46, topologyStyle: 'ring', polyhedronStyle: 'octahedron', networkSpread: 1.22,
      depthSpread: 0.68, neighborCount: 3, nodeScale: 0.105, nodeScaleVariation: 0.3,
      faceOpacity: 0.84, facetContrast: 1.02, internalGlow: 0.66, rimIntensity: 0.82,
      wireframeAmount: 0.16, colorVariation: 0.56, nodeSpin: 0.28,
      backgroundCurtains: 0.2, curtainDensity: 8, depthFade: 0.62,
      beamWidth: 2.15, beamCoreBrightness: 2.55, beamGlow: 0.95, edgeOpacity: 0.76,
      trailSamples: 7, trailDecay: 0.6, trailSpacing: 0.038, beamFanAmount: 0.72,
      centralGravity: 0.12, cameraOrbit: 0.24, springStrength: 0.74, damping: 0.72,
      driftAmount: 0.12, turbulence: 0.08, orbitAmount: 0.34, elasticity: 0.46,
      topologyStability: 0.88, collapseAmount: 0.02, burstStrength: 0.42, reseedEveryBars: 16,
    },
    environment: { depth: 0.72, fog: 0.18, debris: 0.03, stars: 0.2, atmosphere: 0.42 },
    material: { distortion: 0.02, refraction: 0.035, bloom: 0.68, chromaticAberration: 0.012, feedback: 0.035, glow: 0.74 },
    cameraRig: 'orbit',
    camera: { orbit: { radius: 2.1, elevation: 0.16, angularSpeed: 0.085, sectionAware: true, safeMargin: 0.2 } },
    audio: { smoothingMs: 92, amountScale: 0.88, attackScale: 1.02, releaseScale: 1.06, targetScale: { burstImpulse: 0.58, trailLength: 0.72, topologyMorph: 1.22 }, sourceScale: { barStart: 1.32, phraseProgress: 1.2 } },
  },
  techno: {
    id: 'techno',
    label: 'Techno',
    description: 'Rigid dense geometry, long feedback memory, restrained camera travel, and mechanical phrase progression.',
    settings: {
      nodeCount: 68, topologyStyle: 'triangulated', polyhedronStyle: 'icosahedron', networkSpread: 1.08,
      depthSpread: 0.94, neighborCount: 6, nodeScale: 0.082, nodeScaleVariation: 0.2,
      faceOpacity: 0.94, facetContrast: 1.64, internalGlow: 0.54, rimIntensity: 1.12,
      wireframeAmount: 0.62, colorVariation: 0.36, nodeSpin: 0.18,
      backgroundCurtains: 0.72, curtainDensity: 20, depthFade: 0.7,
      beamWidth: 1.65, beamCoreBrightness: 3.05, beamGlow: 1.24, edgeOpacity: 0.88,
      trailSamples: 24, trailDecay: 0.92, trailSpacing: 0.028, beamFanAmount: 0.9,
      centralGravity: 0.22, cameraOrbit: 0.08, springStrength: 1.36, damping: 0.82,
      driftAmount: 0.05, turbulence: 0.1, orbitAmount: 0.12, elasticity: 0.24,
      topologyStability: 0.96, collapseAmount: 0.06, burstStrength: 0.56, reseedEveryBars: 32,
    },
    environment: { depth: 0.96, fog: 0.3, debris: 0.04, stars: 0.08, atmosphere: 0.7 },
    material: { distortion: 0.025, refraction: 0.02, bloom: 0.74, chromaticAberration: 0.008, feedback: 0.24, glow: 0.78 },
    cameraRig: 'locked',
    camera: { locked: { fieldOfView: 55, breathingStrength: 0.008, breathingFrequency: 0.12, beatPunch: 0.035 } },
    audio: { smoothingMs: 118, amountScale: 0.92, attackScale: 0.92, releaseScale: 1.3, targetScale: { trailLength: 1.42, burstImpulse: 0.62, topologyMorph: 1.15, nodeSpin: 0.72 }, sourceScale: { phraseProgress: 1.35, barStart: 1.22 } },
  },
  openFormat: {
    id: 'openFormat',
    label: 'Open Format',
    description: 'A balanced, resilient starting point that stays readable across rapid genre and energy changes.',
    settings: profileSettingsFromDefaults(),
    environment: { depth: 0.8, fog: 0.18, debris: 0.06, stars: 0.34, atmosphere: 0.5 },
    material: { distortion: 0.035, refraction: 0.04, bloom: 0.76, chromaticAberration: 0.025, feedback: 0.05, glow: 0.82 },
    cameraRig: 'autoDirector',
    camera: { autoDirector: { strength: 0.78, cameraActivity: 0.62, transitionFrequency: 0.52, dropImpact: 0.78, buildIntensity: 0.7, minimumShotDurationSec: 4 } },
    audio: { smoothingMs: 80, amountScale: 1, attackScale: 1, releaseScale: 1 },
  },
}

export const REACTIVE_CONSTELLATION_VISUAL_DNA_OPTIONS = [
  ...Object.values(REACTIVE_CONSTELLATION_VISUAL_DNA_CATALOG).map(profile => ({
    value: profile.id,
    label: profile.label,
    description: profile.description,
  })),
  { value: 'custom' as const, label: 'Custom', description: 'Your current hand-tuned combination of detailed controls, macros, camera, and audio mappings.' },
]

function scaleTime(value: number | undefined, scale: number): number | undefined {
  return value == null ? value : Math.max(0, Math.round(value * scale))
}

function cloneRoute(route: CinematicAudioRoute): CinematicAudioRoute {
  return { ...route, sectionScale: route.sectionScale ? { ...route.sectionScale } : undefined }
}

export function createReactiveConstellationProfileAudioRoutes(
  profileId: Exclude<ReactiveConstellationVisualDnaProfile, 'custom'>,
): CinematicAudioRoute[] {
  const profile = REACTIVE_CONSTELLATION_VISUAL_DNA_CATALOG[profileId]
  const routes = createDefaultCinematicAudioRoutes('reactiveConstellation').map(route => {
    const targetScale = profile.audio.targetScale?.[route.target] ?? 1
    const sourceScale = profile.audio.sourceScale?.[route.source] ?? 1
    return {
      ...cloneRoute(route),
      amount: Math.max(-2, Math.min(2, route.amount * profile.audio.amountScale * targetScale * sourceScale)),
      attackMs: scaleTime(route.attackMs, profile.audio.attackScale) ?? route.attackMs,
      releaseMs: scaleTime(route.releaseMs, profile.audio.releaseScale) ?? route.releaseMs,
      smoothingMs: scaleTime(route.smoothingMs, profile.audio.releaseScale),
      beatHoldMs: scaleTime(route.beatHoldMs, profile.audio.attackScale),
      decayMs: scaleTime(route.decayMs, profile.audio.releaseScale),
    }
  })
  return [...routes, ...(profile.audio.addRoutes ?? []).map(cloneRoute)]
}

export function applyReactiveConstellationVisualDnaProfile(
  config: CinematicWorldConfig,
  profileId: ReactiveConstellationVisualDnaProfile,
): CinematicWorldConfig {
  const base = normalizeCinematicWorldConfig(config)
  if (base.worldMode !== 'reactiveConstellation' || base.worldSettings.mode !== 'reactiveConstellation') return base
  if (profileId === 'custom') return markReactiveConstellationVisualDnaCustom(base)

  const profile = REACTIVE_CONSTELLATION_VISUAL_DNA_CATALOG[profileId]
  const settings = normalizeCinematicWorldSettings('reactiveConstellation', {
    ...REACTIVE_CONSTELLATION_DEFAULTS,
    ...profile.settings,
    ...neutralMacros,
    visualDnaProfile: profileId,
  })
  const defaultCamera = createDefaultCinematicCameraConfig()
  const camera = {
    ...defaultCamera,
    locked: { ...defaultCamera.locked, ...profile.camera.locked },
    dolly: { ...defaultCamera.dolly, ...profile.camera.dolly },
    orbit: { ...defaultCamera.orbit, ...profile.camera.orbit },
    flyThrough: { ...defaultCamera.flyThrough, ...profile.camera.flyThrough },
    handheld: { ...defaultCamera.handheld, ...profile.camera.handheld },
    autoDirector: { ...defaultCamera.autoDirector, ...profile.camera.autoDirector },
  }
  return normalizeCinematicWorldConfig({
    ...base,
    worldSettings: settings,
    environment: { ...base.environment, ...profile.environment },
    material: { ...base.material, ...profile.material },
    cameraRig: profile.cameraRig,
    camera,
    audioMapping: {
      ...base.audioMapping,
      enabled: true,
      smoothingMs: profile.audio.smoothingMs,
      routes: createReactiveConstellationProfileAudioRoutes(profileId),
    },
  })
}

export function updateReactiveConstellationMacro(
  config: CinematicWorldConfig,
  key: ReactiveConstellationMacroKey,
  value: number,
): CinematicWorldConfig {
  const base = normalizeCinematicWorldConfig(config)
  if (base.worldMode !== 'reactiveConstellation' || base.worldSettings.mode !== 'reactiveConstellation') return base
  const settings = resolveReactiveConstellationSettings(base.worldSettings)
  return normalizeCinematicWorldConfig({
    ...base,
    worldSettings: normalizeCinematicWorldSettings('reactiveConstellation', {
      ...settings,
      [key]: value,
    }),
  })
}

export function markReactiveConstellationVisualDnaCustom(config: CinematicWorldConfig): CinematicWorldConfig {
  const base = normalizeCinematicWorldConfig(config)
  if (base.worldMode !== 'reactiveConstellation' || base.worldSettings.mode !== 'reactiveConstellation') return base
  const settings = resolveReactiveConstellationSettings(base.worldSettings)
  if (settings.visualDnaProfile === 'custom') return base
  return normalizeCinematicWorldConfig({
    ...base,
    worldSettings: normalizeCinematicWorldSettings('reactiveConstellation', {
      ...settings,
      visualDnaProfile: 'custom',
    }),
  })
}

export function isReactiveConstellationMacroKey(value: PropertyKey): value is ReactiveConstellationMacroKey {
  return REACTIVE_CONSTELLATION_MACRO_KEYS.includes(value as ReactiveConstellationMacroKey)
}
