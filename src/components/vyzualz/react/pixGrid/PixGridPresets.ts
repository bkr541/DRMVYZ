import type { ReactPreset, ReactSectionMapping, ReactSectionType } from '../ReactTypes'
import {
  BASS_BEACON_AUDIO_ASSIGNMENTS,
  BASS_BEACON_GROUPS,
  GEOMETRIC_REACTOR_AUDIO_ASSIGNMENTS,
  GEOMETRIC_REACTOR_GROUPS,
  PIXEL_PARADE_AUDIO_ASSIGNMENTS,
  PIXEL_PARADE_GROUPS,
} from './PixGridAuthoredPresetAssignments'
import { PIX_GRID_NEON_MARQUEE_AUDIO_ASSIGNMENTS } from './PixGridNeonMarqueeAssignments'
import { PIX_GRID_NEON_MARQUEE_GROUPS } from './PixGridNeonMarqueeGroups'
import { PIX_GRID_NEON_MARQUEE_SIGN_CADENCE } from './PixGridSignClock'
import type { PixGridLayer, PixGridPresetSettings, PixGridSceneSettings } from './PixGridTypes'

export const PIX_GRID_PRESET_IDS = [
  'pix-grid-bass-beacon',
  'pix-grid-geometric-reactor',
  'pix-grid-pixel-parade',
  'pix-grid-neon-marquee-cycle',
] as const

export type PixGridPresetId = typeof PIX_GRID_PRESET_IDS[number]

export const PIX_GRID_AUTHORED_PRESET_CONFIGURATION_VERSION = 8 as const
export const PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION = 16 as const

const SECTION_TYPES: ReactSectionType[] = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro']

function createScenes(prefix: string, intensity: number[], motion: number[], glow: number[]) {
  return SECTION_TYPES.map((sectionType, index) => ({
    id: `${prefix}-${sectionType}`,
    sectionType,
    engineId: 'pixGrid' as const,
    params: {
      intensity: intensity[index],
      motion: motion[index],
      glow: glow[index],
    },
  }))
}

function createMappings(prefix: string): ReactSectionMapping[] {
  return SECTION_TYPES.map(sectionType => ({ sectionType, sceneId: `${prefix}-${sectionType}` }))
}

/**
 * Autonomous (time-clocked) animation gains.
 *
 * These were 0.55 for speed and 0.6 for amount. Applied to authored amounts of
 * 0.006-0.035 they produced sub-pixel motion: a positional offset of 0.006 on a
 * 32-cell-wide matrix moves 0.19 of a cell and therefore never renders as
 * movement at all. The dampening is removed and replaced with per-family floors
 * so an authored animation is always guaranteed to cross at least one cell.
 */
const AUTONOMOUS_SPEED_GAIN = 4.5
const AUTONOMOUS_AMOUNT_GAIN = 1

/**
 * Authored speeds of 0.06-0.25 put a full animation cycle at 6-20 seconds, so
 * continuous animations advanced by fractions of a cell per frame and the only
 * measurable frame-to-frame change came from beat-stepped `frameCycle`. The
 * floor puts a cycle in the 1-2 bar range at club tempo.
 */
const MIN_AUTONOMOUS_SPEED = 0.3

/** Modes whose amount is a normalized position offset or rate. */
const POSITION_ANIMATION_MODES = new Set<PixGridLayer['animations'][number]['mode']>([
  'bounce',
  'pingPong',
  'horizontalScroll',
  'verticalScroll',
  'beatStepMovement',
])

/** Modes whose amount is a multiplicative scale delta. */
const SCALE_ANIMATION_MODES = new Set<PixGridLayer['animations'][number]['mode']>([
  'pulse',
  'audioAmplitudeScale',
])

/** One cell on the narrowest supported matrix, with headroom. */
const MIN_POSITION_AMOUNT = 0.045
const MIN_SCALE_AMOUNT = 0.16

function animationSpeed(
  mode: PixGridLayer['animations'][number]['mode'],
  speed: number,
): number {
  const gained = speed * AUTONOMOUS_SPEED_GAIN
  if (POSITION_ANIMATION_MODES.has(mode) || SCALE_ANIMATION_MODES.has(mode)) {
    return Math.max(gained, MIN_AUTONOMOUS_SPEED)
  }
  return gained
}

function animationAmount(
  mode: PixGridLayer['animations'][number]['mode'],
  amount: number,
  autonomous: boolean,
): number {
  const gained = autonomous ? amount * AUTONOMOUS_AMOUNT_GAIN : amount
  const sign = gained < 0 ? -1 : 1
  if (POSITION_ANIMATION_MODES.has(mode)) return sign * Math.max(Math.abs(gained), MIN_POSITION_AMOUNT)
  if (SCALE_ANIMATION_MODES.has(mode)) return sign * Math.max(Math.abs(gained), MIN_SCALE_AMOUNT)
  return gained
}

function animation(
  mode: PixGridLayer['animations'][number]['mode'],
  speed: number,
  amount: number,
  extras: Partial<PixGridLayer['animations'][number]> = {},
): PixGridLayer['animations'][number] {
  const autonomous = !extras.clock || extras.clock === 'time'
  return {
    mode,
    speed: autonomous ? animationSpeed(mode, speed) : speed,
    amount: animationAmount(mode, amount, autonomous),
    phase: 0,
    boundary: 'wrap',
    ...extras,
  }
}

function layer(
  id: string,
  name: string,
  assetId: PixGridLayer['assetId'],
  overrides: Partial<PixGridLayer> = {},
): PixGridLayer {
  return {
    id,
    name,
    assetId,
    visible: true,
    opacity: 1,
    position: { x: 0.5, y: 0.5 },
    scale: { x: 0.5, y: 0.5 },
    rotation: 0,
    flipX: false,
    flipY: false,
    blendMode: 'normal',
    paletteMap: {},
    zIndex: 0,
    clipMode: 'clip',
    maskAssetId: null,
    animations: [],
    densityRank: 0,
    seed: 1,
    ...overrides,
  }
}

