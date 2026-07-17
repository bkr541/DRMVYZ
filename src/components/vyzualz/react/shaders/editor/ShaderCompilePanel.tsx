import React from 'react'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShaderCompileStatus {
  state:         'idle' | 'compiling' | 'ok' | 'error'
  errorLog?:     string
  warningLog?:   string
  lastOkAt?:     string  // ISO 8601
  compiledDefId?: string
}

// Parse a raw GLSL error log into line-annotated items.
interface LogItem {
  level:   'error' | 'warning' | 'info'
  line:    number | null
  message: string
}

function parseLog(log: string, level: 'error' | 'warning'): LogItem[] {
  const items: LogItem[] = []
  for (const raw of log.split('\n')) {
    const t = raw.trim()
    if (!t) continue
    const m = /^(ERROR|WARNING):\s*\d+:(\d+):\s*(.+)$/i.exec(t)
    if (m) {
      items.push({ level: m[1].toLowerCase() === 'warning' ? 'warning' : level, line: parseInt(m[2], 10), message: m[3].trim() })
    } else {
      items.push({ level, line: null, message: t })
    }
  }
  return items
}

// ── ShaderCompilePanel ────────────────────────────────────────────────────────

export interface ShaderCompilePanelProps {
  status:     ShaderCompileStatus
  definition: ShaderDefinition | null
}

export function ShaderCompilePanel({ status, definition }: ShaderCompilePanelProps) {
  const errors   = status.errorLog   ? parseLog(status.errorLog,   'error')   : []
  const warnings = status.warningLog ? parseLog(status.warningLog, 'warning') : []
  const statusLabel = status.state === 'idle'
    ? 'Not compiled'
    : status.state === 'compiling'
      ? 'Compiling…'
      : status.state === 'ok'
        ? 'Compiled OK'
        : 'Compile failed'
  const lastOkLabel = status.lastOkAt
    ? new Date(status.lastOkAt).toLocaleTimeString()
    : 'Unavailable'

  return (
    <div className="rv-shader-compile-panel">
      <dl className="rv-show-director-performance-status__grid rv-shader-compile-grid">
        <div>
          <dt>Compile</dt>
          <dd className={`rv-shader-compile-status rv-shader-compile-status--${status.state}`}>{statusLabel}</dd>
        </div>
        <div><dt>Last OK</dt><dd>{lastOkLabel}</dd></div>
        <div><dt>Errors</dt><dd>{errors.length}</dd></div>
        <div><dt>Warnings</dt><dd>{warnings.length}</dd></div>
      </dl>

      {status.state === 'error' && definition && (
        <p className="rv-show-director-performance-status__notice rv-shader-compile-fallback">
          Showing the last valid render for {definition.name}.
        </p>
      )}

      {/* Warning list */}
      {warnings.length > 0 && (
        <div className="rv-shader-compile-log">
          <div className="rv-shader-compile-log-title">Warnings ({warnings.length})</div>
          {warnings.map((w, i) => (
            <div key={i} className="rv-shader-compile-log-item rv-shader-compile-log-item--warning">
              {w.line !== null && <span className="rv-shader-compile-log-line">:{w.line}</span>}
              <span className="rv-shader-compile-log-msg">{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error list */}
      {errors.length > 0 && (
        <div className="rv-shader-compile-log">
          <div className="rv-shader-compile-log-title">Errors ({errors.length})</div>
          {errors.map((e, i) => (
            <div key={i} className="rv-shader-compile-log-item rv-shader-compile-log-item--error">
              {e.line !== null && <span className="rv-shader-compile-log-line">:{e.line}</span>}
              <span className="rv-shader-compile-log-msg">{e.message}</span>
            </div>
          ))}
        </div>
      )}

      {status.state === 'ok' && errors.length === 0 && warnings.length === 0 && (
        <p className="rv-show-director-performance-status__notice rv-shader-compile-clean">
          No errors or warnings.
        </p>
      )}
    </div>
  )
}
