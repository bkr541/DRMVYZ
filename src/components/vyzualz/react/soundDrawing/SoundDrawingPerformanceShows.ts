import type { ReactSectionType } from '../ReactTypes'
import type { SharedPerformanceProgramScene } from '../../../../features/performanceCore'
import type {
  SoundDrawingEventBinding,
  SoundDrawingModulationRoute,
  SoundDrawingPerformanceAction,
  SoundDrawingPerformanceEnvelope,
  SoundDrawingPerformanceLayerBlueprint,
  SoundDrawingPerformanceShowDefinition,
} from './SoundDrawingPerformanceTypes'

const FAST: SoundDrawingPerformanceEnvelope = { attack: '1/32beat', hold: '1/32beat', release: '1/4beat', curve: 'easeOut' }
const SNAP: SoundDrawingPerformanceEnvelope = { attack: '1/32beat', hold: '1/16beat', release: '1/2beat', curve: 'overshoot' }
const SHIMMER: SoundDrawingPerformanceEnvelope = { attack: '1/32beat', hold: '1/32beat', release: '1/8beat', curve: 'exponential' }
const DOWNBEAT: SoundDrawingPerformanceEnvelope = { attack: '1/16beat', hold: '1/8beat', release: '1beat', curve: 'easeOut' }

const bassScaleRoute = (id: string, amount = 0.22): SoundDrawingModulationRoute => ({
  id,
  source: 'bass',
  target: 'scale',
  min: 0,
  max: amount,
  amount: 1,
  curve: 'easeOut',
  attack: 0.025,
  release: 0.12,
  clamp: [0.45, 1.8],
  lockKey: 'reaction',
})

const energyGlowRoute = (id: string, amount = 0.35): SoundDrawingModulationRoute => ({
  id,
  source: 'trackRelativeEnergy',
  target: 'glow',
  min: 0,
  max: amount,
  amount: 1,
  curve: 'easeIn',
  attack: 0.08,
  release: 0.3,
  clamp: [0, 1],
  lockKey: 'reaction',
})

const buildRotationRoute: SoundDrawingModulationRoute = {
  id: 'build-rotation',
  source: 'buildProgress',
  target: 'rotation',
  min: 0,
  max: 42,
  amount: 1,
  curve: 'easeIn',
  minConfidence: 0.25,
  clamp: [-180, 180],
  lockKey: 'transform',
}

const vocalOpacityRoute: SoundDrawingModulationRoute = {
  id: 'vocal-opacity',
  source: 'vocalEnergy',
  target: 'opacity',
  min: 0,
  max: 0.24,
  amount: 1,
  curve: 'easeOut',
  minConfidence: 0.25,
  clamp: [0.08, 1],
  lockKey: 'reaction',
}

function roleEventBindings(
  prefix: string,
  role: SoundDrawingPerformanceLayerBlueprint['role'],
): SoundDrawingEventBinding[] {
  switch (role) {
    case 'primaryMotif':
      return [
        { id: `${prefix}-kick`, event: 'kick', target: 'scale', amount: 0.14, envelope: FAST, lockKey: 'reaction' },
        { id: `${prefix}-downbeat`, event: 'downbeat', target: 'topologyVariant', amount: 2, envelope: DOWNBEAT, lockKey: 'topology' },
      ]
    case 'harmonicLayer':
      return [{ id: `${prefix}-beat`, event: 'beat', target: 'glow', amount: 0.08, envelope: FAST, lockKey: 'reaction' }]
    case 'rhythmAccent':
      return [
        { id: `${prefix}-kick`, event: 'kick', target: 'strokeWidth', amount: 0.22, envelope: FAST, lockKey: 'reaction' },
        { id: `${prefix}-snare`, event: 'snare', target: 'rotation', amount: 9, envelope: SNAP, lockKey: 'topology' },
      ]
    case 'echoLayer':
      return [{ id: `${prefix}-downbeat`, event: 'downbeat', target: 'feedbackAmount', amount: 0.12, envelope: DOWNBEAT, lockKey: 'feedback' }]
    case 'atmosphereLayer':
      return [{ id: `${prefix}-hat`, event: 'hat', target: 'jitter', amount: 0.08, envelope: SHIMMER, lockKey: 'reaction' }]
    case 'transitionLayer':
      return [{ id: `${prefix}-snare`, event: 'snare', target: 'traceCount', amount: 1, envelope: SNAP, lockKey: 'topology' }]
  }
}

