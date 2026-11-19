import { describe, expect, it, vi } from 'vitest'
import { StereoScopeAudioTap } from '../StereoScopeAudioTap'

/**
 * Capture-tap lifecycle.
 *
 * Uses a minimal fake AudioContext rather than jsdom's (absent) Web Audio: the
 * behaviour under test is the tap's own contract — pool seeding, graceful
 * degradation, and disposal — not the browser's worklet implementation.
 */

const BLOCK_FRAMES = 1024

interface FakePort {
  onmessage: ((event: MessageEvent) => void) | null
  postMessage: ReturnType<typeof vi.fn>
}

class FakeWorkletNode {
  port: FakePort = { onmessage: null, postMessage: vi.fn() }
  disconnect = vi.fn()
}

function fakeContext(options: { addModuleRejects?: boolean; sampleRate?: number } = {}) {
  return {
    sampleRate: options.sampleRate ?? 48_000,
    currentTime: 0,
    audioWorklet: {
      addModule: options.addModuleRejects
        ? () => Promise.reject(new Error('blocked'))
        : () => Promise.resolve(),
    },
  } as unknown as AudioContext
}

function legacyCapture(addModuleRejects = false, sampleRate = 48_000) {
  const node = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null }
  const sink = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
  let blockSize = BLOCK_FRAMES
  const createScriptProcessor = vi.fn((size: number) => { blockSize = size; return node })
  const context = Object.assign(fakeContext({ addModuleRejects, sampleRate }), { createScriptProcessor, createGain: () => sink, destination: {} })
  const post = () => {
    const channels = [new Float32Array(blockSize).fill(.42), new Float32Array(blockSize).fill(-.17)]
    node.onaudioprocess?.({ playbackTime: 1, inputBuffer: { numberOfChannels: 2, getChannelData: (index: number) => channels[index] } } as AudioProcessingEvent)
  }
  return { context, node, sink, createScriptProcessor, post }
}

