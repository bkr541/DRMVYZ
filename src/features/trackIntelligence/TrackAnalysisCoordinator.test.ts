import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  TrackAnalysisCoordinator,
  computeAnalysisKey,
  CURRENT_ANALYSIS_VERSION,
  type CoordinatorDeps,
  type CoordinatorCallbacks,
} from './TrackAnalysisCoordinator'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME } from '../../types'
import type { Track } from '../../types'
import type { TrackIntelligenceAnalysis } from '../musicIntelligence/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id:              'track-1',
    name:            'test.mp3',
    displayName:     'test',
    url:             'blob:http://localhost/abc123',
    duration:        180,
    sourceKind:      'remote',
    analysisRuntime: { ...DEFAULT_TRACK_ANALYSIS_RUNTIME, analysisKey: 'u:blob:http://localhost/abc123:auto-1.0' },
    ...overrides,
  }
}

function makeAnalysis(bpm = 128): TrackIntelligenceAnalysis {
  return {
    analysisVersion:   'auto-1.0',
    createdAt:         new Date().toISOString(),
    durationMs:        180_000,
    bpm,
    bpmConfidence:     0.9,
    beatGridOffsetSec: 0.1,
    timeSignature:     4,
    beatGrid:          [],
    downbeats:         [],
    phrases:           [],
    sections:          [],
    energyCurves:      { instant: [], shortTerm: [], bass: [], mid: [], high: [] },
    spectralCurves:    { centroid: [], flux: [], complexity: [] },
    stemCurves:        null,
    harmonic: {
      keyChanges:         [],
      chordProgression:   [],
      dominantKey:        'C',
      dominantMode:       'major',
      keyConfidence:      0.8,
      pitchCurve:         [],
      melodyContourCurve: [],
    },
    lyrics:          null,
    semanticMoments: [],
    warnings:        [],
    errors:          [],
  }
}

function makeFakeBuffer(duration = 180): AudioBuffer {
  return { duration, sampleRate: 44100, length: duration * 44100, numberOfChannels: 2 } as unknown as AudioBuffer
}

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeCoordinator(overrides: Partial<CoordinatorDeps> = {}, cbOverrides: Partial<CoordinatorCallbacks> = {}) {
  const fakeBuffer   = makeFakeBuffer()
  const fakeAnalysis = makeAnalysis()

  const deps: CoordinatorDeps = {
    decodeBuffer:       vi.fn().mockResolvedValue(fakeBuffer),
    analyze:            vi.fn().mockResolvedValue(fakeAnalysis),
    getCachedAnalysis:  vi.fn().mockReturnValue(null),
    saveCachedAnalysis: vi.fn(),
    maxConcurrent:      1,
    ...overrides,
  }

  const cbs: CoordinatorCallbacks = {
    onRuntimeUpdate:  vi.fn(),
    onDurationUpdate: vi.fn(),
    onApplyToEngine:  vi.fn(),
    isActiveTrack:    vi.fn().mockReturnValue(false),
    ...cbOverrides,
  }

  const coordinator = new TrackAnalysisCoordinator(deps, cbs)
  return { coordinator, deps, cbs, fakeBuffer, fakeAnalysis }
}

// ── computeAnalysisKey ────────────────────────────────────────────────────────

describe('computeAnalysisKey', () => {
  it('returns url-keyed string for remote tracks', () => {
    const track = makeTrack({ sourceKind: 'remote', url: 'https://cdn.example.com/song.mp3?token=xyz' })
    const key = computeAnalysisKey(track)
    expect(key).toBe(`u:https://cdn.example.com/song.mp3:${CURRENT_ANALYSIS_VERSION}`)
    expect(key).not.toContain('?token')
  })

  it('strips signed query params from remote url', () => {
    const track = makeTrack({ sourceKind: 'remote', url: 'https://cdn.example.com/track.wav?Expires=999' })
    const key = computeAnalysisKey(track)
    expect(key).not.toContain('Expires')
  })

  it('returns file-keyed string for file tracks', () => {
    const file = new File([''], 'track.mp3', { type: 'audio/mpeg' })
    Object.defineProperty(file, 'lastModified', { value: 1700000000000 })
    const track = makeTrack({ sourceKind: 'file', sourceFile: file, url: 'blob:http://localhost/fake' })
    const key = computeAnalysisKey(track)
    expect(key).toMatch(/^f:track\.mp3:0:1700000000000:/)
    expect(key).toContain(CURRENT_ANALYSIS_VERSION)
  })

  it('embeds the current analysis version in all keys', () => {
    const track = makeTrack()
    expect(computeAnalysisKey(track)).toContain(CURRENT_ANALYSIS_VERSION)
  })
})

