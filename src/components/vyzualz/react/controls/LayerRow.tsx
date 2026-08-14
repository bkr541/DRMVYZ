import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import './canonicalControls.css'

// ── LayerRow ──────────────────────────────────────────────────────────────
//
// Canonical DRMVYZ layer-list row from Layout Lab's "Channel Strip" winner.
// A mixing-console channel per layer: a colored accent rail with a huge
// faint ghost index behind it, label up top, status faded out with a
// mask-image gradient instead of an ellipsis — so a long locked-media
// filename dissolves at the edge rather than clipping or squeezing the row.

export interface LayerRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  index: number
  label: string
  status: string
  tone: string
  active?: boolean
}

export const LayerRow = forwardRef<HTMLButtonElement, LayerRowProps>(function LayerRow({
  index,
  label,
  status,
  tone,
  active = false,
  className = '',
  type = 'button',
  style,
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`dv-layer-row${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      style={{ ...style, '--layer-row-tone': tone } as CSSProperties}
    >
      <span className="dv-layer-row-ghost" aria-hidden="true">{String(index).padStart(2, '0')}</span>
      <span className="dv-layer-row-accent" aria-hidden="true" />
      <span className="dv-layer-row-body">
        <strong className="dv-layer-row-label">{label}</strong>
        <small className="dv-layer-row-status" title={status}>{status}</small>
      </span>
    </button>
  )
})
