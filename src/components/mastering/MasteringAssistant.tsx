import React, { useState, useRef, useCallback } from 'react'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import { updateLoudnessReading, createLoudnessState } from '../../analysis/loudness'
import { calcStereoReading } from '../../analysis/stereo'
import { calcTonalBalance } from '../../analysis/tonalBalance'
import { analyzeMastering, getOverallGrade } from '../../analysis/masteringAssistant'
import type { LoudnessReading, StereoReading, MasteringIssue } from '../../types/meters'
import type { SpectralFeatures } from '../../types/audio'
import { TonalBalanceDisplay } from './TonalBalance'

const SEVERITY_COLOR = { info: '#00e5ff', warning: '#ffcc44', critical: '#ff4466' }
const SEVERITY_ICON  = { info: 'ℹ', warning: '⚠', critical: '✕' }

interface Props {
  analyser: AnalyserNode | null
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  isActive: boolean
  sampleRate: number
  primaryColor: string
  secondaryColor: string
  spectralFeatures: SpectralFeatures | null
  bpmDetecting: boolean
  onDetectBPM: () => void
}

export function MasteringAssistant({
  analyser, analyserL, analyserR, isActive, sampleRate,
  primaryColor, secondaryColor, spectralFeatures, bpmDetecting, onDetectBPM,
}: Props) {
  const [issues, setIssues] = useState<MasteringIssue[]>([])
  const [loudness, setLoudness] = useState<LoudnessReading | null>(null)
  const [stereo, setStereo] = useState<StereoReading | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tab, setTab] = useState<'tonal' | 'issues' | 'meter'>('meter')

  const loudStateRef = useRef(createLoudnessState())
  const frameCountRef = useRef(0)

  useAnimationFrame(() => {
    if (!analyser || !analyserL || !analyserR || !isActive) return

    frameCountRef.current++
    const freqData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    analyser.getByteFrequencyData(freqData)
    const timeDomain = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>
    analyser.getFloatTimeDomainData(timeDomain)
    const bufL = new Float32Array(analyserL.fftSize) as Float32Array<ArrayBuffer>
    const bufR = new Float32Array(analyserR.fftSize) as Float32Array<ArrayBuffer>
    analyserL.getFloatTimeDomainData(bufL)
    analyserR.getFloatTimeDomainData(bufR)

    const newLoudness = updateLoudnessReading(loudStateRef.current, freqData, timeDomain, sampleRate, Date.now())
    const newStereo = calcStereoReading(bufL, bufR)

    setLoudness(newLoudness)
    setStereo(newStereo)

    if (frameCountRef.current % 60 === 0) {
      const tonal = calcTonalBalance(freqData, sampleRate)
      setIssues(analyzeMastering(newLoudness, newStereo, tonal))
    }
  }, isActive)

  const grade = getOverallGrade(issues)
  const gradeColor = grade === 'pass' ? primaryColor : grade === 'review' ? '#ffcc44' : '#ff4466'
  const gradeLabel = grade === 'pass' ? 'PASS' : grade === 'review' ? 'REVIEW' : 'FAIL'

  return (
    <div className="mastering-assistant">
      <div className="mastering-disclaimer">
        All readings are browser-based approximations. Not ITU-R BS.1770-4 compliant.
      </div>

      {/* Grade + BPM header */}
      <div className="mastering-header-row">
        <div className="mastering-grade" style={{ color: gradeColor }}>
          <span className="grade-dot" style={{ background: gradeColor }} />
          {gradeLabel} · {issues.length} issue{issues.length !== 1 ? 's' : ''}
        </div>
        <button
          className="btn-text"
          onClick={onDetectBPM}
          disabled={bpmDetecting}
          style={{ '--accent': primaryColor } as React.CSSProperties}
        >
          {bpmDetecting ? 'Detecting…' : spectralFeatures?.bpm ? `${spectralFeatures.bpm.toFixed(1)} BPM` : 'Detect BPM'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="mastering-tabs">
        {(['meter', 'tonal', 'issues'] as const).map(t => (
          <button key={t} className={`mastering-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            style={{ '--accent': primaryColor } as React.CSSProperties}>
            {t === 'meter' ? 'Meters' : t === 'tonal' ? 'Tonal' : 'Issues'}
          </button>
        ))}
      </div>

      {tab === 'meter' && loudness && stereo && (
        <div className="mastering-meters">
          <MeterRow label="Integrated" value={loudness.integrated} unit="LUFS" floor={-40} />
          <MeterRow label="Short-Term" value={loudness.shortTerm} unit="LUFS" floor={-40} />
          <MeterRow label="Momentary"  value={loudness.momentary}  unit="LUFS" floor={-40} />
          <MeterRow label="True Peak"  value={loudness.truePeak}   unit="dBTP" floor={-24} warn={-1} danger={0} />
          <MeterRow label="RMS"        value={loudness.rms}        unit="dBFS" floor={-40} />
          <MeterRow label="Peak"       value={loudness.peak}       unit="dBFS" floor={-24} warn={-3} danger={0} />
          <div className="meter-row-pair">
            <div className="meter-stat">
              <span className="meter-stat-label">Crest Factor</span>
              <span className="meter-stat-val" style={{ color: loudness.crestFactor < 4 ? '#ffcc44' : primaryColor }}>
                {loudness.crestFactor.toFixed(1)} dB
              </span>
            </div>
            <div className="meter-stat">
              <span className="meter-stat-label">Stereo Width</span>
              <span className="meter-stat-val" style={{ color: stereo.stereoWidth < 0.05 ? '#ffcc44' : primaryColor }}>
                {(stereo.stereoWidth * 100).toFixed(0)}%
              </span>
            </div>
            <div className="meter-stat">
              <span className="meter-stat-label">Phase Corr</span>
              <span className="meter-stat-val" style={{ color: stereo.phaseCorrelation < 0 ? '#ff4466' : primaryColor }}>
                {stereo.phaseCorrelation.toFixed(2)}
              </span>
            </div>
            <div className="meter-stat">
              <span className="meter-stat-label">Dyn Range</span>
              <span className="meter-stat-val" style={{ color: primaryColor }}>
                {loudness.dynamicRange.toFixed(1)} dB
              </span>
            </div>
          </div>
          {spectralFeatures && (
            <div className="meter-row-pair">
              <div className="meter-stat">
                <span className="meter-stat-label">Spectral Centroid</span>
                <span className="meter-stat-val">{(spectralFeatures.centroid / 1000).toFixed(1)} kHz</span>
              </div>
              <div className="meter-stat">
                <span className="meter-stat-label">Rolloff</span>
                <span className="meter-stat-val">{(spectralFeatures.rolloff / 1000).toFixed(1)} kHz</span>
              </div>
              <div className="meter-stat">
                <span className="meter-stat-label">Flatness</span>
                <span className="meter-stat-val">{spectralFeatures.flatness.toFixed(3)}</span>
              </div>
              <div className="meter-stat">
                <span className="meter-stat-label">BPM</span>
                <span className="meter-stat-val">{spectralFeatures.bpm?.toFixed(1) ?? '—'}</span>
              </div>
            </div>
          )}
          {loudness.isClipping && (
            <div className="mastering-alert">
              ⚠ CLIPPING DETECTED — true peak above −0.1 dBTP
            </div>
          )}
        </div>
      )}

      {tab === 'tonal' && (
        <div className="mastering-tonal-wrap">
          <TonalBalanceDisplay
            analyser={analyser} isActive={isActive}
            sampleRate={sampleRate} primaryColor={primaryColor} secondaryColor={secondaryColor}
          />
        </div>
      )}

      {tab === 'issues' && (
        <div className="mastering-issues">
          {issues.length === 0 ? (
            <div className="mastering-no-issues" style={{ color: primaryColor }}>
              ✓ No issues detected{isActive ? '' : ' — play audio to analyze'}
            </div>
          ) : (
            issues.map((issue, i) => (
              <div key={i} className={`mastering-issue severity-${issue.severity}`}
                onClick={() => setExpanded(expanded === issue.type + i ? null : issue.type + i)}>
                <div className="issue-header">
                  <span className="issue-icon" style={{ color: SEVERITY_COLOR[issue.severity] }}>
                    {SEVERITY_ICON[issue.severity]}
                  </span>
                  <span className="issue-headline">{issue.headline}</span>
                  <span className="issue-arrow">{expanded === issue.type + i ? '▲' : '▼'}</span>
                </div>
                {expanded === issue.type + i && (
                  <div className="issue-detail">
                    <p>{issue.detail}</p>
                    <p className="issue-suggestion">
                      <span style={{ color: secondaryColor }}>→ </span>{issue.suggestion}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function MeterRow({
  label, value, unit, floor,
  warn = -6, danger = -1,
}: {
  label: string; value: number; unit: string; floor: number; warn?: number; danger?: number
}) {
  const pct = Math.max(0, Math.min(100, ((value - floor) / (-floor)) * 100))
  const color = value >= danger ? '#ff4466' : value >= warn ? '#ffcc44' : '#00e5ff'
  return (
    <div className="mastering-meter-row">
      <span className="mastering-meter-label">{label}</span>
      <div className="mastering-meter-bar-wrap">
        <div className="mastering-meter-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="mastering-meter-val" style={{ color }}>
        {value < floor + 1 ? `< ${floor}` : value.toFixed(1)} {unit}
      </span>
    </div>
  )
}
