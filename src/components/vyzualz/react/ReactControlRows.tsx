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

// ── Numeric input row ─────────────────────────────────────────────────────────

export interface NumberInputRowProps {
  label: string
  value: number | ''
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  id?: string
  placeholder?: string
  onEmpty?: () => void
}

export function NumberInputRow({
  label, value, onChange, min, max, step = 0.1, unit, disabled = false, id, placeholder, onEmpty,
}: NumberInputRowProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className="rv-ctrl-row">
      <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
      <div className={`rv-ctrl-number-field${unit ? ' rv-ctrl-number-field--with-unit' : ''}`}>
        <input
          id={inputId}
          type="number"
          className="rv-ctrl-text-input"
          value={value === '' ? '' : Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          placeholder={placeholder}
          onChange={event => {
            if (event.target.value === '') {
              onEmpty?.()
              return
            }
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(next)
          }}
        />
        {unit && <span className="rv-ctrl-number-unit" aria-hidden="true">{unit}</span>}
      </div>
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
      <div className="rv-ctrl-toggle-line">
        <span className="rv-ctrl-label" id={labelId}>{label}</span>
        <button
          id={buttonId}
          type="button"
          className={`rv-ctrl-toggle${value ? ' rv-ctrl-toggle--on' : ''}`}
          data-state={value ? 'on' : 'off'}
          onClick={() => onChange(!value)}
          aria-pressed={value}
          aria-labelledby={labelId}
          disabled={disabled}
          title={title}
          aria-describedby={description ? `${buttonId}-description` : undefined}
        >
          {value ? 'On' : 'Off'}
        </button>
      </div>
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
  onBlur?: (value: string) => void
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
}

export function TextInputRow({
  label, value, onChange, maxLength = 32, placeholder = '', id, onBlur, inputMode, autoComplete = 'off',
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
        onBlur={() => onBlur?.(value)}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  )
}

// ── Color row ─────────────────────────────────────────────────────────────────

export interface ColorRowProps {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  description?: string
}

export function ColorRow({ label, value, onChange, disabled = false, id, description }: ColorRowProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className="rv-ctrl-row">
      <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
      <div className="rv-ctrl-color-field">
        <input
          id={inputId}
          type="color"
          className="rv-ctrl-color-input"
          value={value}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
          aria-describedby={description ? `${inputId}-description` : undefined}
        />
        <output className="rv-ctrl-color-value" htmlFor={inputId}>{value.toUpperCase()}</output>
      </div>
      {description && <span id={`${inputId}-description`} className="rv-ctrl-description">{description}</span>}
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
    <div className={`rv-ctrl-collapsible${open ? ' rv-ctrl-collapsible--open' : ' rv-ctrl-collapsible--closed'}`}>
      <button
        type="button"
        className="rv-ctrl-collapsible-hdr"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="rv-ctrl-collapsible-label">{label}</span>
        <span className="rv-ctrl-collapsible-arrow" aria-hidden="true">▾</span>
      </button>
      {open && <div id={contentId} className="rv-ctrl-collapsible-body">{children}</div>}
    </div>
  )
}
