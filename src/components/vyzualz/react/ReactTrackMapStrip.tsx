import { forwardRef, useState, useCallback, useRef, useEffect, useId, useImperativeHandle, useMemo, type MutableRefObject } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useReactStore } from '../../../stores/reactStore'
import { useVisualStore } from '../../../stores/visualStore'
import type { ReactPreset, ReactSectionType, ReactTrackSection } from './ReactTypes'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import {
  computeMinDuration,
  computeKeyStep,
  pointerXToTime,
  snapToNearestBeat,
  findSharedBoundaryNeighbor,
  clampEdge,
  type SectionEdge,
  type SectionBoundaryDragState,
} from '../../../features/trackIntelligence/sectionBoundaryDrag'
import {
  computeWaveformViewport,
  computeViewportRangeLayout,
  isFinitePositiveDuration,
  resolvePositiveDuration,
  timeToViewportRatio,
  type TimelineViewport,
} from '../../../features/timeline/timelineViewport'
import type {
  TrackIntelligenceAnalysis,
  BeatMarkerMI,
  FeatureCurve,
  TrackAnalysisStatus,
} from '../../../features/musicIntelligence/types'
import { applyCanvasResolution, resolveCanvasResolution } from './rendering/canvasResolution'
import { isSelectableReactEngineId, REACT_ENGINE_CATALOG } from './reactEngineCatalog'

// ── Engine display labels ─────────────────────────────────────────────────────

// ── Preset-cue helpers (exported for tests) ───────────────────────────────────

/** Returns the stable cue ID for a section's preset assignment (one cue per section). */
export function buildPresetCueId(sectionId: string): string {
  return `section-preset:${sectionId}`
}

/** Returns a human-readable cue label, e.g. "Drop → Energy Cloud". */
export function buildPresetCueLabel(sectionLabel: string, presetName: string): string {
  return `${sectionLabel} → ${presetName}`
}

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

// Keep the energy implementation available while the lane is intentionally
// hidden from the Track Map UI. Re-enable it here without rebuilding the lane.
const SHOW_ENERGY_LANE = false

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Full-precision time string for drag tooltips, e.g. "01:23.450". */
export function formatTimePrecise(secs: number): string {
  const m  = Math.floor(secs / 60)
  const s  = Math.floor(secs % 60)
  const ms = Math.round((secs % 1) * 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
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

// Centralized beat-grid and ruler constants so tests and the draw functions agree.
export const TRACK_MAP_BEAT_COLOR             = 'rgba(74,199,219,0.45)'
export const TRACK_MAP_DOWNBEAT_COLOR         = 'rgba(97,214,170,0.85)'
export const TRACK_MAP_FOUR_BAR_COLOR         = 'rgba(192,49,74,0.96)'
export const TRACK_MAP_BEAT_TICK_HEIGHT       = 5    // CSS px
export const TRACK_MAP_DOWNBEAT_TICK_HEIGHT   = 13   // CSS px
export const TRACK_MAP_FOUR_BAR_TICK_HEIGHT   = 20   // CSS px
export const TRACK_MAP_BEAT_LINE_WIDTH        = 1    // px
export const TRACK_MAP_DOWNBEAT_LINE_WIDTH    = 2    // px
export const TRACK_MAP_FOUR_BAR_LINE_WIDTH    = 2    // px
export const TRACK_MAP_RULER_FONT_SIZE        = 10   // CSS px

function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const resolution = resolveCanvasResolution({
    cssWidth: canvas.offsetWidth,
    cssHeight: canvas.offsetHeight,
    devicePixelRatio: window.devicePixelRatio,
    quality: 'high',
  })
  if (!resolution.valid) return null

  applyCanvasResolution(canvas, resolution)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.setTransform(resolution.effectiveDpr, 0, 0, resolution.effectiveDpr, 0, 0)
  }
  return ctx
}

/**
 * Returns the minimum stride to draw so adjacent regular beat ticks stay at
 * least `minGapPx` pixels apart. Always ≥ 1.
 */
export function computeBeatStride(regularBeatCount: number, canvasWidth: number, minGapPx = 3): number {
  if (regularBeatCount <= 0 || canvasWidth <= 0) return 1
  const pxPerBeat = canvasWidth / regularBeatCount
  return pxPerBeat < minGapPx ? Math.max(1, Math.ceil(minGapPx / pxPerBeat)) : 1
}

/**
 * Draws beat ticks and downbeat ticks onto the beat canvas.
 *
 * Every beat in the grid has exactly one tick. `isDownbeat` on each
 * BeatMarkerMI determines the style: regular beats get a short cyan tick;
 * downbeats get a taller green tick; and every fourth bar boundary gets the
 * tallest red tick. All ticks share the same top anchor so the beat grid reads
 * from the top edge of its lane.
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
  canvas:    HTMLCanvasElement,
  analysis:  TrackIntelligenceAnalysis,
  effective?: { beatGrid: BeatMarkerMI[]; downbeats?: BeatMarkerMI[] },
  viewport?:  TimelineViewport,
): void {
  const ctx = setupCanvas(canvas)
  if (!ctx) return
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  const durationSec = analysis.durationMs / 1000
  if (!isFinitePositiveDuration(durationSec)) return
  ctx.clearRect(0, 0, w, h)

  const vpStart = viewport?.startSec ?? 0
  const vpEnd   = viewport?.endSec   ?? durationSec
  const vpDur   = vpEnd - vpStart

  // isDownbeat is set on every BeatMarkerMI; the separate downbeats array is unused.
  // Filter out any beats with non-finite timestamps so bad data can't crash layout.
  const rawGrid  = effective?.beatGrid ?? analysis.beatGrid
  const allBeats = rawGrid.filter(b => isFinite(b.timeSec) && b.timeSec >= 0)

  // Promote every fourth downbeat to a four-bar marker. Build this set from the
  // full grid before viewport filtering so zooming or panning does not reset
  // the four-bar cadence at the left edge of the visible range.
  const fourBarDownbeats = new Set(
    allBeats
      .filter(beat => beat.isDownbeat)
      .filter((_, downbeatIndex) => (downbeatIndex + 1) % 4 === 0),
  )

  // Only draw beats within the visible viewport (plus one tolerance beat on each side).
  const beatGrid = allBeats.filter(b => b.timeSec >= vpStart - 0.01 && b.timeSec <= vpEnd + 0.01)

  // Density reduction: when beats are so close together they would overlap,
  // skip intermediate regular beats so ticks stay at least ~3 px apart.
  // Downbeats are always drawn regardless.
  const regularBeats = beatGrid.filter(b => !b.isDownbeat)
  const stride = computeBeatStride(regularBeats.length, w)

  const timeToX = (t: number) => Math.floor(((t - vpStart) / vpDur) * w) + 0.5

  // Regular beats — short top-anchored ruler marks.
  // Half-pixel x offset (+0.5) keeps 1 px strokes crisp on all DPR values.
  ctx.beginPath()
  let beatIdx = 0
  for (const beat of beatGrid) {
    if (beat.isDownbeat) continue
    if (beatIdx % stride === 0) {
      const x = timeToX(beat.timeSec)
      ctx.moveTo(x, 0)
      ctx.lineTo(x, Math.min(h, TRACK_MAP_BEAT_TICK_HEIGHT))
    }
    beatIdx++
  }
  ctx.strokeStyle = TRACK_MAP_BEAT_COLOR
  ctx.lineWidth   = TRACK_MAP_BEAT_LINE_WIDTH
  ctx.stroke()

  // Downbeat ticks — same top anchor, taller + thicker + brighter. Four-bar
  // boundaries are excluded here so each beat still renders exactly once.
  // Drawn in a separate pass so lineWidth/strokeStyle differ per category
  // without any duplicate stroke at the same x-position.
  ctx.beginPath()
  for (const beat of beatGrid) {
    if (!beat.isDownbeat || fourBarDownbeats.has(beat)) continue
    const x = timeToX(beat.timeSec)
    ctx.moveTo(x, 0)
    ctx.lineTo(x, Math.min(h, TRACK_MAP_DOWNBEAT_TICK_HEIGHT))
  }
  ctx.strokeStyle = TRACK_MAP_DOWNBEAT_COLOR
  ctx.lineWidth   = TRACK_MAP_DOWNBEAT_LINE_WIDTH
  ctx.stroke()

  // Four-bar boundaries — the strongest visual divider in the beat lane.
  ctx.beginPath()
  for (const beat of beatGrid) {
    if (!fourBarDownbeats.has(beat)) continue
    const x = timeToX(beat.timeSec)
    ctx.moveTo(x, 0)
    ctx.lineTo(x, Math.min(h, TRACK_MAP_FOUR_BAR_TICK_HEIGHT))
  }
  ctx.strokeStyle = TRACK_MAP_FOUR_BAR_COLOR
  ctx.lineWidth   = TRACK_MAP_FOUR_BAR_LINE_WIDTH
  ctx.stroke()
}

export function drawEnergyCanvas(
  canvas:      HTMLCanvasElement,
  curve:       FeatureCurve | null | undefined,
  durationSec: number,
  color:       string,
  viewport?:   TimelineViewport,
): void {
  const ctx = setupCanvas(canvas)
  if (!ctx || !curve || !isFinitePositiveDuration(durationSec)) return
  const safeDurationSec = durationSec
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  ctx.clearRect(0, 0, w, h)

  const vpStart = viewport?.startSec ?? 0
  const vpEnd   = viewport?.endSec   ?? safeDurationSec
  const vpDur   = vpEnd > vpStart ? vpEnd - vpStart : safeDurationSec

  // Filter out any non-finite samples so bad persisted data can't corrupt rendering.
  const valid = curve.filter(pt => isFinite(pt.timeSec) && isFinite(pt.value))
  if (valid.length < 2) return

  const timeToX = (t: number) => ((t - vpStart) / vpDur) * w

  ctx.beginPath()
  ctx.moveTo(0, h)
  for (const pt of valid) {
    ctx.lineTo(timeToX(pt.timeSec), h - pt.value * (h - 1))
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fillStyle = color + '28'
  ctx.fill()

  ctx.beginPath()
  let first = true
  for (const pt of valid) {
    const x = timeToX(pt.timeSec)
    const y = h - pt.value * (h - 1)
    if (first) { ctx.moveTo(x, y); first = false }
    else        ctx.lineTo(x, y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
}

/** Draws the shared visible-time ruler used above every Track Map lane. */
export function drawTimelineRuler(
  canvas: HTMLCanvasElement,
  viewport: TimelineViewport,
  divisions = 6,
): void {
  const ctx = setupCanvas(canvas)
  if (!ctx) return
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  const span = viewport.endSec - viewport.startSec
  if (w <= 0 || h <= 0 || !Number.isFinite(span) || span <= 0) return

  ctx.clearRect(0, 0, w, h)
  ctx.font = `${TRACK_MAP_RULER_FONT_SIZE}px sans-serif`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(232,244,248,0.42)'
  ctx.strokeStyle = 'rgba(74,199,219,0.12)'
  ctx.lineWidth = 1

  const count = Math.max(2, Math.floor(divisions))
  for (let i = 0; i <= count; i++) {
    const ratio = i / count
    const x = Math.round(ratio * w) + 0.5
    const timeSec = viewport.startSec + ratio * span

    ctx.beginPath()
    ctx.moveTo(x, h - 5)
    ctx.lineTo(x, h)
    ctx.stroke()

    const label = formatTime(Math.max(0, timeSec))
    ctx.textAlign = i === 0 ? 'left' : i === count ? 'right' : 'center'
    ctx.fillText(label, Math.max(1, Math.min(w - 1, x)), h / 2)
  }
}