function layer(
  id: string,
  role: SoundDrawingPerformanceLayerBlueprint['role'],
  generator: SoundDrawingPerformanceLayerBlueprint['generator'],
  patch: Partial<SoundDrawingPerformanceLayerBlueprint> = {},
): SoundDrawingPerformanceLayerBlueprint {
  return {
    id,
    role,
    generator,
    opacity: 0.82,
    strokeWidth: 1,
    traceCount: 1,
    symmetry: 1,
    scale: 1,
    x: 0,
    y: 0,
    rotation: 0,
    phaseOffset: 0,
    trailPersistence: 0.55,
    feedbackAmount: 0.12,
    glow: 0.55,
    colorRole: 'primary',
    topologyVariant: 0,
    audioDisplacement: 0.14,
    jitter: 0.04,
    particleCount: 0,
    blendMode: 'screen',
    modulationRoutes: [bassScaleRoute(`${id}-bass`), energyGlowRoute(`${id}-energy`)],
    eventBindings: roleEventBindings(id, role),
    ...patch,
  }
}

function scene(
  id: string,
  sectionTypes: readonly ReactSectionType[],
  layers: readonly SoundDrawingPerformanceLayerBlueprint[],
  options: Partial<SharedPerformanceProgramScene<SoundDrawingPerformanceAction>> = {},
): SharedPerformanceProgramScene<SoundDrawingPerformanceAction> {
  const sceneGlobal = sectionTypes.includes('preDrop')
    ? { trailPersistence: 0.18, feedbackAmount: 0.02, cameraScale: 0.72, cameraRotation: 0, cameraX: 0, cameraY: 0, backgroundFade: 0.82 }
    : sectionTypes.includes('outro')
      ? { trailPersistence: 0.86, feedbackAmount: 0.03, cameraScale: 0.9, cameraRotation: 0, cameraX: 0, cameraY: 0, backgroundFade: 0.94 }
      : { trailPersistence: 0.55, feedbackAmount: 0.12, cameraScale: 1, cameraRotation: 0, cameraX: 0, cameraY: 0, backgroundFade: 1 }
  return {
    id,
    sectionTypes,
    minConfidence: sectionTypes.includes('unknown') ? undefined : 0.3,
    actions: [{ type: 'scene', layers, global: sceneGlobal }],
    entryActions: [{ type: 'global', patch: { cameraScale: 0.96, backgroundFade: 0.94 }, lockKey: 'camera' }],
    bodyActions: [],
    exitActions: [{ type: 'global', patch: { cameraScale: 0.92, backgroundFade: 0.9 }, lockKey: 'camera' }],
    eventActions: {
      kick: [{ type: 'pulse', role: 'primaryMotif', event: 'kick', target: 'scale', amount: 0.16, envelope: FAST, lockKey: 'reaction' }],
      snare: [{ type: 'pulse', role: 'rhythmAccent', event: 'snare', target: 'rotation', amount: 12, envelope: SNAP, lockKey: 'topology' }],
      hat: [{ type: 'pulse', role: 'atmosphereLayer', event: 'hat', target: 'jitter', amount: 0.09, envelope: SHIMMER, lockKey: 'reaction' }],
      downbeat: [{ type: 'pulse', role: 'primaryMotif', event: 'downbeat', target: 'topologyVariant', amount: 2, envelope: DOWNBEAT, lockKey: 'topology' }],
    },
    fourBarActions: [
      [{ type: 'patchRole', role: 'primaryMotif', patch: { rotation: 0, topologyVariant: 0 }, lockKey: 'topology' }],
      [{ type: 'patchRole', role: 'primaryMotif', patch: { rotation: 12, topologyVariant: 1 }, lockKey: 'topology' }],
      [{ type: 'patchRole', role: 'primaryMotif', patch: { rotation: -12, topologyVariant: 2 }, lockKey: 'topology' }],
      [{ type: 'patchRole', role: 'primaryMotif', patch: { symmetry: 2, topologyVariant: 3 }, lockKey: 'topology' }],
    ],
    eightBarRecruitment: [
      [],
      [{ type: 'patchRole', role: 'harmonicLayer', patch: { enabled: true, opacity: 0.62 }, lockKey: 'layerRecruitment' }],
      [{ type: 'patchRole', role: 'echoLayer', patch: { enabled: true, opacity: 0.48 }, lockKey: 'layerRecruitment' }],
    ],
    sixteenBarEvolution: [
      [],
      [{ type: 'patchRole', role: 'primaryMotif', patch: { traceCount: 4, symmetry: 3, glow: 0.9 }, lockKey: 'topology' }],
      [{ type: 'global', patch: { cameraRotation: 8, cameraScale: 1.05 }, lockKey: 'camera' }],
    ],
    ...options,
  }
}

