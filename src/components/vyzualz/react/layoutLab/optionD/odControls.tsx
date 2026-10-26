import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../../shared/icons/AppIcon'
import { Dropdown, type DropdownOption } from '../../../../shared/Dropdown/Dropdown'

/** Round disc key: the one icon-button silhouette used by every toolbar in Option D. */
export function OdKey({ icon, label, onClick, active, disabled, className = '', size = 17 }: {
  icon: AppIconKind; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; className?: string; size?: number
}) {
  return <button type="button" className={`od-key ${className}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}><AppIcon kind={icon} size={size} /></button>
}

/** Segmented control: a recessed track whose selected segment is lime-tinted. Arrow keys, Home and End move selection. */
export function OdSegmented<T extends string>({ options, value, onChange, label, className = '' }: {
  options: { id: T; label: string; icon?: AppIconKind; disabled?: boolean }[]; value: T; onChange: (next: T) => void; label: string; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  return <div ref={ref} className={`od-seg ${className}`} role="tablist" aria-label={label} style={{ '--od-seg-count': options.length } as CSSProperties} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const enabled = options.filter(option => !option.disabled)
    const index = enabled.findIndex(option => option.id === value)
    const next = enabled[event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]!
    onChange(next.id)
    ref.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus()
  }}>{options.map(option => <button type="button" key={option.id} role="tab" data-tab={option.id} aria-selected={value === option.id} tabIndex={value === option.id ? 0 : -1} disabled={option.disabled} onClick={() => onChange(option.id)}>{option.icon && <AppIcon kind={option.icon} size={15} />}<span>{option.label}</span></button>)}</div>
}

/**
 * Tile group. Parents carry the window-title role (icon + 12px/700 heading); nested groups are recessed wells with the
 * 11px role whose text starts where the parent's heading text starts.
 */
export function OdGroup({ title, icon = 'sliders', nested = false, defaultOpen = true, children, detail }: {
  title: string; icon?: AppIconKind; nested?: boolean; defaultOpen?: boolean; children: ReactNode; detail?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return <section className={`od-group${nested ? ' od-group--nested' : ''}`} data-open={open}>
    <button type="button" className="od-group-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span className="od-group-icon">{!nested && <AppIcon kind={icon} size={14} />}</span><span className="od-group-title">{title}</span>{detail && <small>{detail}</small>}<span className="od-group-disc"><AppIcon kind={open ? 'chevronUp' : 'chevronDown'} size={12} /></span>
    </button><div id={id} className="od-group-body" hidden={!open}>{children}</div>
  </section>
}

/**
 * Native range inside a tile. `readout` renders the value as a large light numeral with its unit and caption beneath,
 * with the slider docked at the foot of the tile; otherwise the label and a value chip sit above a full-width track.
 */
export function OdRange({ label, value, onChange, min = 0, max = 1, step = .01, format, readout = false }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; format?: (value: number) => string; readout?: boolean
}) {
  const id = useId()
  const ratio = (value - min) / (max - min)
  const text = format ? format(value) : `${Math.round(value * 100)}%`
  const unit = /[^\d.\-−]+$/.exec(text)?.[0] ?? ''
  const figure = unit ? text.slice(0, text.length - unit.length) : text
  return <div className={`od-range${readout ? ' od-range--readout' : ''}`} style={{ '--od-fill': `${100 * ratio}%` } as CSSProperties}>
    {readout
      ? <div className="od-readout" aria-hidden="true"><b>{figure}</b>{unit && <sup>{unit.trim()}</sup>}</div>
      : null}
    <div className="od-range-label"><label htmlFor={id}>{label}</label>{!readout && <output htmlFor={id}>{text}</output>}</div>
    <input id={id} type="range" aria-label={label} aria-valuetext={text} min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
  </div>
}

/** A switch row; `tile` makes the whole face the control and tints it when on. */
export function OdSwitch({ label, value, onChange, description, icon, tile = false }: {
  label: string; value: boolean; onChange: (value: boolean) => void; description?: string; icon?: AppIconKind; tile?: boolean
}) {
  const id = useId()
  if (tile) return <button type="button" className="od-switch-tile" role="switch" aria-checked={value} aria-labelledby={id} aria-describedby={description ? `${id}-help` : undefined} onClick={() => onChange(!value)}>
    <span className="od-switch-tile-top">{icon && <span className="od-disc"><AppIcon kind={icon} size={15} /></span>}<i className="od-switch-knob" aria-hidden="true" /></span>
    <span id={id}>{label}</span><small>{value ? 'On' : 'Off'}</small>{description && <em id={`${id}-help`}>{description}</em>}
  </button>
  return <div className="od-switch-row"><div><span id={id}>{label}</span>{description && <p id={`${id}-help`}>{description}</p>}</div><button type="button" className="od-switch" role="switch" aria-checked={value} aria-labelledby={id} aria-describedby={description ? `${id}-help` : undefined} onClick={() => onChange(!value)}><i /></button></div>
}

export function OdSelect({ label, value, onChange, options, description }: { label: string; value: string; onChange: (value: string) => void; options: readonly DropdownOption[]; description?: string }) {
  return <div className="od-field"><Dropdown label={label} ariaLabel={label} value={value} onChange={onChange} options={options} className="od-select" menuClassName="od-menu" />{description && <p>{description}</p>}</div>
}

export function OdField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number }) {
  const id = useId()
  return <div className="od-field"><label htmlFor={id}>{label}</label><input id={id} value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} spellCheck={false} /></div>
}

/** Bare label that sits on the canvas above a column of tiles. */
export function OdLabel({ children }: { children: ReactNode }) {
  return <span className="od-label">{children}</span>
}
