import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DreamVizTextInput } from '../../react/controls/DreamVizTextInput'
import { getNativeDiagnosticsBridge } from '../../../../native/diagnosticsBridge'
import { parseMainLogText, type MainLogEntry, type MainLogLevel } from '../../../../lib/mainLogParser'

const MAX_ENTRIES = 3000
const LEVELS: MainLogLevel[] = ['error', 'warn', 'info', 'debug', 'verbose', 'silly']

type SortColumn = 'timestamp' | 'level' | 'scope' | 'message'
interface SortState { column: SortColumn; direction: 'asc' | 'desc' }

const COLUMNS: Array<{ id: SortColumn; label: string }> = [
  { id: 'timestamp', label: 'Time' },
  { id: 'level', label: 'Level' },
  { id: 'scope', label: 'Scope' },
  { id: 'message', label: 'Message' },
]

function capEntries(entries: MainLogEntry[]): MainLogEntry[] {
  return entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries
}

/** Splits a search string into level:/scope: field tokens plus free text, all ANDed together. */
function parseSearch(raw: string): { levels: string[]; scopes: string[]; text: string[] } {
  const levels: string[] = []
  const scopes: string[] = []
  const text: string[] = []
  for (const token of raw.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    if (token.startsWith('level:')) levels.push(token.slice(6))
    else if (token.startsWith('scope:')) scopes.push(token.slice(6))
    else text.push(token)
  }
  return { levels, scopes, text }
}

