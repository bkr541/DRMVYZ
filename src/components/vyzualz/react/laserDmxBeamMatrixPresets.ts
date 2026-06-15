/**
 * Beam Matrix preset registry.
 * Each preset factory returns a fresh settings object — no shared mutable state.
 * IDs follow the pattern: `{preset-id}:{scope}:{slug}`.
 *
 * Group route targets are limited to those handled by compileGroupRoutes:
 *   dimmer, beamWidth, beamDivergence, beamGlow, strobeRate
 * Global route targets are limited to those handled by applyGlobalRoute:
 *   masterDimmer, backgroundFade, beamPersistence, globalBeamWidth, globalGlow,
 *   globalStrobeRate, fogDensity, fogOpacity, fogBeamScatter, fogTurbulence
 */

import type {
  LaserDmxBeamMatrixPreset,
  LaserDmxBeamMatrixPresetSummary,
  LaserDmxBeamMatrixSettings,
  LaserDmxMatrixBeam,
  LaserDmxReactionGroup,
  LaserDmxModulationRoute,
  LaserDmxMatrixBeamColor,
  LaserDmxMatrixBeamAppearance,
  LaserDmxBeamMatrixOutputSettings,
  LaserDmxFogSettings,
  LaserDmxBeamMatrixEditorSettings,
  LaserDmxBeamMotion,
  LaserDmxBeamSequence,
} from './ReactTypes'
import { DEFAULT_BEAM_MOTION, DEFAULT_BEAM_SEQUENCE, DEFAULT_LAUNCH_SETTINGS } from './ReactTypes'

// ── Low-level factory helpers ─────────────────────────────────────────────────

function mkColor(
  red: number, green: number, blue: number,
  white = 0, alpha = 1,
): LaserDmxMatrixBeamColor {
  return { red, green, blue, white, alpha }
}

function mkRoute(
  id: string,
  source: string,
  target: LaserDmxModulationRoute['target'],
  mode: LaserDmxModulationRoute['mode'],
  amount: number,
  min: number,
  max: number,
  curve: LaserDmxModulationRoute['curve'],
  attack: number,
  release: number,
  opts: { smoothing?: number; invert?: boolean; threshold?: number } = {},
): LaserDmxModulationRoute {
  return {
    id,
    enabled:   true,
    source,
    target,
    mode,
    amount,
    min,
    max,
    curve,
    attack,
    release,
    smoothing: opts.smoothing ?? 0,
    invert:    opts.invert    ?? false,
    threshold: opts.threshold,
  }
}

function mkGroup(
  id: string,
  name: string,
  color: LaserDmxMatrixBeamColor,
  routes: LaserDmxModulationRoute[],
): LaserDmxReactionGroup {
  return {
    id,
    name,
    enabled: true,
    muted:   false,
    soloed:  false,
    colorOverrideEnabled: true,
    color,
    sequence:       DEFAULT_BEAM_SEQUENCE,
    launch:         DEFAULT_LAUNCH_SETTINGS,
    maxActiveBeams: 0,
    modulationRoutes: routes,
  }
}

/** Assign sequenceIndex = array position to each beam. */
function withSequenceIndices(beams: LaserDmxMatrixBeam[]): LaserDmxMatrixBeam[] {
  return beams.map((b, i) => ({ ...b, sequenceIndex: i }))
}

function mkGridBeam(
  id: string,
  name: string,
  groupId: string,
  origCol: number, origRow: number,
  targCol: number, targRow: number,
  appearance: LaserDmxMatrixBeamAppearance,
): LaserDmxMatrixBeam {
  return {
    id,
    name,
    enabled:       true,
    sequenceIndex: 0,
    origin:        { column: origCol, row: origRow, z: 0 },
    target:        { kind: 'grid', column: targCol, row: targRow, z: 0 },
    groupId,
    useGroupColor: true,
    color:         mkColor(255, 255, 255),
    appearance,
    motion:        DEFAULT_BEAM_MOTION,
    modulationRoutes: [],
  }
}

function mkOutput(o: LaserDmxBeamMatrixOutputSettings): LaserDmxBeamMatrixOutputSettings {
  return { ...o }
}

function mkFog(f: LaserDmxFogSettings): LaserDmxFogSettings {
  return { ...f }
}

function mkEditor(): LaserDmxBeamMatrixEditorSettings {
  return { guidesVisible: true, snapEnabled: true, overscanAmount: 0, beamEditorVisible: true, beamPathsVisible: true }
}

function mkStageBeam(
  id: string,
  name: string,
  groupId: string,
  origCol: number, origRow: number,
  stageX: number, stageY: number, stageZ: number,
  appearance: LaserDmxMatrixBeamAppearance,
): LaserDmxMatrixBeam {
  return {
    id,
    name,
    enabled:       true,
    sequenceIndex: 0,
    origin:        { column: origCol, row: origRow, z: 0 },
    target:        { kind: 'stage', x: stageX, y: stageY, z: stageZ },
    groupId,
    useGroupColor: true,
    color:         mkColor(255, 255, 255),
    appearance,
    motion:        DEFAULT_BEAM_MOTION,
    modulationRoutes: [],
  }
}

// ── Preset 1: Minimal Crossfire ───────────────────────────────────────────────