export interface TimelineCueLayout {
  visible: boolean
  leftPct: number
}

/** Computes viewport-relative marker placement for preset and transport cues. */
export function computeTimelineCueLayout(
  timeSec: number,
  viewport: TimelineViewport,
): TimelineCueLayout {
  const ratio = timeToViewportRatio(timeSec, viewport)
  return {
    visible: Number.isFinite(timeSec) && ratio >= -0.0001 && ratio <= 1.0001,
    leftPct: ratio * 100,
  }
}

function applyTimelineCueViewport(container: HTMLDivElement, viewport: TimelineViewport): void {
  container.querySelectorAll<HTMLElement>('[data-timeline-cue]').forEach(marker => {
    const timeSec = Number(marker.dataset.cueTime)
    const layout = computeTimelineCueLayout(timeSec, viewport)
    marker.style.display = layout.visible ? '' : 'none'
    if (layout.visible) marker.style.left = `${layout.leftPct}%`
  })
}

// ── Section editor mode ───────────────────────────────────────────────────────

export type SectionEditorMode = 'none' | 'create' | 'edit'

// ── EditSectionForm ───────────────────────────────────────────────────────────

interface EditSectionFormProps {
  section:      ReactTrackSection
  durationSec:  number
  effectiveBpm?: number | null
  /** Live start/end preview while a boundary handle is being dragged. */
  dragPreview?: { start: number; end: number } | null
  onSave:       (patch: Partial<ReactTrackSection>) => void
  onCancel:     () => void
  /** Called when deleting a user-created/manual section. */
  onDelete?:    () => void
  /** Called when restoring a user-edited-auto section to its original analyzed values. */
  onRestore?:   () => void
  /** Called when suppressing (hiding) a pure auto section from the timeline. */
  onSuppress?:  () => void
  /** Available presets for the Visual Assignment dropdown. */
  reactPresets?:     ReactPreset[]
  /** Currently assigned preset ID for this section (null = no assignment). */
  assignedPresetId?: string | null
  /** Called when the user picks a preset or clears the assignment. */
  onAssignPreset?:   (presetId: string | null) => void
}

