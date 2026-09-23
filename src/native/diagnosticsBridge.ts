import type { LogComponent } from '../lib/logComponents'

export interface NativeDiagnosticsLogEntry {
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  component: LogComponent
  category: string
  message: string
  context?: unknown
}

export interface NativeMainLogSnapshot {
  path: string
  content: string
  /** True when `content` is only the tail of the file, not the whole thing. */
  truncated: boolean
  sizeBytes: number
}

export interface NativeMainLogAppendChunk {
  content: string
}

export interface NativeDiagnosticsBridge {
  /** Fire-and-forget forward of a renderer log entry into the main process's persistent log file. */
  log?: (entry: NativeDiagnosticsLogEntry) => void
  /** One-shot read of the current main-process log file (tail, if large). */
  readMainLog?: () => Promise<NativeMainLogSnapshot | null>
  /** Subscribes to appended log text as the file grows. Returns an unsubscribe function. */
  watchMainLog?: (callback: (chunk: NativeMainLogAppendChunk) => void) => () => void
}

export function getNativeDiagnosticsBridge(): NativeDiagnosticsBridge | null {
  if (typeof window === 'undefined') return null
  return window.drmvyzNative?.diagnostics ?? null
}
