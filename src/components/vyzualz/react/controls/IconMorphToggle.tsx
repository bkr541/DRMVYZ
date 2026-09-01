import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'
import './canonicalControls.css'

export interface IconMorphToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function ToggleGlyph({ checked }: { checked: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="dv-icon-morph-toggle__icon" aria-hidden="true">
      <circle cx="10" cy="10" r="8" className="dv-icon-morph-toggle__ring" />
      <path d="M6 10.5l2.5 2.5L14 7" className="dv-icon-morph-toggle__check" />
    </svg>
  )
}

/** Canonical DRMVYZ boolean switch from Layout Lab's “Icon Morph” treatment. */
export const IconMorphToggle = forwardRef<HTMLButtonElement, IconMorphToggleProps>(function IconMorphToggle({
  checked,
  onCheckedChange,
  className = '',
  disabled,
  onClick,
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      role={props.role ?? 'switch'}
      aria-checked={props['aria-checked'] ?? checked}
      aria-pressed={props['aria-pressed'] ?? checked}
      disabled={disabled}
      className={`dv-icon-morph-toggle${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      onClick={event => {
        onClick?.(event)
        if (!event.defaultPrevented && !disabled) onCheckedChange(!checked)
      }}
    >
      <ToggleGlyph checked={checked} />
    </button>
  )
})

export interface IconMorphCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

/**
 * Native-checkbox adapter for places where form semantics are required.
 * It preserves the real checkbox input and uses the same canonical Icon Morph
 * visual treatment as IconMorphToggle.
 */
export const IconMorphCheckbox = forwardRef<HTMLInputElement, IconMorphCheckboxProps>(function IconMorphCheckbox({
  className = '',
  checked,
  defaultChecked,
  disabled,
  ...props
}, ref) {
  return (
    <span className={`dv-icon-morph-checkbox${checked ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}>
      <input
        {...props}
        ref={ref}
        type="checkbox"
        checked={checked}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        disabled={disabled}
        className={`dv-icon-morph-checkbox__input${className ? ` ${className}` : ''}`}
      />
      <ToggleGlyph checked={Boolean(checked ?? defaultChecked)} />
    </span>
  )
})
