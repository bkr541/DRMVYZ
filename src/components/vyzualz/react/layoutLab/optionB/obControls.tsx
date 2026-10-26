import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../../shared/icons/AppIcon'
import { Dropdown, type DropdownOption } from '../../../../shared/Dropdown/Dropdown'

/** Option B's presentation primitives. Values and callbacks stay with the caller. */
export function ObKey({ icon, label, onClick, active, disabled, children, className = '' }: {
  icon: AppIconKind; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; children?: ReactNode; className?: string
}) {
  return <button type="button" className={`ob-key ${className}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}><AppIcon kind={icon} size={17} />{children}</button>
}

/** Arrow keys move focus and activate tabs; every panel remains reachable without a pointer. */
export function ObTabs<T extends string>({ options, value, onChange, label, compact = false }: {
  options: { id: T; label: string; disabled?: boolean }[]; value: T; onChange: (next: T) => void; label: string; compact?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  return <div ref={ref} className={`ob-tabs${compact ? ' ob-tabs--compact' : ''}`} role="tablist" aria-label={label} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const enabled = options.filter(option => !option.disabled)
    const index = enabled.findIndex(option => option.id === value)
    const next = enabled[event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]!
    onChange(next.id)
    ref.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus()
  }}>{options.map(option => <button key={option.id} type="button" role="tab" data-tab={option.id} aria-selected={value === option.id} tabIndex={value === option.id ? 0 : -1} disabled={option.disabled} onClick={() => onChange(option.id)}>{option.label}</button>)}</div>
}

export function ObGroup({ title, icon = 'sliders', index, nested = false, defaultOpen = true, children }: {
  title: string; icon?: AppIconKind; index?: string; nested?: boolean; defaultOpen?: boolean; children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return <section className={`ob-group${nested ? ' ob-group--nested' : ''}`} data-open={open}>
    <button type="button" className="ob-group-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {!nested && <AppIcon kind={icon} size={14} />}<span>{title}</span>{index && <small aria-hidden="true">{index}</small>}<AppIcon kind={open ? 'chevronUp' : 'chevronDown'} size={12} />
    </button>
    <div id={id} className="ob-group-body" hidden={!open}>{children}</div>
  </section>
}

export function ObRange({ label, value, onChange, min = 0, max = 1, step = .01, format, description }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; format?: (value: number) => string; description?: string
}) {
  const id = useId()
  return <div className="ob-range" style={{ '--ob-fill': `${100 * (value - min) / (max - min)}%` } as CSSProperties}>
    <div className="ob-range-heading"><label htmlFor={id}>{label}</label><output htmlFor={id}>{format ? format(value) : `${Math.round(value * 100)}%`}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} aria-describedby={description ? `${id}-help` : undefined} />
    {description && <p id={`${id}-help`}>{description}</p>}
  </div>
}

export function ObSwitch({ label, value, onChange, description }: { label: string; value: boolean; onChange: (value: boolean) => void; description?: string }) {
  const id = useId()
  return <div className="ob-switch-row"><div><span id={id}>{label}</span>{description && <p id={`${id}-help`}>{description}</p>}</div><button type="button" className="ob-switch" role="switch" aria-checked={value} aria-labelledby={id} aria-describedby={description ? `${id}-help` : undefined} onClick={() => onChange(!value)}><i /></button></div>
}

export function ObSelect({ label, value, onChange, options, description }: { label: string; value: string; onChange: (value: string) => void; options: readonly DropdownOption[]; description?: string }) {
  return <div className="ob-field"><Dropdown label={label} ariaLabel={label} value={value} onChange={onChange} options={options} className="ob-select" menuClassName="ob-menu" />{description && <p>{description}</p>}</div>
}

export function ObField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number }) {
  const id = useId()
  return <div className="ob-field"><label htmlFor={id}>{label}</label><input id={id} value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} spellCheck={false} /></div>
}