function radialPressureSystem(): SoundDrawingPerformanceShowDefinition {
  const intro = [
    layer('rps-primary', 'primaryMotif', 'circularBassMembrane', { scale: 0.64, opacity: 0.7, trailPersistence: 0.82, glow: 0.42, colorRole: 'secondary' }),
    layer('rps-atmos', 'atmosphereLayer', 'particleSpline', { enabled: true, opacity: 0.18, scale: 0.88, particleCount: 96, jitter: 0.08, colorRole: 'accent' }),
  ]
  const verse = [
    layer('rps-primary', 'primaryMotif', 'radialOscilloscope', { scale: 0.82, opacity: 0.86, symmetry: 1 }),
    layer('rps-rhythm', 'rhythmAccent', 'circularBassMembrane', { opacity: 0.34, scale: 0.52, colorRole: 'accent', eventBindings: roleEventBindings('rps-rhythm', 'rhythmAccent') }),
    layer('rps-atmos', 'atmosphereLayer', 'particleSpline', { opacity: 0.22, particleCount: 128, jitter: 0.1 }),
  ]
  const build = [
    layer('rps-primary', 'primaryMotif', 'tunnelTrace', { scale: 0.72, traceCount: 2, symmetry: 2, rotation: 10, modulationRoutes: [bassScaleRoute('rps-build-bass', 0.16), buildRotationRoute] }),
    layer('rps-harmonic', 'harmonicLayer', 'polarWaveform', { opacity: 0.46, scale: 0.92, rotation: -12, traceCount: 2 }),
    layer('rps-rhythm', 'rhythmAccent', 'kaleidoscopicTrace', { opacity: 0.36, scale: 0.58, symmetry: 4, colorRole: 'accent' }),
    layer('rps-atmos', 'atmosphereLayer', 'particleSpline', { opacity: 0.28, particleCount: 180, jitter: 0.13 }),
  ]
  const preDrop = [
    layer('rps-primary', 'primaryMotif', 'circularBassMembrane', { scale: 0.34, opacity: 0.88, traceCount: 1, symmetry: 1, trailPersistence: 0.18, colorRole: 'accent' }),
    layer('rps-transition', 'transitionLayer', 'radialOscilloscope', { opacity: 0.18, scale: 0.18, glow: 0.8, feedbackAmount: 0 }),
  ]
  const drop = [
    layer('rps-primary', 'primaryMotif', 'radialOscilloscope', { scale: 1.06, opacity: 1, strokeWidth: 1.35, traceCount: 2, symmetry: 2, glow: 0.9 }),
    layer('rps-rhythm', 'rhythmAccent', 'circularBassMembrane', { opacity: 0.82, scale: 0.62, strokeWidth: 1.5, colorRole: 'accent' }),
    layer('rps-harmonic', 'harmonicLayer', 'tunnelTrace', { enabled: false, opacity: 0.54, scale: 1.18, traceCount: 3, rotation: 14, colorRole: 'secondary' }),
    layer('rps-echo', 'echoLayer', 'polarWaveform', { enabled: false, opacity: 0.42, scale: 1.32, rotation: -18, feedbackAmount: 0.28 }),
    layer('rps-atmos', 'atmosphereLayer', 'particleSpline', { opacity: 0.42, particleCount: 260, jitter: 0.18 }),
  ]
  const breakdown = [
    layer('rps-primary', 'primaryMotif', 'polarWaveform', { scale: 0.76, opacity: 0.68, trailPersistence: 0.86, rotation: 6, modulationRoutes: [vocalOpacityRoute, energyGlowRoute('rps-break-glow', 0.22)] }),
    layer('rps-harmonic', 'harmonicLayer', 'harmonicRibbon', { opacity: 0.3, scale: 0.9, trailPersistence: 0.9, colorRole: 'secondary' }),
  ]
  const outro = [
    layer('rps-primary', 'primaryMotif', 'circularBassMembrane', { scale: 0.54, opacity: 0.46, trailPersistence: 0.92, feedbackAmount: 0.04 }),
  ]
  const unknown = [
    layer('rps-primary', 'primaryMotif', 'radialOscilloscope', { scale: 0.72, opacity: 0.7, traceCount: 1, glow: 0.45 }),
  ]

  return {
    id: 'radialPressureSystem',
    name: 'Radial Pressure System',
    description: 'Concentric bass membranes, pressure rings, tunnel depth, and percussion-separated radial impacts.',
    program: {
      id: 'soundDrawing.radialPressureSystem',
      metadata: { name: 'Radial Pressure System', description: 'Concentric bass membranes and percussion-separated radial impacts.', engine: 'soundDrawing', version: 1, authoringRevision: 'first-class-source-integration' },
      fallbackOrder: ['unknown'],
      fallbackSceneId: 'rps-fallback',
      scenes: [
        scene('rps-intro', ['intro'], intro),
        scene('rps-verse', ['verse'], verse),
        scene('rps-build', ['build'], build, { bodyActions: [{ type: 'global', patch: { cameraScale: 0.9, cameraRotation: 5 }, lockKey: 'camera' }] }),
        scene('rps-pre-drop', ['preDrop'], preDrop, { priority: 5, bodyActions: [{ type: 'global', patch: { cameraScale: 0.72, backgroundFade: 0.82, feedbackAmount: 0.02 }, lockKey: 'camera' }] }),
        scene('rps-drop-2', ['drop'], drop, {
          priority: 10,
          dropOccurrence: { minOccurrence: 2 },
          actions: [{ type: 'scene', layers: drop, global: { trailPersistence: 0.42, feedbackAmount: 0.22, cameraScale: 1.08, cameraRotation: 6, cameraX: 0, cameraY: 0, backgroundFade: 1 } }],
          bodyActions: [
            { type: 'patchRole', role: 'primaryMotif', patch: { symmetry: 4, traceCount: 3, rotation: 18 }, lockKey: 'topology' },
            { type: 'patchRole', role: 'echoLayer', patch: { enabled: true, opacity: 0.58 }, lockKey: 'layerRecruitment' },
          ],
        }),
        scene('rps-drop', ['drop'], drop, { priority: 5 }),
        scene('rps-breakdown', ['breakdown', 'bridge'], breakdown),
        scene('rps-outro', ['outro'], outro),
        scene('rps-fallback', ['unknown'], unknown, { priority: -10 }),
      ],
    },
  }
}

