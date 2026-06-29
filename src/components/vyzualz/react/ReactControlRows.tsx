import { useId, useState } from 'react'

// ── Slider row ────────────────────────────────────────────────────────────────

export interface SliderRowProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  color?: string
  id?: string
  disabled?: boolean
  description?: string
}

export function SliderRow({
  label, value, onChange,
  min = 0, max = 1, step = 0.01,
  color = '#4ac7db', id, disabled = false, description,
}: SliderRowProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const pct = `${Math.round(((value - min) / (max - min)) * 100)}%`
  const display =
    (min === 0 && max === 1) ? `${Math.round(value * 100)}%`
    : step >= 1               ? `${Math.round(value)}`
    :                           value.toFixed(2)
  return (
    <div className="rv-ctrl-row">
      <div className="rv-ctrl-slider-hdr">
        <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
        <span className="rv-ctrl-val">{display}</span>
      </div>
      <input
        id={inputId}
        type="range"
        className="rv-ctrl-slider"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ '--accent': color, '--pct': pct } as React.CSSProperties}
        disabled={disabled}
        aria-describedby={description ? `${inputId}-description` : undefined}
      />
      {description && <span id={`${inputId}-description`} className="rv-ctrl-description">{description}</span>}
    </div>
  )
}

// ── Select row ────────────────────────────────────────────────────────────────

export interface SelectOption { value: string; label: string; disabled?: boolean }

export interface SelectRowProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  disabled?: boolean
  id?: string
  description?: string
}

export function SelectRow({ label, value, onChange, options, disabled, id, description }: SelectRowProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className="rv-ctrl-row">
      <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
      <select
        id={inputId}
        className="rv-ctrl-select"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        aria-describedby={description ? `${inputId}-description` : undefined}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      {description && <span id={`${inputId}-description`} className="rv-ctrl-description">{description}</span>}
    </div>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────

export interface ToggleRowProps {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  title?: string
  id?: string
  description?: string
}

export function ToggleRow({ label, value, onChange, disabled, title, id, description }: ToggleRowProps) {
  const generatedId = useId()
  const labelId = `${id ?? generatedId}-label`
  const buttonId = id ?? generatedId
  return (
    <div className={`rv-ctrl-toggle-row${disabled ? ' rv-ctrl-toggle-row--disabled' : ''}`}>
      <span className="rv-ctrl-label" id={labelId}>{label}</span>
      <button
        id={buttonId}
        type="button"
        className={`rv-ctrl-toggle${value && !disabled ? ' rv-ctrl-toggle--on' : ''}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
        aria-labelledby={labelId}
        disabled={disabled}
        title={title}
        aria-describedby={description ? `${buttonId}-description` : undefined}
      >
        {value ? 'On' : 'Off'}
      </button>
      {description && <span id={`${buttonId}-description`} className="rv-ctrl-description">{description}</span>}
    </div>
  )
}

// ── Text input row ────────────────────────────────────────────────────────────

export interface TextInputRowProps {
  label: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
  placeholder?: string
  id?: string
}

export function TextInputRow({
  label, value, onChange, maxLength = 32, placeholder = '', id,
}: TextInputRowProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className="rv-ctrl-row">
      <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        className="rv-ctrl-text-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────

export function CtrlSection({ label }: { label: string }) {
  return <div className="rv-ctrl-section-label">{label}</div>
}

// ── Collapsible sub-section ───────────────────────────────────────────────────

export interface CollapsibleProps {
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function Collapsible({ label, defaultOpen = true, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()
  return (
    <div className="rv-ctrl-collapsible">
      <button
        type="button"
        className="rv-ctrl-collapsible-hdr"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="rv-ctrl-collapsible-arrow">{open ? '▾' : '▸'}</span>
        {label}
      </button>
      {open && <div id={contentId} className="rv-ctrl-collapsible-body">{children}</div>}
    </div>
  )
}
