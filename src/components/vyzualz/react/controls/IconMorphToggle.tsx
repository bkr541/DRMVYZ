import { AppIcon } from '../../../shared/icons/AppIcon'
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'
import './canonicalControls.css'

export interface IconMorphToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function ToggleGlyph({ checked }: { checked: boolean }) {
  return <AppIcon kind={checked ? 'check' : 'off'} size={13} className="dv-icon-morph-toggle__icon" />
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
      <span className="dv-icon-morph-checkbox__off"><ToggleGlyph checked={false} /></span>
      <span className="dv-icon-morph-checkbox__on"><ToggleGlyph checked /></span>
    </span>
  )
})
