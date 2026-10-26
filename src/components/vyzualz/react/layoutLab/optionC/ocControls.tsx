import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../../shared/icons/AppIcon'
import { Dropdown, type DropdownOption } from '../../../../shared/Dropdown/Dropdown'

export function OcKey({ icon, label, onClick, active, disabled, children, className = '' }: {
  icon: AppIconKind; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; children?: ReactNode; className?: string
}) {
  return <button type="button" className={`oc-key ${className}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}><AppIcon kind={icon} size={17} />{children}</button>
}

export function OcTabs<T extends string>({ options, value, onChange, label }: {
  options: { id: T; label: string; icon?: AppIconKind; disabled?: boolean }[]; value: T; onChange: (next: T) => void; label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  return <div ref={ref} className="oc-tabs" role="tablist" aria-label={label} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const enabled = options.filter(option => !option.disabled)
    const index = enabled.findIndex(option => option.id === value)
    const next = enabled[event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]!
    onChange(next.id)
    ref.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus()
  }}>{options.map(option => <button type="button" key={option.id} role="tab" data-tab={option.id} aria-selected={value === option.id} tabIndex={value === option.id ? 0 : -1} disabled={option.disabled} onClick={() => onChange(option.id)}>{option.icon && <AppIcon kind={option.icon} size={16} />}<span>{option.label}</span></button>)}</div>
}

export function OcGroup({ title, icon = 'sliders', nested = false, defaultOpen = true, children, detail }: {
  title: string; icon?: AppIconKind; nested?: boolean; defaultOpen?: boolean; children: ReactNode; detail?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return <section className={`oc-group${nested ? ' oc-group--nested' : ''}`} data-open={open}>
    <button type="button" className="oc-group-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {!nested && <AppIcon kind={icon} size={15} />}<span>{title}</span>{detail && <small>{detail}</small>}<AppIcon kind={open ? 'minus' : 'plus'} size={13} />
    </button><div id={id} className="oc-group-body" hidden={!open}>{children}</div>
  </section>
}

/** Native ranges retain keyboard, touch and assistive-technology behavior inside a new instrument face. */
export function OcRange({ label, value, onChange, min = 0, max = 1, step = .01, format, dial = false }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; format?: (value: number) => string; dial?: boolean
}) {
  const id = useId()
  const ratio = (value - min) / (max - min)
  const readout = format ? format(value) : `${Math.round(value * 100)}%`
  return <div className={`oc-range${dial ? ' oc-range--dial' : ''}`} style={{ '--oc-fill': `${100 * ratio}%`, '--oc-angle': `${-130 + 260 * ratio}deg` } as CSSProperties}>
    {dial && <div className="oc-dial-face" aria-hidden="true"><span /><b>{readout}</b></div>}
    <div className="oc-range-label"><label htmlFor={id}>{label}</label>{!dial && <output htmlFor={id}>{readout}</output>}</div>
    <input id={id} type="range" aria-label={label} aria-valuetext={readout} min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
  </div>
}

export function OcSwitch({ label, value, onChange, description }: { label: string; value: boolean; onChange: (value: boolean) => void; description?: string }) {
  const id = useId()
  return <div className="oc-switch-row"><div><span id={id}>{label}</span>{description && <p id={`${id}-help`}>{description}</p>}</div><button type="button" className="oc-switch" role="switch" aria-checked={value} aria-labelledby={id} aria-describedby={description ? `${id}-help` : undefined} onClick={() => onChange(!value)}><i /></button></div>
}

export function OcSelect({ label, value, onChange, options, description }: { label: string; value: string; onChange: (value: string) => void; options: readonly DropdownOption[]; description?: string }) {
  return <div className="oc-field"><Dropdown label={label} ariaLabel={label} value={value} onChange={onChange} options={options} className="oc-select" menuClassName="oc-menu" />{description && <p>{description}</p>}</div>
}
export function OcField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number }) {
  const id = useId()
  return <div className="oc-field"><label htmlFor={id}>{label}</label><input id={id} value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} spellCheck={false} /></div>
}
