import { useState, useCallback, useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useReactStore } from '../../../stores/reactStore'
import type { ReactSectionType, ReactTrackSection } from './ReactTypes'
import { adaptMIAnalysis } from '../../../features/trackIntelligence/trackMapAdapter'
import type {
  TrackIntelligenceAnalysis,
  FeatureCurve,
  TrackAnalysisStatus,
} from '../../../features/musicIntelligence/types'

// ── Section display metadata ───────────────────────────────────────────────────

const SECTION_COLORS: Record<ReactSectionType, string> = {
  intro:     '#61d6aa',
  verse:     '#4ac7db',
  build:     '#d8b95a',
  preDrop:   '#f0a060',
  drop:      '#c0314a',
  breakdown: '#b84fc9',
  bridge:    '#5b8def',
  outro:     '#80dfc0',
  unknown:   '#6a7a8a',
}

const SECTION_ORDER: ReactSectionType[] = [
  'intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown',
]

const STATUS_LABELS: Record<TrackAnalysisStatus, string> = {
  not_analyzed: 'Not analyzed',
  queued:       'Queued',
  decoding:     'Decoding…',
  analyzing:    'Analyzing…',
  complete:     'Complete',
  failed:       'Failed',
}

const STATUS_COLORS: Record<TrackAnalysisStatus, string> = {
  not_analyzed: '#6a7a8a',
  queued:       '#d8b95a',
  decoding:     '#4ac7db',
  analyzing:    '#4ac7db',
  complete:     '#61d6aa',
  failed:       '#c0314a',
}

// ── Energy curve options ──────────────────────────────────────────────────────

export type EnergyCurveKey = 'shortTerm' | 'instant' | 'bass' | 'mid' | 'high'