function harmonicRibbonReactor(): SoundDrawingPerformanceShowDefinition {
  const intro = [
    layer('hrr-primary', 'primaryMotif', 'harmonicRibbon', { scale: 0.72, opacity: 0.58, trailPersistence: 0.9, renderMode: 'ribbon', audioDisplacement: 0.08 }),
    layer('hrr-atmos', 'atmosphereLayer', 'stackedWaveformBands', { opacity: 0.16, scale: 0.9, colorRole: 'secondary' }),
  ]
  const verse = [
    layer('hrr-primary', 'primaryMotif', 'horizontalOscilloscope', { opacity: 0.86, strokeWidth: 1.1, scale: 0.9 }),
    layer('hrr-harmonic', 'harmonicLayer', 'harmonicRibbon', { opacity: 0.5, scale: 0.82, y: 0.08, colorRole: 'secondary', renderMode: 'ribbon', modulationRoutes: [vocalOpacityRoute, energyGlowRoute('hrr-verse-glow')] }),
    layer('hrr-atmos', 'atmosphereLayer', 'particleSpline', { opacity: 0.18, particleCount: 112, jitter: 0.08 }),
  ]
  const build = [
    layer('hrr-primary', 'primaryMotif', 'stackedWaveformBands', { opacity: 0.92, traceCount: 3, scale: 0.92, modulationRoutes: [bassScaleRoute('hrr-build-bass', 0.1), buildRotationRoute] }),
    layer('hrr-harmonic', 'harmonicLayer', 'harmonicRibbon', { opacity: 0.68, traceCount: 2, scale: 0.78, rotation: 8, renderMode: 'ribbon' }),
    layer('hrr-rhythm', 'rhythmAccent', 'mirroredOscilloscope', { opacity: 0.4, scale: 0.68, symmetry: 2, colorRole: 'accent' }),
    layer('hrr-atmos', 'atmosphereLayer', 'spectralContour', { opacity: 0.28, traceCount: 2, scale: 1.05 }),
  ]
  const preDrop = [
    layer('hrr-primary', 'primaryMotif', 'horizontalOscilloscope', { opacity: 0.92, scale: 0.58, trailPersistence: 0.12, strokeWidth: 1.6, colorRole: 'accent' }),
    layer('hrr-transition', 'transitionLayer', 'particleSpline', { opacity: 0.12, particleCount: 64, jitter: 0.04 }),
  ]
  const drop = [
    layer('hrr-primary', 'primaryMotif', 'harmonicRibbon', { opacity: 1, scale: 1.02, strokeWidth: 1.45, traceCount: 3, renderMode: 'ribbon', glow: 0.88 }),
    layer('hrr-rhythm', 'rhythmAccent', 'mirroredOscilloscope', { opacity: 0.82, scale: 0.92, symmetry: 2, colorRole: 'accent' }),
    layer('hrr-harmonic', 'harmonicLayer', 'stackedWaveformBands', { enabled: false, opacity: 0.62, scale: 1.08, traceCount: 4, colorRole: 'secondary' }),
    layer('hrr-echo', 'echoLayer', 'spectralContour', { enabled: false, opacity: 0.42, scale: 1.2, feedbackAmount: 0.3 }),
    layer('hrr-atmos', 'atmosphereLayer', 'particleSpline', { opacity: 0.35, particleCount: 220, jitter: 0.16 }),
  ]
  const breakdown = [
    layer('hrr-primary', 'primaryMotif', 'harmonicRibbon', { opacity: 0.66, scale: 0.8, trailPersistence: 0.94, renderMode: 'ribbon', modulationRoutes: [vocalOpacityRoute] }),
    layer('hrr-harmonic', 'harmonicLayer', 'lissajousFigure', { opacity: 0.22, scale: 0.68, colorRole: 'secondary' }),
  ]
  const outro = [layer('hrr-primary', 'primaryMotif', 'horizontalOscilloscope', { opacity: 0.42, scale: 0.66, trailPersistence: 0.94, feedbackAmount: 0.02 })]
  const unknown = [layer('hrr-primary', 'primaryMotif', 'horizontalOscilloscope', { opacity: 0.68, scale: 0.82, traceCount: 1 })]

  return {
    id: 'harmonicRibbonReactor',
    name: 'Harmonic Ribbon Reactor',
    description: 'Layered waveform bands and elastic ribbons that recruit harmonics as phrases accumulate.',
    program: {
      id: 'soundDrawing.harmonicRibbonReactor',
      metadata: { name: 'Harmonic Ribbon Reactor', description: 'Ribbon architecture with phrase-scaled recruitment and clear percussion roles.', engine: 'soundDrawing', version: 1, authoringRevision: 'first-class-source-integration' },
      fallbackOrder: ['unknown'],
      fallbackSceneId: 'hrr-fallback',
      scenes: [
        scene('hrr-intro', ['intro'], intro),
        scene('hrr-verse', ['verse'], verse),
        scene('hrr-build', ['build'], build, { bodyActions: [{ type: 'global', patch: { cameraScale: 0.92, cameraRotation: -3 }, lockKey: 'camera' }] }),
        scene('hrr-pre-drop', ['preDrop'], preDrop, { priority: 5 }),
        scene('hrr-drop-2', ['drop'], drop, {
          priority: 10,
          dropOccurrence: { minOccurrence: 2 },
          bodyActions: [
            { type: 'patchRole', role: 'primaryMotif', patch: { traceCount: 5, symmetry: 2, rotation: -10 }, lockKey: 'topology' },
            { type: 'patchRole', role: 'echoLayer', patch: { enabled: true, opacity: 0.54, scale: 1.28 }, lockKey: 'layerRecruitment' },
            { type: 'global', patch: { cameraScale: 1.06, cameraRotation: -5 }, lockKey: 'camera' },
          ],
        }),
        scene('hrr-drop', ['drop'], drop, { priority: 5 }),
        scene('hrr-breakdown', ['breakdown', 'bridge'], breakdown),
        scene('hrr-outro', ['outro'], outro),
        scene('hrr-fallback', ['unknown'], unknown, { priority: -10 }),
      ],
    },
  }
}

