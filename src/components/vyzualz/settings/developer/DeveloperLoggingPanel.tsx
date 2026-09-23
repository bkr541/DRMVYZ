import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { DreamVizTextInput } from '../../react/controls/DreamVizTextInput'
import { DropdownSelect } from '../../../shared/Dropdown/Dropdown'
import { getNativeDiagnosticsBridge } from '../../../../native/diagnosticsBridge'
import { parseMainLogText, type MainLogEntry, type MainLogLevel } from '../../../../lib/mainLogParser'
import { LOG_COMPONENTS, LOG_COMPONENT_LABELS, type LogComponent } from '../../../../lib/logComponents'

const MAX_ENTRIES = 3000
const LEVELS: MainLogLevel[] = ['error', 'warn', 'info', 'debug', 'verbose', 'silly']
type LevelFilterValue = MainLogLevel | 'all'
type ComponentFilterValue = LogComponent | 'all'

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
      <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/>
    </svg>
  )
}

type SortColumn = 'timestamp' | 'level' | 'component' | 'scope' | 'message'
interface SortState { column: SortColumn; direction: 'asc' | 'desc' }

const COLUMNS: Array<{ id: SortColumn; label: string }> = [
  { id: 'timestamp', label: 'Time' },
  { id: 'level', label: 'Level' },
  { id: 'component', label: 'Component' },
  { id: 'scope', label: 'Scope' },
  { id: 'message', label: 'Message' },
]

function capEntries(entries: MainLogEntry[]): MainLogEntry[] {
  return entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries
}

/** Splits a search string into level:/component:/scope: field tokens plus free text, all ANDed together. */
function parseSearch(raw: string): { levels: string[]; components: string[]; scopes: string[]; text: string[] } {
  const levels: string[] = []
  const components: string[] = []
  const scopes: string[] = []
  const text: string[] = []
  for (const token of raw.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    if (token.startsWith('level:')) levels.push(token.slice(6))
    else if (token.startsWith('component:')) components.push(token.slice(10))
    else if (token.startsWith('scope:')) scopes.push(token.slice(6))
    else text.push(token)
  }
  return { levels, components, scopes, text }
}

