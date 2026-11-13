import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import './performancePad.css'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> & {
  label: string
  density?: 'compact' | 'expanded'
  shortcut: string
  color?: string
  selected?: boolean
  pressed?: boolean
  readOnly?: boolean
  onActivate?: () => void
}

/** Store-free pad surface. Callers own assignment, selection and performance routing. */
export function PerformancePad({ label, shortcut, color, density = 'expanded', selected = false, pressed = false, readOnly = false, onActivate, disabled, className = '', style, ...props }: Props) {
  const [held, setHeld] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pulseTimer = useRef<number | undefined>(undefined)
  const keyboardActivation = useRef(false)
  const release = () => { window.clearTimeout(pulseTimer.current); setHeld(false) }
  useEffect(() => {
    const owner = buttonRef.current?.ownerDocument.defaultView
    const reset = () => { window.clearTimeout(pulseTimer.current); keyboardActivation.current = false; setHeld(false) }
    owner?.addEventListener('blur', reset)
    return () => { window.clearTimeout(pulseTimer.current); owner?.removeEventListener('blur', reset) }
  }, [])
  return <button {...props} ref={buttonRef} type="button" disabled={disabled}
    className={`performance-pad rv-pad${selected ? ' rv-pad--active' : ''}${pressed ? ' rv-pad--pressed' : ''}${className ? ` ${className}` : ''}`}
    data-density={density} data-selected={selected || undefined} data-hit={!disabled && (held || pressed) || undefined}
    style={{ '--pad-color': disabled ? undefined : color, ...style } as CSSProperties}
    onPointerDown={event => { if (!disabled && event.button === 0) { window.clearTimeout(pulseTimer.current); event.currentTarget.setPointerCapture?.(event.pointerId); setHeld(true) } }}
    onPointerUp={release} onPointerCancel={release} onBlur={() => { keyboardActivation.current = false; release() }}
    onKeyDown={event => { if (!disabled && (event.key === ' ' || event.key === 'Enter')) { if (event.repeat) event.preventDefault(); keyboardActivation.current = true; window.clearTimeout(pulseTimer.current); setHeld(true) } }}
    onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') release() }}
    onClick={event => {
      if (disabled) return
      if (!readOnly) onActivate?.()
      if (event.detail === 0 && !keyboardActivation.current) { setHeld(true); pulseTimer.current = window.setTimeout(() => setHeld(false), 40) }
      keyboardActivation.current = false
    }}>
    <span className="performance-pad-surface">
      <span className="performance-pad-line" aria-hidden="true" />
      <span className="performance-pad-label rv-pad-label">{label}</span>
      <span className="performance-pad-number rv-pad-key" aria-hidden="true">{shortcut}</span>
    </span>
  </button>
}
