import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  /** When set, double-clicking the slider resets its value to this amount. */
  resetValue?: number
  onInteractionStart?: () => void
  onInteractionEnd?: () => void
}

export function SliderRow({
  label, labelAccessory, value, onChange,
  min = 0, max = 1, step = 0.01,
  color = '#4ac7db', id, disabled = false, description, resetValue, onInteractionStart, onInteractionEnd,
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
        onDoubleClick={resetValue === undefined ? undefined : () => onChange(resetValue)}
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

export interface SelectOption { value: string; label: string; disabled?: boolean; style?: CSSProperties }

export interface SelectRowProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  disabled?: boolean
  id?: string
  description?: string
  placeholder?: string
  labelHidden?: boolean
  /** Extra class on the portaled option menu — lets a call site scope
   *  per-option adornments (e.g. a colored dot) without touching other
   *  SelectRow menus. */
  menuClassName?: string
}

export function SelectRow({ label, value, onChange, options, disabled, id, description, placeholder, labelHidden = false, menuClassName }: SelectRowProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className="rv-ctrl-row">
      <span className={`rv-ctrl-label-cluster${labelHidden ? ' sr-only' : ''}`}>
        <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
      </span>
      <UnderlineDropdown
        id={`${inputId}-dropdown`}
        triggerId={inputId}
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        placeholder={placeholder}
        ariaLabel={label}
        ariaDescribedBy={description ? `${inputId}-description` : undefined}
        menuLabel={label}
        size="compact"
        showDescriptions={false}
        className="rv-ctrl-dropdown"
        menuClassName={menuClassName}
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

// ── Palette color row (Layout Lab "Full-Bleed Swatch" + popover HSL picker) ────
//
// Canonical treatment for named-color-slot groups (Cinema's per-layer Palette:
// Background / Primary / Secondary / Accent / Foreground / Highlight). The
// label sits above a full-width color block; clicking it opens an in-app
// popover with Hue/Saturation/Lightness sliders (Layout Lab's "Inline Expand"
// controls) positioned and dismissed like Layout Lab's "Popover Gradient"
// variant — an OS-native color panel can't be resized or recolored, so this
// picker is fully DOM-owned instead.

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim()
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.padStart(6, '0')
  const value = Number.parseInt(full, 16) || 0
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
}

function hexToHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexToRgb(hex).map(v => v / 255)
  const max = Math.max(r0, g0, b0)
  const min = Math.min(r0, g0, b0)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r0) h = ((g0 - b0) / d) % 6
    else if (max === g0) h = (b0 - r0) / d + 2
    else h = (r0 - g0) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

function isValidHex(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
}

export interface PaletteColorRowProps {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  description?: string
}

