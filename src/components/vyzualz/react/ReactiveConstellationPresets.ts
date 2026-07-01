import {
  createCinematicWorldConfig,
  type CinematicAudioRoute,
  type CinematicAudioSource,
  type CinematicAudioTarget,
} from './CinematicWorldConfig'
import type {
  ReactPreset,
  ReactPresetParams,
  ReactScene,
  ReactSectionMapping,
  ReactSectionType,
} from './ReactTypes'

const SECTION_TYPES: readonly ReactSectionType[] = [
  'intro', 'verse', 'build', 'drop', 'breakdown', 'outro',
]

const SECTION_ID_SUFFIX: Readonly<Record<ReactSectionType, string>> = {
  intro: 'intro',
  verse: 'verse',
  build: 'build',
  preDrop: 'pre-drop',
  drop: 'drop',
  breakdown: 'break',
  bridge: 'bridge',
  outro: 'outro',
  unknown: 'unknown',
}

type SectionParams = Partial<Record<ReactSectionType, Partial<ReactPresetParams>>>

function constellationScenes(prefix: string, params: SectionParams): ReactScene[] {
  return SECTION_TYPES.map(sectionType => ({
    id: `${prefix}-${SECTION_ID_SUFFIX[sectionType]}`,
    sectionType,
    engineId: 'cinematicPortal',
    params: params[sectionType] ?? {},
  }))
}

function constellationMappings(prefix: string): ReactSectionMapping[] {
  return SECTION_TYPES.map(sectionType => ({
    sectionType,
    sceneId: `${prefix}-${SECTION_ID_SUFFIX[sectionType]}`,
  }))
}

function route(
  id: string,
  source: CinematicAudioSource,
  target: CinematicAudioTarget,
  overrides: Partial<Omit<CinematicAudioRoute, 'id' | 'source' | 'target'>> = {},
): CinematicAudioRoute {
  return {
    id,
    enabled: true,
    source,
    target,
    amount: 0.5,
    attackMs: 40,
    releaseMs: 240,
    ...overrides,
  }
}

/**
 * Curated Patch 9 library. These presets deliberately vary topology, physics,
 * trail character, camera direction, audio routing, and section choreography,
 * rather than acting as palette-only variants.
 */