// ── Happy path (cache miss → decode → analyze → commit) ──────────────────────

describe('TrackAnalysisCoordinator — happy path', () => {
  it('transitions through decoding → analyzing → complete', async () => {
    const { coordinator, cbs } = makeCoordinator()
    coordinator.enqueue(makeTrack(), 'normal')
    await vi.runAllTimersAsync().catch(() => {})
    await new Promise(r => setTimeout(r, 0))

    const calls = (cbs.onRuntimeUpdate as ReturnType<typeof vi.fn>).mock.calls.map(c => c[1].status)
    expect(calls).toContain('decoding')
    expect(calls).toContain('analyzing')
    expect(calls).toContain('complete')
  })

  it('calls onDurationUpdate with buffer duration', async () => {
    const buffer = makeFakeBuffer(240)
    const { coordinator, cbs } = makeCoordinator({ decodeBuffer: vi.fn().mockResolvedValue(buffer) })
    coordinator.enqueue(makeTrack(), 'normal')
    await new Promise(r => setTimeout(r, 50))

    expect(cbs.onDurationUpdate).toHaveBeenCalledWith('track-1', 240)
  })

  it('persists the analysis via saveCachedAnalysis', async () => {
    const { coordinator, deps } = makeCoordinator()
    coordinator.enqueue(makeTrack(), 'normal')
    await new Promise(r => setTimeout(r, 50))

    expect(deps.saveCachedAnalysis).toHaveBeenCalled()
  })

  it('calls onApplyToEngine when the track is the active track', async () => {
    const { coordinator, cbs, fakeAnalysis } = makeCoordinator(
      {},
      { isActiveTrack: vi.fn().mockReturnValue(true) },
    )
    coordinator.enqueue(makeTrack(), 'normal')
    await new Promise(r => setTimeout(r, 50))

    expect(cbs.onApplyToEngine).toHaveBeenCalledWith(fakeAnalysis, 'track-1')
  })

  it('does NOT call onApplyToEngine for non-active tracks', async () => {
    const { coordinator, cbs } = makeCoordinator(
      {},
      { isActiveTrack: vi.fn().mockReturnValue(false) },
    )
    coordinator.enqueue(makeTrack(), 'normal')
    await new Promise(r => setTimeout(r, 50))

    expect(cbs.onApplyToEngine).not.toHaveBeenCalled()
  })
})

// ── Persistent cache hit ───────────────────────────────────────────────────────

describe('TrackAnalysisCoordinator — cache hit', () => {
  it('skips decode when a cached analysis exists', async () => {
    const cached = makeAnalysis(140)
    const { coordinator, deps, cbs } = makeCoordinator({ getCachedAnalysis: vi.fn().mockReturnValue(cached) })
    coordinator.enqueue(makeTrack(), 'normal')
    await new Promise(r => setTimeout(r, 50))

    expect(deps.decodeBuffer).not.toHaveBeenCalled()
    expect(deps.analyze).not.toHaveBeenCalled()

    const update = (cbs.onRuntimeUpdate as ReturnType<typeof vi.fn>).mock.calls.find(c => c[1].status === 'complete')
    expect(update).toBeDefined()
    expect(update![1].analysis.bpm).toBe(140)
  })
})

// ── Error handling ────────────────────────────────────────────────────────────

