import { useState, useCallback, useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useReactStore } from '../../../stores/reactStore'
import type { ReactSectionType, ReactTrackSection } from './ReactTypes'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import type {
  TrackIntelligenceAnalysis,
  BeatMarkerMI,
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

/**
 * Returns a 1-based bar range string ("1–8") for a section, derived from
 * downbeat markers in the beat grid. Returns null when the grid has no
 * downbeats or the section falls outside them.
 */
export function buildBarRange(
  section: { startSec: number; endSec: number },
  beatGrid: BeatMarkerMI[],
): string | null {
  const downbeats = beatGrid.filter(b => b.isDownbeat)
  if (downbeats.length === 0) return null
  const startIdx = downbeats.findIndex(d => d.timeSec >= section.startSec - 0.05)
  if (startIdx < 0) return null
  let endIdx = -1
  for (let i = downbeats.length - 1; i >= startIdx; i--) {
    if (downbeats[i].timeSec < section.endSec) { endIdx = i; break }
  }
  if (endIdx < 0) return null
  return `${startIdx + 1}–${endIdx + 1}`
}

// ── Canvas drawing ─────────────────────────────────────────────────────────────

// Centralized beat/downbeat mark constants so tests and the draw function agree.
export const TRACK_MAP_BEAT_COLOR            = 'rgba(74,199,219,0.45)'
export const TRACK_MAP_DOWNBEAT_COLOR        = 'rgba(97,214,170,0.85)'
export const TRACK_MAP_BEAT_TICK_HEIGHT      = 5    // CSS px
export const TRACK_MAP_DOWNBEAT_TICK_HEIGHT  = 13   // CSS px
export const TRACK_MAP_BEAT_LINE_WIDTH       = 1    // px
export const TRACK_MAP_DOWNBEAT_LINE_WIDTH   = 2    // px

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

/**
 * Draws beat ticks and downbeat ticks onto the beat canvas.
 *
 * Every beat in the grid has exactly one tick. `isDownbeat` on each
 * BeatMarkerMI determines the style: regular beats get a short cyan tick;
 * downbeats get a taller, thicker, brighter tick from the same bottom anchor.
 *
 * When `effective` is supplied (manual BPM override active), `effective.beatGrid`
 * replaces `analysis.beatGrid` for all tick rendering so that regular beats and
 * downbeats originate from the same grid. `effective.downbeats` is ignored —
 * downbeat status is read from `beat.isDownbeat` directly.
 *
 * Section data (`analysis.sections`) is intentionally not rendered here.
 * Proportional section regions (backgrounds, labels, and boundaries) will be
 * drawn by a dedicated section-region overlay layer added in a future task.
 * Passing `effective` never mutates `analysis`.
 */
export function drawBeatCanvas(
  canvas:   HTMLCanvasElement,
  analysis: TrackIntelligenceAnalysis,
  effective?: { beatGrid: BeatMarkerMI[]; downbeats?: BeatMarkerMI[] },
): void {
  const ctx = setupCanvas(canvas)
  if (!ctx) return
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  const durationSec = analysis.durationMs / 1000
  if (durationSec <= 0) return
  ctx.clearRect(0, 0, w, h)

  // isDownbeat is set on every BeatMarkerMI; the separate downbeats array is unused.
  const beatGrid = effective?.beatGrid ?? analysis.beatGrid

  // Regular beats — bottom-anchored ruler marks.
  // Half-pixel x offset (+0.5) keeps 1 px strokes crisp on all DPR values.
  ctx.beginPath()
  for (const beat of beatGrid) {
    if (beat.isDownbeat) continue
    const x = Math.floor((beat.timeSec / durationSec) * w) + 0.5
    ctx.moveTo(x, h)
    ctx.lineTo(x, h - TRACK_MAP_BEAT_TICK_HEIGHT)
  }
  ctx.strokeStyle = TRACK_MAP_BEAT_COLOR
  ctx.lineWidth   = TRACK_MAP_BEAT_LINE_WIDTH
  ctx.stroke()

  // Downbeat ticks — same bottom anchor, taller + thicker + brighter.
  // Drawn in a separate pass so lineWidth/strokeStyle differ per category
  // without any duplicate stroke at the same x-position.
  ctx.beginPath()
  for (const beat of beatGrid) {
    if (!beat.isDownbeat) continue
    const x = Math.floor((beat.timeSec / durationSec) * w) + 0.5
    ctx.moveTo(x, h)
    ctx.lineTo(x, h - TRACK_MAP_DOWNBEAT_TICK_HEIGHT)
  }
  ctx.strokeStyle = TRACK_MAP_DOWNBEAT_COLOR
  ctx.lineWidth   = TRACK_MAP_DOWNBEAT_LINE_WIDTH
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

// ── SectionTimeline ───────────────────────────────────────────────────────────

interface SectionTimelineProps {
  sections:    ReactTrackSection[]
  durationSec: number
  beatGrid?:   BeatMarkerMI[]
  selectedId:  string | null
  onSelect:    (id: string) => void
  onRemove?:   (id: string) => void
}

function SectionTimeline({
  sections, durationSec, beatGrid, selectedId, onSelect, onRemove,
}: SectionTimelineProps) {
  if (durationSec <= 0) return null

  const valid = sections
    .filter(s => s.endSec > s.startSec && s.startSec < durationSec && s.endSec > 0)
    .map(s => ({ ...s, startSec: Math.max(0, s.startSec), endSec: Math.min(durationSec, s.endSec) }))
    .sort((a, b) => a.startSec - b.startSec)

  if (valid.length === 0) return null

  return (
    <div className="rv-section-timeline" aria-label="Section timeline">
      {valid.map((section, i) => {
        const leftPct    = (section.startSec / durationSec) * 100
        const widthPct   = ((section.endSec - section.startSec) / durationSec) * 100
        const color      = SECTION_COLORS[section.type] ?? '#6a7a8a'
        const barRange   = beatGrid ? buildBarRange(section, beatGrid) : null
        const isSelected = selectedId === section.id
        const src        = section.source
        const isUser     = src === 'manual' || src === 'user-created' || src === 'user-edited-auto' || src == null

        return (
          <div
            key={section.id}
            className={`rv-section-region${isSelected ? ' rv-section-region--selected' : ''}`}
            style={{ left: `${leftPct}%`, width: `${widthPct}%`, '--section-color': color } as React.CSSProperties}
            role="button"
            tabIndex={0}
            aria-label={`Section ${section.label}, ${formatTime(section.startSec)} to ${formatTime(section.endSec)}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(section.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(section.id) } }}
          >
            <div className="rv-section-body-tint" style={{ background: color }} />
            <div className="rv-section-header" style={{ background: color }}>
              <span className="rv-section-label">{section.label.toUpperCase()}</span>
              {barRange && <span className="rv-section-barrange">{barRange}</span>}
            </div>
            {onRemove && isUser && (
              <button
                className="rv-section-region-remove"
                onClick={e => { e.stopPropagation(); onRemove(section.id) }}
                title="Remove section"
                aria-label={`Remove section ${section.label}`}
              >×</button>
            )}
          </div>
        )
      })}

      {/* Diamond boundary markers between adjacent sections */}
      {valid.map((section, i) => {
        if (i === 0) return null
        const pct = (section.startSec / durationSec) * 100
        return (
          <div
            key={`bd-${section.id}`}
            className="rv-section-boundary"
            style={{ left: `${pct}%` }}
            aria-hidden="true"
          >
            <div className="rv-section-boundary-diamond" />
          </div>
        )
      })}
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
    source,
    currentTrack,
    currentAnalysis,
    currentAnalysisStatus,
    currentAnalysisError,
    currentKey,
    currentEffectiveBpm,
    currentAnalyzedBpm,
    currentBpmSource,
    currentBpmConfidence,
    currentEffectiveBeatGrid,
    retryAnalysis,
    reanalyzeTrack,
    getCurrentTime,
  } = engine

  const {
    manualTrackSectionsByTrackId,
    selectedSectionId,
    setSelectedSectionId,
    addManualSection,
    removeManualSection,
  } = useReactStore(useShallow(s => ({
    manualTrackSectionsByTrackId: s.manualTrackSectionsByTrackId,
    selectedSectionId:            s.selectedSectionId,
    setSelectedSectionId:         s.setSelectedSectionId,
    addManualSection:             s.addManualSection,
    removeManualSection:          s.removeManualSection,
  })))

  const [collapsed,      setCollapsed]      = useState(true)
  const [isAdding,       setIsAdding]       = useState(false)
  const [energyCurveKey, setEnergyCurveKey] = useState<EnergyCurveKey>('shortTerm')
  const [drawTick,       setDrawTick]       = useState(0)

  const beatCanvasRef   = useRef<HTMLCanvasElement>(null)
  const energyCanvasRef = useRef<HTMLCanvasElement>(null)
  const playheadRef     = useRef<HTMLDivElement>(null)
  const rafRef          = useRef<number | null>(null)

  // Active track ID — used as the per-track sections key
  const activeTrackId = currentTrack?.id ?? null

  // Per-track manual sections for the active track only
  const manualTrackSections = activeTrackId
    ? (manualTrackSectionsByTrackId[activeTrackId] ?? [])
    : []

  // Derived
  const hasTrack   = currentTrack != null
  const isWorking  = isActivelyWorking(currentAnalysisStatus)
  const isComplete = currentAnalysisStatus === 'complete' && currentAnalysis != null
  const durationSec = currentAnalysis ? currentAnalysis.durationMs / 1000 : audioDurationSec

  const autoSections: ReactTrackSection[] = isComplete
    ? adaptMIAnalysis(currentAnalysis!)
    : []

  const resolvedSections = resolveTrackSections({
    analyzedSections: autoSections,
    manualSections:   manualTrackSections,
    durationSec,
  })

  const keyLabel = currentKey ? buildKeyLabel(currentKey) : null

  // Redraw canvases on window resize
  useEffect(() => {
    const handler = () => setDrawTick(t => t + 1)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Beat canvas — redraws when analysis, effective override, or collapse state changes.
  // When a manual BPM override is active, currentEffectiveBeatGrid contains the
  // regenerated markers; we pass them as `effective` so the canvas reflects the
  // override BPM without mutating or replacing the original analysis object.
  useEffect(() => {
    const canvas = beatCanvasRef.current
    if (!canvas) return
    if (!isComplete || !currentAnalysis) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    const effective = currentEffectiveBeatGrid
      ? { beatGrid: currentEffectiveBeatGrid }
      : undefined
    drawBeatCanvas(canvas, currentAnalysis, effective)
  }, [isComplete, currentAnalysis, currentEffectiveBeatGrid, drawTick, collapsed])

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
  }, [isComplete, currentAnalysis, energyCurveKey, durationSec, drawTick, collapsed])

  // ── Playhead RAF loop ──────────────────────────────────────────────────────
  // Updates an absolutely-positioned div to track the current audio position.
  // Reads getCurrentTime() directly (no React state) so it never causes re-renders.
  useEffect(() => {
    const playhead = playheadRef.current
    if (!playhead || !isComplete || durationSec <= 0) {
      if (playhead) playhead.style.display = 'none'
      return
    }
    playhead.style.display = 'block'

    const tick = () => {
      const t = getCurrentTime()
      const pct = Math.max(0, Math.min(1, t / durationSec))
      playhead.style.left = `${pct * 100}%`
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [isComplete, durationSec, getCurrentTime])

  const handleRetry = useCallback(() => {
    if (currentTrack) retryAnalysis(currentTrack.id)
  }, [currentTrack, retryAnalysis])

  const handleReanalyze = useCallback(() => {
    if (currentTrack && reanalyzeTrack) reanalyzeTrack(currentTrack.id)
  }, [currentTrack, reanalyzeTrack])

  const handleAdd = (section: ReactTrackSection) => {
    if (activeTrackId) addManualSection(activeTrackId, section)
    setIsAdding(false)
  }

  const handleRemove = (id: string) => {
    if (activeTrackId) removeManualSection(activeTrackId, id)
  }

  // ── BPM display logic ──────────────────────────────────────────────────────
  const isMicSource = source === 'microphone'
  const hasOverride = currentBpmSource === 'manual_override'

  let bpmDisplay: React.ReactNode = null
  if (isMicSource) {
    bpmDisplay = <span className="rv-meta-bpm rv-meta-bpm--unavailable">Live BPM unavailable</span>
  } else if (currentEffectiveBpm != null) {
    bpmDisplay = (
      <span className="rv-meta-bpm">
        {currentEffectiveBpm.toFixed(1)} BPM
        {currentBpmConfidence != null && (
          <span className="rv-meta-bpm-conf" title="BPM confidence">
            {' '}({Math.round(currentBpmConfidence * 100)}%)
          </span>
        )}
        {hasOverride && currentAnalyzedBpm != null && (
          <span className="rv-meta-bpm-analyzed" title="Original analyzed BPM">
            {' · '}analyzed: {currentAnalyzedBpm.toFixed(1)}
          </span>
        )}
      </span>
    )
  } else if (isComplete) {
    bpmDisplay = <span className="rv-meta-bpm rv-meta-bpm--unavailable">BPM N/A</span>
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
        <svg width="14" height="14" viewBox="0 0 512 512" fill="#38bdf8" style={{ flexShrink: 0 }}>
          <path d="M29.002,0v368.238L256.002,512l226.996-143.762V0H29.002z M379.593,247.561H287.92v91.659h-63.836v-91.659h-91.673v-63.843h91.673v-91.68h63.836v91.68h91.673V247.561z"/>
        </svg>
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
        {(isComplete || isMicSource) && (
          <span className="rv-strip-header-meta">
            {bpmDisplay}
            {keyLabel && <span className="rv-meta-key">{keyLabel}</span>}
          </span>
        )}
        <span className="rv-collapse-arrow">{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <>
          {/* Section type legend */}
          {isComplete && (
            <div className="rv-strip-meta-row">
              <div className="rv-strip-type-legend">
                {SECTION_ORDER.filter(t => t !== 'unknown').map(t => (
                  <span key={t} className="rv-legend-item" style={{ color: SECTION_COLORS[t] }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Beat grid canvas + playhead */}
          {isComplete && (
            <div className="rv-beat-canvas-wrap" style={{ position: 'relative' }}>
              <canvas ref={beatCanvasRef} className="rv-beat-canvas" aria-hidden="true" />
              {/* Playhead — moved by RAF, not React state */}
              <div
                ref={playheadRef}
                className="rv-playhead"
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '0%',
                  width: 2,
                  height: '100%',
                  background: 'rgba(255,255,255,0.85)',
                  pointerEvents: 'none',
                  display: 'none',
                }}
              />
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

          {/* Unified proportional section timeline */}
          <div className="rv-section-group">
            <div className="rv-section-group-header">
              <span className="rv-section-group-label">Sections</span>
              <div className="rv-section-group-actions">
                {/* Reanalyze bypasses cache; Retry only re-queues and may use cache */}
                {isComplete && (
                  <button
                    className="rv-reanalyze-btn"
                    onClick={handleReanalyze}
                    title="Force fresh analysis, bypassing cache"
                  >
                    ↺ Reanalyze
                  </button>
                )}
                <button
                  className="rv-add-section-btn"
                  onClick={() => setIsAdding(v => !v)}
                  title="Add a manual section"
                  disabled={!activeTrackId}
                >
                  {isAdding ? '✕ Cancel' : '+ Add'}
                </button>
              </div>
            </div>

            {isAdding && (
              <AddSectionForm onAdd={handleAdd} onCancel={() => setIsAdding(false)} />
            )}

            {resolvedSections.length > 0 ? (
              <SectionTimeline
                sections={resolvedSections}
                durationSec={durationSec}
                beatGrid={currentEffectiveBeatGrid ?? currentAnalysis?.beatGrid ?? undefined}
                selectedId={selectedSectionId}
                onSelect={setSelectedSectionId}
                onRemove={activeTrackId ? handleRemove : undefined}
              />
            ) : (
              <div className="rv-section-group-empty">
                {activeTrackId
                  ? <>No sections yet — hit <strong>+ Add</strong> to create one.</>
                  : 'Load a track to add sections.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
