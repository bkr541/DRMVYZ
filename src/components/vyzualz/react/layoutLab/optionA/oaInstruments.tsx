import type { ReactNode } from 'react'

// ── Option A · instruments ─────────────────────────────────────────────────────────────────────────────────────
//
// Purpose-drawn readouts shared by the header and the dock. A ring gauge is a thin track with a lit arc and the
// reading in its middle (the reference's volume-level dial); it is drawn from a 0–1 ratio and never animates on its own.

export function OaRing({ ratio, size = 44, stroke = 3, tone = 'ember', className = '', children }: {
  ratio: number
  size?: number
  stroke?: number
  tone?: 'ember' | 'ice' | 'white'
  className?: string
  children?: ReactNode
}) {
  const clamped = Math.min(1, Math.max(0, ratio))
  const radius = 50 - stroke
  return (
    <span className={`oa-ring${className ? ` ${className}` : ''}`} data-tone={tone} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="oa-ring__track" cx="50" cy="50" r={radius} strokeWidth={stroke * 2} />
        {clamped > 0.003 && (
          <circle
            className="oa-ring__arc"
            cx="50"
            cy="50"
            r={radius}
            strokeWidth={stroke * 2}
            pathLength={100}
            strokeDasharray={`${clamped * 100} 100`}
            transform="rotate(-90 50 50)"
          />
        )}
      </svg>
      {children !== undefined && <span className="oa-ring__body">{children}</span>}
    </span>
  )
}
