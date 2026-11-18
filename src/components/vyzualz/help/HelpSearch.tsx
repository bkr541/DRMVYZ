import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { InfoPopover } from '../../shared/InfoPopover'
import { LibrarySearchRow } from '../react/controls/LibrarySearchRow'
import { helpDetailSections } from './helpDetailSections'
import { HELP_SEARCH_ENTRIES, type HelpSearchEntry } from './helpSearchEntries'
import { searchHelpEntries } from './searchHelpEntries'
import './HelpSearch.css'

const PANEL_WIDTH = 320
const PANEL_GAP = 8
const VIEWPORT_PADDING = 12

/** The header's help search: type a word and the matching help topics are listed below the field; choosing one opens a
 * popover with that topic's detail. It replaces the old per-control tooltip popovers as the place to look things up. */
export function HelpSearch({ entries = HELP_SEARCH_ENTRIES, onSelect }: {
  entries?: readonly HelpSearchEntry[]
  /** Called when a topic is chosen, as well as opening its detail popover. */
  onSelect?: (entry: HelpSearchEntry) => void
}) {
  const baseId = useId()
  const inputId = `${baseId}-input`
  const listId = `${baseId}-list`
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [detail, setDetail] = useState<HelpSearchEntry | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const results = useMemo(() => searchHelpEntries(query, entries), [query, entries])
  const showPanel = open && query.trim() !== ''
  const optionId = (index: number) => `${listId}-option-${index}`

  useLayoutEffect(() => {
    if (!showPanel) return
    const place = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const left = Math.max(VIEWPORT_PADDING, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - VIEWPORT_PADDING))
      setPosition({ left, top: rect.bottom + PANEL_GAP })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [showPanel])

  useEffect(() => {
    if (!showPanel) return
    const close = (event: PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [showPanel])

  useEffect(() => {
    if (showPanel) panelRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [active, showPanel])

  const choose = (entry: HelpSearchEntry) => {
    setOpen(false)
    setDetail(entry)
    onSelect?.(entry)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (showPanel) { event.preventDefault(); setOpen(false) }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (query.trim() === '') return
      event.preventDefault()
      if (!showPanel) { setOpen(true); return }
      if (results.length > 0) setActive(current => (current + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length)
      return
    }
    if (event.key === 'Enter' && showPanel && results[active]) {
      event.preventDefault()
      choose(results[active])
    }
  }

  return <div className="rv-header-search" ref={rootRef}>
    <label className="vz-header-readout-label" htmlFor={inputId}>SEARCH</label>
    <LibrarySearchRow
      value={query}
      onChange={value => { setQuery(value); setActive(0); setOpen(true); setDetail(null) }}
      placeholder=""
      label="Search help"
      clearable
      showIcon={false}
      inputRef={inputRef}
      onKeyDown={onKeyDown}
      inputProps={{
        id: inputId,
        role: 'combobox',
        autoComplete: 'off',
        'aria-autocomplete': 'list',
        'aria-expanded': showPanel,
        'aria-controls': showPanel ? listId : undefined,
        'aria-activedescendant': showPanel && results[active] ? optionId(active) : undefined,
        onFocus: () => { if (query.trim() !== '') setOpen(true) },
      }}
    />
    <InfoPopover
      open={detail != null}
      anchorRef={inputRef}
      onOpenChange={next => { if (!next) setDetail(null) }}
      title={detail?.title ?? ''}
      description={detail?.summary}
      sections={detail ? helpDetailSections(detail) : []}
      footer={detail ? `Help topic \u00b7 ${detail.category}` : undefined}
      placement="below"
      align="start"
      width={340}
      className="hs-detail-popover"
      closeLabel="Close help topic"
    />
    {showPanel && position && createPortal(
      <div ref={panelRef} className="hs-panel" style={{ left: position.left, top: position.top, width: PANEL_WIDTH }}>
        {results.length === 0
          ? <p className="hs-empty" role="status">No help topics match “{query.trim()}”.</p>
          : <ul id={listId} className="hs-list" role="listbox" aria-label="Help topics">
              {results.map((entry, index) => <li
                key={entry.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                className="hs-option"
                data-active={index === active || undefined}
                onMouseDown={event => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(entry)}
              >
                <span className="hs-option-head"><span className="hs-option-title">{entry.title}</span><span className="hs-option-category">{entry.category}</span></span>
                <span className="hs-option-summary">{entry.summary}</span>
              </li>)}
            </ul>}
      </div>,
      document.body,
    )}
  </div>
}
