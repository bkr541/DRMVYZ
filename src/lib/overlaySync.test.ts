/**
 * Regression tests for overlay clip timeline synchronization.
 *
 * Overlay videos must follow the timeline clock just like background clips.
 * The renderer computes:
 *
 *   ovLocalTime = timelineClock - oc.startSec
 *   desired     = getClipSourceTime(oc, ovLocalTime, videoDuration)
 *   shouldFreeze = shouldFreezeClipFrame(oc, ovLocalTime, videoDuration)
 *
 * These tests verify that the timeline math is correct for all overlay
 * scenarios so the renderer's sync path can be trusted.
 */

import { describe, it, expect } from 'vitest'
import { getClipSourceTime, shouldFreezeClipFrame } from './timeline'
import type { VzTimelineMediaClip } from '../types/timeline'

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeOverlayClip(overrides: Partial<VzTimelineMediaClip> = {}): VzTimelineMediaClip {
  return {
    id:           'oc-001',
    mediaId:      'media-001',
    startSec:     10,
    durationSec:  8,
    mediaInSec:   0,
    fitMode:      'contain',
    playbackMode: 'trim',
    lane:         'overlays',
    ...overrides,
  }
}

const VIDEO_DURATION = 30  // seconds of source video

// ── Scenario 1: scrub into middle of overlay ──────────────────────────────────

describe('overlay clip — scrub to mid-clip (mediaInSec: 0)', () => {
  it('desired source time equals localTimeSec when mediaInSec is 0', () => {
    const oc = makeOverlayClip({ startSec: 10, mediaInSec: 0 })
    // Timeline at 14s → localTime = 4s into clip
    const localTime = 14 - oc.startSec  // 4
    const desired = getClipSourceTime(oc, localTime, VIDEO_DURATION)
    expect(desired).toBeCloseTo(4, 5)
  })
})

// ── Scenario 2: non-zero mediaInSec ──────────────────────────────────────────

describe('overlay clip — non-zero mediaInSec', () => {
  it('desired source time is mediaInSec + localTimeSec', () => {
    const oc = makeOverlayClip({ startSec: 20, mediaInSec: 8 })
    // User scrubs to timeline 24s → localTime = 4s into clip
    const localTime = 24 - oc.startSec  // 4
    const desired = getClipSourceTime(oc, localTime, VIDEO_DURATION)
    // source time = 8 + 4 = 12
    expect(desired).toBeCloseTo(12, 5)
  })

  it('desired source time at clip start equals mediaInSec exactly', () => {
    const oc = makeOverlayClip({ startSec: 5, mediaInSec: 3 })
    const localTime = 0  // at the very start of the overlay
    const desired = getClipSourceTime(oc, localTime, VIDEO_DURATION)
    expect(desired).toBeCloseTo(3, 5)
  })
})

// ── Scenario 3: trim mode — should freeze at source clip end ─────────────────
// lengthSec = mediaOutSec - mediaInSec (not durationSec, which is the
// timeline duration). Use explicit mediaOutSec to bound the source range.

describe('overlay clip — trim/freeze mode (shouldFreezeClipFrame)', () => {
  it('does NOT freeze while inside the source range', () => {
    // source range [0, 8) → lengthSec = 8
    const oc = makeOverlayClip({ durationSec: 8, mediaInSec: 0, mediaOutSec: 8, playbackMode: 'trim' })
    expect(shouldFreezeClipFrame(oc, 5, VIDEO_DURATION)).toBe(false)
  })

  it('freezes when localTimeSec reaches the source length', () => {
    const oc = makeOverlayClip({ durationSec: 8, mediaInSec: 0, mediaOutSec: 8, playbackMode: 'trim' })
    expect(shouldFreezeClipFrame(oc, 8, VIDEO_DURATION)).toBe(true)
  })

  it('freezes when localTimeSec exceeds the source length', () => {
    const oc = makeOverlayClip({ durationSec: 8, mediaInSec: 0, mediaOutSec: 8, playbackMode: 'trim' })
    expect(shouldFreezeClipFrame(oc, 12, VIDEO_DURATION)).toBe(true)
  })
})

// ── Scenario 4: loop mode ─────────────────────────────────────────────────────

describe('overlay clip — loop mode', () => {
  it('never freezes in loop mode regardless of localTimeSec', () => {
    const oc = makeOverlayClip({ durationSec: 5, playbackMode: 'loop' })
    expect(shouldFreezeClipFrame(oc, 0, VIDEO_DURATION)).toBe(false)
    expect(shouldFreezeClipFrame(oc, 5, VIDEO_DURATION)).toBe(false)
    expect(shouldFreezeClipFrame(oc, 10, VIDEO_DURATION)).toBe(false)
  })

  it('wraps source time after one loop iteration', () => {
    // Source range [2, 7) → lengthSec = 5. mediaOutSec bounds the loop.
    const oc = makeOverlayClip({ startSec: 0, durationSec: 5, mediaInSec: 2, mediaOutSec: 7, playbackMode: 'loop' })
    // After one full pass (localTime = 5): 2 + (5 % 5) = 2 + 0 = 2
    const desired = getClipSourceTime(oc, 5, VIDEO_DURATION)
    expect(desired).toBeCloseTo(2, 5)
  })

  it('returns correct source time mid-loop', () => {
    // Source range [0, 6) → lengthSec = 6.
    const oc = makeOverlayClip({ startSec: 0, durationSec: 12, mediaInSec: 0, mediaOutSec: 6, playbackMode: 'loop' })
    // localTime = 8 → 0 + (8 % 6) = 2
    const desired = getClipSourceTime(oc, 8, VIDEO_DURATION)
    expect(desired).toBeCloseTo(2, 5)
  })
})

// ── Scenario 5: pause accuracy ───────────────────────────────────────────────

describe('overlay clip — pause-frame accuracy', () => {
  it('desired source time is stable when paused mid-clip', () => {
    const oc = makeOverlayClip({ startSec: 10, mediaInSec: 5, playbackMode: 'trim' })
    // Playhead is paused at timeline 13s → localTime = 3
    const localTime = 13 - oc.startSec  // 3
    const desired = getClipSourceTime(oc, localTime, VIDEO_DURATION)
    // source = 5 + 3 = 8
    expect(desired).toBeCloseTo(8, 5)
    // Not frozen at localTime 3 (< durationSec 8)
    expect(shouldFreezeClipFrame(oc, localTime, VIDEO_DURATION)).toBe(false)
  })
})