function createMinimalCrossfireSettings(): LaserDmxBeamMatrixSettings {
  const P = 'minimal-crossfire'

  const cyanBass = mkGroup(
    `${P}:group:cyan-bass`,
    'Cyan Bass',
    mkColor(0, 225, 235, 25, 1),
    [
      mkRoute(`${P}:route:bass-dimmer`, 'nBass', 'dimmer', 'set',
        1, 0.28, 1, 'easeOut', 0.035, 0.18, { smoothing: 0.28 }),
      mkRoute(`${P}:route:bass-width`, 'nBass', 'beamWidth', 'set',
        0.55, 0.85, 1.3, 'easeOut', 0.05, 0.24, { smoothing: 0.3 }),
    ],
  )

  const blueSnare = mkGroup(
    `${P}:group:blue-snare`,
    'Blue Snare Accent',
    mkColor(15, 70, 255, 35, 1),
    [
      mkRoute(`${P}:route:snare-dimmer`, 'snareHit', 'dimmer', 'trigger',
        1, 0.25, 1, 'easeOut', 0, 0.16),
      mkRoute(`${P}:route:snare-glow`, 'snareHit', 'beamGlow', 'trigger',
        0.65, 0, 0.5, 'easeOut', 0, 0.12),
    ],
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.9, shutterOpen: true, width: 1.1, focus: 0.9,
    strobeRate: 0, flickerAmount: 0, divergence: 0.06, glow: 0.55,
    geometry: 'line',
  }

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices([
      mkGridBeam(`${P}:beam:c1r10-c8r1`,   'Beam 1', cyanBass.id,   1, 10, 8,  1, app),
      mkGridBeam(`${P}:beam:c15r10-c8r1`,  'Beam 2', blueSnare.id, 15, 10, 8,  1, app),
      mkGridBeam(`${P}:beam:c1r1-c8r10`,   'Beam 3', cyanBass.id,   1,  1, 8, 10, app),
      mkGridBeam(`${P}:beam:c15r1-c8r10`,  'Beam 4', blueSnare.id, 15,  1, 8, 10, app),
    ]),
    groups: [cyanBass, blueSnare],
    globalModulationRoutes: [
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.25, 0, 0.3, 'easeOut', 0, 0.2),
    ],
    output: mkOutput({
      masterDimmer:     0.86,
      blackout:         false,
      safetyClamp:      0.9,
      backgroundFade:   0.2,
      beamPersistence:  0.45,
      globalBeamWidth:  1,
      globalGlow:       0.55,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled:         true,
      density:         0.15,
      opacity:         0.22,
      noiseScale:      1.2,
      driftSpeed:      0.08,
      driftDirection:  0.08,
      turbulence:      0.12,
      diffusion:       0.18,
      dissipation:     0.65,
      beamScatter:     0.25,
      colorAbsorption: 0.2,
      quality:         'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 2: Redline Bass Tunnel ─────────────────────────────────────────────

function createRedlineBassTunnelSettings(): LaserDmxBeamMatrixSettings {
  const P = 'redline-bass-tunnel'

  const bassTunnel = mkGroup(
    `${P}:group:bass-tunnel`,
    'Bass Tunnel',
    mkColor(255, 20, 20, 20, 1),
    [
      mkRoute(`${P}:route:bass-dimmer`, 'nBass', 'dimmer', 'set',
        1, 0.14, 1, 'easeOut', 0.025, 0.2, { smoothing: 0.25 }),
      mkRoute(`${P}:route:bass-width`, 'nBass', 'beamWidth', 'set',
        0.8, 0.7, 1.8, 'easeOut', 0.04, 0.26, { smoothing: 0.28 }),
      mkRoute(`${P}:route:bass-glow`, 'nBass', 'beamGlow', 'set',
        0.75, 0.35, 1, 'easeOut', 0.04, 0.3, { smoothing: 0.3 }),
    ],
  )

  const kickAccent = mkGroup(
    `${P}:group:kick-accent`,
    'Kick Accent',
    mkColor(255, 25, 20, 70, 1),
    [
      mkRoute(`${P}:route:kick-glow`, 'kickHit', 'beamGlow', 'trigger',
        0.45, 0, 0.5, 'easeOut', 0, 0.18),
    ],
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.85, shutterOpen: true, width: 1.15, focus: 0.86,
    strobeRate: 0, flickerAmount: 0, divergence: 0.05, glow: 0.65,
    geometry: 'line',
  }

  // 8 beams alternating between Bass Tunnel and Kick Accent
  const beamDefs: [string, string, number, number, number, number][] = [
    [`${P}:beam:c1r10-c7r1`,   'Beam 1',  1, 10,  7, 1],
    [`${P}:beam:c3r10-c7r1`,   'Beam 2',  3, 10,  7, 1],
    [`${P}:beam:c5r10-c8r1`,   'Beam 3',  5, 10,  8, 1],
    [`${P}:beam:c7r10-c8r1`,   'Beam 4',  7, 10,  8, 1],
    [`${P}:beam:c9r10-c8r1`,   'Beam 5',  9, 10,  8, 1],
    [`${P}:beam:c11r10-c8r1`,  'Beam 6', 11, 10,  8, 1],
    [`${P}:beam:c13r10-c9r1`,  'Beam 7', 13, 10,  9, 1],
    [`${P}:beam:c15r10-c9r1`,  'Beam 8', 15, 10,  9, 1],
  ]
  const beams = beamDefs.map(([id, name, oc, or_, tc, tr], i) =>
    mkGridBeam(id, name, i % 2 === 0 ? bassTunnel.id : kickAccent.id, oc, or_, tc, tr, app)
  )

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices(beams),
    groups: [bassTunnel, kickAccent],
    globalModulationRoutes: [
      mkRoute(`${P}:global:bass-scatter`, 'nBass', 'fogBeamScatter', 'set',
        0.65, 0.2, 0.65, 'easeOut', 0.05, 0.3, { smoothing: 0.3 }),
      mkRoute(`${P}:global:energy-fog`, 'energy', 'fogDensity', 'set',
        0.45, 0.2, 0.42, 'easeOut', 0.1, 0.45, { smoothing: 0.4 }),
    ],
    output: mkOutput({
      masterDimmer:     0.9,
      blackout:         false,
      safetyClamp:      0.92,
      backgroundFade:   0.16,
      beamPersistence:  0.58,
      globalBeamWidth:  1.15,
      globalGlow:       0.7,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled:         true,
      density:         0.28,
      opacity:         0.38,
      noiseScale:      1.05,
      driftSpeed:      0.12,
      driftDirection:  0.1,
      turbulence:      0.2,
      diffusion:       0.3,
      dissipation:     0.55,
      beamScatter:     0.42,
      colorAbsorption: 0.18,
      quality:         'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 3: Blue Snare Crossfire ────────────────────────────────────────────

function createBlueSnareSettings(): LaserDmxBeamMatrixSettings {
  const P = 'blue-snare-crossfire'

  const snareReact = mkGroup(
    `${P}:group:snare-react`,
    'Snare React',
    mkColor(20, 75, 255, 75, 1),
    [
      mkRoute(`${P}:route:snare-dimmer`, 'snareHit', 'dimmer', 'trigger',
        1, 0.06, 1, 'easeOut', 0, 0.22),
      mkRoute(`${P}:route:snare-width`, 'snareHit', 'beamWidth', 'trigger',
        0.5, 0.85, 1.4, 'easeOut', 0, 0.16),
      mkRoute(`${P}:route:snare-glow`, 'snareHit', 'beamGlow', 'trigger',
        0.9, 0, 0.6, 'easeOut', 0, 0.12),
    ],
  )

  const hatDetail = mkGroup(
    `${P}:group:hat-detail`,
    'Hat Detail',
    mkColor(20, 170, 255, 30, 1),
    [
      mkRoute(`${P}:route:hat-glow`, 'hatHit', 'beamGlow', 'trigger',
        0.25, 0, 0.3, 'easeOut', 0, 0.1),
    ],
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.16, shutterOpen: true, width: 0.9, focus: 0.96,
    strobeRate: 0, flickerAmount: 0, divergence: 0.035, glow: 0.52,
    geometry: 'line',
  }

  // 8 diagonal beams → Snare React; 2 center beams → Hat Detail
  const beams: LaserDmxMatrixBeam[] = [
    mkGridBeam(`${P}:beam:c1r1-c15r10`,  'Diag 1',  snareReact.id,  1,  1, 15, 10, app),
    mkGridBeam(`${P}:beam:c15r1-c1r10`,  'Diag 2',  snareReact.id, 15,  1,  1, 10, app),
    mkGridBeam(`${P}:beam:c3r1-c13r10`,  'Diag 3',  snareReact.id,  3,  1, 13, 10, app),
    mkGridBeam(`${P}:beam:c13r1-c3r10`,  'Diag 4',  snareReact.id, 13,  1,  3, 10, app),
    mkGridBeam(`${P}:beam:c1r3-c15r8`,   'Diag 5',  snareReact.id,  1,  3, 15,  8, app),
    mkGridBeam(`${P}:beam:c15r3-c1r8`,   'Diag 6',  snareReact.id, 15,  3,  1,  8, app),
    mkGridBeam(`${P}:beam:c1r8-c15r3`,   'Diag 7',  snareReact.id,  1,  8, 15,  3, app),
    mkGridBeam(`${P}:beam:c15r8-c1r3`,   'Diag 8',  snareReact.id, 15,  8,  1,  3, app),
    mkGridBeam(`${P}:beam:c8r1-c8r10`,   'V Center', hatDetail.id,  8,  1,  8, 10, app),
    mkGridBeam(`${P}:beam:c1r5-c15r5`,   'H Center', hatDetail.id,  1,  5, 15,  5, app),
  ]

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices(beams),
    groups: [snareReact, hatDetail],
    globalModulationRoutes: [
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        1, 0, 0.4, 'easeOut', 0, 0.18),
    ],
    output: mkOutput({
      masterDimmer:     0.88,
      blackout:         false,
      safetyClamp:      0.92,
      backgroundFade:   0.22,
      beamPersistence:  0.38,
      globalBeamWidth:  0.95,
      globalGlow:       0.66,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled:         true,
      density:         0.12,
      opacity:         0.2,
      noiseScale:      1.35,
      driftSpeed:      0.1,
      driftDirection:  0.7,
      turbulence:      0.17,
      diffusion:       0.2,
      dissipation:     0.72,
      beamScatter:     0.22,
      colorAbsorption: 0.16,
      quality:         'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 4: Green Beat Pyramid ──────────────────────────────────────────────

function createGreenBeatPyramidSettings(): LaserDmxBeamMatrixSettings {
  const P = 'green-beat-pyramid'

  const beatPyramid = mkGroup(
    `${P}:group:beat-pyramid`,
    'Beat Pyramid',
    mkColor(20, 245, 55, 25, 0.92),
    [
      mkRoute(`${P}:route:beat-dimmer`, 'beat', 'dimmer', 'trigger',
        1, 0.12, 1, 'easeOut', 0, 0.16),
      mkRoute(`${P}:route:phase-divergence`, 'beatPhase', 'beamDivergence', 'set',
        0.35, 0.12, 0.32, 'easeInOut', 0, 0, { smoothing: 0.15 }),
    ],
  )

  const downbeatAccent = mkGroup(
    `${P}:group:downbeat-accent`,
    'Downbeat Accent',
    mkColor(70, 255, 100, 100, 1),
    [
      mkRoute(`${P}:route:downbeat-glow`, 'downbeat', 'beamGlow', 'trigger',
        0.8, 0, 0.85, 'easeOut', 0, 0.24),
      mkRoute(`${P}:route:downbeat-dimmer`, 'downbeat', 'dimmer', 'trigger',
        0.75, 0, 1, 'easeOut', 0, 0.16),
    ],
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.55, shutterOpen: true, width: 1.4, focus: 0.62,
    strobeRate: 0, flickerAmount: 0, divergence: 0.22, glow: 0.72,
    geometry: 'volumetricCone',
  }

  // 6 beams: outer 4 → Beat Pyramid, inner 2 → Downbeat Accent
  const beams: LaserDmxMatrixBeam[] = [
    mkGridBeam(`${P}:beam:c2r10-c8r2`,   'Outer L2',  beatPyramid.id,    2, 10, 8, 2, app),
    mkGridBeam(`${P}:beam:c4r10-c8r2`,   'Inner L',   downbeatAccent.id, 4, 10, 8, 2, app),
    mkGridBeam(`${P}:beam:c6r10-c8r2`,   'Outer L1',  beatPyramid.id,    6, 10, 8, 2, app),
    mkGridBeam(`${P}:beam:c10r10-c8r2`,  'Outer R1',  beatPyramid.id,   10, 10, 8, 2, app),
    mkGridBeam(`${P}:beam:c12r10-c8r2`,  'Inner R',   downbeatAccent.id,12, 10, 8, 2, app),
    mkGridBeam(`${P}:beam:c14r10-c8r2`,  'Outer R2',  beatPyramid.id,   14, 10, 8, 2, app),
  ]

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices(beams),
    groups: [beatPyramid, downbeatAccent],
    globalModulationRoutes: [
      mkRoute(`${P}:global:beat-turbulence`, 'beat', 'fogTurbulence', 'trigger',
        0.25, 0, 0.28, 'easeOut', 0, 0.15),
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.45, 0, 0.5, 'easeOut', 0, 0.25),
    ],
    output: mkOutput({
      masterDimmer:     0.86,
      blackout:         false,
      safetyClamp:      0.9,
      backgroundFade:   0.2,
      beamPersistence:  0.42,
      globalBeamWidth:  1.15,
      globalGlow:       0.68,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled:         true,
      density:         0.38,
      opacity:         0.48,
      noiseScale:      1.05,
      driftSpeed:      0.1,
      driftDirection:  0.25,
      turbulence:      0.22,
      diffusion:       0.42,
      dissipation:     0.54,
      beamScatter:     0.66,
      colorAbsorption: 0.24,
      quality:         'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 5: Kick and Snare Duel ────────────────────────────────────────────

function createKickSnareDuelSettings(): LaserDmxBeamMatrixSettings {
  const P = 'kick-snare-duel'

  const redKick = mkGroup(
    `${P}:group:red-kick`,
    'Red Kick',
    mkColor(255, 25, 20, 30, 1),
    [
      mkRoute(`${P}:route:kick-dimmer`, 'kick', 'dimmer', 'set',
        0.85, 0.12, 0.82, 'easeOut', 0.02, 0.18, { smoothing: 0.25 }),
      mkRoute(`${P}:route:kick-width`, 'kickHit', 'beamWidth', 'trigger',
        0.65, 0, 0.65, 'easeOut', 0, 0.16),
      mkRoute(`${P}:route:kick-glow`, 'kickHit', 'beamGlow', 'trigger',
        0.55, 0, 0.6, 'easeOut', 0, 0.18),
    ],
  )

  const blueSnare = mkGroup(
    `${P}:group:blue-snare`,
    'Blue Snare',
    mkColor(20, 75, 255, 60, 1),
    [
      mkRoute(`${P}:route:snare-dimmer`, 'snareHit', 'dimmer', 'trigger',
        1, 0.08, 1, 'easeOut', 0, 0.24),
      // white-channel flash is not supported at group scope; beamGlow gives the same visual
      mkRoute(`${P}:route:snare-glow`, 'snare', 'beamGlow', 'set',
        0.4, 0.25, 0.75, 'easeOut', 0.03, 0.2, { smoothing: 0.25 }),
    ],
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.38, shutterOpen: true, width: 1, focus: 0.92,
    strobeRate: 0, flickerAmount: 0, divergence: 0.045, glow: 0.58,
    geometry: 'line',
  }

  const redDefs: [string, string, number, number, number, number][] = [
    [`${P}:beam:c1r10-c8r1`,  'Red 1',  1, 10, 8, 1],
    [`${P}:beam:c3r10-c8r2`,  'Red 2',  3, 10, 8, 2],
    [`${P}:beam:c5r10-c8r3`,  'Red 3',  5, 10, 8, 3],
    [`${P}:beam:c1r1-c8r10`,  'Red 4',  1,  1, 8, 10],
    [`${P}:beam:c3r1-c8r9`,   'Red 5',  3,  1, 8, 9],
    [`${P}:beam:c5r1-c8r8`,   'Red 6',  5,  1, 8, 8],
  ]
  const blueDefs: [string, string, number, number, number, number][] = [
    [`${P}:beam:c15r10-c8r1`, 'Blue 1', 15, 10, 8, 1],
    [`${P}:beam:c13r10-c8r2`, 'Blue 2', 13, 10, 8, 2],
    [`${P}:beam:c11r10-c8r3`, 'Blue 3', 11, 10, 8, 3],
    [`${P}:beam:c15r1-c8r10`, 'Blue 4', 15,  1, 8, 10],
    [`${P}:beam:c13r1-c8r9`,  'Blue 5', 13,  1, 8, 9],
    [`${P}:beam:c11r1-c8r8`,  'Blue 6', 11,  1, 8, 8],
  ]

  const beams: LaserDmxMatrixBeam[] = [
    ...redDefs.map(([id, name, oc, or_, tc, tr]) => mkGridBeam(id, name, redKick.id,   oc, or_, tc, tr, app)),
    ...blueDefs.map(([id, name, oc, or_, tc, tr]) => mkGridBeam(id, name, blueSnare.id, oc, or_, tc, tr, app)),
  ]

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices(beams),
    groups: [redKick, blueSnare],
    globalModulationRoutes: [
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.55, 0, 0.35, 'easeOut', 0, 0.22),
    ],
    output: mkOutput({
      masterDimmer:     0.9,
      blackout:         false,
      safetyClamp:      0.92,
      backgroundFade:   0.18,
      beamPersistence:  0.48,
      globalBeamWidth:  1.05,
      globalGlow:       0.68,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled:         true,
      density:         0.2,
      opacity:         0.3,
      noiseScale:      1.1,
      driftSpeed:      0.12,
      driftDirection:  0.15,
      turbulence:      0.22,
      diffusion:       0.25,
      dissipation:     0.6,
      beamScatter:     0.34,
      colorAbsorption: 0.18,
      quality:         'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 6: RGB Reaction Split ──────────────────────────────────────────────

function createRgbReactionSplitSettings(): LaserDmxBeamMatrixSettings {
  const P = 'rgb-reaction-split'

  const redBass = mkGroup(
    `${P}:group:red-bass`,
    'Red Bass',
    mkColor(255, 25, 20, 20, 1),
    [
      mkRoute(`${P}:route:bass-dimmer`, 'nBass', 'dimmer', 'set',
        1, 0.14, 1, 'easeOut', 0.03, 0.22, { smoothing: 0.3 }),
      mkRoute(`${P}:route:bass-width`, 'nBass', 'beamWidth', 'set',
        0.75, 0.75, 1.65, 'easeOut', 0.04, 0.25, { smoothing: 0.28 }),
      mkRoute(`${P}:route:kick-glow`, 'kickHit', 'beamGlow', 'trigger',
        0.55, 0, 0.55, 'easeOut', 0, 0.17),
    ],
  )

  const blueSnare = mkGroup(
    `${P}:group:blue-snare`,
    'Blue Snare',
    mkColor(20, 75, 255, 55, 1),
    [
      mkRoute(`${P}:route:snare-dimmer`, 'snareHit', 'dimmer', 'trigger',
        1, 0.06, 1, 'easeOut', 0, 0.22),
      // white flash is not supported at group scope; beamGlow gives equivalent flash
      mkRoute(`${P}:route:snare-glow`, 'snare', 'beamGlow', 'set',
        0.45, 0.25, 0.85, 'easeOut', 0.02, 0.2, { smoothing: 0.25 }),
    ],
  )

  const greenBeat = mkGroup(
    `${P}:group:green-beat`,
    'Green Beat',
    mkColor(25, 245, 60, 35, 0.9),
    [
      mkRoute(`${P}:route:beat-dimmer`, 'beat', 'dimmer', 'trigger',
        1, 0.08, 1, 'easeOut', 0, 0.17),
      mkRoute(`${P}:route:phase-divergence`, 'beatPhase', 'beamDivergence', 'set',
        0.35, 0.16, 0.38, 'easeInOut', 0, 0, { smoothing: 0.15 }),
      mkRoute(`${P}:route:downbeat-glow`, 'downbeat', 'beamGlow', 'trigger',
        0.65, 0, 0.65, 'easeOut', 0, 0.25),
    ],
  )

  const purpleCustom = mkGroup(
    `${P}:group:purple-custom`,
    'Purple Custom',
    mkColor(175, 30, 235, 25, 1),
    [
      mkRoute(`${P}:route:flux-dimmer`, 'spectralFlux', 'dimmer', 'set',
        0.8, 0.15, 0.9, 'easeOut', 0.03, 0.2, { smoothing: 0.3 }),
      // targetOffsetX is not supported at group scope; phrase glow accents the phrase timing
      mkRoute(`${P}:route:phrase8-glow`, 'phrase8Hit', 'beamGlow', 'trigger',
        0.6, 0, 0.55, 'easeOut', 0, 0.18),
    ],
  )

  const lineApp: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.5, shutterOpen: true, width: 1, focus: 0.88,
    strobeRate: 0, flickerAmount: 0, divergence: 0.05, glow: 0.6,
    geometry: 'line',
  }
  const coneApp: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.5, shutterOpen: true, width: 1.4, focus: 0.62,
    strobeRate: 0, flickerAmount: 0, divergence: 0.25, glow: 0.72,
    geometry: 'volumetricCone',
  }

  const beams: LaserDmxMatrixBeam[] = [
    // Red Bass — 4 cross beams
    mkGridBeam(`${P}:beam:red:c1r1-c8r10`,   'Red 1',  redBass.id,     1,  1, 8, 10, lineApp),
    mkGridBeam(`${P}:beam:red:c1r10-c8r1`,   'Red 2',  redBass.id,     1, 10, 8,  1, lineApp),
    mkGridBeam(`${P}:beam:red:c15r1-c8r10`,  'Red 3',  redBass.id,    15,  1, 8, 10, lineApp),
    mkGridBeam(`${P}:beam:red:c15r10-c8r1`,  'Red 4',  redBass.id,    15, 10, 8,  1, lineApp),
    // Blue Snare — 4 cross beams
    mkGridBeam(`${P}:beam:blue:c1r3-c15r8`,  'Blue 1', blueSnare.id,   1,  3, 15, 8, lineApp),
    mkGridBeam(`${P}:beam:blue:c15r3-c1r8`,  'Blue 2', blueSnare.id,  15,  3,  1, 8, lineApp),
    mkGridBeam(`${P}:beam:blue:c3r10-c8r1`,  'Blue 3', blueSnare.id,   3, 10, 8,  1, lineApp),
    mkGridBeam(`${P}:beam:blue:c13r10-c8r1`, 'Blue 4', blueSnare.id,  13, 10, 8,  1, lineApp),
    // Green Beat — 4 volumetric cone stage targets
    mkStageBeam(`${P}:beam:green:c5r7-s0.32`, 'Green 1', greenBeat.id,  5, 7, 0.32, 0.28, 0.2, coneApp),
    mkStageBeam(`${P}:beam:green:c11r7-s0.68`,'Green 2', greenBeat.id, 11, 7, 0.68, 0.28, 0.2, coneApp),
    mkStageBeam(`${P}:beam:green:c6r8-s0.38`, 'Green 3', greenBeat.id,  6, 8, 0.38, 0.20, 0.1, coneApp),
    mkStageBeam(`${P}:beam:green:c10r8-s0.62`,'Green 4', greenBeat.id, 10, 8, 0.62, 0.20, 0.1, coneApp),
    // Purple Custom — 4 diagonal beams
    mkGridBeam(`${P}:beam:purp:c1r6-c12r1`,   'Purp 1', purpleCustom.id,  1, 6, 12, 1, lineApp),
    mkGridBeam(`${P}:beam:purp:c15r6-c4r1`,   'Purp 2', purpleCustom.id, 15, 6,  4, 1, lineApp),
    mkGridBeam(`${P}:beam:purp:c4r10-c15r5`,  'Purp 3', purpleCustom.id,  4, 10, 15, 5, lineApp),
    mkGridBeam(`${P}:beam:purp:c12r10-c1r5`,  'Purp 4', purpleCustom.id, 12, 10,  1, 5, lineApp),
  ]

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices(beams),
    groups: [redBass, blueSnare, greenBeat, purpleCustom],
    globalModulationRoutes: [
      mkRoute(`${P}:global:energy-fog`, 'energy', 'fogDensity', 'set',
        0.45, 0.2, 0.48, 'easeOut', 0.08, 0.4, { smoothing: 0.4 }),
      // fogDiffusion is not in applyGlobalRoute dispatch; fogTurbulence gives a similar atmospheric swell
      mkRoute(`${P}:global:drop-turbulence`, 'dropImpact', 'fogTurbulence', 'trigger',
        0.45, 0, 0.5, 'easeOut', 0, 0.3),
    ],
    output: mkOutput({
      masterDimmer:     0.9,
      blackout:         false,
      safetyClamp:      0.92,
      backgroundFade:   0.18,
      beamPersistence:  0.5,
      globalBeamWidth:  1,
      globalGlow:       0.72,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled:         true,
      density:         0.3,
      opacity:         0.42,
      noiseScale:      1.05,
      driftSpeed:      0.13,
      driftDirection:  0.2,
      turbulence:      0.28,
      diffusion:       0.36,
      dissipation:     0.55,
      beamScatter:     0.52,
      colorAbsorption: 0.2,
      quality:         'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 7: Ceiling Scanner ─────────────────────────────────────────────────

function createCeilingScannerSettings(): LaserDmxBeamMatrixSettings {
  const P = 'ceiling-scanner'

  // Group-level routes use only compileGroupRoutes-supported targets.
  // targetOffsetX (scanner sweep) is placed at beam scope instead.
  const sweepA = mkGroup(
    `${P}:group:sweep-a`,
    'Beat Phase Sweep A',
    mkColor(0, 235, 220, 25, 1),
    [
      mkRoute(`${P}:route:sweepA-glow`, 'beat', 'beamGlow', 'trigger',
        0.35, 0, 0.35, 'easeOut', 0, 0.2),
    ],
  )

  const sweepB = mkGroup(
    `${P}:group:sweep-b`,
    'Beat Phase Sweep B',
    mkColor(20, 155, 255, 30, 1),
    [
      mkRoute(`${P}:route:sweepB-glow`, 'snareHit', 'beamGlow', 'trigger',
        0.35, 0, 0.35, 'easeOut', 0, 0.2),
    ],
  )

  const phraseMotion = mkGroup(
    `${P}:group:phrase-motion`,
    'Phrase Motion',
    mkColor(0, 210, 190, 20, 1),
    [
      mkRoute(`${P}:route:phrase-glow`, 'downbeat', 'beamGlow', 'trigger',
        0.45, 0, 0.45, 'easeOut', 0, 0.22),
    ],
  )

  const hatDetail = mkGroup(
    `${P}:group:hat-detail`,
    'Hat Detail',
    mkColor(30, 190, 255, 40, 1),
    [
      // flickerAmount is beam-scope only; beamGlow at low amount gives a subtle shimmer
      mkRoute(`${P}:route:hat-glow`, 'hat', 'beamGlow', 'set',
        0.25, 0, 0.28, 'easeOut', 0, 0.1, { smoothing: 0.2 }),
      mkRoute(`${P}:route:downbeat-glow`, 'downbeat', 'beamGlow', 'trigger',
        0.55, 0, 0.55, 'easeOut', 0, 0.22),
    ],
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.72, shutterOpen: true, width: 0.82, focus: 0.94,
    strobeRate: 0, flickerAmount: 0, divergence: 0.035, glow: 0.55,
    geometry: 'line',
  }

  // Per-beam sweep routes: beatPhase→targetOffsetX on A/B beams, phrase8→targetOffsetX on phrase/hat beams.
  // Alternating invert creates mirrored sweep directions.
  const scanRouteA = mkRoute(`${P}:beam-route:scan-a`, 'beatPhase', 'targetOffsetX', 'set',
    1, -0.12, 0.12, 'easeInOut', 0, 0, { smoothing: 0.12 })
  const scanRouteB = mkRoute(`${P}:beam-route:scan-b`, 'beatPhase', 'targetOffsetX', 'set',
    1, -0.12, 0.12, 'easeInOut', 0, 0, { smoothing: 0.12, invert: true })
  const phraseRouteA = mkRoute(`${P}:beam-route:phrase-a`, 'phrase8', 'targetOffsetX', 'set',
    0.65, -0.05, 0.05, 'easeInOut', 0, 0, { smoothing: 0.3 })
  const phraseRouteB = mkRoute(`${P}:beam-route:phrase-b`, 'phrase8', 'targetOffsetX', 'set',
    0.65, -0.05, 0.05, 'easeInOut', 0, 0, { smoothing: 0.3, invert: true })

  // 8 beams alternating across 4 groups (2 per group)
  const beamDefs: [string, string, string, number, number, number, number, LaserDmxModulationRoute][] = [
    [`${P}:beam:c1r1-c4r10`,   'Scan 1',  sweepA.id,      1,  1,  4, 10, { ...scanRouteA,   id: `${P}:beam-route:b1:scan` }],
    [`${P}:beam:c3r1-c6r10`,   'Scan 2',  sweepB.id,      3,  1,  6, 10, { ...scanRouteB,   id: `${P}:beam-route:b2:scan` }],
    [`${P}:beam:c5r1-c8r10`,   'Scan 3',  phraseMotion.id, 5,  1,  8, 10, { ...phraseRouteA, id: `${P}:beam-route:b3:scan` }],
    [`${P}:beam:c7r1-c10r10`,  'Scan 4',  hatDetail.id,   7,  1, 10, 10, { ...phraseRouteB, id: `${P}:beam-route:b4:scan` }],
    [`${P}:beam:c9r1-c6r10`,   'Scan 5',  sweepA.id,      9,  1,  6, 10, { ...scanRouteA,   id: `${P}:beam-route:b5:scan` }],
    [`${P}:beam:c11r1-c8r10`,  'Scan 6',  sweepB.id,     11,  1,  8, 10, { ...scanRouteB,   id: `${P}:beam-route:b6:scan` }],
    [`${P}:beam:c13r1-c10r10`, 'Scan 7',  phraseMotion.id,13,  1, 10, 10, { ...phraseRouteA, id: `${P}:beam-route:b7:scan` }],
    [`${P}:beam:c15r1-c12r10`, 'Scan 8',  hatDetail.id,  15,  1, 12, 10, { ...phraseRouteB, id: `${P}:beam-route:b8:scan` }],
  ]

  const beams: LaserDmxMatrixBeam[] = beamDefs.map(
    ([id, name, groupId, oc, or_, tc, tr, beamRoute]) => ({
      ...mkGridBeam(id, name, groupId, oc, or_, tc, tr, app),
      modulationRoutes: [beamRoute],
    })
  )

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices(beams),
    groups: [sweepA, sweepB, phraseMotion, hatDetail],
    globalModulationRoutes: [
      mkRoute(`${P}:global:downbeat-dimmer`, 'downbeat', 'masterDimmer', 'trigger',
        0.2, 0, 0.18, 'easeOut', 0, 0.2),
    ],
    output: mkOutput({
      masterDimmer:     0.86,
      blackout:         false,
      safetyClamp:      0.9,
      backgroundFade:   0.19,
      beamPersistence:  0.52,
      globalBeamWidth:  0.9,
      globalGlow:       0.62,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled:         true,
      density:         0.18,
      opacity:         0.28,
      noiseScale:      1.25,
      driftSpeed:      0.13,
      driftDirection:  0.65,
      turbulence:      0.18,
      diffusion:       0.24,
      dissipation:     0.65,
      beamScatter:     0.3,
      colorAbsorption: 0.17,
      quality:         'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 8: Laser Cage ──────────────────────────────────────────────────────

function createLaserCageSettings(): LaserDmxBeamMatrixSettings {
  const P = 'laser-cage'

  const horizGrid = mkGroup(
    `${P}:group:horiz-grid`,
    'Horizontal Grid',
    mkColor(255, 30, 35, 20, 1),
    [
      mkRoute(`${P}:route:bass-width`, 'nBass', 'beamWidth', 'set',
        0.6, 0.8, 1.5, 'easeOut', 0.04, 0.25, { smoothing: 0.3 }),
    ],
  )

  const vertGrid = mkGroup(
    `${P}:group:vert-grid`,
    'Vertical Grid',
    mkColor(25, 90, 255, 35, 1),
    [
      // white flash is not supported at group scope; trigger dimmer gives the punch
      mkRoute(`${P}:route:snare-dimmer`, 'snareHit', 'dimmer', 'trigger',
        0.7, 0.35, 1, 'easeOut', 0, 0.2),
    ],
  )

  const diagBraces = mkGroup(
    `${P}:group:diag-braces`,
    'Diagonal Braces',
    mkColor(180, 30, 235, 25, 1),
    [
      mkRoute(`${P}:route:energy-dimmer`, 'energy', 'dimmer', 'set',
        0.7, 0.35, 1, 'easeOut', 0.06, 0.3, { smoothing: 0.35 }),
    ],
  )

  const dropImpactGroup = mkGroup(
    `${P}:group:drop-impact`,
    'Drop Impact',
    mkColor(255, 110, 20, 90, 1),
    [
      mkRoute(`${P}:route:phrase8-glow`, 'phrase8Hit', 'beamGlow', 'trigger',
        0.65, 0, 0.65, 'easeOut', 0, 0.28),
    ],
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.68, shutterOpen: true, width: 0.9, focus: 0.94,
    strobeRate: 0, flickerAmount: 0, divergence: 0.03, glow: 0.55,
    geometry: 'line',
  }

  const beams: LaserDmxMatrixBeam[] = [
    // Horizontal — 4 beams
    mkGridBeam(`${P}:beam:horiz:c1r2-c15r2`,  'Horiz R2', horizGrid.id,  1, 2, 15, 2, app),
    mkGridBeam(`${P}:beam:horiz:c1r4-c15r4`,  'Horiz R4', horizGrid.id,  1, 4, 15, 4, app),
    mkGridBeam(`${P}:beam:horiz:c1r6-c15r6`,  'Horiz R6', horizGrid.id,  1, 6, 15, 6, app),
    mkGridBeam(`${P}:beam:horiz:c1r8-c15r8`,  'Horiz R8', horizGrid.id,  1, 8, 15, 8, app),
    // Vertical — 4 beams
    mkGridBeam(`${P}:beam:vert:c3r1-c3r10`,   'Vert C3',  vertGrid.id,   3,  1,  3, 10, app),
    mkGridBeam(`${P}:beam:vert:c6r1-c6r10`,   'Vert C6',  vertGrid.id,   6,  1,  6, 10, app),
    mkGridBeam(`${P}:beam:vert:c10r1-c10r10`, 'Vert C10', vertGrid.id,  10,  1, 10, 10, app),
    mkGridBeam(`${P}:beam:vert:c13r1-c13r10`, 'Vert C13', vertGrid.id,  13,  1, 13, 10, app),
    // Diagonal braces — 4 beams
    mkGridBeam(`${P}:beam:diag:c1r1-c15r10`,  'Diag TL',  diagBraces.id,  1,  1, 15, 10, app),
    mkGridBeam(`${P}:beam:diag:c15r1-c1r10`,  'Diag TR',  diagBraces.id, 15,  1,  1, 10, app),
    mkGridBeam(`${P}:beam:diag:c1r10-c15r1`,  'Diag BL',  diagBraces.id,  1, 10, 15,  1, app),
    mkGridBeam(`${P}:beam:diag:c15r10-c1r1`,  'Diag BR',  diagBraces.id, 15, 10,  1,  1, app),
    // Drop Impact group has no dedicated beams — accents come via global routes
  ]

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices(beams),
    groups: [horizGrid, vertGrid, diagBraces, dropImpactGroup],
    globalModulationRoutes: [
      mkRoute(`${P}:global:energy-dimmer`, 'energy', 'masterDimmer', 'set',
        0.6, 0.55, 1, 'easeOut', 0.05, 0.3, { smoothing: 0.35 }),
      // beamGlow is not in applyGlobalRoute dispatch; fogBeamScatter delivers a visible impact scatter
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.55, 0, 0.55, 'easeOut', 0, 0.22),
      // beamWidth is not in applyGlobalRoute dispatch; fogTurbulence creates the impact swell
      mkRoute(`${P}:global:drop-turbulence`, 'dropImpact', 'fogTurbulence', 'trigger',
        0.65, 0, 0.55, 'easeOut', 0, 0.32),
      mkRoute(`${P}:global:drop-scatter`, 'dropImpact', 'fogBeamScatter', 'trigger',
        0.6, 0, 0.6, 'easeOut', 0, 0.35),
    ],
    output: mkOutput({
      masterDimmer:     0.9,
      blackout:         false,
      safetyClamp:      0.92,
      backgroundFade:   0.16,
      beamPersistence:  0.6,
      globalBeamWidth:  1,
      globalGlow:       0.7,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled:         true,
      density:         0.32,
      opacity:         0.42,
      noiseScale:      1,
      driftSpeed:      0.1,
      driftDirection:  0.15,
      turbulence:      0.22,
      diffusion:       0.34,
      dissipation:     0.58,
      beamScatter:     0.46,
      colorAbsorption: 0.18,
      quality:         'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 9: Build Ladder ────────────────────────────────────────────────────

function createBuildLadderSettings(): LaserDmxBeamMatrixSettings {
  const P = 'build-ladder'

  // Spectrum per row, index 0 = row 10 (bottom, first to dim), index 9 = row 1 (top, last)
  const SPECTRUM: LaserDmxMatrixBeamColor[] = [
    mkColor(255,  20,   0),  // row 10: red
    mkColor(255,  90,   0),  // row 9: orange
    mkColor(255, 160,   0),  // row 8: amber
    mkColor(210, 210,   0),  // row 7: yellow
    mkColor(100, 220,   0),  // row 6: yellow-green
    mkColor(  0, 210,  50),  // row 5: green
    mkColor(  0, 190, 140),  // row 4: seafoam
    mkColor(  0, 160, 230),  // row 3: sky-blue
    mkColor( 40,  60, 255),  // row 2: blue
    mkColor(160,   0, 255),  // row 1: purple
  ]
  const THRESHOLDS = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]

  const progression = mkGroup(
    `${P}:group:build-progression`,
    'Build Progression',
    mkColor(200, 200, 255),
    [
      // white at group scope → beamGlow (group scope only accepts beamGlow)
      mkRoute(`${P}:route:build-glow`, 'buildProgress', 'beamGlow', 'set',
        0.9, 0, 0.8, 'easeOut', 0.08, 0.35, { smoothing: 0.3 }),
      mkRoute(`${P}:route:downbeat-glow`, 'downbeat', 'beamGlow', 'trigger',
        0.75, 0, 0.6, 'easeOut', 0, 0.18),
    ],
  )

  const beams: LaserDmxMatrixBeam[] = []
  for (let i = 0; i < 10; i++) {
    const gridRow = 10 - i        // 10 (bottom) → 1 (top)
    const zigLeft = i % 2 === 0   // even rows: L→R, odd: R→L
    const width = 0.9 + (i / 9) * 0.3  // 0.9 → 1.2
    const app: LaserDmxMatrixBeamAppearance = {
      dimmer: 0.05, shutterOpen: true, width,
      focus: 0.85, strobeRate: 0, flickerAmount: 0,
      divergence: 0.04, glow: 0.3, geometry: 'line',
    }
    beams.push({
      ...mkGridBeam(
        `${P}:beam:row${gridRow}`, `Row ${gridRow}`, progression.id,
        zigLeft ? 1 : 15, gridRow, zigLeft ? 15 : 1, gridRow, app,
      ),
      useGroupColor: false,
      color: SPECTRUM[i],
      modulationRoutes: [
        mkRoute(
          `${P}:beam-route:row${gridRow}:dimmer`,
          'buildProgress', 'dimmer', 'set',
          1, 0, 1, 'easeOut', 0.03, 0.4,
          { smoothing: 0.2, threshold: THRESHOLDS[i] },
        ),
      ],
    })
  }

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices(beams),
    groups: [progression],
    globalModulationRoutes: [
      mkRoute(`${P}:global:build-fog`, 'buildProgress', 'fogDensity', 'set',
        0.65, 0.1, 0.6, 'easeOut', 0.2, 0.8, { smoothing: 0.5 }),
      mkRoute(`${P}:global:drop-dimmer`, 'dropImpact', 'masterDimmer', 'trigger',
        0.9, 0.65, 1, 'easeOut', 0, 0.28),
      mkRoute(`${P}:global:drop-turbulence`, 'dropImpact', 'fogTurbulence', 'trigger',
        0.8, 0, 0.7, 'easeOut', 0, 0.35),
    ],
    output: mkOutput({
      masterDimmer:     0.8,
      blackout:         false,
      safetyClamp:      0.9,
      backgroundFade:   0.3,
      beamPersistence:  0.55,
      globalBeamWidth:  1,
      globalGlow:       0.4,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled: true, density: 0.15, opacity: 0.35,
      noiseScale: 1, driftSpeed: 0.05, driftDirection: 0,
      turbulence: 0.1, diffusion: 0.3, dissipation: 0.65,
      beamScatter: 0.3, colorAbsorption: 0.1, quality: 'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 10: Drop Starburst ─────────────────────────────────────────────────

function createDropStarburstSettings(): LaserDmxBeamMatrixSettings {
  const P = 'drop-starburst'

  const dropBurst = mkGroup(
    `${P}:group:drop-burst`,
    'Drop Burst',
    mkColor(255, 140, 0),
    [
      mkRoute(`${P}:route:drop-dimmer`, 'dropImpact', 'dimmer', 'trigger',
        1, 0.1, 1, 'easeOut', 0, 0.35),
      mkRoute(`${P}:route:drop-width`, 'dropImpact', 'beamWidth', 'trigger',
        0.7, 0.9, 1.8, 'easeOut', 0, 0.28),
      mkRoute(`${P}:route:drop-glow`, 'dropImpact', 'beamGlow', 'trigger',
        0.8, 0, 0.7, 'easeOut', 0, 0.3),
    ],
  )

  const downbeatBurst = mkGroup(
    `${P}:group:downbeat-burst`,
    'Downbeat Burst',
    mkColor(80, 40, 255),
    [
      mkRoute(`${P}:route:downbeat-dimmer`, 'downbeat', 'dimmer', 'trigger',
        1, 0.15, 1, 'easeOut', 0, 0.3),
      mkRoute(`${P}:route:downbeat-diverge`, 'downbeat', 'beamDivergence', 'trigger',
        0.65, 0.08, 0.45, 'easeOut', 0, 0.25),
      mkRoute(`${P}:route:energy-glow`, 'energy', 'beamGlow', 'set',
        0.6, 0.1, 0.6, 'easeOut', 0.05, 0.3, { smoothing: 0.35 }),
    ],
  )

  // 4 corner origins × 4 fanning stage targets = 16 volumetric cones
  const ORIGINS: [number, number, string][] = [
    [ 1,  1, 'tl'],
    [15,  1, 'tr'],
    [ 1, 10, 'bl'],
    [15, 10, 'br'],
  ]
  const STAGE_TARGETS: [number, number, number, string][] = [
    [-0.2, -0.15, 1.0, 'out-left'],
    [ 1.2, -0.15, 1.0, 'out-right'],
    [ 0.25,  0.7, 0.8, 'mid-left'],
    [ 0.75,  0.7, 0.8, 'mid-right'],
  ]

  const coneApp: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.05, shutterOpen: true, width: 1.4,
    focus: 0.4, strobeRate: 0, flickerAmount: 0,
    divergence: 0.35, glow: 0.5, geometry: 'volumetricCone',
  }

  const beams: LaserDmxMatrixBeam[] = []
  let beamIdx = 0
  for (const [origCol, origRow, originSlug] of ORIGINS) {
    for (const [tx, ty, tz, targetSlug] of STAGE_TARGETS) {
      const groupId = beamIdx % 2 === 0 ? dropBurst.id : downbeatBurst.id
      beams.push(mkStageBeam(
        `${P}:beam:${originSlug}-${targetSlug}`,
        `${originSlug.toUpperCase()} → ${targetSlug}`,
        groupId, origCol, origRow, tx, ty, tz, coneApp,
      ))
      beamIdx++
    }
  }

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices(beams),
    groups: [dropBurst, downbeatBurst],
    globalModulationRoutes: [
      mkRoute(`${P}:global:drop-master`, 'dropImpact', 'masterDimmer', 'trigger',
        1, 0.5, 1, 'easeOut', 0, 0.4),
      mkRoute(`${P}:global:drop-scatter`, 'dropImpact', 'fogBeamScatter', 'trigger',
        0.85, 0, 0.8, 'easeOut', 0, 0.5),
      mkRoute(`${P}:global:energy-fog`, 'energy', 'fogOpacity', 'set',
        0.6, 0.2, 0.65, 'easeOut', 0.1, 0.4, { smoothing: 0.4 }),
    ],
    output: mkOutput({
      masterDimmer:     0.85,
      blackout:         false,
      safetyClamp:      0.95,
      backgroundFade:   0.12,
      beamPersistence:  0.4,
      globalBeamWidth:  1,
      globalGlow:       0.55,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled: true, density: 0.25, opacity: 0.45,
      noiseScale: 1.2, driftSpeed: 0.12, driftDirection: 0.05,
      turbulence: 0.3, diffusion: 0.38, dissipation: 0.55,
      beamScatter: 0.5, colorAbsorption: 0.15, quality: 'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 11: Vocal Halo ─────────────────────────────────────────────────────

function createVocalHaloSettings(): LaserDmxBeamMatrixSettings {
  const P = 'vocal-halo'

  const vocalCore = mkGroup(
    `${P}:group:vocal-core`,
    'Vocal Core',
    mkColor(200, 120, 255),
    [
      mkRoute(`${P}:route:vocal-dimmer`, 'vocalActivity', 'dimmer', 'set',
        0.85, 0.15, 0.9, 'easeOut', 0.04, 0.25, { smoothing: 0.35 }),
      mkRoute(`${P}:route:vocal-width`, 'vocalActivity', 'beamWidth', 'set',
        0.5, 0.85, 1.25, 'easeOut', 0.05, 0.3, { smoothing: 0.3 }),
    ],
  )

  const haloCones = mkGroup(
    `${P}:group:halo-cones`,
    'Halo Cones',
    mkColor(255, 180, 255),
    [
      mkRoute(`${P}:route:halo-glow`, 'vocalActivity', 'beamGlow', 'set',
        0.9, 0.1, 0.85, 'easeOut', 0.06, 0.3, { smoothing: 0.4 }),
      mkRoute(`${P}:route:phrase-diverge`, 'phrase8', 'beamDivergence', 'set',
        0.7, 0.12, 0.5, 'easeInOut', 0.3, 0.6, { smoothing: 0.5 }),
    ],
  )

  const lineApp: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.3, shutterOpen: true, width: 1.0,
    focus: 0.88, strobeRate: 0, flickerAmount: 0,
    divergence: 0.05, glow: 0.5, geometry: 'line',
  }
  const coneApp: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.25, shutterOpen: true, width: 1.2,
    focus: 0.45, strobeRate: 0, flickerAmount: 0,
    divergence: 0.3, glow: 0.65, geometry: 'volumetricCone',
  }

  // 8 inward lines converging toward the stage center
  const inwardLines: LaserDmxMatrixBeam[] = [
    mkGridBeam(`${P}:beam:tl`,     'TL Inward',     vocalCore.id,  1,  1,  8,  5, lineApp),
    mkGridBeam(`${P}:beam:tr`,     'TR Inward',     vocalCore.id, 15,  1,  8,  5, lineApp),
    mkGridBeam(`${P}:beam:bl`,     'BL Inward',     vocalCore.id,  1, 10,  8,  6, lineApp),
    mkGridBeam(`${P}:beam:br`,     'BR Inward',     vocalCore.id, 15, 10,  8,  6, lineApp),
    mkGridBeam(`${P}:beam:left`,   'Left Inward',   vocalCore.id,  1,  5, 10,  5, lineApp),
    mkGridBeam(`${P}:beam:right`,  'Right Inward',  vocalCore.id, 15,  5,  6,  5, lineApp),
    mkGridBeam(`${P}:beam:top`,    'Top Inward',    vocalCore.id,  8,  1,  8,  7, lineApp),
    mkGridBeam(`${P}:beam:bottom`, 'Bottom Inward', vocalCore.id,  8, 10,  8,  4, lineApp),
  ]

  // 4 outward cones — spectralFlux sweeps targetOffsetX (per-beam; not valid at group scope)
  const HALO_DEFS: [number, number, number, string, string, boolean][] = [
    [-0.3,  0.5, 0.8, 'halo-left',   'Left Halo',   false],
    [ 1.3,  0.5, 0.8, 'halo-right',  'Right Halo',  true],
    [ 0.5, -0.3, 0.8, 'halo-top',    'Top Halo',    false],
    [ 0.5,  1.3, 0.8, 'halo-bottom', 'Bottom Halo', false],
  ]
  const outwardCones: LaserDmxMatrixBeam[] = HALO_DEFS.map(
    ([tx, ty, tz, slug, name, invert]) => ({
      ...mkStageBeam(`${P}:beam:${slug}`, name, haloCones.id, 8, 5, tx, ty, tz, coneApp),
      modulationRoutes: [
        mkRoute(
          `${P}:beam-route:${slug}:flux-offset`,
          'spectralFlux', 'targetOffsetX', 'set',
          0.5, -0.15, 0.15, 'linear', 0.02, 0.15,
          { smoothing: 0.25, invert },
        ),
      ],
    }),
  )

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices([...inwardLines, ...outwardCones]),
    groups: [vocalCore, haloCones],
    globalModulationRoutes: [
      mkRoute(`${P}:global:vocal-master`, 'vocalActivity', 'masterDimmer', 'set',
        0.5, 0.5, 1, 'easeOut', 0.06, 0.35, { smoothing: 0.45 }),
      mkRoute(`${P}:global:phrase-fog`, 'phrase8', 'fogOpacity', 'set',
        0.55, 0.15, 0.5, 'easeInOut', 0.25, 0.5, { smoothing: 0.5 }),
    ],
    output: mkOutput({
      masterDimmer:     0.82,
      blackout:         false,
      safetyClamp:      0.9,
      backgroundFade:   0.25,
      beamPersistence:  0.5,
      globalBeamWidth:  1,
      globalGlow:       0.6,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled: true, density: 0.2, opacity: 0.38,
      noiseScale: 0.9, driftSpeed: 0.08, driftDirection: 0.1,
      turbulence: 0.12, diffusion: 0.42, dissipation: 0.6,
      beamScatter: 0.38, colorAbsorption: 0.12, quality: 'medium',
    }),
    editor: mkEditor(),
  }
}

// ── Preset 12: Fog Cathedral ──────────────────────────────────────────────────

function createFogCathedralSettings(): LaserDmxBeamMatrixSettings {
  const P = 'fog-cathedral'

  const cathedralCones = mkGroup(
    `${P}:group:cathedral-cones`,
    'Cathedral Cones',
    mkColor(0, 200, 220),
    [
      mkRoute(`${P}:route:energy-dimmer`, 'energy', 'dimmer', 'set',
        0.75, 0.2, 0.9, 'easeOut', 0.1, 0.45, { smoothing: 0.45 }),
      mkRoute(`${P}:route:beat-diverge`, 'beatPhase', 'beamDivergence', 'set',
        0.5, 0.18, 0.45, 'easeInOut', 0.08, 0.25, { smoothing: 0.4 }),
    ],
  )

  const crossingAccents = mkGroup(
    `${P}:group:crossing-accents`,
    'Crossing Accents',
    mkColor(180, 210, 255),
    [
      mkRoute(`${P}:route:downbeat-dimmer`, 'downbeat', 'dimmer', 'trigger',
        0.9, 0.05, 0.85, 'easeOut', 0, 0.3),
      mkRoute(`${P}:route:bass-glow`, 'nBass', 'beamGlow', 'set',
        0.65, 0.1, 0.65, 'easeOut', 0.04, 0.28, { smoothing: 0.35 }),
    ],
  )

  // 6 tall cones, alternating cyan/emerald; useGroupColor: false per beam
  const CYAN    = mkColor(  0, 220, 255)
  const EMERALD = mkColor(  0, 200, 100)
  const CONE_POSITIONS: [number, number, string][] = [
    [ 2, 9, 'c1'], [ 5, 9, 'c2'], [ 8, 9, 'c3'],
    [11, 9, 'c4'], [13, 9, 'c5'], [15, 9, 'c6'],
  ]
  const CONE_STAGE_TARGETS: [number, number, number][] = [
    [-0.1, 0.2, 0.9],
    [ 0.25, -0.15, 1.0],
    [ 0.42, -0.2,  1.0],
    [ 0.58, -0.2,  1.0],
    [ 0.75, -0.15, 1.0],
    [ 1.1,  0.2,  0.9],
  ]
  const coneApp: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.2, shutterOpen: true, width: 1.1,
    focus: 0.35, strobeRate: 0, flickerAmount: 0,
    divergence: 0.4, glow: 0.7, geometry: 'volumetricCone',
  }
  const cathedralBeams: LaserDmxMatrixBeam[] = CONE_POSITIONS.map(
    ([origCol, origRow, slug], idx) => {
      const [tx, ty, tz] = CONE_STAGE_TARGETS[idx]
      return {
        ...mkStageBeam(
          `${P}:beam:${slug}`, `Cathedral ${idx + 1}`,
          cathedralCones.id, origCol, origRow, tx, ty, tz, coneApp,
        ),
        useGroupColor: false,
        color: idx % 2 === 0 ? CYAN : EMERALD,
      }
    },
  )

  // 4 crossing accent lines
  const accentApp: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.12, shutterOpen: true, width: 0.85,
    focus: 0.92, strobeRate: 0, flickerAmount: 0,
    divergence: 0.03, glow: 0.4, geometry: 'line',
  }
  const accentBeams: LaserDmxMatrixBeam[] = [
    mkGridBeam(`${P}:beam:diag-tl`, 'Diag TL', crossingAccents.id,  1,  1, 15, 10, accentApp),
    mkGridBeam(`${P}:beam:diag-tr`, 'Diag TR', crossingAccents.id, 15,  1,  1, 10, accentApp),
    mkGridBeam(`${P}:beam:horiz-l`, 'Horiz L', crossingAccents.id,  1,  5, 15,  6, accentApp),
    mkGridBeam(`${P}:beam:vert-c`,  'Vert C',  crossingAccents.id,  8,  1,  8, 10, accentApp),
  ]

  return {
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: withSequenceIndices([...cathedralBeams, ...accentBeams]),
    groups: [cathedralCones, crossingAccents],
    globalModulationRoutes: [
      mkRoute(`${P}:global:energy-fog-density`, 'energy', 'fogDensity', 'set',
        0.7, 0.3, 0.8, 'easeOut', 0.2, 0.6, { smoothing: 0.55 }),
      mkRoute(`${P}:global:energy-fog-opacity`, 'energy', 'fogOpacity', 'set',
        0.6, 0.35, 0.75, 'easeOut', 0.2, 0.5, { smoothing: 0.5 }),
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.5, 0, 0.45, 'easeOut', 0, 0.3),
      mkRoute(`${P}:global:bass-turbulence`, 'nBass', 'fogTurbulence', 'set',
        0.45, 0.08, 0.4, 'easeOut', 0.06, 0.35, { smoothing: 0.4 }),
    ],
    output: mkOutput({
      masterDimmer:     0.78,
      blackout:         false,
      safetyClamp:      0.88,
      backgroundFade:   0.4,
      beamPersistence:  0.65,
      globalBeamWidth:  1,
      globalGlow:       0.72,
      globalStrobeRate: 0,
    }),
    fog: mkFog({
      enabled: true, density: 0.55, opacity: 0.7,
      noiseScale: 0.7, driftSpeed: 0.04, driftDirection: 0.05,
      turbulence: 0.2, diffusion: 0.5, dissipation: 0.45,
      beamScatter: 0.65, colorAbsorption: 0.25, quality: 'high',
    }),
    editor: mkEditor(),
  }
}

// ── Sequencing helpers ────────────────────────────────────────────────────────

function mkSeqGroup(
  id: string,
  name: string,
  color: LaserDmxMatrixBeamColor,
  routes: LaserDmxModulationRoute[],
  seq: Partial<LaserDmxBeamSequence>,
): LaserDmxReactionGroup {
  return {
    id,
    name,
    enabled: true,
    muted:   false,
    soloed:  false,
    colorOverrideEnabled: true,
    color,
    sequence:       { ...DEFAULT_BEAM_SEQUENCE, ...seq },
    launch:         DEFAULT_LAUNCH_SETTINGS,
    maxActiveBeams: 0,
    modulationRoutes: routes,
  }
}

function mkMotionBeam(
  id: string,
  name: string,
  groupId: string,
  origCol: number, origRow: number,
  targCol: number, targRow: number,
  appearance: LaserDmxMatrixBeamAppearance,
  motion: Partial<LaserDmxBeamMotion>,
): LaserDmxMatrixBeam {
  return {
    id,
    name,
    enabled:       true,
    sequenceIndex: 0,
    origin:        { column: origCol, row: origRow, z: 0 },
    target:        { kind: 'grid', column: targCol, row: targRow, z: 0 },
    groupId,
    useGroupColor: true,
    color:         mkColor(255, 255, 255),
    appearance,
    motion:        { ...DEFAULT_BEAM_MOTION, ...motion },
    modulationRoutes: [],
  }
}

// ── Preset 13: Bass Fan ───────────────────────────────────────────────────────

function createBassFanSettings(): LaserDmxBeamMatrixSettings {
  const P = 'bass-fan'

  // All beams fire together, grow motion driven by beat + bass
  const bassFan = mkSeqGroup(
    `${P}:group:bass-fan`,
    'Bass Fan',
    mkColor(0, 210, 255, 30, 1),
    [
      mkRoute(`${P}:route:beat-dimmer`, 'beatHit', 'dimmer', 'trigger',
        1, 0.18, 1, 'easeOut', 0, 0.22),
      mkRoute(`${P}:route:bass-width`, 'nBass', 'beamWidth', 'set',
        0.65, 0.8, 1.6, 'easeOut', 0.03, 0.2, { smoothing: 0.25 }),
      mkRoute(`${P}:route:bass-glow`, 'nBass', 'beamGlow', 'set',
        0.5, 0.2, 0.7, 'easeOut', 0.03, 0.2, { smoothing: 0.2 }),
    ],
    { enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 0.8 },
  )

  // Downbeat accent group — wider fan on the one
  const downbeatAccent = mkSeqGroup(
    `${P}:group:downbeat-accent`,
    'Downbeat Accent',
    mkColor(0, 240, 200, 60, 1),
    [
      mkRoute(`${P}:route:downbeat-dimmer`, 'downbeat', 'dimmer', 'trigger',
        1, 0.15, 1, 'easeOut', 0, 0.3),
      mkRoute(`${P}:route:downbeat-width`, 'downbeat', 'beamWidth', 'trigger',
        0.8, 0.9, 2.2, 'easeOut', 0, 0.28),
      mkRoute(`${P}:route:downbeat-glow`, 'downbeat', 'beamGlow', 'trigger',
        0.9, 0, 0.9, 'easeOut', 0, 0.25),
    ],
    { enabled: true, mode: 'all', stepsPerBeat: 0.25, stepGate: 0.9 },
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.7, shutterOpen: true, width: 1.1, focus: 0.72,
    strobeRate: 0, flickerAmount: 0, divergence: 0.18, glow: 0.62,
    geometry: 'volumetricCone',
  }
  const growMotion: Partial<LaserDmxBeamMotion> = { mode: 'grow', beatsPerTravel: 0.5, easing: 'easeOut', headGlow: 0.6 }

  const beams = withSequenceIndices([
    mkMotionBeam(`${P}:beam:c1r10-c8r1`,  'Fan L1', bassFan.id,       1, 10, 8,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c4r10-c8r1`,  'Fan L2', bassFan.id,       4, 10, 8,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c8r10-c8r1`,  'Fan C',  downbeatAccent.id,8, 10, 8,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c12r10-c8r1`, 'Fan R2', bassFan.id,      12, 10, 8,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c15r10-c8r1`, 'Fan R1', bassFan.id,      15, 10, 8,  1, app, growMotion),
  ])

  return {
    selectedBeamIds: [], selectedGroupId: null,
    beams,
    groups: [bassFan, downbeatAccent],
    globalModulationRoutes: [
      mkRoute(`${P}:global:bass-fog`, 'nBass', 'fogDensity', 'set',
        0.55, 0.1, 0.5, 'easeOut', 0.05, 0.3, { smoothing: 0.3 }),
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.6, 0, 0.5, 'easeOut', 0, 0.25),
    ],
    output: mkOutput({ masterDimmer: 0.88, blackout: false, safetyClamp: 0.9, backgroundFade: 0.2, beamPersistence: 0.38, globalBeamWidth: 1, globalGlow: 0.6, globalStrobeRate: 0 }),
    fog: mkFog({ enabled: true, density: 0.22, opacity: 0.32, noiseScale: 1.1, driftSpeed: 0.1, driftDirection: 0.1, turbulence: 0.15, diffusion: 0.28, dissipation: 0.6, beamScatter: 0.3, colorAbsorption: 0.18, quality: 'medium' }),
    editor: mkEditor(),
  }
}

// ── Preset 14: Snare Crossfire Seq ────────────────────────────────────────────

function createSnareCrossFireSeqSettings(): LaserDmxBeamMatrixSettings {
  const P = 'snare-crossfire-seq'

  // Left group: alternate (even steps) — projectile motion
  const leftGroup = mkSeqGroup(
    `${P}:group:left`,
    'Left Crossfire',
    mkColor(0, 100, 255, 40, 1),
    [
      mkRoute(`${P}:route:snare-dimmer`, 'snareHit', 'dimmer', 'trigger',
        1, 0.06, 1, 'easeOut', 0, 0.22),
      mkRoute(`${P}:route:snare-glow`, 'snareHit', 'beamGlow', 'trigger',
        0.7, 0, 0.6, 'easeOut', 0, 0.14),
    ],
    { enabled: true, mode: 'alternate', stepsPerBeat: 1, stepGate: 0.6 },
  )

  // Right group: alternate (odd steps via phaseSpread offset) — projectile motion
  const rightGroup = mkSeqGroup(
    `${P}:group:right`,
    'Right Crossfire',
    mkColor(255, 30, 80, 40, 1),
    [
      mkRoute(`${P}:route:kick-dimmer`, 'kickHit', 'dimmer', 'trigger',
        1, 0.08, 1, 'easeOut', 0, 0.18),
      mkRoute(`${P}:route:kick-glow`, 'kickHit', 'beamGlow', 'trigger',
        0.55, 0, 0.5, 'easeOut', 0, 0.14),
    ],
    { enabled: true, mode: 'alternate', stepsPerBeat: 1, stepGate: 0.6, phaseSpread: 0.5 },
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.22, shutterOpen: true, width: 0.9, focus: 0.94,
    strobeRate: 0, flickerAmount: 0, divergence: 0.04, glow: 0.55,
    geometry: 'line',
  }
  const projMotion: Partial<LaserDmxBeamMotion> = { mode: 'projectile', beatsPerTravel: 0.5, tailLength: 0.38, easing: 'easeOut', headGlow: 0.5, retrigger: 'restart' }

  const beams = withSequenceIndices([
    mkMotionBeam(`${P}:beam:l1`,  'L1', leftGroup.id,   1, 10, 15,  1, app, projMotion),
    mkMotionBeam(`${P}:beam:l2`,  'L2', leftGroup.id,   1,  7, 15,  4, app, projMotion),
    mkMotionBeam(`${P}:beam:l3`,  'L3', leftGroup.id,   1,  4, 15,  7, app, projMotion),
    mkMotionBeam(`${P}:beam:l4`,  'L4', leftGroup.id,   1,  1, 15, 10, app, projMotion),
    mkMotionBeam(`${P}:beam:r1`,  'R1', rightGroup.id, 15, 10,  1,  1, app, projMotion),
    mkMotionBeam(`${P}:beam:r2`,  'R2', rightGroup.id, 15,  7,  1,  4, app, projMotion),
    mkMotionBeam(`${P}:beam:r3`,  'R3', rightGroup.id, 15,  4,  1,  7, app, projMotion),
    mkMotionBeam(`${P}:beam:r4`,  'R4', rightGroup.id, 15,  1,  1, 10, app, projMotion),
  ])

  return {
    selectedBeamIds: [], selectedGroupId: null,
    beams,
    groups: [leftGroup, rightGroup],
    globalModulationRoutes: [
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.5, 0, 0.4, 'easeOut', 0, 0.22),
    ],
    output: mkOutput({ masterDimmer: 0.9, blackout: false, safetyClamp: 0.92, backgroundFade: 0.18, beamPersistence: 0.35, globalBeamWidth: 1, globalGlow: 0.58, globalStrobeRate: 0 }),
    fog: mkFog({ enabled: true, density: 0.15, opacity: 0.24, noiseScale: 1.2, driftSpeed: 0.1, driftDirection: 0.3, turbulence: 0.14, diffusion: 0.2, dissipation: 0.68, beamScatter: 0.28, colorAbsorption: 0.15, quality: 'medium' }),
    editor: mkEditor(),
  }
}

// ── Preset 15: Center-Out Chase ───────────────────────────────────────────────

function createCenterOutChaseSettings(): LaserDmxBeamMatrixSettings {
  const P = 'center-out-chase'

  const chaseGroup = mkSeqGroup(
    `${P}:group:chase`,
    'Center-Out Chase',
    mkColor(80, 255, 160, 20, 1),
    [
      mkRoute(`${P}:route:energy-dimmer`, 'energy', 'dimmer', 'set',
        0.85, 0.1, 0.9, 'easeOut', 0.04, 0.25, { smoothing: 0.3 }),
      mkRoute(`${P}:route:energy-width`, 'energy', 'beamWidth', 'set',
        0.5, 0.75, 1.4, 'easeOut', 0.04, 0.22, { smoothing: 0.28 }),
    ],
    // centerOut, 1/8-note steps, resets on each downbeat
    { enabled: true, mode: 'centerOut', stepsPerBeat: 2, stepGate: 0.65, resetOnDownbeat: true },
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.6, shutterOpen: true, width: 1.0, focus: 0.88,
    strobeRate: 0, flickerAmount: 0, divergence: 0.06, glow: 0.58,
    geometry: 'line',
  }
  const growMotion: Partial<LaserDmxBeamMotion> = { mode: 'grow', beatsPerTravel: 0.5, easing: 'easeOut', headGlow: 0.55 }

  // 8 beams arranged symmetrically from center outward
  const beams = withSequenceIndices([
    mkMotionBeam(`${P}:beam:c8r1-c8r10`,  'Vert C',  chaseGroup.id,  8,  1,  8, 10, app, growMotion),
    mkMotionBeam(`${P}:beam:c1r5-c15r5`,  'Horiz C', chaseGroup.id,  1,  5, 15,  5, app, growMotion),
    mkMotionBeam(`${P}:beam:c5r1-c5r10`,  'Vert L',  chaseGroup.id,  5,  1,  5, 10, app, growMotion),
    mkMotionBeam(`${P}:beam:c11r1-c11r10`, 'Vert R', chaseGroup.id, 11,  1, 11, 10, app, growMotion),
    mkMotionBeam(`${P}:beam:c3r10-c13r1`, 'Diag 1',  chaseGroup.id,  3, 10, 13,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c13r10-c3r1`, 'Diag 2',  chaseGroup.id, 13, 10,  3,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c1r1-c15r10`, 'Diag 3',  chaseGroup.id,  1,  1, 15, 10, app, growMotion),
    mkMotionBeam(`${P}:beam:c15r1-c1r10`, 'Diag 4',  chaseGroup.id, 15,  1,  1, 10, app, growMotion),
  ])

  return {
    selectedBeamIds: [], selectedGroupId: null,
    beams,
    groups: [chaseGroup],
    globalModulationRoutes: [
      mkRoute(`${P}:global:energy-fog`, 'energy', 'fogDensity', 'set',
        0.45, 0.1, 0.4, 'easeOut', 0.08, 0.4, { smoothing: 0.4 }),
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.5, 0, 0.45, 'easeOut', 0, 0.22),
    ],
    output: mkOutput({ masterDimmer: 0.86, blackout: false, safetyClamp: 0.9, backgroundFade: 0.22, beamPersistence: 0.42, globalBeamWidth: 1, globalGlow: 0.62, globalStrobeRate: 0 }),
    fog: mkFog({ enabled: true, density: 0.2, opacity: 0.3, noiseScale: 1.1, driftSpeed: 0.09, driftDirection: 0.2, turbulence: 0.14, diffusion: 0.26, dissipation: 0.62, beamScatter: 0.32, colorAbsorption: 0.16, quality: 'medium' }),
    editor: mkEditor(),
  }
}

// ── Preset 16: Drop Burst Seq ─────────────────────────────────────────────────

function createDropBurstSeqSettings(): LaserDmxBeamMatrixSettings {
  const P = 'drop-burst-seq'

  const burstGroup = mkSeqGroup(
    `${P}:group:burst`,
    'Drop Burst',
    mkColor(255, 120, 0, 50, 1),
    [
      mkRoute(`${P}:route:drop-dimmer`, 'dropImpact', 'dimmer', 'trigger',
        1, 0.08, 1, 'easeOut', 0, 0.4),
      mkRoute(`${P}:route:energy-glow`, 'energy', 'beamGlow', 'set',
        0.65, 0.15, 0.75, 'easeOut', 0.04, 0.3, { smoothing: 0.35 }),
      mkRoute(`${P}:route:bass-diverge`, 'nBass', 'beamDivergence', 'set',
        0.6, 0.1, 0.55, 'easeOut', 0.03, 0.22, { smoothing: 0.25 }),
    ],
    // All at once, every quarter note — full-matrix on drop
    { enabled: true, mode: 'forward', stepsPerBeat: 1, stepGate: 0.75 },
  )

  const coneApp: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.1, shutterOpen: true, width: 1.3, focus: 0.42,
    strobeRate: 0, flickerAmount: 0, divergence: 0.38, glow: 0.6,
    geometry: 'volumetricCone',
  }
  const projMotion: Partial<LaserDmxBeamMotion> = { mode: 'projectile', beatsPerTravel: 0.25, tailLength: 0.4, headGlow: 0.8, easing: 'easeOut' }

  const beams = withSequenceIndices([
    mkMotionBeam(`${P}:beam:c1r1-c15r10`,  'TL', burstGroup.id,  1,  1, 15, 10, coneApp, projMotion),
    mkMotionBeam(`${P}:beam:c8r1-c8r10`,   'TC', burstGroup.id,  8,  1,  8, 10, coneApp, projMotion),
    mkMotionBeam(`${P}:beam:c15r1-c1r10`,  'TR', burstGroup.id, 15,  1,  1, 10, coneApp, projMotion),
    mkMotionBeam(`${P}:beam:c1r10-c15r1`,  'BL', burstGroup.id,  1, 10, 15,  1, coneApp, projMotion),
    mkMotionBeam(`${P}:beam:c8r10-c8r1`,   'BC', burstGroup.id,  8, 10,  8,  1, coneApp, projMotion),
    mkMotionBeam(`${P}:beam:c15r10-c1r1`,  'BR', burstGroup.id, 15, 10,  1,  1, coneApp, projMotion),
    mkMotionBeam(`${P}:beam:c1r5-c15r6`,   'HL', burstGroup.id,  1,  5, 15,  6, coneApp, projMotion),
    mkMotionBeam(`${P}:beam:c15r5-c1r6`,   'HR', burstGroup.id, 15,  5,  1,  6, coneApp, projMotion),
  ])

  return {
    selectedBeamIds: [], selectedGroupId: null,
    beams,
    groups: [burstGroup],
    globalModulationRoutes: [
      mkRoute(`${P}:global:drop-master`, 'dropImpact', 'masterDimmer', 'trigger',
        1, 0.45, 1, 'easeOut', 0, 0.45),
      mkRoute(`${P}:global:drop-scatter`, 'dropImpact', 'fogBeamScatter', 'trigger',
        0.8, 0, 0.75, 'easeOut', 0, 0.5),
      mkRoute(`${P}:global:energy-fog`, 'energy', 'fogOpacity', 'set',
        0.55, 0.15, 0.6, 'easeOut', 0.08, 0.4, { smoothing: 0.4 }),
    ],
    output: mkOutput({ masterDimmer: 0.88, blackout: false, safetyClamp: 0.95, backgroundFade: 0.14, beamPersistence: 0.35, globalBeamWidth: 1.1, globalGlow: 0.65, globalStrobeRate: 0 }),
    fog: mkFog({ enabled: true, density: 0.28, opacity: 0.45, noiseScale: 1.15, driftSpeed: 0.12, driftDirection: 0.1, turbulence: 0.28, diffusion: 0.35, dissipation: 0.52, beamScatter: 0.5, colorAbsorption: 0.18, quality: 'medium' }),
    editor: mkEditor(),
  }
}

// ── Preset 17: Phrase Scanner ─────────────────────────────────────────────────

function createPhraseScannerSettings(): LaserDmxBeamMatrixSettings {
  const P = 'phrase-scanner'

  // Forward scanners, all active together
  const scanFwd = mkSeqGroup(
    `${P}:group:fwd`,
    'Scan Forward',
    mkColor(0, 220, 255, 25, 1),
    [
      mkRoute(`${P}:route:beat-glow`, 'beat', 'beamGlow', 'trigger',
        0.3, 0, 0.3, 'easeOut', 0, 0.18),
    ],
    { enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 0.85 },
  )

  // Reverse scanners — alternate phrase pattern via trigger routing
  const scanRev = mkSeqGroup(
    `${P}:group:rev`,
    'Scan Reverse',
    mkColor(255, 160, 0, 25, 1),
    [
      mkRoute(`${P}:route:downbeat-glow`, 'downbeat', 'beamGlow', 'trigger',
        0.45, 0, 0.45, 'easeOut', 0, 0.22),
    ],
    { enabled: true, mode: 'all', stepsPerBeat: 1, stepGate: 0.85 },
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.72, shutterOpen: true, width: 0.85, focus: 0.95,
    strobeRate: 0, flickerAmount: 0, divergence: 0.03, glow: 0.5,
    geometry: 'line',
  }
  const fwdMotion: Partial<LaserDmxBeamMotion> = { mode: 'scanner', beatsPerTravel: 1, tailLength: 0.2, direction: 'forward', easing: 'easeInOut' }
  const revMotion: Partial<LaserDmxBeamMotion> = { mode: 'scanner', beatsPerTravel: 1, tailLength: 0.2, direction: 'reverse', easing: 'easeInOut' }

  const beams = withSequenceIndices([
    mkMotionBeam(`${P}:beam:f1`, 'Fwd 1', scanFwd.id,  1,  2, 15,  2, app, fwdMotion),
    mkMotionBeam(`${P}:beam:f2`, 'Fwd 2', scanFwd.id,  1,  4, 15,  4, app, fwdMotion),
    mkMotionBeam(`${P}:beam:f3`, 'Fwd 3', scanFwd.id,  1,  6, 15,  6, app, fwdMotion),
    mkMotionBeam(`${P}:beam:f4`, 'Fwd 4', scanFwd.id,  1,  8, 15,  8, app, fwdMotion),
    mkMotionBeam(`${P}:beam:r1`, 'Rev 1', scanRev.id, 15,  3,  1,  3, app, revMotion),
    mkMotionBeam(`${P}:beam:r2`, 'Rev 2', scanRev.id, 15,  5,  1,  5, app, revMotion),
    mkMotionBeam(`${P}:beam:r3`, 'Rev 3', scanRev.id, 15,  7,  1,  7, app, revMotion),
    mkMotionBeam(`${P}:beam:r4`, 'Rev 4', scanRev.id, 15,  9,  1,  9, app, revMotion),
  ])

  return {
    selectedBeamIds: [], selectedGroupId: null,
    beams,
    groups: [scanFwd, scanRev],
    globalModulationRoutes: [
      mkRoute(`${P}:global:phrase8-master`, 'phrase8Hit', 'masterDimmer', 'trigger',
        0.3, 0.65, 1, 'easeOut', 0, 0.3),
      mkRoute(`${P}:global:energy-fog`, 'energy', 'fogDensity', 'set',
        0.4, 0.12, 0.4, 'easeOut', 0.08, 0.4, { smoothing: 0.4 }),
    ],
    output: mkOutput({ masterDimmer: 0.86, blackout: false, safetyClamp: 0.9, backgroundFade: 0.18, beamPersistence: 0.5, globalBeamWidth: 0.92, globalGlow: 0.6, globalStrobeRate: 0 }),
    fog: mkFog({ enabled: true, density: 0.18, opacity: 0.28, noiseScale: 1.25, driftSpeed: 0.11, driftDirection: 0.55, turbulence: 0.16, diffusion: 0.22, dissipation: 0.66, beamScatter: 0.3, colorAbsorption: 0.15, quality: 'medium' }),
    editor: mkEditor(),
  }
}

// ── Preset 18: Outside-In Collapse ────────────────────────────────────────────

function createOutsideInCollapseSettings(): LaserDmxBeamMatrixSettings {
  const P = 'outside-in-collapse'

  const collapseGroup = mkSeqGroup(
    `${P}:group:collapse`,
    'Outside-In',
    mkColor(255, 40, 120, 35, 1),
    [
      mkRoute(`${P}:route:snare-dimmer`, 'snareHit', 'dimmer', 'trigger',
        1, 0.06, 1, 'easeOut', 0, 0.2),
      mkRoute(`${P}:route:energy-glow`, 'energy', 'beamGlow', 'set',
        0.55, 0.12, 0.65, 'easeOut', 0.04, 0.25, { smoothing: 0.3 }),
    ],
    { enabled: true, mode: 'outsideIn', stepsPerBeat: 1, stepGate: 0.55 },
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.35, shutterOpen: true, width: 1, focus: 0.9,
    strobeRate: 0, flickerAmount: 0, divergence: 0.05, glow: 0.55,
    geometry: 'line',
  }
  const projMotion: Partial<LaserDmxBeamMotion> = { mode: 'projectile', beatsPerTravel: 0.5, tailLength: 0.35, easing: 'easeIn', headGlow: 0.45, retrigger: 'restart' }

  const beams = withSequenceIndices([
    mkMotionBeam(`${P}:beam:c1r10-c15r1`,  'OI-1', collapseGroup.id,  1, 10, 15,  1, app, projMotion),
    mkMotionBeam(`${P}:beam:c15r10-c1r1`,  'OI-2', collapseGroup.id, 15, 10,  1,  1, app, projMotion),
    mkMotionBeam(`${P}:beam:c3r10-c13r2`,  'OI-3', collapseGroup.id,  3, 10, 13,  2, app, projMotion),
    mkMotionBeam(`${P}:beam:c13r10-c3r2`,  'OI-4', collapseGroup.id, 13, 10,  3,  2, app, projMotion),
    mkMotionBeam(`${P}:beam:c5r10-c11r3`,  'OI-5', collapseGroup.id,  5, 10, 11,  3, app, projMotion),
    mkMotionBeam(`${P}:beam:c11r10-c5r3`,  'OI-6', collapseGroup.id, 11, 10,  5,  3, app, projMotion),
    mkMotionBeam(`${P}:beam:c7r10-c9r4`,   'OI-7', collapseGroup.id,  7, 10,  9,  4, app, projMotion),
    mkMotionBeam(`${P}:beam:c9r10-c7r4`,   'OI-8', collapseGroup.id,  9, 10,  7,  4, app, projMotion),
  ])

  return {
    selectedBeamIds: [], selectedGroupId: null,
    beams,
    groups: [collapseGroup],
    globalModulationRoutes: [
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.55, 0, 0.45, 'easeOut', 0, 0.22),
      mkRoute(`${P}:global:energy-fog`, 'energy', 'fogOpacity', 'set',
        0.45, 0.1, 0.4, 'easeOut', 0.08, 0.4, { smoothing: 0.4 }),
    ],
    output: mkOutput({ masterDimmer: 0.88, blackout: false, safetyClamp: 0.92, backgroundFade: 0.2, beamPersistence: 0.4, globalBeamWidth: 1, globalGlow: 0.6, globalStrobeRate: 0 }),
    fog: mkFog({ enabled: true, density: 0.2, opacity: 0.32, noiseScale: 1.1, driftSpeed: 0.1, driftDirection: 0.15, turbulence: 0.18, diffusion: 0.24, dissipation: 0.6, beamScatter: 0.35, colorAbsorption: 0.16, quality: 'medium' }),
    editor: mkEditor(),
  }
}

// ── Preset 19: Alternating Fan ────────────────────────────────────────────────

function createAlternatingFanSettings(): LaserDmxBeamMatrixSettings {
  const P = 'alternating-fan'

  const altFan = mkSeqGroup(
    `${P}:group:alt-fan`,
    'Alternating Fan',
    mkColor(180, 80, 255, 30, 1),
    [
      mkRoute(`${P}:route:bass-width`, 'nBass', 'beamWidth', 'set',
        0.65, 0.85, 1.7, 'easeOut', 0.03, 0.22, { smoothing: 0.25 }),
      mkRoute(`${P}:route:downbeat-glow`, 'downbeat', 'beamGlow', 'trigger',
        0.8, 0, 0.75, 'easeOut', 0, 0.28),
      mkRoute(`${P}:route:beat-dimmer`, 'beatHit', 'dimmer', 'trigger',
        0.75, 0.15, 1, 'easeOut', 0, 0.2),
    ],
    // Alternate: odd/even beams per beat
    { enabled: true, mode: 'alternate', stepsPerBeat: 1, stepGate: 0.55 },
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.55, shutterOpen: true, width: 1.1, focus: 0.75,
    strobeRate: 0, flickerAmount: 0, divergence: 0.2, glow: 0.62,
    geometry: 'volumetricCone',
  }
  const growMotion: Partial<LaserDmxBeamMotion> = { mode: 'grow', beatsPerTravel: 0.5, direction: 'alternate', easing: 'easeInOut', headGlow: 0.55 }

  const beams = withSequenceIndices([
    mkMotionBeam(`${P}:beam:c1r10-c8r1`,   'Fan L1',  altFan.id,  1, 10, 8,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c4r10-c8r1`,   'Fan L2',  altFan.id,  4, 10, 8,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c7r10-c8r1`,   'Fan LC',  altFan.id,  7, 10, 8,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c9r10-c8r1`,   'Fan RC',  altFan.id,  9, 10, 8,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c12r10-c8r1`,  'Fan R2',  altFan.id, 12, 10, 8,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c15r10-c8r1`,  'Fan R1',  altFan.id, 15, 10, 8,  1, app, growMotion),
    mkMotionBeam(`${P}:beam:c1r1-c8r10`,   'Fan BL1', altFan.id,  1,  1, 8, 10, app, growMotion),
    mkMotionBeam(`${P}:beam:c15r1-c8r10`,  'Fan BR1', altFan.id, 15,  1, 8, 10, app, growMotion),
  ])

  return {
    selectedBeamIds: [], selectedGroupId: null,
    beams,
    groups: [altFan],
    globalModulationRoutes: [
      mkRoute(`${P}:global:bass-fog`, 'nBass', 'fogDensity', 'set',
        0.5, 0.1, 0.45, 'easeOut', 0.06, 0.3, { smoothing: 0.35 }),
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.6, 0, 0.5, 'easeOut', 0, 0.25),
    ],
    output: mkOutput({ masterDimmer: 0.87, blackout: false, safetyClamp: 0.9, backgroundFade: 0.2, beamPersistence: 0.4, globalBeamWidth: 1, globalGlow: 0.65, globalStrobeRate: 0 }),
    fog: mkFog({ enabled: true, density: 0.2, opacity: 0.3, noiseScale: 1.1, driftSpeed: 0.1, driftDirection: 0.12, turbulence: 0.15, diffusion: 0.26, dissipation: 0.62, beamScatter: 0.32, colorAbsorption: 0.16, quality: 'medium' }),
    editor: mkEditor(),
  }
}

// ── Preset 20: Ping Pong Pulse ────────────────────────────────────────────────

function createPingPongPulseSettings(): LaserDmxBeamMatrixSettings {
  const P = 'ping-pong-pulse'

  const pingGroup = mkSeqGroup(
    `${P}:group:ping`,
    'Ping Pong Pulse',
    mkColor(0, 255, 130, 20, 1),
    [
      mkRoute(`${P}:route:energy-dimmer`, 'energy', 'dimmer', 'set',
        0.9, 0.12, 0.95, 'easeOut', 0.04, 0.28, { smoothing: 0.3 }),
      mkRoute(`${P}:route:spectral-glow`, 'spectralFlux', 'beamGlow', 'set',
        0.5, 0.1, 0.6, 'easeOut', 0.03, 0.2, { smoothing: 0.25 }),
    ],
    { enabled: true, mode: 'forward', stepsPerBeat: 2, stepGate: 0.7 },
  )

  const app: LaserDmxMatrixBeamAppearance = {
    dimmer: 0.65, shutterOpen: true, width: 1, focus: 0.88,
    strobeRate: 0, flickerAmount: 0, divergence: 0.04, glow: 0.58,
    geometry: 'line',
  }
  const pingMotion: Partial<LaserDmxBeamMotion> = { mode: 'pingPong', beatsPerTravel: 1, easing: 'easeInOut', headGlow: 0.5 }

  // 6 beams across the stage forming a ping-pong grid
  const beams = withSequenceIndices([
    mkMotionBeam(`${P}:beam:c1r1-c15r1`,   'H1', pingGroup.id,  1,  1, 15,  1, app, pingMotion),
    mkMotionBeam(`${P}:beam:c1r3-c15r3`,   'H2', pingGroup.id,  1,  3, 15,  3, app, pingMotion),
    mkMotionBeam(`${P}:beam:c1r5-c15r5`,   'H3', pingGroup.id,  1,  5, 15,  5, app, pingMotion),
    mkMotionBeam(`${P}:beam:c1r7-c15r7`,   'H4', pingGroup.id,  1,  7, 15,  7, app, pingMotion),
    mkMotionBeam(`${P}:beam:c1r9-c15r9`,   'H5', pingGroup.id,  1,  9, 15,  9, app, pingMotion),
    mkMotionBeam(`${P}:beam:c1r10-c15r10`, 'H6', pingGroup.id,  1, 10, 15, 10, app, pingMotion),
  ])

  return {
    selectedBeamIds: [], selectedGroupId: null,
    beams,
    groups: [pingGroup],
    globalModulationRoutes: [
      mkRoute(`${P}:global:energy-fog`, 'energy', 'fogDensity', 'set',
        0.45, 0.1, 0.42, 'easeOut', 0.08, 0.4, { smoothing: 0.4 }),
      mkRoute(`${P}:global:downbeat-scatter`, 'downbeat', 'fogBeamScatter', 'trigger',
        0.45, 0, 0.4, 'easeOut', 0, 0.2),
    ],
    output: mkOutput({ masterDimmer: 0.86, blackout: false, safetyClamp: 0.9, backgroundFade: 0.18, beamPersistence: 0.5, globalBeamWidth: 0.95, globalGlow: 0.62, globalStrobeRate: 0 }),
    fog: mkFog({ enabled: true, density: 0.18, opacity: 0.28, noiseScale: 1.2, driftSpeed: 0.1, driftDirection: 0.4, turbulence: 0.14, diffusion: 0.22, dissipation: 0.65, beamScatter: 0.28, colorAbsorption: 0.15, quality: 'medium' }),
    editor: mkEditor(),
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const LASER_DMX_BEAM_MATRIX_PRESETS: LaserDmxBeamMatrixPreset[] = [
  {
    id:          'minimal-crossfire',
    name:        'Minimal Crossfire',
    description: 'Four clean crossing beams with restrained bass movement and crisp snare accents.',
    category:    'minimal',
    tags:        ['clean', 'crossfire', 'cyan', 'blue', 'beginner'],
    createSettings: createMinimalCrossfireSettings,
  },
  {
    id:          'redline-bass-tunnel',
    name:        'Redline Bass Tunnel',
    description: 'Eight converging red beams that widen, brighten, and fill with haze under bass pressure.',
    category:    'rhythmic',
    tags:        ['bass', 'red', 'tunnel', 'heavy', 'dubstep'],
    createSettings: createRedlineBassTunnelSettings,
  },
  {
    id:          'blue-snare-crossfire',
    name:        'Blue Snare Crossfire',
    description: 'A blue lattice that snaps into view on snares with subtle high-frequency detail.',
    category:    'rhythmic',
    tags:        ['snare', 'blue', 'crossfire', 'trap', 'flash'],
    createSettings: createBlueSnareSettings,
  },
  {
    id:          'green-beat-pyramid',
    name:        'Green Beat Pyramid',
    description: 'Six green volumetric cones that pulse and breathe with beat and downbeat timing.',
    category:    'rhythmic',
    tags:        ['beat', 'green', 'pyramid', 'house', 'techno', 'volumetric'],
    createSettings: createGreenBeatPyramidSettings,
  },
  {
    id:          'kick-snare-duel',
    name:        'Kick and Snare Duel',
    description: 'Mirrored red kick beams and blue snare beams trade punches across the output.',
    category:    'multiReactive',
    tags:        ['kick', 'snare', 'red', 'blue', 'call-and-response'],
    createSettings: createKickSnareDuelSettings,
  },
  {
    id:          'rgb-reaction-split',
    name:        'RGB Reaction Split',
    description: 'A flagship four-family preset demonstrating bass, snare, beat, and custom Music Intelligence reactions.',
    category:    'multiReactive',
    tags:        ['showcase', 'bass', 'snare', 'beat', 'spectral', 'multicolor'],
    createSettings: createRgbReactionSplitSettings,
  },
  {
    id:          'ceiling-scanner',
    name:        'Ceiling Scanner',
    description: 'Eight cyan and teal beams sweep inward and outward across the ceiling using phase and phrase motion.',
    category:    'rhythmic',
    tags:        ['scanner', 'phase', 'movement', 'cyan', 'teal'],
    createSettings: createCeilingScannerSettings,
  },
  {
    id:          'laser-cage',
    name:        'Laser Cage',
    description: 'A rigid neon enclosure of horizontal, vertical, and diagonal beams with drop-impact accents.',
    category:    'drop',
    tags:        ['cage', 'grid', 'red', 'blue', 'purple', 'geometric'],
    createSettings: createLaserCageSettings,
  },
  {
    id:          'build-ladder',
    name:        'Build Ladder',
    description: 'Ten spectrum-colored beams climb row by row as build energy rises, then explode on the drop.',
    category:    'build',
    tags:        ['build', 'ladder', 'spectrum', 'threshold', 'drop', 'progressive'],
    createSettings: createBuildLadderSettings,
  },
  {
    id:          'drop-starburst',
    name:        'Drop Starburst',
    description: 'Sixteen volumetric cones burst from four corners on drop impact and downbeat hits.',
    category:    'drop',
    tags:        ['drop', 'starburst', 'burst', 'cone', 'volumetric', 'impact'],
    createSettings: createDropStarburstSettings,
  },
  {
    id:          'vocal-halo',
    name:        'Vocal Halo',
    description: 'Eight inward lines and four outward halo cones react to vocal presence and spectral flux.',
    category:    'multiReactive',
    tags:        ['vocal', 'halo', 'purple', 'cone', 'spectral', 'atmospheric'],
    createSettings: createVocalHaloSettings,
  },
  {
    id:          'fog-cathedral',
    name:        'Fog Cathedral',
    description: 'Six towering alternating-color cones fill a heavy fog field with cinematic cathedral light.',
    category:    'atmospheric',
    tags:        ['fog', 'cathedral', 'cone', 'cyan', 'emerald', 'cinematic', 'atmospheric'],
    createSettings: createFogCathedralSettings,
  },

  // ── Sequencing presets (13–20) ────────────────────────────────────────────
  {
    id:          'bass-fan',
    name:        'Bass Fan',
    description: 'All beams grow in unison on every beat. Bass controls fan width; downbeats create a wider accent sweep.',
    category:    'rhythmic',
    tags:        ['bass', 'fan', 'beat', 'grow', 'sequence', 'cyan', 'house'],
    createSettings: createBassFanSettings,
  },
  {
    id:          'snare-crossfire-seq',
    name:        'Snare Crossfire',
    description: 'Left and right projectile groups alternate on snare hits, creating a tightly choreographed crossfire chase.',
    category:    'rhythmic',
    tags:        ['snare', 'crossfire', 'projectile', 'alternate', 'sequence', 'blue', 'red'],
    createSettings: createSnareCrossFireSeqSettings,
  },
  {
    id:          'center-out-chase',
    name:        'Center-Out Chase',
    description: 'Beams radiate outward from center on eighth-note steps, resetting cleanly on every downbeat.',
    category:    'rhythmic',
    tags:        ['centerOut', 'chase', 'grow', 'sequence', 'green', 'techno'],
    createSettings: createCenterOutChaseSettings,
  },
  {
    id:          'drop-burst-seq',
    name:        'Drop Burst',
    description: 'Sequential forward projectiles launch on drop impact — bass drives cone divergence and energy raises glow.',
    category:    'drop',
    tags:        ['drop', 'burst', 'projectile', 'sequence', 'orange', 'impact'],
    createSettings: createDropBurstSeqSettings,
  },
  {
    id:          'phrase-scanner',
    name:        'Phrase Scanner',
    description: 'Forward and reverse scanner groups sweep across horizontal rows, crossing on phrase boundaries.',
    category:    'rhythmic',
    tags:        ['scanner', 'phrase', 'forward', 'reverse', 'sequence', 'cyan', 'amber'],
    createSettings: createPhraseScannerSettings,
  },
  {
    id:          'outside-in-collapse',
    name:        'Outside-In Collapse',
    description: 'Projectile beams collapse from the outermost pair inward on snare hits, producing a tightening effect.',
    category:    'rhythmic',
    tags:        ['outsideIn', 'collapse', 'projectile', 'sequence', 'pink', 'snare'],
    createSettings: createOutsideInCollapseSettings,
  },
  {
    id:          'alternating-fan',
    name:        'Alternating Fan',
    description: 'Odd and even cone beams alternate each beat, with bass widening the fan and downbeats adding full-matrix glow.',
    category:    'rhythmic',
    tags:        ['alternate', 'fan', 'grow', 'sequence', 'purple', 'bass'],
    createSettings: createAlternatingFanSettings,
  },
  {
    id:          'ping-pong-pulse',
    name:        'Ping Pong Pulse',
    description: 'Six horizontal beams ping-pong back and forth on eighth-note steps, driven by energy and spectral flux.',
    category:    'rhythmic',
    tags:        ['pingPong', 'pulse', 'sequence', 'green', 'horizontal', 'energy'],
    createSettings: createPingPongPulseSettings,
  },
]

export function getLaserDmxBeamMatrixPreset(id: string): LaserDmxBeamMatrixPreset | undefined {
  return LASER_DMX_BEAM_MATRIX_PRESETS.find(p => p.id === id)
}

export function createLaserDmxBeamMatrixPresetSettings(id: string): LaserDmxBeamMatrixSettings | null {
  const preset = getLaserDmxBeamMatrixPreset(id)
  return preset ? preset.createSettings() : null
}

export function summarizePreset(preset: LaserDmxBeamMatrixPreset): LaserDmxBeamMatrixPresetSummary {
  const s = preset.createSettings()
  const sources = new Set<string>()
  for (const r of s.globalModulationRoutes) sources.add(r.source)
  for (const g of s.groups) for (const r of g.modulationRoutes) sources.add(r.source)
  for (const b of s.beams) for (const r of b.modulationRoutes) sources.add(r.source)
  return {
    beamCount:     s.beams.length,
    groupCount:    s.groups.length,
    lineBeamCount: s.beams.filter(b => b.appearance.geometry === 'line').length,
    coneBeamCount: s.beams.filter(b => b.appearance.geometry === 'volumetricCone').length,
    usesFog:       s.fog.enabled,
    musicSources:  Array.from(sources),
  }
}
