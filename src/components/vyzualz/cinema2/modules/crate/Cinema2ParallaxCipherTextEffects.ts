import type { Cinema2ParallaxCipherPattern } from './Cinema2ParallaxCipherPatterns'
import { parallaxCipherScatterVector } from './Cinema2ParallaxCipherPatterns'

/**
 * Letter choreography for Parallax Cipher. Every pattern has its own text effect, and its own way to take a line off the stage and bring the next
 * one on. Offsets are in world units and radians. Effects are shaped so the letters are back on the solved reading line between beats (they jump on
 * the beat and settle, or stay a small fraction of a unit off), because the word has to read from the reveal camera in every pattern.
 */
export interface ParallaxCipherLetterPose {
  readonly dx: number
  readonly dy: number
  readonly dz: number
  readonly rotX: number
  readonly rotY: number
  readonly rotZ: number
  /** Multiplies the letter's solved scale. */
  readonly scale: number
  /** Multiplies the letter's bevel light (the word's average is what the shared bevel material shows). */
  readonly glow: number
}

export const REST_LETTER: ParallaxCipherLetterPose = Object.freeze({ dx: 0, dy: 0, dz: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1, glow: 1 })

/** Beats one line takes to leave and the next to arrive (half each). */
export const PARALLAX_CIPHER_TEXT_TRANSITION_BEATS = 4
/** How much of the leaving or arriving half is spent staggering the letters one after another. */
const STAGGER = 0.45

const hash = (a: number, b = 0) => { const value = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453; return value - Math.floor(value) }
const fract = (value: number) => value - Math.floor(value)
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => value * value * (3 - 2 * value)

/** The text effect each pattern plays on the letters, at amplitude 1. `index` counts across `count` letters. */
export function evaluateParallaxCipherLetter(pattern: Cinema2ParallaxCipherPattern, beats: number, index: number, count: number): ParallaxCipherLetterPose {
  const slow = beats * Math.PI / 4
  const centre = (count - 1) / 2
  const offset = index - centre
  const alternate = index % 2 === 0 ? 1 : -1
  switch (pattern) {
    // A light sweeps along the word every four beats.
    case 'reading-line': return { ...REST_LETTER, glow: 1 + 0.45 * Math.max(0, Math.sin(beats * Math.PI / 2 - index * 0.6)) ** 3 }
    // The word breathes open: the letters part from the middle and lean away from each other.
    case 'open-gate': {
      const breath = 0.5 + 0.5 * Math.sin(slow)
      return { ...REST_LETTER, dx: offset * 0.05 * breath, rotY: -offset * 0.05 * breath, glow: 0.85 + 0.35 * breath }
    }
    // Every beat the letters are drawn together and flare, then spring back.
    case 'collapse': {
      const hit = (1 - fract(beats)) ** 3
      return { ...REST_LETTER, dx: -offset * 0.11 * hit, scale: 1 - 0.07 * hit, glow: 1 + 1.2 * hit }
    }
    // Neighbouring letters wind against each other like gears.
    case 'counter-spiral': {
      const phase = slow + index * 0.55
      return { ...REST_LETTER, rotZ: alternate * 0.3 * Math.sin(phase), rotY: -alternate * 0.28 * Math.cos(phase), glow: 0.8 + 0.4 * (0.5 + 0.5 * Math.sin(phase * 2)) }
    }
    // A ripple runs along the word every four beats, lifting and tilting each letter as it passes.
    case 'cascade': {
      const wave = Math.sin(beats * Math.PI / 2 - index * 0.75)
      return { ...REST_LETTER, dy: 0.12 * wave, rotX: 0.28 * wave, glow: 0.6 + 1.2 * Math.max(0, wave) ** 2 }
    }
    // Each beat spins every letter on its own axes and lets it settle.
    case 'shatter': {
      const hit = Math.exp(-fract(beats) * 3.2)
      return {
        ...REST_LETTER,
        rotX: (hash(index, 1) - 0.5) * 2.4 * hit, rotY: (hash(index, 2) - 0.5) * 2.4 * hit, rotZ: (hash(index, 4) - 0.5) * 1.6 * hit,
        scale: 1 + 0.12 * hit, glow: 1 + 1.4 * hit,
      }
    }
  }
}