export function DeveloperLoggingPanel() {
  const [entries, setEntries] = useState<MainLogEntry[]>([])
  const [logPath, setLogPath] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [live, setLive] = useState(false)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<LevelFilterValue>('all')
  const [componentFilter, setComponentFilter] = useState<ComponentFilterValue>('all')
  const [sort, setSort] = useState<SortState>({ column: 'timestamp', direction: 'desc' })
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const visibleRows = useMemo(() => {
    const { levels, components, scopes, text } = parseSearch(search)
    let rows = entries.filter(entry => {
      if (levelFilter !== 'all' && entry.level !== levelFilter) return false
      if (componentFilter !== 'all' && entry.component !== componentFilter) return false
      if (levels.length > 0 && !levels.includes(entry.level)) return false
      if (components.length > 0 && !components.some(needle => entry.component.includes(needle))) return false
      if (scopes.length > 0 && !scopes.some(needle => entry.scope.toLowerCase().includes(needle))) return false
      if (text.length > 0) {
        const haystack = `${entry.component} ${entry.scope} ${entry.message}`.toLowerCase()
        if (!text.every(needle => haystack.includes(needle))) return false
      }
      return true
    })

    const dir = sort.direction === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      switch (sort.column) {
        case 'timestamp': return ((a.timestamp ?? 0) - (b.timestamp ?? 0)) * dir
        case 'level':     return a.level.localeCompare(b.level) * dir
        case 'component': return a.component.localeCompare(b.component) * dir
        case 'scope':     return a.scope.localeCompare(b.scope) * dir
        case 'message':   return a.message.localeCompare(b.message) * dir
      }
    })
    return rows
  }, [entries, search, levelFilter, componentFilter, sort])

  const handleCopyRow = useCallback((entry: MainLogEntry, event: MouseEvent) => {
    event.stopPropagation() // don't also toggle the row's expand/collapse
    const text = `${entry.timestampRaw || '—'} [${entry.level.toUpperCase()}] [${LOG_COMPONENT_LABELS[entry.component]}] [${entry.scope || '—'}] ${entry.message}`
    const write = navigator.clipboard?.writeText(text)
    if (!write) { setCopyStatus('error'); return }
    void write
      .then(() => setCopyStatus('copied'))
      .catch(() => setCopyStatus('error'))
      .finally(() => {
        if (copyStatusTimer.current) clearTimeout(copyStatusTimer.current)
        copyStatusTimer.current = setTimeout(() => setCopyStatus('idle'), 2000)
      })
  }, [])

  return (
    <div className="vsm-dev-log-panel">
      <div className="vsm-dev-log-toolbar">
        <DreamVizTextInput
          className="vsm-dev-log-search"
          type="search"
          placeholder='Search — try "component:react" or "scope:WebGL2Renderer"'
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="Search log entries"
        />
        <DropdownSelect
          className="vsm-dev-log-level-select"
          value={levelFilter}
          onChange={event => setLevelFilter(event.target.value as LevelFilterValue)}
          aria-label="Filter by level"
          dropdownSize="compact"
        >
          <option value="all">All</option>
          {LEVELS.map(level => <option key={level} value={level}>{level.toUpperCase()}</option>)}
        </DropdownSelect>
        <DropdownSelect
          className="vsm-dev-log-component-select"
          value={componentFilter}
          onChange={event => setComponentFilter(event.target.value as ComponentFilterValue)}
          aria-label="Filter by component"
          dropdownSize="compact"
        >
          <option value="all">All</option>
          {LOG_COMPONENTS.map(component => <option key={component} value={component}>{LOG_COMPONENT_LABELS[component]}</option>)}
        </DropdownSelect>
        <span className={`vsm-media-sync-dot${live ? ' is-online' : ''}`} aria-hidden="true" />
        <span className="vsm-dev-log-count">{visibleRows.length} / {entries.length}</span>
      </div>

      {copyStatus !== 'idle' && (
        <div className={`vsm-settings-detail${copyStatus === 'error' ? ' vsm-settings-detail--error' : ''}`} role="status" aria-live="polite">
          <span>{copyStatus === 'copied' ? 'Copied to clipboard.' : 'Could not copy — clipboard unavailable.'}</span>
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
              {visibleRows.map(entry => {
                const lines = entry.message.split('\n')
                const hasMore = lines.length > 1
                const expanded = hasMore && expandedIds.has(entry.id)
                return (
                  <tr
                    key={entry.id}
                    className={`vsm-dev-log-row vsm-dev-log-row--${entry.level}${hasMore ? ' vsm-dev-log-row--collapsible' : ''}`}
                    onClick={hasMore ? () => toggleExpanded(entry.id) : undefined}
                    role={hasMore ? 'button' : undefined}
                    tabIndex={hasMore ? 0 : undefined}
                    aria-expanded={hasMore ? expanded : undefined}
                    onKeyDown={hasMore ? event => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      toggleExpanded(entry.id)
                    } : undefined}
                  >
                    <td className="vsm-dev-log-time">{entry.timestampRaw || '—'}</td>
                    <td><span className={`vsm-dev-log-level vsm-dev-log-level--${entry.level}`}>{entry.level.toUpperCase()}</span></td>
                    <td><span className={`vsm-dev-log-component vsm-dev-log-component--${entry.component}`}>{LOG_COMPONENT_LABELS[entry.component]}</span></td>
                    <td className="vsm-dev-log-scope">{entry.scope || '—'}</td>
                    <td className="vsm-dev-log-message">
                      {hasMore && <span className="vsm-dev-log-expand-caret" aria-hidden="true">{expanded ? '▾' : '▸'}</span>}
                      <span className="vsm-dev-log-message-first">{lines[0]}</span>
                      {hasMore && (
                        <div className={`vsm-dev-log-message-collapse${expanded ? ' is-expanded' : ''}`}>
                          <div><pre>{lines.slice(1).join('\n')}</pre></div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="vsm-dev-log-copy-row-btn"
                        aria-label="Copy this log entry"
                        onClick={event => handleCopyRow(entry, event)}
                      ><CopyIcon /></button>
                    </td>
                  </tr>
                )
              })}
              {loadState === 'loading' && (
                <tr><td colSpan={5} className="rv-ctrl-info">Loading main.log…</td></tr>
              )}
              {loadState === 'ready' && visibleRows.length === 0 && (
                <tr><td colSpan={5} className="rv-ctrl-info">No log entries match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {logPath && <div className="vsm-dev-log-path" title={logPath}>{logPath}</div>}
    </div>
  )
}
