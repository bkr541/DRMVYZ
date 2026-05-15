import { useRef } from 'react'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import { calcApproxLUFS, calcTruePeak } from '../../utils/dsp'

interface Props {
  analyser: AnalyserNode | null
  isActive: boolean
  sampleRate: number
}

export function LoudnessPanel({ analyser, isActive, sampleRate }: Props) {
  const freqRef       = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeRef       = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const momentaryRef  = useRef(-60)
  const shortTermRef  = useRef(-60)
  const integratedRef = useRef(-60)
  const intCountRef   = useRef(0)
  const truePeakRef   = useRef(-60)
  const phaseRef      = useRef(0)

  // Force re-render each frame by updating a state via a ref trick
  const valsRef = useRef({ M: -60, S: -60, I: -60, P: -60 })
  const forceRef = useRef<(() => void) | null>(null)

  // We use a canvas-free approach: DOM updates via state are too expensive per frame.
  // Instead use a canvas for the scale bar and update text directly via refs.
  const mRef = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const sRef = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const iRef = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const pRef = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const markerRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>

  useAnimationFrame(() => {
    phaseRef.current += 0.04

    let rawLUFS: number
    let rawTP: number

    if (analyser && isActive) {
      const bins = analyser.frequencyBinCount
      if (!freqRef.current || freqRef.current.length !== bins)
        freqRef.current = new Uint8Array(bins) as Uint8Array<ArrayBuffer>
      if (!timeRef.current || timeRef.current.length !== analyser.fftSize)
        timeRef.current = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>

      analyser.getByteFrequencyData(freqRef.current)
      analyser.getByteTimeDomainData(timeRef.current)

      rawLUFS = calcApproxLUFS(freqRef.current, sampleRate)
      rawTP   = 20 * Math.log10(Math.max(1e-6, calcTruePeak(timeRef.current)))
    } else {
      const t = phaseRef.current
      rawLUFS = -23 + Math.sin(t * 0.7) * 4 + Math.sin(t * 1.8) * 2
      rawTP   = rawLUFS + 1.2
    }

    momentaryRef.current  += (rawLUFS - momentaryRef.current) * 0.14
    shortTermRef.current  += (rawLUFS - shortTermRef.current) * 0.022
    intCountRef.current++
    integratedRef.current += (rawLUFS - integratedRef.current) / intCountRef.current
    truePeakRef.current    = Math.max(truePeakRef.current * 0.9998, rawTP)

    const M = momentaryRef.current
    const S = shortTermRef.current
    const I = integratedRef.current
    const P = truePeakRef.current

    if (mRef.current) mRef.current.textContent = M.toFixed(1)
    if (sRef.current) sRef.current.textContent = S.toFixed(1)
    if (iRef.current) iRef.current.textContent = I.toFixed(1)
    if (pRef.current) pRef.current.textContent = P.toFixed(1)

    // Scale marker: map I from -40..0 to 0..100%
    const pct = Math.max(0, Math.min(100, ((I + 40) / 40) * 100))
    if (markerRef.current) markerRef.current.style.left = `${pct}%`

    void forceRef.current
  })

  const fmt = (v: number) => v.toFixed(1)
  void fmt

  return (
    <div className="az-loudness-body">
      <div className="az-loudness-values">
        <LCell label="INTEGRATED" unit="LUFS" valRef={iRef} />
        <LCell label="SHORT TERM" unit="LUFS" valRef={sRef} />
        <LCell label="MOMENTARY"  unit="LUFS" valRef={mRef} />
        <LCell label="TRUE PEAK"  unit="dBTP" valRef={pRef} />
      </div>

      <div className="az-loudness-scale">
        <div className="az-loudness-scale-track">
          <div className="az-loudness-scale-fill" />
        </div>
        <div ref={markerRef} className="az-loudness-scale-marker" style={{ left: '50%' }} />
        <div className="az-loudness-scale-labels">
          {['-40', '-30', '-20', '-10', '0'].map(t => (
            <span key={t} className="az-loudness-scale-tick">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function LCell({ label, unit, valRef }: {
  label: string
  unit: string
  valRef: React.RefObject<HTMLSpanElement>
}) {
  return (
    <div className="az-loudness-cell">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span ref={valRef} className="az-loudness-big">—</span>
      </div>
      <span className="az-loudness-unit">{unit}</span>
      <span className="az-loudness-sublabel">{label}</span>
    </div>
  )
}