function fakeSource() {
  return { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode
}

/** Installs a global AudioWorkletNode stub and returns the constructed instances. */
function stubWorkletNode(): { instances: FakeWorkletNode[]; restore: () => void } {
  const instances: FakeWorkletNode[] = []
  const original = (globalThis as Record<string, unknown>).AudioWorkletNode
  ;(globalThis as Record<string, unknown>).AudioWorkletNode = function AudioWorkletNodeStub() {
    const node = new FakeWorkletNode()
    instances.push(node)
    return node
  }
  return {
    instances,
    restore: () => {
      if (original === undefined) delete (globalThis as Record<string, unknown>).AudioWorkletNode
      else (globalThis as Record<string, unknown>).AudioWorkletNode = original
    },
  }
}

describe('stereo scope audio tap', () => {
  it('seeds the worklet buffer pool before connecting the source', async () => {
    const stub = stubWorkletNode()
    try {
      const source = fakeSource()
      const tap = new StereoScopeAudioTap(fakeContext())
      expect(await tap.start(source)).toBe(true)

      const node = stub.instances[0]
      // Without a seeded pool the worklet drops its opening blocks, so the
      // display starts with a visible gap.
      expect(node.port.postMessage).toHaveBeenCalledTimes(4)
      for (const call of node.port.postMessage.mock.calls) {
        expect(call[0].type).toBe('recycle')
        expect(call[0].left).toHaveLength(BLOCK_FRAMES)
        expect(call[0].right).toHaveLength(BLOCK_FRAMES)
        expect(call[1]).toHaveLength(2)
      }
      expect(source.connect).toHaveBeenCalledWith(node)
      tap.dispose()
    } finally {
      stub.restore()
    }
  })

  it('reports unavailable rather than throwing when AudioWorklet is missing', async () => {
    const original = (globalThis as Record<string, unknown>).AudioWorkletNode
    delete (globalThis as Record<string, unknown>).AudioWorkletNode
    try {
      const tap = new StereoScopeAudioTap(fakeContext())
      expect(await tap.start(fakeSource())).toBe(false)
      const status = tap.getStatus()
      expect(status.active).toBe(false)
      expect(status.unavailableReason).toBe('workletUnsupported')
      // Rendering must be able to fall back, not crash.
      expect(tap.readLatest(512)).toBeNull()
    } finally {
      if (original !== undefined) (globalThis as Record<string, unknown>).AudioWorkletNode = original
    }
  })

  it('reports a load failure when the worklet module is blocked', async () => {
    const stub = stubWorkletNode()
    try {
      const tap = new StereoScopeAudioTap(fakeContext({ addModuleRejects: true }))
      expect(await tap.start(fakeSource())).toBe(false)
      expect(tap.getStatus().unavailableReason).toBe('workletLoadFailed')
    } finally {
      stub.restore()
    }
  })

  it('captures synchronized left and right from a muted fallback when the module is blocked', async () => {
    const stub = stubWorkletNode()
    const legacy = legacyCapture(true)
    const source = fakeSource()
    const tap = new StereoScopeAudioTap(legacy.context)
    try {
      expect(await tap.start(source)).toBe(true)
      expect(legacy.createScriptProcessor).toHaveBeenCalledWith(BLOCK_FRAMES, 2, 1)
      expect(source.connect).toHaveBeenCalledWith(legacy.node)
      expect(legacy.sink.gain.value).toBe(0)
      expect(legacy.sink.connect).toHaveBeenCalledWith(legacy.context.destination)
      legacy.post()
      const frame = tap.readLatest(BLOCK_FRAMES)
      expect(frame?.startFrame).toBe(48_000)
      expect(frame?.left[0]).toBeCloseTo(.42)
      expect(frame?.right[0]).toBeCloseTo(-.17)
      expect(tap.getStatus().active).toBe(true)
    } finally {
      tap.dispose()
      stub.restore()
    }
    expect(legacy.node.onaudioprocess).toBeNull()
    expect(legacy.sink.disconnect).toHaveBeenCalledOnce()
  })

  it('switches a stalled worklet to the stereo fallback without keeping stale samples', async () => {
    const stub = stubWorkletNode()
    const legacy = legacyCapture(false, 96_000)
    const tap = new StereoScopeAudioTap(legacy.context)
    try {
      await tap.start(fakeSource())
      expect(tap.readLatest(512)).toBeNull()
      expect(legacy.createScriptProcessor).not.toHaveBeenCalled()
      Object.assign(legacy.context, { currentTime: .5 })
      expect(tap.readLatest(512)).toBeNull()
      expect(stub.instances[0].disconnect).toHaveBeenCalledOnce()
      expect(legacy.createScriptProcessor).toHaveBeenCalledWith(2048, 2, 1)
      legacy.post()
      expect(tap.readLatest(1920)?.right[0]).toBeCloseTo(-.17)
      Object.assign(legacy.context, { currentTime: 1 })
      expect(tap.readLatest(512)).toBeNull()
      expect(tap.getStatus()).toMatchObject({ active: false, unavailableReason: 'fallbackStalled' })
    } finally {
      tap.dispose()
      stub.restore()
    }
  })

  it('buffers posted blocks and returns them for reading', async () => {
    const stub = stubWorkletNode()
    try {
      const tap = new StereoScopeAudioTap(fakeContext())
      await tap.start(fakeSource())
      const node = stub.instances[0]

      const left = new Float32Array(BLOCK_FRAMES).fill(0.5)
      const right = new Float32Array(BLOCK_FRAMES).fill(-0.5)
      node.port.onmessage?.({
        data: { type: 'block', left, right, frameCount: BLOCK_FRAMES, startFrame: 0, sampleRate: 48_000, droppedBlocks: 0 },
      } as MessageEvent)

      const frame = tap.readLatest(512)
      expect(frame).not.toBeNull()
      expect(frame!.left[0]).toBeCloseTo(0.5, 6)
      expect(frame!.right[0]).toBeCloseTo(-0.5, 6)
      expect(tap.getStatus().active).toBe(true)
      tap.dispose()
    } finally {
      stub.restore()
    }
  })

  it('recycles received buffers back to the worklet', async () => {
    const stub = stubWorkletNode()
    try {
      const tap = new StereoScopeAudioTap(fakeContext())
      await tap.start(fakeSource())
      const node = stub.instances[0]
      node.port.postMessage.mockClear()

      const left = new Float32Array(BLOCK_FRAMES)
      const right = new Float32Array(BLOCK_FRAMES)
      node.port.onmessage?.({
        data: { type: 'block', left, right, frameCount: BLOCK_FRAMES, startFrame: 0, sampleRate: 48_000, droppedBlocks: 0 },
      } as MessageEvent)

      // Buffers go straight back so the audio thread never allocates.
      expect(node.port.postMessage).toHaveBeenCalledTimes(1)
      expect(node.port.postMessage.mock.calls[0][0].type).toBe('recycle')
      tap.dispose()
    } finally {
      stub.restore()
    }
  })

  it('discards buffered audio on reset', async () => {
    const stub = stubWorkletNode()
    try {
      const tap = new StereoScopeAudioTap(fakeContext())
      await tap.start(fakeSource())
      const node = stub.instances[0]
      node.port.onmessage?.({
        data: {
          type: 'block',
          left: new Float32Array(BLOCK_FRAMES).fill(1),
          right: new Float32Array(BLOCK_FRAMES).fill(1),
          frameCount: BLOCK_FRAMES, startFrame: 0, sampleRate: 48_000, droppedBlocks: 0,
        },
      } as MessageEvent)
      expect(tap.readLatest(512)).not.toBeNull()

      tap.reset()
      // No window may straddle a seek.
      expect(tap.readLatest(512)).toBeNull()
      tap.dispose()
    } finally {
      stub.restore()
    }
  })

  it('releases the worklet on disposal and stops reading', async () => {
    const stub = stubWorkletNode()
    try {
      const source = fakeSource()
      const tap = new StereoScopeAudioTap(fakeContext())
      await tap.start(source)
      const node = stub.instances[0]

      tap.dispose()
      expect(node.port.onmessage).toBeNull()
      expect(source.disconnect).toHaveBeenCalled()
      expect(tap.readLatest(512)).toBeNull()
      expect(tap.getStatus().unavailableReason).toBe('disposed')

      // Disposal is idempotent — the hook cleanup may run more than once.
      expect(() => tap.dispose()).not.toThrow()
    } finally {
      stub.restore()
    }
  })

  it('labels a mono source honestly', async () => {
    const stub = stubWorkletNode()
    try {
      const tap = new StereoScopeAudioTap(fakeContext())
      await tap.start(fakeSource())
      tap.setSourceChannelCount(1)
      const node = stub.instances[0]
      node.port.onmessage?.({
        data: {
          type: 'block',
          left: new Float32Array(BLOCK_FRAMES),
          right: new Float32Array(BLOCK_FRAMES),
          frameCount: BLOCK_FRAMES, startFrame: 0, sampleRate: 48_000, droppedBlocks: 0,
        },
      } as MessageEvent)

      expect(tap.readLatest(512)!.channelCount).toBe(1)
      expect(tap.getStatus().channelCount).toBe(1)
      tap.dispose()
    } finally {
      stub.restore()
    }
  })
})