function phaseKnotCathedral(): SoundDrawingPerformanceShowDefinition {
  const intro = [
    layer('pkc-primary', 'primaryMotif', 'phaseScopeKnot', { opacity: 0.58, scale: 0.58, trailPersistence: 0.92, rotation: 6, symmetry: 2 }),
    layer('pkc-atmos', 'atmosphereLayer', 'vectorFieldStreamlines', { opacity: 0.15, scale: 0.86, traceCount: 2, colorRole: 'secondary' }),
  ]
  const verse = [
    layer('pkc-primary', 'primaryMotif', 'lissajousFigure', { opacity: 0.86, scale: 0.78, symmetry: 2 }),
    layer('pkc-harmonic', 'harmonicLayer', 'phaseScopeKnot', { opacity: 0.38, scale: 0.54, rotation: -18, colorRole: 'secondary' }),
    layer('pkc-atmos', 'atmosphereLayer', 'vectorFieldStreamlines', { opacity: 0.2, scale: 1.02, traceCount: 2 }),
  ]
  const build = [
    layer('pkc-primary', 'primaryMotif', 'audioReactiveAttractor', { opacity: 0.9, scale: 0.72, symmetry: 3, rotation: 10, modulationRoutes: [bassScaleRoute('pkc-build-bass', 0.12), buildRotationRoute] }),
    layer('pkc-harmonic', 'harmonicLayer', 'phaseScopeKnot', { opacity: 0.52, scale: 0.58, traceCount: 2, rotation: -22 }),
    layer('pkc-rhythm', 'rhythmAccent', 'kaleidoscopicTrace', { opacity: 0.36, scale: 0.48, symmetry: 4, colorRole: 'accent' }),
    layer('pkc-atmos', 'atmosphereLayer', 'vectorFieldStreamlines', { opacity: 0.28, scale: 1.14, traceCount: 3 }),
  ]
  const preDrop = [
    layer('pkc-primary', 'primaryMotif', 'phaseScopeKnot', { opacity: 0.94, scale: 0.28, symmetry: 1, trailPersistence: 0.16, colorRole: 'accent' }),
    layer('pkc-transition', 'transitionLayer', 'kaleidoscopicTrace', { opacity: 0.16, scale: 0.2, symmetry: 2, glow: 0.92 }),
  ]
  const drop = [
    layer('pkc-primary', 'primaryMotif', 'phaseScopeKnot', { opacity: 1, scale: 0.94, symmetry: 4, traceCount: 3, strokeWidth: 1.35, glow: 0.94 }),
    layer('pkc-rhythm', 'rhythmAccent', 'kaleidoscopicTrace', { opacity: 0.82, scale: 0.62, symmetry: 6, colorRole: 'accent' }),
    layer('pkc-harmonic', 'harmonicLayer', 'audioReactiveAttractor', { enabled: false, opacity: 0.58, scale: 1.08, traceCount: 2, rotation: -16, colorRole: 'secondary' }),
    layer('pkc-echo', 'echoLayer', 'tunnelTrace', { enabled: false, opacity: 0.4, scale: 1.26, traceCount: 3, feedbackAmount: 0.3 }),
    layer('pkc-atmos', 'atmosphereLayer', 'vectorFieldStreamlines', { opacity: 0.36, scale: 1.18, traceCount: 4, jitter: 0.12 }),
  ]
  const breakdown = [
    layer('pkc-primary', 'primaryMotif', 'lissajousFigure', { opacity: 0.62, scale: 0.68, trailPersistence: 0.94, modulationRoutes: [vocalOpacityRoute, energyGlowRoute('pkc-break-glow', 0.18)] }),
    layer('pkc-harmonic', 'harmonicLayer', 'phaseScopeKnot', { opacity: 0.26, scale: 0.46, rotation: 24, colorRole: 'secondary' }),
  ]
  const outro = [layer('pkc-primary', 'primaryMotif', 'phaseScopeKnot', { opacity: 0.4, scale: 0.44, symmetry: 2, trailPersistence: 0.95, feedbackAmount: 0.02 })]
  const unknown = [layer('pkc-primary', 'primaryMotif', 'lissajousFigure', { opacity: 0.66, scale: 0.68, symmetry: 2 })]

  return {
    id: 'phaseKnotCathedral',
    name: 'Phase-Knot Cathedral',
    description: 'Architectural Lissajous knots, kaleidoscopic cuts, and evolving attractor vaults.',
    program: {
      id: 'soundDrawing.phaseKnotCathedral',
      metadata: { name: 'Phase-Knot Cathedral', description: 'Architectural phase knots with deterministic long-form evolution.', engine: 'soundDrawing', version: 1, authoringRevision: 'first-class-source-integration' },
      fallbackOrder: ['unknown'],
      fallbackSceneId: 'pkc-fallback',
      scenes: [
        scene('pkc-intro', ['intro'], intro),
        scene('pkc-verse', ['verse'], verse),
        scene('pkc-build', ['build'], build, { bodyActions: [{ type: 'global', patch: { cameraScale: 0.88, cameraRotation: 7 }, lockKey: 'camera' }] }),
        scene('pkc-pre-drop', ['preDrop'], preDrop, { priority: 5 }),
        scene('pkc-drop-2', ['drop'], drop, {
          priority: 10,
          dropOccurrence: { minOccurrence: 2 },
          bodyActions: [
            { type: 'patchRole', role: 'primaryMotif', patch: { symmetry: 6, traceCount: 4, rotation: 22, topologyVariant: 3 }, lockKey: 'topology' },
            { type: 'patchRole', role: 'echoLayer', patch: { enabled: true, opacity: 0.56 }, lockKey: 'layerRecruitment' },
            { type: 'global', patch: { cameraScale: 1.08, cameraRotation: 9 }, lockKey: 'camera' },
          ],
        }),
        scene('pkc-drop', ['drop'], drop, { priority: 5 }),
        scene('pkc-breakdown', ['breakdown', 'bridge'], breakdown),
        scene('pkc-outro', ['outro'], outro),
        scene('pkc-fallback', ['unknown'], unknown, { priority: -10 }),
      ],
    },
  }
}


