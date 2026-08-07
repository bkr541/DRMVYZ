import { useEffect, useId, useRef, useState } from 'react'
import './dropdown_v2.css'

// ── dropdown_v2 ──────────────────────────────────────────────────────────
//
// Step 1 of restyling the app's dropdowns: a standalone, reusable component
// built from the exact styling, layout, and interaction of the "Underline"
// dropdown in Layout Lab's Template gallery (DropdownStyleGallery.tsx) —
// borderless trigger with an eyebrow label, animated underline on
// hover/open, and a left-accent-bar option menu. Not wired into the app
// yet; that migration happens as a separate follow-up.

export interface DropdownV2Option {
  value: string
  label: string
  disabled?: boolean
}

export interface DropdownV2Props {
  id?: string
  triggerId?: string
  label?: string
  ariaLabel?: string
  options: readonly DropdownV2Option[]
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string, option: DropdownV2Option) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="dv2-chevron" focusable="false" aria-hidden="true">
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  )
}

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (event: PointerEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return
      onClose()
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [open, onClose])
  return ref
}

export function DropdownV2({
  id,
  triggerId: requestedTriggerId,
  label,
  ariaLabel,
  options,
  value,
  defaultValue = null,
  onChange,
  placeholder = 'Select an option…',
  emptyMessage = 'No options available',
  disabled = false,
  className = '',
}: DropdownV2Props) {
  const generatedId = useId()
  const baseId = id ?? `dv2-dropdown-${generatedId}`
  const triggerId = requestedTriggerId ?? `${baseId}-trigger`
  const labelId = `${baseId}-label`
  const listboxId = `${baseId}-listbox`

  const valueIsControlled = value !== undefined
  const [internalValue, setInternalValue] = useState<string | null>(defaultValue)
  const [open, setOpen] = useState(false)
  const rootRef = useOutsideClose(open, () => setOpen(false))

  const selectedValue = valueIsControlled ? value ?? null : internalValue
  const selectedOption = options.find(option => option.value === selectedValue) ?? null

  const chooseOption = (option: DropdownV2Option) => {
    if (disabled || option.disabled) return
    if (!valueIsControlled) setInternalValue(option.value)
    if (option.value !== selectedValue) onChange?.(option.value, option)
    setOpen(false)
  }

  return (
    <div className={`dv2-underline${className ? ` ${className}` : ''}`} ref={rootRef}>
      {label != null && (
        <span id={labelId} className="dv2-underline-label">{label}</span>
      )}
      <button
        id={triggerId}
        type="button"
        className={`dv2-underline-trigger${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-labelledby={!ariaLabel && label != null ? labelId : undefined}
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
      >
        <span className={selectedOption ? 'dv2-underline-value' : 'dv2-underline-value dv2-underline-value--placeholder'}>
          {selectedOption?.label ?? placeholder}
        </span>
        <Chevron />
      </button>

      {open && (
        <div id={listboxId} className="dv2-underline-menu" role="listbox" aria-labelledby={label != null ? labelId : undefined}>
          {options.length === 0 ? (
            <div className="dv2-underline-empty">{emptyMessage}</div>
          ) : options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === selectedValue}
              disabled={option.disabled}
              className={`dv2-underline-option${option.value === selectedValue ? ' is-active' : ''}`}
              onClick={() => chooseOption(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
