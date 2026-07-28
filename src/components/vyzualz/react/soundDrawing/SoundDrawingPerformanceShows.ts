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
const RIBBON_DOWNBEAT: SoundDrawingPerformanceEnvelope = { attack: '1/32beat', hold: '1/8beat', release: '1beat', curve: 'easeOut' }

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
    // Additive, not 'screen'. Reference oscilloscope footage shows the beam core
    // desaturating toward white while the halo keeps its base hue — that is the
    // signature of additive accumulation. 'screen' (1-(1-a)(1-b)) saturates toward
    // white but cannot accumulate density past 1.0, so overlapping strokes stop
    // getting brighter and the core/halo separation collapses. Individual layers
    // can still override this via their own blendMode in the `patch` spread below.
    blendMode: 'lighter',
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


const LIVING_RIBBON_ROUTES: readonly SoundDrawingModulationRoute[] = [
  {
    id: 'ribbon-bass-width',
    source: 'bass',
    target: 'ribbonWidth',
    min: 0,
    max: 0.2,
    amount: 1,
    curve: 'easeOut',
    attack: 0.04,
    release: 0.2,
    clamp: [0.15, 1],
    lockKey: 'ribbonWidth',
  },
  {
    id: 'ribbon-bass-drive',
    source: 'bass',
    target: 'ribbonDrive',
    min: 0,
    max: 0.14,
    amount: 1,
    curve: 'easeOut',
    attack: 0.03,
    release: 0.16,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-bass-pressure',
    source: 'bass',
    target: 'ribbonRadialPressure',
    min: -0.03,
    max: 0.16,
    amount: 1,
    curve: 'easeOut',
    attack: 0.04,
    release: 0.18,
    clamp: [-1, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-relative-spread',
    source: 'trackRelativeEnergy',
    target: 'ribbonSpread',
    min: -0.05,
    max: 0.22,
    amount: 1,
    curve: 'easeIn',
    attack: 0.16,
    release: 0.42,
    capability: 'trackEnergyCurve',
    clamp: [0.08, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-energy-spread-fallback',
    source: 'energy',
    target: 'ribbonSpread',
    min: -0.03,
    max: 0.16,
    amount: 1,
    curve: 'easeIn',
    attack: 0.18,
    release: 0.45,
    sectionFilter: ['unknown'],
    clamp: [0.08, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-relative-drive',
    source: 'trackRelativeEnergy',
    target: 'ribbonDrive',
    min: 0,
    max: 0.2,
    amount: 1,
    curve: 'easeOut',
    attack: 0.12,
    release: 0.34,
    capability: 'trackEnergyCurve',
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-energy-drive-fallback',
    source: 'energy',
    target: 'ribbonDrive',
    min: 0,
    max: 0.14,
    amount: 1,
    curve: 'easeOut',
    attack: 0.12,
    release: 0.34,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-energy-glow',
    source: 'trackRelativeEnergy',
    target: 'glow',
    min: 0,
    max: 0.22,
    amount: 1,
    curve: 'easeIn',
    attack: 0.12,
    release: 0.38,
    clamp: [0, 1],
    lockKey: 'ribbonGlow',
  },
  {
    id: 'ribbon-mid-bend',
    source: 'mid',
    target: 'ribbonTwist',
    min: -0.02,
    max: 0.16,
    amount: 1,
    curve: 'easeOut',
    attack: 0.1,
    release: 0.28,
    clamp: [-1, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-high-detail',
    source: 'high',
    target: 'ribbonTurbulence',
    min: 0,
    max: 0.14,
    amount: 1,
    curve: 'easeOut',
    attack: 0.05,
    release: 0.2,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-flux-change',
    source: 'spectralFlux',
    target: 'ribbonDirectionalDrift',
    min: -0.04,
    max: 0.16,
    amount: 1,
    curve: 'easeOut',
    attack: 0.04,
    release: 0.24,
    clamp: [-1, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-flux-instability',
    source: 'spectralFlux',
    target: 'ribbonTurbulence',
    min: 0,
    max: 0.08,
    amount: 1,
    curve: 'easeOut',
    attack: 0.04,
    release: 0.24,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-tension-spring',
    source: 'tension',
    target: 'ribbonTension',
    min: 0,
    max: 0.2,
    amount: 1,
    curve: 'easeIn',
    attack: 0.18,
    release: 0.5,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-tension-compression',
    source: 'tension',
    target: 'ribbonCollapse',
    min: 0,
    max: 0.18,
    amount: 1,
    curve: 'easeIn',
    attack: 0.18,
    release: 0.5,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-build-focus',
    source: 'buildProgress',
    target: 'ribbonCenterAttraction',
    min: 0,
    max: 0.28,
    amount: 1,
    curve: 'easeIn',
    attack: 0.12,
    release: 0.42,
    confidenceKey: 'section',
    minConfidence: 0.25,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-build-charge',
    source: 'buildProgress',
    target: 'ribbonCollapse',
    min: 0,
    max: 0.3,
    amount: 1,
    curve: 'easeIn',
    attack: 0.12,
    release: 0.42,
    confidenceKey: 'section',
    minConfidence: 0.25,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-complexity-detail',
    source: 'complexity',
    target: 'particleCount',
    min: 0,
    max: 54,
    amount: 1,
    curve: 'easeIn',
    attack: 0.22,
    release: 0.5,
    clamp: [0, 96],
    lockKey: 'ribbonGlow',
  },
  {
    id: 'ribbon-vocal-center',
    source: 'vocalEnergy',
    target: 'ribbonCenterAttraction',
    min: 0,
    max: 0.3,
    amount: 1,
    curve: 'easeOut',
    attack: 0.12,
    release: 0.38,
    capabilityAny: ['stemCurves', 'lyrics'],
    minConfidence: 0.3,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-vocal-calm',
    source: 'vocalEnergy',
    target: 'ribbonTurbulence',
    min: 0,
    max: -0.22,
    amount: 1,
    curve: 'easeOut',
    attack: 0.12,
    release: 0.38,
    capabilityAny: ['stemCurves', 'lyrics'],
    minConfidence: 0.3,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-vocal-smoothing',
    source: 'vocalEnergy',
    target: 'ribbonDamping',
    min: 0,
    max: 0.16,
    amount: 1,
    curve: 'easeOut',
    attack: 0.12,
    release: 0.38,
    capabilityAny: ['stemCurves', 'lyrics'],
    minConfidence: 0.3,
    clamp: [0, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-phrase-drift',
    source: 'phraseProgress',
    target: 'ribbonDirectionalDrift',
    min: -0.08,
    max: 0.14,
    amount: 1,
    curve: 'easeInOut',
    attack: 0.28,
    release: 0.42,
    confidenceKey: 'phrase',
    minConfidence: 0.25,
    clamp: [-1, 1],
    lockKey: 'ribbonMovement',
  },
  {
    id: 'ribbon-phrase-twist',
    source: 'phraseProgress',
    target: 'ribbonTwist',
    min: -0.06,
    max: 0.12,
    amount: 1,
    curve: 'easeInOut',
    attack: 0.28,
    release: 0.42,
    confidenceKey: 'phrase',
    minConfidence: 0.25,
    clamp: [-1, 1],
    lockKey: 'ribbonMovement',
  },
]

const LIVING_RIBBON_EVENTS: readonly SoundDrawingEventBinding[] = [
  {
    id: 'ribbon-kick-impact',
    event: 'kick',
    target: 'ribbonRadialImpact',
    amount: 0.76,
    envelope: FAST,
    capability: 'rhythmEvents',
    minConfidence: 0.2,
    confidenceKey: 'rhythm',
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-kick-local',
    event: 'kick',
    target: 'ribbonLocalizedImpulse',
    amount: 0.28,
    envelope: FAST,
    location: 0.5,
    radius: 0.24,
    direction: [0.15, 0.7, 0.2],
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-snare-shock',
    event: 'snare',
    target: 'ribbonLateralShock',
    amount: 0.72,
    envelope: SNAP,
    direction: [1, 0.32, 0.18],
    alternateDirection: true,
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-snare-twist',
    event: 'snare',
    target: 'ribbonTwistImpulse',
    amount: 0.26,
    envelope: FAST,
    direction: [1, 0, 0],
    alternateDirection: true,
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-hat-ripple',
    event: 'hat',
    target: 'ribbonFineRipple',
    amount: 0.22,
    envelope: SHIMMER,
    direction: [0.2, 0.74, 1],
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-downbeat-impact',
    event: 'downbeat',
    target: 'ribbonRadialImpact',
    amount: 1.12,
    envelope: RIBBON_DOWNBEAT,
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-downbeat-twist',
    event: 'downbeat',
    target: 'ribbonTwistImpulse',
    amount: 0.34,
    envelope: FAST,
    direction: [1, 0, 0],
    alternateDirection: true,
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-four-bar-motif',
    event: 'fourBarBoundary',
    target: 'ribbonTwistImpulse',
    amount: 0.18,
    envelope: FAST,
    direction: [1, 0, 0],
    alternateDirection: true,
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-eight-bar-detail',
    event: 'eightBarBoundary',
    target: 'ribbonFineRipple',
    amount: 0.3,
    envelope: FAST,
    direction: [0.45, 0.35, 1],
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-sixteen-bar-evolution',
    event: 'sixteenBarBoundary',
    target: 'ribbonReleaseBurst',
    amount: 0.42,
    envelope: DOWNBEAT,
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-drop-release',
    event: 'dropImpact',
    target: 'ribbonReleaseBurst',
    amount: 1.08,
    envelope: DOWNBEAT,
    sectionFilter: ['drop'],
    minConfidence: 0.3,
    confidenceKey: 'section',
    lockKey: 'ribbonReaction',
  },
  {
    id: 'ribbon-section-exit',
    event: 'sectionExit',
    target: 'ribbonCollapseImpulse',
    amount: 0.38,
    envelope: DOWNBEAT,
    lockKey: 'ribbonReaction',
  },
]

function livingRibbonLayer(
  id: string,
  controls: SoundDrawingPerformanceLayerBlueprint['livingRibbonControls'],
  patch: Partial<SoundDrawingPerformanceLayerBlueprint> = {},
): SoundDrawingPerformanceLayerBlueprint {
  return layer(id, 'primaryMotif', 'livingRibbon', {
    opacity: 0.86,
    scale: 1,
    strokeWidth: 1,
    traceCount: 1,
    symmetry: 1,
    trailPersistence: 0.72,
    feedbackAmount: 0.05,
    glow: 0.68,
    particleCount: 18,
    audioDisplacement: 0,
    jitter: 0,
    livingRibbonControls: controls,
    modulationRoutes: LIVING_RIBBON_ROUTES,
    eventBindings: LIVING_RIBBON_EVENTS,
    ...patch,
  })
}

function livingRibbonScene(
  id: string,
  sectionTypes: readonly ReactSectionType[],
  layers: readonly SoundDrawingPerformanceLayerBlueprint[],
  options: Partial<SharedPerformanceProgramScene<SoundDrawingPerformanceAction>> = {},
): SharedPerformanceProgramScene<SoundDrawingPerformanceAction> {
  return scene(id, sectionTypes, layers, {
    eventActions: {},
    fourBarActions: [
      [
        {
          type: 'patchRole',
          role: 'primaryMotif',
          patch: { livingRibbonControls: { directionalDrift: 0.06, twist: 0.04 } },
          lockKey: 'ribbonMovement',
        },
      ],
      [
        {
          type: 'patchRole',
          role: 'primaryMotif',
          patch: { livingRibbonControls: { directionalDrift: 0.12, twist: 0.1 } },
          lockKey: 'ribbonMovement',
        },
      ],
      [
        {
          type: 'patchRole',
          role: 'primaryMotif',
          patch: { livingRibbonControls: { directionalDrift: -0.1, twist: -0.08 } },
          lockKey: 'ribbonMovement',
        },
      ],
      [
        {
          type: 'patchRole',
          role: 'primaryMotif',
          patch: { livingRibbonControls: { directionalDrift: -0.04, twist: 0.14 } },
          lockKey: 'ribbonMovement',
        },
      ],
    ],
    eightBarRecruitment: [
      [],
      [{ type: 'patchRole', role: 'primaryMotif', patch: { particleCount: 34, glow: 0.78 }, lockKey: 'ribbonGlow' }],
      [
        {
          type: 'patchRole',
          role: 'primaryMotif',
          patch: { particleCount: 48, livingRibbonControls: { turbulence: 0.28 } },
          lockKey: 'ribbonMovement',
        },
      ],
    ],
    sixteenBarEvolution: [
      [],
      [
        {
          type: 'patchRole',
          role: 'primaryMotif',
          patch: { livingRibbonControls: { twist: 0.18, spread: 0.76 }, glow: 0.86 },
          lockKey: 'ribbonMovement',
        },
      ],
      [
        {
          type: 'patchRole',
          role: 'primaryMotif',
          patch: { livingRibbonControls: { twist: -0.16, directionalDrift: -0.14, spread: 0.82 }, particleCount: 58 },
          lockKey: 'ribbonMovement',
        },
      ],
    ],
    ...options,
  })
}

function livingRibbonSystem(): SoundDrawingPerformanceShowDefinition {
  const intro = [
    livingRibbonLayer(
      'lrs-primary',
      {
        drive: 0.1,
        turbulence: 0.06,
        tension: 0.68,
        damping: 0.72,
        spread: 0.32,
        centerAttraction: 0.3,
        widthTarget: 0.38,
        twist: 0.02,
        radialPressure: -0.04,
        collapseAmount: 0.06,
        releaseAmount: 0,
        directionalDrift: 0.035,
        heatDecay: 0.72,
      },
      { opacity: 0.58, strokeWidth: 0.8, trailPersistence: 0.9, glow: 0.38, particleCount: 4 },
    ),
  ]
  const verse = [
    livingRibbonLayer(
      'lrs-primary',
      {
        drive: 0.24,
        turbulence: 0.1,
        tension: 0.64,
        damping: 0.64,
        spread: 0.48,
        centerAttraction: 0.4,
        widthTarget: 0.48,
        twist: 0.05,
        radialPressure: 0,
        collapseAmount: 0.03,
        releaseAmount: 0,
        directionalDrift: 0.055,
        heatDecay: 0.62,
      },
      { opacity: 0.78, strokeWidth: 0.94, trailPersistence: 0.78, glow: 0.58, particleCount: 12 },
    ),
  ]
  const build = [
    livingRibbonLayer(
      'lrs-primary',
      {
        drive: 0.3,
        turbulence: 0.13,
        tension: 0.76,
        damping: 0.66,
        spread: 0.34,
        centerAttraction: 0.56,
        widthTarget: 0.5,
        twist: 0.075,
        radialPressure: -0.12,
        collapseAmount: 0.32,
        releaseAmount: 0,
        directionalDrift: 0.05,
        heatDecay: 0.4,
      },
      { opacity: 0.9, strokeWidth: 1.05, trailPersistence: 0.62, glow: 0.74, particleCount: 20 },
    ),
  ]
  const preDrop = [
    livingRibbonLayer(
      'lrs-primary',
      {
        drive: 0.14,
        turbulence: 0.035,
        tension: 0.94,
        damping: 0.76,
        spread: 0.16,
        centerAttraction: 0.82,
        widthTarget: 0.46,
        twist: 0.025,
        radialPressure: -0.32,
        collapseAmount: 0.76,
        releaseAmount: 0,
        directionalDrift: 0.01,
        heatDecay: 0.22,
      },
      { opacity: 0.94, strokeWidth: 1.12, trailPersistence: 0.3, glow: 0.84, particleCount: 6, colorRole: 'accent' },
    ),
  ]
  const drop = [
    livingRibbonLayer(
      'lrs-primary',
      {
        drive: 0.62,
        turbulence: 0.3,
        tension: 0.54,
        damping: 0.44,
        spread: 0.82,
        centerAttraction: 0.16,
        widthTarget: 0.7,
        twist: 0.15,
        radialPressure: 0.22,
        collapseAmount: 0,
        releaseAmount: 0.34,
        directionalDrift: 0.12,
        heatDecay: 0.28,
      },
      { opacity: 1, strokeWidth: 1.3, trailPersistence: 0.68, glow: 0.94, particleCount: 46 },
    ),
  ]
  const breakdown = [
    livingRibbonLayer(
      'lrs-primary',
      {
        drive: 0.14,
        turbulence: 0.055,
        tension: 0.6,
        damping: 0.76,
        spread: 0.5,
        centerAttraction: 0.56,
        widthTarget: 0.42,
        twist: 0.07,
        radialPressure: -0.02,
        collapseAmount: 0.06,
        releaseAmount: 0,
        directionalDrift: 0.09,
        heatDecay: 0.76,
      },
      { opacity: 0.64, strokeWidth: 0.86, trailPersistence: 0.94, glow: 0.46, particleCount: 4 },
    ),
  ]
  const outro = [
    livingRibbonLayer(
      'lrs-primary',
      {
        drive: 0.06,
        turbulence: 0.025,
        tension: 0.72,
        damping: 0.82,
        spread: 0.24,
        centerAttraction: 0.7,
        widthTarget: 0.32,
        twist: 0.015,
        radialPressure: -0.18,
        collapseAmount: 0.58,
        releaseAmount: 0,
        directionalDrift: 0.01,
        heatDecay: 0.86,
      },
      { opacity: 0.42, strokeWidth: 0.74, trailPersistence: 0.96, glow: 0.3, particleCount: 0 },
    ),
  ]
  const fallback = [
    livingRibbonLayer(
      'lrs-fallback-primary',
      {
        drive: 0.22,
        turbulence: 0.1,
        tension: 0.64,
        damping: 0.66,
        spread: 0.46,
        centerAttraction: 0.34,
        widthTarget: 0.48,
        twist: 0.045,
        radialPressure: 0,
        collapseAmount: 0.02,
        releaseAmount: 0,
        directionalDrift: 0.04,
        heatDecay: 0.62,
      },
      {
        opacity: 0.7,
        strokeWidth: 0.92,
        trailPersistence: 0.78,
        glow: 0.54,
        particleCount: 10,
        modulationRoutes: LIVING_RIBBON_ROUTES.filter(
          (route) => route.capability == null && route.confidenceKey !== 'section' && route.confidenceKey !== 'phrase',
        ),
        eventBindings: LIVING_RIBBON_EVENTS.filter((binding) =>
          ['kick', 'snare', 'hat', 'downbeat', 'fourBarBoundary', 'eightBarBoundary', 'sixteenBarBoundary'].includes(
            binding.event,
          ),
        ).map((binding) => ({
          ...binding,
          capability: undefined,
          minConfidence: undefined,
          confidenceKey: undefined,
          sectionFilter: undefined,
        })),
      },
    ),
  ]

  return {
    id: 'livingRibbonSystem',
    name: 'Living Ribbon System',
    description:
      'A persistent physical ribbon shaped by continuous musical forces and deterministic structural impulses.',
    program: {
      id: 'soundDrawing.livingRibbonSystem',
      metadata: {
        name: 'Living Ribbon System',
        description:
          'Audio-intelligent Living Ribbon choreography routed through normalized physical controls and impulses.',
        engine: 'soundDrawing',
        version: 2,
        authoringRevision: 'living-ribbon-audio-intelligence-controls-persistence',
      },
      fallbackOrder: ['unknown'],
      fallbackSceneId: 'lrs-fallback',
      scenes: [
        livingRibbonScene('lrs-intro', ['intro'], intro),
        livingRibbonScene('lrs-verse', ['verse'], verse),
        livingRibbonScene('lrs-build', ['build'], build, {
          bodyActions: [
            {
              type: 'patchRole',
              role: 'primaryMotif',
              patch: {
                livingRibbonControls: { tension: 0.84, collapseAmount: 0.44, centerAttraction: 0.68 },
                glow: 0.82,
              },
              lockKey: 'ribbonMovement',
            },
          ],
        }),
        livingRibbonScene('lrs-pre-drop', ['preDrop'], preDrop, { priority: 6 }),
        livingRibbonScene('lrs-drop-2', ['drop'], drop, {
          priority: 10,
          dropOccurrence: { minOccurrence: 2 },
          bodyActions: [
            {
              type: 'patchRole',
              role: 'primaryMotif',
              patch: {
                livingRibbonControls: { twist: -0.22, directionalDrift: -0.16, spread: 0.9, turbulence: 0.38 },
                particleCount: 62,
                glow: 1,
              },
              lockKey: 'ribbonMovement',
            },
          ],
          fourBarActions: [
            [
              {
                type: 'patchRole',
                role: 'primaryMotif',
                patch: { livingRibbonControls: { directionalDrift: -0.14, twist: -0.2 } },
                lockKey: 'ribbonMovement',
              },
            ],
            [
              {
                type: 'patchRole',
                role: 'primaryMotif',
                patch: { livingRibbonControls: { directionalDrift: 0.16, twist: -0.08 } },
                lockKey: 'ribbonMovement',
              },
            ],
            [
              {
                type: 'patchRole',
                role: 'primaryMotif',
                patch: { livingRibbonControls: { directionalDrift: 0.08, twist: 0.24 } },
                lockKey: 'ribbonMovement',
              },
            ],
            [
              {
                type: 'patchRole',
                role: 'primaryMotif',
                patch: { livingRibbonControls: { directionalDrift: -0.18, twist: 0.1 } },
                lockKey: 'ribbonMovement',
              },
            ],
          ],
        }),
        livingRibbonScene('lrs-drop', ['drop'], drop, { priority: 5 }),
        livingRibbonScene('lrs-breakdown', ['breakdown', 'bridge'], breakdown),
        livingRibbonScene('lrs-outro', ['outro'], outro),
        livingRibbonScene('lrs-fallback', ['unknown'], fallback, { priority: -10 }),
      ],
    },
  }
}

function professionalScopeShow(
  id: Extract<SoundDrawingPerformanceShowDefinition['id'], 'stereoPulseStudy' | 'phaseOrbit' | 'scopeAndShape'>,
  name: string,
  description: string,
  scopePresetId: string,
  scopePatch: Partial<SoundDrawingPerformanceLayerBlueprint> = {},
  supportingLayers: readonly SoundDrawingPerformanceLayerBlueprint[] = [],
): SoundDrawingPerformanceShowDefinition {
  const scope = layer(`${id}-scope`, 'primaryMotif', 'professionalScope', {
    opacity: 0.9,
    scale: 0.94,
    audioDisplacement: 0,
    jitter: 0,
    professionalScope: {
      presetId: scopePresetId,
      signalMode: id === 'phaseOrbit' ? 'midSideXY' : 'stereoXY',
      transitionSeconds: 0.45,
      music: { beatBloom: 0.55, kickWidth: 0.3, bassExposure: 0.25, buildExposure: 0.35, dropSnap: 0.5 },
    },
    modulationRoutes: [
      {
        id: `${id}-scope-exposure`,
        source: 'trackRelativeEnergy',
        target: 'scopeExposure',
        min: 0,
        max: 0.45,
        amount: 1,
        clamp: [0.7, 2],
        lockKey: 'reaction',
      },
      {
        id: `${id}-scope-persistence`,
        source: 'sectionProgress',
        target: 'scopePersistence',
        min: -0.08,
        max: 0.18,
        amount: 1,
        clamp: [0.08, 2.5],
        lockKey: 'trail',
      },
    ],
    eventBindings: [
      {
        id: `${id}-scope-beat`,
        event: 'beat',
        target: 'scopeBloom',
        amount: 0.12,
        envelope: FAST,
        lockKey: 'reaction',
      },
      {
        id: `${id}-scope-drop`,
        event: 'dropImpact',
        target: 'scopeBeamWidth',
        amount: 0.45,
        envelope: DOWNBEAT,
        lockKey: 'reaction',
      },
    ],
    ...scopePatch,
  })
  const calm = [scope, ...supportingLayers]
  const drop = [
    { ...scope, opacity: 1, scale: 1.04, professionalScope: { ...scope.professionalScope, presetId: 'scope-heavy-drop-vector', transitionSeconds: 0.3 } },
    ...supportingLayers.map((candidate) => ({ ...candidate, opacity: Math.min(1, (candidate.opacity ?? 0.5) + 0.18) })),
  ]
  return {
    id,
    name,
    description,
    program: {
      id: `soundDrawing.${id}`,
      metadata: {
        name,
        description,
        engine: 'soundDrawing',
        version: 2,
        authoringRevision: 'professional-scope-layer-v1',
      },
      fallbackOrder: ['unknown'],
      fallbackSceneId: `${id}-fallback`,
      scenes: [
        scene(`${id}-intro`, ['intro', 'verse', 'breakdown', 'bridge'], calm),
        scene(`${id}-build`, ['build', 'preDrop'], calm, {
          fourBarActions: [
            [{ type: 'patchRole', role: 'primaryMotif', patch: { rotation: id === 'phaseOrbit' ? 12 : 0, scale: 0.9 }, lockKey: 'transform' }],
            [{ type: 'patchRole', role: 'primaryMotif', patch: { rotation: id === 'phaseOrbit' ? -12 : 0, scale: 0.98 }, lockKey: 'transform' }],
          ],
        }),
        scene(`${id}-drop`, ['drop'], drop, { priority: 5 }),
        scene(`${id}-outro`, ['outro'], calm.map((candidate) => ({ ...candidate, opacity: (candidate.opacity ?? 0.8) * 0.55 }))),
        scene(`${id}-fallback`, ['unknown'], calm, { priority: -10 }),
      ],
    },
  }
}

function stereoPulseStudy(): SoundDrawingPerformanceShowDefinition {
  return professionalScopeShow(
    'stereoPulseStudy',
    'Stereo Pulse Study',
    'A genuine stereo X/Y trace with stable triggering, phrase persistence, and beat-driven phosphor.',
    'scope-stereo-phase',
    {
      professionalScope: {
        presetId: 'scope-stereo-phase',
        signalMode: 'stereoXY',
        trigger: { mode: 'auto', source: 'mid', hysteresis: 0.035, continuityWeight: 0.82, periodAssist: 0.76 },
        timebase: { mode: 'auto', autoMinimumSeconds: 0.006, autoMaximumSeconds: 0.09 },
        transitionSeconds: 0.45,
      },
    },
  )
}

function phaseOrbit(): SoundDrawingPerformanceShowDefinition {
  return professionalScopeShow(
    'phaseOrbit',
    'Phase Orbit',
    'Mid/side measurement orbit with controlled viewport rotation and section-shaped exposure.',
    'scope-mid-side',
    { rotation: -8, scale: 0.86, professionalScope: { presetId: 'scope-mid-side', signalMode: 'midSideXY', exposure: 0.9 } },
  )
}

function scopeAndShape(): SoundDrawingPerformanceShowDefinition {
  return professionalScopeShow(
    'scopeAndShape',
    'Scope and Shape',
    'A synchronized stereo scope composited beneath an authored bass membrane in deterministic order.',
    'scope-cyan-emerald-core',
    { role: 'harmonicLayer', opacity: 0.72, blendMode: 'lighter' },
    [
      layer('scope-shape-primary', 'primaryMotif', 'circularBassMembrane', {
        opacity: 0.62,
        scale: 0.56,
        colorRole: 'accent',
        blendMode: 'screen',
      }),
    ],
  )
}

export const SOUND_DRAWING_PERFORMANCE_SHOWS: readonly SoundDrawingPerformanceShowDefinition[] = [
  radialPressureSystem(),
  harmonicRibbonReactor(),
  phaseKnotCathedral(),
  livingRibbonSystem(),
  stereoPulseStudy(),
  phaseOrbit(),
  scopeAndShape(),
]

export const SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID = Object.fromEntries(
  SOUND_DRAWING_PERFORMANCE_SHOWS.map((show) => [show.id, show]),
) as Record<SoundDrawingPerformanceShowDefinition['id'], SoundDrawingPerformanceShowDefinition>

export function soundDrawingPerformanceShowUsesGenerator(
  showId: SoundDrawingPerformanceShowDefinition['id'],
  generator: SoundDrawingPerformanceLayerBlueprint['generator'],
): boolean {
  const show = SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID[showId]
  return show.program.scenes.some((candidate) =>
    candidate.actions?.some(
      (action) => action.type === 'scene' && action.layers.some((layer) => layer.generator === generator),
    ),
  )
}

/** All authored scope declarations, used to size the live stereo capture window. */
export function soundDrawingPerformanceShowProfessionalScopeLayers(
  showId: SoundDrawingPerformanceShowDefinition['id'],
): readonly SoundDrawingPerformanceLayerBlueprint[] {
  const show = SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID[showId]
  const layers: SoundDrawingPerformanceLayerBlueprint[] = []
  for (const candidate of show.program.scenes) {
    for (const action of candidate.actions ?? []) {
      if (action.type === 'scene') {
        layers.push(...action.layers.filter((layer) => layer.generator === 'professionalScope'))
      } else if (action.type === 'recruitLayer' && action.layer.generator === 'professionalScope') {
        layers.push(action.layer)
      }
    }
  }
  return layers
}
