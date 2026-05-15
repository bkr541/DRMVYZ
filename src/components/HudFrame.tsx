import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'

interface Props {
  primaryColor: string
  showGlow: boolean
  accentIntensity: number
  recordingMode: boolean
  showRecIndicator: boolean
}

export function HudFrame({ primaryColor, showGlow, accentIntensity, recordingMode, showRecIndicator }: Props) {
  const recRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef(0)

  useAnimationFrame(() => {
    phaseRef.current += 0.04
    const rec = recRef.current
    if (!rec) return
    rec.style.opacity = String(0.5 + Math.abs(Math.sin(phaseRef.current)) * 0.5)
  }, recordingMode && showRecIndicator)

  return (
    <>
      <div className="hud-corners" aria-hidden>
        {(['tl','tr','bl','br'] as const).map(pos => (
          <div
            key={pos}
            className={`hud-corner ${pos}`}
            style={{
              borderColor: primaryColor,
              boxShadow: showGlow ? `0 0 ${accentIntensity * 8}px ${primaryColor}40` : 'none'
            }}
          />
        ))}
      </div>
      {recordingMode && showRecIndicator && (
        <div ref={recRef} className="rec-indicator">
          <span className="rec-dot" />
          REC
        </div>
      )}
    </>
  )
}
