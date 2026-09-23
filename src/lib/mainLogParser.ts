/**
 * Parses electron-log's default file format (see electron/logging.cjs) into
 * structured rows for the Settings → Developer → Logging table.
 *
 * A normal line looks like:
 *   [2026-09-22 13:43:45.501] [info]  (main) logging ready — ...
 *   [2026-09-22 13:43:45.598] [info]         app ready — ...          (no scope)
 * A multi-line value (a stack trace, a pretty-printed context object) has no
 * "[timestamp] [level]" prefix on its continuation lines — those are folded
 * into the previous entry's message rather than parsed as rows of their own.
 */

export type MainLogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'silly' | 'unknown'

export interface MainLogEntry {
  id: string
  /** Epoch ms, or null when the line's timestamp couldn't be parsed. */
  timestamp: number | null
  /** The raw "YYYY-MM-DD HH:MM:SS.mmm" text, kept for display as-authored. */
  timestampRaw: string
  level: MainLogLevel
  scope: string
  message: string
}

const ENTRY_RE = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\]\s*\[(\w+)\]\s*(?:\(([^)]+)\))?\s?(.*)$/
const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})$/
const KNOWN_LEVELS = new Set<MainLogLevel>(['error', 'warn', 'info', 'debug', 'verbose', 'silly'])

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `mle${idCounter}`
}

function parseTimestamp(raw: string): number | null {
  const match = TIMESTAMP_RE.exec(raw)
  if (!match) return null
  const [, y, mo, d, h, mi, s, ms] = match
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(ms)).getTime()
}

function normalizeLevel(raw: string): MainLogLevel {
  const lower = raw.toLowerCase()
  return KNOWN_LEVELS.has(lower as MainLogLevel) ? (lower as MainLogLevel) : 'unknown'
}

export interface ParseMainLogOptions {
  /**
   * True when `text` is a tail read starting mid-file: its first line may be
   * a torn fragment of a line that started before the read window, not a
   * real entry — drop it rather than show corrupted content.
   */
  dropLeadingPartialLine?: boolean
}

export function parseMainLogText(text: string, options: ParseMainLogOptions = {}): MainLogEntry[] {
  if (!text) return []
  const lines = text.split('\n')
  const entries: MainLogEntry[] = []
  let current: MainLogEntry | null = null

  lines.forEach((line, index) => {
    const match = ENTRY_RE.exec(line)
    if (match) {
      const [, timestampRaw, levelRaw, scope, message] = match
      current = {
        id: nextId(),
        timestamp: parseTimestamp(timestampRaw),
        timestampRaw,
        level: normalizeLevel(levelRaw),
        scope: scope ?? '',
        message,
      }
      entries.push(current)
      return
    }

    if (index === 0 && options.dropLeadingPartialLine) return
    // A file ending in "\n" splits into a trailing empty element — not a continuation line.
    if (index === lines.length - 1 && line === '') return

    if (current) {
      current.message += `\n${line}`
    } else if (line.trim().length > 0) {
      current = { id: nextId(), timestamp: null, timestampRaw: '', level: 'unknown', scope: '', message: line }
      entries.push(current)
    }
  })

  return entries
}
