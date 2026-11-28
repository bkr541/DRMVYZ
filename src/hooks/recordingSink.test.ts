import { describe, expect, it, vi } from 'vitest'
import type { NativeRecordingBridge } from '../native/recordingBridge'
import { createDiskRecordingSink, createMemoryRecordingSink } from './recordingSink'

function fakeBridge(options: { lowDiskAt?: number; failAt?: number; startLowDisk?: boolean } = {}) {
  const written: string[] = []
  const bridge: NativeRecordingBridge = {
    start: vi.fn(async () => (options.startLowDisk ? { ok: false as const, reason: 'low-disk' as const, freeBytes: 1024 ** 3 } : { ok: true as const, id: 7 })),
    append: vi.fn(async (_id: number, chunk: ArrayBuffer) => {
      const index = written.length
      if (index === options.failAt) throw new Error('disk error')
      written.push(new TextDecoder().decode(chunk))
      return { ok: true as const, bytes: written.join('').length, lowDisk: index === options.lowDiskAt }
    }),
    finish: vi.fn(async () => ({ ok: true as const, path: '/Downloads/STAGELESS Recordings/set.webm', bytes: written.join('').length })),
    abort: vi.fn(async () => ({ ok: true as const, path: written.length ? '/Downloads/STAGELESS Recordings/set.webm.partial' : null })),
  }
  return { bridge, written }
}
const chunk = (text: string) => new Blob([text])

describe('recording sinks (PERF-01)', () => {
  it('writes every chunk to disk in order as it arrives and names the file when the recording stops', async () => {
    const { bridge, written } = fakeBridge()
    const sink = createDiskRecordingSink(bridge, 'set.webm', { onMustStop: vi.fn() })
    sink.write(chunk('a')); sink.write(chunk('b')); sink.write(chunk('c'))
    expect(await sink.finish()).toEqual({ kind: 'saved-to-disk', path: '/Downloads/STAGELESS Recordings/set.webm', bytes: 3 })
    expect(written).toEqual(['a', 'b', 'c'])
  })

  it('stops the recording when the disk is nearly full, at the start or while recording, keeping what was recorded', async () => {
    const onMustStop = vi.fn()
    const { bridge } = fakeBridge({ lowDiskAt: 1 })
    const sink = createDiskRecordingSink(bridge, 'set.webm', { onMustStop })
    sink.write(chunk('a')); sink.write(chunk('b'))
    await sink.finish()
    expect(onMustStop).toHaveBeenCalledWith('low-disk')

    const atStart = vi.fn()
    const full = fakeBridge({ startLowDisk: true })
    const refused = createDiskRecordingSink(full.bridge, 'set.webm', { onMustStop: atStart })
    refused.write(chunk('a'))
    expect(await refused.finish()).toEqual({ kind: 'empty' })
    expect(atStart).toHaveBeenCalledWith('low-disk', '1 GB free')
    expect(full.bridge.append).not.toHaveBeenCalled()
  })

  it('keeps the partial file when a write fails', async () => {
    const onMustStop = vi.fn()
    const { bridge } = fakeBridge({ failAt: 1 })
    const sink = createDiskRecordingSink(bridge, 'set.webm', { onMustStop })
    sink.write(chunk('a')); sink.write(chunk('b')); sink.write(chunk('c'))
    expect(await sink.finish()).toEqual({ kind: 'kept-partial', path: '/Downloads/STAGELESS Recordings/set.webm.partial' })
    expect(onMustStop).toHaveBeenCalledWith('write-failed', 'disk error')
  })

  it('stops a browser recording at the memory limit and still saves it', async () => {
    const onMustStop = vi.fn()
    const download = vi.fn()
    const sink = createMemoryRecordingSink('video/webm', download, { onMustStop }, 4)
    sink.write(chunk('ab')); sink.write(chunk('cd')); sink.write(chunk('ef'))
    expect(onMustStop).toHaveBeenCalledTimes(1)
    expect(onMustStop).toHaveBeenCalledWith('memory-limit')
    expect(await sink.finish()).toEqual({ kind: 'downloaded', bytes: 6 })
    expect(download).toHaveBeenCalledTimes(1)
  })
})
