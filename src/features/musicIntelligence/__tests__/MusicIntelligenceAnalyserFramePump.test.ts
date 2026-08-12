import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioFeatureBus } from '../AudioFeatureBus'
import { MusicIntelligenceAnalyserFramePump } from '../MusicIntelligenceAnalyserFramePump'
import { MusicIntelligenceEngine } from '../MusicIntelligenceEngine'

function analyserFixture(options: { frequencyBinCount?: number; fftSize?: number; value?: number } = {}) {
  const value = options.value ?? 192
  const getByteFrequencyData = vi.fn((buffer: Uint8Array) => buffer.fill(value))
  const getByteTimeDomainData = vi.fn((buffer: Uint8Array) => buffer.fill(128 + Math.floor(value / 8)))
  return {
    analyser: {
      frequencyBinCount: options.frequencyBinCount ?? 32,
      fftSize: options.fftSize ?? 64,
      context: { sampleRate: 48_000 },
      getByteFrequencyData,
      getByteTimeDomainData,
    } as unknown as AnalyserNode,
    getByteFrequencyData,
    getByteTimeDomainData,
  }
}

describe('MusicIntelligenceAnalyserFramePump', () => {
  beforeEach(() => AudioFeatureBus.reset())

  it('reuses analyser buffers and publishes through the canonical Music Intelligence engine', () => {
    const engine = new MusicIntelligenceEngine()
    engine.setSourceId('track-a', 'track-a')
    const fixture = analyserFixture()
    const pump = new MusicIntelligenceAnalyserFramePump({ publisherId: 'test:pixGrid', engine })

    const first = pump.sample({ analyser: fixture.analyser, audioTime: 1, isPlaying: true, trackIdentity: 'track-a' })
    const second = pump.sample({ analyser: fixture.analyser, audioTime: 1.02, isPlaying: true, trackIdentity: 'track-a' })

    expect(fixture.getByteFrequencyData).toHaveBeenCalledTimes(2)
    expect(fixture.getByteTimeDomainData).toHaveBeenCalledTimes(2)
    expect(first.frameId).toBeGreaterThan(0)
    expect(second.frameId).toBeGreaterThan(first.frameId)
    expect(second.raw.freqData).toHaveLength(32)
    expect(second.raw.timeDomainData).toHaveLength(64)
    expect(second.bands.volume).toBeGreaterThan(0)
    expect(AudioFeatureBus.getPublicationMeta().publisherId).toBe('test:pixGrid')
    expect(pump.diagnostics).toMatchObject({
      sampleCount: 2,
      reusedBufferCount: 2,
      frequencyBufferLength: 32,
      timeDomainBufferLength: 64,
    })
  })

  it('reallocates safely when the analyser or track changes', () => {
    const engine = new MusicIntelligenceEngine()
    engine.setSourceId('track-a', 'track-a')
    const first = analyserFixture({ frequencyBinCount: 16, fftSize: 32 })
    const second = analyserFixture({ frequencyBinCount: 48, fftSize: 96 })
    const pump = new MusicIntelligenceAnalyserFramePump({ publisherId: 'test:pixGrid', engine })

    pump.sample({ analyser: first.analyser, audioTime: 2, isPlaying: true, trackIdentity: 'track-a' })
    engine.setSourceId('track-b', 'track-b')
    pump.sample({ analyser: second.analyser, audioTime: 0, isPlaying: true, trackIdentity: 'track-b' })

    expect(first.getByteFrequencyData).toHaveBeenCalledOnce()
    expect(second.getByteFrequencyData).toHaveBeenCalledOnce()
    expect(pump.diagnostics).toMatchObject({ frequencyBufferLength: 48, timeDomainBufferLength: 96 })
  })

  it('does not duplicate a fresh authoritative publication for the same analyser time', () => {
    const engine = new MusicIntelligenceEngine()
    engine.setSourceId('track-a', 'track-a')
    const fixture = analyserFixture()
    const frequencyData = new Uint8Array(32).fill(220) as Uint8Array<ArrayBuffer>
    const timeDomainData = new Uint8Array(64).fill(150) as Uint8Array<ArrayBuffer>
    engine.updateFromAudioFrame({
      freqBuf: frequencyData,
      timeBuf: timeDomainData,
      sampleRate: 48_000,
      audioTime: 3,
      isPlaying: true,
      publisherId: 'central:audio',
    })
    AudioFeatureBus.updatePartial({ timeSec: 3 })
    const pump = new MusicIntelligenceAnalyserFramePump({
      publisherId: 'test:pixGrid',
      engine,
      now: () => AudioFeatureBus.getFramePublicationMeta().publishedAtMs,
    })

    const frame = pump.sample({ analyser: fixture.analyser, audioTime: 3, isPlaying: true, trackIdentity: 'track-a' })

    expect(frame.frameId).toBeGreaterThan(0)
    expect(fixture.getByteFrequencyData).not.toHaveBeenCalled()
    expect(fixture.getByteTimeDomainData).not.toHaveBeenCalled()
    expect(pump.diagnostics.skippedDuplicateCount).toBe(1)
  })

  it('keeps the first canonical publication stable when two publishers pump the same transport instant', () => {
    const engine = new MusicIntelligenceEngine()
    engine.setSourceId('track-a', 'track-a')
    const firstFrequencyData = new Uint8Array(32).fill(210) as Uint8Array<ArrayBuffer>
    const secondFrequencyData = new Uint8Array(32).fill(12) as Uint8Array<ArrayBuffer>
    const timeDomainData = new Uint8Array(64).fill(128) as Uint8Array<ArrayBuffer>

    engine.updateFromAudioFrame({
      freqBuf: firstFrequencyData,
      timeBuf: timeDomainData,
      sampleRate: 48_000,
      audioTime: 5,
      isPlaying: true,
      publisherId: 'react:placeholder',
    })
    const firstFrame = AudioFeatureBus.getFrame()
    const firstMeta = AudioFeatureBus.getFramePublicationMeta()

    engine.updateFromAudioFrame({
      freqBuf: secondFrequencyData,
      timeBuf: timeDomainData,
      sampleRate: 48_000,
      audioTime: 5,
      isPlaying: true,
      publisherId: 'react:shader',
    })

    expect(AudioFeatureBus.getFrame()).toBe(firstFrame)
    expect(AudioFeatureBus.getFrame().frameId).toBe(firstFrame.frameId)
    expect(AudioFeatureBus.getFrame().raw.freqData).toBe(firstFrequencyData)
    expect(AudioFeatureBus.getFramePublicationMeta()).toEqual(firstMeta)
    expect(firstMeta.publisherId).toBe('react:placeholder')
  })

  it('resets stateful drum detection across backward/forward transport discontinuities and re-arms afterward', () => {
    const engine = new MusicIntelligenceEngine()
    engine.setSourceId('track-a', 'track-a')
    const timeDomainData = new Uint8Array(512).fill(128) as Uint8Array<ArrayBuffer>
    const baseline = new Uint8Array(256).fill(24) as Uint8Array<ArrayBuffer>
    const kickTransient = new Uint8Array(baseline) as Uint8Array<ArrayBuffer>
    kickTransient.fill(118, 0, 4)

    const publish = (freqBuf: Uint8Array<ArrayBuffer>, audioTime: number) => {
      engine.updateFromAudioFrame({
        freqBuf,
        timeBuf: timeDomainData,
        sampleRate: 48_000,
        audioTime,
        isPlaying: true,
        publisherId: 'react:placeholder',
      })
      return AudioFeatureBus.getFrame()
    }

    publish(baseline, 10)
    expect(publish(kickTransient, 10.02).rhythm.kickHit).toBe(true)
    for (let i = 1; i <= 12; i++) publish(baseline, 10.02 + i * 0.02)

    // Backward seek/replay/loop: the first nonzero frame at the new position is
    // baseline acquisition, so stale detector history cannot fabricate a hit.
    expect(publish(kickTransient, 2).rhythm.kickHit).toBe(false)
    for (let i = 1; i <= 12; i++) publish(baseline, 2 + i * 0.02)
    expect(publish(kickTransient, 2.26).rhythm.kickHit).toBe(true)

    for (let i = 1; i <= 12; i++) publish(baseline, 2.26 + i * 0.02)
    // Large forward seek is the same discontinuity class and must not inherit
    // the pre-seek EMA/cooldown state either.
    expect(publish(kickTransient, 8).rhythm.kickHit).toBe(false)
    for (let i = 1; i <= 12; i++) publish(baseline, 8 + i * 0.02)
    expect(publish(kickTransient, 8.26).rhythm.kickHit).toBe(true)
  })

  it('stops sampling after disposal', () => {
    const engine = new MusicIntelligenceEngine()
    const fixture = analyserFixture()
    const pump = new MusicIntelligenceAnalyserFramePump({ publisherId: 'test:pixGrid', engine })
    pump.dispose()

    pump.sample({ analyser: fixture.analyser, audioTime: 4, isPlaying: true })

    expect(fixture.getByteFrequencyData).not.toHaveBeenCalled()
  })
})
