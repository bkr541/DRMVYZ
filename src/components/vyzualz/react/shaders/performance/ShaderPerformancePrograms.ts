import type { ReactSectionType } from '../../ReactTypes'
import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'
import type { ShaderSectionRule, TransitionDefinition } from '../transitions/shaderTransitionTypes'
import { createBuiltInShaderRoute } from './ShaderPerformanceRoutes'
import {
  SHADER_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
  type ShaderPerformanceAction,
  type ShaderPerformanceProgram,
} from './ShaderPerformanceProgramTypes'

const PROGRAM_VERSION = 2

function action(
  targetParamId: string,
  value: number,
  operation: 'addNormalized' | 'multiply' | 'replaceNormalized' = 'addNormalized',
): ShaderPerformanceAction {
  return { type: 'param', targetParamId, value, operation }
}

function transition(
  type: TransitionDefinition['type'],
  durationMs: number,
  seed: number,
  clearFeedback: TransitionDefinition['clearFeedback'] = 'preserve',
): TransitionDefinition {
  return {
    type,
    durationMs,
    easing: 'ease-in-out',
    direction: 'forward',
    intensity: 0.78,
    seed,
    startTrigger: 'immediate',
    clearFeedback,
  }
}

interface ProgramTargets {
  motion: string
  bass: string
  impact: string
  accent: string
  build: string
  recruit: string
  evolution: string
  phrase: string
  vocal?: string
}

interface ProgramRouteSpec {
  key: string
  source: ShaderModulationRoute['source']
  target: string
  amount: number
  mode?: ShaderModulationRoute['mode']
  curve?: ShaderModulationRoute['curve']
  combineMode?: ShaderModulationRoute['combineMode']
  attackMs?: number
  holdMs?: number
  releaseMs?: number
  threshold?: number
  fallbackSources?: ShaderModulationRoute['fallbackSources']
  minimumConfidence?: number
  conditions?: ShaderModulationRoute['conditions']
}

interface ProgramSpec {
  shaderId: string
  name: string
  description: string
  visualIdentity: string
  targets: ProgramTargets
  routeSpecs: readonly ProgramRouteSpec[]
  introMotion?: number
  verseMotion?: number
  dropImpact?: number
  dropTwoDelta?: number
  breakdownMotion?: number
}

function route(shaderId: string, spec: ProgramRouteSpec): ShaderModulationRoute {
  return createBuiltInShaderRoute(shaderId, PROGRAM_VERSION, spec.key, {
    source: spec.source,
    targetParamId: spec.target,
    enabled: true,
    amount: spec.amount,
    outputMin: 0,
    outputMax: 1,
    curve: spec.curve ?? 'easeOut',
    invert: false,
    attackMs: spec.attackMs ?? 24,
    holdMs: spec.holdMs ?? 0,
    releaseMs: spec.releaseMs ?? 220,
    decayMs: spec.releaseMs ?? 220,
    retrigger: true,
    mode: spec.mode ?? 'continuous',
    combineMode: spec.combineMode ?? 'add',
    threshold: spec.threshold ?? (spec.mode === 'trigger' ? 0.35 : 0),
    minimumConfidence: spec.minimumConfidence,
    fallbackSources: spec.fallbackSources,
    conditions: spec.conditions,
  })
}

function sectionRule(
  shaderId: string,
  sectionType: ReactSectionType,
  transitionDef: TransitionDefinition,
): ShaderSectionRule {
  return {
    sectionType,
    toSceneId: shaderId,
    transition: transitionDef,
    clearFeedback: transitionDef.clearFeedback,
    // The active performance plan owns concrete parameter state. This metadata
    // keeps the existing choreography controller inspectable without creating
    // a second parameter-authority path.
    paramOverrides: { performancePlan: sectionType },
  }
}