export const ENERGY_CURVE_OPTIONS: { key: EnergyCurveKey; label: string; color: string }[] = [
  { key: 'shortTerm', label: 'Energy',  color: '#4ac7db' },
  { key: 'instant',   label: 'Instant', color: '#61d6aa' },
  { key: 'bass',      label: 'Bass',    color: '#c0314a' },
  { key: 'mid',       label: 'Mid',     color: '#d8b95a' },
  { key: 'high',      label: 'High',    color: '#b84fc9' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function isActivelyWorking(status: TrackAnalysisStatus): boolean {
  return status === 'queued' || status === 'decoding' || status === 'analyzing'
}

export function buildKeyLabel(key: { tonic: string; mode: string; confidence?: number }): string {
  const conf = key.confidence != null ? ` (${Math.round(key.confidence * 100)}%)` : ''
  return `${key.tonic} ${key.mode}${conf}`
}

// ── Canvas drawing ─────────────────────────────────────────────────────────────

function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1
  const w   = canvas.offsetWidth
  const h   = canvas.offsetHeight
  if (w === 0 || h === 0) return null
  canvas.width  = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.scale(dpr, dpr)
  return ctx
}

export function drawBeatCanvas(
  canvas: HTMLCanvasElement,
  analysis: TrackIntelligenceAnalysis,
): void {
  const ctx = setupCanvas(canvas)
  if (!ctx) return
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  const durationSec = analysis.durationMs / 1000
  if (durationSec <= 0) return
  ctx.clearRect(0, 0, w, h)

  // Beat ticks — lower half, thin
  ctx.beginPath()
  for (const beat of analysis.beatGrid) {
    if (beat.isDownbeat) continue
    const x = Math.round((beat.timeSec / durationSec) * w)
    ctx.moveTo(x, h * 0.5)
    ctx.lineTo(x, h)
  }
  ctx.strokeStyle = 'rgba(74,199,219,0.35)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Downbeats — full height, brighter
  ctx.beginPath()
  for (const beat of analysis.downbeats) {
    const x = Math.round((beat.timeSec / durationSec) * w)
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  ctx.strokeStyle = 'rgba(97,214,170,0.65)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Section boundaries — gold accent
  ctx.beginPath()
  for (const sec of analysis.sections) {
    const x = Math.round((sec.startSec / durationSec) * w)
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  ctx.strokeStyle = 'rgba(216,185,90,0.55)'
  ctx.lineWidth = 2
  ctx.stroke()
}

export function drawEnergyCanvas(
  canvas: HTMLCanvasElement,
  curve: FeatureCurve,
  durationSec: number,
  color: string,
): void {
  const ctx = setupCanvas(canvas)
  if (!ctx || curve.length < 2 || durationSec <= 0) return
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  ctx.clearRect(0, 0, w, h)

  ctx.beginPath()
  ctx.moveTo(0, h)
  for (const pt of curve) {
    ctx.lineTo((pt.timeSec / durationSec) * w, h - pt.value * (h - 1))
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fillStyle = color + '28'
  ctx.fill()

  ctx.beginPath()
  let first = true
  for (const pt of curve) {
    const x = (pt.timeSec / durationSec) * w
    const y = h - pt.value * (h - 1)
    if (first) { ctx.moveTo(x, y); first = false }
    else        ctx.lineTo(x, y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
}

// ── AddSectionForm ────────────────────────────────────────────────────────────

interface AddSectionFormProps {
  onAdd:    (section: ReactTrackSection) => void
  onCancel: () => void
}

function AddSectionForm({ onAdd, onCancel }: AddSectionFormProps) {
  const [type,      setType]      = useState<ReactSectionType>('intro')
  const [label,     setLabel]     = useState('')
  const [startSec,  setStartSec]  = useState(0)
  const [endSec,    setEndSec]    = useState(30)
  const [intensity, setIntensity] = useState(0.7)

  const handleAdd = () => {
    onAdd({
      id:        `section-${Date.now()}`,
      label:     label.trim() || type.charAt(0).toUpperCase() + type.slice(1),
      type,
      startSec,
      endSec,
      intensity,
      source:    'user-created',
    })
  }

  return (
    <div className="rv-add-section-form">
      <div className="rv-form-row">
        <label className="rv-form-label">Type</label>
        <select
          className="rv-form-select"
          value={type}
          onChange={e => setType(e.target.value as ReactSectionType)}
        >
          {SECTION_ORDER.map(t => (
            <option key={t} value={t} style={{ color: SECTION_COLORS[t] }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label">Label</label>
        <input
          className="rv-form-input"
          type="text"
          placeholder="Section name…"
          value={label}
          onChange={e => setLabel(e.target.value)}
          maxLength={32}
        />
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label">Start (s)</label>
        <input
          className="rv-form-input rv-form-input--num"
          type="number"
          min={0} step={1}
          value={startSec}
          onChange={e => setStartSec(Math.max(0, parseFloat(e.target.value) || 0))}
        />
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label">End (s)</label>
        <input
          className="rv-form-input rv-form-input--num"
          type="number"
          min={0} step={1}
          value={endSec}
          onChange={e => setEndSec(Math.max(0, parseFloat(e.target.value) || 0))}
        />
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label">Intensity</label>
        <input
          className="rv-form-range"
          type="range"
          min={0} max={1} step={0.05}
          value={intensity}
          onChange={e => setIntensity(parseFloat(e.target.value))}
        />
        <span className="rv-form-val">{Math.round(intensity * 100)}%</span>
      </div>
      <div className="rv-form-actions">
        <button className="rv-form-cancel-btn" onClick={onCancel}>Cancel</button>
        <button
          className="rv-form-add-btn"
          onClick={handleAdd}
          disabled={endSec <= startSec}
        >
          Add Section
        </button>
      </div>
    </div>
  )
}

// ── SectionChip ───────────────────────────────────────────────────────────────

interface SectionChipProps {
  section:    ReactTrackSection
  isSelected: boolean
  onSelect:   (id: string) => void
  onRemove?:  (id: string) => void
}

function SectionChip({ section, isSelected, onSelect, onRemove }: SectionChipProps) {
  const color      = SECTION_COLORS[section.type] ?? '#6a7a8a'
  const src        = section.source
  const isUserSect = src === 'manual' || src === 'user-created' || src === 'user-edited-auto' || src == null
  const confidence = section.confidence

  return (
    <div
      className={`rv-section-chip${isSelected ? ' rv-section-chip--selected' : ''}${isUserSect ? ' rv-section-chip--manual' : ''}`}
      style={{ '--section-color': color } as React.CSSProperties}
      onClick={() => onSelect(section.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onSelect(section.id) }}
    >
      <div className="rv-chip-stripe" style={{ background: color }} />
      <div className="rv-chip-body">
        <span className="rv-chip-label">{section.label}</span>
        <span className="rv-chip-type" style={{ color }}>{section.type}</span>
        <span className="rv-chip-time">
          {formatTime(section.startSec)} – {formatTime(section.endSec)}
        </span>
        <div
          className="rv-chip-intensity-bar"
          style={{ width: `${section.intensity * 100}%`, background: color + '80' }}
        />
        {confidence != null && confidence < 1 && (
          <span className="rv-chip-confidence" title="Analysis confidence">
            {Math.round(confidence * 100)}%
          </span>
        )}
        {src === 'user-edited-auto' && (
          <span className="rv-chip-source-badge rv-chip-source-badge--edited">edited</span>
        )}
        {(src === 'manual' || src === 'user-created') && (
          <span className="rv-chip-source-badge rv-chip-source-badge--manual">manual</span>
        )}
      </div>
      {onRemove && (
        <button
          className="rv-chip-remove"
          onClick={e => { e.stopPropagation(); onRemove(section.id) }}
          title="Remove section"
        >×</button>
      )}
    </div>
  )
}

// ── ReactTrackMapStrip ────────────────────────────────────────────────────────

interface ReactTrackMapStripProps {
  /** Fallback duration when no analysis is available yet. */
  audioDurationSec?: number
}

export function ReactTrackMapStrip({ audioDurationSec = 180 }: ReactTrackMapStripProps) {
  const engine = useSharedAudio()
  const {
    currentTrack,
    currentAnalysis,
    currentAnalysisStatus,
    currentAnalysisError,
    currentKey,
    retryAnalysis,
  } = engine

  const {
    manualTrackSections,
    selectedSectionId,
    setSelectedSectionId,
    addManualSection,
    removeManualSection,
  } = useReactStore(useShallow(s => ({
    manualTrackSections:  s.manualTrackSections,
    selectedSectionId:    s.selectedSectionId,
    setSelectedSectionId: s.setSelectedSectionId,
    addManualSection:     s.addManualSection,
    removeManualSection:  s.removeManualSection,
  })))

  const [collapsed,      setCollapsed]      = useState(false)
  const [isAdding,       setIsAdding]       = useState(false)
  const [energyCurveKey, setEnergyCurveKey] = useState<EnergyCurveKey>('shortTerm')
  const [drawTick,       setDrawTick]       = useState(0)

  const beatCanvasRef   = useRef<HTMLCanvasElement>(null)
  const energyCanvasRef = useRef<HTMLCanvasElement>(null)

  // Derived
  const hasTrack   = currentTrack != null
  const isWorking  = isActivelyWorking(currentAnalysisStatus)
  const isComplete = currentAnalysisStatus === 'complete' && currentAnalysis != null
  const durationSec = currentAnalysis ? currentAnalysis.durationMs / 1000 : audioDurationSec

  const autoSections: ReactTrackSection[] = isComplete
    ? adaptMIAnalysis(currentAnalysis!)
    : []

  const keyLabel = currentKey ? buildKeyLabel(currentKey) : null

  // Redraw canvases on window resize
  useEffect(() => {
    const handler = () => setDrawTick(t => t + 1)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Beat canvas — redraws when analysis or status changes
  useEffect(() => {
    const canvas = beatCanvasRef.current
    if (!canvas) return
    if (!isComplete || !currentAnalysis) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    drawBeatCanvas(canvas, currentAnalysis)
  }, [isComplete, currentAnalysis, drawTick])

  // Energy canvas — redraws when analysis, curve selection, or status changes
  useEffect(() => {
    const canvas = energyCanvasRef.current
    if (!canvas) return
    if (!isComplete || !currentAnalysis) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    const opt = ENERGY_CURVE_OPTIONS.find(o => o.key === energyCurveKey)!
    drawEnergyCanvas(canvas, currentAnalysis.energyCurves[energyCurveKey], durationSec, opt.color)
  }, [isComplete, currentAnalysis, energyCurveKey, durationSec, drawTick])

  const handleRetry = useCallback(() => {
    if (currentTrack) retryAnalysis(currentTrack.id)
  }, [currentTrack, retryAnalysis])

  const handleAdd = (section: ReactTrackSection) => {
    addManualSection(section)
    setIsAdding(false)
  }

  return (
    <div className="rv-track-map-strip">
      <div
        className="rv-strip-header rv-strip-header--toggle"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(v => !v)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(v => !v) }
        }}
      >
        <span className="rv-strip-title">Track Map</span>
        {hasTrack && currentAnalysisStatus !== 'not_analyzed' && (
          <span
            className="rv-strip-status-dot"
            style={{ color: STATUS_COLORS[currentAnalysisStatus] }}
            title={STATUS_LABELS[currentAnalysisStatus]}
          >
            {isWorking ? '◌' : currentAnalysisStatus === 'failed' ? '✕' : '●'}
          </span>
        )}
        <span className="rv-collapse-arrow">{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <>
          {/* Metadata: BPM, key, legend */}
          {isComplete && currentAnalysis && (
            <div className="rv-strip-meta-row">
              <span className="rv-meta-bpm">{currentAnalysis.bpm.toFixed(1)} BPM</span>
              {keyLabel && <span className="rv-meta-key">{keyLabel}</span>}
              <div className="rv-strip-type-legend">
                {SECTION_ORDER.filter(t => t !== 'unknown').map(t => (
                  <span key={t} className="rv-legend-item" style={{ color: SECTION_COLORS[t] }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Beat grid canvas */}
          {isComplete && (
            <div className="rv-beat-canvas-wrap">
              <canvas ref={beatCanvasRef} className="rv-beat-canvas" aria-hidden="true" />
            </div>
          )}

          {/* Energy curve + selector */}
          {isComplete && (
            <div className="rv-energy-row">
              <canvas ref={energyCanvasRef} className="rv-energy-canvas" aria-hidden="true" />
              <select
                className="rv-energy-select"
                value={energyCurveKey}
                onChange={e => setEnergyCurveKey(e.target.value as EnergyCurveKey)}
                title="Energy curve"
              >
                {ENERGY_CURVE_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* States: no track, analyzing, failed */}
          {!hasTrack && (
            <div className="rv-strip-empty">No track loaded.</div>
          )}
          {hasTrack && isWorking && (
            <div className="rv-strip-analyzing">
              <span className="rv-analyzing-spinner">◌</span>
              <span>{STATUS_LABELS[currentAnalysisStatus]}</span>
            </div>
          )}
          {hasTrack && currentAnalysisStatus === 'failed' && (
            <div className="rv-strip-failed">
              <span className="rv-failed-icon">✕</span>
              <span className="rv-failed-message">
                {currentAnalysisError ?? 'Analysis failed'}
              </span>
              <button className="rv-retry-btn" onClick={handleRetry} title="Retry analysis">
                ↺ Retry
              </button>
            </div>
          )}

          {/* Auto sections — read-only, sourced from coordinator analysis */}
          {autoSections.length > 0 && (
            <div className="rv-section-group">
              <div className="rv-section-group-header">
                <span className="rv-section-group-label">Analyzed</span>
                <button
                  className="rv-reanalyze-btn"
                  onClick={handleRetry}
                  title="Re-run analysis on this track"
                >
                  ↺ Reanalyze
                </button>
              </div>
              <div className="rv-section-list">
                {autoSections.map(section => (
                  <SectionChip
                    key={section.id}
                    section={section}
                    isSelected={selectedSectionId === section.id}
                    onSelect={setSelectedSectionId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Manual sections — user-authored */}
          <div className="rv-section-group">
            <div className="rv-section-group-header">
              <span className="rv-section-group-label">My Sections</span>
              <button
                className="rv-add-section-btn"
                onClick={() => setIsAdding(v => !v)}
                title="Add a manual section"
              >
                {isAdding ? '✕ Cancel' : '+ Add'}
              </button>
            </div>

            {isAdding && (
              <AddSectionForm onAdd={handleAdd} onCancel={() => setIsAdding(false)} />
            )}

            {manualTrackSections.length === 0 && !isAdding ? (
              <div className="rv-section-group-empty">
                No user sections — hit <strong>+ Add</strong> to create one.
              </div>
            ) : (
              <div className="rv-section-list">
                {manualTrackSections.map(section => (
                  <SectionChip
                    key={section.id}
                    section={section}
                    isSelected={selectedSectionId === section.id}
                    onSelect={setSelectedSectionId}
                    onRemove={removeManualSection}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
