import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import './canonicalControls.css'

export interface IconChipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 'primary' is the tone-filled emphasis state; 'default' is the quiet, neutral chip. */
  tone?: 'primary' | 'default'
  icon?: ReactNode
}

/** Canonical DRMVYZ action button from Layout Lab's "Icon Chip" treatment. */
export const IconChipButton = forwardRef<HTMLButtonElement, IconChipButtonProps>(function IconChipButton({
  tone = 'default',
  icon,
  className = '',
  type = 'button',
  children,
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`dv-icon-chip${tone === 'primary' ? ' dv-icon-chip--primary' : ''}${className ? ` ${className}` : ''}`}
    >
      {icon != null && <span className="dv-icon-chip__icon" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
})