function buildProgram(spec: ProgramSpec): ShaderPerformanceProgram {
  const t = spec.targets
  const introMotion = spec.introMotion ?? -0.10
  const verseMotion = spec.verseMotion ?? 0.035
  const dropImpact = spec.dropImpact ?? 0.12
  const dropTwoDelta = spec.dropTwoDelta ?? 0.055
  const breakdownMotion = spec.breakdownMotion ?? -0.08
  const fallbackSceneId = `${spec.shaderId}:unknown`

  return {
    schemaVersion: SHADER_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
    version: PROGRAM_VERSION,
    id: `${spec.shaderId}:native-show-director`,
    metadata: {
      name: `${spec.name} Native Show`,
      description: spec.description,
      engine: 'shader',
      version: PROGRAM_VERSION,
      authoringRevision: 'shader-native-show-director-patch-2',
      visualIdentity: spec.visualIdentity,
    },
    targetRoles: { ...t },
    authoredRoutes: spec.routeSpecs.map(item => route(spec.shaderId, item)),
    sectionChoreography: [
      sectionRule(spec.shaderId, 'intro', transition('crossfade', 900, 11)),
      sectionRule(spec.shaderId, 'verse', transition('luma-dissolve', 720, 17)),
      sectionRule(spec.shaderId, 'build', transition('zoom-tunnel', 620, 23)),
      sectionRule(spec.shaderId, 'preDrop', transition('feedback-collapse', 420, 29, 'at-midpoint')),
      sectionRule(spec.shaderId, 'drop', transition('flash-cut', 180, 31, 'at-start')),
      sectionRule(spec.shaderId, 'breakdown', transition('liquid-melt', 960, 37)),
      sectionRule(spec.shaderId, 'bridge', transition('rgb-split-dissolve', 680, 41)),
      sectionRule(spec.shaderId, 'outro', transition('noise-dissolve', 1100, 43, 'at-completion')),
      sectionRule(spec.shaderId, 'unknown', transition('crossfade', 650, 47)),
    ],
    fallbackOrder: ['verse', 'intro', 'unknown'],
    fallbackSceneId,
    scenes: [
      {
        id: `${spec.shaderId}:intro`,
        sectionTypes: ['intro'],
        minConfidence: 0.25,
        actions: [action(t.motion, introMotion), action(t.recruit, -0.08), action(t.accent, -0.04)],
        fourBarActions: [
          [action(t.phrase, 0.018)],
          [action(t.phrase, -0.012)],
        ],
        eightBarRecruitment: [
          [action(t.recruit, 0.015)],
          [action(t.recruit, 0.035)],
        ],
        sixteenBarEvolution: [[action(t.evolution, 0.025)]],
      },
      {
        id: `${spec.shaderId}:verse`,
        sectionTypes: ['verse'],
        minConfidence: 0.25,
        actions: [action(t.motion, verseMotion), action(t.bass, 0.025)],
        fourBarActions: [
          [action(t.phrase, 0.022)],
          [action(t.accent, 0.018)],
          [action(t.phrase, -0.014)],
          [action(t.recruit, 0.02)],
        ],
        eightBarRecruitment: [
          [action(t.recruit, 0.025)],
          [action(t.recruit, 0.05), action(t.accent, 0.018)],
        ],
        sixteenBarEvolution: [
          [action(t.evolution, 0.03)],
          [action(t.evolution, 0.055), action(t.motion, 0.025)],
        ],
      },
      {
        id: `${spec.shaderId}:build`,
        sectionTypes: ['build'],
        minConfidence: 0.25,
        actions: [action(t.build, 0.075), action(t.motion, 0.055), action(t.recruit, 0.04)],
        bodyActions: [action(t.build, 0.045)],
        fourBarActions: [
          [action(t.build, 0.018)],
          [action(t.build, 0.038), action(t.accent, 0.02)],
        ],
        eightBarRecruitment: [[action(t.recruit, 0.06)], [action(t.recruit, 0.09)]],
        sixteenBarEvolution: [[action(t.evolution, 0.07), action(t.motion, 0.04)]],
      },
      {
        id: `${spec.shaderId}:pre-drop`,
        sectionTypes: ['preDrop'],
        minConfidence: 0.25,
        actions: [
          action(t.motion, -0.115),
          action(t.bass, -0.055),
          action(t.build, 0.12),
          action(t.accent, -0.035),
        ],
        exitActions: [action(t.impact, 0.045)],
      },
      {
        id: `${spec.shaderId}:drop-two-plus`,
        sectionTypes: ['drop'],
        minConfidence: 0.25,
        dropOccurrence: { minOccurrence: 2 },
        priority: 20,
        actions: [
          action(t.impact, dropImpact + dropTwoDelta),
          action(t.motion, 0.105),
          action(t.bass, 0.075),
          action(t.recruit, 0.095),
          action(t.evolution, 0.065),
        ],
        fourBarActions: [
          [action(t.accent, 0.055)],
          [action(t.phrase, 0.05), action(t.motion, 0.025)],
          [action(t.impact, 0.035)],
          [action(t.recruit, 0.04), action(t.evolution, 0.035)],
        ],
        eightBarRecruitment: [[action(t.recruit, 0.07)], [action(t.recruit, 0.11)]],
        sixteenBarEvolution: [[action(t.evolution, 0.09), action(t.accent, 0.035)]],
        eventActions: {
          semanticMoment: [{ type: 'feedbackReset', reason: 'semantic' }],
        },
      },
      {
        id: `${spec.shaderId}:drop-one`,
        sectionTypes: ['drop'],
        minConfidence: 0.25,
        priority: 10,
        actions: [
          action(t.impact, dropImpact),
          action(t.motion, 0.075),
          action(t.bass, 0.055),
          action(t.recruit, 0.065),
        ],
        fourBarActions: [
          [action(t.accent, 0.04)],
          [action(t.phrase, 0.038)],
          [action(t.impact, 0.022)],
          [action(t.recruit, 0.03)],
        ],
        eightBarRecruitment: [[action(t.recruit, 0.055)], [action(t.recruit, 0.085)]],
        sixteenBarEvolution: [[action(t.evolution, 0.065)]],
      },
      {
        id: `${spec.shaderId}:breakdown`,
        sectionTypes: ['breakdown'],
        minConfidence: 0.25,
        actions: [
          action(t.motion, breakdownMotion),
          action(t.impact, -0.075),
          action(t.recruit, -0.055),
          action(t.phrase, 0.025),
          ...(t.vocal ? [action(t.vocal, 0.045)] : []),
        ],
        fourBarActions: [[action(t.phrase, 0.025)], [action(t.evolution, 0.018)]],
      },
      {
        id: `${spec.shaderId}:bridge`,
        sectionTypes: ['bridge'],
        minConfidence: 0.25,
        actions: [action(t.motion, 0.015), action(t.evolution, 0.04), action(t.accent, 0.025)],
        fourBarActions: [[action(t.phrase, 0.03)], [action(t.recruit, 0.028)]],
      },
      {
        id: `${spec.shaderId}:outro`,
        sectionTypes: ['outro'],
        minConfidence: 0.25,
        actions: [action(t.motion, -0.12), action(t.recruit, -0.095), action(t.impact, -0.08)],
        sixteenBarEvolution: [[action(t.evolution, -0.045)]],
      },
      {
        id: fallbackSceneId,
        sectionTypes: ['unknown'],
        actions: [action(t.motion, 0.01), action(t.bass, 0.018)],
        fourBarActions: [[action(t.phrase, 0.012)]],
      },
    ],
  }
}

