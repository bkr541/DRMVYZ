import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useVisualStore } from '../../stores/visualStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useLyricsStore } from '../../stores/lyricsStore'
import { useSharedAudio } from '../../context/AudioEngineContext'
import { useWaveformPeaks } from './hooks/useWaveformPeaks'
import { generateVideoFilmstrip } from './media/generateThumbnail'
import type { VzTimelineClip, VzTimelineMediaClip, VzTimelineEffectRegion, VzOverlayCompositingConfig } from '../../types/timeline'
import type { VzLayerConfig, VzLayerItem, SelectedTimelineEntity } from '../../stores/visualStore'
import { LAYER_LABELS } from '../../types/vzLayers'
import type { VzTransitionConfig, VzTransitionType, VzTransitionEasing } from '../../types/timeline'
import { DEFAULT_OVERLAY_COMPOSITING, resolveClipGlobalFx } from '../../types/timeline'
import type { UploadedMedia } from '../../stores/mediaStore'
import type { LyricCue } from '../../types/lyrics'
import { CursorInfo01Icon } from 'hugeicons-react'
import { getTimelineDuration, getTimelineProjectDuration, TRANSITION_LABELS, TRANSITION_DEFAULTS, isClipSnapToBpmEnabled } from '../../lib/timeline'
import { MEDIA_ROLE_LABELS, MEDIA_ROLE_BADGE_LABELS, MEDIA_ROLES } from '../../lib/mediaRoles'
import type { MediaRole } from '../../lib/mediaRoles'
import type { VzColorGrade } from '../../types/vzColorGrade'
import { DEFAULT_COLOR_GRADE } from '../../types/vzColorGrade'
import { COLOR_GRADE_PRESETS, applyColorGradePreset, matchColorGradePreset } from '../../lib/colorGradePresets'
import { EFFECT_MODULES } from './effects/registry'
import {
  MIN_CLIP_DUR, BASE_PX_PER_SEC,
  timeToPx, pxToTime, fmtTimelineLabel, fmtSec, clampSec, snapSec, rulerTickInterval,
} from './timeline/tlHelpers'

// ── Types ────────────────────────────────────────────────────────────────

type SelectedEntity = SelectedTimelineEntity | null

type DragKind = 'move' | 'resize-right' | 'resize-left'

interface DragData {
  kind: DragKind
  clipId: string
  lane: 'bg' | 'overlay' | 'effect'
  startClientX: number
  origStartSec: number
  origDurSec: number
}

interface LiveDrag {
  id: string
  startSec: number
  durationSec: number
}

// ── Lyric-specific drag types ─────────────────────────────────────────────
interface LyricDragData {
  kind: DragKind
  cueId: string
  startClientX: number
  /** Raw cue startMs at drag start (NOT offset-adjusted) */
  origStartMs: number
  /** Raw cue endMs at drag start */
  origEndMs: number
}

interface LiveLyricDrag {
  id: string
  /** Live raw startMs (NOT offset-adjusted) */
  startMs: number
  /** Live raw endMs */
  endMs: number
}

// ── Helpers ──────────────────────────────────────────────────────────────

function resolveMediaDuration(m: UploadedMedia | null | undefined): number {
  const d = m?.metadata?.duration
  return typeof d === 'number' && isFinite(d) && d > 0 ? d : 5
}

const EFFECT_LIST       = Array.from(EFFECT_MODULES.entries()).map(([id, m]) => ({ id, label: m.label }))
const MIN_LYRIC_DUR_MS  = 100

// ── TimelineRuler ────────────────────────────────────────────────────────

function TimelineRuler({
  totalDuration, pxPerSec, onScrub,
}: {
  totalDuration: number
  pxPerSec: number
  onScrub: (t: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const interval = rulerTickInterval(totalDuration, pxPerSec)
  const count    = Math.ceil(totalDuration / interval) + 2
  const ticks    = Array.from({ length: count }, (_, i) => i * interval)
  const width    = Math.max(600, timeToPx(totalDuration, pxPerSec) + 120)

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ref.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = ref.current.getBoundingClientRect()
    onScrub(clampSec((e.clientX - rect.left) / pxPerSec, 0, totalDuration))
  }
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    onScrub(clampSec((e.clientX - rect.left) / pxPerSec, 0, totalDuration))
  }

  return (
    <div
      ref={ref}
      className="vz-ml-ruler"
      style={{ width }}
      onPointerDown={handlePointer}
      onPointerMove={handleMove}
    >
      {ticks.map(t => (
        <div key={t} className="vz-ml-ruler-tick" style={{ left: timeToPx(t, pxPerSec) }}>
          <span className="vz-ml-ruler-label">{fmtTimelineLabel(t)}</span>
        </div>
      ))}
    </div>
  )
}

// ── TimelineWaveformCanvas ────────────────────────────────────────────────

const WAVE_ELAPSED  = 'rgba(97,214,170,0.72)'
const WAVE_UPCOMING = 'rgba(255,255,255,0.13)'

function TimelineWaveformCanvas({
  peaks, loading, audioDuration, currentTime,
}: {
  peaks:         number[] | null
  loading:       boolean
  audioDuration: number
  currentTime:   number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef  = useRef({ peaks, loading, audioDuration, currentTime })
  propsRef.current = { peaks, loading, audioDuration, currentTime }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    if (!W || !H) return

    const { peaks: pk, loading: ld, audioDuration: dur, currentTime: ct } = propsRef.current
    ctx.clearRect(0, 0, W, H)

    // Loading placeholder — dim sine-wave shape
    if (ld && !pk) {
      for (let i = 0; i < 60; i++) {
        const barH = (Math.sin(i * 0.4) * 0.22 + 0.12) * H
        ctx.fillStyle = 'rgba(97,214,170,0.07)'
        ctx.fillRect((i / 60) * W + 0.5, (H - barH) / 2, W / 60 - 1, barH)
      }
      return
    }
    if (!pk || pk.length === 0 || dur <= 0) return

    const bw = W / pk.length
    for (let i = 0; i < pk.length; i++) {
      const barT = (i / pk.length) * dur
      const barH = Math.max(1, pk[i] * (H - 2))
      ctx.fillStyle = barT < ct ? WAVE_ELAPSED : WAVE_UPCOMING
      ctx.fillRect(i * bw, (H - barH) / 2, Math.max(1, bw - 0.3), barH)
    }
    // Soft elapsed tint
    const phX = Math.min((ct / dur) * W, W)
    if (phX > 1) {
      const g = ctx.createLinearGradient(0, 0, phX, 0)
      g.addColorStop(0, 'rgba(97,214,170,0.07)')
      g.addColorStop(1, 'rgba(97,214,170,0.02)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, phX, H)
    }
  }, [])

  useEffect(() => { draw() }, [draw, peaks, loading, audioDuration, currentTime])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        canvas.width  = Math.round(e.contentRect.width)
        canvas.height = Math.round(e.contentRect.height)
        draw()
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  return <canvas ref={canvasRef} className="vz-ml-waveform-canvas" aria-hidden="true" />
}

// ── ClipBlock ────────────────────────────────────────────────────────────

function ClipBlock({
  clip, media, pxPerSec, isSelected, lane, liveDrag,
  onSelect, onDragStart, onResizeLeft, onResizeRight, onDelete,
}: {
  clip: VzTimelineMediaClip
  media: UploadedMedia | undefined
  pxPerSec: number
  isSelected: boolean
  lane: 'bg' | 'overlay'
  liveDrag: LiveDrag | null
  onSelect: () => void
  onDragStart: (e: React.PointerEvent) => void
  onResizeLeft: (e: React.PointerEvent) => void
  onResizeRight: (e: React.PointerEvent) => void
  onDelete: () => void
}) {
  const live       = liveDrag?.id === clip.id ? liveDrag : null
  const start      = live?.startSec    ?? clip.startSec
  const dur        = live?.durationSec ?? clip.durationSec
  const isDragging = live !== null
  const px         = Math.max(4, timeToPx(dur, pxPerSec))
  const laneClass  = lane === 'bg' ? 'vz-ml-clip--bg' : 'vz-ml-clip--overlay'

  // ── Media artwork ───────────────────────────────────────────────────────
  const isVideo  = media?.type === 'video'
  const thumbUrl = media?.thumbnailUrl ?? media?.localThumbnailObjectUrl ?? null
  const [filmstrip, setFilmstrip] = useState<string[]>([])

  useEffect(() => {
    if (!isVideo || !media?.url) { setFilmstrip([]); return }
    let alive = true
    generateVideoFilmstrip(media.url, 6, clip.mediaInSec, clip.mediaOutSec)
      .then(frames => { if (alive) setFilmstrip(frames) })
    return () => { alive = false }
  }, [isVideo, media?.url, clip.mediaInSec, clip.mediaOutSec])

  // Show as many frames as fit at ~32px each; at least 1 when filmstrip exists
  const frameCount = filmstrip.length > 0
    ? Math.min(filmstrip.length, Math.max(1, Math.floor(px / 32)))
    : 0

  const clipLabel = media?.title ?? media?.name ?? '(missing)'

  return (
    <div
      className={[
        'vz-ml-clip',
        laneClass,
        isSelected  ? 'vz-ml-clip--sel'  : '',
        isDragging  ? 'vz-ml-clip--drag' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: timeToPx(start, pxPerSec), width: px }}
      title={`${clipLabel} — ${fmtSec(dur)}`}
      onPointerDown={e => { onSelect(); onDragStart(e) }}
    >
      {/* Artwork layer — behind all interactive elements */}
      {frameCount > 0 ? (
        <div className="vz-ml-clip-filmstrip" aria-hidden="true">
          {filmstrip.slice(0, frameCount).map((src, i) => (
            <img key={i} src={src} className="vz-ml-clip-filmframe" alt="" />
          ))}
        </div>
      ) : thumbUrl ? (
        <img src={thumbUrl} className="vz-ml-clip-thumb" alt="" />
      ) : null}

      {/* Handles and label */}
      <div
        className="vz-ml-clip-lhandle"
        onPointerDown={e => { e.stopPropagation(); onResizeLeft(e) }}
      />
      <span className="vz-ml-clip-name">{clipLabel}</span>
      <div
        className="vz-ml-clip-rhandle"
        onPointerDown={e => { e.stopPropagation(); onResizeRight(e) }}
      />
      <button
        className="vz-ml-clip-del"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete"
      >✕</button>
    </div>
  )
}

