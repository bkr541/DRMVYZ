import { describe, expect, it } from 'vitest'
import { fitCinema2FovToMinAspect } from '../spatial/Cinema2CameraRuntime'
import { resolveCinema2SayItGlyphPoses, cinema2SayItIsExactlyAssembled } from '../modules/sayIt/Cinema2SayItMotion'
import {
  CINEMA2_SAY_IT_BASELINE_VIEWPORTS,
  CINEMA2_SAY_IT_CAMERA_DISTANCE,
  CINEMA2_SAY_IT_CAMERA_FOV_DEGREES,
  CINEMA2_SAY_IT_COMPOSED_MIN_ASPECT,
  CINEMA2_SAY_IT_QUALITY_PROFILES,
  CINEMA2_SAY_IT_VISUAL_BASELINES,
  limitCinema2SayItPosesForQuality,
} from '../modules/sayIt/Cinema2SayItQuality'
import {
  CINEMA2_SAY_IT_MAX_ASSEMBLED_HEIGHT,
  CINEMA2_SAY_IT_MAX_ASSEMBLED_WIDTH,
  resolveCinema2SayItTextLayout,
} from '../modules/sayIt/Cinema2SayItTextLayout'

const layout = resolveCinema2SayItTextLayout(
  { line1: 'ABCDEFGHIJKL', line2: '12345678' },
  { alignment: 'center', lineMode: 'two', tracking: 0.06, lineSpacing: 0.7, glyphScale: 1 },
)

describe('Cinema 2.0 SAY IT production quality policy', () => {
  it('keeps the complete bounded message at every quality tier', () => {
    const poses = resolveCinema2SayItGlyphPoses(4, { cycleSeconds: 8, motionAmount: 1, spread: 1 }, layout.glyphs)
    expect(poses).toHaveLength(20)
    expect(limitCinema2SayItPosesForQuality(poses, CINEMA2_SAY_IT_QUALITY_PROFILES.low)).toHaveLength(20)
    expect(limitCinema2SayItPosesForQuality(poses, CINEMA2_SAY_IT_QUALITY_PROFILES.medium)).toHaveLength(20)
    expect(limitCinema2SayItPosesForQuality(poses, CINEMA2_SAY_IT_QUALITY_PROFILES.high)).toHaveLength(20)
    expect(CINEMA2_SAY_IT_QUALITY_PROFILES.low.castShadows).toBe(false)
    expect(CINEMA2_SAY_IT_QUALITY_PROFILES.high.castShadows).toBe(true)
  })

  it('can apply a stricter future geometry budget without mutating poses', () => {
    const poses = resolveCinema2SayItGlyphPoses(4, { cycleSeconds: 8, motionAmount: 1, spread: 1 }, layout.glyphs)
    const limited = limitCinema2SayItPosesForQuality(poses, { ...CINEMA2_SAY_IT_QUALITY_PROFILES.low, maxVisibleGlyphs: 12 })
    expect(limited).toHaveLength(12)
    expect(poses).toHaveLength(20)
  })

  it('keeps the maximum text block inside wide, square and portrait camera frames', () => {
    for (const viewport of CINEMA2_SAY_IT_BASELINE_VIEWPORTS) {
      const aspect = viewport.width / viewport.height
      const fov = fitCinema2FovToMinAspect(CINEMA2_SAY_IT_CAMERA_FOV_DEGREES, aspect, CINEMA2_SAY_IT_COMPOSED_MIN_ASPECT)
      const viewHeight = 2 * Math.tan(fov * Math.PI / 360) * CINEMA2_SAY_IT_CAMERA_DISTANCE
      const viewWidth = viewHeight * aspect
      expect(viewWidth, viewport.id).toBeGreaterThan(CINEMA2_SAY_IT_MAX_ASSEMBLED_WIDTH * 1.15)
      expect(viewHeight, viewport.id).toBeGreaterThan(CINEMA2_SAY_IT_MAX_ASSEMBLED_HEIGHT * 1.15)
    }
  })

  it('defines deterministic assembled, separated and edge-on visual checkpoints', () => {
    expect(CINEMA2_SAY_IT_VISUAL_BASELINES.map(baseline => baseline.id)).toEqual([
      'assembled', 'maximum-separation', 'edge-on-rotation',
    ])
    for (const baseline of CINEMA2_SAY_IT_VISUAL_BASELINES) {
      const time = baseline.cyclePhase * 8
      const first = resolveCinema2SayItGlyphPoses(time, { cycleSeconds: 8, motionAmount: 1, spread: 1 }, layout.glyphs)
      const second = resolveCinema2SayItGlyphPoses(time, { cycleSeconds: 8, motionAmount: 1, spread: 1 }, layout.glyphs)
      expect(first).toEqual(second)
      expect(cinema2SayItIsExactlyAssembled(first, layout.glyphs)).toBe(baseline.id === 'assembled')
    }
  })
})