function sceneSettings(
  prefix: string,
  custom: Partial<Record<ReactSectionType, Partial<PixGridSceneSettings>>> = {},
): Record<string, PixGridSceneSettings> {
  const base: Partial<Record<ReactSectionType, PixGridSceneSettings>> = {
    // The drop previously capped at 0.62 while build sat at 0.65, which inverted
    // the energy arc on screen. Ordering is now drop > build > verse > breakdown
    // > intro > outro > preDrop, with preDrop still deliberately near-frozen.
    intro: { density: 0.28, motionMultiplier: 0.3, paletteOffset: 0 },
    verse: { density: 0.55, motionMultiplier: 0.6, paletteOffset: 0 },
    build: { density: 0.78, motionMultiplier: 0.95, paletteOffset: 1 },
    preDrop: { density: 0.3, motionMultiplier: 0.05, paletteOffset: 2 },
    drop: { density: 1, motionMultiplier: 1.25, paletteOffset: 0 },
    breakdown: { density: 0.4, motionMultiplier: 0.35, paletteOffset: 2 },
    outro: { density: 0.22, motionMultiplier: 0.15, paletteOffset: 0 },
  }
  return Object.fromEntries(SECTION_TYPES.map(type => [
    `${prefix}-${type}`,
    { ...base[type]!, ...custom[type] },
  ]))
}

const BASS_BEACON_LAYERS: PixGridLayer[] = [
  layer('bass-rings', 'Sub Pressure Rings', 'pix-concentric-rings', {
    opacity: 0.52,
    scale: { x: 0.42, y: 0.74 },
    blendMode: 'add',
    zIndex: 1,
    densityRank: 0.22,
    paletteMap: { primary: 'secondary', secondary: 'primary' },
    animations: [animation('pulse', 0.12, 0.035), animation('rotate', 0.018, 0.125)],
    seed: 101,
  }),
  layer('bass-outline', 'Typography Outline', 'pix-bass-word', {
    opacity: 0.48,
    scale: { x: 0.68, y: 0.37 },
    blendMode: 'add',
    zIndex: 3,
    densityRank: 0.28,
    paletteMap: { primary: 'highlight', highlight: 'accent' },
    animations: [animation('pulse', 0.08, 0.008, { phase: 0.25 })],
    seed: 307,
  }),
  layer('bass-word', 'BASS Hero Body', 'pix-bass-word', {
    scale: { x: 0.61, y: 0.31 },
    zIndex: 4,
    densityRank: 0,
    paletteMap: { primary: 'primary', highlight: 'highlight' },
    animations: [animation('pulse', 0.06, 0.006)],
    seed: 401,
  }),
  layer('bass-letter-b', 'Letter B Highlight', 'pix-bass-letter-b', {
    position: { x: 0.262, y: 0.5 },
    scale: { x: 0.133, y: 0.31 },
    opacity: 0.46,
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.5,
    paletteMap: { primary: 'secondary', highlight: 'highlight' },
    animations: [animation('pulse', 0.08, 0.008, { phase: 0 })],
    seed: 503,
  }),
  layer('bass-letter-a', 'Letter A Highlight', 'pix-bass-letter-a', {
    position: { x: 0.421, y: 0.5 },
    scale: { x: 0.133, y: 0.31 },
    opacity: 0.46,
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.56,
    paletteMap: { primary: 'accent', highlight: 'highlight' },
    animations: [animation('pulse', 0.08, 0.008, { phase: 0.25 })],
    seed: 509,
  }),
  layer('bass-letter-s-left', 'First S Highlight', 'pix-bass-letter-s', {
    position: { x: 0.579, y: 0.5 },
    scale: { x: 0.133, y: 0.31 },
    opacity: 0.46,
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.62,
    paletteMap: { primary: 'secondary', highlight: 'highlight' },
    animations: [animation('pulse', 0.08, 0.008, { phase: 0.5 })],
    seed: 521,
  }),
  layer('bass-letter-s-right', 'Final S Highlight', 'pix-bass-letter-s', {
    position: { x: 0.738, y: 0.5 },
    scale: { x: 0.133, y: 0.31 },
    opacity: 0.46,
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.68,
    paletteMap: { primary: 'accent', highlight: 'highlight' },
    animations: [animation('pulse', 0.08, 0.008, { phase: 0.75 })],
    seed: 523,
  }),
  layer('bass-side-chevrons-left', 'Left Snare Accents', 'pix-diagonal-chevrons', {
    position: { x: 0.115, y: 0.5 },
    scale: { x: 0.16, y: 0.54 },
    rotation: 90,
    opacity: 0.58,
    blendMode: 'add',
    zIndex: 6,
    densityRank: 0.58,
    animations: [animation('pingPong', 0.16, 0.012, { axis: 'x', boundary: 'clamp' })],
    seed: 601,
  }),
  layer('bass-side-chevrons-right', 'Right Snare Accents', 'pix-diagonal-chevrons', {
    position: { x: 0.885, y: 0.5 },
    scale: { x: 0.16, y: 0.54 },
    rotation: -90,
    flipX: true,
    opacity: 0.58,
    blendMode: 'add',
    zIndex: 6,
    densityRank: 0.58,
    animations: [animation('pingPong', 0.16, 0.012, { axis: 'x', boundary: 'clamp', phase: 0.5 })],
    seed: 607,
  }),
  layer('bass-sparkles', 'Air and Hat Details', 'pix-multi-star-field', {
    opacity: 0.5,
    scale: { x: 1, y: 1 },
    blendMode: 'add',
    zIndex: 7,
    densityRank: 0.74,
    seed: 731,
    animations: [animation('frameCycle', 0.25, 1, { clock: 'beat' }), animation('checkerAlternate', 0.125, 1, { clock: 'bar' })],
  }),
]

