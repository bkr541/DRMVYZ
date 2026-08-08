import { useId, type ReactNode } from 'react'
import { BubbleRevealSlider } from './controls/BubbleRevealSlider'
import { DreamVizTextInput } from './controls/DreamVizTextInput'
import { IconMorphToggle } from './controls/IconMorphToggle'
import { UnderlineDropdown } from './controls/UnderlineDropdown'
import { DualRailCollapsible } from './DualRailCollapsible'

// ── Slider row ────────────────────────────────────────────────────────────────

export interface SliderRowProps {
  label: ReactNode
  labelAccessory?: ReactNode
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  color?: string
  id?: string
  disabled?: boolean
  description?: string
  onInteractionStart?: () => void
  onInteractionEnd?: () => void
}

export function SliderRow({
  label, labelAccessory, value, onChange,
  min = 0, max = 1, step = 0.01,
  color = '#4ac7db', id, disabled = false, description, onInteractionStart, onInteractionEnd,
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
        <span className="rv-ctrl-label-cluster">
          <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
          {labelAccessory}
        </span>
        <span className="rv-ctrl-val">{display}</span>
      </div>
      <BubbleRevealSlider
        id={inputId}
        className="rv-ctrl-slider"
        bubbleLabel={display}
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onPointerDown={onInteractionStart}
        onPointerUp={onInteractionEnd}
        onPointerCancel={onInteractionEnd}
        onKeyDown={event => { if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') onInteractionStart?.() }}
        onKeyUp={event => { if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') onInteractionEnd?.() }}
        onBlur={onInteractionEnd}
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
      <span className="rv-ctrl-label-cluster">
        <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
      </span>
      <div className={`rv-ctrl-number-field${unit ? ' rv-ctrl-number-field--with-unit' : ''}`}>
        <DreamVizTextInput
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
      <span className="rv-ctrl-label-cluster">
        <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
      </span>
      <UnderlineDropdown
        id={`${inputId}-dropdown`}
        triggerId={inputId}
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        ariaLabel={label}
        ariaDescribedBy={description ? `${inputId}-description` : undefined}
        menuLabel={label}
        size="compact"
        showDescriptions={false}
        className="rv-ctrl-dropdown"
      />
      {description && <span id={`${inputId}-description`} className="rv-ctrl-description">{description}</span>}
    </div>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────

export interface ToggleRowProps {
  label: ReactNode
  labelAccessory?: ReactNode
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  title?: string
  id?: string
  description?: string
}

export function ToggleRow({
  label,
  labelAccessory,
  value,
  onChange,
  disabled,
  title,
  id,
  description,
}: ToggleRowProps) {
  const generatedId = useId()
  const labelId = `${id ?? generatedId}-label`
  const buttonId = id ?? generatedId
  return (
    <div className={`rv-ctrl-toggle-row${disabled ? ' rv-ctrl-toggle-row--disabled' : ''}`}>
      <div className="rv-ctrl-toggle-line">
        <span className="rv-ctrl-label-cluster">
          <span className="rv-ctrl-label" id={labelId}>{label}</span>
          {labelAccessory}
        </span>
        <IconMorphToggle
          id={buttonId}
          checked={value}
          onCheckedChange={onChange}
          className={`rv-ctrl-toggle${value ? ' rv-ctrl-toggle--on' : ''}`}
          data-state={value ? 'on' : 'off'}
          aria-labelledby={labelId}
          disabled={disabled}
          title={title}
          aria-describedby={description ? `${buttonId}-description` : undefined}
        />
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
  disabled?: boolean
  description?: string
}

export function TextInputRow({
  label, value, onChange, maxLength = 32, placeholder = '', id, onBlur, inputMode, autoComplete = 'off', disabled = false, description,
}: TextInputRowProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label-cluster">
        <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
      </span>
      <DreamVizTextInput
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
        disabled={disabled}
        aria-describedby={description ? `${inputId}-description` : undefined}
      />
      {description && <span id={`${inputId}-description`} className="rv-ctrl-description">{description}</span>}
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
      <span className="rv-ctrl-label-cluster">
        <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
      </span>
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
  return <DualRailCollapsible label={label} defaultOpen={defaultOpen}>{children}</DualRailCollapsible>
}
