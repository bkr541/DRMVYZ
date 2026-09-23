/**
 * Renderer-side diagnostic logging. Every entry is kept in a bounded
 * in-memory ring buffer (for the Settings → System → "Copy Diagnostics"
 * export) and, when running under Electron, forwarded over IPC to the main
 * process's electron-log file — the same persistent, rotating log the main
 * process already writes to — so renderer and main-process history land in
 * one place instead of only ever living in a DevTools console no packaged
 * build can reach.
 */

import { getNativeDiagnosticsBridge } from '../native/diagnosticsBridge'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: number
  level: LogLevel
  category: string
  message: string
  context?: unknown
}

const RING_BUFFER_SIZE = 1000
const ringBuffer: LogEntry[] = []

function record(entry: LogEntry): void {
  ringBuffer.push(entry)
  if (ringBuffer.length > RING_BUFFER_SIZE) ringBuffer.shift()
  try {
    getNativeDiagnosticsBridge()?.log?.(entry)
  } catch {
    // Logging must never itself throw.
  }
}

function emit(level: LogLevel, category: string, message: string, context?: unknown): void {
  record({ timestamp: Date.now(), level, category, message, context })
  const prefix = `[${category}]`
  const args: unknown[] = context !== undefined ? [prefix, message, context] : [prefix, message]
  if (level === 'error') console.error(...args)
  else if (level === 'warn') console.warn(...args)
  else if (level === 'debug') console.debug(...args)
  else console.info(...args)
}

export interface Logger {
  debug: (message: string, context?: unknown) => void
  info: (message: string, context?: unknown) => void
  warn: (message: string, context?: unknown) => void
  error: (message: string, context?: unknown) => void
}

/** One logger per module/subsystem, tagged with a short category name. */
export function createLogger(category: string): Logger {
  return {
    debug: (message, context) => emit('debug', category, message, context),
    info:  (message, context) => emit('info',  category, message, context),
    warn:  (message, context) => emit('warn',  category, message, context),
    error: (message, context) => emit('error', category, message, context),
  }
}

/** Most recent entries first-to-last, oldest dropped once the buffer is full. */
export function getRecentLogEntries(limit = RING_BUFFER_SIZE): LogEntry[] {
  return ringBuffer.slice(-limit)
}

export function clearLogRingBuffer(): void {
  ringBuffer.length = 0
}