export function DeveloperLoggingPanel() {
  const [entries, setEntries] = useState<MainLogEntry[]>([])
  const [logPath, setLogPath] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [live, setLive] = useState(false)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<Set<MainLogLevel>>(new Set())
  const [sort, setSort] = useState<SortState>({ column: 'timestamp', direction: 'desc' })
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let disposed = false
    const bridge = getNativeDiagnosticsBridge()
    if (!bridge?.readMainLog) { setLoadState('error'); return }

    bridge.readMainLog()
      .then(result => {
        if (disposed) return
        if (!result) { setLoadState('error'); return }
        setLogPath(result.path)
        setEntries(capEntries(parseMainLogText(result.content, { dropLeadingPartialLine: result.truncated })))
        setLoadState('ready')
      })
      .catch(() => { if (!disposed) setLoadState('error') })

    const unwatch = bridge.watchMainLog?.(chunk => {
      setEntries(prev => capEntries([...prev, ...parseMainLogText(chunk.content)]))
      setLive(true)
    })

    return () => {
      disposed = true
      unwatch?.()
    }
  }, [])

  useEffect(() => () => {
    if (copyStatusTimer.current) clearTimeout(copyStatusTimer.current)
  }, [])

  const toggleSort = useCallback((column: SortColumn) => {
    setSort(prev => prev.column === column
      ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { column, direction: 'desc' })
  }, [])

  const toggleLevelFilter = useCallback((level: MainLogLevel) => {
    setLevelFilter(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }, [])

  const visibleRows = useMemo(() => {
    const { levels, scopes, text } = parseSearch(search)
    let rows = entries.filter(entry => {
      if (levelFilter.size > 0 && !levelFilter.has(entry.level)) return false
      if (levels.length > 0 && !levels.includes(entry.level)) return false
      if (scopes.length > 0 && !scopes.some(needle => entry.scope.toLowerCase().includes(needle))) return false
      if (text.length > 0) {
        const haystack = `${entry.scope} ${entry.message}`.toLowerCase()
        if (!text.every(needle => haystack.includes(needle))) return false
      }
      return true
    })

    const dir = sort.direction === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      switch (sort.column) {
        case 'timestamp': return ((a.timestamp ?? 0) - (b.timestamp ?? 0)) * dir
        case 'level':     return a.level.localeCompare(b.level) * dir
        case 'scope':     return a.scope.localeCompare(b.scope) * dir
        case 'message':   return a.message.localeCompare(b.message) * dir
      }
    })
    return rows
  }, [entries, search, levelFilter, sort])

  const handleClear = useCallback(() => setEntries([]), [])

  const handleCopyFiltered = useCallback(() => {
    const report = visibleRows
      .map(entry => `${entry.timestampRaw || '—'} [${entry.level.toUpperCase()}] [${entry.scope || '—'}] ${entry.message}`)
      .join('\n')
    const write = navigator.clipboard?.writeText(report)
    if (!write) { setCopyStatus('error'); return }
    void write
      .then(() => setCopyStatus('copied'))
      .catch(() => setCopyStatus('error'))
      .finally(() => {
        if (copyStatusTimer.current) clearTimeout(copyStatusTimer.current)
        copyStatusTimer.current = setTimeout(() => setCopyStatus('idle'), 2000)
      })
  }, [visibleRows])

  return (
    <div className="vsm-dev-log-panel">
      <div className="vsm-dev-log-toolbar">
        <DreamVizTextInput
          className="vsm-dev-log-search"
          type="search"
          placeholder='Search — try "level:error" or "scope:WebGL2Renderer"'
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="Search log entries"
        />
        <div className="vsm-dev-log-chips" role="group" aria-label="Filter by level">
          {LEVELS.map(level => (
            <button
              key={level}
              type="button"
              className={`vsm-dev-log-chip vsm-dev-log-chip--${level}${levelFilter.has(level) ? ' is-active' : ''}`}
              aria-pressed={levelFilter.has(level)}
              onClick={() => toggleLevelFilter(level)}
            >{level}</button>
          ))}
        </div>
        <span className={`vsm-media-sync-dot${live ? ' is-online' : ''}`} aria-hidden="true" />
        <span className="vsm-dev-log-count">{visibleRows.length} / {entries.length}</span>
        <button type="button" className="vsm-settings-inline-link" onClick={handleCopyFiltered}>Copy filtered</button>
        <button type="button" className="vsm-settings-inline-link" onClick={handleClear}>Clear</button>
      </div>

      {copyStatus !== 'idle' && (
        <div className={`vsm-settings-detail${copyStatus === 'error' ? ' vsm-settings-detail--error' : ''}`} role="status" aria-live="polite">
          <span>{copyStatus === 'copied' ? 'Copied filtered rows to clipboard.' : 'Could not copy — clipboard unavailable.'}</span>
        </div>
      )}

      {loadState === 'error' && (
        <div className="vsm-dev-placeholder">
          <p>Could not read the log file{typeof window !== 'undefined' && !window.drmvyzNative?.runtime?.isElectron ? ' — this view needs the desktop app.' : '.'}</p>
        </div>
      )}

      {loadState !== 'error' && (
        <div className="vsm-dev-log-table-wrap">
          <table className="vsm-dev-log-table">
            <thead>
              <tr>
                {COLUMNS.map(column => (
                  <th
                    key={column.id}
                    onClick={() => toggleSort(column.id)}
                    aria-sort={sort.column === column.id ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    {column.label}
                    {sort.column === column.id ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(entry => (
                <tr key={entry.id} className={`vsm-dev-log-row vsm-dev-log-row--${entry.level}`}>
                  <td className="vsm-dev-log-time">{entry.timestampRaw || '—'}</td>
                  <td><span className={`vsm-dev-log-level vsm-dev-log-level--${entry.level}`}>{entry.level.toUpperCase()}</span></td>
                  <td className="vsm-dev-log-scope">{entry.scope || '—'}</td>
                  <td className="vsm-dev-log-message"><pre>{entry.message}</pre></td>
                </tr>
              ))}
              {loadState === 'loading' && (
                <tr><td colSpan={4} className="rv-ctrl-info">Loading main.log…</td></tr>
              )}
              {loadState === 'ready' && visibleRows.length === 0 && (
                <tr><td colSpan={4} className="rv-ctrl-info">No log entries match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {logPath && <div className="vsm-dev-log-path" title={logPath}>{logPath}</div>}
    </div>
  )
}
