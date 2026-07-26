export const LASER_DMX_WEBGL_REFERENCE_SCENES = Object.freeze({
  laser: Object.freeze([
    'laser-held-beam',
    'laser-line-sweep',
    'laser-sequential-circle',
    'laser-sequential-arc',
    'laser-triangle-perimeter',
    'laser-polygon-perimeter',
    'laser-progressive-wave',
    'laser-fan-sweep',
    'laser-mirrored-fan',
    'laser-tunnel',
    'laser-corridor',
    'laser-upper-air-canopy',
    'laser-front-air-rake',
    'laser-prism-copies',
    'laser-line-diffraction',
    'laser-grid-diffraction',
    'laser-burst-diffraction',
    'laser-multiple-scanner-heads',
    'laser-multiple-physical-apertures',
  ]),
  nonlaser: Object.freeze([
    'nonlaser-moving-head-cone',
    'nonlaser-zoom',
    'nonlaser-iris',
    'nonlaser-frost',
    'nonlaser-focus',
    'nonlaser-gobo-projection',
    'nonlaser-gobo-rotation',
    'nonlaser-moving-head-prism',
    'nonlaser-wash-field',
    'nonlaser-par-field',
    'nonlaser-strobe-pulse',
    'nonlaser-blinder-impact',
    'nonlaser-led-tube',
    'nonlaser-led-pixel-chase',
    'nonlaser-haze-source',
    'nonlaser-co2-burst',
    'nonlaser-video-surface-fallback',
  ]),
  programming: Object.freeze([
    'programming-stable-8-ray-fan',
    'programming-stable-12-ray-fan',
    'programming-mirrored-12-ray-fans',
    'programming-opposed-fan-banks',
    'programming-crossing-fan',
    'programming-smooth-opening-fan',
    'programming-smooth-closing-fan',
    'programming-parallel-sheet',
    'programming-tunnel',
    'programming-corridor',
    'programming-circle',
    'programming-wave',
    'programming-cue-transition',
    'programming-bank-handoff',
    'programming-call-response',
    'programming-moving-head-position',
    'programming-moving-head-gobo',
    'programming-wash-scene',
    'programming-cue-blackout',
    'programming-strobe-accent',
    'programming-blinder-impact',
    'programming-led-chase',
    'programming-co2-event',
  ]),
  musical: Object.freeze([
    'musical-intro',
    'musical-verse',
    'musical-build',
    'musical-pre-drop',
    'musical-drop-1',
    'musical-breakdown',
    'musical-drop-2',
    'musical-outro',
  ]),
  finiteCue: Object.freeze([
    'finite-stable-fan',
    'finite-upward-sweep',
    'finite-circle-hold',
    'finite-circle-one-turn-hold',
    'finite-tunnel-pulse-blackout',
    'finite-alternating-groups',
    'finite-build-recruitment',
    'finite-pre-drop-blackout',
    'finite-drop-full-rig-withdrawal',
    'finite-end-blackout',
  ]),
})

export type LaserDmxWebGLReferenceSceneId =
  | typeof LASER_DMX_WEBGL_REFERENCE_SCENES.laser[number]
  | typeof LASER_DMX_WEBGL_REFERENCE_SCENES.nonlaser[number]
  | typeof LASER_DMX_WEBGL_REFERENCE_SCENES.programming[number]
  | typeof LASER_DMX_WEBGL_REFERENCE_SCENES.musical[number]
  | typeof LASER_DMX_WEBGL_REFERENCE_SCENES.finiteCue[number]

export const LASER_DMX_WEBGL_REQUIRED_REFERENCE_SCENE_IDS: readonly LaserDmxWebGLReferenceSceneId[] = Object.freeze([
  ...LASER_DMX_WEBGL_REFERENCE_SCENES.laser,
  ...LASER_DMX_WEBGL_REFERENCE_SCENES.nonlaser,
  ...LASER_DMX_WEBGL_REFERENCE_SCENES.programming,
  ...LASER_DMX_WEBGL_REFERENCE_SCENES.musical,
  ...LASER_DMX_WEBGL_REFERENCE_SCENES.finiteCue,
])

export interface LaserDmxWebGLReferenceMetricEnvelope {
  minimumBlackFloorRatio: number
  maximumBlackFloorRatio: number
  minimumLitPixelRatio: number
  maximumHighlightRatio: number
  maximumWashedBrightRatio: number
  minimumConnectedLitRatio: number
  maximumColorSaturation: number
}

/**
 * GPU-independent perceptual guardrails. Approved screenshot baselines remain
 * review artifacts, while these envelopes make pass/fail deterministic across
 * ANGLE, native OpenGL, and software WebGL implementations.
 */
export const LASER_DMX_WEBGL_REFERENCE_METRIC_ENVELOPE: Readonly<LaserDmxWebGLReferenceMetricEnvelope> = Object.freeze({
  minimumBlackFloorRatio: 0.35,
  maximumBlackFloorRatio: 0.99995,
  minimumLitPixelRatio: 0.00075,
  maximumHighlightRatio: 0.22,
  maximumWashedBrightRatio: 0.16,
  minimumConnectedLitRatio: 0.65,
  maximumColorSaturation: 0.98,
})

export function missingLaserDmxWebGLReferenceScenes(
  covered: Iterable<LaserDmxWebGLReferenceSceneId>,
): LaserDmxWebGLReferenceSceneId[] {
  const coverage = new Set(covered)
  return LASER_DMX_WEBGL_REQUIRED_REFERENCE_SCENE_IDS.filter(scene => !coverage.has(scene))
}