const GEOMETRIC_REACTOR_LAYERS: PixGridLayer[] = [
  layer('reactor-checker', 'Checker Background Field', 'pix-checkerboard', {
    opacity: 0.13,
    scale: { x: 1, y: 1 },
    blendMode: 'multiply',
    zIndex: 0,
    densityRank: 0.62,
    animations: [animation('checkerAlternate', 0.125, 1, { clock: 'bar' })],
    seed: 811,
  }),
  layer('reactor-tunnel', 'Outer Tunnel Structure', 'pix-geometric-tunnel', {
    opacity: 0.58,
    scale: { x: 0.94, y: 0.94 },
    blendMode: 'add',
    zIndex: 1,
    densityRank: 0.08,
    animations: [animation('frameCycle', 0.25, 1, { clock: 'beat' }), animation('pulse', 0.06, 0.01)],
    seed: 821,
  }),
  layer('reactor-rings', 'Inner Reactor Rings', 'pix-concentric-rings', {
    opacity: 0.62,
    scale: { x: 0.42, y: 0.76 },
    blendMode: 'add',
    zIndex: 2,
    densityRank: 0.22,
    animations: [animation('rotate', 0.025, 0.25), animation('paletteCycle', 0.04, 1)],
    seed: 823,
  }),
  layer('reactor-chevrons', 'Mid-Band Chevrons', 'pix-diagonal-chevrons', {
    opacity: 0.58,
    scale: { x: 0.78, y: 0.52 },
    blendMode: 'add',
    zIndex: 3,
    densityRank: 0.46,
    animations: [animation('horizontalScroll', 0.02, 0.045), animation('paletteCycle', 0.04, 1)],
    seed: 827,
  }),
  layer('reactor-diamond', 'Center Core', 'pix-diamond', {
    scale: { x: 0.3, y: 0.54 },
    blendMode: 'add',
    zIndex: 4,
    densityRank: 0,
    animations: [animation('rotate', 0.125, -0.25, { stepped: true, clock: 'bar' }), animation('pulse', 0.06, 0.012)],
    seed: 829,
  }),
  layer('reactor-cross', 'Cross Impact Accents', 'pix-cross', {
    opacity: 0.5,
    scale: { x: 0.18, y: 0.32 },
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.72,
    animations: [animation('rotate', 0.125, 0.25, { stepped: true, clock: 'bar' })],
    seed: 839,
  }),
  layer('reactor-orbits', 'High-Frequency Nodes', 'pix-orbiting-dots', {
    opacity: 0.68,
    scale: { x: 0.54, y: 0.96 },
    blendMode: 'add',
    zIndex: 6,
    densityRank: 0.82,
    animations: [animation('frameCycle', 0.25, 1, { clock: 'beat' }), animation('rotate', 0.018, 0.25)],
    seed: 853,
  }),
]

const PIXEL_PARADE_LAYERS: PixGridLayer[] = [
  layer('parade-stars', 'Parade Sky and Particles', 'pix-multi-star-field', {
    opacity: 0.5,
    scale: { x: 1, y: 1 },
    blendMode: 'add',
    zIndex: 0,
    densityRank: 0.34,
    seed: 212,
    animations: [animation('frameCycle', 0.25, 1, { clock: 'beat' }), animation('horizontalScroll', 0.006, 0.04)],
  }),
  layer('parade-wave-top', 'Upper Parade Lane', 'pix-wave-line', {
    position: { x: 0.5, y: 0.24 },
    scale: { x: 0.94, y: 0.18 },
    opacity: 0.6,
    blendMode: 'add',
    zIndex: 1,
    densityRank: 0.2,
    animations: [animation('horizontalScroll', 0.018, 0.06), animation('frameCycle', 0.25, 1, { clock: 'beat' })],
    seed: 907,
  }),
  layer('parade-wave-bottom', 'Ground and Baseline', 'pix-wave-line', {
    position: { x: 0.5, y: 0.78 },
    scale: { x: 1, y: 0.2 },
    opacity: 0.5,
    blendMode: 'add',
    zIndex: 2,
    densityRank: 0.12,
    flipY: true,
    animations: [animation('horizontalScroll', -0.018, 0.06), animation('frameCycle', 0.25, 1, { phase: 0.5, clock: 'beat' })],
    seed: 911,
  }),
  layer('parade-star-left', 'Primary Star Participant', 'pix-five-point-star', {
    position: { x: 0.22, y: 0.55 },
    scale: { x: 0.18, y: 0.32 },
    blendMode: 'add',
    zIndex: 3,
    densityRank: 0.08,
    animations: [animation('bounce', 0.25, 0.022, { clock: 'beat' }), animation('rotate', 0.012, 0.125)],
    seed: 919,
  }),
  layer('parade-pal', 'Hero Pixel Pal', 'pix-mascot-face', {
    position: { x: 0.47, y: 0.54 },
    scale: { x: 0.24, y: 0.36 },
    zIndex: 4,
    densityRank: 0,
    animations: [animation('frameCycle', 0.25, 1, { clock: 'beat' }), animation('bounce', 0.25, 0.02, { clock: 'beat' })],
    seed: 929,
  }),
  layer('parade-orbit', 'Secondary Orbit Participant', 'pix-orbiting-dots', {
    position: { x: 0.73, y: 0.53 },
    scale: { x: 0.22, y: 0.4 },
    opacity: 0.72,
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.58,
    animations: [animation('frameCycle', 0.25, 1, { clock: 'beat' }), animation('pingPong', 0.12, 0.015, { axis: 'y', boundary: 'bounce' })],
    seed: 937,
  }),
  layer('parade-eq', 'Equalizer Float and Props', 'pix-equalizer-bars', {
    position: { x: 0.5, y: 0.82 },
    scale: { x: 0.62, y: 0.2 },
    opacity: 0.58,
    blendMode: 'add',
    zIndex: 6,
    densityRank: 0.7,
    animations: [animation('frameCycle', 0.5, 1, { clock: 'beat' }), animation('horizontalScroll', 0.01, 0.025)],
    seed: 941,
  }),
  layer('parade-burst', 'Bounded Parade Impact', 'pix-pixel-burst', {
    opacity: 0.24,
    scale: { x: 0.78, y: 1.2 },
    blendMode: 'add',
    zIndex: 7,
    densityRank: 0.9,
    animations: [animation('rotate', 0.01, 0.25), animation('frameCycle', 0.25, 1, { clock: 'beat' })],
    seed: 947,
  }),
]

