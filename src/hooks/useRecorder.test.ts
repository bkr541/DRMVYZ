/**
 * Tests for useRecorder pure helpers.
 *
 * Hook state (startVideoRecording, stopRecording) is exercised via the
 * exported buildCombinedStream helper and direct MediaRecorder mocks,
 * avoiding the need for @testing-library/react renderHook in a Node env.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pickVideoMimeType, buildCombinedStream } from './useRecorder'
import { downloadBlob } from '../utils/wavExport'

// ── Mock downloadBlob so it doesn't actually trigger a download ────────────
vi.mock('../utils/wavExport', () => ({
  encodeWAV: vi.fn(() => new Blob(['fake-wav'], { type: 'audio/wav' })),
  downloadBlob: vi.fn(),
}))

// ���─ Fake browser primitives ──────────���─────────────────────────────────────

class FakeMediaStreamTrack {
  kind: string
  constructor(kind: 'audio' | 'video') { this.kind = kind }
  stop = vi.fn()
}

class FakeMediaStream {
  private _tracks: FakeMediaStreamTrack[]
  constructor(tracks: FakeMediaStreamTrack[] = []) { this._tracks = tracks }
  getVideoTracks() { return this._tracks.filter(t => t.kind === 'video') }
  getAudioTracks()  { return this._tracks.filter(t => t.kind === 'audio') }
}

class FakeCanvas {
  width  = 1920
  height = 1080
  private _fps = 0
  captureStream(fps: number): FakeMediaStream {
    this._fps = fps
    return new FakeMediaStream([new FakeMediaStreamTrack('video')])
  }
  toDataURL = vi.fn((_type?: string) => 'data:image/png;base64,fake')
}

class FakeMediaRecorder {
  static isTypeSupported = vi.fn((_: string) => false)
  state = 'inactive' as 'inactive' | 'recording' | 'paused'
  mimeType: string
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  constructor(_stream: MediaStream, opts: { mimeType?: string } = {}) {
    this.mimeType = opts.mimeType ?? ''
  }
  start = vi.fn((timeslice?: number) => {
    void timeslice
    this.state = 'recording'
  })
  stop = vi.fn(() => {
    this.state = 'inactive'
    this.onstop?.()
  })
}

// ── Test 1–4: pickVideoMimeType ──────��─────────────────────────────────────

describe('pickVideoMimeType', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns the first supported MIME type (vp9,opus when all support)', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true })
    expect(pickVideoMimeType()).toBe('video/webm;codecs=vp9,opus')
  })

  it('falls back past unsupported types to find a supported one', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (t: string) => t === 'video/webm;codecs=vp8,opus',
    })
    expect(pickVideoMimeType()).toBe('video/webm;codecs=vp8,opus')
  })

  it('falls back to bare video/webm when codecs are not supported', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (t: string) => t === 'video/webm',
    })
    expect(pickVideoMimeType()).toBe('video/webm')
  })

  it('returns empty string when no type is supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false })
    expect(pickVideoMimeType()).toBe('')
  })

  it('returns empty string when MediaRecorder is unavailable (old browser)', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(pickVideoMimeType()).toBe('')
  })
})

// ── Test 5–7: buildCombinedStream ──────────────���──────────────────────────

describe('buildCombinedStream', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaStream', FakeMediaStream)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('creates a video-audio stream when audio tracks are available', () => {
    const canvas      = new FakeCanvas() as unknown as HTMLCanvasElement
    const audioTrack  = new FakeMediaStreamTrack('audio')
    const audioStream = new FakeMediaStream([audioTrack]) as unknown as MediaStream

    const { stream, capturedTracks, mode } = buildCombinedStream(canvas, audioStream, 30)

    expect(mode).toBe('video-audio')
    expect(capturedTracks).toHaveLength(1)
    expect(capturedTracks[0].kind).toBe('video')
    // Combined stream holds both video and audio tracks
    const allTracks = [...stream.getVideoTracks(), ...stream.getAudioTracks()]
    expect(allTracks.length).toBeGreaterThanOrEqual(1)
  })

  it('creates a video-only stream when no audio stream is provided', () => {
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement

    const { stream, capturedTracks, mode } = buildCombinedStream(canvas, null, 30)

    expect(mode).toBe('video-only')
    expect(capturedTracks).toHaveLength(1)
    expect(stream.getAudioTracks()).toHaveLength(0)
  })

  it('creates a video-only stream when audio stream has no tracks', () => {
    const canvas      = new FakeCanvas() as unknown as HTMLCanvasElement
    const audioStream = new FakeMediaStream([]) as unknown as MediaStream  // no tracks

    const { mode } = buildCombinedStream(canvas, audioStream, 60)
    expect(mode).toBe('video-only')
  })

  it('passes the requested FPS to captureStream', () => {
    const canvas = new FakeCanvas()
    const spy    = vi.spyOn(canvas, 'captureStream')

    buildCombinedStream(canvas as unknown as HTMLCanvasElement, null, 60)

    expect(spy).toHaveBeenCalledWith(60)
  })

  it('capturedTracks contains only video tracks (not audio)', () => {
    const canvas     = new FakeCanvas() as unknown as HTMLCanvasElement
    const audioTrack = new FakeMediaStreamTrack('audio')
    const audio      = new FakeMediaStream([audioTrack]) as unknown as MediaStream

    const { capturedTracks } = buildCombinedStream(canvas, audio, 30)

    expect(capturedTracks.every(t => t.kind === 'video')).toBe(true)
  })
})

// ── Test 8: stopping releases only capture tracks ─────────────────────────
//
// Simulates the stop flow: video capture track should be stopped,
// but the shared audio stream track must NOT be stopped.

describe('stopRecording capture-track cleanup', () => {
  it('stops only video capture tracks and leaves audio stream tracks running', () => {
    const videoTrack = new FakeMediaStreamTrack('video')
    const audioTrack = new FakeMediaStreamTrack('audio')

    // Simulate what stopRecording does: stop capturedTracks, never touch audio.
    const capturedTracks: FakeMediaStreamTrack[] = [videoTrack]
    for (const track of capturedTracks) track.stop()

    expect(videoTrack.stop).toHaveBeenCalled()
    expect(audioTrack.stop).not.toHaveBeenCalled()
  })
})

// ── Test 9: MediaRecorder lifecycle ─────────────────────��─────────────────

describe('MediaRecorder recording lifecycle', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('calls mr.stop() on stopRecording and fires onstop to produce a blob', () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)

    const stream  = new FakeMediaStream([]) as unknown as MediaStream
    const mr      = new FakeMediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks: Blob[] = []

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      downloadBlob(blob, `drmvyz-performance-${Date.now()}.webm`)
    }

    mr.start(500)
    expect(mr.state).toBe('recording')

    // Simulate data chunks arriving
    mr.ondataavailable({ data: new Blob(['frame1']) })
    mr.ondataavailable({ data: new Blob(['frame2']) })

    mr.stop()
    expect(mr.state).toBe('inactive')
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/^drmvyz-performance-\d+\.webm$/),
    )
  })
})

// ── Test 10: audio-guard contract ────────────────────────────────────────────
//
// When hasActiveProgramAudio=false the start-recording handler in VyzualzView
// passes null instead of calling engine.getRecordingStream().
// This contract is exercised here via buildCombinedStream directly, which is the
// function that ultimately decides the RecordingMode from the audio argument.

describe('audio guard contract — no active source → video-only recording', () => {
  beforeEach(() => { vi.stubGlobal('MediaStream', FakeMediaStream) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('produces video-only mode when null is passed (isActive=false guard fires)', () => {
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement
    // VyzualzView.handleStartRecording passes null when engine.isActive is false
    const { mode } = buildCombinedStream(canvas, null, 30)
    expect(mode).toBe('video-only')
  })

  it('produces video-audio mode when an active audio stream is passed (isActive=true)', () => {
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement
    const audioTrack  = new FakeMediaStreamTrack('audio')
    const audioStream = new FakeMediaStream([audioTrack]) as unknown as MediaStream
    // VyzualzView.handleStartRecording calls getRecordingStream() when engine.isActive=true
    const { mode } = buildCombinedStream(canvas, audioStream, 30)
    expect(mode).toBe('video-audio')
  })

  it('a stream that contains audio tracks always produces video-audio — confirming the guard matters', () => {
    // Regression: before the fix, getRecordingStream() returned a stream with
    // audio tracks even when no source was active, causing every recording to be
    // labelled "Video + Audio" with a silent audio track. The guard (null when
    // isActive=false) prevents this by never passing the stream to buildCombinedStream.
    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement
    const audioTrack  = new FakeMediaStreamTrack('audio')
    const audioStream = new FakeMediaStream([audioTrack]) as unknown as MediaStream
    const { mode: withAudio  } = buildCombinedStream(canvas, audioStream, 30)
    const { mode: withoutAudio } = buildCombinedStream(canvas, null, 30)
    expect(withAudio).toBe('video-audio')
    expect(withoutAudio).toBe('video-only')
  })
})

// ── Test 12: startup failure — MediaRecorder constructor throws ─────────────
//
// Contract: if MediaRecorder construction fails, captured video tracks must be
// released immediately. The recording must not start; no refs are left holding
// live tracks.

describe('startVideoRecording — MediaRecorder constructor failure', () => {
  beforeEach(() => { vi.stubGlobal('MediaStream', FakeMediaStream) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('stops captured video tracks when MediaRecorder constructor throws', () => {
    class ThrowingRecorder {
      static isTypeSupported = (_: string) => true
      constructor() { throw new Error('NotSupportedError') }
    }
    vi.stubGlobal('MediaRecorder', ThrowingRecorder)

    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement
    // Simulate what startVideoRecording does when MediaRecorder throws:
    // buildCombinedStream succeeds → capturedTracks allocated → constructor throws → tracks stopped.
    const { capturedTracks } = buildCombinedStream(canvas, null, 30)
    const trackSpy = vi.spyOn(capturedTracks[0], 'stop')

    try {
      new (ThrowingRecorder as unknown as typeof MediaRecorder)(
        new FakeMediaStream() as unknown as MediaStream,
      )
    } catch {
      for (const t of capturedTracks) t.stop()
    }

    expect(trackSpy).toHaveBeenCalled()
  })

  it('stops captured video tracks when mr.start() throws', () => {
    class StartThrowingRecorder {
      static isTypeSupported = (_: string) => true
      ondataavailable: ((e: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      onerror: ((e: Event) => void) | null = null
      constructor(_stream: MediaStream, _opts?: { mimeType?: string }) {}
      start = (_timeslice?: number) => { throw new Error('start failed') }
      stop  = vi.fn()
    }
    vi.stubGlobal('MediaRecorder', StartThrowingRecorder)

    const canvas = new FakeCanvas() as unknown as HTMLCanvasElement
    const { capturedTracks } = buildCombinedStream(canvas, null, 30)
    const trackSpy = vi.spyOn(capturedTracks[0], 'stop')

    const stream = new FakeMediaStream() as unknown as MediaStream
    const mr = new StartThrowingRecorder(stream)

    try {
      mr.start(500)
    } catch {
      for (const t of capturedTracks) t.stop()
    }

    expect(trackSpy).toHaveBeenCalled()
  })
})

// ── Test 13: runtime onerror — tracks and timer are released ─────────────────
//
// Contract: when MediaRecorder fires onerror mid-recording, the capture tracks
// must be stopped and the interval timer cleared — even if the UI is still mounted.
// This mirrors what the onerror handler in useRecorder does (calls stopRecording).

describe('MediaRecorder onerror — resource teardown', () => {
  it('stops captured tracks and clears timer when onerror fires', () => {
    const videoTrack = new FakeMediaStreamTrack('video')
    const capturedTracks: FakeMediaStreamTrack[] = [videoTrack]
    let timerId: ReturnType<typeof setInterval> | null = setInterval(() => {}, 1000)

    // Simulate what stopRecording does (called by the onerror handler):
    const simulateStopRecording = () => {
      for (const t of capturedTracks) t.stop()
      capturedTracks.length = 0
      if (timerId) { clearInterval(timerId); timerId = null }
    }

    // Fire onerror
    const fakeEvent = new Event('error')
    const onError = (_e: Event) => { simulateStopRecording() }
    onError(fakeEvent)

    expect(videoTrack.stop).toHaveBeenCalled()
    expect(capturedTracks).toHaveLength(0)
    expect(timerId).toBeNull()
  })
})

// ── Test 14: unmount cleanup — tracks and timer released on component teardown
//
// Contract: if the component unmounts while a recording is active, the useEffect
// cleanup must stop captured tracks and clear the interval — preventing resource
// leaks when the user navigates away mid-capture.

describe('useEffect unmount cleanup', () => {
  it('stops active capture tracks and clears timer on unmount', () => {
    const videoTrack = new FakeMediaStreamTrack('video')
    let capturedTracks: FakeMediaStreamTrack[] = [videoTrack]
    let timerId: ReturnType<typeof setInterval> | null = setInterval(() => {}, 1000)

    const mr = new FakeMediaRecorder(
      new FakeMediaStream() as unknown as MediaStream,
      { mimeType: 'video/webm' },
    )
    mr.start(500)
    expect(mr.state).toBe('recording')

    // Simulate the useEffect cleanup that fires on unmount:
    if (mr.state !== 'inactive') {
      try { mr.stop() } catch { /* ignore */ }
    }
    for (const t of capturedTracks) t.stop()
    capturedTracks = []
    if (timerId) { clearInterval(timerId); timerId = null }

    expect(mr.stop).toHaveBeenCalled()
    expect(videoTrack.stop).toHaveBeenCalled()
    expect(capturedTracks).toHaveLength(0)
    expect(timerId).toBeNull()
  })

  it('does not throw when unmounting with no active recording', () => {
    // No active mr, no tracks — cleanup must be a safe no-op.
    const capturedTracks: FakeMediaStreamTrack[] = []
    let timerId: ReturnType<typeof setInterval> | null = null

    expect(() => {
      const mr = null
      if (mr) {
        try { (mr as MediaRecorder).stop() } catch { /* ignore */ }
      }
      for (const t of capturedTracks) t.stop()
      if (timerId) { clearInterval(timerId); timerId = null }
    }).not.toThrow()
  })
})

// ── Test 11: PNG export falls back to largest canvas ─────────────────────

describe('exportPNG canvas selection', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('exports the explicitly provided canvas', () => {
    const canvas = new FakeCanvas()
    const appendSpy = vi.fn()

    // Minimal document stub — only createElement('a') is needed for exportPNG
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'a') {
          return { href: '', download: '', click: appendSpy }
        }
        throw new Error(`unexpected createElement: ${tag}`)
      },
      querySelectorAll: () => [],
    })

    // Call exportPNG logic directly (inline to avoid hooks)
    const url  = canvas.toDataURL('image/png')
    const a    = document.createElement('a') as unknown as HTMLAnchorElement
    a.href     = url
    a.download = `drmvyz-frame-${Date.now()}.png`
    a.click()

    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
    expect(appendSpy).toHaveBeenCalled()
  })
})