export function PaletteColorRow({ label, value, onChange, disabled = false, id, description }: PaletteColorRowProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const swatchRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    const rect = swatchRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ top: rect.bottom + 6, left: rect.left })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (swatchRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    // Bound to the swatch's own window/document rather than the bare
    // globals — a foreign-window portal (this popover can be opened from
    // inside Layout Lab's popup window) never receives events routed to the
    // wrong window, and window.innerWidth/innerHeight below would otherwise
    // measure the wrong viewport entirely.
    const ownerDocument = swatchRef.current?.ownerDocument ?? document
    const ownerWindow = ownerDocument.defaultView ?? window
    ownerDocument.addEventListener('pointerdown', onPointerDown)
    ownerWindow.addEventListener('resize', updatePosition)
    ownerWindow.addEventListener('scroll', updatePosition, true)
    return () => {
      ownerDocument.removeEventListener('pointerdown', onPointerDown)
      ownerWindow.removeEventListener('resize', updatePosition)
      ownerWindow.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  // Once the popover has actually mounted, clamp it to the viewport — a
  // swatch near the panel's right/bottom edge would otherwise anchor the
  // popover off-screen. Bails out (returns the same object) once the
  // clamped position stops changing, so this converges instead of looping.
  useLayoutEffect(() => {
    if (!open || !position) return
    const swatchRect = swatchRef.current?.getBoundingClientRect()
    const popoverRect = popoverRef.current?.getBoundingClientRect()
    if (!swatchRect || !popoverRect) return
    const ownerWindow = swatchRef.current?.ownerDocument.defaultView ?? window
    const margin = 8
    const nextLeft = Math.min(swatchRect.left, Math.max(margin, ownerWindow.innerWidth - margin - popoverRect.width))
    const nextTop = (swatchRect.bottom + 6 + popoverRect.height > ownerWindow.innerHeight - margin)
      ? Math.max(margin, swatchRect.top - popoverRect.height - 6)
      : swatchRect.bottom + 6
    setPosition(current => (current && current.left === nextLeft && current.top === nextTop) ? current : { left: nextLeft, top: nextTop })
  }, [open, position])

  const [h, s, l] = hexToHsl(value)
  const setHsl = (nextH: number, nextS: number, nextL: number) => onChange(hslToHex(nextH, nextS, nextL))

  return (
    <div className="rv-ctrl-palette-row">
      <label className="rv-ctrl-palette-row-label" htmlFor={inputId}>{label}</label>
      <button
        ref={swatchRef}
        id={inputId}
        type="button"
        className={`rv-ctrl-palette-swatch${disabled ? ' rv-ctrl-palette-swatch--disabled' : ''}`}
        style={{ background: value }}
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={description ? `${inputId}-description` : undefined}
        onClick={() => setOpen(current => !current)}
      />
      {open && !disabled && position && swatchRef.current && createPortal(
        <div ref={popoverRef} className="rv-ctrl-palette-popover" style={{ top: position.top, left: position.left }}>
          <div
            className="rv-ctrl-palette-gradient-square"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))` }}
            onPointerDown={event => {
              const rect = event.currentTarget.getBoundingClientRect()
              const move = (clientX: number, clientY: number) => {
                const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
                setHsl(h, x * 100, (1 - y) * 100)
              }
              move(event.clientX, event.clientY)
              // The drag target's own window — see the ownerDocument note above.
              const ownerWindow = event.currentTarget.ownerDocument.defaultView ?? window
              const onMove = (moveEvent: PointerEvent) => move(moveEvent.clientX, moveEvent.clientY)
              const onUp = () => ownerWindow.removeEventListener('pointermove', onMove)
              ownerWindow.addEventListener('pointermove', onMove)
              ownerWindow.addEventListener('pointerup', onUp, { once: true })
            }}
          >
            <span className="rv-ctrl-palette-gradient-thumb" style={{ left: `${s}%`, top: `${100 - l}%` }} aria-hidden="true" />
          </div>
          <BubbleRevealSlider
            className="rv-ctrl-palette-hue-slider"
            min={0} max={360} step={1} value={h}
            aria-label="Hue"
            onChange={event => setHsl(Number(event.target.value), s, l)}
          />
          <div className="rv-ctrl-palette-popover-hex-row">
            <span className="rv-ctrl-palette-popover-swatch" style={{ background: value }} aria-hidden="true" />
            <DreamVizTextInput
              className="rv-ctrl-palette-popover-hex"
              value={value}
              onChange={event => { if (isValidHex(event.target.value)) onChange(event.target.value) }}
            />
          </div>
        </div>,
        // Portal into the swatch's own document, not the bare global — see
        // the ownerDocument note in the effect above.
        swatchRef.current.ownerDocument.body,
      )}
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
  label: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  bodyClassName?: string
  headerAccessory?: ReactNode
  children: React.ReactNode
}

export function Collapsible({ label, defaultOpen = true, open, onOpenChange, bodyClassName, headerAccessory, children }: CollapsibleProps) {
  return (
    <DualRailCollapsible
      label={label}
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      bodyClassName={bodyClassName}
      headerAccessory={headerAccessory}
    >
      {children}
    </DualRailCollapsible>
  )
}