describe('TrackAnalysisCoordinator — error handling', () => {
  it('reports failed status on decode error', async () => {
    const { coordinator, cbs } = makeCoordinator({
      decodeBuffer: vi.fn().mockRejectedValue(new Error('network failure')),
    })
    coordinator.enqueue(makeTrack(), 'normal')
    await new Promise(r => setTimeout(r, 50))

    const call = (cbs.onRuntimeUpdate as ReturnType<typeof vi.fn>).mock.calls.find(c => c[1].status === 'failed')
    expect(call).toBeDefined()
    expect(call![1].error).toContain('Decode error')
  })

  it('reports failed status on analysis error', async () => {
    const { coordinator, cbs } = makeCoordinator({
      analyze: vi.fn().mockRejectedValue(new Error('analysis failed')),
    })
    coordinator.enqueue(makeTrack(), 'normal')
    await new Promise(r => setTimeout(r, 50))

    const call = (cbs.onRuntimeUpdate as ReturnType<typeof vi.fn>).mock.calls.find(c => c[1].status === 'failed')
    expect(call).toBeDefined()
    expect(call![1].error).toContain('Analysis error')
  })
})

// ── Cancellation ──────────────────────────────────────────────────────────────

describe('TrackAnalysisCoordinator — cancellation', () => {
  it('does not commit results for a cancelled track', async () => {
    const { coordinator, cbs } = makeCoordinator()
    const track = makeTrack()
    coordinator.enqueue(track, 'normal')
    coordinator.cancelTrack(track.id)
    await new Promise(r => setTimeout(r, 50))

    const completeCalls = (cbs.onRuntimeUpdate as ReturnType<typeof vi.fn>).mock.calls.filter(
      c => c[1].status === 'complete',
    )
    expect(completeCalls).toHaveLength(0)
  })
})

// ── Invalidation ──────────────────────────────────────────────────────────────

describe('TrackAnalysisCoordinator — invalidation', () => {
  it('discards queued jobs after invalidate()', async () => {
    let resolveDecode!: (b: AudioBuffer) => void
    const decodeBuffer = vi.fn().mockImplementation(
      () => new Promise<AudioBuffer>(r => { resolveDecode = r }),
    )
    const { coordinator, cbs } = makeCoordinator({ decodeBuffer })

    coordinator.enqueue(makeTrack({ id: 'track-a' }), 'normal')
    coordinator.enqueue(makeTrack({ id: 'track-b' }), 'normal')
    coordinator.invalidate()
    resolveDecode(makeFakeBuffer())
    await new Promise(r => setTimeout(r, 50))

    const completeCalls = (cbs.onRuntimeUpdate as ReturnType<typeof vi.fn>).mock.calls.filter(
      c => c[1].status === 'complete',
    )
    expect(completeCalls).toHaveLength(0)
  })
})

// ── Prioritization ────────────────────────────────────────────────────────────

describe('TrackAnalysisCoordinator — prioritize', () => {
  it('moves a queued track to the front', () => {
    let resolveDecode!: (b: AudioBuffer) => void
    const decodeBuffer = vi.fn().mockImplementation(
      () => new Promise<AudioBuffer>(r => { resolveDecode = r }),
    )
    const { coordinator } = makeCoordinator({ decodeBuffer })

    coordinator.enqueue(makeTrack({ id: 'track-a' }), 'normal')
    coordinator.enqueue(makeTrack({ id: 'track-b' }), 'normal')
    coordinator.enqueue(makeTrack({ id: 'track-c' }), 'normal')
    coordinator.prioritize('track-c')

    // track-c should now be second in queue (track-a is already running)
    const queueIds = (coordinator as unknown as { queue: { trackId: string }[] }).queue.map(j => j.trackId)
    expect(queueIds[0]).toBe('track-c')

    resolveDecode(makeFakeBuffer())
  })
})

// ── LRU buffer cache ──────────────────────────────────────────────────────────

describe('TrackAnalysisCoordinator — buffer cache', () => {
  it('does not decode a second time when buffer is cached', async () => {
    const { coordinator, deps } = makeCoordinator()
    const track = makeTrack()
    coordinator.enqueue(track, 'normal')
    await new Promise(r => setTimeout(r, 50))

    // Re-enqueue the same track (simulate re-analysis after cache reset)
    coordinator.enqueue(track, 'normal')
    await new Promise(r => setTimeout(r, 50))

    // Second run should hit the buffer cache, so decodeBuffer called only once
    expect(deps.decodeBuffer).toHaveBeenCalledTimes(1)
  })
})
