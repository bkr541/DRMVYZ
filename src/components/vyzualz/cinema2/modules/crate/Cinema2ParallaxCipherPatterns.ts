import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../Cinema2AfterhoursNativeModule'

/**
 * Parallax Cipher patterns. Each one poses the fourteen plate banks (seven per side, index 0 nearest the viewer) and the weave from the shared beat position.
 * A pattern never moves the lettering's solved depths: the glyphs may be thrown off the reading line for a moment (Shatter) but always settle back onto it,
 * so the word is readable at the camera's hold in every pattern.
 */
export const CINEMA2_PARALLAX_CIPHER_PATTERNS = Object.freeze([
  Object.freeze({ value: 'reading-line', label: 'Reading Line' }),
  Object.freeze({ value: 'open-gate', label: 'Open Gate' }),
  Object.freeze({ value: 'collapse', label: 'Collapse' }),
  Object.freeze({ value: 'counter-spiral', label: 'Counter Spiral' }),
  Object.freeze({ value: 'cascade', label: 'Cascade' }),
  Object.freeze({ value: 'shatter', label: 'Shatter' }),
] as const)
export type Cinema2ParallaxCipherPattern = typeof CINEMA2_PARALLAX_CIPHER_PATTERNS[number]['value']
export const CINEMA2_PARALLAX_CIPHER_PATTERN_IDS: readonly Cinema2ParallaxCipherPattern[] = Object.freeze(CINEMA2_PARALLAX_CIPHER_PATTERNS.map(pattern => pattern.value))
export const CINEMA2_PARALLAX_CIPHER_DEFAULT_PATTERN: Cinema2ParallaxCipherPattern = 'reading-line'
export const CINEMA2_PARALLAX_CIPHER_TRIGGER_IDS = CINEMA2_AFTERHOURS_TRIGGER_IDS
export const PARALLAX_CIPHER_BANK_COUNT = 7

/** One plate bank's pose. spread multiplies its lateral distance, twist/tip add to its authored turn/tip (radians), lift is world units, glow multiplies its contour light. */
export interface ParallaxCipherBankPose { readonly spread: number; readonly twist: number; readonly tip: number; readonly lift: number; readonly glow: number }
/** The whole-scene pose: scatter throws the letters off the reading line (world units, settles to zero), recoil scales the letters' turn, weave* pose the knot. */
export interface ParallaxCipherScenePose { readonly scatter: number; readonly recoil: number; readonly weaveScale: number; readonly weaveSpin: number }

const hash = (a: number, b = 0) => { const value = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453; return value - Math.floor(value) }
const fract = (value: number) => value - Math.floor(value)
const REST_BANK: ParallaxCipherBankPose = Object.freeze({ spread: 1, twist: 0, tip: 0, lift: 0, glow: 1 })
const REST_SCENE: ParallaxCipherScenePose = Object.freeze({ scatter: 0, recoil: 1, weaveScale: 1, weaveSpin: 0 })

