import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { DreamVizTextInput } from '../../vyzualz/react/controls/DreamVizTextInput'
import { AppIcon } from '../icons/AppIcon'
import {
  addDays, addMonths, clampDate, dateKey, daysInMonth, formatDateTimeValue, formatDateValue, formatForDisplay, fromJsDate, fullDateLabel, isSelectable,
  monthGrid, monthName, pad2, parseDateValue, rangeFromValues, sameDate, startOfWeek, timeFromJsDate, usesTwelveHourClock, weekdayName,
  type CalendarDate, type TimeOfDay,
} from './dateValue'
import '../Dropdown/Dropdown.css'
import '../../vyzualz/react/controls/canonicalControls.css'
import './DatePicker.css'

const VIEWPORT_MARGIN = 12
const MENU_GAP = 10
const MENU_WIDTH = 268

export type DatePickerMode = 'date' | 'datetime'
export type DatePickerSize = 'dense' | 'compact' | 'default'

export interface DatePickerProps {
  /** `YYYY-MM-DD` (or `YYYY-MM-DDTHH:mm` in `datetime` mode): the same string a native date input holds. Empty means no date. */
  value: string
  onChange: (value: string) => void
  /** `date` picks a day and closes; `datetime` also sets the time and stays open until it is dismissed. */
  mode?: DatePickerMode
  /** Earliest and latest day that can be picked, as `YYYY-MM-DD`. */
  min?: string
  max?: string
  id?: string
  triggerId?: string
  label?: ReactNode
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  title?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  required?: boolean
  /** Offers Clear when there is a date. On by default; turn it off for a date that must always have a value. */
  clearable?: boolean
  size?: DatePickerSize
  menuAlign?: 'start' | 'end'
  /** 0 is Sunday (the default), 1 is Monday. */
  weekStartsOn?: 0 | 1
  name?: string
  className?: string
  triggerClassName?: string
}

interface MenuPosition { left: number; top: number; maxHeight: number; placement: 'above' | 'below' }

/** A two-digit clock field: type it, or press ↑ and ↓ to step (wrapping round). It commits when it loses focus or on Enter. */
function TimeField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commitDraft = () => {
    if (draft !== null && draft !== '') {
      const parsed = Number(draft)
      if (Number.isFinite(parsed)) onCommit(Math.min(max, Math.max(min, parsed)))
    }
    setDraft(null)
  }
  const step = (delta: number) => { const span = max - min + 1; onCommit(((value - min + delta) % span + span) % span + min); setDraft(null) }
  return (
    <DreamVizTextInput
      className="drm-datepicker__time-field" inputMode="numeric" maxLength={2} autoComplete="off" aria-label={label}
      value={draft ?? pad2(value)}
      onFocus={event => event.currentTarget.select()}
      onChange={event => setDraft(event.target.value.replace(/\D/g, '').slice(0, 2))}
      onBlur={commitDraft}
      onKeyDown={event => {
        if (event.key === 'ArrowUp') { event.preventDefault(); step(1) }
        else if (event.key === 'ArrowDown') { event.preventDefault(); step(-1) }
        else if (event.key === 'Enter') { event.preventDefault(); commitDraft() }
      }}
    />
  )
}

/**
 * The application's date picker. The closed control is the canonical Underline dropdown trigger (same classes, so it looks and behaves like every other
 * dropdown), and the calendar opens in the dropdown's own popover surface: portaled to the body, placed below or above the trigger, closed by an outside
 * click or Escape. It reads and writes the same strings as a native `type="date"` / `type="datetime-local"` input, so it drops in where one was.
 *
 * Keyboard: ←/→ move a day, ↑/↓ a week, Home/End the start and end of the week, PageUp/PageDown a month (with Shift, a year), Enter or Space picks.
 */
