import { forwardRef, type InputHTMLAttributes } from 'react'
import './canonicalControls.css'

export interface DreamVizTextInputProps extends InputHTMLAttributes<HTMLInputElement> {}

/** Canonical DRMVYZ text-field treatment from Layout Lab → Template. */
export const DreamVizTextInput = forwardRef<HTMLInputElement, DreamVizTextInputProps>(function DreamVizTextInput({
  className = '',
  type = 'text',
  ...props
}, ref) {
  return (
    <input
      {...props}
      ref={ref}
      type={type}
      className={`dv-text-input${className ? ` ${className}` : ''}`}
    />
  )
})