// ── EffectBlock ──────────────────────────────────────────────────────────

function EffectBlock({
  region, pxPerSec, isSelected, liveDrag,
  onSelect, onDragStart, onResizeLeft, onResizeRight, onDelete,
}: {
  region: VzTimelineEffectRegion
  pxPerSec: number
  isSelected: boolean
  liveDrag: LiveDrag | null
  onSelect: () => void
  onDragStart: (e: React.PointerEvent) => void
  onResizeLeft: (e: React.PointerEvent) => void
  onResizeRight: (e: React.PointerEvent) => void
  onDelete: () => void
}) {
  const live       = liveDrag?.id === region.id ? liveDrag : null
  const start      = live?.startSec    ?? region.startSec
  const dur        = live?.durationSec ?? region.durationSec
  const isDragging = live !== null
  const mod        = EFFECT_MODULES.get(region.effectId)
  const label      = mod?.label ?? region.effectId
  const category   = mod?.category ?? ''
  const px         = Math.max(4, timeToPx(dur, pxPerSec))

  return (
    <div
      className={[
        'vz-ml-effect',
        category   ? `vz-ml-effect--cat-${category}` : '',
        isSelected  ? 'vz-ml-effect--sel'              : '',
        isDragging  ? 'vz-ml-effect--drag'             : '',
        !region.enabled ? 'vz-ml-effect--off'          : '',
      ].filter(Boolean).join(' ')}
      style={{ left: timeToPx(start, pxPerSec), width: px }}
      title={`${label} — ${fmtSec(dur)}${!region.enabled ? ' (disabled)' : ' (planned)'}`}
      onPointerDown={e => { onSelect(); onDragStart(e) }}
    >
      <div
        className="vz-ml-clip-lhandle"
        onPointerDown={e => { e.stopPropagation(); onResizeLeft(e) }}
      />
      <span className="vz-ml-effect-name">{label}</span>
      {region.enabled && px > 60 && <span className="vz-ml-effect-plan-badge">PLAN</span>}
      <div
        className="vz-ml-clip-rhandle"
        onPointerDown={e => { e.stopPropagation(); onResizeRight(e) }}
      />
      <button
        className="vz-ml-clip-del"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete"
      >✕</button>
    </div>
  )
}

// ── LyricBlock ───────────────────────────────────────────────────────────

function LyricBlock({
  cue, pxPerSec, isSelected, globalOffsetSec, liveLyricDrag,
  onSelect, onDragStart, onResizeLeft, onResizeRight, onDelete,
}: {
  cue: LyricCue
  pxPerSec: number
  isSelected: boolean
  globalOffsetSec: number
  liveLyricDrag: LiveLyricDrag | null
  onSelect: () => void
  onDragStart: (e: React.PointerEvent) => void
  onResizeLeft: (e: React.PointerEvent) => void
  onResizeRight: (e: React.PointerEvent) => void
  onDelete: () => void
}) {
  const live = liveLyricDrag?.id === cue.id ? liveLyricDrag : null
  // Display positions use RAW cue times + global offset
  // so visible position matches actual canvas render time
  const rawStartMs = live?.startMs ?? cue.startMs
  const rawEndMs   = live?.endMs   ?? cue.endMs
  const startSec   = rawStartMs / 1000 + globalOffsetSec
  const durSec     = Math.max(0.1, (rawEndMs - rawStartMs) / 1000)
  const px         = Math.max(4, timeToPx(durSec, pxPerSec))
  const isDragging = live !== null

  return (
    <div
      className={[
        'vz-ml-lyric',
        isSelected  ? 'vz-ml-lyric--sel'  : '',
        isDragging  ? 'vz-ml-lyric--drag' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: timeToPx(Math.max(0, startSec), pxPerSec), width: px }}
      title={`${cue.text} (${fmtSec(startSec)} → ${fmtSec(startSec + durSec)})`}
      onPointerDown={e => { onSelect(); onDragStart(e) }}
    >
      <div
        className="vz-ml-clip-lhandle"
        onPointerDown={e => { e.stopPropagation(); onResizeLeft(e) }}
      />
      <span className="vz-ml-lyric-text">{cue.text || '…'}</span>
      <div
        className="vz-ml-clip-rhandle"
        onPointerDown={e => { e.stopPropagation(); onResizeRight(e) }}
      />
      <button
        className="vz-ml-clip-del"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete"
      >✕</button>
    </div>
  )
}

// ── Color grade controls ────────────────────────────────────────────────

/** A single labeled slider row for a color grade parameter. */
function ColorGradeSlider({
  label, value, min, max, onChange, badge,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  badge?: string
}) {
  return (
    <div className="vz-cg-slider-row">
      <span className="vz-cg-slider-lbl">
        {label}
        {badge && <span className="vz-cg-badge" title="GPU only — not applied in Canvas 2D mode">{badge}</span>}
      </span>
      <input
        type="range"
        className="vz-cg-slider"
        min={min} max={max} step={1}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
      />
      <span className="vz-cg-slider-val">{value}</span>
    </div>
  )
}

/**
 * Color grade editor used inside the Inspector Color group for video sources
 * (background clips, overlay clips, layer items).
 */