export function DatePicker({
  value, onChange, mode = 'date', min, max, id, triggerId: requestedTriggerId, label, ariaLabel, ariaLabelledBy, ariaDescribedBy, title, placeholder,
  disabled = false, invalid = false, required = false, clearable = true, size = 'compact', menuAlign = 'start', weekStartsOn = 0, name, className = '', triggerClassName = '',
}: DatePickerProps) {
  const generatedId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const baseId = id ?? `drm-datepicker-${generatedId}`
  const triggerId = requestedTriggerId ?? `${baseId}-trigger`
  const menuId = `${baseId}-menu`
  const labelId = `${baseId}-label`
  const withTime = mode === 'datetime'
  const parsed = useMemo(() => parseDateValue(value), [value])
  const range = useMemo(() => rangeFromValues(min, max), [min, max])
  const twelveHour = useMemo(() => usesTwelveHourClock(), [])

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  /** Set when the next render should move keyboard focus onto the calendar (on opening, and after a keyboard move). */
  const focusGridRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'days' | 'months'>('days')
  const [cursor, setCursor] = useState({ year: 2000, month: 1 })
  const [focusDate, setFocusDate] = useState<CalendarDate>({ year: 2000, month: 1, day: 1 })
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const isOpen = open && !disabled

  const today = fromJsDate(new Date())
  const closeMenu = useCallback((restoreFocus: boolean) => {
    setOpen(false); setPosition(null)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])
  const openMenu = () => {
    if (disabled) return
    const start = clampDate(parsed?.date ?? fromJsDate(new Date()), range)
    setCursor({ year: start.year, month: start.month }); setFocusDate(start); setView('days')
    focusGridRef.current = true
    setOpen(true)
  }
  useEffect(() => { if (disabled) closeMenu(false) }, [closeMenu, disabled])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current, menu = menuRef.current
    const ownerWindow = trigger?.ownerDocument.defaultView
    if (!trigger || !menu || !ownerWindow) return
    const triggerRect = trigger.getBoundingClientRect()
    const height = menu.getBoundingClientRect().height || 340
    const width = Math.min(MENU_WIDTH, ownerWindow.innerWidth - VIEWPORT_MARGIN * 2)
    const below = Math.max(0, ownerWindow.innerHeight - VIEWPORT_MARGIN - triggerRect.bottom - MENU_GAP)
    const above = Math.max(0, triggerRect.top - MENU_GAP - VIEWPORT_MARGIN)
    const placement = below >= height || below >= above ? 'below' : 'above'
    const maxHeight = Math.max(160, ownerWindow.innerHeight - VIEWPORT_MARGIN * 2)
    const rendered = Math.min(height, maxHeight)
    const preferredLeft = menuAlign === 'end' ? triggerRect.right - width : triggerRect.left
    const left = Math.round(Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, ownerWindow.innerWidth - VIEWPORT_MARGIN - width)))
    const top = placement === 'below'
      ? Math.round(Math.min(triggerRect.bottom + MENU_GAP, ownerWindow.innerHeight - VIEWPORT_MARGIN - rendered))
      : Math.round(Math.max(VIEWPORT_MARGIN, triggerRect.top - MENU_GAP - rendered))
    setPosition(current => (current && current.left === left && current.top === top && current.maxHeight === maxHeight && current.placement === placement ? current : { left, top, maxHeight, placement }))
  }, [menuAlign])

  // Placed from the trigger's own window, so it also works when the page is shown in a window the app opened itself (as the Dropdown does).
  useLayoutEffect(() => {
    if (!isOpen) return
    const ownerWindow = triggerRef.current?.ownerDocument.defaultView
    if (!ownerWindow) return
    updatePosition()
    ownerWindow.addEventListener('resize', updatePosition)
    ownerWindow.addEventListener('scroll', updatePosition, true)
    const observer = typeof ownerWindow.ResizeObserver === 'undefined' ? null : new ownerWindow.ResizeObserver(updatePosition)
    if (triggerRef.current) observer?.observe(triggerRef.current)
    if (menuRef.current) observer?.observe(menuRef.current)
    return () => { ownerWindow.removeEventListener('resize', updatePosition); ownerWindow.removeEventListener('scroll', updatePosition, true); observer?.disconnect() }
  }, [isOpen, updatePosition, view])

  useEffect(() => {
    if (!isOpen) return
    const ownerDocument = triggerRef.current?.ownerDocument ?? document
    const handleOutsidePointer = (event: Event) => {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : null
      const inside = (node: Node | null) => (node ? (path ? path.includes(node) : event.target != null && node.contains(event.target as Node)) : false)
      if (inside(triggerRef.current) || inside(menuRef.current)) return
      closeMenu(false)
    }
    ownerDocument.addEventListener('pointerdown', handleOutsidePointer, true)
    ownerDocument.addEventListener('mousedown', handleOutsidePointer, true)
    return () => { ownerDocument.removeEventListener('pointerdown', handleOutsidePointer, true); ownerDocument.removeEventListener('mousedown', handleOutsidePointer, true) }
  }, [closeMenu, isOpen])

  // Keyboard focus goes onto the calendar once the popover is in place (and again after each keyboard move).
  useEffect(() => {
    if (!isOpen || !position || !focusGridRef.current) return
    focusGridRef.current = false
    const selector = view === 'months' ? `[data-month-pick="${cursor.month}"]` : `[data-date-key="${dateKey(focusDate)}"]`
    menuRef.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
  })

  const commitDate = (date: CalendarDate) => {
    if (!isSelectable(date, range)) return
    setFocusDate(date); setCursor({ year: date.year, month: date.month })
    if (withTime) onChange(formatDateTimeValue(date, parsed?.time ?? timeFromJsDate(new Date())))
    else { onChange(formatDateValue(date)); closeMenu(true) }
  }
  const commitTime = (time: TimeOfDay) => onChange(formatDateTimeValue(parsed?.date ?? clampDate(today, range), time))
  const moveFocus = (next: CalendarDate) => {
    const target = clampDate(next, range)
    setFocusDate(target); setCursor({ year: target.year, month: target.month }); focusGridRef.current = true
  }

  const monthStart = (year: number, month: number): CalendarDate => ({ year, month, day: 1 })
  const monthEnd = (year: number, month: number): CalendarDate => ({ year, month, day: daysInMonth(year, month) })
  const monthSelectable = (year: number, month: number) => (!range.min || dateKey(monthEnd(year, month)) >= dateKey(range.min)) && (!range.max || dateKey(monthStart(year, month)) <= dateKey(range.max))
  const shiftMonth = (delta: number) => { const next = addMonths(monthStart(cursor.year, cursor.month), delta); setCursor({ year: next.year, month: next.month }) }
  const shiftYear = (delta: number) => setCursor(current => ({ ...current, year: current.year + delta }))
  const previousMonth = addMonths(monthStart(cursor.year, cursor.month), -1), nextMonth = addMonths(monthStart(cursor.year, cursor.month), 1)
  const canPrevious = view === 'days' ? monthSelectable(previousMonth.year, previousMonth.month) : !range.min || cursor.year - 1 >= range.min.year
  const canNext = view === 'days' ? monthSelectable(nextMonth.year, nextMonth.month) : !range.max || cursor.year + 1 <= range.max.year

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month, weekStartsOn), [cursor.year, cursor.month, weekStartsOn])
  const inCursorMonth = (date: CalendarDate) => date.year === cursor.year && date.month === cursor.month
  // One day is reachable with Tab (the focused one, else the first pickable day of the month shown); the arrow keys move between the rest.
  const tabbable = inCursorMonth(focusDate) && isSelectable(focusDate, range) ? dateKey(focusDate) : cells.find(cell => inCursorMonth(cell) && isSelectable(cell, range)) ? dateKey(cells.find(cell => inCursorMonth(cell) && isSelectable(cell, range))!) : null

  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const moves: Record<string, CalendarDate | undefined> = {
      ArrowLeft: addDays(focusDate, -1), ArrowRight: addDays(focusDate, 1), ArrowUp: addDays(focusDate, -7), ArrowDown: addDays(focusDate, 7),
      Home: startOfWeek(focusDate, weekStartsOn), End: addDays(startOfWeek(focusDate, weekStartsOn), 6),
      PageUp: addMonths(focusDate, event.shiftKey ? -12 : -1), PageDown: addMonths(focusDate, event.shiftKey ? 12 : 1),
    }
    const next = moves[event.key]
    if (!next) return
    event.preventDefault()
    moveFocus(next)
  }
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(true); return }
    if (event.key !== 'Tab') return
    // The popover sits at the end of the page, so Tab stays inside it until it is dismissed.
    const focusable = [...(menuRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)') ?? [])]
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (!first || !last) return
    const active = menuRef.current?.ownerDocument.activeElement
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus() }
  }

  const selectedLabel = parsed ? formatForDisplay(parsed, withTime) : null
  const wrapperClassName = ['drm-dropdown', 'drm-datepicker', 'dv-underline-dropdown', `drm-dropdown--${size}`, disabled ? 'drm-dropdown--disabled' : '', invalid ? 'drm-dropdown--invalid' : '', isOpen ? 'drm-dropdown--open' : '', className].filter(Boolean).join(' ')
  const portalDocument = triggerRef.current?.ownerDocument ?? (typeof document === 'undefined' ? null : document)
  const themeScope = triggerRef.current?.closest('[data-ui-theme]')
  const weekdays = Array.from({ length: 7 }, (_, index) => (weekStartsOn + index) % 7)
  const nowTime = timeFromJsDate(new Date())
  const time = parsed?.time ?? nowTime
  const isPm = time.hour >= 12
  const hourShown = twelveHour ? (time.hour % 12 === 0 ? 12 : time.hour % 12) : time.hour
  const setHour = (shown: number) => commitTime({ hour: twelveHour ? (shown % 12) + (isPm ? 12 : 0) : shown, minute: time.minute })
  const setMeridiem = (pm: boolean) => commitTime({ hour: (time.hour % 12) + (pm ? 12 : 0), minute: time.minute })
  const menuStyle: CSSProperties = position
    ? { left: position.left, top: position.top, width: MENU_WIDTH, maxHeight: position.maxHeight, visibility: 'visible' }
    : { left: 0, top: 0, width: MENU_WIDTH, visibility: 'hidden' }
  const todayLabel = withTime ? 'Now' : 'Today'
  const title_ = `${monthName(cursor.month, 'long')} ${cursor.year}`

  return (
    <div className={wrapperClassName} data-open={isOpen ? 'true' : 'false'}>
      {label != null && <span id={labelId} className="drm-dropdown__label">{label}{required && <span className="drm-dropdown__required" aria-hidden="true">*</span>}</span>}
      <button
        ref={triggerRef} id={triggerId} type="button" className={`drm-dropdown__trigger${triggerClassName ? ` ${triggerClassName}` : ''}`}
        aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={isOpen ? menuId : undefined}
        aria-label={ariaLabel} aria-labelledby={ariaLabelledBy ?? (!ariaLabel && label != null ? labelId : undefined)} aria-describedby={ariaDescribedBy}
        aria-required={required || undefined} aria-invalid={invalid || undefined} disabled={disabled} title={title}
        onClick={() => { if (isOpen) closeMenu(false); else openMenu() }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && !isOpen) { event.preventDefault(); openMenu() }
          else if (event.key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); closeMenu(true) }
        }}
      >
        <span className={selectedLabel ? 'drm-dropdown__value' : 'drm-dropdown__value drm-dropdown__value--placeholder'}>
          {selectedLabel ?? placeholder ?? (withTime ? 'Select date and time' : 'Select a date')}
        </span>
        <AppIcon kind="calendar" className="drm-dropdown__chevron drm-datepicker__icon" />
      </button>
      {name && <input type="hidden" name={name} value={value} />}

      {isOpen && portalDocument && createPortal((
        <div
          ref={menuRef} id={menuId} role="dialog" aria-label={typeof label === 'string' ? `Choose ${label}` : ariaLabel ?? (withTime ? 'Choose date and time' : 'Choose a date')}
          className={`drm-dropdown__menu drm-dropdown__menu--${size} drm-datepicker__menu`} data-placement={position?.placement ?? 'below'}
          data-ui-theme={themeScope?.getAttribute('data-ui-theme') ?? undefined} data-ui-typography={themeScope?.getAttribute('data-ui-typography') ?? undefined}
          style={menuStyle} onPointerDown={event => event.stopPropagation()} onKeyDown={onMenuKeyDown}
        >
          <div className="drm-datepicker__panel">
            <div className="drm-datepicker__header">
              <button type="button" className="drm-datepicker__nav drm-datepicker__nav--previous" aria-label={view === 'days' ? 'Previous month' : 'Previous year'} disabled={!canPrevious}
                onClick={() => (view === 'days' ? shiftMonth(-1) : shiftYear(-1))}><AppIcon kind="chevronRight" size={14} /></button>
              {view === 'days'
                ? <button type="button" className="drm-datepicker__title" aria-label={`${title_}, choose month and year`} aria-expanded={false} onClick={() => setView('months')}>{title_}</button>
                : <button type="button" className="drm-datepicker__title" aria-label={`${cursor.year}, back to the days`} aria-expanded onClick={() => { setView('days'); focusGridRef.current = true }}>{cursor.year}</button>}
              <button type="button" className="drm-datepicker__nav" aria-label={view === 'days' ? 'Next month' : 'Next year'} disabled={!canNext}
                onClick={() => (view === 'days' ? shiftMonth(1) : shiftYear(1))}><AppIcon kind="chevronRight" size={14} /></button>
            </div>

            {view === 'days' ? (
              <>
                <div className="drm-datepicker__weekdays" aria-hidden="true">
                  {weekdays.map(weekday => <span key={weekday} title={weekdayName(weekday, 'long')}>{weekdayName(weekday, 'narrow')}</span>)}
                </div>
                <div className="drm-datepicker__grid" role="grid" aria-label={title_} onKeyDown={onGridKeyDown}>
                  {Array.from({ length: 6 }, (_, row) => (
                    <div key={row} className="drm-datepicker__row" role="row">
                      {cells.slice(row * 7, row * 7 + 7).map(date => {
                        const key = dateKey(date)
                        const selectable = isSelectable(date, range)
                        const selected = parsed != null && sameDate(parsed.date, date)
                        return (
                          <div key={key} role="gridcell" aria-selected={selected}>
                            <button
                              type="button" className="drm-datepicker__day" data-date-key={key} data-outside={!inCursorMonth(date) || undefined} data-today={sameDate(date, today) || undefined} data-selected={selected || undefined}
                              aria-label={fullDateLabel(date)} aria-current={sameDate(date, today) ? 'date' : undefined} aria-pressed={selected} disabled={!selectable} tabIndex={key === tabbable ? 0 : -1}
                              onFocus={() => setFocusDate(date)} onClick={() => commitDate(date)}
                            >{date.day}</button>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="drm-datepicker__months" role="group" aria-label={`Months of ${cursor.year}`} onKeyDown={event => {
                const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? 3 : event.key === 'ArrowUp' ? -3 : 0
                if (delta === 0) return
                event.preventDefault()
                const next = Math.min(12, Math.max(1, cursor.month + delta))
                if (monthSelectable(cursor.year, next)) { setCursor(current => ({ ...current, month: next })); focusGridRef.current = true }
              }}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map(month => (
                  <button
                    key={month} type="button" className="drm-datepicker__month" data-month-pick={month} data-selected={(parsed != null && parsed.date.year === cursor.year && parsed.date.month === month) || undefined}
                    aria-pressed={parsed != null && parsed.date.year === cursor.year && parsed.date.month === month} disabled={!monthSelectable(cursor.year, month)}
                    onClick={() => { setCursor(current => ({ ...current, month })); setFocusDate(clampDate({ year: cursor.year, month, day: Math.min(focusDate.day, daysInMonth(cursor.year, month)) }, range)); setView('days'); focusGridRef.current = true }}
                  >{monthName(month, 'short')}</button>
                ))}
              </div>
            )}

            {withTime && view === 'days' && (
              <div className="drm-datepicker__time">
                <span className="drm-datepicker__time-label">Time</span>
                <TimeField label="Hour" value={hourShown} min={twelveHour ? 1 : 0} max={twelveHour ? 12 : 23} onCommit={setHour} />
                <span className="drm-datepicker__time-colon" aria-hidden="true">:</span>
                <TimeField label="Minute" value={time.minute} min={0} max={59} onCommit={minute => commitTime({ hour: time.hour, minute })} />
                {twelveHour && (
                  <div className="drm-datepicker__meridiem" role="group" aria-label="AM or PM">
                    <button type="button" aria-pressed={!isPm} onClick={() => setMeridiem(false)}>AM</button>
                    <button type="button" aria-pressed={isPm} onClick={() => setMeridiem(true)}>PM</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="drm-datepicker__footer">
            <button type="button" className="drm-datepicker__action" disabled={!isSelectable(today, range)}
              onClick={() => { if (withTime) { setFocusDate(today); setCursor({ year: today.year, month: today.month }); onChange(formatDateTimeValue(today, nowTime)) } else commitDate(today) }}>{todayLabel}</button>
            <span className="drm-datepicker__footer-spacer" />
            {clearable && value !== '' && <button type="button" className="drm-datepicker__action" onClick={() => { onChange(''); closeMenu(true) }}>Clear</button>}
            {withTime && <button type="button" className="drm-datepicker__action drm-datepicker__action--primary" onClick={() => closeMenu(true)}>Done</button>}
          </div>
        </div>
      ), portalDocument.body)}
    </div>
  )
}