function EditSectionForm({
  section,
  durationSec,
  effectiveBpm,
  dragPreview,
  onSave,
  onCancel,
  onDelete,
  onRestore,
  onSuppress,
  reactPresets,
  assignedPresetId,
  onAssignPreset,
}: EditSectionFormProps) {
  const idPrefix = useId()
  const [type,           setType]           = useState<ReactSectionType>(section.type)
  const [label,          setLabel]          = useState(section.label)
  const [startSec,       setStartSec]       = useState(section.startSec)
  const [endSec,         setEndSec]         = useState(section.endSec)
  const [intensity,      setIntensity]      = useState(section.intensity ?? 0.7)
  const [confirmDelete,  setConfirmDelete]  = useState(false)

  // Reset draft when switching to a different section
  useEffect(() => {
    setType(section.type)
    setLabel(section.label)
    setStartSec(section.startSec)
    setEndSec(section.endSec)
    setIntensity(section.intensity ?? 0.7)
    setConfirmDelete(false)
  }, [section.id])  // keyed on identity, not value fields

  // Sync start/end with live boundary drag preview
  useEffect(() => {
    if (dragPreview) {
      setStartSec(dragPreview.start)
      setEndSec(dragPreview.end)
    } else {
      // Drag ended — snap to committed section values
      setStartSec(section.startSec)
      setEndSec(section.endSec)
    }
  }, [dragPreview, section.startSec, section.endSec])

  const minDur = computeMinDuration(effectiveBpm)
  const errors: string[] = []
  if (startSec < 0)                          errors.push('Start must be ≥ 0.')
  if (endSec > durationSec + 0.001)          errors.push(`End must be ≤ track duration.`)
  if (endSec - startSec < minDur - 0.001)    errors.push(`Section must be at least ${minDur.toFixed(2)} s long.`)
  const isValid = errors.length === 0

  const src       = section.source
  const isAuto    = src === 'auto'
  const isEdited  = src === 'user-edited-auto'
  const isUser    = !isAuto && !isEdited
  const sourceBadgeText = isAuto   ? 'Analyzed'
                        : isEdited ? 'Analyzed · Modified'
                        : 'User Created'

  const handleSave = () => {
    if (!isValid) return
    const trimmed = label.trim()
    onSave({
      type,
      label:     trimmed || type.charAt(0).toUpperCase() + type.slice(1),
      startSec,
      endSec,
      intensity: Math.max(0, Math.min(1, intensity)),
    })
  }

  return (
    <div className="rv-add-section-form">
      <div className="rv-form-row">
        <label className="rv-form-label" htmlFor={`${idPrefix}-type`}>Type</label>
        <select
          id={`${idPrefix}-type`}
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
        <label className="rv-form-label" htmlFor={`${idPrefix}-label`}>Label</label>
        <input
          id={`${idPrefix}-label`}
          className="rv-form-input"
          type="text"
          placeholder={type}
          value={label}
          onChange={e => setLabel(e.target.value)}
          maxLength={32}
        />
      </div>

      <div className="rv-form-row">
        <label className="rv-form-label" htmlFor={`${idPrefix}-start`}>Start (s)</label>
        <div className="rv-form-time-row">
          <input
            id={`${idPrefix}-start`}
            className="rv-form-input rv-form-input--num"
            type="number"
            min={0}
            max={durationSec}
            step={0.01}
            value={startSec.toFixed(3)}
            onChange={e => setStartSec(Math.max(0, parseFloat(e.target.value) || 0))}
          />
          <span className="rv-form-time">{formatTimePrecise(startSec)}</span>
        </div>
      </div>

      <div className="rv-form-row">
        <label className="rv-form-label" htmlFor={`${idPrefix}-end`}>End (s)</label>
        <div className="rv-form-time-row">
          <input
            id={`${idPrefix}-end`}
            className="rv-form-input rv-form-input--num"
            type="number"
            min={0}
            max={durationSec}
            step={0.01}
            value={endSec.toFixed(3)}
            onChange={e => setEndSec(Math.max(0, parseFloat(e.target.value) || 0))}
          />
          <span className="rv-form-time">{formatTimePrecise(endSec)}</span>
        </div>
      </div>

      <div className="rv-form-row">
        <label className="rv-form-label" htmlFor={`${idPrefix}-intensity`}>Intensity</label>
        <div className="rv-form-inline-control">
          <input
            id={`${idPrefix}-intensity`}
            className="rv-form-range"
            type="range"
            min={0} max={1} step={0.01}
            value={intensity}
            onChange={e => setIntensity(parseFloat(e.target.value))}
          />
          <span className="rv-form-val">{Math.round(intensity * 100)}%</span>
        </div>
      </div>

      {reactPresets && onAssignPreset && (
        <div className="rv-form-group-sep">
          <div className="rv-form-group-label">Visual Assignment</div>
          <div className="rv-form-row">
            <label className="rv-form-label" htmlFor={`${idPrefix}-preset`}>Preset</label>
            <select
              id={`${idPrefix}-preset`}
              className="rv-form-select"
              value={assignedPresetId ?? ''}
              onChange={e => onAssignPreset(e.target.value || null)}
            >
              <option value="">No preset assignment</option>
              {reactPresets.filter(p => isSelectableReactEngineId(p.engine)).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {assignedPresetId && (() => {
            const preset = reactPresets.find(p => p.id === assignedPresetId)
            return preset ? (
              <div className="rv-form-row">
                <label className="rv-form-label">Engine</label>
                <span className="rv-form-val rv-form-val--readonly">
                  {isSelectableReactEngineId(preset.engine) ? REACT_ENGINE_CATALOG[preset.engine].label : 'Unavailable engine'}
                </span>
              </div>
            ) : null
          })()}
        </div>
      )}

      <div className="rv-form-actions">
        <span className="rv-section-source-badge">{sourceBadgeText}</span>
        <button className="rv-form-cancel-btn" onClick={onCancel}>Cancel</button>
        <button className="rv-form-add-btn" onClick={handleSave} disabled={!isValid}>
          Save Changes
        </button>
        {isEdited && onRestore && (
          <button className="rv-restore-btn" onClick={onRestore} title="Restore original analyzed values">
            ↺ Restore
          </button>
        )}
        {isAuto && onSuppress && (
          <button className="rv-delete-btn" onClick={onSuppress}>
            Hide
          </button>
        )}
        {isUser && onDelete && (
          confirmDelete ? (
            <>
              <span className="rv-confirm-delete-label">Remove?</span>
              <button className="rv-confirm-delete-btn" onClick={onDelete}>Yes</button>
              <button className="rv-form-cancel-btn" onClick={() => setConfirmDelete(false)}>No</button>
            </>
          ) : (
            <button className="rv-delete-btn" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )
        )}
      </div>

      {errors.length > 0 && (
        <div className="rv-validation-errors rv-validation-errors--full">
          {errors.map((err, i) => <p key={i} className="rv-validation-error">{err}</p>)}
        </div>
      )}
    </div>
  )
}

// ── AddSectionForm ────────────────────────────────────────────────────────────

interface AddSectionFormProps {
  onAdd:    (section: ReactTrackSection) => void
  onCancel: () => void
}

function AddSectionForm({ onAdd, onCancel }: AddSectionFormProps) {
  const idPrefix = useId()
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
        <label className="rv-form-label" htmlFor={`${idPrefix}-type`}>Type</label>
        <select
          id={`${idPrefix}-type`}
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
        <label className="rv-form-label" htmlFor={`${idPrefix}-label`}>Label</label>
        <input
          id={`${idPrefix}-label`}
          className="rv-form-input"
          type="text"
          placeholder="Section name…"
          value={label}
          onChange={e => setLabel(e.target.value)}
          maxLength={32}
        />
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label" htmlFor={`${idPrefix}-start`}>Start (s)</label>
        <input
          id={`${idPrefix}-start`}
          className="rv-form-input rv-form-input--num"
          type="number"
          min={0} step={1}
          value={startSec}
          onChange={e => setStartSec(Math.max(0, parseFloat(e.target.value) || 0))}
        />
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label" htmlFor={`${idPrefix}-end`}>End (s)</label>
        <input
          id={`${idPrefix}-end`}
          className="rv-form-input rv-form-input--num"
          type="number"
          min={0} step={1}
          value={endSec}
          onChange={e => setEndSec(Math.max(0, parseFloat(e.target.value) || 0))}
        />
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label" htmlFor={`${idPrefix}-intensity`}>Intensity</label>
        <input
          id={`${idPrefix}-intensity`}
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
  sections:      ReactTrackSection[]
  durationSec:   number
  viewport:      TimelineViewport
  viewportRef:   MutableRefObject<TimelineViewport>
  beatGrid?:      BeatMarkerMI[]
  effectiveBpm?:  number | null
  selectedId:     string | null
  onSelect:       (id: string) => void
  onRemove?:      (id: string) => void
  onCommitBoundary: (
    sectionId:       string,
    edge:            SectionEdge,
    newTime:         number,
    /** ID of adjacent section whose shared boundary also moved, or null. */
    sharedNeighborId:   string | null,
    /** New boundary time for the neighbor, or null. */
    newNeighborTime:    number | null,
  ) => void
  /** Called on every pointer-move with the live boundary preview (for editor sync). */
  onDragPreview?: (sectionId: string, previewStart: number, previewEnd: number) => void
  /** Section IDs that have a preset assignment (drives compact badge display). */
  presetAssignedSectionIds?: Set<string>
}

interface SectionTimelineHandle {
  updateViewport: (viewport: TimelineViewport) => void
}

function applySectionTimelineViewport(
  container: HTMLDivElement,
  viewport:  TimelineViewport,
): void {
  const regions = container.querySelectorAll<HTMLElement>('[data-section-region]')
  regions.forEach(region => {
    const startSec = Number(region.dataset.startSec)
    const endSec   = Number(region.dataset.endSec)
    const layout   = computeViewportRangeLayout({ startSec, endSec }, viewport)
    region.style.display = layout.visible ? '' : 'none'
    if (!layout.visible) return
    region.style.left  = `${layout.leftPct}%`
    region.style.width = `${layout.widthPct}%`
    const startHandle = region.querySelector<HTMLElement>('[data-section-start-handle]')
    const endHandle   = region.querySelector<HTMLElement>('[data-section-end-handle]')
    if (startHandle) startHandle.style.display = layout.startEdgeVisible ? '' : 'none'
    if (endHandle)   endHandle.style.display   = layout.endEdgeVisible   ? '' : 'none'
  })

  const boundaries = container.querySelectorAll<HTMLElement>('[data-section-boundary]')
  boundaries.forEach(boundary => {
    const timeSec = Number(boundary.dataset.boundaryTime)
    const ratio   = timeToViewportRatio(timeSec, viewport)
    const visible = Number.isFinite(timeSec) && ratio >= -0.0001 && ratio <= 1.0001
    boundary.style.display = visible ? '' : 'none'
    if (visible) boundary.style.left = `${ratio * 100}%`
  })
}

const SectionTimeline = forwardRef<SectionTimelineHandle, SectionTimelineProps>(function SectionTimeline({
  sections,
  durationSec,
  viewport,
  viewportRef,
  beatGrid,
  effectiveBpm,
  selectedId,
  onSelect,
  onRemove,
  onCommitBoundary,
  onDragPreview,
  presetAssignedSectionIds,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<SectionBoundaryDragState | null>(null)
  // Ref so pointer-move handlers always read the latest drag state without
  // creating stale closures — handlers are recreated on each render but
  // dragRef is always current.
  const dragRef = useRef<SectionBoundaryDragState | null>(null)
  dragRef.current = drag
  useImperativeHandle(ref, () => ({
    updateViewport(nextViewport) {
      viewportRef.current = nextViewport
      const container = containerRef.current
      if (container) applySectionTimelineViewport(container, nextViewport)
    },
  }), [viewportRef])

  const vpDur = viewport.endSec - viewport.startSec
  if (durationSec <= 0 || vpDur <= 0) return null

  // Keep every valid section mounted. Playback-follow only changes geometry,
  // so off-screen sections can enter the viewport without rebuilding the tree.
  const sorted = sections
    .filter(s =>
      Number.isFinite(s.startSec) && Number.isFinite(s.endSec) &&
      s.endSec > s.startSec && s.startSec < durationSec && s.endSec > 0
    )
    .map(s => ({ ...s, startSec: Math.max(0, s.startSec), endSec: Math.min(durationSec, s.endSec) }))
    .sort((a, b) => a.startSec - b.startSec)

  if (sorted.length === 0) return null

  // Apply drag preview on top of sorted sections for visual rendering.
  // The `sorted` array (original values) is used for all logic and event handlers.
  const display = sorted.map(s => {
    if (drag?.sectionId === s.id) {
      return { ...s, startSec: drag.previewStart, endSec: drag.previewEnd }
    }
    if (drag?.sharedNeighborId === s.id) {
      return {
        ...s,
        startSec: drag.previewNeighborStart ?? s.startSec,
        endSec:   drag.previewNeighborEnd   ?? s.endSec,
      }
    }
    return s
  })

  // ── Drag event factory ─────────────────────────────────────────────────────
  // Handlers are created per section+edge at render time (they close over
  // the correct `orig` section). dragRef avoids stale closure on drag state.

  const makePointerDown = (orig: ReactTrackSection, edge: SectionEdge) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)

      const neighbor = findSharedBoundaryNeighbor(sorted, orig.id, edge)
      setDrag({
        sectionId:     orig.id,
        edge,
        originalStart: orig.startSec,
        originalEnd:   orig.endSec,
        previewStart:  orig.startSec,
        previewEnd:    orig.endSec,
        sharedNeighborId:      neighbor?.id ?? null,
        originalNeighborStart: neighbor?.startSec ?? null,
        originalNeighborEnd:   neighbor?.endSec ?? null,
        previewNeighborStart:  neighbor?.startSec ?? null,
        previewNeighborEnd:    neighbor?.endSec ?? null,
      })
    }

  const makePointerMove = (orig: ReactTrackSection, edge: SectionEdge) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current
      if (!d || d.sectionId !== orig.id || d.edge !== edge) return

      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const activeViewport = viewportRef.current

      const rawTime  = pointerXToTime(
        e.clientX,
        rect.left,
        rect.width,
        activeViewport.startSec,
        activeViewport.endSec,
      )
      const grid     = beatGrid ?? []
      const snapped  = snapToNearestBeat(rawTime, grid, e.altKey)
      const minDur   = computeMinDuration(effectiveBpm)
      const clamped  = clampEdge(
        edge,
        snapped,
        { startSec: d.originalStart, endSec: d.originalEnd },
        minDur,
        durationSec,
      )

      const d2     = dragRef.current
      if (!d2) return
      const ps     = edge === 'start' ? clamped : d2.previewStart
      const pe     = edge === 'end'   ? clamped : d2.previewEnd
      const nStart = d2.sharedNeighborId && edge === 'end'   ? clamped : d2.previewNeighborStart
      const nEnd   = d2.sharedNeighborId && edge === 'start' ? clamped : d2.previewNeighborEnd

      // Notify parent with live preview so the editor form can sync start/end fields.
      onDragPreview?.(orig.id, ps, pe)

      setDrag(prev => {
        if (!prev) return null
        return { ...prev, previewStart: ps, previewEnd: pe, previewNeighborStart: nStart, previewNeighborEnd: nEnd }
      })
    }

  const makePointerUp = (orig: ReactTrackSection, edge: SectionEdge) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current
      if (!d || d.sectionId !== orig.id || d.edge !== edge) return

      const finalTime    = edge === 'start' ? d.previewStart  : d.previewEnd
      // Neighbor's moved boundary is the opposite edge
      const neighborTime = edge === 'end'   ? d.previewNeighborStart : d.previewNeighborEnd

      onCommitBoundary(d.sectionId, d.edge, finalTime, d.sharedNeighborId, neighborTime ?? null)
      setDrag(null)
    }

  const makeKeyDown = (orig: ReactTrackSection, edge: SectionEdge) =>
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return
      e.preventDefault()
      const step    = computeKeyStep(effectiveBpm, e.shiftKey)
      const curTime = edge === 'start' ? orig.startSec : orig.endSec
      const delta   = e.key === 'ArrowRight' ? step : -step
      const minDur  = computeMinDuration(effectiveBpm)
      const clamped = clampEdge(edge, curTime + delta, orig, minDur, durationSec)
      onCommitBoundary(orig.id, edge, clamped, null, null)
    }

  return (
    <div
      className={`rv-section-timeline${drag ? ' rv-section-timeline--dragging' : ''}`}
      ref={containerRef}
      aria-label="Section timeline"
    >
      {display.map((section, i) => {
        const orig       = sorted[i]
        const layout     = computeViewportRangeLayout(section, viewport)
        const color      = SECTION_COLORS[section.type] ?? '#6a7a8a'
        const barRange   = beatGrid ? buildBarRange(section, beatGrid) : null
        const isSelected = selectedId === section.id
        const src        = section.source
        const isUser     = src === 'manual' || src === 'user-created' || src === 'user-edited-auto' || src == null
        const isDragging = drag?.sectionId === orig.id
        const activeEdge = isDragging ? drag.edge : null
        const previewStart = isDragging ? drag.previewStart : section.startSec
        const previewEnd   = isDragging ? drag.previewEnd   : section.endSec

        return (
          <div
            key={orig.id}
            data-section-region
            data-start-sec={section.startSec}
            data-end-sec={section.endSec}
            className={[
              'rv-section-region',
              isSelected  ? 'rv-section-region--selected'  : '',
              isDragging  ? 'rv-section-region--dragging'  : '',
            ].filter(Boolean).join(' ')}
            style={{
              display: layout.visible ? undefined : 'none',
              left: `${layout.leftPct}%`,
              width: `${layout.widthPct}%`,
              '--section-color': color,
            } as React.CSSProperties}
          >
            {/* ── Left (start) resize handle — hidden when start is off-screen ── */}
            <div
              data-section-start-handle
              className={`rv-section-handle rv-section-handle--start${activeEdge === 'start' ? ' rv-section-handle--active' : ''}`}
              style={{ display: layout.startEdgeVisible ? undefined : 'none' }}
              role="slider"
              tabIndex={0}
              aria-label={`Adjust ${orig.label} start`}
              aria-valuenow={Math.round(previewStart * 1000)}
              aria-valuemin={0}
              aria-valuemax={Math.round(durationSec * 1000)}
              aria-valuetext={formatTimePrecise(previewStart)}
              onPointerDown={makePointerDown(orig, 'start')}
              onPointerMove={makePointerMove(orig, 'start')}
              onPointerUp={makePointerUp(orig, 'start')}
              onPointerCancel={makePointerUp(orig, 'start')}
              onKeyDown={makeKeyDown(orig, 'start')}
            >
              {activeEdge === 'start' && (
                <div className="rv-drag-tooltip rv-drag-tooltip--left">
                  {formatTimePrecise(previewStart)}
                </div>
              )}
            </div>

            {/* ── Section body (click to select) ────────────────────── */}
            <div
              className="rv-section-body"
              role="button"
              tabIndex={0}
              aria-label={`Section ${orig.label}, ${formatTime(orig.startSec)} to ${formatTime(orig.endSec)}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(orig.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(orig.id) }
              }}
            >
              <div className="rv-section-body-tint" />
              <div className="rv-section-header">
                <span className="rv-section-label">{section.label.toUpperCase()}</span>
                {barRange && <span className="rv-section-barrange">{barRange}</span>}
                {presetAssignedSectionIds?.has(orig.id) && (
                  <span className="rv-section-preset-dot" title="Preset assigned">●</span>
                )}
              </div>
              {onRemove && isUser && (
                <button
                  className="rv-section-region-remove"
                  onClick={e => { e.stopPropagation(); onRemove(orig.id) }}
                  title="Remove section"
                  aria-label={`Remove section ${orig.label}`}
                >×</button>
              )}
            </div>

            {/* ── Right (end) resize handle — hidden when end is off-screen ── */}
            <div
              data-section-end-handle
              className={`rv-section-handle rv-section-handle--end${activeEdge === 'end' ? ' rv-section-handle--active' : ''}`}
              style={{ display: layout.endEdgeVisible ? undefined : 'none' }}
              role="slider"
              tabIndex={0}
              aria-label={`Adjust ${orig.label} end`}
              aria-valuenow={Math.round(previewEnd * 1000)}
              aria-valuemin={0}
              aria-valuemax={Math.round(durationSec * 1000)}
              aria-valuetext={formatTimePrecise(previewEnd)}
              onPointerDown={makePointerDown(orig, 'end')}
              onPointerMove={makePointerMove(orig, 'end')}
              onPointerUp={makePointerUp(orig, 'end')}
              onPointerCancel={makePointerUp(orig, 'end')}
              onKeyDown={makeKeyDown(orig, 'end')}
            >
              {activeEdge === 'end' && (
                <div className="rv-drag-tooltip rv-drag-tooltip--right">
                  {formatTimePrecise(previewEnd)}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Diamond boundary markers stay mounted and are repositioned imperatively. */}
      {display.map((section, i) => {
        if (i === 0) return null
        const boundary = section.startSec
        const ratio    = timeToViewportRatio(boundary, viewport)
        const visible  = ratio >= -0.0001 && ratio <= 1.0001
        return (
          <div
            key={`bd-${sorted[i].id}`}
            data-section-boundary
            data-boundary-time={boundary}
            className="rv-section-boundary"
            style={{ display: visible ? undefined : 'none', left: `${ratio * 100}%` }}
            aria-hidden="true"
          >
            <div className="rv-section-boundary-diamond" />
          </div>
        )
      })}
    </div>
  )
})

// ── ReactTrackMapStrip ────────────────────────────────────────────────────────

interface ReactTrackMapStripProps {
  /** Fallback duration when no analysis is available yet. */
  audioDurationSec?: number
  /** Hides the legacy strip header when mounted inside the unified lower workspace. */
  embedded?: boolean
}

export function ReactTrackMapStrip({ audioDurationSec = 180, embedded = false }: ReactTrackMapStripProps) {
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
    currentBpmReanalysisStatus,
  } = engine

  const gridStale = currentTrack?.analysisRuntime.gridStale ?? false

  const {
    manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId,
    selectedSectionByTrackId,
    setSelectedSectionIdForTrack,
    addManualSection,
    updateManualSection,
    removeManualSection,
    commitAutomaticSectionOverride,
    suppressAutoSection,
    restoreAutoSection,
    reactPresets,
    presetAutomationCuesByTrackId,
    addPresetAutomationCue,
    updatePresetAutomationCue,
    removePresetAutomationCue,
  } = useReactStore(useShallow(s => ({
    manualTrackSectionsByTrackId:    s.manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId: s.suppressedAutoSectionsByTrackId,
    selectedSectionByTrackId:        s.selectedSectionByTrackId,
    setSelectedSectionIdForTrack:    s.setSelectedSectionIdForTrack,
    addManualSection:                s.addManualSection,
    updateManualSection:             s.updateManualSection,
    removeManualSection:             s.removeManualSection,
    commitAutomaticSectionOverride:  s.commitAutomaticSectionOverride,
    suppressAutoSection:             s.suppressAutoSection,
    restoreAutoSection:              s.restoreAutoSection,
    reactPresets:                    s.reactPresets,
    presetAutomationCuesByTrackId:   s.presetAutomationCuesByTrackId,
    addPresetAutomationCue:          s.addPresetAutomationCue,
    updatePresetAutomationCue:       s.updatePresetAutomationCue,
    removePresetAutomationCue:       s.removePresetAutomationCue,
  })))

  const { waveformZoom, beatGridEnabled, cueMarkers } = useVisualStore(
    useShallow(s => ({
      waveformZoom: s.waveformZoom,
      beatGridEnabled: s.beatGridEnabled,
      cueMarkers: s.cueMarkers,
    }))
  )

  const [collapsed,      setCollapsed]      = useState(() => !embedded)
  const [editorMode,     setEditorMode]     = useState<SectionEditorMode>('none')
  const [dragPreview,    setDragPreview]    = useState<{ sectionId: string; start: number; end: number } | null>(null)
  const [energyCurveKey, setEnergyCurveKey] = useState<EnergyCurveKey>('shortTerm')
  const [drawTick,       setDrawTick]       = useState(0)
  const fallbackDurationSec = resolvePositiveDuration(audioDurationSec)
  // React state changes only for semantic viewport inputs (track, zoom, duration).
  // Playback-follow geometry stays in viewportRef and is applied directly to DOM/canvas.
  const [, setLayoutViewport] = useState<TimelineViewport>({
    startSec: 0,
    endSec:   fallbackDurationSec,
  })

  const stripRef        = useRef<HTMLDivElement>(null)
  const rulerCanvasRef  = useRef<HTMLCanvasElement>(null)
  const beatCanvasRef   = useRef<HTMLCanvasElement>(null)
  const energyCanvasRef = useRef<HTMLCanvasElement>(null)
  const cueTimelineRef  = useRef<HTMLDivElement>(null)
  const playheadRef     = useRef<HTMLDivElement>(null)
  const rafRef          = useRef<number | null>(null)
  const sectionTimelineRef = useRef<SectionTimelineHandle>(null)
  // Stable ref to the latest viewport — read by canvas effects, interactions, and RAF loop
  const viewportRef = useRef<TimelineViewport>({ startSec: 0, endSec: fallbackDurationSec })
  // Refs to avoid stale closures in RAF tick
  const waveformZoomRef             = useRef(waveformZoom)
  const durationSecForRafRef        = useRef(audioDurationSec)
  const isCompleteRef               = useRef(false)
  const collapsedRef                = useRef(!embedded)
  const currentAnalysisRef          = useRef(currentAnalysis)
  const energyCurveKeyRef           = useRef(energyCurveKey)
  const currentEffectiveBeatGridRef = useRef(currentEffectiveBeatGrid)
  const beatGridEnabledRef          = useRef(beatGridEnabled)

  // Active track ID — used as the per-track sections key
  const activeTrackId = currentTrack?.id ?? null

  // Per-track selection and suppression for the active track only
  const selectedSectionId = activeTrackId
    ? (selectedSectionByTrackId[activeTrackId] ?? null)
    : null
  const suppressedIds = activeTrackId
    ? (suppressedAutoSectionsByTrackId[activeTrackId] ?? [])
    : []

  // Per-track manual sections for the active track only
  const manualTrackSections = activeTrackId
    ? (manualTrackSectionsByTrackId[activeTrackId] ?? [])
    : []

  // Per-track preset automation cues and the set of section IDs that have one
  const trackCues = activeTrackId ? (presetAutomationCuesByTrackId[activeTrackId] ?? []) : []
  const assignedSectionIds = new Set(
    trackCues.filter(c => c.sectionId != null).map(c => c.sectionId!)
  )
  const importedCueMarkers = currentTrack?.importedCueMarkers ?? []
  const activeCueMarkers = useMemo(
    () => [...cueMarkers, ...importedCueMarkers].sort((a, b) => a.time - b.time),
    [cueMarkers, importedCueMarkers],
  )

  const timelineCueItems = [
    ...trackCues.map(cue => {
      const preset = reactPresets.find(candidate => candidate.id === cue.presetId)
      return {
        id: `preset:${cue.id}`,
        timeSec: cue.timeSec,
        label: cue.label,
        color: preset?.palette.primary ?? '#b84fc9',
        kind: 'preset' as const,
        enabled: cue.enabled,
      }
    }),
    ...activeCueMarkers.map(cue => ({
      id: `${cue.source === 'rekordbox' ? 'rekordbox' : 'transport'}:${cue.id}`,
      timeSec: cue.time,
      label: cue.label,
      color: cue.color ?? '#4ac7db',
      kind: 'cue' as const,
      enabled: true,
    })),
  ].filter(cue => Number.isFinite(cue.timeSec))

  // Derived
  const hasTrack    = currentTrack != null
  const isWorking   = isActivelyWorking(currentAnalysisStatus)
  const isComplete  = currentAnalysisStatus === 'complete' && currentAnalysis != null
  const durationSec = resolvePositiveDuration(
    currentAnalysis ? currentAnalysis.durationMs / 1000 : undefined,
    fallbackDurationSec,
  )

  // Keep RAF refs in sync with the latest render values (avoids stale closures)
  waveformZoomRef.current             = waveformZoom
  durationSecForRafRef.current        = durationSec
  isCompleteRef.current               = isComplete
  collapsedRef.current                = collapsed
  currentAnalysisRef.current          = currentAnalysis
  energyCurveKeyRef.current           = energyCurveKey
  currentEffectiveBeatGridRef.current = currentEffectiveBeatGrid
  beatGridEnabledRef.current          = beatGridEnabled

  // A complete analysis is only "valid" if it returned usable data.
  const hasValidData = isComplete && currentAnalysis != null && (
    (currentAnalysis.beatGrid?.length ?? 0) > 0 ||
    (currentAnalysis.sections?.length ?? 0) > 0
  )

  const autoSections: ReactTrackSection[] = isComplete
    ? adaptMIAnalysis(currentAnalysis!)
    : []

  const resolvedSections = resolveTrackSections({
    analyzedSections: autoSections,
    manualSections:   manualTrackSections,
    durationSec,
    suppressedIds,
  })

  const keyLabel = currentKey ? buildKeyLabel(currentKey) : null

  // Auto-expand the strip whenever a new track is loaded so status/results are
  // visible without the user having to manually click the header.
  // Also reset the editor mode and viewport so stale state from a previous track is cleared.
  useEffect(() => {
    if (activeTrackId) {
      setCollapsed(false)
      setEditorMode('none')
      setDragPreview(null)
      // Reset viewport to full track; the viewport sync effect will refine it
      const vp = { startSec: 0, endSec: durationSec }
      viewportRef.current = vp
      setLayoutViewport(vp)
    }
  }, [activeTrackId])

  // ResizeObserver: redraws canvases when the strip width changes (e.g. when the
  // left/right panels open or close). Supersedes the window 'resize' listener
  // since panel changes do not generate a browser resize event.
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setDrawTick(t => t + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Viewport sync — recomputes the canonical viewport whenever zoom or duration changes.
  // Must run before the canvas effects (React runs effects in declaration order) so
  // that viewportRef.current is up-to-date when those effects fire.
  useEffect(() => {
    if (durationSec <= 0) return
    const t  = getCurrentTime()
    const vp = computeWaveformViewport(durationSec, t, waveformZoom)
    viewportRef.current = vp
    setLayoutViewport(vp)
  }, [waveformZoom, durationSec, getCurrentTime])

  // Shared ruler and cue geometry use the same viewport as sections, energy,
  // beat ticks, and the dock waveform. ResizeObserver increments drawTick.
  useEffect(() => {
    const ruler = rulerCanvasRef.current
    if (ruler) drawTimelineRuler(ruler, viewportRef.current)
    const cueLane = cueTimelineRef.current
    if (cueLane) applyTimelineCueViewport(cueLane, viewportRef.current)
  }, [drawTick, collapsed, waveformZoom, durationSec, trackCues, activeCueMarkers])

  // Beat canvas — redraws when analysis, zoom, effective override, or collapse changes.
  // When a manual BPM override is active, currentEffectiveBeatGrid contains the
  // regenerated markers; we pass them as `effective` so the canvas reflects the
  // override BPM without mutating or replacing the original analysis object.
  useEffect(() => {
    const canvas = beatCanvasRef.current
    if (!canvas) return
    if (!isComplete || !currentAnalysis || !beatGridEnabled) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    const effective = currentEffectiveBeatGrid
      ? { beatGrid: currentEffectiveBeatGrid }
      : undefined
    drawBeatCanvas(canvas, currentAnalysis, effective, viewportRef.current)
  }, [isComplete, currentAnalysis, currentEffectiveBeatGrid, drawTick, collapsed, beatGridEnabled, waveformZoom])

  // Energy canvas — redraws when analysis, zoom, curve selection, or status changes.
  // Guard against missing/malformed curve data from old or partial cached analyses.
  useEffect(() => {
    const canvas = energyCanvasRef.current
    if (!canvas) return
    if (!isComplete || !currentAnalysis) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    const curve = currentAnalysis.energyCurves?.[energyCurveKey] ?? null
    const opt   = ENERGY_CURVE_OPTIONS.find(o => o.key === energyCurveKey)!
    drawEnergyCanvas(canvas, curve, durationSec, opt.color, viewportRef.current)
  }, [isComplete, currentAnalysis, energyCurveKey, durationSec, drawTick, collapsed, waveformZoom])

  // ── Playhead RAF loop ──────────────────────────────────────────────────────
  // Runs every frame; updates the playhead position and redraws canvases when the
  // viewport shifts (i.e., when the play head moves while zoomed in).
  // Reads refs exclusively so state changes in the loop never trigger re-renders.
  useEffect(() => {
    const playhead = playheadRef.current
    if (!playhead || !isComplete || durationSec <= 0) {
      if (playhead) playhead.style.display = 'none'
      return
    }
    playhead.style.display = 'block'

    const tick = () => {
      const t    = getCurrentTime()
      const dur  = durationSecForRafRef.current
      const zoom = waveformZoomRef.current
      const vp   = computeWaveformViewport(dur, t, zoom)

      // Update playhead — viewport-relative position
      const ratio = timeToViewportRatio(t, vp)
      if (ratio >= 0 && ratio <= 1) {
        playhead.style.left    = `${ratio * 100}%`
        playhead.style.display = 'block'
      } else {
        playhead.style.display = 'none'
      }

      // Redraw canvases and update section positions when the viewport shifts
      const prev     = viewportRef.current
      const vpChanged = prev.startSec !== vp.startSec || prev.endSec !== vp.endSec
      if (vpChanged && !collapsedRef.current && isCompleteRef.current) {
        viewportRef.current = vp

        const ruler = rulerCanvasRef.current
        if (ruler) drawTimelineRuler(ruler, vp)
        const cueLane = cueTimelineRef.current
        if (cueLane) applyTimelineCueViewport(cueLane, vp)

        const analysis = currentAnalysisRef.current
        if (analysis) {
          const beatCanvas = beatCanvasRef.current
          if (beatCanvas && beatGridEnabledRef.current) {
            const eff = currentEffectiveBeatGridRef.current
              ? { beatGrid: currentEffectiveBeatGridRef.current }
              : undefined
            drawBeatCanvas(beatCanvas, analysis, eff, vp)
          } else if (beatCanvas) {
            beatCanvas.getContext('2d')?.clearRect(0, 0, beatCanvas.width, beatCanvas.height)
          }

          const energyCanvas = energyCanvasRef.current
          if (energyCanvas) {
            const curveKey = energyCurveKeyRef.current
            const curve    = analysis.energyCurves?.[curveKey] ?? null
            const opt      = ENERGY_CURVE_OPTIONS.find(o => o.key === curveKey)!
            drawEnergyCanvas(energyCanvas, curve, dur, opt.color, vp)
          }
        }

        // Section geometry follows playback imperatively. This avoids rebuilding
        // the section/editor tree on every animation frame.
        sectionTimelineRef.current?.updateViewport(vp)
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [isComplete, durationSec, getCurrentTime])

  // ── Boundary drag commit ──────────────────────────────────────────────────
  // Called once on pointer-up (or keyboard nudge) — one atomic store update
  // per drag regardless of how many pixels the pointer moved.
  const handleCommitBoundary = useCallback((
    sectionId:       string,
    edge:            SectionEdge,
    newTime:         number,
    sharedNeighborId:   string | null,
    newNeighborTime:    number | null,
  ) => {
    if (!activeTrackId) return

    const applyEdit = (id: string, section: ReactTrackSection, patch: Partial<ReactTrackSection>) => {
      if (section.source === 'auto') {
        commitAutomaticSectionOverride(activeTrackId, section, patch)
      } else {
        updateManualSection(activeTrackId, id, patch)
      }
    }

    const primary = resolvedSections.find(s => s.id === sectionId)
    if (primary) {
      const patch = edge === 'start' ? { startSec: newTime } : { endSec: newTime }
      applyEdit(sectionId, primary, patch)
    }

    // Sync the linked preset cue's timeSec when the section's start edge moves.
    if (edge === 'start') {
      const cueId = buildPresetCueId(sectionId)
      if (trackCues.some(c => c.id === cueId)) {
        updatePresetAutomationCue(activeTrackId, cueId, { timeSec: newTime })
      }
    }

    // Commit the shared neighbor's boundary in a separate but synchronous call.
    // Both commits happen in the same React event-handler tick so React 18 batches them.
    if (sharedNeighborId && newNeighborTime != null) {
      const neighbor = resolvedSections.find(s => s.id === sharedNeighborId)
      if (neighbor) {
        // If we moved section.end, the neighbor's start moved; if section.start, neighbor.end moved.
        const neighborPatch = edge === 'end'
          ? { startSec: newNeighborTime }
          : { endSec:   newNeighborTime }
        applyEdit(sharedNeighborId, neighbor, neighborPatch)
        // When dragging our end, the neighbor's start moves — sync that cue too.
        if (edge === 'end') {
          const neighborCueId = buildPresetCueId(sharedNeighborId)
          if (trackCues.some(c => c.id === neighborCueId)) {
            updatePresetAutomationCue(activeTrackId, neighborCueId, { timeSec: newNeighborTime })
          }
        }
      }
    }

    // Clear the editor's drag-preview now that the commit has been issued.
    // The EditSectionForm effect will snap to the newly-committed section values.
    setDragPreview(null)
  }, [activeTrackId, resolvedSections, commitAutomaticSectionOverride, updateManualSection, trackCues, updatePresetAutomationCue])

  const handleRetry = useCallback(() => {
    if (currentTrack) retryAnalysis(currentTrack.id)
  }, [currentTrack, retryAnalysis])

  const handleReanalyze = useCallback(() => {
    if (currentTrack && reanalyzeTrack) reanalyzeTrack(currentTrack.id)
  }, [currentTrack, reanalyzeTrack])

  const handleAdd = useCallback((section: ReactTrackSection) => {
    if (activeTrackId) addManualSection(activeTrackId, section)
    setEditorMode('none')
  }, [activeTrackId, addManualSection])

  // Shared helper: removes the section-linked preset cue (no-op when none exists).
  // removePresetAutomationCue is already a safe no-op when the ID is absent.
  const removeCueForSection = useCallback((sectionId: string) => {
    if (!activeTrackId) return
    removePresetAutomationCue(activeTrackId, buildPresetCueId(sectionId))
  }, [activeTrackId, removePresetAutomationCue])

  const handleRemove = useCallback((id: string) => {
    if (!activeTrackId) return
    removeManualSection(activeTrackId, id)
    removeCueForSection(id)
  }, [activeTrackId, removeManualSection, removeCueForSection])

  // Opens the edit panel for the clicked section.
  const handleSelectSection = useCallback((id: string) => {
    if (!activeTrackId) return
    setSelectedSectionIdForTrack(activeTrackId, id)
    setEditorMode('edit')
  }, [activeTrackId, setSelectedSectionIdForTrack])

  const closeSectionEditor = useCallback(() => {
    setEditorMode('none')
    setDragPreview(null)
    if (activeTrackId) setSelectedSectionIdForTrack(activeTrackId, null)
  }, [activeTrackId, setSelectedSectionIdForTrack])

  // Live boundary drag preview — relayed from SectionTimeline to EditSectionForm.
  const handleDragPreview = useCallback((sectionId: string, start: number, end: number) => {
    setDragPreview({ sectionId, start, end })
  }, [])

  // Saves a section edit (creates override for auto, updates store for manual).
  const handleSaveSection = useCallback((patch: Partial<ReactTrackSection>) => {
    if (!activeTrackId || !selectedSectionId) return
    const section = resolvedSections.find(s => s.id === selectedSectionId)
    if (!section) return
    if (section.source === 'auto') {
      commitAutomaticSectionOverride(activeTrackId, section, patch)
    } else {
      updateManualSection(activeTrackId, selectedSectionId, patch)
    }
    // Sync the linked preset cue when the section's start or label changes.
    const cueId = buildPresetCueId(selectedSectionId)
    const linkedCue = trackCues.find(c => c.id === cueId)
    if (linkedCue) {
      const cueUpdate: Partial<ReactTrackSection> & { timeSec?: number; label?: string } = {}
      if (patch.startSec != null) cueUpdate.timeSec = patch.startSec
      if (patch.label != null) {
        const preset = reactPresets.find(p => p.id === linkedCue.presetId)
        cueUpdate.label = buildPresetCueLabel(patch.label, preset?.name ?? linkedCue.presetId)
      }
      if (cueUpdate.timeSec != null || cueUpdate.label != null) {
        updatePresetAutomationCue(activeTrackId, cueId, cueUpdate)
      }
    }
    setEditorMode('none')
    setSelectedSectionIdForTrack(activeTrackId, null)
  }, [activeTrackId, selectedSectionId, resolvedSections, commitAutomaticSectionOverride, updateManualSection, trackCues, reactPresets, updatePresetAutomationCue, setSelectedSectionIdForTrack])

  // Removes the user-edited-auto override AND any suppression, restoring the original.
  const handleRestoreSection = useCallback(() => {
    if (!activeTrackId || !selectedSectionId) return
    restoreAutoSection(activeTrackId, selectedSectionId)
    // Keep the section selected — it now shows as 'auto' source in the editor.
  }, [activeTrackId, selectedSectionId, restoreAutoSection])

  // Suppresses a pure auto section (hides it from the timeline) and removes its linked cue.
  const handleSuppressSection = useCallback(() => {
    if (!activeTrackId || !selectedSectionId) return
    suppressAutoSection(activeTrackId, selectedSectionId)
    removeCueForSection(selectedSectionId)
    setEditorMode('none')
  }, [activeTrackId, selectedSectionId, suppressAutoSection, removeCueForSection])

  // Permanently removes a user-created/manual section and its linked cue.
  const handleDeleteSection = useCallback(() => {
    if (!activeTrackId || !selectedSectionId) return
    removeManualSection(activeTrackId, selectedSectionId)
    removeCueForSection(selectedSectionId)
    setEditorMode('none')
  }, [activeTrackId, selectedSectionId, removeManualSection, removeCueForSection])

  // Creates, updates, or removes a preset automation cue linked to the selected section.
  const handleAssignPreset = useCallback((presetId: string | null) => {
    if (!activeTrackId || !selectedSectionId) return
    const section = resolvedSections.find(s => s.id === selectedSectionId)
    if (!section) return
    const cueId = buildPresetCueId(section.id)
    if (!presetId) {
      removePresetAutomationCue(activeTrackId, cueId)
      return
    }
    const preset = reactPresets.find(p => p.id === presetId)
    const label = buildPresetCueLabel(section.label, preset?.name ?? presetId)
    const existing = trackCues.find(c => c.id === cueId)
    if (existing) {
      updatePresetAutomationCue(activeTrackId, cueId, { presetId, label, timeSec: section.startSec })
    } else {
      addPresetAutomationCue(activeTrackId, {
        id:           cueId,
        timeSec:      section.startSec,
        presetId,
        label,
        enabled:      true,
        transitionMs: 0,
        sectionId:    section.id,
      })
    }
  }, [activeTrackId, selectedSectionId, resolvedSections, reactPresets, trackCues, addPresetAutomationCue, updatePresetAutomationCue, removePresetAutomationCue])

  // Clears all sections: removes manual ones and suppresses all auto ones.
  // Also removes any linked preset automation cues for every section cleared.
  const handleDeleteAllSections = useCallback(() => {
    if (!activeTrackId) return
    for (const section of manualTrackSections) {
      removeManualSection(activeTrackId, section.id)
      removeCueForSection(section.id)
    }
    for (const section of autoSections) {
      if (!suppressedIds.includes(section.id)) {
        suppressAutoSection(activeTrackId, section.id)
        removeCueForSection(section.id)
      }
    }
    setEditorMode('none')
  }, [activeTrackId, manualTrackSections, autoSections, suppressedIds, removeManualSection, suppressAutoSection, removeCueForSection])

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
    <div className={`rv-track-map-strip${embedded ? ' rv-track-map-strip--embedded' : ''}`} ref={stripRef}>
      {!embedded && (
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
        <svg className="rv-track-map-status-icon" width="14" height="14" viewBox="0 0 512 512" fill="#38bdf8">
          <path d="M29.002,0v368.238L256.002,512l226.996-143.762V0H29.002z M379.593,247.561H287.92v91.659h-63.836v-91.659h-91.673v-63.843h91.673v-91.68h63.836v91.68h91.673V247.561z"/>
        </svg>
        <span className="rv-strip-title">Track Map</span>
        <span className="rv-strip-title-sub">Timeline lanes</span>
        {hasTrack && currentAnalysisStatus !== 'not_analyzed' && (
          <span
            className="rv-strip-status-dot"
            style={{ color: STATUS_COLORS[currentAnalysisStatus] }}
            title={STATUS_LABELS[currentAnalysisStatus]}
          >
            {isWorking ? '◌' : currentAnalysisStatus === 'failed' ? '✕' : '●'}
          </span>
        )}
        {isComplete && (
          currentBpmReanalysisStatus === 'reanalyzing' ? (
            <span className="rv-strip-analysis-badge rv-strip-analysis-badge--progress">◌ Reanalyzing…</span>
          ) : gridStale && currentBpmReanalysisStatus === 'failed' ? (
            <span className="rv-strip-analysis-badge rv-strip-analysis-badge--err" title="Reanalysis failed — adjust BPM and try again from the dock">✕ Failed</span>
          ) : gridStale ? (
            <span className="rv-strip-analysis-badge rv-strip-analysis-badge--stale" title="Beat grid is out of sync with the current BPM">⚠ Grid stale</span>
          ) : null
        )}
        {(isComplete || isMicSource) && (
          <span className="rv-strip-header-meta">
            {bpmDisplay}
            {keyLabel && <span className="rv-meta-key">{keyLabel}</span>}
            {isComplete && currentAnalysis && (
              <span className="rv-meta-counts">
                {currentAnalysis.beatGrid.length} beats
                {currentAnalysis.sections.length > 0 && ` · ${currentAnalysis.sections.length} sections`}
              </span>
            )}
          </span>
        )}
        <span className="rv-collapse-arrow">{collapsed ? '▶' : '▼'}</span>
      </div>
      )}

      {(!collapsed || embedded) && (
        <>
          {!hasTrack && (
            <div className="rv-strip-empty">
              Load a track to generate its beat grid, energy map, sections, and cue lanes.
            </div>
          )}
          {hasTrack && currentAnalysisStatus === 'not_analyzed' && (
            <div className="rv-strip-empty">Track loaded — analysis will begin shortly.</div>
          )}
          {hasTrack && isWorking && (
            <div className="rv-strip-analyzing">
              <span className="rv-analyzing-spinner">◌</span>
              <span className="rv-analyzing-label">{STATUS_LABELS[currentAnalysisStatus]}</span>
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
          {isComplete && !hasValidData && (
            <div className="rv-strip-failed">
              <span className="rv-failed-icon">⚠</span>
              <span className="rv-failed-message">
                Analysis completed but returned no beat or section data.
              </span>
              <button className="rv-retry-btn" onClick={handleReanalyze} title="Run fresh analysis">
                ↺ Reanalyze
              </button>
            </div>
          )}

          {isComplete && (() => {
            const selectedSection = editorMode === 'edit' && selectedSectionId
              ? resolvedSections.find(s => s.id === selectedSectionId) ?? null
              : null
            const editorDragPreview = dragPreview?.sectionId === selectedSectionId
              ? { start: dragPreview.start, end: dragPreview.end }
              : null
            const isSectionDetailOpen = editorMode === 'edit' && selectedSection != null
            const selectedSectionColor = selectedSection ? SECTION_COLORS[selectedSection.type] : '#4ac7db'
            const selectedSectionBars = selectedSection
              ? buildBarRange(selectedSection, currentEffectiveBeatGrid ?? currentAnalysis?.beatGrid ?? [])
              : null
            const selectedSectionDuration = selectedSection
              ? Math.max(0, selectedSection.endSec - selectedSection.startSec)
              : 0
            const selectedSectionPresetCue = selectedSection
              ? trackCues.find(c => c.id === buildPresetCueId(selectedSection.id)) ?? null
              : null
            const selectedSectionPreset = selectedSectionPresetCue
              ? reactPresets.find(p => p.id === selectedSectionPresetCue.presetId) ?? null
              : null

            return (
              <>
                {isSectionDetailOpen && selectedSection ? (
                  <div className="rv-timeline-detail-overview" aria-label="Selected section overview">
                    <button
                      type="button"
                      className="rv-timeline-detail-back"
                      onClick={closeSectionEditor}
                      aria-label="Back to full Track Map"
                      title="Back to full Track Map"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <span
                      className="rv-timeline-detail-color"
                      style={{ '--section-color': selectedSectionColor } as React.CSSProperties}
                      aria-hidden="true"
                    />
                    <div className="rv-timeline-detail-title">
                      <strong>{selectedSection.label}</strong>
                      <span>{selectedSection.type} section</span>
                    </div>
                    <div className="rv-timeline-detail-meta">
                      <span>{formatTimePrecise(selectedSection.startSec)} → {formatTimePrecise(selectedSection.endSec)}</span>
                      <span>{selectedSectionDuration.toFixed(1)}s</span>
                      {selectedSectionBars && <span>Bars {selectedSectionBars}</span>}
                      <span>{Math.round(selectedSection.intensity * 100)}%</span>
                      <span>{selectedSectionPreset?.name ?? 'No preset'}</span>
                    </div>
                  </div>
                ) : (
                <div className="rv-timeline-lanes" aria-label="Expandable Track Map timeline lanes">
                  <div
                    className="rv-timeline-lane rv-timeline-lane--beats"
                    role="group"
                    aria-label="Beat Grid"
                  >
                    <div className="rv-timeline-lane-content rv-beat-canvas-wrap">
                      <canvas ref={beatCanvasRef} className="rv-beat-canvas" aria-hidden="true" />
                    </div>
                    <div
                      className="rv-timeline-lane-tools rv-timeline-lane-state"
                      title={`Beat Grid ${beatGridEnabled ? 'enabled' : 'disabled'}`}
                      aria-label={`Beat Grid ${beatGridEnabled ? 'enabled' : 'disabled'}`}
                    >
                      {beatGridEnabled ? 'ON' : 'OFF'}
                    </div>
                  </div>

                  <div
                    className="rv-timeline-lane rv-timeline-lane--sections"
                    role="group"
                    aria-label="Sections"
                  >
                    <div className="rv-timeline-lane-content">
                      {resolvedSections.length > 0 ? (
                        <SectionTimeline
                          ref={sectionTimelineRef}
                          sections={resolvedSections}
                          durationSec={durationSec}
                          viewport={viewportRef.current}
                          viewportRef={viewportRef}
                          beatGrid={currentEffectiveBeatGrid ?? currentAnalysis?.beatGrid ?? undefined}
                          effectiveBpm={currentEffectiveBpm}
                          selectedId={selectedSectionId}
                          onSelect={handleSelectSection}
                          onRemove={activeTrackId ? handleRemove : undefined}
                          onCommitBoundary={handleCommitBoundary}
                          onDragPreview={handleDragPreview}
                          presetAssignedSectionIds={assignedSectionIds}
                        />
                      ) : (
                        <div className="rv-timeline-lane-empty">
                          No sections yet. Use + to create one.
                        </div>
                      )}
                    </div>
                    <div className="rv-timeline-lane-tools">
                      <button
                        className="rv-timeline-tool-btn"
                        onClick={handleReanalyze}
                        title="Force fresh analysis"
                        aria-label="Reanalyze track sections"
                      >↺</button>
                      <button
                        className="rv-timeline-tool-btn rv-timeline-tool-btn--danger"
                        onClick={handleDeleteAllSections}
                        title="Clear all sections"
                        aria-label="Clear all sections"
                        disabled={resolvedSections.length === 0}
                      >✕</button>
                      <button
                        className="rv-timeline-tool-btn rv-timeline-tool-btn--accent"
                        onClick={() => {
                          if (editorMode === 'create') {
                            setEditorMode('none')
                          } else {
                            if (activeTrackId) setSelectedSectionIdForTrack(activeTrackId, null)
                            setEditorMode('create')
                          }
                        }}
                        title="Add a manual section"
                        aria-label="Add a manual section"
                        disabled={!activeTrackId}
                      >{editorMode === 'create' ? '−' : '+'}</button>
                    </div>
                  </div>

                  {SHOW_ENERGY_LANE && (
                    <div
                      className="rv-timeline-lane rv-timeline-lane--energy"
                      role="group"
                      aria-label="Energy Intensity"
                    >
                      <div className="rv-timeline-lane-content">
                        <canvas ref={energyCanvasRef} className="rv-energy-canvas" aria-hidden="true" />
                      </div>
                      <div className="rv-timeline-lane-tools">
                        <select
                          className="rv-timeline-lane-select"
                          value={energyCurveKey}
                          onChange={e => setEnergyCurveKey(e.target.value as EnergyCurveKey)}
                          title="Energy curve"
                          aria-label="Energy curve"
                        >
                          {ENERGY_CURVE_OPTIONS.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div
                    className="rv-timeline-lane rv-timeline-lane--cues"
                    role="group"
                    aria-label="Cues and Presets"
                  >
                    <div ref={cueTimelineRef} className="rv-timeline-lane-content rv-timeline-cue-lane">
                      {timelineCueItems.map(cue => {
                        const layout = computeTimelineCueLayout(cue.timeSec, viewportRef.current)
                        return (
                          <button
                            key={cue.id}
                            type="button"
                            data-timeline-cue
                            data-cue-time={cue.timeSec}
                            className={`rv-timeline-cue rv-timeline-cue--${cue.kind}${cue.enabled ? '' : ' rv-timeline-cue--disabled'}`}
                            style={{
                              display: layout.visible ? undefined : 'none',
                              left: `${layout.leftPct}%`,
                              '--cue-color': cue.color,
                            } as React.CSSProperties}
                            onClick={() => engine.seek(cue.timeSec)}
                            title={`${cue.label} · ${formatTimePrecise(cue.timeSec)}`}
                          >
                            <span className="rv-timeline-cue-diamond" aria-hidden="true" />
                            <span className="rv-timeline-cue-label">{cue.label}</span>
                          </button>
                        )
                      })}
                      {timelineCueItems.length === 0 && (
                        <span className="rv-timeline-lane-empty">No cue or preset markers</span>
                      )}
                    </div>
                    <div
                      className="rv-timeline-lane-tools rv-timeline-lane-state"
                      title={`${timelineCueItems.length} cue or preset marker${timelineCueItems.length === 1 ? '' : 's'}`}
                      aria-label={`${timelineCueItems.length} cue or preset marker${timelineCueItems.length === 1 ? '' : 's'}`}
                    >
                      {timelineCueItems.length}
                    </div>
                  </div>

                  <div
                    className="rv-timeline-lane rv-timeline-lane--ruler"
                    role="group"
                    aria-label="Visible Range"
                  >
                    <div className="rv-timeline-lane-content rv-timeline-ruler-content">
                      <canvas ref={rulerCanvasRef} className="rv-timeline-ruler-canvas" aria-hidden="true" />
                    </div>
                    <div className="rv-timeline-lane-tools rv-timeline-zoom-readout" title="Waveform zoom">
                      {waveformZoom}×
                    </div>
                  </div>

                  <div className="rv-timeline-playhead-layer" aria-hidden="true">
                    <div ref={playheadRef} className="rv-timeline-shared-playhead" />
                  </div>
                </div>
                )}

                {(editorMode === 'create' || (editorMode === 'edit' && selectedSection)) && (
                  <div className="rv-timeline-editor-drawer">
                    {editorMode === 'create' && (
                      <>
                        <div className="rv-timeline-editor-heading">
                          <span>New Section</span>
                          <button
                            type="button"
                            className="rv-timeline-editor-close"
                            onClick={closeSectionEditor}
                            aria-label="Close section editor"
                          >×</button>
                        </div>
                        <AddSectionForm onAdd={handleAdd} onCancel={closeSectionEditor} />
                      </>
                    )}
                    {editorMode === 'edit' && selectedSection && (() => {
                      const src = selectedSection.source
                      const isAuto = src === 'auto'
                      const isEdited = src === 'user-edited-auto'
                      const isUser = !isAuto && !isEdited
                      return (
                        <EditSectionForm
                          section={selectedSection}
                          durationSec={durationSec}
                          effectiveBpm={currentEffectiveBpm}
                          dragPreview={editorDragPreview}
                          onSave={handleSaveSection}
                          onCancel={closeSectionEditor}
                          onDelete={isUser ? handleDeleteSection : undefined}
                          onRestore={isEdited ? handleRestoreSection : undefined}
                          onSuppress={isAuto ? handleSuppressSection : undefined}
                          reactPresets={reactPresets}
                          assignedPresetId={
                            trackCues.find(c => c.id === buildPresetCueId(selectedSection.id))?.presetId ?? null
                          }
                          onAssignPreset={handleAssignPreset}
                        />
                      )
                    })()}
                  </div>
                )}
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}