const MARQUEE_BULB_CHASE_SPEED = {
  intro: 0.5,
  verse: 1,
  build: 1,
  preDrop: 0,
  drop: 2,
  breakdown: 0.25,
  bridge: 0.75,
  outro: 0.5,
  unknown: 0.75,
} as const

const MARQUEE_LETTER_TRAVEL_SPEED = {
  intro: 0.5,
  verse: 1,
  build: 1.5,
  preDrop: 0,
  drop: 1.5,
  breakdown: 0.25,
  bridge: 0.75,
  outro: 0.5,
  unknown: 0.75,
} as const

const MARQUEE_EQUALIZER_SPEED = {
  intro: 0.25,
  verse: 0.5,
  build: 1.25,
  preDrop: 0,
  drop: 1.5,
  breakdown: 0.2,
  bridge: 0.45,
  outro: 0,
  unknown: 0.4,
} as const

const MARQUEE_TRIM_SPEED = {
  intro: 0.25,
  verse: 0.5,
  build: 1,
  preDrop: 0,
  drop: 1,
  breakdown: 0.2,
  bridge: 0.5,
  outro: 0,
  unknown: 0.4,
} as const

type MarqueeTransitionFamily = 'structure' | 'bulbs' | 'letters' | 'activity'

function marqueeSignFrameAnimation(family: MarqueeTransitionFamily = 'structure'): PixGridLayer['animations'][number] {
  const buildType = family === 'letters' ? 'columnWipe' : 'rowWipe'
  const dropType = family === 'structure' ? 'radialReveal' : family === 'bulbs' ? 'checkerWipe' : 'pixelDissolve'
  return animation('frameCycle', 1, 1, {
    clock: 'sign',
    stepped: true,
    sectionSpeeds: PIX_GRID_NEON_MARQUEE_SIGN_CADENCE,
    frameTransition: { type: 'pixelDissolve', durationFraction: 1 / 64, easing: 'easeOut', seedMode: 'frame' },
    sectionFrameTransitions: {
      intro: { type: 'powerOn', durationFraction: 0.25, easing: 'easeOut', seedMode: 'section', onSectionEntry: true },
      verse: { type: 'pixelDissolve', durationFraction: 1 / 64, easing: 'easeOut', seedMode: 'frame' },
      build: { type: buildType, durationFraction: 1 / 64, easing: 'easeInOut', seedMode: 'section', direction: family === 'letters' ? 'reverse' : 'forward' },
      preDrop: { type: 'cut', durationFraction: 0, seedMode: 'layer' },
      drop: { type: dropType, durationFraction: 1 / 64, easing: 'easeOut', seedMode: 'frame', origin: { x: 0.5, y: 0.5 } },
      breakdown: { type: 'pixelDissolve', durationFraction: 1 / 64, easing: 'easeInOut', seedMode: 'frame' },
      bridge: { type: 'columnWipe', durationFraction: 1 / 32, easing: 'easeInOut', seedMode: 'section' },
      outro: {
        type: 'powerOff',
        durationFraction: 0.25,
        easing: 'easeIn',
        seedMode: 'section',
        onSectionEntry: true,
        holdAfterCompletion: true,
      },
      unknown: { type: 'pixelDissolve', durationFraction: 1 / 64, easing: 'linear', seedMode: 'frame' },
    },
  })
}

function marqueeBulbAnimation(phase: number): PixGridLayer['animations'][number] {
  return animation('blink', 0.25, 0.25, {
    clock: 'sectionBeat',
    phase,
    stepped: true,
    sectionSpeeds: MARQUEE_BULB_CHASE_SPEED,
    sectionProgressSpeed: { build: 1 },
  })
}

function marqueeLetterAnimations(phase: number, revealFrom: 'start' | 'end' | 'center'): PixGridLayer['animations'] {
  return [
    marqueeSignFrameAnimation('letters'),
    animation('blink', 1 / 3, 0.25, {
      clock: 'sectionBeat',
      phase,
      stepped: true,
      sectionSpeeds: MARQUEE_LETTER_TRAVEL_SPEED,
    }),
    animation('revealColumn', 0.125, 1, {
      clock: 'sectionBeat',
      phase: phase * 0.5,
      boundary: 'bounce',
      revealFrom,
      sectionSpeeds: MARQUEE_LETTER_TRAVEL_SPEED,
    }),
  ]
}