const PROGRAMS: readonly ShaderPerformanceProgram[] = [
  buildProgram({
    shaderId: 'shader-neon-tunnel',
    name: 'Prism Tunnel',
    description: 'Directs travel, twist, depth emphasis, glow impacts, and phrase-scale tunnel evolution.',
    visualIdentity: 'vanishing-point tunnel travel with controlled geometric acceleration',
    targets: { motion: 'speed', bass: 'tunnelRadius', impact: 'glow', accent: 'warp', build: 'speed', recruit: 'warp', evolution: 'rotation', phrase: 'rotation' },
    routeSpecs: [
      { key: 'kick-depth', source: 'kick', target: 'tunnelRadius', amount: 0.08, mode: 'trigger', holdMs: 35, releaseMs: 180, fallbackSources: ['bass'] },
      { key: 'snare-warp', source: 'snare', target: 'warp', amount: 0.105, mode: 'trigger', releaseMs: 240, fallbackSources: ['transient'] },
      { key: 'bass-travel', source: 'bass', target: 'speed', amount: 0.055, attackMs: 35, releaseMs: 240, fallbackSources: ['nBass'] },
      { key: 'energy-glow', source: 'energy', target: 'glow', amount: 0.09, attackMs: 90, releaseMs: 360 },
      { key: 'build-acceleration', source: 'buildProgress', target: 'speed', amount: 0.11, attackMs: 180, releaseMs: 420, minimumConfidence: 0.35, fallbackSources: ['tension'], conditions: { sectionTypes: ['build', 'preDrop'] } },
      { key: 'phrase-twist', source: 'phrase8Hit', target: 'rotation', amount: 0.08, mode: 'trigger', holdMs: 60, releaseMs: 620, fallbackSources: ['downbeat'] },
      { key: 'drop-vanish', source: 'dropImpact', target: 'warp', amount: 0.16, mode: 'trigger', releaseMs: 420, conditions: { sectionTypes: ['drop'] } },
    ],
  }),
  buildProgram({
    shaderId: 'shader-liquid-metaballs',
    name: 'Liquid Metaballs',
    description: 'Directs merge pressure, viscosity, surface distortion, highlights, and phrase-scale fluid expansion.',
    visualIdentity: 'viscous luminous forms that merge and breathe instead of flickering',
    targets: { motion: 'motionSpeed', bass: 'scale', impact: 'turbulence', accent: 'reflection', build: 'viscosity', recruit: 'scale', evolution: 'turbulence', phrase: 'viscosity' },
    routeSpecs: [
      { key: 'kick-merge', source: 'kick', target: 'scale', amount: 0.075, mode: 'trigger', holdMs: 45, releaseMs: 260, fallbackSources: ['bass'] },
      { key: 'snare-specular', source: 'snare', target: 'reflection', amount: 0.11, mode: 'trigger', releaseMs: 310, fallbackSources: ['high'] },
      { key: 'sub-viscosity', source: 'sub', target: 'viscosity', amount: -0.055, attackMs: 90, releaseMs: 420, fallbackSources: ['bass'] },
      { key: 'energy-motion', source: 'energyShort', target: 'motionSpeed', amount: 0.065, attackMs: 120, releaseMs: 480, fallbackSources: ['energy'] },
      { key: 'build-pressure', source: 'buildProgress', target: 'turbulence', amount: 0.12, attackMs: 220, releaseMs: 500, conditions: { sectionTypes: ['build', 'preDrop'] } },
      { key: 'phrase-breath', source: 'phrase16', target: 'scale', amount: 0.035, mode: 'phase', curve: 'easeInOut' },
      { key: 'drop-surface', source: 'dropImpact', target: 'turbulence', amount: 0.18, mode: 'trigger', holdMs: 35, releaseMs: 520, conditions: { sectionTypes: ['drop'] } },
    ],
  }),
  buildProgram({
    shaderId: 'shader-brand-echo-signal',
    name: 'Brand Echo Signal',
    description: 'Directs repetition count, scan rhythm, logo refraction, echo spacing, and vocal-led signal openings.',
    visualIdentity: 'branded signal ribbons with deliberate repetition and interruption',
    targets: { motion: 'waveAmount', bass: 'echoSpread', impact: 'logoRefraction', accent: 'waveAmount', build: 'echoSpread', recruit: 'ribbonCount', evolution: 'logoRefraction', phrase: 'echoSpread', vocal: 'logoRefraction' },
    routeSpecs: [
      { key: 'kick-spread', source: 'kick', target: 'echoSpread', amount: 0.08, mode: 'trigger', releaseMs: 260, fallbackSources: ['bass'] },
      { key: 'snare-refraction', source: 'snare', target: 'logoRefraction', amount: 0.105, mode: 'trigger', holdMs: 25, releaseMs: 340, fallbackSources: ['transient'] },
      { key: 'hat-scan', source: 'hat', target: 'waveAmount', amount: 0.035, attackMs: 18, releaseMs: 150, conditions: { excludeSectionTypes: ['breakdown', 'outro'] } },
      { key: 'energy-repetition', source: 'energy', target: 'ribbonCount', amount: 0.09, attackMs: 180, releaseMs: 650 },
      { key: 'vocal-logo', source: 'vocalEnergy', target: 'logoRefraction', amount: 0.065, attackMs: 120, releaseMs: 520, fallbackSources: ['lyricActivity', 'mid'], minimumConfidence: 0.25 },
      { key: 'phrase-echo', source: 'phrase8Hit', target: 'echoSpread', amount: 0.09, mode: 'trigger', holdMs: 90, releaseMs: 760 },
      { key: 'drop-interrupt', source: 'dropImpact', target: 'waveAmount', amount: 0.16, mode: 'trigger', releaseMs: 460, conditions: { sectionTypes: ['drop'] } },
    ],
  }),
  buildProgram({
    shaderId: 'shader-reactor',
    name: 'Reactor',
    description: 'Directs charge, contraction, shockwave impact, feedback persistence, module balance, and later-drop overdrive.',
    visualIdentity: 'multi-module energy core with semantic, shrapnel, and brand architecture',
    targets: { motion: 'rotationSpeed', bass: 'coreSize', impact: 'shockwaveIntensity', accent: 'overallGlow', build: 'buildContraction', recruit: 'overallMix', evolution: 'dropForce', phrase: 'semanticResponse', vocal: 'vocalLyricInfluence' },
    introMotion: -0.06,
    dropImpact: 0.15,
    dropTwoDelta: 0.075,
    routeSpecs: [
      { key: 'kick-core', source: 'kick', target: 'coreSize', amount: 0.075, mode: 'trigger', holdMs: 30, releaseMs: 190, fallbackSources: ['bass'] },
      { key: 'snare-shockwave', source: 'snare', target: 'shockwaveIntensity', amount: 0.13, mode: 'trigger', holdMs: 18, releaseMs: 390, fallbackSources: ['transient'] },
      { key: 'bass-charge', source: 'bassStemEnergy', target: 'coreIntensity', amount: 0.075, attackMs: 45, releaseMs: 260, fallbackSources: ['bass', 'sub'] },
      { key: 'energy-bloom', source: 'energy', target: 'overallGlow', amount: 0.08, attackMs: 100, releaseMs: 420 },
      { key: 'build-contraction', source: 'buildProgress', target: 'buildContraction', amount: -0.17, attackMs: 180, releaseMs: 520, fallbackSources: ['tension'], conditions: { sectionTypes: ['build', 'preDrop'] } },
      { key: 'phrase-semantic', source: 'phrase16Hit', target: 'semanticResponse', amount: 0.10, mode: 'trigger', holdMs: 100, releaseMs: 820 },
      { key: 'vocal-fill', source: 'vocalEnergy', target: 'vocalLyricInfluence', amount: 0.075, attackMs: 120, releaseMs: 520, fallbackSources: ['lyricActivity', 'mid'] },
      { key: 'drop-force', source: 'dropImpact', target: 'dropForce', amount: 0.19, mode: 'trigger', holdMs: 45, releaseMs: 620, conditions: { sectionTypes: ['drop'] } },
    ],
  }),
  buildProgram({
    shaderId: 'shader-bass-cathedral',
    name: 'Bass Cathedral',
    description: 'Directs architectural depth, rib expansion, light shafts, rupture, sparks, and drop-scale progression.',
    visualIdentity: 'monumental bass architecture with restrained atmosphere and physical expansion',
    targets: { motion: 'depthSpeed', bass: 'archDensity', impact: 'rupture', accent: 'sparkDensity', build: 'ribThickness', recruit: 'sparkDensity', evolution: 'archDensity', phrase: 'ribThickness' },
    introMotion: -0.12,
    dropImpact: 0.17,
    routeSpecs: [
      { key: 'kick-arches', source: 'kick', target: 'archDensity', amount: 0.055, mode: 'trigger', releaseMs: 260, fallbackSources: ['bass'] },
      { key: 'snare-sparks', source: 'snare', target: 'sparkDensity', amount: 0.12, mode: 'trigger', releaseMs: 360, fallbackSources: ['high'] },
      { key: 'sub-ribs', source: 'sub', target: 'ribThickness', amount: 0.06, attackMs: 45, releaseMs: 310, fallbackSources: ['bass'] },
      { key: 'energy-depth', source: 'trackEnergy', target: 'depthSpeed', amount: 0.065, attackMs: 180, releaseMs: 620, fallbackSources: ['energy'] },
      { key: 'build-vault', source: 'buildProgress', target: 'archDensity', amount: 0.10, attackMs: 220, releaseMs: 520, conditions: { sectionTypes: ['build', 'preDrop'] } },
      { key: 'phrase-light-shaft', source: 'phrase8Hit', target: 'sparkDensity', amount: 0.08, mode: 'trigger', holdMs: 80, releaseMs: 760 },
      { key: 'drop-rupture', source: 'dropImpact', target: 'rupture', amount: 0.21, mode: 'trigger', holdMs: 55, releaseMs: 680, conditions: { sectionTypes: ['drop'] } },
    ],
  }),
  buildProgram({
    shaderId: 'shader-laser-lattice-overdrive',
    name: 'Laser Lattice Overdrive',
    description: 'Directs lattice density, scan rotation, blade intersections, depth, and quantized overdrive impacts.',
    visualIdentity: 'precise laser lattice that recruits geometry in musical blocks',
    targets: { motion: 'rotation', bass: 'depth', impact: 'scatter', accent: 'bladeWidth', build: 'gridDensity', recruit: 'gridDensity', evolution: 'rotation', phrase: 'depth' },
    verseMotion: 0.025,
    dropImpact: 0.18,
    routeSpecs: [
      { key: 'kick-depth', source: 'kick', target: 'depth', amount: 0.085, mode: 'trigger', releaseMs: 230, fallbackSources: ['bass'] },
      { key: 'snare-blade', source: 'snare', target: 'bladeWidth', amount: 0.12, mode: 'trigger', holdMs: 20, releaseMs: 300, fallbackSources: ['transient'] },
      { key: 'hat-scan', source: 'hat', target: 'rotation', amount: 0.025, attackMs: 14, releaseMs: 130, conditions: { sectionTypes: ['verse', 'build', 'drop'] } },
      { key: 'energy-density', source: 'energy', target: 'gridDensity', amount: 0.075, attackMs: 130, releaseMs: 520 },
      { key: 'build-overdrive', source: 'buildProgress', target: 'rotation', amount: 0.09, attackMs: 170, releaseMs: 430, conditions: { sectionTypes: ['build', 'preDrop'] } },
      { key: 'phrase-depth-step', source: 'phrase4Hit', target: 'depth', amount: 0.055, mode: 'trigger', holdMs: 50, releaseMs: 560 },
      { key: 'drop-scatter', source: 'dropImpact', target: 'scatter', amount: 0.23, mode: 'trigger', holdMs: 30, releaseMs: 540, conditions: { sectionTypes: ['drop'] } },
    ],
  }),
  buildProgram({
    shaderId: 'shader-wobble-glyph-forge',
    name: 'Wobble Glyph Forge',
    description: 'Directs glyph deformation, symmetry cadence, ornament recruitment, bass displacement, and brand-core focus.',
    visualIdentity: 'forged glyph body with cadence-aware wobble and controlled fragmentation',
    targets: { motion: 'wobble', bass: 'bodyScale', impact: 'wobble', accent: 'detail', build: 'symmetry', recruit: 'detail', evolution: 'symmetry', phrase: 'logoBlend', vocal: 'logoBlend' },
    routeSpecs: [
      { key: 'kick-body', source: 'kick', target: 'bodyScale', amount: 0.075, mode: 'trigger', releaseMs: 250, fallbackSources: ['bass'] },
      { key: 'snare-detail', source: 'snare', target: 'detail', amount: 0.11, mode: 'trigger', releaseMs: 340, fallbackSources: ['high'] },
      { key: 'bass-wobble', source: 'bass', target: 'wobble', amount: 0.085, attackMs: 35, releaseMs: 250, fallbackSources: ['sub'] },
      { key: 'energy-symmetry', source: 'complexity', target: 'symmetry', amount: 0.07, attackMs: 190, releaseMs: 700, fallbackSources: ['energy'] },
      { key: 'build-fragment', source: 'buildProgress', target: 'detail', amount: 0.10, attackMs: 200, releaseMs: 480, conditions: { sectionTypes: ['build', 'preDrop'] } },
      { key: 'vocal-brand-core', source: 'vocalEnergy', target: 'logoBlend', amount: 0.075, attackMs: 110, releaseMs: 470, fallbackSources: ['lyricActivity', 'mid'] },
      { key: 'drop-displacement', source: 'dropImpact', target: 'bodyScale', amount: 0.15, mode: 'trigger', holdMs: 35, releaseMs: 480, conditions: { sectionTypes: ['drop'] } },
    ],
  }),
  buildProgram({
    shaderId: 'shader-melodic-rift-bloom',
    name: 'Melodic Rift Bloom',
    description: 'Directs rift opening, petal recruitment, harmonic color movement, aurora phrasing, and ember release.',
    visualIdentity: 'melodic dimensional bloom shaped by phrases and harmonic contour',
    targets: { motion: 'auroraFlow', bass: 'riftWidth', impact: 'bloomSpread', accent: 'emberDensity', build: 'riftWidth', recruit: 'petalCount', evolution: 'bloomSpread', phrase: 'auroraFlow', vocal: 'riftWidth' },
    introMotion: -0.075,
    breakdownMotion: -0.035,
    routeSpecs: [
      { key: 'kick-rift', source: 'kick', target: 'riftWidth', amount: 0.055, mode: 'trigger', releaseMs: 280, fallbackSources: ['bass'] },
      { key: 'snare-embers', source: 'snare', target: 'emberDensity', amount: 0.095, mode: 'trigger', releaseMs: 420, fallbackSources: ['high'] },
      { key: 'melody-bloom', source: 'melodyHeight', target: 'bloomSpread', amount: 0.07, attackMs: 150, releaseMs: 520, fallbackSources: ['instrumentEnergy', 'mid'], minimumConfidence: 0.28 },
      { key: 'phrase-aurora', source: 'phrase16', target: 'auroraFlow', amount: 0.055, mode: 'phase', curve: 'easeInOut' },
      { key: 'build-opening', source: 'buildProgress', target: 'riftWidth', amount: 0.11, attackMs: 230, releaseMs: 540, conditions: { sectionTypes: ['build', 'preDrop'] } },
      { key: 'vocal-rift', source: 'vocalEnergy', target: 'riftWidth', amount: 0.045, attackMs: 130, releaseMs: 560, fallbackSources: ['lyricActivity', 'mid'] },
      { key: 'drop-bloom', source: 'dropImpact', target: 'bloomSpread', amount: 0.17, mode: 'trigger', holdMs: 60, releaseMs: 720, conditions: { sectionTypes: ['drop'] } },
    ],
  }),
]

const PROGRAM_BY_SHADER_ID = new Map(PROGRAMS.map(program => [program.id.split(':native-show-director')[0], program]))

export function getShaderPerformanceProgram(shaderId: string): ShaderPerformanceProgram | undefined {
  return PROGRAM_BY_SHADER_ID.get(shaderId)
}

export function getAllShaderPerformancePrograms(): readonly ShaderPerformanceProgram[] {
  return PROGRAMS
}
