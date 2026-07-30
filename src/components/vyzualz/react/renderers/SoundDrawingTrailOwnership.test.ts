import { describe, expect, it } from 'vitest'
import {
  computeSoundDrawingHistoryWriteAlpha,
  computeSoundDrawingTrailDecayAlpha,
  resolveAuthoredSoundDrawingTrailDecay,
} from './soundDrawing/SoundDrawingTrailComposition'

const base = {
  manualTrailDecay: 0.7,
  dtSeconds: 1 / 60,
  trailLockEnabled: false,
  trailLockMode: 'manualResolved' as const,
  trailLockSnapshotDecay: null,
  globalTrailPersistence: 0.75,
  activeSourceTrail: 0.4,
  feedbackAmount: 0.2,
  livingRibbonActive: false,
  livingRibbonTrailDetail: 1,
}

describe('Sound Drawing trail ownership', () => {
  it('protects captured manual Trail Decay at final composition for version 2 locks', () => {
    const result = resolveAuthoredSoundDrawingTrailDecay({
      ...base,
      trailLockEnabled: true,
      trailLockSnapshotDecay: 0.42,
    })
    expect(result.owner).toBe('manualResolvedLock')
    expect(result.alpha).toBeCloseTo(computeSoundDrawingTrailDecayAlpha(0.42, 1 / 60))
  })

  it('retains the historical authored recipe for legacy locks', () => {
    const legacy = resolveAuthoredSoundDrawingTrailDecay({
      ...base,
      trailLockEnabled: true,
      trailLockMode: 'legacyRecipe',
    })
    const unlocked = resolveAuthoredSoundDrawingTrailDecay(base)
    expect(legacy.owner).toBe('authoredMix')
    expect(legacy.alpha).toBe(unlocked.alpha)
  })

  it('keeps Trail Decay and authored Trail Intensity inputs measurably distinct', () => {
    const baseline = resolveAuthoredSoundDrawingTrailDecay(base)
    const manualChanged = resolveAuthoredSoundDrawingTrailDecay({ ...base, manualTrailDecay: 0.2 })
    const authoredChanged = resolveAuthoredSoundDrawingTrailDecay({ ...base, globalTrailPersistence: 0.3 })
    expect(manualChanged.alpha).not.toBe(baseline.alpha)
    expect(authoredChanged.alpha).not.toBe(baseline.alpha)
    expect(manualChanged.alpha).not.toBe(authoredChanged.alpha)
  })

  it('gives corrected manual protection final precedence over authored and Ribbon persistence', () => {
    const protectedA = resolveAuthoredSoundDrawingTrailDecay({
      ...base,
      trailLockEnabled: true,
      trailLockSnapshotDecay: 0.42,
      globalTrailPersistence: 0.1,
      livingRibbonActive: false,
    })
    const protectedB = resolveAuthoredSoundDrawingTrailDecay({
      ...base,
      trailLockEnabled: true,
      trailLockSnapshotDecay: 0.42,
      globalTrailPersistence: 0.95,
      activeSourceTrail: 1,
      feedbackAmount: 1,
      livingRibbonActive: true,
      livingRibbonTrailDetail: 0.25,
    })
    expect(protectedB.authoredPersistence).not.toBe(protectedA.authoredPersistence)
    expect(protectedB.alpha).toBe(protectedA.alpha)
  })

  it('uses each authored layer persistence and feedback instead of only the global recipe', () => {
    const shortTrail = resolveAuthoredSoundDrawingTrailDecay({
      ...base,
      layerTrailPersistence: 0.15,
      layerFeedbackAmount: 0.05,
    })
    const longTrail = resolveAuthoredSoundDrawingTrailDecay({
      ...base,
      layerTrailPersistence: 0.95,
      layerFeedbackAmount: 0.9,
    })
    expect(longTrail.authoredPersistence).toBeGreaterThan(shortTrail.authoredPersistence)
    expect(longTrail.alpha).toBeLessThan(shortTrail.alpha)
  })

  it('keeps authored trail decay equivalent across 30fps and 60fps', () => {
    const at30 = resolveAuthoredSoundDrawingTrailDecay({ ...base, dtSeconds: 1 / 30 })
    const at60 = resolveAuthoredSoundDrawingTrailDecay({ ...base, dtSeconds: 1 / 60 })
    const retentionAt30 = 1 - at30.alpha
    const retentionAcrossTwo60Frames = Math.pow(1 - at60.alpha, 2)
    expect(retentionAcrossTwo60Frames).toBeCloseTo(retentionAt30, 6)
  })

  it('keeps temporal history writes bounded while feedback changes trail weight', () => {
    const low = computeSoundDrawingHistoryWriteAlpha(0.2, 0.1)
    const high = computeSoundDrawingHistoryWriteAlpha(0.9, 0.9)
    expect(low).toBeGreaterThanOrEqual(0.42)
    expect(high).toBeLessThanOrEqual(0.88)
    expect(high).toBeGreaterThan(low)
  })

})
