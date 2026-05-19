import { useState, useCallback } from 'react'

function fmtMin(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m   = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

interface Props {
  currentTime: number
  duration: number
  onSeek: (t: number) => void
  disabled?: boolean
  accentColor?: string
}

export function TrackScrubber({ currentTime, duration, onSeek, disabled, accentColor }: Props) {
  const [scrubbing, setScrubbing] = useState(false)
  const [scrubVal,  setScrubVal]  = useState(0)

  const pct     = duration > 0 ? ((scrubbing ? scrubVal : currentTime) / duration) * 100 : 0
  const display = scrubbing ? scrubVal : currentTime
  const accent  = accentColor ?? 'var(--az-cyan)'

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setScrubVal(parseFloat(e.target.value))
  }, [])

  const handleMouseDown = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrubbing(true)
    setScrubVal(parseFloat((e.target as HTMLInputElement).value))
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    setScrubbing(false)
    onSeek(parseFloat((e.target as HTMLInputElement).value))
  }, [onSeek])

  return (
    <div className="az-scrubber" aria-label="Track position">
      <span className="az-scrubber-time">{fmtMin(display)}</span>
      <input
        type="range"
        className="az-scrubber-input"
        min={0}
        max={duration > 0 ? duration : 1}
        step={0.1}
        value={scrubbing ? scrubVal : currentTime}
        disabled={disabled || duration <= 0}
        onChange={handleChange}
        onPointerDown={handleMouseDown}
        onPointerUp={handlePointerUp}
        style={{
          '--scrub-pct':    `${pct}%`,
          '--scrub-accent': accent,
        } as React.CSSProperties}
      />
      <span className="az-scrubber-time az-scrubber-time--end">{fmtMin(duration)}</span>
    </div>
  )
}
