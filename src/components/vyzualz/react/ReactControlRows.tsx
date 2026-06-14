import { useState } from 'react'

// ── Slider row ────────────────────────────────────────────────────────────────

export interface SliderRowProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  color?: string
}

export function SliderRow({
  label, value, onChange,
  min = 0, max = 1, step = 0.01,
  color = '#4ac7db',
}: SliderRowProps) {
  const pct = `${Math.round(((value - min) / (max - min)) * 100)}%`
  const display =
    (min === 0 && max === 1) ? `${Math.round(value * 100)}%`
    : step >= 1               ? `${Math.round(value)}`
    :                           value.toFixed(2)
  return (
    <div className="rv-ctrl-row">
      <div className="rv-ctrl-slider-hdr">
        <span className="rv-ctrl-label">{label}</span>
        <span className="rv-ctrl-val">{display}</span>
      </div>
      <input
        type="range"
        className="rv-ctrl-slider"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ '--accent': color, '--pct': pct } as React.CSSProperties}
      />
    </div>
  )
}

// ── Select row ────────────────────────────────────────────────────────────────

export interface SelectOption { value: string; label: string }

export interface SelectRowProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
}

export function SelectRow({ label, value, onChange, options }: SelectRowProps) {
  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label">{label}</span>
      <select
        className="rv-ctrl-select"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────

export interface ToggleRowProps {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}

export function ToggleRow({ label, value, onChange }: ToggleRowProps) {
  return (
    <div className="rv-ctrl-toggle-row">
      <span className="rv-ctrl-label">{label}</span>
      <button
        type="button"
        className={`rv-ctrl-toggle${value ? ' rv-ctrl-toggle--on' : ''}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        {value ? 'On' : 'Off'}
      </button>
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
}

export function TextInputRow({
  label, value, onChange, maxLength = 32, placeholder = '',
}: TextInputRowProps) {
  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label">{label}</span>
      <input
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
  return (
    <div className="rv-ctrl-collapsible">
      <button
        type="button"
        className="rv-ctrl-collapsible-hdr"
        onClick={() => setOpen(o => !o)}
      >
        <span className="rv-ctrl-collapsible-arrow">{open ? '▾' : '▸'}</span>
        {label}
      </button>
      {open && <div className="rv-ctrl-collapsible-body">{children}</div>}
    </div>
  )
}
