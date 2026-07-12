import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AUDIO_PREPARATION_LIMITS,
  AudioPreparationLimitError,
  assertSafeAudioPreparation,
  detectAudioPreparationEnvironment,
  estimateAudioPreparationWorkload,
} from './audioPreparationLimits'

describe('audio preparation workload limits', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the larger Electron budget only when the trusted preload bridge verifies the runtime', () => {
    vi.stubGlobal('navigator', { userAgent: 'Electron/99.0' })
    vi.stubGlobal('window', {})
    expect(detectAudioPreparationEnvironment()).toBe('browser')

    vi.stubGlobal('window', { drmvyzNative: { runtime: { isElectron: true, platform: 'darwin' } } })
    expect(detectAudioPreparationEnvironment()).toBe('electron')
  })

  it('rejects oversized source bytes before decode allocation', () => {
    expect(() => assertSafeAudioPreparation({
      sourceBytes: AUDIO_PREPARATION_LIMITS.browser.maxSourceBytes + 1,
      durationSeconds: null,
      sourceSampleRate: null,
      sourceChannels: null,
      contentLengthKnown: true,
    }, 'browser')).toThrowError(expect.objectContaining({ factor: 'source-size' }))
  })

  it('uses a stricter cap when Content-Length is unavailable', () => {
    expect(() => assertSafeAudioPreparation({
      sourceBytes: AUDIO_PREPARATION_LIMITS.browser.maxUnknownLengthBytes + 1,
      durationSeconds: null,
      sourceSampleRate: null,
      sourceChannels: null,
      contentLengthKnown: false,
    }, 'browser')).toThrowError(expect.objectContaining({ factor: 'unknown-source-size' }))
  })

  it('rejects decoded PCM expansion even when the compressed source is modest', () => {
    expect(() => assertSafeAudioPreparation({
      sourceBytes: 80 * 1024 * 1024,
      durationSeconds: 40 * 60,
      sourceSampleRate: 96_000,
      sourceChannels: 2,
      contentLengthKnown: true,
    }, 'browser')).toThrowError(AudioPreparationLimitError)

    try {
      assertSafeAudioPreparation({
        sourceBytes: 80 * 1024 * 1024,
        durationSeconds: 40 * 60,
        sourceSampleRate: 96_000,
        sourceChannels: 2,
        contentLengthKnown: true,
      }, 'browser')
    } catch (error) {
      expect((error as AudioPreparationLimitError).factor).toBe('decoded-pcm')
    }
  })

  it('rejects excessive channels and duration conservatively', () => {
    expect(() => assertSafeAudioPreparation({
      sourceBytes: 32 * 1024 * 1024,
      durationSeconds: 10 * 60,
      sourceSampleRate: 48_000,
      sourceChannels: 9,
    }, 'browser')).toThrowError(expect.objectContaining({ factor: 'channels' }))

    expect(() => assertSafeAudioPreparation({
      sourceBytes: 32 * 1024 * 1024,
      durationSeconds: AUDIO_PREPARATION_LIMITS.browser.maxDurationSeconds + 1,
      sourceSampleRate: 44_100,
      sourceChannels: 2,
    }, 'browser')).toThrowError(expect.objectContaining({ factor: 'duration' }))
  })

  it('rejects excessive resampling work below the decoded byte ceiling', () => {
    expect(() => assertSafeAudioPreparation({
      sourceBytes: 48 * 1024 * 1024,
      durationSeconds: 1_000,
      sourceSampleRate: 48_000,
      sourceChannels: 4,
    }, 'electron')).toThrowError(expect.objectContaining({ factor: 'resampling-work' }))
  })

  it('allows a safe-size stereo track and computes bounded chunks', () => {
    const estimate = assertSafeAudioPreparation({
      sourceBytes: 24 * 1024 * 1024,
      durationSeconds: 8 * 60,
      sourceSampleRate: 48_000,
      sourceChannels: 2,
      contentLengthKnown: true,
    }, 'browser')
    expect(estimate.chunkCount).toBeGreaterThan(0)
    expect(estimate.chunkBytes).toBeLessThanOrEqual(AUDIO_PREPARATION_LIMITS.targetChunkBytes)
    expect(estimate.expectedPeakBytes).toBeLessThanOrEqual(AUDIO_PREPARATION_LIMITS.browser.maxPeakBytes)
  })

  it('documents unknown decode pressure with a conservative peak estimate', () => {
    const estimate = estimateAudioPreparationWorkload({
      sourceBytes: 64 * 1024 * 1024,
      durationSeconds: null,
      sourceSampleRate: null,
      sourceChannels: null,
      contentLengthKnown: false,
    }, 'browser')
    expect(estimate.expectedPeakBytes).toBeGreaterThan(estimate.sourceBytes * 2)
    expect(estimate.temporaryCopyBytes).toBeGreaterThan(0)
  })
})