export const REACTIVE_CONSTELLATION_CURATED_PRESETS: readonly ReactPreset[] = [
  {
    id: 'preset-crimson-collapse',
    name: 'Crimson Collapse',
    description: 'A compact crystalline core compresses through the build, then launches outward in a crimson-magenta starburst with elastic overshoot, thick structural beams, and lingering fan-shaped ghosts.',
    engine: 'cinematicPortal',
    palette: { primary: '#e70f3f', secondary: '#d10b84', accent: '#ff6a72', background: '#050006', highlight: '#fff2f6', text: '#ffffff' },
    params: { intensity: 0.98, motion: 0.74, glow: 1, bassReactivity: 0.9 },
    renderSettings: { trailDecay: 0.055, fogDensity: 0.18, particleDensity: 0.26 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      visualDnaProfile: 'heavyDubstep', choreographyProfile: 'crimsonLaunch', macroStructure: 0.82, macroMotion: 0.66, macroImpact: 0.96, macroTrails: 0.94, macroMaterial: 0.98, macroCamera: 0.58,
      nodeCount: 26, topologyStyle: 'starburst', polyhedronStyle: 'mixed', networkSpread: 1.58, depthSpread: 1.42, neighborCount: 2,
      nodeScale: 0.228, nodeScaleVariation: 0.56, faceOpacity: 0.74, facetContrast: 1.9, internalGlow: 1.42, rimIntensity: 1.78, wireframeAmount: 0.34, colorVariation: 0.78, nodeSpin: 0.42,
      backgroundCurtains: 0.62, curtainDensity: 15, depthFade: 0.42, beamWidth: 5.2, beamCoreBrightness: 4.8, beamGlow: 2.12, edgeOpacity: 0.96,
      trailSamples: 28, trailDecay: 0.92, trailSpacing: 0.028, beamFanAmount: 1.74,
      centralGravity: 0.06, cameraOrbit: 0.04, initialExpansion: 0.12, expansionTarget: 1.08, expansionAttackSec: 0.22, expansionReleaseSec: 0.58, expansionSpringStrength: 1.62, expansionDamping: 0.34, expansionOvershoot: 0.5, radialStaggerSec: 0.12, expansionBurstImpulse: 1.9,
      springStrength: 1.26, damping: 0.38, driftAmount: 0.1, turbulence: 0.16, orbitAmount: 0.08, elasticity: 0.94, topologyStability: 0.8, collapseAmount: 0, burstStrength: 1.18, reseedEveryBars: 0,
    }, {
      seed: 49001, qualityTier: 'high', cameraRig: 'autoDirector',
      camera: { autoDirector: { strength: 0.72, cameraActivity: 0.42, transitionFrequency: 0.34, dropImpact: 0.58, buildIntensity: 0.48, minimumShotDurationSec: 4.2, transitionDurationSec: 1.1, preferMusicalBoundaries: true, repeatAvoidance: 4, manualOverrideRig: null, lockUntilNextSection: false, manualCameraLock: false } },
      environment: { depth: 0.98, architecture: 0.08, fog: 0.14, debris: 0.04, stars: 0.12, atmosphere: 0.52 },
      material: { distortion: 0.035, refraction: 0.08, bloom: 1, chromaticAberration: 0.035, feedback: 0, glow: 1 },
      audioMapping: { enabled: true, smoothingMs: 42, routes: [
        route('crimson-sub-mass', 'subBass', 'nodeScale', { amount: 0.28, attackMs: 80, releaseMs: 360, threshold: 0.04, responseCurve: 'easeOut' }),
        route('crimson-sub-glow', 'subBass', 'environmentBrightness', { amount: 0.34, attackMs: 90, releaseMs: 420, threshold: 0.04, responseCurve: 'smoothstep' }),
        route('crimson-kick-burst', 'kick', 'burstImpulse', { amount: 0.48, attackMs: 0, releaseMs: 150, beatHoldMs: 12, decayMs: 190, sectionScale: { drop: 1.18, build: 0.7 } }),
        route('crimson-kick-beam', 'kick', 'edgeWidth', { amount: 0.34, attackMs: 0, releaseMs: 120, beatHoldMs: 10, decayMs: 150 }),
        route('crimson-snare-beams', 'snare', 'edgeBrightness', { amount: 0.68, attackMs: 0, releaseMs: 140, beatHoldMs: 12, decayMs: 180 }),
        route('crimson-build-fans', 'buildProgress', 'trailLength', { amount: 0.82, attackMs: 180, releaseMs: 540, responseCurve: 'smoothstep' }),
        route('crimson-drop-launch', 'dropEntry', 'burstImpulse', { amount: 1.56, attackMs: 0, releaseMs: 500, beatHoldMs: 70, decayMs: 640 }),
        route('crimson-drop-camera', 'dropEntry', 'cameraPunch', { amount: 0.62, attackMs: 0, releaseMs: 340, beatHoldMs: 40, decayMs: 380 }),
      ] },
    }),
    scenes: constellationScenes('rcc', {
      intro: { intensity: 0.34, motion: 0.26, glow: 0.48, bassReactivity: 0.45 }, verse: { intensity: 0.58, motion: 0.46, glow: 0.66, bassReactivity: 0.64 },
      build: { intensity: 0.86, motion: 0.72, glow: 0.9, bassReactivity: 0.82 }, drop: { intensity: 1, motion: 1, glow: 1, bassReactivity: 1 },
      breakdown: { intensity: 0.46, motion: 0.28, glow: 0.58, bassReactivity: 0.42 }, outro: { intensity: 0.28, motion: 0.18, glow: 0.4, bassReactivity: 0.3 },
    }),
    sectionMappings: constellationMappings('rcc'),
  },
  {
    id: 'preset-cyan-reverie',
    name: 'Cyan Reverie',
    description: 'A melodic-bass crystal bloom in cyan and violet, with elastic breathing, gentle recovery, luminous facets, and long graceful trails.',
    engine: 'cinematicPortal',
    palette: { primary: '#28d9ff', secondary: '#7d5cff', accent: '#6dffd0', background: '#010510', highlight: '#e7fbff', text: '#ffffff' },
    params: { intensity: 0.76, motion: 0.58, glow: 0.9, bassReactivity: 0.78 },
    renderSettings: { trailDecay: 0.065, fogDensity: 0.34, particleDensity: 0.4 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      visualDnaProfile: 'melodicBass', macroStructure: 0.56, macroMotion: 0.58, macroImpact: 0.54, macroTrails: 0.84, macroMaterial: 0.86, macroCamera: 0.48,
      nodeCount: 54, topologyStyle: 'branching', polyhedronStyle: 'mixed', networkSpread: 1.5, depthSpread: 1.02, neighborCount: 4,
      nodeScale: 0.14, nodeScaleVariation: 0.54, faceOpacity: 0.76, facetContrast: 1.28, internalGlow: 1.12, rimIntensity: 1.36, wireframeAmount: 0.24, colorVariation: 0.88, nodeSpin: 0.34,
      backgroundCurtains: 0.42, curtainDensity: 12, depthFade: 0.7, beamWidth: 2.3, beamCoreBrightness: 3.1, beamGlow: 1.5, edgeOpacity: 0.78,
      trailSamples: 22, trailDecay: 0.9, trailSpacing: 0.034, beamFanAmount: 1.3,
      centralGravity: 0.14, cameraOrbit: 0.12, springStrength: 0.68, damping: 0.7, driftAmount: 0.34, turbulence: 0.12, orbitAmount: 0.28, elasticity: 0.74, topologyStability: 0.82, collapseAmount: 0.04, burstStrength: 0.58, reseedEveryBars: 32,
    }, {
      seed: 49002, qualityTier: 'high', cameraRig: 'orbit',
      camera: { orbit: { radius: 2.2, elevation: 0.24, angularSpeed: 0.065, direction: 1, sectionAware: true, safeMargin: 0.22 } },
      environment: { depth: 0.9, architecture: 0.04, fog: 0.3, debris: 0.05, stars: 0.58, atmosphere: 0.72 },
      material: { distortion: 0.025, refraction: 0.08, bloom: 0.86, chromaticAberration: 0.025, feedback: 0, glow: 0.92 },
      audioMapping: { enabled: true, smoothingMs: 112, routes: [
        route('reverie-sub-breathe', 'subBass', 'networkSpread', { amount: 0.46, attackMs: 170, releaseMs: 620, responseCurve: 'smoothstep' }),
        route('reverie-mid-crystals', 'mid', 'nodeScale', { amount: 0.34, attackMs: 90, releaseMs: 420, responseCurve: 'easeOut' }),
        route('reverie-high-glimmer', 'highs', 'edgeBrightness', { amount: 0.42, attackMs: 28, releaseMs: 240, threshold: 0.06 }),
        route('reverie-phrase-bloom', 'phraseProgress', 'topologyMorph', { amount: 0.38, attackMs: 260, releaseMs: 700 }),
        route('reverie-build-ribbons', 'buildProgress', 'trailLength', { amount: 0.82, attackMs: 260, releaseMs: 760, responseCurve: 'smoothstep' }),
        route('reverie-drop-open', 'dropEntry', 'burstImpulse', { amount: 0.72, attackMs: 0, releaseMs: 620, beatHoldMs: 80, decayMs: 720 }),
      ] },
    }),
    scenes: constellationScenes('rcr', {
      intro: { intensity: 0.28, motion: 0.2, glow: 0.52, bassReactivity: 0.38 }, verse: { intensity: 0.52, motion: 0.4, glow: 0.7, bassReactivity: 0.58 },
      build: { intensity: 0.78, motion: 0.62, glow: 0.9, bassReactivity: 0.72 }, drop: { intensity: 0.94, motion: 0.78, glow: 1, bassReactivity: 0.9 },
      breakdown: { intensity: 0.44, motion: 0.24, glow: 0.74, bassReactivity: 0.4 }, outro: { intensity: 0.24, motion: 0.16, glow: 0.48, bassReactivity: 0.28 },
    }),
    sectionMappings: constellationMappings('rcr'),
  },
  {
    id: 'preset-monolith-breaker',
    name: 'Monolith Breaker',
    description: 'Huge dark crystal masses hang under tension, then fracture outward on kicks and drops with blunt beams, hard camera impacts, and minimal drift.',
    engine: 'cinematicPortal',
    palette: { primary: '#ff315f', secondary: '#431b70', accent: '#ffbe3d', background: '#020103', highlight: '#fff3db', text: '#ffffff' },
    params: { intensity: 1, motion: 0.86, glow: 0.86, bassReactivity: 1 },
    renderSettings: { trailDecay: 0.04, fogDensity: 0.28, particleDensity: 0.22 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      visualDnaProfile: 'heavyDubstep', macroStructure: 0.84, macroMotion: 0.72, macroImpact: 1, macroTrails: 0.52, macroMaterial: 0.82, macroCamera: 0.96,
      nodeCount: 28, topologyStyle: 'starburst', polyhedronStyle: 'irregularCrystal', networkSpread: 1.08, depthSpread: 1.3, neighborCount: 3,
      nodeScale: 0.245, nodeScaleVariation: 0.38, faceOpacity: 0.96, facetContrast: 1.95, internalGlow: 0.82, rimIntensity: 1.64, wireframeAmount: 0.18, colorVariation: 0.48, nodeSpin: 0.24,
      backgroundCurtains: 0.28, curtainDensity: 7, depthFade: 0.42, beamWidth: 5.4, beamCoreBrightness: 4.6, beamGlow: 1.18, edgeOpacity: 1,
      trailSamples: 11, trailDecay: 0.74, trailSpacing: 0.04, beamFanAmount: 0.82,
      centralGravity: 0.42, cameraOrbit: 0.08, springStrength: 1.48, damping: 0.38, driftAmount: 0.08, turbulence: 0.52, orbitAmount: 0.04, elasticity: 0.94, topologyStability: 0.58, collapseAmount: 0.32, burstStrength: 2.05, reseedEveryBars: 8,
    }, {
      seed: 49003, qualityTier: 'high', cameraRig: 'autoDirector',
      camera: { autoDirector: { strength: 1, cameraActivity: 0.9, transitionFrequency: 0.72, dropImpact: 1, buildIntensity: 0.82, minimumShotDurationSec: 2.4, transitionDurationSec: 0.42, preferMusicalBoundaries: true, repeatAvoidance: 3, manualOverrideRig: null, lockUntilNextSection: false, manualCameraLock: false } },
      environment: { depth: 1, architecture: 0.1, fog: 0.24, debris: 0.12, stars: 0.04, atmosphere: 0.5 },
      material: { distortion: 0.08, refraction: 0.025, bloom: 0.78, chromaticAberration: 0.075, feedback: 0, glow: 0.84 },
      audioMapping: { enabled: true, smoothingMs: 22, routes: [
        route('breaker-sub-weight', 'subBass', 'collapseForce', { amount: 1.18, attackMs: 18, releaseMs: 260, threshold: 0.04 }),
        route('breaker-kick-shatter', 'kick', 'burstImpulse', { amount: 1.72, attackMs: 0, releaseMs: 180, beatHoldMs: 16, decayMs: 220 }),
        route('breaker-snare-facets', 'snare', 'facetOpacity', { amount: 0.58, attackMs: 0, releaseMs: 120, beatHoldMs: 8, decayMs: 150 }),
        route('breaker-energy-width', 'overallEnergy', 'edgeWidth', { amount: 0.72, attackMs: 60, releaseMs: 260 }),
        route('breaker-drop-impact', 'dropEntry', 'cameraPunch', { amount: 1.45, attackMs: 0, releaseMs: 340, beatHoldMs: 55, decayMs: 400 }),
        route('breaker-drop-break', 'dropEntry', 'burstImpulse', { amount: 1.4, attackMs: 0, releaseMs: 480, beatHoldMs: 75, decayMs: 560 }),
      ] },
    }),
    scenes: constellationScenes('rcm', {
      intro: { intensity: 0.38, motion: 0.12, glow: 0.42, bassReactivity: 0.58 }, verse: { intensity: 0.64, motion: 0.32, glow: 0.56, bassReactivity: 0.8 },
      build: { intensity: 0.86, motion: 0.58, glow: 0.72, bassReactivity: 0.92 }, drop: { intensity: 1, motion: 1, glow: 0.94, bassReactivity: 1 },
      breakdown: { intensity: 0.5, motion: 0.16, glow: 0.48, bassReactivity: 0.62 }, outro: { intensity: 0.3, motion: 0.1, glow: 0.34, bassReactivity: 0.42 },
    }),
    sectionMappings: constellationMappings('rcm'),
  },
  {
    id: 'preset-trapwire',
    name: 'Trapwire',
    description: 'An off-center hybrid-trap snare web with split clusters, fast inward snaps, crooked orbital movement, and short razor trails that reset on the bar.',
    engine: 'cinematicPortal',
    palette: { primary: '#eaff00', secondary: '#8b2cff', accent: '#ff305f', background: '#030204', highlight: '#ffffff', text: '#ffffff' },
    params: { intensity: 0.9, motion: 0.94, glow: 0.82, bassReactivity: 0.9 },
    renderSettings: { trailDecay: 0.03, fogDensity: 0.12, particleDensity: 0.18 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      visualDnaProfile: 'hybridTrap', macroStructure: 0.7, macroMotion: 0.96, macroImpact: 0.88, macroTrails: 0.54, macroMaterial: 0.7, macroCamera: 0.78,
      nodeCount: 46, topologyStyle: 'splitClusters', polyhedronStyle: 'tetrahedron', networkSpread: 1.66, depthSpread: 0.82, neighborCount: 3,
      nodeScale: 0.1, nodeScaleVariation: 0.78, faceOpacity: 0.84, facetContrast: 1.58, internalGlow: 0.72, rimIntensity: 1.24, wireframeAmount: 0.64, colorVariation: 1, nodeSpin: 1.08,
      backgroundCurtains: 0.18, curtainDensity: 6, depthFade: 0.82, beamWidth: 1.55, beamCoreBrightness: 3.7, beamGlow: 1.02, edgeOpacity: 0.9,
      trailSamples: 9, trailDecay: 0.64, trailSpacing: 0.02, beamFanAmount: 0.72,
      centralGravity: 0.12, cameraOrbit: -0.36, springStrength: 0.92, damping: 0.5, driftAmount: 0.48, turbulence: 0.82, orbitAmount: -0.64, elasticity: 0.78, topologyStability: 0.46, collapseAmount: 0.58, burstStrength: 1.36, reseedEveryBars: 4,
    }, {
      seed: 49004, qualityTier: 'high', cameraRig: 'handheld',
      camera: { handheld: { driftStrength: 0.1, impactShake: 0.18, damping: 10, strength: 0.72, frequency: 0.72, maxTranslation: 0.12, maxRotation: 0.07 } },
      environment: { depth: 0.74, architecture: 0.02, fog: 0.1, debris: 0.04, stars: 0.28, atmosphere: 0.36 },
      material: { distortion: 0.1, refraction: 0.015, bloom: 0.74, chromaticAberration: 0.14, feedback: 0, glow: 0.78 },
      audioMapping: { enabled: true, smoothingMs: 18, routes: [
        route('trapwire-sub-snap', 'subBass', 'collapseForce', { amount: 1.12, attackMs: 12, releaseMs: 180, threshold: 0.08 }),
        route('trapwire-kick-knot', 'kick', 'topologyMorph', { amount: 0.78, attackMs: 0, releaseMs: 170, beatHoldMs: 8, decayMs: 210, randomizationAmount: 0.34 }),
        route('trapwire-snare-cut', 'snare', 'edgeBrightness', { amount: 1.1, attackMs: 0, releaseMs: 105, beatHoldMs: 6, decayMs: 130 }),
        route('trapwire-high-spin', 'highs', 'nodeSpin', { amount: 0.58, attackMs: 18, releaseMs: 120, threshold: 0.1 }),
        route('trapwire-bar-rewire', 'barStart', 'topologyMorph', { amount: 0.74, attackMs: 0, releaseMs: 360, beatHoldMs: 12, decayMs: 420, randomizationAmount: 0.5 }),
        route('trapwire-drop-snapback', 'dropEntry', 'burstImpulse', { amount: 1.18, attackMs: 0, releaseMs: 360, beatHoldMs: 42, decayMs: 420 }),
      ] },
    }),
    scenes: constellationScenes('rct', {
      intro: { intensity: 0.24, motion: 0.38, glow: 0.36, bassReactivity: 0.42 }, verse: { intensity: 0.58, motion: 0.72, glow: 0.58, bassReactivity: 0.7 },
      build: { intensity: 0.82, motion: 0.92, glow: 0.72, bassReactivity: 0.84 }, drop: { intensity: 1, motion: 1, glow: 0.92, bassReactivity: 1 },
      breakdown: { intensity: 0.4, motion: 0.54, glow: 0.46, bassReactivity: 0.5 }, outro: { intensity: 0.2, motion: 0.32, glow: 0.28, bassReactivity: 0.3 },
    }),
    sectionMappings: constellationMappings('rct'),
  },
  {
    id: 'preset-prism-house',
    name: 'Prism House',
    description: 'A balanced ring of polished prisms that breathes on bars, rotates smoothly through phrases, and keeps the dancefloor readable instead of chaotic.',
    engine: 'cinematicPortal',
    palette: { primary: '#37f2ff', secondary: '#ff4fd8', accent: '#ffe566', background: '#02050a', highlight: '#ffffff', text: '#ffffff' },
    params: { intensity: 0.72, motion: 0.62, glow: 0.8, bassReactivity: 0.7 },
    renderSettings: { trailDecay: 0.055, fogDensity: 0.18, particleDensity: 0.24 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      visualDnaProfile: 'house', macroStructure: 0.66, macroMotion: 0.58, macroImpact: 0.46, macroTrails: 0.62, macroMaterial: 0.78, macroCamera: 0.54,
      nodeCount: 48, topologyStyle: 'ring', polyhedronStyle: 'octahedron', networkSpread: 1.38, depthSpread: 0.56, neighborCount: 4,
      nodeScale: 0.105, nodeScaleVariation: 0.28, faceOpacity: 0.88, facetContrast: 1.32, internalGlow: 0.82, rimIntensity: 1.16, wireframeAmount: 0.22, colorVariation: 0.68, nodeSpin: 0.48,
      backgroundCurtains: 0.26, curtainDensity: 8, depthFade: 0.72, beamWidth: 2.05, beamCoreBrightness: 2.8, beamGlow: 1.18, edgeOpacity: 0.78,
      trailSamples: 13, trailDecay: 0.82, trailSpacing: 0.038, beamFanAmount: 0.88,
      centralGravity: 0.1, cameraOrbit: 0.18, springStrength: 0.62, damping: 0.82, driftAmount: 0.16, turbulence: 0.08, orbitAmount: 0.44, elasticity: 0.5, topologyStability: 0.94, collapseAmount: 0.02, burstStrength: 0.4, reseedEveryBars: 32,
    }, {
      seed: 49005, qualityTier: 'medium', cameraRig: 'orbit',
      camera: { orbit: { radius: 2.05, elevation: 0.12, angularSpeed: 0.09, direction: 1, sectionAware: true, safeMargin: 0.2 } },
      environment: { depth: 0.68, architecture: 0.12, fog: 0.16, debris: 0.02, stars: 0.2, atmosphere: 0.5 },
      material: { distortion: 0.018, refraction: 0.1, bloom: 0.76, chromaticAberration: 0.03, feedback: 0, glow: 0.8 },
      audioMapping: { enabled: true, smoothingMs: 96, routes: [
        route('house-bar-breathe', 'barStart', 'networkSpread', { amount: 0.46, attackMs: 0, releaseMs: 620, beatHoldMs: 20, decayMs: 700 }),
        route('house-bass-size', 'bass', 'nodeScale', { amount: 0.24, attackMs: 70, releaseMs: 300 }),
        route('house-beat-lines', 'beat', 'edgeBrightness', { amount: 0.42, attackMs: 0, releaseMs: 170, beatHoldMs: 8, decayMs: 210 }),
        route('house-phase-turn', 'barPosition', 'nodeSpin', { amount: 0.34, attackMs: 0, releaseMs: 0, responseCurve: 'smoothstep' }),
        route('house-phrase-symmetry', 'phraseProgress', 'topologyMorph', { amount: 0.24, attackMs: 260, releaseMs: 520 }),
        route('house-drop-lift', 'dropEntry', 'burstImpulse', { amount: 0.58, attackMs: 0, releaseMs: 420, beatHoldMs: 38, decayMs: 480 }),
      ] },
    }),
    scenes: constellationScenes('rch', {
      intro: { intensity: 0.3, motion: 0.26, glow: 0.44, bassReactivity: 0.42 }, verse: { intensity: 0.56, motion: 0.5, glow: 0.62, bassReactivity: 0.62 },
      build: { intensity: 0.74, motion: 0.66, glow: 0.78, bassReactivity: 0.72 }, drop: { intensity: 0.9, motion: 0.8, glow: 0.92, bassReactivity: 0.88 },
      breakdown: { intensity: 0.46, motion: 0.34, glow: 0.56, bassReactivity: 0.48 }, outro: { intensity: 0.26, motion: 0.22, glow: 0.38, bassReactivity: 0.32 },
    }),
    sectionMappings: constellationMappings('rch'),
  },
  {
    id: 'preset-industrial-lattice',
    name: 'Industrial Lattice',
    description: 'A dense, rigid techno machine of steel-blue octahedra, long disciplined beam curtains, restrained motion, and relentless phase-locked evolution.',
    engine: 'cinematicPortal',
    palette: { primary: '#7da7b8', secondary: '#2e5668', accent: '#ff4a36', background: '#010304', highlight: '#dff8ff', text: '#ffffff' },
    params: { intensity: 0.82, motion: 0.58, glow: 0.74, bassReactivity: 0.82 },
    renderSettings: { trailDecay: 0.075, fogDensity: 0.42, particleDensity: 0.32 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      visualDnaProfile: 'techno', macroStructure: 0.96, macroMotion: 0.5, macroImpact: 0.62, macroTrails: 0.9, macroMaterial: 0.72, macroCamera: 0.4,
      nodeCount: 78, topologyStyle: 'triangulated', polyhedronStyle: 'octahedron', networkSpread: 1.3, depthSpread: 1.12, neighborCount: 7,
      nodeScale: 0.072, nodeScaleVariation: 0.18, faceOpacity: 0.94, facetContrast: 1.7, internalGlow: 0.58, rimIntensity: 1.08, wireframeAmount: 0.76, colorVariation: 0.32, nodeSpin: 0.22,
      backgroundCurtains: 0.9, curtainDensity: 22, depthFade: 0.42, beamWidth: 1.45, beamCoreBrightness: 3.5, beamGlow: 0.92, edgeOpacity: 0.88,
      trailSamples: 28, trailDecay: 0.92, trailSpacing: 0.045, beamFanAmount: 1.45,
      centralGravity: 0.22, cameraOrbit: 0.05, springStrength: 1.4, damping: 0.86, driftAmount: 0.06, turbulence: 0.1, orbitAmount: 0.12, elasticity: 0.28, topologyStability: 1, collapseAmount: 0.08, burstStrength: 0.58, reseedEveryBars: 16,
    }, {
      seed: 49006, qualityTier: 'ultra', cameraRig: 'dolly',
      camera: { dolly: { range: 0.72, speed: 0.075, direction: 1, easing: 'smoothstep', beatAcceleration: 0.08, buildAcceleration: 0.36 } },
      environment: { depth: 1, architecture: 0.4, fog: 0.4, debris: 0.04, stars: 0.02, atmosphere: 0.58 },
      material: { distortion: 0.02, refraction: 0.018, bloom: 0.68, chromaticAberration: 0.012, feedback: 0, glow: 0.72 },
      audioMapping: { enabled: true, smoothingMs: 72, routes: [
        route('industrial-sub-pressure', 'subBass', 'networkSpread', { amount: 0.26, attackMs: 90, releaseMs: 340 }),
        route('industrial-kick-strike', 'kick', 'edgeWidth', { amount: 0.46, attackMs: 0, releaseMs: 150, beatHoldMs: 10, decayMs: 180 }),
        route('industrial-high-current', 'highMid', 'edgeBrightness', { amount: 0.32, attackMs: 35, releaseMs: 180, threshold: 0.08 }),
        route('industrial-bar-index', 'barStart', 'topologyMorph', { amount: 0.34, attackMs: 0, releaseMs: 760, beatHoldMs: 24, decayMs: 880, randomizationAmount: 0.12 }),
        route('industrial-build-rails', 'buildProgress', 'trailLength', { amount: 0.68, attackMs: 320, releaseMs: 920 }),
        route('industrial-drop-piston', 'dropEntry', 'collapseForce', { amount: 0.72, attackMs: 0, releaseMs: 420, beatHoldMs: 54, decayMs: 500 }),
      ] },
    }),
    scenes: constellationScenes('rci', {
      intro: { intensity: 0.38, motion: 0.22, glow: 0.4, bassReactivity: 0.5 }, verse: { intensity: 0.62, motion: 0.42, glow: 0.58, bassReactivity: 0.7 },
      build: { intensity: 0.78, motion: 0.56, glow: 0.7, bassReactivity: 0.82 }, drop: { intensity: 0.94, motion: 0.72, glow: 0.86, bassReactivity: 0.96 },
      breakdown: { intensity: 0.48, motion: 0.3, glow: 0.5, bassReactivity: 0.56 }, outro: { intensity: 0.3, motion: 0.18, glow: 0.34, bassReactivity: 0.38 },
    }),
    sectionMappings: constellationMappings('rci'),
  },
  {
    id: 'preset-aurora-bloom',
    name: 'Aurora Bloom',
    description: 'A festival-ready open-format bloom that moves through cyan, emerald, violet, and gold with broad topology changes and inviting cinematic sweeps.',
    engine: 'cinematicPortal',
    palette: { primary: '#32e6ff', secondary: '#8a5cff', accent: '#ffd84a', background: '#010611', highlight: '#64ffbf', text: '#ffffff' },
    params: { intensity: 0.86, motion: 0.74, glow: 0.96, bassReactivity: 0.82 },
    renderSettings: { trailDecay: 0.06, fogDensity: 0.28, particleDensity: 0.62 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      visualDnaProfile: 'openFormat', macroStructure: 0.72, macroMotion: 0.72, macroImpact: 0.7, macroTrails: 0.78, macroMaterial: 0.98, macroCamera: 0.8,
      nodeCount: 64, topologyStyle: 'branching', polyhedronStyle: 'mixed', networkSpread: 1.78, depthSpread: 1.36, neighborCount: 4,
      nodeScale: 0.11, nodeScaleVariation: 0.82, faceOpacity: 0.8, facetContrast: 1.44, internalGlow: 1.3, rimIntensity: 1.54, wireframeAmount: 0.38, colorVariation: 1, nodeSpin: 0.68,
      backgroundCurtains: 0.58, curtainDensity: 15, depthFade: 0.68, beamWidth: 2.45, beamCoreBrightness: 3.4, beamGlow: 1.72, edgeOpacity: 0.82,
      trailSamples: 19, trailDecay: 0.84, trailSpacing: 0.03, beamFanAmount: 1.18,
      centralGravity: 0.12, cameraOrbit: 0.28, springStrength: 0.74, damping: 0.62, driftAmount: 0.42, turbulence: 0.3, orbitAmount: 0.48, elasticity: 0.7, topologyStability: 0.66, collapseAmount: 0.12, burstStrength: 0.92, reseedEveryBars: 16,
    }, {
      seed: 49007, qualityTier: 'high', cameraRig: 'autoDirector',
      camera: { autoDirector: { strength: 0.88, cameraActivity: 0.78, transitionFrequency: 0.62, dropImpact: 0.86, buildIntensity: 0.82, minimumShotDurationSec: 3.4, transitionDurationSec: 0.72, preferMusicalBoundaries: true, repeatAvoidance: 3, manualOverrideRig: null, lockUntilNextSection: false, manualCameraLock: false } },
      environment: { depth: 0.92, architecture: 0.04, fog: 0.24, debris: 0.12, stars: 0.74, atmosphere: 0.84 },
      material: { distortion: 0.04, refraction: 0.12, bloom: 0.94, chromaticAberration: 0.06, feedback: 0, glow: 1 },
      audioMapping: { enabled: true, smoothingMs: 82, routes: [
        route('aurora-sub-open', 'subBass', 'networkSpread', { amount: 0.42, attackMs: 110, releaseMs: 430 }),
        route('aurora-mid-color', 'mid', 'facetOpacity', { amount: 0.3, attackMs: 70, releaseMs: 310 }),
        route('aurora-high-sparkle', 'highs', 'edgeBrightness', { amount: 0.54, attackMs: 24, releaseMs: 190, threshold: 0.05 }),
        route('aurora-phrase-flower', 'phraseProgress', 'topologyMorph', { amount: 0.56, attackMs: 220, releaseMs: 620 }),
        route('aurora-build-streamers', 'buildProgress', 'trailLength', { amount: 0.76, attackMs: 230, releaseMs: 680 }),
        route('aurora-drop-bloom', 'dropEntry', 'burstImpulse', { amount: 0.94, attackMs: 0, releaseMs: 520, beatHoldMs: 60, decayMs: 620 }),
      ] },
    }),
    scenes: constellationScenes('rca', {
      intro: { intensity: 0.3, motion: 0.24, glow: 0.5, bassReactivity: 0.38 }, verse: { intensity: 0.58, motion: 0.5, glow: 0.74, bassReactivity: 0.62 },
      build: { intensity: 0.82, motion: 0.72, glow: 0.94, bassReactivity: 0.8 }, drop: { intensity: 1, motion: 0.9, glow: 1, bassReactivity: 0.96 },
      breakdown: { intensity: 0.48, motion: 0.34, glow: 0.78, bassReactivity: 0.44 }, outro: { intensity: 0.26, motion: 0.2, glow: 0.46, bassReactivity: 0.28 },
    }),
    sectionMappings: constellationMappings('rca'),
  },
  {
    id: 'preset-minimal-skeleton',
    name: 'Minimal Skeleton',
    description: 'A sparse, low-load constellation for weaker hardware: sixteen clean nodes, a small beam fan, no background curtains, and a calm locked composition.',
    engine: 'cinematicPortal',
    palette: { primary: '#9fdcff', secondary: '#4c6b78', accent: '#eaf8ff', background: '#010203', highlight: '#ffffff', text: '#ffffff' },
    params: { intensity: 0.52, motion: 0.38, glow: 0.58, bassReactivity: 0.56 },
    renderSettings: { trailDecay: 0.025, fogDensity: 0.08, particleDensity: 0.05 },
    cinematicConfig: createCinematicWorldConfig('reactiveConstellation', {
      visualDnaProfile: 'custom', macroStructure: 0.26, macroMotion: 0.34, macroImpact: 0.34, macroTrails: 0.24, macroMaterial: 0.42, macroCamera: 0.12,
      nodeCount: 16, topologyStyle: 'chain', polyhedronStyle: 'tetrahedron', networkSpread: 1.14, depthSpread: 0.52, neighborCount: 2,
      nodeScale: 0.105, nodeScaleVariation: 0.22, faceOpacity: 0.92, facetContrast: 1.1, internalGlow: 0.38, rimIntensity: 0.72, wireframeAmount: 0.12, colorVariation: 0.24, nodeSpin: 0.12,
      backgroundCurtains: 0, curtainDensity: 0, depthFade: 0.92, beamWidth: 1.35, beamCoreBrightness: 2.2, beamGlow: 0.62, edgeOpacity: 0.74,
      trailSamples: 5, trailDecay: 0.68, trailSpacing: 0.06, beamFanAmount: 0.38,
      centralGravity: 0.08, cameraOrbit: 0, springStrength: 0.66, damping: 0.8, driftAmount: 0.1, turbulence: 0.04, orbitAmount: 0.06, elasticity: 0.38, topologyStability: 0.96, collapseAmount: 0.02, burstStrength: 0.3, reseedEveryBars: 0,
    }, {
      seed: 49008, qualityTier: 'low', cameraRig: 'locked',
      camera: { locked: { position: { x: 0, y: 0, z: 2.3 }, rotation: { x: 0, y: 0, z: 0 }, fieldOfView: 54, breathingStrength: 0.008, breathingFrequency: 0.12, beatPunch: 0.035 } },
      environment: { depth: 0.48, architecture: 0, fog: 0.06, debris: 0, stars: 0.12, atmosphere: 0.22 },
      material: { distortion: 0, refraction: 0.01, bloom: 0.48, chromaticAberration: 0, feedback: 0, glow: 0.54 },
      audioMapping: { enabled: true, smoothingMs: 130, routes: [
        route('skeleton-bass-size', 'bass', 'nodeScale', { amount: 0.2, attackMs: 100, releaseMs: 380 }),
        route('skeleton-beat-line', 'beat', 'edgeBrightness', { amount: 0.28, attackMs: 0, releaseMs: 190, beatHoldMs: 8, decayMs: 230 }),
        route('skeleton-bar-shift', 'barStart', 'topologyMorph', { amount: 0.18, attackMs: 0, releaseMs: 680, beatHoldMs: 18, decayMs: 760 }),
        route('skeleton-drop-nudge', 'dropEntry', 'burstImpulse', { amount: 0.38, attackMs: 0, releaseMs: 420, beatHoldMs: 35, decayMs: 480 }),
      ] },
    }),
    scenes: constellationScenes('rcs', {
      intro: { intensity: 0.22, motion: 0.14, glow: 0.28, bassReactivity: 0.3 }, verse: { intensity: 0.4, motion: 0.28, glow: 0.44, bassReactivity: 0.46 },
      build: { intensity: 0.54, motion: 0.38, glow: 0.56, bassReactivity: 0.56 }, drop: { intensity: 0.68, motion: 0.52, glow: 0.7, bassReactivity: 0.68 },
      breakdown: { intensity: 0.3, motion: 0.18, glow: 0.36, bassReactivity: 0.34 }, outro: { intensity: 0.18, motion: 0.1, glow: 0.24, bassReactivity: 0.22 },
    }),
    sectionMappings: constellationMappings('rcs'),
  },
]
