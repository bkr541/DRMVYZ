import { describe, expect, it, vi } from 'vitest'
import { XyScopeTextV2MonoTap } from './XyScopeTextV2Audio'
import { XyScopeScopeWindow } from './XyScopeMotion'

describe('Text V2 actual mono waveform fallback', () => {
  it('reuses signed master samples and labels them mono rather than claiming stereo', () => {
    const analyser = { fftSize: 2048, context: { sampleRate: 48000 }, getFloatTimeDomainData: vi.fn((samples: Float32Array) => {
      for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * .1) * .3
    }) } as unknown as AnalyserNode
    const tap = new XyScopeTextV2MonoTap()
    const first = tap.read(analyser, 3)!
    expect(first.channelCount).toBe(1)
    expect(first.left).toBe(first.right)
    expect(first.left.some(value => value < 0)).toBe(true)
    const second = tap.read(analyser, 3.1)!
    expect(second.left).toBe(first.left)
    expect(second.sequenceNumber).toBe(first.sequenceNumber + 1)
    const scope = new XyScopeScopeWindow().update(second.left, second.right, 1 / 60, 3.1, second.channelCount)
    expect(scope.source).toBe('mono')
    expect(scope.cloudX.every(value => value === 0)).toBe(true)
    expect(scope.cloudY.some(value => value !== 0)).toBe(true)
  })
  it('keeps unavailable or undersized analysers out of the capture path without changing their settings', () => {
    const tap = new XyScopeTextV2MonoTap()
    expect(tap.read(null, 0)).toBeNull()
    const small = { fftSize: 512, getFloatTimeDomainData: vi.fn() } as unknown as AnalyserNode
    expect(tap.read(small, 0)).toBeNull()
    expect(small.fftSize).toBe(512)
    expect(small.getFloatTimeDomainData).not.toHaveBeenCalled()
  })
})
