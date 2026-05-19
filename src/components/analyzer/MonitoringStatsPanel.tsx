import { useRef, forwardRef, useImperativeHandle } from 'react'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import { calcApproxLUFS, calcTruePeak, calcRMS, linToDb } from '../../utils/dsp'

export interface MonitoringHandle { reset: () => void }

interface Props {
  analyser: AnalyserNode | null
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  isActive: boolean
  sampleRate: number
}

export const MonitoringStatsPanel = forwardRef<MonitoringHandle, Props>(function MonitoringStatsPanel(
  { analyser, analyserL, analyserR, isActive, sampleRate }, ref
) {
  const freqRef  = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeRef  = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const bufLRef  = useRef<Float32Array<ArrayBuffer> | null>(null)
  const bufRRef  = useRef<Float32Array<ArrayBuffer> | null>(null)
  const phaseRef = useRef(0)

  const loudRef     = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const peakRef2    = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const dynRef      = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const crestRef    = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const corrRef     = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const balRef      = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>

  // running integrated loudness state
  const intRef  = useRef(-60)
  const cntRef  = useRef(0)
  const peakHoldRef = useRef(-100)

  const reset = () => {
    intRef.current      = -60
    cntRef.current      = 0
    peakHoldRef.current = -100
  }

  useImperativeHandle(ref, () => ({ reset }))

  useAnimationFrame(() => {
    phaseRef.current += 0.04

    let loud = -60, tp = -100, rmsDb = -60, corrVal = 0
    let dbL = -60, dbR = -60

    if (analyser && isActive) {
      const bins = analyser.frequencyBinCount
      if (!freqRef.current || freqRef.current.length !== bins)
        freqRef.current = new Uint8Array(bins) as Uint8Array<ArrayBuffer>
      if (!timeRef.current || timeRef.current.length !== analyser.fftSize)
        timeRef.current = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>

      analyser.getByteFrequencyData(freqRef.current)
      analyser.getByteTimeDomainData(timeRef.current)

      loud  = calcApproxLUFS(freqRef.current, sampleRate)
      tp    = 20 * Math.log10(Math.max(1e-6, calcTruePeak(timeRef.current)))
      rmsDb = linToDb(Math.sqrt(
        Array.from(timeRef.current).reduce((s, v) => s + ((v / 128 - 1) ** 2), 0) / timeRef.current.length
      ))
    } else {
      const t = phaseRef.current
      loud  = -23 + Math.sin(t * 0.6) * 3
      tp    = loud + 1
      rmsDb = loud - 2
    }

    // Integrated
    cntRef.current++
    intRef.current += (loud - intRef.current) / cntRef.current
    peakHoldRef.current = Math.max(peakHoldRef.current * 0.9999, tp)

    // Dynamic range = peak - integrated
    const dynRange = peakHoldRef.current - intRef.current

    // Crest factor = peak - rms (approx)
    const crest = peakHoldRef.current - rmsDb

    // Phase correlation from L/R
    if (analyserL && analyserR && isActive) {
      const len = analyserL.fftSize
      if (!bufLRef.current || bufLRef.current.length !== len)
        bufLRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      if (!bufRRef.current || bufRRef.current.length !== len)
        bufRRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current)

      let sumLR = 0, sumLL = 0, sumRR = 0
      for (let i = 0; i < len; i++) {
        sumLR += bufLRef.current[i] * bufRRef.current[i]
        sumLL += bufLRef.current[i] * bufLRef.current[i]
        sumRR += bufRRef.current[i] * bufRRef.current[i]
      }
      const denom = Math.sqrt(sumLL * sumRR)
      corrVal = denom > 1e-10 ? Math.max(-1, Math.min(1, sumLR / denom)) : 0

      dbL = linToDb(calcRMS(bufLRef.current))
      dbR = linToDb(calcRMS(bufRRef.current))
    } else {
      corrVal = 0.12
      dbL = loud; dbR = loud
    }

    const balDiff = dbL - dbR
    const balStr  = Math.abs(balDiff) < 0.1 ? 'C' : `${balDiff > 0 ? 'L' : 'R'} ${Math.abs(balDiff).toFixed(1)} dB`

    const fmtLufs = (v: number) => v < -59 ? '-∞' : `${v.toFixed(1)} LUFS`
    const fmtDb   = (v: number) => v < -99 ? '-∞' : `${v.toFixed(1)} dBTP`
    const fmtDyn  = (v: number) => `${Math.max(0, v).toFixed(1)} dB`
    const fmtCorr = (v: number) => v.toFixed(2)

    if (loudRef.current)  loudRef.current.textContent  = fmtLufs(intRef.current)
    if (peakRef2.current) peakRef2.current.textContent = fmtDb(peakHoldRef.current)
    if (dynRef.current)   dynRef.current.textContent   = fmtDyn(dynRange)
    if (crestRef.current) crestRef.current.textContent = fmtDyn(crest)
    if (corrRef.current)  corrRef.current.textContent  = fmtCorr(corrVal)
    if (balRef.current)   balRef.current.textContent   = balStr

    void dbL; void dbR
  })

  return (
    <div className="az-monitoring-body">
      <Stat label="Loudness"      valRef={loudRef}  />
      <Stat label="True Peak"     valRef={peakRef2} />
      <Stat label="Dynamic Range" valRef={dynRef}   />
      <Stat label="Crest Factor"  valRef={crestRef} />
      <Stat label="Correlation"   valRef={corrRef}  />
      <Stat label="Balance"       valRef={balRef}   />
    </div>
  )
})

function Stat({ label, valRef }: { label: string; valRef: React.RefObject<HTMLSpanElement> }) {
  return (
    <div className="az-mon-stat-row">
      <span className="az-mon-stat-label">{label}</span>
      <span ref={valRef} className="az-mon-stat-val">—</span>
    </div>
  )
}