const NEON_MARQUEE_CYCLE_LAYERS: PixGridLayer[] = [
  layer('marquee-structure', 'Stable Sign Structure', 'pix-neon-marquee-structure', {
    scale: { x: 1, y: 1 },
    animations: [marqueeSignFrameAnimation('structure')],
    zIndex: 0,
    densityRank: 0,
    seed: 1207,
  }),
  layer('marquee-bulbs-a', 'Perimeter Bulbs A', 'pix-neon-marquee-bulbs-a', {
    scale: { x: 1, y: 1 }, animations: [marqueeSignFrameAnimation('bulbs'), marqueeBulbAnimation(0)], zIndex: 1, densityRank: 0.08, seed: 1211,
  }),
  layer('marquee-bulbs-b', 'Perimeter Bulbs B', 'pix-neon-marquee-bulbs-b', {
    scale: { x: 1, y: 1 }, animations: [marqueeSignFrameAnimation('bulbs'), marqueeBulbAnimation(0.75)], zIndex: 2, densityRank: 0.16, seed: 1213,
  }),
  layer('marquee-bulbs-c', 'Perimeter Bulbs C', 'pix-neon-marquee-bulbs-c', {
    scale: { x: 1, y: 1 }, animations: [marqueeSignFrameAnimation('bulbs'), marqueeBulbAnimation(0.5)], zIndex: 3, densityRank: 0.28, seed: 1217,
  }),
  layer('marquee-bulbs-d', 'Perimeter Bulbs D', 'pix-neon-marquee-bulbs-d', {
    scale: { x: 1, y: 1 }, animations: [marqueeSignFrameAnimation('bulbs'), marqueeBulbAnimation(0.25)], zIndex: 4, densityRank: 0.4, seed: 1223,
  }),
  layer('marquee-letter-lights-a', 'Letter Lights A', 'pix-neon-marquee-letter-lights-a', {
    scale: { x: 1, y: 1 }, animations: marqueeLetterAnimations(0, 'start'), zIndex: 5, densityRank: 0.24, seed: 1229,
  }),
  layer('marquee-letter-lights-b', 'Letter Lights B', 'pix-neon-marquee-letter-lights-b', {
    scale: { x: 1, y: 1 }, animations: marqueeLetterAnimations(2 / 3, 'center'), zIndex: 6, densityRank: 0.46, seed: 1231,
  }),
  layer('marquee-letter-lights-c', 'Letter Lights C', 'pix-neon-marquee-letter-lights-c', {
    scale: { x: 1, y: 1 }, animations: marqueeLetterAnimations(1 / 3, 'end'), zIndex: 7, densityRank: 0.62, seed: 1237,
  }),
  layer('marquee-equalizer-lights', 'Equalizer and Halo Lights', 'pix-neon-marquee-equalizer-lights', {
    scale: { x: 1, y: 1 },
    animations: [
      marqueeSignFrameAnimation('activity'),
      animation('revealRow', 0.25, 1, { clock: 'sectionBeat', boundary: 'bounce', revealFrom: 'center', sectionSpeeds: MARQUEE_EQUALIZER_SPEED }),
      animation('checkerAlternate', 0.25, 1, { clock: 'sectionBeat', stepped: true, sectionSpeeds: MARQUEE_EQUALIZER_SPEED }),
    ],
    zIndex: 8, densityRank: 0.58, seed: 1249,
  }),
  layer('marquee-trim-lights', 'Trim and Underline Lights', 'pix-neon-marquee-trim-lights', {
    scale: { x: 1, y: 1 },
    animations: [
      marqueeSignFrameAnimation('activity'),
      animation('revealColumn', 0.125, 1, { clock: 'sectionBeat', boundary: 'bounce', revealFrom: 'start', sectionSpeeds: MARQUEE_TRIM_SPEED }),
    ],
    zIndex: 9, densityRank: 0.52, seed: 1259,
  }),
  layer('marquee-focal-lights', 'Frenchie and Focal Lights', 'pix-neon-marquee-focal-lights', {
    scale: { x: 1, y: 1 },
    animations: [
      marqueeSignFrameAnimation('activity'),
      animation('revealRow', 0.125, 1, { clock: 'sectionBeat', boundary: 'bounce', revealFrom: 'center', sectionSpeeds: MARQUEE_EQUALIZER_SPEED }),
    ],
    zIndex: 10, densityRank: 0.36, seed: 1277,
  }),
  layer('marquee-sparkle-lights', 'Sparse Accent Bulbs', 'pix-neon-marquee-sparkle-lights', {
    scale: { x: 1, y: 1 },
    animations: [
      marqueeSignFrameAnimation('activity'),
      animation('blink', 0.5, 0.18, { clock: 'sectionBeat', phase: 0.5, stepped: true, sectionSpeeds: MARQUEE_EQUALIZER_SPEED }),
      animation('checkerAlternate', 0.25, 1, { clock: 'sectionBeat', stepped: true, sectionSpeeds: MARQUEE_EQUALIZER_SPEED }),
    ],
    zIndex: 11, densityRank: 0.78, seed: 1283,
  }),
]

function preset(
  id: PixGridPresetId,
  name: string,
  description: string,
  prefix: string,
  palette: ReactPreset['palette'],
  params: ReactPreset['params'],
  pixGridSettings: PixGridPresetSettings,
  sceneValues: { intensity: number[]; motion: number[]; glow: number[] },
): ReactPreset {
  return {
    id,
    name,
    description,
    engine: 'pixGrid',
    palette,
    params,
    renderSettings: { trailDecay: 0, fogDensity: 0, particleDensity: 0 },
    pixGridSettings: {
      authoredConfigurationVersion: PIX_GRID_AUTHORED_PRESET_CONFIGURATION_VERSION,
      ...pixGridSettings,
    },
    scenes: createScenes(prefix, sceneValues.intensity, sceneValues.motion, sceneValues.glow),
    sectionMappings: createMappings(prefix),
  }
}