/** Where a letter goes as it leaves (`away` 0 to 1) in this pattern's style. `entering` mirrors the direction for the line arriving. */
function awayPose(pattern: Cinema2ParallaxCipherPattern, away: number, index: number, count: number, entering: boolean): ParallaxCipherLetterPose {
  const offset = index - (count - 1) / 2
  const alternate = index % 2 === 0 ? 1 : -1
  const gone = Math.max(0.001, 1 - away)
  switch (pattern) {
    // The letters fold over like split-flap tiles.
    case 'reading-line': return { ...REST_LETTER, rotX: alternate * 1.45 * away, scale: gone, glow: 1 + away }
    // The word parts down the middle and the letters slide out to the sides (and in from them).
    case 'open-gate': return { ...REST_LETTER, dx: offset * 0.8 * away, rotY: offset * 0.25 * away, scale: gone, glow: 1 + away }
    // The word implodes into its own centre.
    case 'collapse': return { ...REST_LETTER, dx: -offset * 0.55 * away, dz: -0.6 * away, scale: gone, glow: 1 + 1.5 * away }
    // The letters spin a half turn about their own height.
    case 'counter-spiral': return { ...REST_LETTER, rotY: alternate * Math.PI * away, rotZ: alternate * 0.5 * away, scale: gone, glow: 1 + away }
    // The letters drop away and the next line falls in from above.
    case 'cascade': return { ...REST_LETTER, dy: (entering ? 1 : -1) * 1.5 * away, rotX: (entering ? -1 : 1) * 0.9 * away, scale: gone, glow: 1 + away }
    // The letters are thrown apart and pulled back together.
    case 'shatter': {
      const thrown = parallaxCipherScatterVector(index)
      return { ...REST_LETTER, dx: thrown[0] * 1.6 * away, dy: thrown[1] * 1.6 * away, dz: thrown[2] * 1.6 * away, rotX: (hash(index, 1) - 0.5) * 5 * away, rotZ: (hash(index, 4) - 0.5) * 4 * away, scale: gone, glow: 1 + 1.4 * away }
    }
  }
}

/**
 * The line changing over. `progress` is 0 to 1 across the whole transition: the first half takes the old line away, the second half brings the new
 * one on. The letters are staggered across each half. Returns the rest pose outside the transition.
 */
export function evaluateParallaxCipherTransition(pattern: Cinema2ParallaxCipherPattern, progress: number, index: number, count: number): ParallaxCipherLetterPose {
  if (progress <= 0 || progress >= 1) return REST_LETTER
  const entering = progress >= 0.5
  const half = entering ? (progress - 0.5) * 2 : progress * 2
  const delay = count > 1 ? STAGGER * index / (count - 1) : 0
  const local = clamp01((half - delay) / (1 - STAGGER))
  const away = smooth(entering ? 1 - local : local)
  return awayPose(pattern, away, index, count, entering)
}

export function blendParallaxCipherLetter(from: ParallaxCipherLetterPose, to: ParallaxCipherLetterPose, t: number): ParallaxCipherLetterPose {
  const mix = (a: number, b: number) => a + (b - a) * t
  return {
    dx: mix(from.dx, to.dx), dy: mix(from.dy, to.dy), dz: mix(from.dz, to.dz), rotX: mix(from.rotX, to.rotX), rotY: mix(from.rotY, to.rotY), rotZ: mix(from.rotZ, to.rotZ),
    scale: mix(from.scale, to.scale), glow: mix(from.glow, to.glow),
  }
}

/** Scales a pose's departure from rest by `amount` (Letter Motion), so 0 is a still word and 1 the authored effect. */
export function scaleParallaxCipherLetter(pose: ParallaxCipherLetterPose, amount: number): ParallaxCipherLetterPose {
  return {
    dx: pose.dx * amount, dy: pose.dy * amount, dz: pose.dz * amount, rotX: pose.rotX * amount, rotY: pose.rotY * amount, rotZ: pose.rotZ * amount,
    scale: 1 + (pose.scale - 1) * amount, glow: 1 + (pose.glow - 1) * amount,
  }
}