function ColorGradeControls({
  grade, onChange, onReset, isGpu,
}: {
  grade: VzColorGrade
  onChange: (patch: Partial<VzColorGrade>) => void
  onReset: () => void
  isGpu: boolean
}) {
  const previewBypass = useVisualStore(s => s.colorGradePreviewBypass)
  const setPreviewBypass = useVisualStore(s => s.setColorGradePreviewBypass)
  const matchedPreset = matchColorGradePreset(grade)
  const toneBadge = isGpu ? undefined : 'GPU'

  return (
    <div className="vz-cg">
      <div className="vz-cg-toprow">
        <label className="vz-ml-insp-check vz-cg-enable" title="Enable color grade for this source">
          <input type="checkbox" checked={grade.enabled}
            onChange={e => onChange({ enabled: e.target.checked })}
          />
          Enable
        </label>
        <button
          className={`vz-cg-ba-btn${previewBypass ? ' vz-cg-ba-btn--active' : ''}`}
          title="Hold to compare graded vs ungraded output"
          onMouseDown={() => setPreviewBypass(true)}
          onMouseUp={() => setPreviewBypass(false)}
          onMouseLeave={() => previewBypass && setPreviewBypass(false)}
          onClick={() => setPreviewBypass(!previewBypass)}
        >
          {previewBypass ? 'Before' : 'After'}
        </button>
        <button className="vz-cg-reset-btn" title="Reset all color grade values" onClick={onReset}>Reset</button>
      </div>

      <div className="vz-ml-insp-section-label">LOOKS</div>
      <div className="vz-cg-looks-row">
        <select className="az-select vz-ml-insp-sel" value={matchedPreset ?? ''}
          onChange={e => {
            const next = applyColorGradePreset(e.target.value, grade)
            if (next) onChange(next)
          }}>
          {!matchedPreset && <option value="" disabled>Custom…</option>}
          {COLOR_GRADE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="vz-ml-insp-section-label">BASIC</div>
      <ColorGradeSlider label="Brightness" value={grade.brightness} min={-100} max={100} onChange={v => onChange({ brightness: v })} />
      <ColorGradeSlider label="Contrast"   value={grade.contrast}   min={-100} max={100} onChange={v => onChange({ contrast: v })} />
      <ColorGradeSlider label="Saturation" value={grade.saturation} min={-100} max={100} onChange={v => onChange({ saturation: v })} />
      <ColorGradeSlider label="Hue"        value={grade.hueRotation} min={-180} max={180} onChange={v => onChange({ hueRotation: v })} />

      <div className="vz-ml-insp-section-label">TONE</div>
      <ColorGradeSlider label="Temperature" value={grade.temperature} min={-100} max={100} onChange={v => onChange({ temperature: v })} badge={toneBadge} />
      <ColorGradeSlider label="Tint"        value={grade.tint}        min={-100} max={100} onChange={v => onChange({ tint: v })} badge={toneBadge} />

      {!isGpu && (
        <div className="vz-ml-insp-hint">Temperature &amp; Tint require the GPU renderer (WebGL2).</div>
      )}
    </div>
  )
}

// ── Inspector sub-panels ────────────────────────────────────────────────

function BgClipInspector({
  clip, media, idx, total, isGpu,
  onMove, onRemove, onDuplicate, onUpdate, onSetMediaRole, onClearFx,
}: {
  clip: VzTimelineMediaClip
  media: UploadedMedia | undefined
  idx: number
  total: number
  isGpu: boolean
  onMove: (id: string, dir: -1 | 1) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onUpdate: (id: string, patch: Partial<Omit<VzTimelineMediaClip, 'id' | 'lane'>>) => void
  onSetMediaRole: (mediaId: string, role: MediaRole) => void
  onClearFx: (id: string) => void
}) {
  const grade = clip.colorGrade ?? DEFAULT_COLOR_GRADE
  return (
    <div className="vz-ml-insp-body">
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Info</span>
        </div>
        <div className="vz-ml-insp-group-body">
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">File</span>
            <span className="vz-ml-insp-val vz-ml-insp-fname" title={media?.name}>{media?.title ?? media?.name ?? '(missing)'}</span>
            <span className="vz-ml-insp-lbl">Role</span>
            <select className="az-select vz-ml-insp-sel" value={media?.mediaRole ?? 'other'} disabled={!media}
              onChange={e => media && onSetMediaRole(media.id, e.target.value as MediaRole)}>
              {MEDIA_ROLES.map(r => <option key={r} value={r}>{MEDIA_ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="vz-ml-insp-row vz-ml-insp-row--grid4">
            <span className="vz-ml-insp-lbl">Start (s)</span>
            <input type="number" className="vz-ml-insp-num" min={0} step={0.1}
              value={parseFloat(clip.startSec.toFixed(2))}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) onUpdate(clip.id, { startSec: v }) }}
            />
            <span className="vz-ml-insp-lbl">Dur (s)</span>
            <input type="number" className="vz-ml-insp-num" min={MIN_CLIP_DUR} max={3600} step={0.25}
              value={clip.durationSec}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= MIN_CLIP_DUR) onUpdate(clip.id, { durationSec: v }) }}
            />
            <span className="vz-ml-insp-lbl">In</span>
            <input type="number" className="vz-ml-insp-num" min={0} step={0.1} value={clip.mediaInSec}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) onUpdate(clip.id, { mediaInSec: v }) }}
            />
            <span className="vz-ml-insp-lbl">Out</span>
            <input type="number" className="vz-ml-insp-num" min={0} step={0.1} value={clip.mediaOutSec ?? ''}
              placeholder="end"
              onChange={e => {
                const raw = e.target.value.trim()
                onUpdate(clip.id, { mediaOutSec: raw === '' ? undefined : parseFloat(raw) || undefined })
              }}
            />
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Mode</span>
            <select className="az-select vz-ml-insp-sel" value={clip.playbackMode}
              onChange={e => onUpdate(clip.id, { playbackMode: e.target.value as VzTimelineClip['playbackMode'] })}>
              <option value="trim">Trim</option>
              <option value="loop">Loop</option>
              <option value="freeze">Freeze</option>
            </select>
            <span className="vz-ml-insp-lbl">Fit</span>
            <select className="az-select vz-ml-insp-sel" value={clip.fitMode}
              onChange={e => onUpdate(clip.id, { fitMode: e.target.value as VzTimelineClip['fitMode'] })}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </div>
          <div className="vz-cg-slider-row">
            <span className="vz-cg-slider-lbl">Size</span>
            <input type="range" className="vz-cg-slider" min={10} max={300} step={1}
              value={Math.round((clip.mediaScale ?? 1) * 100)}
              onChange={e => onUpdate(clip.id, { mediaScale: parseInt(e.target.value, 10) / 100 })}
            />
            <span className="vz-cg-slider-val">{Math.round((clip.mediaScale ?? 1) * 100)}%</span>
          </div>
          {media?.type === 'video' && (
            <div className="vz-ml-insp-row">
              <label className="vz-ml-insp-toggle" title={isClipSnapToBpmEnabled(clip) ? 'Lock this video to timeline timing' : 'Play this video at native speed'}>
                <input type="checkbox" className="vz-ml-insp-toggle-input" checked={isClipSnapToBpmEnabled(clip)}
                  onChange={e => onUpdate(clip.id, { snapToBpm: e.target.checked })}
                />
                <span className="vz-ml-insp-toggle-track" />
                Snap to BPM
              </label>
            </div>
          )}
          <div className="vz-ml-insp-row">
            <label className="vz-ml-insp-toggle"
              title="When ON, this clip participates in global audio-reactive modulation (Bass Reactivity, Reactive Scale, Master Intensity). Off by default for background videos.">
              <input type="checkbox" className="vz-ml-insp-toggle-input"
                checked={resolveClipGlobalFx(clip.enableGlobalFx, media?.mediaRole ?? null)}
                onChange={e => onUpdate(clip.id, { enableGlobalFx: e.target.checked })}
              />
              <span className="vz-ml-insp-toggle-track" />
              Enable Global FX
            </label>
            <button
              className="vz-cg-reset-btn"
              style={{ marginLeft: 'auto' }}
              onClick={() => onClearFx(clip.id)}
              title="Reset color grade, disable Global FX, and remove clip-targeted effect regions">
              Clear FX
            </button>
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Transition</span>
            <select className="az-select vz-ml-insp-sel" value={clip.transitionOut?.type ?? 'cut'}
              onChange={e => {
                const type = e.target.value as VzTransitionType
                if (type === 'cut') { onUpdate(clip.id, { transitionOut: undefined }); return }
                const def = TRANSITION_DEFAULTS[type]
                onUpdate(clip.id, { transitionOut: { ...def, durationSec: clip.transitionOut?.durationSec ?? def.durationSec } })
              }}>
              {(Object.keys(TRANSITION_LABELS) as VzTransitionType[]).map(t => (
                <option key={t} value={t}>{TRANSITION_LABELS[t]}</option>
              ))}
            </select>
            {clip.transitionOut && clip.transitionOut.type !== 'cut' && (
              <>
                <input type="number" className="vz-ml-insp-num" min={0.1} max={clip.durationSec} step={0.1}
                  value={clip.transitionOut.durationSec} title="Overlap duration (s)"
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v > 0 && clip.transitionOut)
                      onUpdate(clip.id, { transitionOut: { ...clip.transitionOut, durationSec: v } })
                  }}
                />
                <select className="az-select vz-ml-insp-sel" value={clip.transitionOut.easing ?? 'linear'}
                  onChange={e => clip.transitionOut && onUpdate(clip.id, { transitionOut: { ...clip.transitionOut, easing: e.target.value as VzTransitionEasing } })}>
                  <option value="linear">Linear</option>
                  <option value="easeIn">Ease In</option>
                  <option value="easeOut">Ease Out</option>
                  <option value="easeInOut">Ease In/Out</option>
                  <option value="easeInCubic">Cubic In</option>
                  <option value="easeOutCubic">Cubic Out</option>
                  <option value="easeInOutCubic">Cubic In/Out</option>
                </select>
              </>
            )}
          </div>
          <div className="vz-ml-insp-row vz-ml-insp-actions">
            <button className="vz-tl-clip-btn vz-tl-clip-btn--move" disabled={idx === 0} onClick={() => onMove(clip.id, -1)} title="Move earlier">‹</button>
            <button className="vz-tl-clip-btn vz-tl-clip-btn--move" disabled={idx === total - 1} onClick={() => onMove(clip.id, 1)} title="Move later">›</button>
            <button className="vz-tl-clip-btn vz-tl-clip-btn--duplicate" onClick={() => onDuplicate(clip.id)} title="Duplicate">⧉</button>
            <button className="vz-tl-clip-btn vz-tl-clip-btn--remove" onClick={() => onRemove(clip.id)} title="Delete">✕</button>
          </div>
        </div>
      </div>
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Color</span>
        </div>
        <div className="vz-ml-insp-group-body">
          <ColorGradeControls
            grade={grade}
            isGpu={isGpu}
            onChange={patch => onUpdate(clip.id, { colorGrade: { ...grade, ...patch } })}
            onReset={() => onUpdate(clip.id, { colorGrade: { ...DEFAULT_COLOR_GRADE } })}
          />
        </div>
      </div>
    </div>
  )
}

const BLEND_MODES: { value: string; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'screen',      label: 'Screen' },
  { value: 'multiply',    label: 'Multiply' },
  { value: 'overlay',     label: 'Overlay' },
  { value: 'add',         label: 'Add' },
  { value: 'lighten',     label: 'Lighten' },
  { value: 'darken',      label: 'Darken' },
  { value: 'hard-light',  label: 'Hard Light' },
  { value: 'soft-light',  label: 'Soft Light' },
  { value: 'difference',  label: 'Difference' },
  { value: 'exclusion',   label: 'Exclusion' },
]

