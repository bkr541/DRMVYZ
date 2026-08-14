import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioFeatureBus } from '../AudioFeatureBus'
import { MusicIntelligenceAnalyserFramePump, shapeLiveInputAnalysisBuffers } from '../MusicIntelligenceAnalyserFramePump'
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
  it('shapes Live Input analysis buffers without touching the audio graph', () => {
    const quietFrequency = new Uint8Array([20, 100, 200])
    const quietWaveform = new Uint8Array([128, 129, 127, 128])
    shapeLiveInputAnalysisBuffers(quietFrequency, quietWaveform, 2, 0.02)
    expect([...quietFrequency]).toEqual([0, 0, 0])
    expect([...quietWaveform]).toEqual([128, 128, 128, 128])

    const frequency = new Uint8Array([40, 80])
    const waveform = new Uint8Array([138, 118])
    shapeLiveInputAnalysisBuffers(frequency, waveform, 2, 0)
    expect([...frequency]).toEqual([80, 160])
    expect([...waveform]).toEqual([148, 108])
  })

  beforeEach(() => {
    AudioFeatureBus.setAuthoritativeFramePublisherId(null)
    AudioFeatureBus.reset()
  })

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

  it('enforces one authoritative Live Input publisher and emits only realtime low-level features', () => {
    const engine = new MusicIntelligenceEngine()
    engine.setSourceId('live-input:7', null)
    let value = 24
    const getByteFrequencyData = vi.fn((buffer: Uint8Array) => buffer.fill(value))
    const getByteTimeDomainData = vi.fn((buffer: Uint8Array) => buffer.fill(128 + Math.floor(value / 12)))
    const analyser = {
      frequencyBinCount: 256,
      fftSize: 512,
      context: { sampleRate: 48_000 },
      getByteFrequencyData,
      getByteTimeDomainData,
    } as unknown as AnalyserNode
    const central = new MusicIntelligenceAnalyserFramePump({
      publisherId: 'audio:live-input',
      analysisMode: 'live-input',
      engine,
    })
    const renderer = new MusicIntelligenceAnalyserFramePump({ publisherId: 'react:cinema', engine })
    AudioFeatureBus.setAuthoritativeFramePublisherId('audio:live-input')

    const first = central.sample({ analyser, audioTime: 0, isPlaying: true, trackIdentity: 'live-input:7' })
    value = 220
    const second = central.sample({ analyser, audioTime: 0.02, isPlaying: true, trackIdentity: 'live-input:7' })
    const readsBeforeRenderer = getByteFrequencyData.mock.calls.length
    const rendererFrame = renderer.sample({ analyser, audioTime: 0.03, isPlaying: true, trackIdentity: 'live-input:7' })

    expect(first.frameId).toBeGreaterThan(0)
    expect(second.frameId).toBeGreaterThan(first.frameId)
    expect(second.sourceId).toBe('live-input:7')
    expect(second.trackId).toBeNull()
    expect(second.bands.volume).toBeGreaterThan(0)
    expect(second.energy.instant).toBeGreaterThan(0)
    expect(second.energy.spectralFlux).toBeGreaterThan(0)
    expect(second.rhythm.transient).toBeGreaterThan(0)
    expect(second.capabilities).toMatchObject({ liveBands: true, rhythmEvents: true, beatGrid: false, sections: false })
    expect(second.section.type).toBeNull()
    expect(second.energy.buildProgress).toBe(0)
    expect(second.energy.dropImpact).toBe(0)
    expect(second.semantics.buildConfidence).toBe(0)
    expect(second.semantics.dropConfidence).toBe(0)
    expect(second.rhythm.bpm).toBe(0)
    expect(rendererFrame).toBe(second)
    expect(getByteFrequencyData).toHaveBeenCalledTimes(readsBeforeRenderer)
    expect(renderer.diagnostics.skippedAuthorityCount).toBe(1)
    expect(AudioFeatureBus.getFramePublicationMeta().publisherId).toBe('audio:live-input')
  })


  it('publishes converged Live Input BPM, confidence, and monotonic beat events through the authoritative bus path', () => {
    const engine = new MusicIntelligenceEngine()
    engine.setSourceId('live-input:tempo', null)
    let value = 24
    const getByteFrequencyData = vi.fn((buffer: Uint8Array) => buffer.fill(value))
    const getByteTimeDomainData = vi.fn((buffer: Uint8Array) => buffer.fill(128))
    const analyser = {
      frequencyBinCount: 256,
      fftSize: 512,
      context: { sampleRate: 48_000 },
      getByteFrequencyData,
      getByteTimeDomainData,
    } as unknown as AnalyserNode
    const pump = new MusicIntelligenceAnalyserFramePump({
      publisherId: 'audio:live-input',
      analysisMode: 'live-input',
      engine,
    })
    AudioFeatureBus.setAuthoritativeFramePublisherId('audio:live-input')

    const beatEventIds: number[] = []
    let frame = AudioFeatureBus.getFrame()
    const frameSec = 0.02
    const beatPeriodSec = 0.5
    let nextPulseSec = 0.5
    for (let audioTime = 0; audioTime <= 7 + 1e-9; audioTime += frameSec) {
      const pulse = audioTime + frameSec * 0.5 >= nextPulseSec
      value = pulse ? 220 : 24
      if (pulse) nextPulseSec += beatPeriodSec
      frame = pump.sample({ analyser, audioTime, isPlaying: true, trackIdentity: 'live-input:tempo' })
      if (frame.rhythm.beatHit && frame.rhythm.beatEventId != null) beatEventIds.push(frame.rhythm.beatEventId)
    }

    expect(frame.rhythm.bpm).toBeCloseTo(120, 0)
    expect(frame.rhythm.bpmConfidence).toBeGreaterThan(0.5)
    expect(frame.rhythm.bpmSource).toBe('live_analysis')
    expect(frame.capabilities?.beatGrid).toBe(true)
    expect(frame.section.type).toBeNull()
    expect(frame.semantics.buildConfidence).toBe(0)
    expect(frame.semantics.dropConfidence).toBe(0)
    expect(beatEventIds.length).toBeGreaterThan(3)
    expect(new Set(beatEventIds).size).toBe(beatEventIds.length)
    for (let index = 1; index < beatEventIds.length; index++) {
      expect(beatEventIds[index]).toBeGreaterThan(beatEventIds[index - 1])
    }
    expect(AudioFeatureBus.getFramePublicationMeta().publisherId).toBe('audio:live-input')

    engine.setSourceId('live-input:tempo-2', null)
    value = 24
    const resetFrame = pump.sample({ analyser, audioTime: 0, isPlaying: true, trackIdentity: 'live-input:tempo-2' })
    expect(resetFrame.rhythm.bpm).toBe(0)
    expect(resetFrame.rhythm.bpmConfidence).toBe(0)
    expect(resetFrame.capabilities?.beatGrid).toBe(false)
  })

  it('resets Live Input spectral and transient history on a new capture session', () => {
    const engine = new MusicIntelligenceEngine()
    const timeDomainData = new Uint8Array(512).fill(128) as Uint8Array<ArrayBuffer>
    const baseline = new Uint8Array(256).fill(24) as Uint8Array<ArrayBuffer>
    const transient = new Uint8Array(256).fill(220) as Uint8Array<ArrayBuffer>

    AudioFeatureBus.setAuthoritativeFramePublisherId('audio:live-input')
    engine.setSourceId('live-input:1', null)
    const publish = (freqBuf: Uint8Array<ArrayBuffer>, audioTime: number) => {
      engine.updateFromAudioFrame({
        freqBuf,
        timeBuf: timeDomainData,
        sampleRate: 48_000,
        audioTime,
        isPlaying: true,
        publisherId: 'audio:live-input',
        analysisMode: 'live-input',
      })
      return AudioFeatureBus.getFrame()
    }

    publish(baseline, 0)
    const beforeReconnect = publish(transient, 0.02)
    expect(beforeReconnect.energy.spectralFlux).toBeGreaterThan(0)
    expect(beforeReconnect.rhythm.transient).toBeGreaterThan(0)

    engine.setSourceId('live-input:2', null)
    const firstAfterReconnect = publish(transient, 0)

    expect(firstAfterReconnect.frameId).toBeGreaterThan(beforeReconnect.frameId)
    expect(firstAfterReconnect.sourceId).toBe('live-input:2')
    expect(firstAfterReconnect.energy.spectralFlux).toBe(0)
    expect(firstAfterReconnect.rhythm.transient).toBe(0)
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
