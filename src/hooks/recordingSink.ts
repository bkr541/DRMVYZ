import type { NativeRecordingBridge } from '../native/recordingBridge'

/**
 * Where a performance recording goes while it is being made (beta remediation PERF-01).
 *
 * - Desktop app: each chunk is written straight to `Downloads/STAGELESS Recordings/<name>.partial`, renamed when the recording stops. Memory use
 *   stays flat for a set of any length, and a crash leaves everything recorded so far on disk. Low disk space stops the recording, keeping it.
 * - Browser: chunks are held in memory (browsers cannot write a file progressively), so the recording stops by itself at MEMORY_RECORDING_LIMIT.
 */

/** About 30 minutes at 8 Mbps; beyond this a browser tab risks running out of memory. */
export const MEMORY_RECORDING_LIMIT_BYTES = 1.5 * 1024 ** 3

export type RecordingSinkOutcome =
  | { kind: 'saved-to-disk'; path: string; bytes: number }
  | { kind: 'kept-partial'; path: string }
  | { kind: 'downloaded'; bytes: number }
  | { kind: 'empty' }

export interface RecordingSinkEvents {
  /** The recording must stop now (not enough disk space, or the memory limit was reached); what was recorded is kept. */
  onMustStop: (reason: 'low-disk' | 'memory-limit' | 'write-failed', detail?: string) => void
}

export interface RecordingSink {
  write: (chunk: Blob) => void
  /** Completes the file. Resolves once it is saved. */
  finish: () => Promise<RecordingSinkOutcome>
  /** Stops writing and keeps what was recorded (desktop: under its .partial name). */
  abort: () => Promise<RecordingSinkOutcome>
}

export function createDiskRecordingSink(bridge: NativeRecordingBridge, fileName: string, events: RecordingSinkEvents): RecordingSink {
  let id: number | null = null
  let failed = false
  let chain: Promise<void> = bridge.start(fileName).then(result => {
    if (!result.ok) { failed = true; events.onMustStop('low-disk', `${Math.round(result.freeBytes / 1024 ** 3 * 10) / 10} GB free`); return }
    id = result.id
  }, (error: unknown) => { failed = true; events.onMustStop('write-failed', error instanceof Error ? error.message : String(error)) })

  return {
    write(chunk) {
      chain = chain.then(async () => {
        if (failed || id === null) return
        try {
          const result = await bridge.append(id, await chunk.arrayBuffer())
          if (result.lowDisk) events.onMustStop('low-disk')
        } catch (error) {
          failed = true
          events.onMustStop('write-failed', error instanceof Error ? error.message : String(error))
        }
      })
    },
    async finish() {
      await chain
      if (id === null) return { kind: 'empty' }
      if (failed) {
        const kept = await bridge.abort(id)
        return kept.path ? { kind: 'kept-partial', path: kept.path } : { kind: 'empty' }
      }
      const result = await bridge.finish(id)
      return result.ok ? { kind: 'saved-to-disk', path: result.path, bytes: result.bytes } : { kind: 'empty' }
    },
    async abort() {
      await chain
      if (id === null) return { kind: 'empty' }
      const kept = await bridge.abort(id)
      return kept.path ? { kind: 'kept-partial', path: kept.path } : { kind: 'empty' }
    },
  }
}

export function createMemoryRecordingSink(
  type: string,
  download: (blob: Blob) => void,
  events: RecordingSinkEvents,
  limitBytes = MEMORY_RECORDING_LIMIT_BYTES,
): RecordingSink {
  const chunks: Blob[] = []
  let bytes = 0
  let stopped = false
  const save = async (): Promise<RecordingSinkOutcome> => {
    if (bytes === 0) return { kind: 'empty' }
    download(new Blob(chunks, { type }))
    chunks.length = 0
    return { kind: 'downloaded', bytes }
  }
  return {
    write(chunk) {
      chunks.push(chunk)
      bytes += chunk.size
      if (!stopped && bytes >= limitBytes) { stopped = true; events.onMustStop('memory-limit') }
    },
    finish: save,
    abort: save,
  }
}