function OverlayClipInspector({
  clip, media, isGpu, onUpdate, onRemove, onDuplicate, onSetMediaRole, onClearFx,
}: {
  clip: VzTimelineMediaClip
  media: UploadedMedia | undefined
  isGpu: boolean
  onUpdate: (id: string, patch: Partial<Omit<VzTimelineMediaClip, 'id' | 'lane'>>) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onSetMediaRole: (mediaId: string, role: MediaRole) => void
  onClearFx: (id: string) => void
}) {
  const cfg: VzOverlayCompositingConfig = clip.compositingConfig ?? { ...DEFAULT_OVERLAY_COMPOSITING }
  const grade = clip.colorGrade ?? DEFAULT_COLOR_GRADE

  const patchCfg = (patch: Partial<VzOverlayCompositingConfig>) => {
    onUpdate(clip.id, { compositingConfig: { ...cfg, ...patch } })
  }

  return (
    <div className="vz-ml-insp-body">
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Info</span>
        </div>
        <div className="vz-ml-insp-group-body">
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">File</span>
            <span className="vz-ml-insp-val vz-ml-insp-fname" title={media?.name}>{media?.title ?? media?.name ?? '(missing)'}</span>
            <span className="vz-ml-insp-lbl">Role</span>
            <select className="az-select vz-ml-insp-sel" value={media?.mediaRole ?? 'other'} disabled={!media}
              onChange={e => media && onSetMediaRole(media.id, e.target.value as MediaRole)}>
              {MEDIA_ROLES.map(r => <option key={r} value={r}>{MEDIA_ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Start (s)</span>
            <input type="number" className="vz-ml-insp-num" min={0} step={0.1}
              value={parseFloat(clip.startSec.toFixed(2))}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) onUpdate(clip.id, { startSec: v }) }}
            />
            <span className="vz-ml-insp-lbl">Dur (s)</span>
            <input type="number" className="vz-ml-insp-num" min={MIN_CLIP_DUR} max={3600} step={0.25}
              value={clip.durationSec}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= MIN_CLIP_DUR) onUpdate(clip.id, { durationSec: v }) }}
            />
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Mode</span>
            <select className="az-select vz-ml-insp-sel" value={clip.playbackMode}
              onChange={e => onUpdate(clip.id, { playbackMode: e.target.value as VzTimelineClip['playbackMode'] })}>
              <option value="trim">Trim</option>
              <option value="loop">Loop</option>
              <option value="freeze">Freeze</option>
            </select>
            <span className="vz-ml-insp-lbl">Fit</span>
            <select className="az-select vz-ml-insp-sel" value={cfg.fitMode}
              onChange={e => patchCfg({ fitMode: e.target.value as VzOverlayCompositingConfig['fitMode'] })}>
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
            </select>
          </div>
          {media?.type === 'video' && (
            <div className="vz-ml-insp-row">
              <label className="vz-ml-insp-toggle" title={isClipSnapToBpmEnabled(clip) ? 'Lock this video to timeline timing' : 'Play this video at native speed'}>
                <input type="checkbox" className="vz-ml-insp-toggle-input" checked={isClipSnapToBpmEnabled(clip)}
                  onChange={e => onUpdate(clip.id, { snapToBpm: e.target.checked })}
                />
                <span className="vz-ml-insp-toggle-track" />
                Snap to BPM
              </label>
            </div>
          )}
          <div className="vz-ml-insp-row">
            <label className="vz-ml-insp-toggle"
              title="When ON, this clip participates in global audio-reactive modulation (Bass Reactivity, Reactive Scale, Master Intensity). On by default for overlay clips.">
              <input type="checkbox" className="vz-ml-insp-toggle-input"
                checked={resolveClipGlobalFx(clip.enableGlobalFx, media?.mediaRole ?? null)}
                onChange={e => onUpdate(clip.id, { enableGlobalFx: e.target.checked })}
              />
              <span className="vz-ml-insp-toggle-track" />
              Enable Global FX
            </label>
            <button
              className="vz-cg-reset-btn"
              style={{ marginLeft: 'auto' }}
              onClick={() => onClearFx(clip.id)}
              title="Reset color grade, disable Global FX, and remove clip-targeted effect regions">
              Clear FX
            </button>
          </div>

          {/* ── Compositing ── */}
          <div className="vz-ml-insp-section-label">COMPOSITING</div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">X</span>
            <input type="number" className="vz-ml-insp-num" min={0} max={1} step={0.05}
              value={parseFloat(cfg.posX.toFixed(3))}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) patchCfg({ posX: Math.max(0, Math.min(1, v)) }) }}
              title="Horizontal position (0=left, 0.5=center, 1=right)"
            />
            <span className="vz-ml-insp-lbl">Y</span>
            <input type="number" className="vz-ml-insp-num" min={0} max={1} step={0.05}
              value={parseFloat(cfg.posY.toFixed(3))}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) patchCfg({ posY: Math.max(0, Math.min(1, v)) }) }}
              title="Vertical position (0=top, 0.5=center, 1=bottom)"
            />
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Scale</span>
            <input type="number" className="vz-ml-insp-num" min={0.01} max={8} step={0.05}
              value={parseFloat(cfg.scale.toFixed(3))}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) patchCfg({ scale: v }) }}
            />
            <span className="vz-ml-insp-lbl">Rot °</span>
            <input type="number" className="vz-ml-insp-num" min={-360} max={360} step={1}
              value={Math.round(cfg.rotation)}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) patchCfg({ rotation: v }) }}
            />
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Opacity</span>
            <input type="range" min={0} max={1} step={0.01}
              value={cfg.opacity}
              onChange={e => patchCfg({ opacity: parseFloat(e.target.value) })}
              style={{ flex: 1 }}
            />
            <span className="vz-ml-insp-val" style={{ minWidth: 28, textAlign: 'right' }}>{Math.round(cfg.opacity * 100)}%</span>
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Blend</span>
            <select className="az-select vz-ml-insp-sel" value={cfg.blendMode}
              onChange={e => patchCfg({ blendMode: e.target.value })}>
              {BLEND_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="vz-ml-insp-row vz-ml-insp-actions">
            <button className="vz-tl-clip-btn vz-tl-clip-btn--duplicate" onClick={() => onDuplicate(clip.id)} title="Duplicate">⧉</button>
            <button className="vz-tl-clip-btn vz-tl-clip-btn--remove" onClick={() => onRemove(clip.id)} title="Delete">✕</button>
          </div>
        </div>
      </div>
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Color</span>
        </div>
        <div className="vz-ml-insp-group-body">
          <ColorGradeControls
            grade={grade}
            isGpu={isGpu}
            onChange={patch => onUpdate(clip.id, { colorGrade: { ...grade, ...patch } })}
            onReset={() => onUpdate(clip.id, { colorGrade: { ...DEFAULT_COLOR_GRADE } })}
          />
        </div>
      </div>
    </div>
  )
}

