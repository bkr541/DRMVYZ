import { AppIcon } from '../../../shared/icons/AppIcon'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { DreamVizTextInput } from '../../react/controls/DreamVizTextInput'
import { UnderlineDropdown } from '../../react/controls/UnderlineDropdown'
import { getNativeDiagnosticsBridge } from '../../../../native/diagnosticsBridge'
import { parseMainLogText, type MainLogEntry, type MainLogLevel } from '../../../../lib/mainLogParser'
import { LOG_COMPONENTS, LOG_COMPONENT_LABELS, type LogComponent } from '../../../../lib/logComponents'

const MAX_ENTRIES = 3000
const LEVELS: MainLogLevel[] = ['error', 'warn', 'info', 'debug', 'verbose', 'silly']
type LevelFilterValue = MainLogLevel | 'all'
type ComponentFilterValue = LogComponent | 'all'

function CopyIcon() {
  return (
    <AppIcon kind="copy" size="13" />
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

/** Log contents shown instead of reading the desktop app's main.log; Layout Lab passes placeholder entries. */
export interface DeveloperLogPreview {
  entries: MainLogEntry[]
  path: string
  live?: boolean
}

export function DeveloperLoggingPanel({ preview }: { preview?: DeveloperLogPreview } = {}) {
  const [entries, setEntries] = useState<MainLogEntry[]>(preview?.entries ?? [])
  const [logPath, setLogPath] = useState<string | null>(preview?.path ?? null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(preview ? 'ready' : 'loading')
  const [live, setLive] = useState(preview?.live ?? false)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<LevelFilterValue>('all')
  const [componentFilter, setComponentFilter] = useState<ComponentFilterValue>('all')
  const [sort, setSort] = useState<SortState>({ column: 'timestamp', direction: 'desc' })
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (preview) return
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the preview is fixed for the panel's lifetime
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
        <UnderlineDropdown
          className="vsm-dev-log-level-select"
          eyebrow="Level"
          ariaLabel="Filter by level"
          value={levelFilter}
          onChange={value => setLevelFilter(value as LevelFilterValue)}
          options={[
            { value: 'all', label: 'All' },
            ...LEVELS.map(level => ({ value: level, label: level.toUpperCase() })),
          ]}
        />
        <UnderlineDropdown
          className="vsm-dev-log-component-select"
          eyebrow="Component"
          ariaLabel="Filter by component"
          value={componentFilter}
          onChange={value => setComponentFilter(value as ComponentFilterValue)}
          options={[
            { value: 'all', label: 'All' },
            ...LOG_COMPONENTS.map(component => ({ value: component, label: LOG_COMPONENT_LABELS[component] })),
          ]}
        />
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
                      {hasMore && <span className="vsm-dev-log-expand-caret" aria-hidden="true">{expanded ? <AppIcon kind="chevronDown" size={14} /> : <AppIcon kind="chevronRight" size={14} />}</span>}
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
