import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Dropdown, type DropdownOption } from '../../../../shared/Dropdown/Dropdown'

// ── Option A · "Instrument Rack" control library ───────────────────────────────────────────────────────────────
//
// Option A's own presentation components for the Inspector and the dock. They are not production controls with a new
// skin: each one is a different construction (a rack group with an LED and a bracket rule, a rotary knob drawn as an
// SVG ring, a fader with a hardware cap, a square LED switch, a bank-button tab row). They take the same kind of value
// and callback the production rows do, so wiring one to real state is a one-line change; in Layout Lab they run on
// local state. Everything is namespaced `oa-` and only styled by optionA.css, so nothing here can reach another option.

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Splits a trailing unit (%, dB) off a readout so the unit can be set in the body face beside the numerals. */
const splitUnit = (text: string) => {
  const match = text.match(/^(.*?)\s*(%|dB)$/)
  return match ? [match[1]!, match[2]!] : [text]
}

/** A square LED, the system's one status mark: lit ember, lit ice, red for live, or dark. */
export function OaLed({ on = false, tone = 'ember', className = '' }: { on?: boolean; tone?: 'ember' | 'ice' | 'red'; className?: string }) {
  return <i className={`oa-led${className ? ` ${className}` : ''}`} data-on={on ? 'true' : 'false'} data-tone={tone} aria-hidden="true" />
}

// ── Group ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** A rack group: LED, a light title, a bracket rule that runs to the open/close mark. `nested` drops to the small caps label. */
export function OaGroup({ label, defaultOpen = true, nested = false, count, children }: {
  label: string
  defaultOpen?: boolean
  nested?: boolean
  count?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  return (
    <section className="oa-group" data-open={open ? 'true' : 'false'} data-nested={nested ? 'true' : 'false'}>
      <button type="button" className="oa-group__head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(value => !value)}>
        <OaLed on={open} />
        <span className="oa-group__title">{label}</span>
        {count !== undefined && <span className="oa-group__count">{count}</span>}
        <span className="oa-group__rule" aria-hidden="true" />
        <span className="oa-group__mark" aria-hidden="true" />
      </button>
      {open && <div className="oa-group__body" id={bodyId}>{children}</div>}
    </section>
  )
}

// ── Knob ───────────────────────────────────────────────────────────────────────────────────────────────────────
const KNOB_SWEEP = 270
const KNOB_START = 135

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const
}
function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const [x1, y1] = polar(cx, cy, r, from)
  const [x2, y2] = polar(cx, cy, r, to)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/**
 * A rotary knob: a 270° ring that fills with a lit gradient, a hardware cap and a pointer dot. Drag up/down (or use the
 * arrow keys, Home/End, or the wheel) to change it; double-click returns it to `defaultValue`.
 */
export function OaKnob({ label, value, onChange, min = 0, max = 1, step = 0.01, defaultValue, format, size = 'md', tone = 'ember' }: {
  label: string
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  format?: (value: number) => string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'ember' | 'ice'
}) {
  const gradientId = useId()
  const drag = useRef<{ y: number; value: number } | null>(null)
  const range = max - min
  const ratio = clamp((value - min) / range, 0, 1)
  const snap = (next: number) => clamp(Math.round(next / step) * step, min, max)
  const set = (next: number) => onChange(Number(snap(next).toFixed(6)))
  const sweepEnd = KNOB_START + KNOB_SWEEP * ratio
  const [dx, dy] = polar(50, 50, 27, sweepEnd)

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = { y: event.clientY, value }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    set(drag.current.value + ((drag.current.y - event.clientY) / 160) * range)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const fine = event.shiftKey ? 0.2 : 1
    const moves: Record<string, number> = { ArrowUp: step * fine * 5, ArrowRight: step * fine * 5, ArrowDown: -step * fine * 5, ArrowLeft: -step * fine * 5 }
    if (event.key in moves) { event.preventDefault(); set(value + moves[event.key]!) }
    else if (event.key === 'Home') { event.preventDefault(); set(min) }
    else if (event.key === 'End') { event.preventDefault(); set(max) }
  }

  return (
    <div className="oa-knob" data-size={size} data-tone={tone}>
      <div
        className="oa-knob__dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format ? format(value) : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
        onKeyDown={onKeyDown}
        onWheel={event => { set(value - Math.sign(event.deltaY) * step * 3) }}
        onDoubleClick={() => { if (defaultValue !== undefined) set(defaultValue) }}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={tone === 'ember' ? 'var(--oa-ember-deep)' : 'var(--oa-ice-deep)'} />
              <stop offset="100%" stopColor={tone === 'ember' ? 'var(--oa-ember)' : 'var(--oa-ice)'} />
            </linearGradient>
          </defs>
          <path className="oa-knob__track" d={arc(50, 50, 38, KNOB_START, KNOB_START + KNOB_SWEEP)} />
          {ratio > 0.002 && <path className="oa-knob__fill" d={arc(50, 50, 38, KNOB_START, sweepEnd)} stroke={`url(#${gradientId})`} />}
          <circle className="oa-knob__cap" cx="50" cy="50" r="28" />
          <circle className="oa-knob__dot" cx={dx} cy={dy} r="3" />
        </svg>
      </div>
      <span className="oa-knob__label">{label}</span>
      <span className="oa-knob__value">{splitUnit(format ? format(value) : `${Math.round(ratio * 100)}%`).map((part, index) => index === 0 ? part : <small key="unit">{part}</small>)}</span>
    </div>
  )
}

