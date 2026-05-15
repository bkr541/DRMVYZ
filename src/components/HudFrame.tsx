import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'

interface Props {
  primaryColor: string
  showGlow: boolean
  accentIntensity: number
  recordingMode: boolean
}

export function HudFrame({ primaryColor, showGlow, accentIntensity, recordingMode }: Props) {
  const recRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef(0)

  useAnimationFrame(() => {
    phaseRef.current += 0.04
    const rec = recRef.current
    if (!rec) return
    rec.style.opacity = String(0.5 + Math.abs(Math.sin(phaseRef.current)) * 0.5)
  }, recordingMode)

  return (
    <>
      {/* Corner HUD brackets */}
      <div className="hud-corners" aria-hidden>
        <div className="hud-corner tl" style={{ borderColor: primaryColor, boxShadow: showGlow ? `0 0 ${accentIntensity * 8}px ${primaryColor}40` : 'none' }} />
        <div className="hud-corner tr" style={{ borderColor: primaryColor, boxShadow: showGlow ? `0 0 ${accentIntensity * 8}px ${primaryColor}40` : 'none' }} />
        <div className="hud-corner bl" style={{ borderColor: primaryColor, boxShadow: showGlow ? `0 0 ${accentIntensity * 8}px ${primaryColor}40` : 'none' }} />
        <div className="hud-corner br" style={{ borderColor: primaryColor, boxShadow: showGlow ? `0 0 ${accentIntensity * 8}px ${primaryColor}40` : 'none' }} />
      </div>

      {recordingMode && (
        <div ref={recRef} className="rec-indicator">
          <span className="rec-dot" />
          REC
        </div>
      )}
    </>
  )
}