function EffectInspector({
  region, onUpdate, onRemove, bgClips, overlayClips, layerItems, mediaMap,
}: {
  region: VzTimelineEffectRegion
  onUpdate: (id: string, patch: Partial<Omit<VzTimelineEffectRegion, 'id'>>) => void
  onRemove: (id: string) => void
  bgClips: VzTimelineMediaClip[]
  overlayClips: VzTimelineMediaClip[]
  layerItems: VzLayerItem[]
  mediaMap: Map<string, UploadedMedia>
}) {
  const targetType = region.targetType ?? 'global'
  const targetId   = region.targetIds?.[0] ?? ''

  return (
    <div className="vz-ml-insp-body">
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Info</span>
        </div>
        <div className="vz-ml-insp-group-body">
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Effect</span>
            <select className="az-select vz-ml-insp-sel" value={region.effectId}
              onChange={e => onUpdate(region.id, { effectId: e.target.value })}>
              {EFFECT_LIST.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
            <label className="vz-ml-insp-check">
              <input type="checkbox" checked={region.enabled}
                onChange={e => onUpdate(region.id, { enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Start</span>
            <input type="number" className="vz-ml-insp-num" min={0} step={0.1}
              value={parseFloat(region.startSec.toFixed(2))}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) onUpdate(region.id, { startSec: v }) }}
            />
            <span className="vz-ml-insp-lbl">Dur (s)</span>
            <input type="number" className="vz-ml-insp-num" min={MIN_CLIP_DUR} step={0.25}
              value={region.durationSec}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= MIN_CLIP_DUR) onUpdate(region.id, { durationSec: v }) }}
            />
            {typeof region.intensity === 'number' && (
              <>
                <span className="vz-ml-insp-lbl">Intensity</span>
                <input type="number" className="vz-ml-insp-num" min={0} max={1} step={0.05}
                  value={region.intensity}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onUpdate(region.id, { intensity: Math.max(0, Math.min(1, v)) }) }}
                />
              </>
            )}
          </div>

          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Target</span>
            <select className="az-select vz-ml-insp-sel" value={targetType}
              onChange={e => onUpdate(region.id, {
                targetType: e.target.value as VzTimelineEffectRegion['targetType'],
                targetIds: [],
              })}>
              <option value="global">Global</option>
              <option value="layer">Layer</option>
              <option value="layerItem">Layer Item</option>
              <option value="clip">Clip</option>
            </select>
          </div>

          {targetType === 'layer' && (
            <div className="vz-ml-insp-row">
              <span className="vz-ml-insp-lbl">Layer</span>
              <select className="az-select vz-ml-insp-sel" value={targetId}
                onChange={e => onUpdate(region.id, { targetIds: [e.target.value] })}>
                <option value="" disabled>Select layer…</option>
                {(Object.keys(LAYER_LABELS) as Array<keyof typeof LAYER_LABELS>).map(id => (
                  <option key={id} value={id}>{LAYER_LABELS[id]}</option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'layerItem' && (
            <div className="vz-ml-insp-row">
              <span className="vz-ml-insp-lbl">Item</span>
              <select className="az-select vz-ml-insp-sel" value={targetId}
                onChange={e => onUpdate(region.id, { targetIds: [e.target.value] })}>
                <option value="" disabled>Select item…</option>
                {layerItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {LAYER_LABELS[item.layerId]}: {mediaMap.get(item.mediaId)?.name ?? item.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'clip' && (
            <div className="vz-ml-insp-row">
              <span className="vz-ml-insp-lbl">Clip</span>
              <select className="az-select vz-ml-insp-sel" value={targetId}
                onChange={e => onUpdate(region.id, { targetIds: [e.target.value] })}>
                <option value="" disabled>Select clip…</option>
                {bgClips.length > 0 && (
                  <optgroup label="Background">
                    {bgClips.map(c => (
                      <option key={c.id} value={c.id}>{mediaMap.get(c.mediaId)?.name ?? c.id.slice(0, 8)}</option>
                    ))}
                  </optgroup>
                )}
                {overlayClips.length > 0 && (
                  <optgroup label="Overlays">
                    {overlayClips.map(c => (
                      <option key={c.id} value={c.id}>{mediaMap.get(c.mediaId)?.name ?? c.id.slice(0, 8)}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          <div className="vz-ml-insp-row vz-ml-insp-actions">
            <button className="vz-tl-clip-btn vz-tl-clip-btn--remove" onClick={() => onRemove(region.id)} title="Delete">✕ Delete</button>
          </div>
        </div>
      </div>
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Color</span>
        </div>
        <div className="vz-ml-insp-group-body" />
      </div>
    </div>
  )
}

function LyricCueInspector({
  cue, globalOffsetSec, onUpdateTiming, onSeek, onSave, isSaving, isDirty, hasDocument,
}: {
  cue: LyricCue
  globalOffsetSec: number
  onUpdateTiming: (id: string, patch: { startMs?: number; endMs?: number }) => void
  onSeek: (sec: number) => void
  onSave: () => void
  isSaving: boolean
  isDirty: boolean
  hasDocument: boolean
}) {
  const [startVal, setStartVal] = useState(String(cue.startMs))
  const [endVal,   setEndVal]   = useState(String(cue.endMs))

  // Keep inputs in sync when store updates (e.g. drag ends)
  useEffect(() => { setStartVal(String(cue.startMs)) }, [cue.startMs])
  useEffect(() => { setEndVal(String(cue.endMs)) },     [cue.endMs])

  const applyStart = () => {
    const v = parseFloat(startVal)
    if (isFinite(v) && v >= 0) onUpdateTiming(cue.id, { startMs: Math.round(v) })
    else setStartVal(String(cue.startMs))
  }
  const applyEnd = () => {
    const v = parseFloat(endVal)
    if (isFinite(v) && v > cue.startMs) onUpdateTiming(cue.id, { endMs: Math.round(v) })
    else setEndVal(String(cue.endMs))
  }

  const durMs  = cue.endMs - cue.startMs
  const dispStart = fmtSec(cue.startMs / 1000 + globalOffsetSec)
  const dispEnd   = fmtSec(cue.endMs   / 1000 + globalOffsetSec)

  return (
    <div className="vz-ml-insp-body">
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Info</span>
        </div>
        <div className="vz-ml-insp-group-body">
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Text</span>
            <span className="vz-ml-insp-val" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cue.text}</span>
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Start ms</span>
            <input type="number" className="vz-ml-insp-num" min={0} step={10}
              value={startVal}
              onChange={e => setStartVal(e.target.value)}
              onBlur={applyStart}
              onKeyDown={e => e.key === 'Enter' && applyStart()}
            />
            <span className="vz-ml-insp-lbl">End ms</span>
            <input type="number" className="vz-ml-insp-num" min={0} step={10}
              value={endVal}
              onChange={e => setEndVal(e.target.value)}
              onBlur={applyEnd}
              onKeyDown={e => e.key === 'Enter' && applyEnd()}
            />
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Timeline</span>
            <span className="vz-ml-insp-val">{dispStart} → {dispEnd}</span>
            <span className="vz-ml-insp-lbl">Dur</span>
            <span className="vz-ml-insp-val">{fmtSec(durMs / 1000)}</span>
          </div>
          <div className="vz-ml-insp-row vz-ml-insp-actions">
            <button className="vz-tl-clip-btn"
              title="Seek to cue start"
              onClick={() => onSeek(cue.startMs / 1000 + globalOffsetSec)}>
              ⏮ Seek
            </button>
            <button
              className="vz-tl-clip-btn"
              disabled={!isDirty || isSaving || !hasDocument}
              title={!hasDocument ? 'Save the lyric document first to enable timing persistence' : 'Save lyric timing to database'}
              onClick={onSave}
            >
              {isSaving ? 'Saving…' : 'Save Timing'}
            </button>
            {isDirty && !isSaving && (
              <span className="vz-ml-insp-hint" style={{ color: 'var(--az-accent)', margin: 0 }}>Unsaved</span>
            )}
          </div>
          {!hasDocument && (
            <div className="vz-ml-insp-hint">
              Save the lyric document in Lyric Manager before timing changes can be persisted.
            </div>
          )}
          {globalOffsetSec !== 0 && (
            <div className="vz-ml-insp-hint">
              Global offset {globalOffsetSec > 0 ? '+' : ''}{fmtSec(globalOffsetSec)} applied to display.
              Raw cue: {fmtSec(cue.startMs / 1000)} → {fmtSec(cue.endMs / 1000)}
            </div>
          )}
        </div>
      </div>
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Color</span>
        </div>
        <div className="vz-ml-insp-group-body" />
      </div>
    </div>
  )
}

// ── Layer item color inspector ───────────────────────────────────────────

function LayerItemColorInspector({
  item, media, isGpu, onUpdate, onClearFx,
}: {
  item: VzLayerItem
  media: UploadedMedia | undefined
  isGpu: boolean
  onUpdate: (id: string, patch: Partial<Omit<VzLayerItem, 'id'>>) => void
  onClearFx: (id: string) => void
}) {
  const grade = item.colorGrade ?? DEFAULT_COLOR_GRADE
  return (
    <div className="vz-ml-insp-body">
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Info</span>
        </div>
        <div className="vz-ml-insp-group-body">
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Layer</span>
            <span className="vz-ml-insp-val">{LAYER_LABELS[item.layerId]}</span>
            <span className="vz-ml-insp-lbl">File</span>
            <span className="vz-ml-insp-val vz-ml-insp-fname" title={media?.name}>{media?.title ?? media?.name ?? '(missing)'}</span>
          </div>
          <div className="vz-ml-insp-row">
            <button
              className="vz-cg-reset-btn"
              onClick={() => onClearFx(item.id)}
              title="Reset color grade, disable audio reactivity, and remove layer-item-targeted effect regions">
              Clear FX
            </button>
          </div>
        </div>
      </div>
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Color</span>
        </div>
        <div className="vz-ml-insp-group-body">
          <ColorGradeControls
            grade={grade}
            isGpu={isGpu}
            onChange={patch => onUpdate(item.id, { colorGrade: { ...grade, ...patch } })}
            onReset={() => onUpdate(item.id, { colorGrade: { ...DEFAULT_COLOR_GRADE } })}
          />
        </div>
      </div>
    </div>
  )
}

// ── Master dimmer (empty inspector) ──────────────────────────────────────

function MasterDimmerControls() {
  const masterDimmer = useVisualStore(s => s.masterDimmer)
  const setMasterDimmer = useVisualStore(s => s.setMasterDimmer)
  const pct = Math.round(masterDimmer * 100)
  return (
    <div className="vz-ml-insp-body">
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Color</span>
        </div>
        <div className="vz-ml-insp-group-body">
          <div className="vz-cg-slider-row">
            <span className="vz-cg-slider-lbl">Master Dimmer</span>
            <input
              type="range"
              className="vz-cg-slider"
              min={0} max={100} step={1}
              value={pct}
              onChange={e => setMasterDimmer(parseInt(e.target.value, 10) / 100)}
            />
            <span className="vz-cg-slider-val">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── TimelineInspector ────────────────────────────────────────────────────

export function TimelineInspector({
  selected, bgClips, overlayClips, effectRegions, lyricCues, mediaMap,
  layerItems, selectedLayerItemId, isGpu,
  onUpdateClip, onRemoveBg, onRemoveOverlay, onDuplicateBg, onDuplicateOverlay,
  onMoveClip, onUpdateEffect, onRemoveEffect, onSetMediaRole, onUpdateLayerItem,
  onUpdateLyricTiming, onSeekToLyric, onSaveLyricTiming,
  lyricTimingDirty, lyricSaving, hasLyricDocument, globalOffsetSec,
  onClearFx,
}: {
  selected: SelectedEntity
  bgClips: VzTimelineMediaClip[]
  overlayClips: VzTimelineMediaClip[]
  effectRegions: VzTimelineEffectRegion[]
  lyricCues: LyricCue[]
  mediaMap: Map<string, UploadedMedia>
  layerItems: VzLayerItem[]
  selectedLayerItemId: string | null
  isGpu: boolean
  onUpdateClip: (id: string, patch: Partial<Omit<VzTimelineMediaClip, 'id' | 'lane'>>) => void
  onRemoveBg: (id: string) => void
  onRemoveOverlay: (id: string) => void
  onDuplicateBg: (id: string) => void
  onDuplicateOverlay: (id: string) => void
  onMoveClip: (id: string, dir: -1 | 1) => void
  onUpdateEffect: (id: string, patch: Partial<Omit<VzTimelineEffectRegion, 'id'>>) => void
  onRemoveEffect: (id: string) => void
  onSetMediaRole: (mediaId: string, role: MediaRole) => void
  onUpdateLayerItem: (id: string, patch: Partial<Omit<VzLayerItem, 'id'>>) => void
  onUpdateLyricTiming: (id: string, patch: { startMs?: number; endMs?: number }) => void
  onSeekToLyric: (sec: number) => void
  onSaveLyricTiming: () => void
  lyricTimingDirty: boolean
  lyricSaving: boolean
  hasLyricDocument: boolean
  globalOffsetSec: number
  onClearFx: (elementId: string, kind: 'clip' | 'layerItem') => void
}) {
  // No timeline entity selected: if a layer item is selected show its color
  // grade editor; otherwise show the global Master Dimmer.
  if (!selected) {
    const layerItem = selectedLayerItemId
      ? layerItems.find(i => i.id === selectedLayerItemId)
      : undefined
    if (layerItem) {
      return (
        <div className="vz-ml-insp">
          <div className="vz-ml-insp-hd">
            <CursorInfo01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
            <span className="vz-ml-insp-title">Inspector</span>
          </div>
          <LayerItemColorInspector
            item={layerItem}
            media={mediaMap.get(layerItem.mediaId)}
            isGpu={isGpu}
            onUpdate={onUpdateLayerItem}
            onClearFx={id => onClearFx(id, 'layerItem')}
          />
        </div>
      )
    }
    return (
      <div className="vz-ml-insp">
        <div className="vz-ml-insp-hd">
          <CursorInfo01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
          <span className="vz-ml-insp-title">Inspector</span>
        </div>
        <MasterDimmerControls />
      </div>
    )
  }

  let headLabel = ''
  let headName  = ''
  let content: React.ReactNode = null

  if (selected.kind === 'bg') {
    const clip  = bgClips.find(c => c.id === selected.id)
    const media = clip ? mediaMap.get(clip.mediaId) : undefined
    const idx   = bgClips.findIndex(c => c.id === selected.id)
    headLabel = 'VIDEO / BG'
    headName  = media?.title ?? media?.name ?? ''
    if (clip) {
      content = (
        <BgClipInspector
          clip={clip} media={media} idx={idx} total={bgClips.length} isGpu={isGpu}
          onMove={onMoveClip} onRemove={onRemoveBg} onDuplicate={onDuplicateBg}
          onUpdate={onUpdateClip} onSetMediaRole={onSetMediaRole}
          onClearFx={id => onClearFx(id, 'clip')}
        />
      )
    }
  } else if (selected.kind === 'overlay') {
    const clip  = overlayClips.find(c => c.id === selected.id)
    const media = clip ? mediaMap.get(clip.mediaId) : undefined
    headLabel = 'OVERLAY'
    headName  = media?.title ?? media?.name ?? ''
    if (clip) {
      content = (
        <OverlayClipInspector
          clip={clip} media={media} isGpu={isGpu}
          onUpdate={onUpdateClip} onRemove={onRemoveOverlay}
          onDuplicate={onDuplicateOverlay} onSetMediaRole={onSetMediaRole}
          onClearFx={id => onClearFx(id, 'clip')}
        />
      )
    }
  } else if (selected.kind === 'effect') {
    const region = effectRegions.find(r => r.id === selected.id)
    headLabel = 'EFFECT'
    headName  = region ? (EFFECT_MODULES.get(region.effectId)?.label ?? region.effectId) : ''
    if (region) {
      content = (
        <EffectInspector
          region={region} onUpdate={onUpdateEffect} onRemove={onRemoveEffect}
          bgClips={bgClips} overlayClips={overlayClips}
          layerItems={layerItems} mediaMap={mediaMap}
        />
      )
    }
  } else if (selected.kind === 'lyric') {
    const cue = lyricCues.find(c => c.id === selected.id)
    headLabel = 'LYRIC'
    headName  = cue?.text ?? ''
    if (cue) content = (
      <LyricCueInspector
        cue={cue}
        globalOffsetSec={globalOffsetSec}
        onUpdateTiming={onUpdateLyricTiming}
        onSeek={onSeekToLyric}
        onSave={onSaveLyricTiming}
        isSaving={lyricSaving}
        isDirty={lyricTimingDirty}
        hasDocument={hasLyricDocument}
      />
    )
  }

  return (
    <div className="vz-ml-insp">
      <div className="vz-ml-insp-hd">
        <CursorInfo01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-ml-insp-title">Inspector</span>
      </div>
      {content ?? <div className="vz-ml-insp-empty">Item not found</div>}
    </div>
  )
}

// ── TimelinePanel ─────────────────────────────────────────────────────────

interface TimelinePanelProps {
  onScrub?: (t: number) => void
  onAddCue?: () => void
}

export function TimelinePanel({ onScrub, onAddCue }: TimelinePanelProps) {
  // ── Store subscriptions ────────────────────────────────────────────────
  const {
    timelineClips, timelineOverlayClips, timelineEffectRegions,
    timelineLoop, timelineClock, activeMediaId,
    layerConfigs, layerItems,
    selectedLayerItemId, selectedLayerId,
    selectedTimelineEntity, setSelectedTimelineEntity,
    setTimelineLoop,
    // bg lane actions
    addTimelineClip, removeTimelineClip, updateTimelineClip,
    duplicateTimelineClip, reorderTimelineClips,
    // new lane-aware actions
    addMediaClip, updateMediaClip, removeMediaClip,
    duplicateMediaClip, setMediaClipStart, setMediaClipDuration,
    addEffectRegion, updateEffectRegion, removeEffectRegion,
    clearTimeline,
  } = useVisualStore(useShallow(s => ({
    timelineClips:           s.timelineClips,
    timelineOverlayClips:    s.timelineOverlayClips,
    timelineEffectRegions:   s.timelineEffectRegions,
    timelineLoop:            s.timelineLoop,
    timelineClock:           s.timelineClock,
    activeMediaId:           s.activeMediaId,
    layerConfigs:            s.layerConfigs,
    layerItems:              s.layerItems,
    selectedLayerItemId:          s.selectedLayerItemId,
    selectedLayerId:              s.selectedLayerId,
    selectedTimelineEntity:       s.selectedTimelineEntity,
    setSelectedTimelineEntity:    s.setSelectedTimelineEntity,
    setTimelineLoop:              s.setTimelineLoop,
    addTimelineClip:         s.addTimelineClip,
    removeTimelineClip:      s.removeTimelineClip,
    updateTimelineClip:      s.updateTimelineClip,
    duplicateTimelineClip:   s.duplicateTimelineClip,
    reorderTimelineClips:    s.reorderTimelineClips,
    addMediaClip:            s.addMediaClip,
    updateMediaClip:         s.updateMediaClip,
    removeMediaClip:         s.removeMediaClip,
    duplicateMediaClip:      s.duplicateMediaClip,
    setMediaClipStart:       s.setMediaClipStart,
    setMediaClipDuration:    s.setMediaClipDuration,
    addEffectRegion:         s.addEffectRegion,
    updateEffectRegion:      s.updateEffectRegion,
    removeEffectRegion:      s.removeEffectRegion,
    clearTimeline:           s.clearTimeline,
  })))

  const { items: mediaItems, setMediaRole } = useMediaStore(useShallow(s => ({ items: s.items, setMediaRole: s.setMediaRole })))
  const {
    cues: lyricCues, globalOffsetMs, activeDocumentId: lyricDocumentId,
    selectedCueId: storeSelectedCueId,
    selectCue, updateCueTiming, setCueBounds, saveTimingChanges, deleteCue, clearCues,
    lyricTimingDirty, isSaving: lyricSaving,
  } = useLyricsStore(useShallow(s => ({
    cues:              s.cues,
    globalOffsetMs:    s.globalOffsetMs,
    activeDocumentId:  s.activeDocumentId,
    selectedCueId:     s.selectedCueId,
    selectCue:         s.selectCue,
    updateCueTiming:   s.updateCueTiming,
    setCueBounds:      s.setCueBounds,
    saveTimingChanges: s.saveTimingChanges,
    deleteCue:         s.deleteCue,
    clearCues:         s.clearCues,
    lyricTimingDirty:  s.lyricTimingDirty,
    isSaving:          s.isSaving,
  })))
  const engine = useSharedAudio()

  // ── Waveform peaks (cached by URL) ─────────────────────────────────────
  const trackUrl = engine.currentIndex >= 0 ? (engine.tracks[engine.currentIndex]?.url ?? null) : null
  const { peaks: waveformPeaks, loading: waveformLoading } = useWaveformPeaks(trackUrl)
  const globalOffsetSec = globalOffsetMs / 1000

  const mediaMap = useMemo(() => new Map(mediaItems.map(m => [m.id, m])), [mediaItems])
  const activeMedia = activeMediaId ? mediaMap.get(activeMediaId) ?? null : null

  // ── Zoom ───────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1)
  const pxPerSec = BASE_PX_PER_SEC * zoom

  // ── Duration (audio-driven, extended by visual content and lyrics) ───────
  const bgDuration   = getTimelineDuration(timelineClips)
  const visualDur    = getTimelineProjectDuration({
    bgClips: timelineClips,
    overlayClips: timelineOverlayClips,
    effectRegions: timelineEffectRegions,
  })
  const audioDur     = engine.duration > 0 ? engine.duration : 0
  const lyricEndSec  = lyricCues.length > 0
    ? Math.max(...lyricCues.map(c => c.endMs / 1000 + globalOffsetSec))
    : 0
  const totalDuration = Math.max(audioDur, visualDur, lyricEndSec, 10)
  const contentWidth  = Math.max(600, timeToPx(totalDuration, pxPerSec) + 120)

  // ── Selection ──────────────────────────────────────────────────────────
  const selected    = selectedTimelineEntity as SelectedEntity
  const setSelected = setSelectedTimelineEntity

  // Clear stale selection when the item is deleted
  useEffect(() => {
    if (!selected) return
    if (selected.kind === 'bg'      && !timelineClips.find(c => c.id === selected.id)) setSelected(null)
    if (selected.kind === 'overlay' && !timelineOverlayClips.find(c => c.id === selected.id)) setSelected(null)
    if (selected.kind === 'effect'  && !timelineEffectRegions.find(r => r.id === selected.id)) setSelected(null)
    if (selected.kind === 'lyric'   && !lyricCues.find(c => c.id === selected.id)) setSelected(null)
  }, [selected, timelineClips, timelineOverlayClips, timelineEffectRegions, lyricCues])

  // Sync Lyric Manager selection → Timeline selection
  useEffect(() => {
    if (!storeSelectedCueId) return
    setSelectedTimelineEntity({ kind: 'lyric', id: storeSelectedCueId })
  }, [storeSelectedCueId, setSelectedTimelineEntity])

  // ── Keyboard delete ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return
      if (!selected) return
      e.preventDefault()
      if (selected.kind === 'bg')      { removeTimelineClip(selected.id);    setSelected(null) }
      if (selected.kind === 'overlay') { removeMediaClip(selected.id);       setSelected(null) }
      if (selected.kind === 'effect')  { removeEffectRegion(selected.id);    setSelected(null) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected, removeTimelineClip, removeMediaClip, removeEffectRegion])

  // ── Drag state ─────────────────────────────────────────────────────────
  const dragRef = useRef<DragData | null>(null)
  const [liveDrag, setLiveDrag] = useState<LiveDrag | null>(null)

  const startDrag = useCallback((
    e: React.PointerEvent,
    kind: DragKind,
    clipId: string,
    lane: 'bg' | 'overlay' | 'effect',
    origStartSec: number,
    origDurSec: number,
  ) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
    dragRef.current = { kind, clipId, lane, startClientX: e.clientX, origStartSec, origDurSec }
    setLiveDrag({ id: clipId, startSec: origStartSec, durationSec: origDurSec })
  }, [])

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !(e.buttons & 1)) return
    const deltaSec = (e.clientX - drag.startClientX) / pxPerSec

    if (drag.kind === 'move') {
      const newStart = clampSec(snapSec(drag.origStartSec + deltaSec), 0)
      setLiveDrag({ id: drag.clipId, startSec: newStart, durationSec: drag.origDurSec })
    } else if (drag.kind === 'resize-right') {
      const newDur = Math.max(MIN_CLIP_DUR, snapSec(drag.origDurSec + deltaSec))
      setLiveDrag({ id: drag.clipId, startSec: drag.origStartSec, durationSec: newDur })
    } else if (drag.kind === 'resize-left') {
      const newStart = clampSec(snapSec(drag.origStartSec + deltaSec), 0)
      const newDur   = Math.max(MIN_CLIP_DUR, drag.origDurSec - (newStart - drag.origStartSec))
      setLiveDrag({ id: drag.clipId, startSec: newStart, durationSec: newDur })
    }
  }, [pxPerSec])

  const handleDragUp = useCallback(() => {
    const drag = dragRef.current
    const live = liveDrag
    dragRef.current = null
    setLiveDrag(null)

    if (!drag || !live) return

    if (drag.lane === 'bg') {
      if (drag.kind === 'move') {
        setMediaClipStart(drag.clipId, live.startSec)
      } else if (drag.kind === 'resize-right') {
        setMediaClipDuration(drag.clipId, live.durationSec)
      } else if (drag.kind === 'resize-left') {
        setMediaClipStart(drag.clipId, live.startSec)
        setMediaClipDuration(drag.clipId, live.durationSec)
      }
    } else if (drag.lane === 'overlay') {
      if (drag.kind === 'move') {
        setMediaClipStart(drag.clipId, live.startSec)
      } else if (drag.kind === 'resize-right') {
        setMediaClipDuration(drag.clipId, live.durationSec)
      } else if (drag.kind === 'resize-left') {
        setMediaClipStart(drag.clipId, live.startSec)
        setMediaClipDuration(drag.clipId, live.durationSec)
      }
    } else if (drag.lane === 'effect') {
      updateEffectRegion(drag.clipId, { startSec: live.startSec, durationSec: live.durationSec })
    }
  }, [liveDrag, setMediaClipStart, setMediaClipDuration, updateEffectRegion])

  // ── Lyric drag ─────────────────────────────────────────────────────────
  const lyricDragRef = useRef<LyricDragData | null>(null)
  const [liveLyricDrag, setLiveLyricDrag] = useState<LiveLyricDrag | null>(null)

  const startLyricDrag = useCallback((
    e: React.PointerEvent,
    kind: DragKind,
    cueId: string,
    origStartMs: number,
    origEndMs: number,
  ) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
    lyricDragRef.current = { kind, cueId, startClientX: e.clientX, origStartMs, origEndMs }
    setLiveLyricDrag({ id: cueId, startMs: origStartMs, endMs: origEndMs })
  }, [])

  const handleLyricDragMove = useCallback((e: React.PointerEvent) => {
    const drag = lyricDragRef.current
    if (!drag || !(e.buttons & 1)) return
    const deltaMs = ((e.clientX - drag.startClientX) / pxPerSec) * 1000

    if (drag.kind === 'move') {
      const dur = drag.origEndMs - drag.origStartMs
      const newStart = Math.max(0, drag.origStartMs + deltaMs)
      setLiveLyricDrag({ id: drag.cueId, startMs: newStart, endMs: newStart + dur })
    } else if (drag.kind === 'resize-right') {
      const newEnd = Math.max(drag.origStartMs + MIN_LYRIC_DUR_MS, drag.origEndMs + deltaMs)
      setLiveLyricDrag({ id: drag.cueId, startMs: drag.origStartMs, endMs: newEnd })
    } else if (drag.kind === 'resize-left') {
      const newStart = Math.max(0, Math.min(drag.origEndMs - MIN_LYRIC_DUR_MS, drag.origStartMs + deltaMs))
      setLiveLyricDrag({ id: drag.cueId, startMs: newStart, endMs: drag.origEndMs })
    }
  }, [pxPerSec])

  const handleLyricDragUp = useCallback(() => {
    const drag = lyricDragRef.current
    const live = liveLyricDrag
    lyricDragRef.current = null
    setLiveLyricDrag(null)
    if (!drag || !live) return
    setCueBounds(drag.cueId, live.startMs, live.endMs)
    // Auto-save after every completed drag so timing is never silently lost
    saveTimingChanges()
  }, [liveLyricDrag, setCueBounds, saveTimingChanges])

  // ── Scrub ──────────────────────────────────────────────────────────────
  const handleScrub = useCallback((t: number) => {
    if (onScrub) onScrub(t)
    else useVisualStore.getState().scrubTimeline(t)
  }, [onScrub])

  // ── Bg lane move ───────────────────────────────────────────────────────
  const moveBgClip = useCallback((clipId: string, dir: -1 | 1) => {
    const idx = timelineClips.findIndex(c => c.id === clipId)
    if (idx === -1) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= timelineClips.length) return
    const ids = timelineClips.map(c => c.id)
    ;[ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]]
    reorderTimelineClips(ids)
  }, [timelineClips, reorderTimelineClips])

  // ── Drop handlers ──────────────────────────────────────────────────────
  const [bgDragOver, setBgDragOver] = useState(false)
  const [overlayDragOver, setOverlayDragOver] = useState(false)

  const handleBgDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setBgDragOver(false)
    const mediaId = e.dataTransfer.getData('vz/mediaId')
    if (mediaId) addTimelineClip(mediaId, resolveMediaDuration(mediaMap.get(mediaId)))
  }
  const handleOverlayDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setOverlayDragOver(false)
    const mediaId = e.dataTransfer.getData('vz/mediaId')
    if (mediaId) addMediaClip('overlays', mediaId, resolveMediaDuration(mediaMap.get(mediaId)))
  }
  const dragOverHandler = (e: React.DragEvent, set: (v: boolean) => void) => {
    if (e.dataTransfer.types.includes('vz/mediaid')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      set(true)
    }
  }

  // ── Add effect region ──────────────────────────────────────────────────
  const handleAddEffect = () => {
    const firstEffect = EFFECT_LIST[0]
    if (!firstEffect) return

    let targetType: VzTimelineEffectRegion['targetType'] = 'global'
    let targetIds: string[] = []

    // Priority 1: selected layer item
    if (selectedLayerItemId) {
      targetType = 'layerItem'
      targetIds  = [selectedLayerItemId]
    // Priority 2: selected overlay clip
    } else if (selected?.kind === 'overlay') {
      targetType = 'clip'
      targetIds  = [selected.id]
    // Priority 3: selected bg clip
    } else if (selected?.kind === 'bg') {
      targetType = 'clip'
      targetIds  = [selected.id]
    // Priority 4: selected layer
    } else if (selectedLayerId) {
      targetType = 'layer'
      targetIds  = [selectedLayerId]
    }

    addEffectRegion({
      effectId: firstEffect.id,
      startSec: timelineClock,
      durationSec: 4,
      enabled: true,
      targetType,
      targetIds,
    })
  }

  // ── Clear ──────────────────────────────────────────────────────────────
  const handleClear = () => {
    const total = timelineClips.length + timelineOverlayClips.length + timelineEffectRegions.length + lyricCues.length
    if (total > 0 && !window.confirm(`Remove all ${total} items from the timeline?`)) return
    clearTimeline()
    clearCues()
    setSelected(null)
  }

  // ── Lane label height sync ref ─────────────────────────────────────────
  const LANE_HEIGHTS = { audio: 28, bg: 40, overlay: 36, lyrics: 28, effects: 28 }

  return (
    <div
      className="vz-ml-tl"
      onPointerMove={e => { handleDragMove(e); handleLyricDragMove(e) }}
      onPointerUp={() => { handleDragUp(); handleLyricDragUp() }}
      onPointerCancel={() => { handleDragUp(); handleLyricDragUp() }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="vz-ml-toolbar">
        <span className="vz-ml-tl-title">Timeline</span>
        <span className="vz-ml-tl-dur">{fmtSec(totalDuration)}</span>
        <div className="vz-ml-tl-sep" />

        {/* Loop toggle */}
        <div className="vz-sync-toggle" onClick={() => setTimelineLoop(!timelineLoop)}>
          <div className={`vz-sync-track ${timelineLoop ? 'vz-sync-track--on' : ''}`}>
            <div className="vz-sync-thumb" />
          </div>
          <span className="vz-sync-label">Loop</span>
        </div>

        <div className="vz-ml-tl-sep" />

        {/* Add buttons */}
        <button
          className="vz-ml-add-btn"
          disabled={!activeMedia}
          title={activeMedia ? `Add "${activeMedia.title ?? activeMedia.name}" to Video/BG lane` : 'No active media — select from deck'}
          onClick={() => activeMedia && addTimelineClip(activeMedia.id, resolveMediaDuration(activeMedia))}
        >+ BG</button>
        <button
          className="vz-ml-add-btn vz-ml-add-btn--overlay"
          disabled={!activeMedia}
          title={activeMedia ? `Add "${activeMedia.title ?? activeMedia.name}" to Overlays lane` : 'No active media — select from deck'}
          onClick={() => activeMedia && addMediaClip('overlays', activeMedia.id, resolveMediaDuration(activeMedia))}
        >+ Overlay</button>
        <button
          className="vz-ml-add-btn vz-ml-add-btn--effect"
          title="Add effect region"
          onClick={handleAddEffect}
          disabled={EFFECT_LIST.length === 0}
        >+ FX</button>
        <button className="vz-ml-add-btn vz-ml-add-btn--cue" title="Add cue" onClick={onAddCue}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" style={{ transform: 'rotate(180deg)', flexShrink: 0 }}>
            <path d="M18,9v2a6.5,6.5,0,0,0-5.48,10H7a1,1,0,0,1-1-1V9l6-6Z" fill="currentColor" fillOpacity={0.25} />
            <path d="M18,15v6m3-3H15" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12,21H7a1,1,0,0,1-1-1V9l6-6,6,6v2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Add Cue
        </button>

        {/* Right cluster: zoom + clear */}
        <div className="vz-ml-toolbar-right">
          <div className="vz-ml-zoom-row">
            <button className="vz-ml-zoom-btn" onClick={() => setZoom(z => Math.max(0.25, z / 1.5))} title="Zoom out">−</button>
            <span className="vz-ml-zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="vz-ml-zoom-btn" onClick={() => setZoom(z => Math.min(8, z * 1.5))} title="Zoom in">+</button>
          </div>
          <button className="vz-tl-clear-btn" onClick={handleClear} title="Clear all lanes">Clear</button>
        </div>
      </div>

      {/* ── Editor (labels + scroll area) ─────────────────────────────── */}
      <div className="vz-ml-editor">
        {/* Fixed label column */}
        <div className="vz-ml-label-col">
          <div className="vz-ml-ruler-corner" />
          <div className="vz-ml-lane-label" style={{ height: LANE_HEIGHTS.audio }}>AUDIO</div>
          <div className="vz-ml-lane-label" style={{ height: LANE_HEIGHTS.bg }}>
            <span>VIDEO / BG</span>
          </div>
          <div className="vz-ml-lane-label" style={{ height: LANE_HEIGHTS.overlay }}>OVERLAYS</div>
          <div className="vz-ml-lane-label" style={{ height: LANE_HEIGHTS.lyrics }}>LYRICS</div>
          <div className="vz-ml-lane-label" style={{ height: LANE_HEIGHTS.effects }}>EFFECTS</div>
        </div>

        {/* Scrollable lanes */}
        <div className="vz-ml-scroll-area">
          {/* One inner track that sizes to content, all lanes inside */}
          <div className="vz-ml-track-inner" style={{ width: contentWidth }}>

            {/* Ruler */}
            <TimelineRuler totalDuration={totalDuration} pxPerSec={pxPerSec} onScrub={handleScrub} />

            {/* Playhead — spans through all lanes */}
            <div
              className="vz-ml-playhead"
              style={{ left: timeToPx(timelineClock, pxPerSec) }}
            />

            {/* ── Audio lane ──────────────────────────────────────────── */}
            <div className="vz-ml-lane vz-ml-lane--audio" style={{ height: LANE_HEIGHTS.audio }}>
              {engine.duration > 0 ? (
                <div
                  className="vz-ml-audio-region"
                  style={{ width: timeToPx(engine.duration, pxPerSec) }}
                >
                  <TimelineWaveformCanvas
                    peaks={waveformPeaks}
                    loading={waveformLoading}
                    audioDuration={engine.duration}
                    currentTime={timelineClock}
                  />
                  <span className="vz-ml-audio-name">
                    {(engine.tracks[engine.currentIndex])?.displayName ?? 'Audio Track'}
                  </span>
                  <button
                    className="vz-ml-clip-del"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); engine.removeTrack(engine.tracks[engine.currentIndex].id) }}
                    title="Remove audio track"
                  >✕</button>
                </div>
              ) : (
                <div className="vz-ml-lane-empty">Add an audio track to build a synchronized show</div>
              )}
            </div>

            {/* ── Video / BG lane ─────────────────────────────────────── */}
            <div
              className={`vz-ml-lane vz-ml-lane--bg${bgDragOver ? ' vz-ml-lane--dragover' : ''}`}
              style={{ height: LANE_HEIGHTS.bg }}
              onDragOver={e => dragOverHandler(e, setBgDragOver)}
              onDragLeave={() => setBgDragOver(false)}
              onDrop={handleBgDrop}
              onPointerDown={e => { if (e.target === e.currentTarget) setSelected(null) }}
            >
              {timelineClips.length === 0 && !bgDragOver && (
                <div className="vz-ml-lane-empty">Drag media here or click + BG</div>
              )}
              {timelineClips.map(clip => (
                <ClipBlock
                  key={clip.id}
                  clip={clip}
                  media={mediaMap.get(clip.mediaId)}
                  pxPerSec={pxPerSec}
                  isSelected={selected?.kind === 'bg' && selected.id === clip.id}
                  lane="bg"
                  liveDrag={liveDrag}
                  onSelect={() => setSelected({ kind: 'bg', id: clip.id })}
                  onDragStart={e => startDrag(e, 'move', clip.id, 'bg', clip.startSec, clip.durationSec)}
                  onResizeLeft={e => startDrag(e, 'resize-left', clip.id, 'bg', clip.startSec, clip.durationSec)}
                  onResizeRight={e => startDrag(e, 'resize-right', clip.id, 'bg', clip.startSec, clip.durationSec)}
                  onDelete={() => { removeTimelineClip(clip.id); if (selected?.id === clip.id) setSelected(null) }}
                />
              ))}
            </div>

            {/* ── Overlays lane ───────────────────────────────────────── */}
            <div
              className={`vz-ml-lane vz-ml-lane--overlay${overlayDragOver ? ' vz-ml-lane--dragover' : ''}`}
              style={{ height: LANE_HEIGHTS.overlay }}
              onDragOver={e => dragOverHandler(e, setOverlayDragOver)}
              onDragLeave={() => setOverlayDragOver(false)}
              onDrop={handleOverlayDrop}
              onPointerDown={e => { if (e.target === e.currentTarget) setSelected(null) }}
            >
              {timelineOverlayClips.length === 0 && !overlayDragOver && (
                <div className="vz-ml-lane-empty">Drag logos, characters or textures here</div>
              )}
              {timelineOverlayClips.map(clip => (
                <ClipBlock
                  key={clip.id}
                  clip={clip}
                  media={mediaMap.get(clip.mediaId)}
                  pxPerSec={pxPerSec}
                  isSelected={selected?.kind === 'overlay' && selected.id === clip.id}
                  lane="overlay"
                  liveDrag={liveDrag}
                  onSelect={() => setSelected({ kind: 'overlay', id: clip.id })}
                  onDragStart={e => startDrag(e, 'move', clip.id, 'overlay', clip.startSec, clip.durationSec)}
                  onResizeLeft={e => startDrag(e, 'resize-left', clip.id, 'overlay', clip.startSec, clip.durationSec)}
                  onResizeRight={e => startDrag(e, 'resize-right', clip.id, 'overlay', clip.startSec, clip.durationSec)}
                  onDelete={() => { removeMediaClip(clip.id); if (selected?.id === clip.id) setSelected(null) }}
                />
              ))}
            </div>

            {/* ── Lyrics lane ─────────────────────────────────────────── */}
            <div
              className="vz-ml-lane vz-ml-lane--lyrics"
              style={{ height: LANE_HEIGHTS.lyrics }}
              onPointerDown={e => { if (e.target === e.currentTarget) setSelected(null) }}
            >
              {lyricCues.length === 0 && (
                <div className="vz-ml-lane-empty">No timed lyrics loaded — open Lyric Manager to add cues</div>
              )}
              {lyricCues.map(cue => (
                <LyricBlock
                  key={cue.id}
                  cue={cue}
                  pxPerSec={pxPerSec}
                  isSelected={selected?.kind === 'lyric' && selected.id === cue.id}
                  globalOffsetSec={globalOffsetSec}
                  liveLyricDrag={liveLyricDrag}
                  onSelect={() => { setSelected({ kind: 'lyric', id: cue.id }); selectCue(cue.id) }}
                  onDragStart={e => startLyricDrag(e, 'move', cue.id, cue.startMs, cue.endMs)}
                  onResizeLeft={e => startLyricDrag(e, 'resize-left', cue.id, cue.startMs, cue.endMs)}
                  onResizeRight={e => startLyricDrag(e, 'resize-right', cue.id, cue.startMs, cue.endMs)}
                  onDelete={() => { deleteCue(cue.id); if (selected?.id === cue.id) setSelected(null) }}
                />
              ))}
            </div>

            {/* ── Effects lane ────────────────────────────────────────── */}
            <div
              className="vz-ml-lane vz-ml-lane--effects"
              style={{ height: LANE_HEIGHTS.effects }}
              onPointerDown={e => { if (e.target === e.currentTarget) setSelected(null) }}
            >
              {timelineEffectRegions.length === 0 && (
                <div className="vz-ml-lane-empty">Click + FX to add a timed effect region</div>
              )}
              {timelineEffectRegions.map(region => (
                <EffectBlock
                  key={region.id}
                  region={region}
                  pxPerSec={pxPerSec}
                  isSelected={selected?.kind === 'effect' && selected.id === region.id}
                  liveDrag={liveDrag}
                  onSelect={() => setSelected({ kind: 'effect', id: region.id })}
                  onDragStart={e => startDrag(e, 'move', region.id, 'effect', region.startSec, region.durationSec)}
                  onResizeLeft={e => startDrag(e, 'resize-left', region.id, 'effect', region.startSec, region.durationSec)}
                  onResizeRight={e => startDrag(e, 'resize-right', region.id, 'effect', region.startSec, region.durationSec)}
                  onDelete={() => { removeEffectRegion(region.id); if (selected?.id === region.id) setSelected(null) }}
                />
              ))}
            </div>

          </div>{/* end track-inner */}
        </div>{/* end scroll-area */}
      </div>{/* end editor */}

    </div>
  )
}
