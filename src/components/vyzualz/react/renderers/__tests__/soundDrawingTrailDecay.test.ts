import { describe, it, expect } from 'vitest'
import {
  computeSoundDrawingTrailDecayAlpha,
  computeSoundDrawingTrailRetention,
  computeSoundDrawingTrailRetentionPerReferenceFrame,
} from '../SoundDrawingRenderer'

const FRAME_30FPS = 1 / 30
const FRAME_60FPS = 1 / 60

describe('computeSoundDrawingTrailRetentionPerReferenceFrame', () => {
  it('spans [0.35, 0.97] across the 0..1 trailDecay range', () => {
    expect(computeSoundDrawingTrailRetentionPerReferenceFrame(0)).toBeCloseTo(0.97, 10)
    expect(computeSoundDrawingTrailRetentionPerReferenceFrame(1)).toBeCloseTo(0.35, 10)
  })

  it('is monotonically decreasing as trailDecay increases (higher = faster decay)', () => {
    const a = computeSoundDrawingTrailRetentionPerReferenceFrame(0.2)
    const b = computeSoundDrawingTrailRetentionPerReferenceFrame(0.5)
    const c = computeSoundDrawingTrailRetentionPerReferenceFrame(0.8)
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })

  it('clamps out-of-range input to the same bounds', () => {
    expect(computeSoundDrawingTrailRetentionPerReferenceFrame(-5)).toBeCloseTo(0.97, 10)
    expect(computeSoundDrawingTrailRetentionPerReferenceFrame(5)).toBeCloseTo(0.35, 10)
  })
})

describe('computeSoundDrawingTrailRetention (frame-rate independence)', () => {
  it('matches the reference measurement at 30fps: ~0.35 retention at trailDecay=1', () => {
    expect(computeSoundDrawingTrailRetention(1, FRAME_30FPS)).toBeCloseTo(0.35, 6)
  })

  it('matches the reference measurement at 60fps: ~0.59 retention at trailDecay=1 (0.35^0.5)', () => {
    expect(computeSoundDrawingTrailRetention(1, FRAME_60FPS)).toBeCloseTo(Math.sqrt(0.35), 6)
    expect(computeSoundDrawingTrailRetention(1, FRAME_60FPS)).toBeCloseTo(0.5916, 3)
  })

  it('decays to the noise floor (~4%) within 3-4 frames at 30fps', () => {
    const threeFrames = computeSoundDrawingTrailRetention(1, FRAME_30FPS * 3)
    expect(threeFrames).toBeLessThan(0.05)
  })

  it('decays to the noise floor within the equivalent wall-clock time at 60fps (twice the frame count)', () => {
    const sixFrames = computeSoundDrawingTrailRetention(1, FRAME_60FPS * 6)
    expect(sixFrames).toBeLessThan(0.05)
  })

  it('holds the same visual decay across 30/60/120fps for the same elapsed wall-clock time', () => {
    const elapsedSeconds = 0.1
    const at30 = computeSoundDrawingTrailRetention(0.5, elapsedSeconds)
    const at60 = computeSoundDrawingTrailRetention(0.5, elapsedSeconds)
    const at120 = computeSoundDrawingTrailRetention(0.5, elapsedSeconds)
    // Same trailDecay + same elapsed time must produce the same retention regardless
    // of how many discrete frames it took to get there — the whole point of scaling
    // by dtSeconds instead of a fixed per-frame constant.
    expect(at30).toBeCloseTo(at60, 12)
    expect(at60).toBeCloseTo(at120, 12)
  })

  it('two 60fps half-frames compound to the same retention as one 30fps frame', () => {
    const oneStepAt30 = computeSoundDrawingTrailRetention(0.7, FRAME_30FPS)
    const perStepAt60 = computeSoundDrawingTrailRetention(0.7, FRAME_60FPS)
    const twoStepsAt60 = perStepAt60 * perStepAt60
    expect(twoStepsAt60).toBeCloseTo(oneStepAt30, 10)
  })

  it('zero elapsed time returns full retention (1)', () => {
    expect(computeSoundDrawingTrailRetention(1, 0)).toBeCloseTo(1, 10)
  })

  it('negative dt is treated as zero', () => {
    expect(computeSoundDrawingTrailRetention(0.5, -1)).toBeCloseTo(1, 10)
  })
})

describe('computeSoundDrawingTrailDecayAlpha', () => {
  it('is 1 - retention', () => {
    const retention = computeSoundDrawingTrailRetention(0.4, FRAME_30FPS)
    const alpha = computeSoundDrawingTrailDecayAlpha(0.4, FRAME_30FPS)
    expect(alpha).toBeCloseTo(1 - retention, 10)
  })

  it('is floored so the trail never fully freezes even at trailDecay=0 with dt=0', () => {
    const alpha = computeSoundDrawingTrailDecayAlpha(0, 0)
    expect(alpha).toBeGreaterThanOrEqual(0.01)
  })

  it('approaches (but does not exceed) 1 for large elapsed time', () => {
    const alpha = computeSoundDrawingTrailDecayAlpha(1, 5)
    expect(alpha).toBeLessThanOrEqual(1)
    expect(alpha).toBeGreaterThan(0.99)
  })
})