export const PIX_GRID_PRESETS: ReactPreset[] = [
  preset(
    'pix-grid-bass-beacon',
    'Bass Beacon',
    'Crisp BASS typography with masked letter banks, phrase-travel highlights, bounded percussion impacts, and full-song row recruitment.',
    'pix-grid-bass-beacon',
    { primary: '#36d9ff', secondary: '#39e69b', accent: '#d8b95a', background: '#020608', highlight: '#f2feff', text: '#e8f4f8' },
    { intensity: 0.86, motion: 0.48, glow: 0.72, bassReactivity: 0.95 },
    {
      pattern: 'bassBeacon',
      quality: 'high',
      backgroundMode: 'preset',
      backgroundColor: '#020608',
      backgroundBrightness: 0.08,
      cellGap: 0.18,
      cellRoundness: 0.2,
      cellBrightness: 0.9,
      globalIntensity: 0.9,
      glowAmount: 0.36,
      diffusion: 0.12,
      rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-bass-beacon-intro',
      layers: BASS_BEACON_LAYERS,
      groups: BASS_BEACON_GROUPS,
      audioAssignments: BASS_BEACON_AUDIO_ASSIGNMENTS,
      performanceProgramId: 'pix-grid-bass-beacon-performance',
      sceneSettings: sceneSettings('pix-grid-bass-beacon', {
        intro: {
          density: 0.34,
          hiddenLayerIds: ['bass-sparkles', 'bass-letter-s-left', 'bass-letter-s-right'],
          layerOpacity: { 'bass-word': 0.44, 'bass-outline': 0.36, 'bass-letter-b': 0.16, 'bass-letter-a': 0.1 },
        },
        verse: {
          density: 0.62,
          layerOpacity: { 'bass-word': 0.78, 'bass-outline': 0.28 },
        },
        build: {
          density: 0.86,
          layerOpacity: { 'bass-word': 0.88, 'bass-outline': 0.34 },
        },
        preDrop: {
          density: 0.28,
          motionMultiplier: 0.03,
          hiddenLayerIds: ['bass-sparkles', 'bass-side-chevrons-left', 'bass-side-chevrons-right', 'bass-rings', 'bass-letter-s-left', 'bass-letter-s-right'],
          layerOpacity: { 'bass-word': 0.46, 'bass-outline': 0.16, 'bass-letter-b': 0.1, 'bass-letter-a': 0.08 },
        },
        drop: {
          density: 1,
          layerOpacity: { 'bass-word': 1, 'bass-outline': 0.3, 'bass-rings': 0.38 },
        },
        breakdown: {
          density: 0.48,
          hiddenLayerIds: ['bass-rings', 'bass-sparkles', 'bass-side-chevrons-left', 'bass-side-chevrons-right'],
          layerOpacity: { 'bass-word': 0.62, 'bass-outline': 0.42, 'bass-letter-a': 0.24 },
        },
        outro: {
          density: 0.34,
          hiddenLayerIds: ['bass-rings', 'bass-sparkles', 'bass-side-chevrons-left', 'bass-side-chevrons-right'],
          layerOpacity: { 'bass-word': 0.55, 'bass-outline': 0.2 },
        },
      }),
    },
    {
      intensity: [0.42, 0.66, 0.82, 0.36, 1, 0.5, 0.3],
      motion: [0.12, 0.32, 0.58, 0.02, 0.74, 0.16, 0.04],
      glow: [0.3, 0.5, 0.64, 0.24, 0.82, 0.4, 0.22],
    },
  ),
  preset(
    'pix-grid-geometric-reactor',
    'Geometric Reactor',
    'A coherent frequency-owned reactor with core, rings, tunnel, chevrons, nodes, cross impacts, and staged geometry recruitment.',
    'pix-grid-geometric-reactor',
    { primary: '#a969ff', secondary: '#30d7ff', accent: '#f2c45c', background: '#05030b', highlight: '#fff3c7', text: '#f7efff' },
    { intensity: 0.9, motion: 0.58, glow: 0.68, bassReactivity: 0.8 },
    {
      pattern: 'geometricReactor',
      quality: 'high',
      backgroundMode: 'preset',
      backgroundColor: '#05030b',
      backgroundBrightness: 0.08,
      cellGap: 0.12,
      cellRoundness: 0.08,
      cellBrightness: 0.92,
      globalIntensity: 0.92,
      glowAmount: 0.28,
      diffusion: 0.08,
      rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-geometric-reactor-intro',
      layers: GEOMETRIC_REACTOR_LAYERS,
      groups: GEOMETRIC_REACTOR_GROUPS,
      audioAssignments: GEOMETRIC_REACTOR_AUDIO_ASSIGNMENTS,
      performanceProgramId: 'pix-grid-geometric-reactor-performance',
      sceneSettings: sceneSettings('pix-grid-geometric-reactor', {
        intro: {
          density: 0.32,
          hiddenLayerIds: ['reactor-cross', 'reactor-orbits', 'reactor-checker', 'reactor-chevrons'],
          layerOpacity: { 'reactor-tunnel': 0.38, 'reactor-rings': 0.46, 'reactor-diamond': 0.7 },
        },
        verse: {
          density: 0.62,
          hiddenLayerIds: ['reactor-cross'],
          layerOpacity: { 'reactor-checker': 0.08, 'reactor-orbits': 0.42 },
        },
        build: {
          density: 0.86,
          layerOpacity: { 'reactor-checker': 0.1, 'reactor-cross': 0.38 },
        },
        preDrop: {
          density: 0.26,
          motionMultiplier: 0.03,
          hiddenLayerIds: ['reactor-checker', 'reactor-chevrons', 'reactor-cross', 'reactor-orbits'],
          layerOpacity: { 'reactor-tunnel': 0.18, 'reactor-rings': 0.24, 'reactor-diamond': 0.52 },
        },
        drop: {
          density: 1,
          layerOpacity: { 'reactor-checker': 0.14, 'reactor-cross': 0.52, 'reactor-orbits': 0.7 },
        },
        breakdown: {
          density: 0.46,
          hiddenLayerIds: ['reactor-checker', 'reactor-chevrons', 'reactor-cross', 'reactor-orbits'],
          layerOpacity: { 'reactor-tunnel': 0.3, 'reactor-rings': 0.4, 'reactor-diamond': 0.72 },
        },
        outro: {
          density: 0.3,
          hiddenLayerIds: ['reactor-checker', 'reactor-chevrons', 'reactor-cross', 'reactor-orbits'],
          layerOpacity: { 'reactor-tunnel': 0.24, 'reactor-rings': 0.3 },
        },
      }),
    },
    {
      intensity: [0.4, 0.66, 0.84, 0.34, 1, 0.48, 0.28],
      motion: [0.14, 0.38, 0.62, 0.02, 0.76, 0.14, 0.04],
      glow: [0.3, 0.5, 0.66, 0.22, 0.8, 0.36, 0.2],
    },
  ),
  preset(
    'pix-grid-pixel-parade',
    'Pixel Parade',
    'A directed procession with a vocal-focused hero, participant banks, musical lanes, props, percussion accents, and evolving cast recruitment.',
    'pix-grid-pixel-parade',
    { primary: '#ff6d7f', secondary: '#ffd35c', accent: '#43d9ff', background: '#070508', highlight: '#67e3aa', text: '#fff4ef' },
    { intensity: 0.82, motion: 0.62, glow: 0.54, bassReactivity: 0.72 },
    {
      pattern: 'pixelParade',
      quality: 'high',
      backgroundMode: 'preset',
      backgroundColor: '#070508',
      backgroundBrightness: 0.1,
      cellGap: 0.22,
      cellRoundness: 0.28,
      cellBrightness: 0.88,
      globalIntensity: 0.88,
      glowAmount: 0.22,
      diffusion: 0.16,
      rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-pixel-parade-intro',
      layers: PIXEL_PARADE_LAYERS,
      groups: PIXEL_PARADE_GROUPS,
      audioAssignments: PIXEL_PARADE_AUDIO_ASSIGNMENTS,
      performanceProgramId: 'pix-grid-pixel-parade-performance',
      sceneSettings: sceneSettings('pix-grid-pixel-parade', {
        intro: {
          density: 0.34,
          hiddenLayerIds: ['parade-eq', 'parade-burst', 'parade-orbit', 'parade-star-left', 'parade-wave-bottom'],
          layerOpacity: { 'parade-pal': 0.72, 'parade-wave-top': 0.32, 'parade-stars': 0.16 },
        },
        verse: {
          density: 0.62,
          hiddenLayerIds: ['parade-burst', 'parade-eq'],
          layerOpacity: { 'parade-orbit': 0.44, 'parade-stars': 0.22 },
        },
        build: {
          density: 0.86,
          hiddenLayerIds: ['parade-burst'],
          layerOpacity: { 'parade-eq': 0.5, 'parade-orbit': 0.62 },
        },
        preDrop: {
          density: 0.24,
          motionMultiplier: 0.03,
          hiddenLayerIds: ['parade-eq', 'parade-burst', 'parade-orbit', 'parade-star-left', 'parade-wave-bottom', 'parade-stars'],
          layerOpacity: { 'parade-pal': 0.48, 'parade-wave-top': 0.14 },
        },
        drop: {
          density: 1,
          layerOpacity: { 'parade-burst': 0.26, 'parade-eq': 0.62, 'parade-orbit': 0.74 },
        },
        breakdown: {
          density: 0.46,
          hiddenLayerIds: ['parade-eq', 'parade-burst', 'parade-orbit', 'parade-wave-bottom', 'parade-star-left'],
          layerOpacity: { 'parade-pal': 0.76, 'parade-wave-top': 0.24, 'parade-stars': 0.16 },
        },
        outro: {
          density: 0.3,
          hiddenLayerIds: ['parade-eq', 'parade-burst', 'parade-orbit', 'parade-wave-bottom', 'parade-stars'],
          layerOpacity: { 'parade-pal': 0.58, 'parade-star-left': 0.34, 'parade-wave-top': 0.2 },
        },
      }),
    },
    {
      intensity: [0.38, 0.62, 0.8, 0.32, 0.98, 0.46, 0.26],
      motion: [0.14, 0.4, 0.64, 0.02, 0.78, 0.16, 0.04],
      glow: [0.26, 0.42, 0.58, 0.2, 0.72, 0.32, 0.18],
    },
  ),
  preset(
    'pix-grid-neon-marquee-cycle',
    'Marquee Sign Cycle',
    'A native layered marquee graph with stable sign structure, controllable perimeter phases, letter lights, equalizers, trim, focal accents, and sparse sparkles.',
    'pix-grid-neon-marquee-cycle',
    { primary: '#ffffff', secondary: '#ffffff', accent: '#ffffff', background: '#000000', highlight: '#ffffff', text: '#ffffff' },
    { intensity: 0.92, motion: 0.35, glow: 0.08, bassReactivity: 0.72 },
    {
      authoredConfigurationVersion: PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION,
      pattern: 'neonMarqueeCycle',
      quality: 'high',
      qualityMode: 'fixed',
      backgroundMode: 'black',
      backgroundColor: '#000000',
      backgroundBrightness: 0,
      cellGap: 0.1,
      cellRoundness: 0.1,
      cellBrightness: 1,
      globalIntensity: 1,
      glowAmount: 0.08,
      diffusion: 0.04,
      rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-neon-marquee-cycle-intro',
      layers: NEON_MARQUEE_CYCLE_LAYERS,
      groups: PIX_GRID_NEON_MARQUEE_GROUPS,
      audioAssignments: [...PIX_GRID_NEON_MARQUEE_AUDIO_ASSIGNMENTS],
      performanceProgramId: 'pix-grid-neon-marquee-performance',
      sceneSettings: sceneSettings('pix-grid-neon-marquee-cycle', {
        intro: {
          density: 0.54,
          motionMultiplier: 1,
          hiddenLayerIds: ['marquee-bulbs-c', 'marquee-bulbs-d', 'marquee-letter-lights-b', 'marquee-letter-lights-c', 'marquee-equalizer-lights', 'marquee-sparkle-lights'],
          layerOpacity: { 'marquee-structure': 1, 'marquee-bulbs-a': 0.48, 'marquee-bulbs-b': 0.28, 'marquee-letter-lights-a': 0.26, 'marquee-trim-lights': 0.12, 'marquee-focal-lights': 0.18 },
        },
        verse: {
          density: 0.8,
          motionMultiplier: 1,
          hiddenLayerIds: ['marquee-letter-lights-c'],
          layerOpacity: { 'marquee-structure': 1, 'marquee-bulbs-a': 0.72, 'marquee-bulbs-b': 0.64, 'marquee-bulbs-c': 0.54, 'marquee-bulbs-d': 0.46, 'marquee-letter-lights-a': 0.58, 'marquee-letter-lights-b': 0.42, 'marquee-equalizer-lights': 0.18, 'marquee-trim-lights': 0.2, 'marquee-focal-lights': 0.32, 'marquee-sparkle-lights': 0.08 },
        },
        build: {
          density: 0.9,
          motionMultiplier: 1,
          layerOpacity: { 'marquee-structure': 1, 'marquee-bulbs-a': 0.88, 'marquee-bulbs-b': 0.9, 'marquee-bulbs-c': 0.92, 'marquee-bulbs-d': 0.94, 'marquee-letter-lights-a': 0.72, 'marquee-letter-lights-b': 0.78, 'marquee-letter-lights-c': 0.84, 'marquee-equalizer-lights': 0.66, 'marquee-trim-lights': 0.56, 'marquee-focal-lights': 0.58, 'marquee-sparkle-lights': 0.2 },
        },
        preDrop: {
          density: 0.5,
          motionMultiplier: 1,
          hiddenLayerIds: ['marquee-bulbs-b', 'marquee-bulbs-c', 'marquee-bulbs-d', 'marquee-letter-lights-a', 'marquee-letter-lights-c', 'marquee-equalizer-lights', 'marquee-trim-lights', 'marquee-sparkle-lights'],
          layerOpacity: { 'marquee-structure': 1, 'marquee-bulbs-a': 0.34, 'marquee-letter-lights-b': 0.24, 'marquee-focal-lights': 0.28 },
        },
        drop: {
          density: 1,
          motionMultiplier: 1,
          layerOpacity: { 'marquee-structure': 1, 'marquee-bulbs-a': 1, 'marquee-bulbs-b': 1, 'marquee-bulbs-c': 1, 'marquee-bulbs-d': 1, 'marquee-letter-lights-a': 1, 'marquee-letter-lights-b': 1, 'marquee-letter-lights-c': 1, 'marquee-equalizer-lights': 1, 'marquee-trim-lights': 1, 'marquee-focal-lights': 1, 'marquee-sparkle-lights': 1 },
        },
        breakdown: {
          density: 0.48,
          motionMultiplier: 1,
          hiddenLayerIds: ['marquee-bulbs-b', 'marquee-bulbs-d', 'marquee-letter-lights-a', 'marquee-letter-lights-c', 'marquee-equalizer-lights', 'marquee-trim-lights', 'marquee-sparkle-lights'],
          layerOpacity: { 'marquee-structure': 1, 'marquee-bulbs-a': 0.46, 'marquee-bulbs-c': 0.42, 'marquee-letter-lights-b': 0.22, 'marquee-focal-lights': 0.52 },
        },
        outro: {
          density: 0.26,
          motionMultiplier: 1,
          hiddenLayerIds: ['marquee-bulbs-c', 'marquee-bulbs-d', 'marquee-letter-lights-b', 'marquee-letter-lights-c', 'marquee-equalizer-lights', 'marquee-trim-lights', 'marquee-focal-lights', 'marquee-sparkle-lights'],
          layerOpacity: { 'marquee-structure': 1, 'marquee-bulbs-a': 0.28, 'marquee-bulbs-b': 0.16, 'marquee-letter-lights-a': 0.2 },
        },
      }),
    },
    {
      intensity: [0.84, 0.92, 0.96, 0.86, 1, 0.78, 0.72],
      motion: [0.02, 0.12, 0.28, 0.02, 0.42, 0.04, 0.02],
      glow: [0, 0, 0.02, 0, 0.04, 0, 0],
    },
  ),
]

/** Capability-based discovery for every renderer-supported PixGrid reaction path. */
export function isPixGridMusicReactivePreset(preset: ReactPreset): boolean {
  const settings = preset.pixGridSettings
  if (!settings) return false
  if (settings.performanceProgramId) return true
  if (settings.audioAssignments?.some(assignment => assignment.enabled)) return true
  if (settings.groups?.some(group => group.enabled && group.reactions.some(assignment => assignment.enabled))) return true
  return settings.layers?.some(layer => (
    layer.animations.some(animation => Boolean(animation.audioSource))
    || Boolean(
      layer.audioReactivity
      && (
        layer.audioReactivity.brightnessSource
        || layer.audioReactivity.scaleSource
        || (layer.audioReactivity.beatImpact ?? 0) !== 0
      )
    )
  )) ?? false
}

/** Built-in presets whose authored contract includes at least one live music-reactive capability. */
export const PIX_GRID_MUSIC_REACTIVE_PRESETS = PIX_GRID_PRESETS.filter(
  isPixGridMusicReactivePreset,
)

export const PIX_GRID_PRESET_BY_ID = new Map(PIX_GRID_PRESETS.map(item => [item.id, item]))
