import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../../shared/icons/AppIcon'
import { Dropdown, type DropdownOption } from '../../../../shared/Dropdown/Dropdown'

/** Ghost tile key: the one icon-button silhouette used by every toolbar in Option F (a rounded square, not a disc). */
export function OfKey({ icon, label, onClick, active, disabled, className = '', size = 17 }: {
  icon: AppIconKind; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; className?: string; size?: number
}) {
  return <button type="button" className={`of-key ${className}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}><AppIcon kind={icon} size={size} /></button>
}

/** Tab strip of ghost tiles: the selected tab is a raised tile with a cyan label. Arrow keys, Home and End move selection. */
export function OfSegmented<T extends string>({ options, value, onChange, label, className = '' }: {
  options: { id: T; label: string; icon?: AppIconKind; disabled?: boolean }[]; value: T; onChange: (next: T) => void; label: string; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  return <div ref={ref} className={`of-seg ${className}`} role="tablist" aria-label={label} style={{ '--of-seg-count': options.length } as CSSProperties} onKeyDown={event => {
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
 * Flat section divided from its neighbours by a hairline. Parents lead with a chevron and carry the window-title role
 * (icon + 12px/700 heading); nested groups are inset with the 11px role and their text starts where the parent's does.
 */
export function OfGroup({ title, icon = 'sliders', nested = false, defaultOpen = true, children, detail }: {
  title: string; icon?: AppIconKind; nested?: boolean; defaultOpen?: boolean; children: ReactNode; detail?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return <section className={`of-group${nested ? ' of-group--nested' : ''}`} data-open={open}>
    <button type="button" className="of-group-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span className="of-group-chevron"><AppIcon kind={open ? 'chevronDown' : 'chevronRight'} size={12} /></span>
      <span className="of-group-icon">{!nested && <AppIcon kind={icon} size={14} />}</span><span className="of-group-title">{title}</span>{detail && <small>{detail}</small>}
    </button><div id={id} className="of-group-body" hidden={!open}>{children}</div>
  </section>
}

/** Label, slim track with a glowing cyan thumb, and a right-aligned value: one row, like a mixer channel. */
export function OfRange({ label, value, onChange, min = 0, max = 1, step = .01, format }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; format?: (value: number) => string
}) {
  const id = useId()
  const ratio = (value - min) / (max - min)
  const text = format ? format(value) : `${Math.round(value * 100)}%`
  return <div className="of-range" style={{ '--of-fill': `${100 * ratio}%` } as CSSProperties}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="range" aria-label={label} aria-valuetext={text} min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
    <output htmlFor={id}>{text}</output>
  </div>
}

export function OfSwitch({ label, value, onChange, description }: { label: string; value: boolean; onChange: (value: boolean) => void; description?: string }) {
  const id = useId()
  return <div className="of-switch-row"><div><span id={id}>{label}</span>{description && <p id={`${id}-help`}>{description}</p>}</div><button type="button" className="of-switch" role="switch" aria-checked={value} aria-labelledby={id} aria-describedby={description ? `${id}-help` : undefined} onClick={() => onChange(!value)}><i /></button></div>
}

export function OfSelect({ label, value, onChange, options, description }: { label: string; value: string; onChange: (value: string) => void; options: readonly DropdownOption[]; description?: string }) {
  return <div className="of-field"><Dropdown label={label} ariaLabel={label} value={value} onChange={onChange} options={options} className="of-select" menuClassName="of-menu" />{description && <p>{description}</p>}</div>
}

export function OfField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number }) {
  const id = useId()
  return <div className="of-field"><label htmlFor={id}>{label}</label><input id={id} value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} spellCheck={false} /></div>
}

/** Panel header: icon, title and a muted subtitle, over a hairline. */
export function OfPanelHead({ icon, title, subtitle }: { icon: AppIconKind; title: string; subtitle?: string }) {
  return <header className="of-panel-head"><AppIcon kind={icon} size={18} /><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</header>
}

/** Identity row: an icon tile with a two-line title, as in a track-details header. */
export function OfIdentity({ icon, title, subtitle, children }: { icon: AppIconKind; title: string; subtitle: string; children?: ReactNode }) {
  return <div className="of-identity"><span className="of-identity-tile"><AppIcon kind={icon} size={22} /></span><div><strong>{title}</strong><small>{subtitle}</small></div>{children}</div>
}
