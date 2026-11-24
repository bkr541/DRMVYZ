import { useEffect, useRef, type ReactNode } from 'react'
import { AppIcon } from '../../shared/icons/AppIcon'
import { IconChipButton } from '../react/controls/IconChipButton'
import { Badge } from '../react/controls/Badge'
import { StatusBadge } from '../react/controls/StatusBadge'
import './LiveInputDock.css'

const METER_FLOOR_DB = -48
const SPECTRUM_FLOOR_DB = -90
const SPECTRUM_CEILING_DB = -18
const BARS_PER_BAND = 12
const BANDS = [
  { label: 'Low', minHz: 20, maxHz: 250 },
  { label: 'Mid', minHz: 250, maxHz: 4000 },
  { label: 'High', minHz: 4000, maxHz: 20000 },
]
const barPositions = Array.from({ length: BARS_PER_BAND }, (_, index) => index)

function scaleDecibels(value: number, floor: number, ceiling: number) {
  return Math.max(0, Math.min(1, (value - floor) / (ceiling - floor)))
}

function spectrumRanges(analyser: AnalyserNode, fftSize: number) {
  const hertzPerBin = analyser.context.sampleRate / fftSize
  const binCount = analyser.frequencyBinCount
  return BANDS.flatMap(({ minHz, maxHz }) => {
    const upperHz = Math.min(maxHz, analyser.context.sampleRate / 2)
    return barPositions.map(index => {
      if (upperHz <= minHz) return { start: binCount, end: binCount }
      const low = minHz * (upperHz / minHz) ** (index / BARS_PER_BAND)
      const high = minHz * (upperHz / minHz) ** ((index + 1) / BARS_PER_BAND)
      const start = Math.round(low / hertzPerBin)
      const end = Math.min(binCount, Math.max(start + 1, Math.round(high / hertzPerBin)))
      return { start, end }
    })
  })
}

interface LiveInputDockProps {
  active: boolean
  deviceLabel: string
  analyser: AnalyserNode | null
  fftSize: number
  onToggleCapture: () => void
  sourceControl: ReactNode
}

export function LiveInputDock({
  active, deviceLabel, analyser, fftSize, onToggleCapture, sourceControl,
}: LiveInputDockProps) {
  const meterRef = useRef<HTMLDivElement>(null)
  const spectrumRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const meter = meterRef.current
    if (!meter) return
    const bars = spectrumRef.current?.querySelectorAll<HTMLElement>('i')
    const reset = () => {
      meter.style.removeProperty('--vz-live-level')
      meter.style.removeProperty('--vz-live-peak')
      meter.setAttribute('aria-valuenow', String(METER_FLOOR_DB))
      bars?.forEach(bar => bar.style.removeProperty('--vz-live-bar'))
    }
    if (!active || !analyser) {
      reset()
      return
    }

    // Both meters read the engine's existing analyser in one animation loop.
    const waveform = new Float32Array(fftSize)
    const spectrum = new Float32Array(analyser.frequencyBinCount)
    const ranges = spectrumRanges(analyser, fftSize)
    let frame = 0
    let lastTime = 0
    let heldPeak = METER_FLOOR_DB
    let lastMeterValue = METER_FLOOR_DB

    const draw = (time: number) => {
      analyser.getFloatTimeDomainData(waveform)
      let sumSquares = 0
      let peak = 0
      for (const sample of waveform) {
        sumSquares += sample * sample
        peak = Math.max(peak, Math.abs(sample))
      }
      const levelDb = 10 * Math.log10(sumSquares / waveform.length)
      const peakDb = Math.min(0, 20 * Math.log10(peak))
      heldPeak = Math.max(METER_FLOOR_DB, peakDb, heldPeak - (time - lastTime) * 0.024)
      lastTime = time
      meter.style.setProperty('--vz-live-level', String(scaleDecibels(levelDb, METER_FLOOR_DB, 0)))
      const peakPosition = heldPeak > METER_FLOOR_DB ? scaleDecibels(heldPeak, METER_FLOOR_DB, 0) * 100 : -100
      meter.style.setProperty('--vz-live-peak', `${peakPosition}%`)
      const meterValue = Math.round(Math.max(METER_FLOOR_DB, Math.min(0, levelDb)))
      if (meterValue !== lastMeterValue) {
        meter.setAttribute('aria-valuenow', String(meterValue))
        lastMeterValue = meterValue
      }

      analyser.getFloatFrequencyData(spectrum)
      bars?.forEach((bar, index) => {
        const { start, end } = ranges[index]!
        let db = -Infinity
        for (let bin = start; bin < end; bin += 1) db = Math.max(db, spectrum[bin]!)
        bar.style.setProperty('--vz-live-bar', String(scaleDecibels(db, SPECTRUM_FLOOR_DB, SPECTRUM_CEILING_DB)))
      })
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      reset()
    }
  }, [active, analyser, fftSize])

  const captureAction = active ? 'Stop Live Input' : 'Start Live Input'

  // Use the same direct grid regions, center card and waveform footprint as
  // Track Input. The shared dock layout owns the horizontal alignment.
  return <>
    <div className="vz-dock-region">
      <div className="vz-dock-card vz-live-dock-device-card">
        <IconChipButton className="vz-live-dock-transport" tone={active ? 'primary' : 'default'} aria-label={captureAction} title={captureAction}
          icon={<AppIcon kind={active ? 'stop' : 'play'} size={14} />} onClick={onToggleCapture} />
        <div className="vz-live-dock-device">
          <span>Live Input</span>
          <strong title={deviceLabel}>{deviceLabel}</strong>
        </div>
        <div role="status" className="vz-live-dock-status">
          {active ? <StatusBadge tone="playing">Live</StatusBadge> : <Badge label="Stopped" tone="#a0aeb4" />}
        </div>
      </div>
    </div>
    <div className="vz-dock-region">
      <div className="vz-dock-center vz-dock-card">
        <div className="vz-dock-waveform-wrap vz-live-dock-meters">
          <div className="vz-live-dock-spectrum" ref={spectrumRef}
            role="img" aria-label="Live input spectrum showing low, mid and high frequency levels">
            {BANDS.map(({ label }) => <div key={label} className="vz-live-dock-band" aria-hidden="true">
              <div>{barPositions.map(index => <i key={index} />)}</div>
              <span>{label}</span>
            </div>)}
          </div>
          <div className="vz-live-dock-meter" ref={meterRef} role="meter" aria-label="Live input level in dBFS"
            aria-valuemin={METER_FLOOR_DB} aria-valuemax={0} aria-valuenow={METER_FLOOR_DB}>
            <div className="vz-live-dock-meter-track" aria-hidden="true"><i /><b /></div>
            <div className="vz-live-dock-meter-scale" aria-hidden="true"><span>−48</span><span>−24</span><span>−12</span><span>0 dBFS</span></div>
          </div>
        </div>
      </div>
    </div>
    <div className="vz-dock-region">
      <div className="vz-dock-card vz-live-dock-actions">
        <div className="vz-live-dock-source-slot">{sourceControl}</div>
      </div>
    </div>
  </>
}