// ── Fader ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** A horizontal fader: light label, numeral readout, a ticked strip and a hardware cap. It is a real range input underneath. */
export function OaFader({ label, value, onChange, min = 0, max = 1, step = 0.01, format }: {
  label: string
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  format?: (value: number) => string
}) {
  const id = useId()
  const pct = clamp(((value - min) / (max - min)) * 100, 0, 100)
  return (
    <div className="oa-fader">
      <label className="oa-fader__label" htmlFor={id}>{label}</label>
      <span className="oa-fader__value">{format ? format(value) : `${Math.round(pct)}`}<small>{format ? '' : '%'}</small></span>
      <input
        id={id}
        className="oa-fader__input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--oa-pct': `${pct}%` } as CSSProperties}
        onChange={event => onChange(parseFloat(event.target.value))}
      />
    </div>
  )
}

// ── Switch ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** A square LED switch with its label and an optional description. */
export function OaSwitch({ label, value, onChange, description, tone = 'ember' }: {
  label: string
  value: boolean
  onChange: (next: boolean) => void
  description?: string
  tone?: 'ember' | 'ice'
}) {
  return (
    <button type="button" className="oa-switch" role="switch" aria-checked={value} onClick={() => onChange(!value)}>
      <span className="oa-switch__label">{label}</span>
      <OaLed on={value} tone={tone} className="oa-switch__led" />
      {description && <span className="oa-switch__description">{description}</span>}
    </button>
  )
}

// ── Select ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** A labelled selector in an inset display. The menu is the shared dropdown, themed through `oa-menu` (it renders in a portal). */
export function OaSelect({ label, value, options, onChange, description, placeholder, title }: {
  label: string
  value: string
  options: readonly DropdownOption[]
  onChange: (next: string) => void
  description?: string
  placeholder?: string
  title?: string
}) {
  const id = useId()
  return (
    <div className="oa-select">
      <label className="oa-select__label" htmlFor={id}>{label}</label>
      <Dropdown
        triggerId={id}
        value={value}
        options={options}
        onChange={next => onChange(next)}
        ariaLabel={label}
        menuLabel={label}
        placeholder={placeholder}
        title={title}
        className="oa-select__control"
        menuClassName="oa-menu"
        size="compact"
        showDescriptions={false}
      />
      {description && <span className="oa-select__description">{description}</span>}
    </div>
  )
}

// ── Text field ─────────────────────────────────────────────────────────────────────────────────────────────────
export function OaField({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (next: string) => void; maxLength?: number }) {
  const id = useId()
  return (
    <div className="oa-field">
      <label className="oa-field__label" htmlFor={id}>{label}</label>
      <input id={id} className="oa-field__input" type="text" value={value} maxLength={maxLength} onChange={event => onChange(event.target.value)} />
    </div>
  )
}

// ── Swatch ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** A colour row: a square swatch that opens the colour picker, the name and the hex value. */
export function OaSwatch({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  const id = useId()
  return (
    <div className="oa-swatch">
      <label className="oa-swatch__chip" htmlFor={id} style={{ '--oa-swatch': value } as CSSProperties}>
        <input id={id} type="color" value={value} onChange={event => onChange(event.target.value)} aria-label={`${label} colour`} />
      </label>
      <span className="oa-swatch__label">{label}</span>
      <span className="oa-swatch__hex">{value.toUpperCase()}</span>
    </div>
  )
}

// ── Bank (tabs) ────────────────────────────────────────────────────────────────────────────────────────────────
export interface OaBankItem<T extends string> { id: T; label: string; disabled?: boolean }

/** Bank buttons: a numbered key with its label and an LED under the selected one (the reference's band buttons). */
export function OaBank<T extends string>({ items, value, onChange, ariaLabel, variant = 'primary' }: {
  items: readonly OaBankItem<T>[]
  value: T
  onChange: (next: T) => void
  ariaLabel: string
  variant?: 'primary' | 'compact'
}) {
  return (
    <div className="oa-bank" role="tablist" aria-label={ariaLabel} data-variant={variant} style={{ '--oa-bank-count': items.length } as CSSProperties}>
      {items.map((item, index) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={item.disabled}
            className="oa-bank__key"
            data-selected={selected ? 'true' : 'false'}
            onClick={() => onChange(item.id)}
          >
            <span className="oa-bank__index">{String(index + 1).padStart(2, '0')}</span>
            <span className="oa-bank__label">{item.label}</span>
            <OaLed on={selected} />
          </button>
        )
      })}
    </div>
  )
}

/** A segmented row of small keys, for filters inside a group. */
export function OaSegments<T extends string>({ items, value, onChange, ariaLabel }: {
  items: readonly { id: T; label: string }[]
  value: T
  onChange: (next: T) => void
  ariaLabel: string
}) {
  return (
    <div className="oa-segments" role="tablist" aria-label={ariaLabel}>
      {items.map(item => (
        <button key={item.id} type="button" role="tab" aria-selected={item.id === value} className="oa-segments__key" data-selected={item.id === value ? 'true' : 'false'} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  )
}
