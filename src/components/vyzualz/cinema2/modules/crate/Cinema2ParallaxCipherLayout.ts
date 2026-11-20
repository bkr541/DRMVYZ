import type { Cinema2CameraPathPointManifest, Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import { resolveCinema2SayItTextLayout, type Cinema2GlyphMetrics } from '../sayIt/Cinema2SayItTextLayout'

export const PARALLAX_CIPHER_TEXT = 'PARADOX'
export const PARALLAX_CIPHER_EYE: Cinema2Vector3 = [0, .55, 13.4]
export const PARALLAX_CIPHER_TARGET: Cinema2Vector3 = [0, .55, 0]
export const PARALLAX_CIPHER_DURATION = 24

const RIGHT_SIGHTLINE: Cinema2Vector3 = [4.35, 1.72, 12.65]
const LEFT_SIGHTLINE: Cinema2Vector3 = [-4.15, -.62, 12.72]
const CIPHER_DEPTHS = [3.1, -1.85, 4.35, -3.8, .25, -4.65, 3.65, -1.1, 4.6, -2.9, 1.65, -5.2]
const CAMERA_STOPS = [
  { at: 0, eye: PARALLAX_CIPHER_EYE }, { at: 3, eye: PARALLAX_CIPHER_EYE },
  { at: 7.5, eye: RIGHT_SIGHTLINE }, { at: 12, eye: PARALLAX_CIPHER_EYE },
  { at: 15, eye: PARALLAX_CIPHER_EYE }, { at: 19.5, eye: LEFT_SIGHTLINE },
  { at: 24, eye: PARALLAX_CIPHER_EYE },
]

export function sampleParallaxCipherEye(seconds: number): Cinema2Vector3 {
  const time = ((seconds % PARALLAX_CIPHER_DURATION) + PARALLAX_CIPHER_DURATION) % PARALLAX_CIPHER_DURATION
  const endIndex = CAMERA_STOPS.findIndex(stop => stop.at > time)
  const left = CAMERA_STOPS[endIndex - 1]!
  const right = CAMERA_STOPS[endIndex]!
  const elapsed = (time - left.at) / (right.at - left.at)
  const eased = elapsed ** 3 * (10 + elapsed * (-15 + elapsed * 6))
  return [
    left.eye[0] + (right.eye[0] - left.eye[0]) * eased,
    left.eye[1] + (right.eye[1] - left.eye[1]) * eased,
    left.eye[2] + (right.eye[2] - left.eye[2]) * eased,
  ]
}

export const PARALLAX_CIPHER_CAMERA_POINTS: readonly Cinema2CameraPathPointManifest[] = Array.from(
  { length: PARALLAX_CIPHER_DURATION * 4 + 1 },
  (_, index) => ({ position: sampleParallaxCipherEye(index / 4), target: PARALLAX_CIPHER_TARGET }),
)

/** `stagger` scales every letter's solved depth (0 puts the whole word on one plane, 1 is authored); the ray projection keeps the word readable at the reveal for any value. */
export function layoutParallaxCipherGlyphs(text: unknown, fontMetrics?: Readonly<Cinema2GlyphMetrics>, stagger = 1) {
  const layout = resolveCinema2SayItTextLayout(text, { alignment: 'center', lineMode: 'one', tracking: .13, lineSpacing: 1, glyphScale: 1.5 }, fontMetrics)
  const enlargement = Math.min(1.7, 8.7 / Math.max(.01, layout.width))
  const eye = PARALLAX_CIPHER_EYE
  return layout.glyphs.map((glyph, index) => {
    const depth = CIPHER_DEPTHS[index % CIPHER_DEPTHS.length]! * stagger
    const rayScale = (eye[2] - depth) / eye[2]
    const aligned: Cinema2Vector3 = [glyph.position[0] * enlargement, eye[1] + glyph.position[1] * enlargement, 0]
    // Scale the entire mesh along its viewing rays from the authored eye.
    // This preserves even the bevel projections at the reading position.
    const position: Cinema2Vector3 = [aligned[0] * rayScale, eye[1] + (aligned[1] - eye[1]) * rayScale, depth]
    return { glyph, aligned, position, scale: glyph.scale * enlargement * rayScale }
  })
}