export function evaluateParallaxCipherBank(pattern: Cinema2ParallaxCipherPattern, beats: number, index: number, side: number): ParallaxCipherBankPose {
  const slow = beats * Math.PI / 4
  switch (pattern) {
    case 'reading-line': return REST_BANK
    // The walls swing wide and breathe open over two bars, so the corridor reads as a gate.
    case 'open-gate': {
      const breath = 0.5 + 0.5 * Math.sin(slow - index * 0.18)
      return { spread: 1.16 + 0.22 * breath, twist: -0.3 * (0.55 + 0.45 * breath), tip: 0, lift: 0, glow: 0.8 + 0.4 * breath }
    }
    // The walls turn in and squeeze toward the lettering with a heartbeat on every beat, nearest banks hardest.
    case 'collapse': {
      const beat = (1 - fract(beats)) ** 3
      const near = 1 + (PARALLAX_CIPHER_BANK_COUNT - 1 - index) / 10
      return { spread: 0.74 - 0.06 * beat, twist: 0.36 + 0.06 * beat, tip: side * 0.08, lift: 0, glow: (0.65 + 1.15 * beat) * near }
    }
    // Neighbouring banks wind against each other, so the walls read as turning gears rather than a single mass.
    case 'counter-spiral': {
      const alternate = index % 2 === 0 ? 1 : -1
      const phase = slow + index * 0.55
      return { spread: 1, twist: alternate * 0.36 * Math.sin(phase), tip: -alternate * 0.2 * Math.cos(phase), lift: 0, glow: 0.7 + 0.5 * (0.5 + 0.5 * Math.sin(phase * 2)) }
    }
    // A wave runs from the nearest bank to the farthest every four beats, lifting each bank and lighting it as it passes.
    case 'cascade': {
      const wave = Math.sin(beats * Math.PI / 2 - index * 0.75)
      return { spread: 1 + 0.14 * wave, twist: 0.12 * wave, tip: 0, lift: 0.55 * wave, glow: 0.3 + 1.6 * Math.max(0, wave) ** 2 }
    }
    // Each beat throws every bank to its own random pose and lets it settle: the walls fly apart and are pulled back.
    case 'shatter': {
      const burst = Math.exp(-fract(beats) * 3.2)
      const a = hash(index, side), b = hash(index + 9, side), c = hash(index + 21, side)
      return { spread: 1.25 + 0.3 * a * burst, twist: (a - 0.5) * 0.9 * (0.45 + 0.55 * burst), tip: (b - 0.5) * 0.6 * burst, lift: (c - 0.5) * 1.7 * burst, glow: 1.1 + 1.1 * burst }
    }
  }
}

export function evaluateParallaxCipherScene(pattern: Cinema2ParallaxCipherPattern, beats: number): ParallaxCipherScenePose {
  const slow = beats * Math.PI / 4
  switch (pattern) {
    case 'reading-line': return REST_SCENE
    case 'open-gate': return { scatter: 0, recoil: 0.8, weaveScale: 1.12, weaveSpin: 0 }
    case 'collapse': return { scatter: 0, recoil: 0.6, weaveScale: 0.9 + 0.1 * (1 - fract(beats)) ** 3, weaveSpin: 0 }
    case 'counter-spiral': return { scatter: 0, recoil: 1, weaveScale: 1, weaveSpin: beats * 0.1 + 0.2 * Math.sin(slow) }
    case 'cascade': return { scatter: 0, recoil: 1.1, weaveScale: 1 + 0.06 * Math.sin(beats * Math.PI / 2), weaveSpin: 0 }
    case 'shatter': {
      const burst = Math.exp(-fract(beats) * 3.2)
      return { scatter: 0.75 * burst, recoil: 1.6, weaveScale: 1.2 + 0.2 * burst, weaveSpin: beats * 0.3 }
    }
  }
}

/** The direction one glyph is thrown, as a unit-ish world vector with its own reach (so the letters do not all fly out the same distance). */
export function parallaxCipherScatterVector(characterIndex: number): readonly [number, number, number] {
  const angle = hash(characterIndex, 3) * Math.PI * 2
  const reach = 0.8 + hash(characterIndex, 5) * 0.8
  return [Math.cos(angle) * reach, Math.sin(angle) * reach, (hash(characterIndex, 7) - 0.5) * 2 * reach]
}

export function blendParallaxCipherBank(from: ParallaxCipherBankPose, to: ParallaxCipherBankPose, t: number): ParallaxCipherBankPose {
  const mix = (a: number, b: number) => a + (b - a) * t
  return { spread: mix(from.spread, to.spread), twist: mix(from.twist, to.twist), tip: mix(from.tip, to.tip), lift: mix(from.lift, to.lift), glow: mix(from.glow, to.glow) }
}

export function blendParallaxCipherScene(from: ParallaxCipherScenePose, to: ParallaxCipherScenePose, t: number): ParallaxCipherScenePose {
  const mix = (a: number, b: number) => a + (b - a) * t
  return { scatter: mix(from.scatter, to.scatter), recoil: mix(from.recoil, to.recoil), weaveScale: mix(from.weaveScale, to.weaveScale), weaveSpin: mix(from.weaveSpin, to.weaveSpin) }
}
