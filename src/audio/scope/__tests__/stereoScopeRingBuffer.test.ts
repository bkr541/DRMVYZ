import { describe, expect, it } from 'vitest'
import { StereoScopeRingBuffer } from '../StereoScopeRingBuffer'

const SAMPLE_RATE = 48_000

function ramp(start: number, count: number, scale = 1): Float32Array {
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) out[i] = (start + i) * scale
  return out
}

describe('stereo scope ring buffer', () => {
  it('keeps left and right aligned to the same sample frame', () => {
    const ring = new StereoScopeRingBuffer(SAMPLE_RATE, 1)
    const left = ramp(0, 1024)
    const right = ramp(0, 1024, -1)
    ring.write(left, right, 0)

    const frame = ring.readLatest(1024)
    expect(frame).not.toBeNull()
    for (let i = 0; i < 1024; i++) {
      // The invariant a vectorscope depends on: index i is one instant.
      expect(frame!.right[i]).toBeCloseTo(-frame!.left[i], 6)
    }
  })

  it('returns null until the requested window is fully available', () => {
    const ring = new StereoScopeRingBuffer(SAMPLE_RATE, 1)
    ring.write(ramp(0, 256), ramp(0, 256), 0)
    expect(ring.readLatest(1024)).toBeNull()
    expect(ring.readLatest(256)).not.toBeNull()
  })

  it('reads the newest samples oldest-first', () => {
    const ring = new StereoScopeRingBuffer(SAMPLE_RATE, 1)
    ring.write(ramp(0, 1000), ramp(0, 1000), 0)
    ring.write(ramp(1000, 1000), ramp(1000, 1000), 1000)

    const frame = ring.readLatest(500)!
    expect(frame.left[0]).toBeCloseTo(1500, 6)
    expect(frame.left[499]).toBeCloseTo(1999, 6)
    expect(frame.startFrame).toBe(1500)
  })

  it('wraps correctly once capacity is exceeded', () => {
    const ring = new StereoScopeRingBuffer(1000, 1) // capacity clamps to 1024
    const capacity = ring.capacityFrames
    ring.write(ramp(0, capacity + 300), ramp(0, capacity + 300), 0)

    const frame = ring.readLatest(100)!
    expect(frame.left[99]).toBeCloseTo(capacity + 299, 6)
    expect(ring.availableFrames).toBe(capacity)
  })

  it('increments the sequence number on each read', () => {
    const ring = new StereoScopeRingBuffer(SAMPLE_RATE, 1)
    ring.write(ramp(0, 1024), ramp(0, 1024), 0)
    expect(ring.readLatest(512)!.sequenceNumber).toBe(1)
    expect(ring.readLatest(512)!.sequenceNumber).toBe(2)
  })

  it('discards buffered audio on a frame-counter gap', () => {
    const ring = new StereoScopeRingBuffer(SAMPLE_RATE, 1)
    ring.write(ramp(0, 1024, 1), ramp(0, 1024, 1), 0)
    expect(ring.availableFrames).toBe(1024)

    // A gap means the audio path was suspended or reconnected. Splicing the two
    // sides together would render as a false transient.
    ring.write(ramp(0, 512, 1), ramp(0, 512, 1), 100_000)
    expect(ring.discontinuities).toBe(1)
    expect(ring.droppedFrames).toBe(100_000 - 1024)
    expect(ring.availableFrames).toBe(512)
    expect(ring.readLatest(1024)).toBeNull()
  })

  it('detects a rewound frame counter as a discontinuity', () => {
    const ring = new StereoScopeRingBuffer(SAMPLE_RATE, 1)
    ring.write(ramp(0, 1024), ramp(0, 1024), 5000)
    ring.write(ramp(0, 1024), ramp(0, 1024), 100)
    expect(ring.discontinuities).toBe(1)
    expect(ring.availableFrames).toBe(1024)
  })

  it('accepts contiguous blocks without reporting a discontinuity', () => {
    const ring = new StereoScopeRingBuffer(SAMPLE_RATE, 1)
    for (let block = 0; block < 8; block++) {
      const start = block * 1024
      ring.write(ramp(start, 1024), ramp(start, 1024), start)
    }
    expect(ring.discontinuities).toBe(0)
    expect(ring.droppedFrames).toBe(0)
    expect(ring.availableFrames).toBe(8192)
  })

  it('reports the underlying channel count', () => {
    const ring = new StereoScopeRingBuffer(SAMPLE_RATE, 1)
    ring.setChannelCount(1)
    ring.write(ramp(0, 512), ramp(0, 512), 0)
    expect(ring.readLatest(512)!.channelCount).toBe(1)
  })

  it('rejects a read larger than its capacity', () => {
    const ring = new StereoScopeRingBuffer(SAMPLE_RATE, 1)
    ring.write(ramp(0, 4096), ramp(0, 4096), 0)
    expect(ring.readLatest(ring.capacityFrames + 1)).toBeNull()
  })

  it('reuses its read scratch buffers across reads of the same size', () => {
    const ring = new StereoScopeRingBuffer(SAMPLE_RATE, 1)
    ring.write(ramp(0, 4096), ramp(0, 4096), 0)
    const first = ring.readLatest(1024)!
    const second = ring.readLatest(1024)!
    // Same backing storage — a steady render loop must not allocate per frame.
    expect(second.left).toBe(first.left)
    expect(second.right).toBe(first.right)
  })
})