function livingRibbonSystem(): SoundDrawingPerformanceShowDefinition {
  const intro = [
    layer('lrs-primary', 'primaryMotif', 'livingRibbon', {
      opacity: 0.58,
      scale: 0.7,
      strokeWidth: 0.82,
      trailPersistence: 0.82,
      glow: 0.5,
      audioDisplacement: 0.08,
      jitter: 0.025,
      colorRole: 'primary',
    }),
    layer('lrs-atmos', 'atmosphereLayer', 'spectralContour', {
      opacity: 0.12,
      scale: 0.92,
      traceCount: 1,
      colorRole: 'secondary',
    }),
  ]
  const verse = [
    layer('lrs-primary', 'primaryMotif', 'livingRibbon', {
      opacity: 0.76,
      scale: 0.82,
      strokeWidth: 0.95,
      trailPersistence: 0.72,
      glow: 0.58,
      audioDisplacement: 0.12,
      jitter: 0.035,
    }),
    layer('lrs-harmonic', 'harmonicLayer', 'harmonicRibbon', {
      opacity: 0.2,
      scale: 0.92,
      traceCount: 1,
      colorRole: 'secondary',
      trailPersistence: 0.78,
    }),
  ]
  const build = [
    layer('lrs-primary', 'primaryMotif', 'livingRibbon', {
      opacity: 0.88,
      scale: 0.9,
      strokeWidth: 1.04,
      trailPersistence: 0.58,
      glow: 0.7,
      audioDisplacement: 0.16,
      jitter: 0.055,
      rotation: 8,
      modulationRoutes: [bassScaleRoute('lrs-build-bass', 0.14), buildRotationRoute, energyGlowRoute('lrs-build-glow', 0.22)],
    }),
    layer('lrs-harmonic', 'harmonicLayer', 'harmonicRibbon', {
      opacity: 0.28,
      scale: 1.02,
      traceCount: 2,
      colorRole: 'secondary',
    }),
    layer('lrs-rhythm', 'rhythmAccent', 'radialOscilloscope', {
      opacity: 0.18,
      scale: 0.5,
      colorRole: 'accent',
    }),
  ]
  const preDrop = [
    layer('lrs-primary', 'primaryMotif', 'livingRibbon', {
      opacity: 0.92,
      scale: 0.48,
      strokeWidth: 1.08,
      trailPersistence: 0.2,
      glow: 0.72,
      audioDisplacement: 0.08,
      jitter: 0.02,
      colorRole: 'accent',
    }),
  ]
  const drop = [
    layer('lrs-primary', 'primaryMotif', 'livingRibbon', {
      opacity: 1,
      scale: 1,
      strokeWidth: 1.28,
      trailPersistence: 0.62,
      glow: 0.94,
      audioDisplacement: 0.2,
      jitter: 0.075,
      topologyVariant: 2,
    }),
    layer('lrs-harmonic', 'harmonicLayer', 'harmonicRibbon', {
      opacity: 0.34,
      scale: 1.08,
      traceCount: 2,
      colorRole: 'secondary',
    }),
    layer('lrs-rhythm', 'rhythmAccent', 'circularBassMembrane', {
      opacity: 0.28,
      scale: 0.62,
      colorRole: 'accent',
    }),
    layer('lrs-echo', 'echoLayer', 'spectralContour', {
      enabled: false,
      opacity: 0.22,
      scale: 1.18,
      traceCount: 2,
      feedbackAmount: 0.18,
      colorRole: 'secondary',
    }),
  ]
  const breakdown = [
    layer('lrs-primary', 'primaryMotif', 'livingRibbon', {
      opacity: 0.64,
      scale: 0.76,
      strokeWidth: 0.86,
      trailPersistence: 0.9,
      glow: 0.48,
      audioDisplacement: 0.08,
      jitter: 0.02,
      modulationRoutes: [vocalOpacityRoute, energyGlowRoute('lrs-break-glow', 0.16)],
    }),
    layer('lrs-harmonic', 'harmonicLayer', 'harmonicRibbon', {
      opacity: 0.18,
      scale: 0.9,
      colorRole: 'secondary',
    }),
  ]
  const outro = [
    layer('lrs-primary', 'primaryMotif', 'livingRibbon', {
      opacity: 0.42,
      scale: 0.62,
      strokeWidth: 0.74,
      trailPersistence: 0.94,
      glow: 0.38,
      audioDisplacement: 0.05,
      jitter: 0.015,
    }),
  ]
  const fallback = [
    layer('lrs-fallback-primary', 'primaryMotif', 'harmonicRibbon', {
      opacity: 0.64,
      scale: 0.78,
      strokeWidth: 0.9,
      traceCount: 1,
      trailPersistence: 0.72,
      glow: 0.48,
      audioDisplacement: 0.1,
      jitter: 0.02,
    }),
  ]

  return {
    id: 'livingRibbonSystem',
    name: 'Living Ribbon System',
    description: 'A momentum-preserving organic ribbon with restrained harmonic support and safe scope fallback.',
    program: {
      id: 'soundDrawing.livingRibbonSystem',
      metadata: {
        name: 'Living Ribbon System',
        description: 'Renderer-owned Living Ribbon physics with conservative authored section development.',
        engine: 'soundDrawing',
        version: 1,
        authoringRevision: 'living-ribbon-rendering-integration',
      },
      fallbackOrder: ['unknown'],
      fallbackSceneId: 'lrs-fallback',
      scenes: [
        scene('lrs-intro', ['intro'], intro),
        scene('lrs-verse', ['verse'], verse),
        scene('lrs-build', ['build'], build),
        scene('lrs-pre-drop', ['preDrop'], preDrop, { priority: 6 }),
        scene('lrs-drop-2', ['drop'], drop, {
          priority: 10,
          dropOccurrence: { minOccurrence: 2 },
          bodyActions: [
            { type: 'patchRole', role: 'primaryMotif', patch: { strokeWidth: 1.42, topologyVariant: 3, rotation: 12 }, lockKey: 'topology' },
            { type: 'patchRole', role: 'echoLayer', patch: { enabled: true, opacity: 0.28 }, lockKey: 'layerRecruitment' },
          ],
        }),
        scene('lrs-drop', ['drop'], drop, { priority: 5 }),
        scene('lrs-breakdown', ['breakdown', 'bridge'], breakdown),
        scene('lrs-outro', ['outro'], outro),
        scene('lrs-fallback', ['unknown'], fallback, { priority: -10 }),
      ],
    },
  }
}

export const SOUND_DRAWING_PERFORMANCE_SHOWS: readonly SoundDrawingPerformanceShowDefinition[] = [
  radialPressureSystem(),
  harmonicRibbonReactor(),
  phaseKnotCathedral(),
  livingRibbonSystem(),
]

export const SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID = Object.fromEntries(
  SOUND_DRAWING_PERFORMANCE_SHOWS.map(show => [show.id, show]),
) as Record<SoundDrawingPerformanceShowDefinition['id'], SoundDrawingPerformanceShowDefinition>
