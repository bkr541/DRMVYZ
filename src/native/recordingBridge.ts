/** Performance recordings written to disk as they are made, in the desktop app (native/recording/recordingBridge.cjs). */
export interface NativeRecordingBridge {
  start: (fileName: string) => Promise<{ ok: true; id: number } | { ok: false; reason: 'low-disk'; freeBytes: number }>
  append: (id: number, chunk: ArrayBuffer) => Promise<{ ok: true; bytes: number; lowDisk: boolean }>
  finish: (id: number) => Promise<{ ok: true; path: string; bytes: number } | { ok: false; reason: 'empty' }>
  /** Stops writing and keeps what was recorded under its .partial name (null when nothing was recorded). */
  abort: (id: number) => Promise<{ ok: true; path: string | null }>
}

export function getNativeRecordingBridge(): NativeRecordingBridge | null {
  if (typeof window === 'undefined') return null
  return window.drmvyzNative?.recording ?? null
}
