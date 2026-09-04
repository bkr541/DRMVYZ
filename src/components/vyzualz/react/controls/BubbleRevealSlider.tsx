import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import './canonicalControls.css'

export interface BubbleRevealSliderProps extends InputHTMLAttributes<HTMLInputElement> {
  bubbleLabel?: ReactNode | ((value: number, percent: number) => ReactNode)
  showBubble?: boolean
  /** Also reveal the value bubble on pointer hover, not only during a
   *  drag/focus interaction. Opt-in — off by default. */
  revealOnHover?: boolean
}

interface BubblePosition {
  left: number
  top: number
}

function numericValue(value: BubbleRevealSliderProps['value'], fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Canonical DRMVYZ slider.
 *
 * This is the production source of truth for Layout Lab's “Bubble Reveal”
 * slider. It deliberately renders the range input without a layout wrapper so
 * it can replace legacy/native sliders without changing their geometry. The
 * value bubble is portalled to document.body while the control is active.
 */
export const BubbleRevealSlider = forwardRef<HTMLInputElement, BubbleRevealSliderProps>(function BubbleRevealSlider({
  type: _type,
  min = 0,
  max = 100,
  value,
  defaultValue,
  className = '',
  style,
  bubbleLabel,
  showBubble = true,
  revealOnHover = false,
  disabled,
  onChange,
  onInput,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...rest
}, forwardedRef) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [bubblePosition, setBubblePosition] = useState<BubblePosition | null>(null)
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)

  const minNumber = Number(min)
  const maxNumber = Number(max)
  const fallbackValue = numericValue(defaultValue, Number.isFinite(minNumber) ? minNumber : 0)
  const currentValue = numericValue(value, fallbackValue)
  const span = maxNumber - minNumber
  const percent = Number.isFinite(span) && span !== 0
    ? Math.max(0, Math.min(100, ((currentValue - minNumber) / span) * 100))
    : 0

  const updateBubblePosition = useCallback(() => {
    const input = inputRef.current
    if (!input || typeof window === 'undefined') return
    const rect = input.getBoundingClientRect()
    const x = rect.left + (rect.width * percent / 100)
    setBubblePosition({ left: x, top: rect.top - 8 })
  }, [percent])

  const bubbleVisible = (active || hovering) && showBubble

  useEffect(() => {
    if (!bubbleVisible || typeof window === 'undefined') return
    updateBubblePosition()
    const update = () => updateBubblePosition()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [bubbleVisible, updateBubblePosition])

  const resolvedBubbleLabel = typeof bubbleLabel === 'function'
    ? bubbleLabel(currentValue, percent)
    : bubbleLabel ?? `${Math.round(percent)}%`

  const canonicalStyle = {
    ...style,
    '--dv-slider-pct': `${percent}%`,
  } as CSSProperties

  return (
    <>
      <input
        {...rest}
        ref={inputRef}
        type="range"
        min={min}
        max={max}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        disabled={disabled}
        className={`dv-bubble-slider${className ? ` ${className}` : ''}`}
        style={canonicalStyle}
        onChange={event => {
          onChange?.(event)
          requestAnimationFrame(updateBubblePosition)
        }}
        onInput={event => {
          onInput?.(event)
          requestAnimationFrame(updateBubblePosition)
        }}
        onPointerDown={event => {
          if (!disabled) setActive(true)
          onPointerDown?.(event)
          requestAnimationFrame(updateBubblePosition)
        }}
        onPointerMove={event => {
          onPointerMove?.(event)
          if (active) requestAnimationFrame(updateBubblePosition)
        }}
        onPointerUp={event => {
          onPointerUp?.(event)
          setActive(false)
        }}
        onPointerCancel={event => {
          onPointerCancel?.(event)
          setActive(false)
        }}
        onPointerEnter={event => {
          if (revealOnHover && !disabled) {
            setHovering(true)
            requestAnimationFrame(updateBubblePosition)
          }
          onPointerEnter?.(event)
        }}
        onPointerLeave={event => {
          setHovering(false)
          onPointerLeave?.(event)
        }}
        onFocus={event => {
          if (!disabled) setActive(true)
          onFocus?.(event)
          requestAnimationFrame(updateBubblePosition)
        }}
        onBlur={event => {
          onBlur?.(event)
          setActive(false)
        }}
      />
      {bubbleVisible && bubblePosition && typeof document !== 'undefined' && createPortal(
        <span
          className="dv-bubble-slider__popover"
          style={{ left: bubblePosition.left, top: bubblePosition.top }}
          aria-hidden="true"
        >
          {resolvedBubbleLabel}
        </span>,
        document.body,
      )}
    </>
  )
})
