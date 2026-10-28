import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'
import './canonicalControls.css'

export interface IconMorphToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function ToggleGlyph({ checked }: { checked: boolean }) {
  return <svg className={`dv-icon-morph-toggle__icon${checked ? ' is-on' : ''}`} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
    <circle cx={6} cy={6} r={4.5} strokeWidth={1} fill={checked ? 'currentColor' : 'none'} stroke="currentColor" />
  </svg>
}

/** Canonical boolean switch: a small outlined circle off, a bordered filled circle on. */
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
      <span className="dv-icon-morph-checkbox__off"><ToggleGlyph checked={false} /></span>
      <span className="dv-icon-morph-checkbox__on"><ToggleGlyph checked /></span>
    </span>
  )
})
