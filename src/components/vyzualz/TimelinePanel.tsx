import { IconMorphCheckbox } from './react/controls/IconMorphToggle'
import { BubbleRevealSlider } from './react/controls/BubbleRevealSlider'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useVisualStore } from '../../stores/visualStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useLyricsStore } from '../../stores/lyricsStore'
import { useSharedAudio } from '../../context/AudioEngineContext'
import { useReactStore } from '../../stores/reactStore'
import { adaptMIAnalysis, resolveTrackSections } from '../../features/trackIntelligence/trackMapAdapter'
import { useWaveformPeaks } from './hooks/useWaveformPeaks'
import { LyricCueTimeline } from '../../features/lyrics/editor/LyricCueTimeline'
import { toCanonicalLyricTimeMs, toEffectiveLyricTimeMs } from '../../features/lyrics/runtime/lyricPlaybackResolver'
import { LyricCueInspector as SharedLyricCueInspector } from '../../features/lyrics/editor/LyricCueInspector'
import { LyricWaveformCanvas } from '../../features/lyrics/editor/LyricWaveformCanvas'
import {
  addCueAtPlayhead,
  duplicateCue,
  mergeCues,
  moveCueToStart,
  normalizeCue,
  resizeCueEnd,
  resizeCueStart,
  sortLyricCues,
  splitCue,
} from '../../features/lyrics/editor/lyricCueEditorModel'
import { generateVideoFilmstrip } from './media/generateThumbnail'
import type { VzTimelineClip, VzTimelineMediaClip, VzTimelineEffectRegion, VzOverlayCompositingConfig } from '../../types/timeline'
import type { VzLayerConfig, VzLayerItem, SelectedTimelineEntity } from '../../stores/visualStore'
import { LAYER_LABELS } from '../../types/vzLayers'
import type { VzTransitionConfig, VzTransitionType, VzTransitionEasing } from '../../types/timeline'
import { DEFAULT_OVERLAY_COMPOSITING, resolveClipGlobalFx } from '../../types/timeline'
import type { UploadedMedia } from '../../stores/mediaStore'
import type { LyricCue, LyricSectionType } from '../../types/lyrics'
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
import { DropdownSelect } from '../shared/Dropdown/Dropdown'
import { isKeyboardInputTarget } from '../../utils/keyboardTargets'

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

// ── Helpers ──────────────────────────────────────────────────────────────

function resolveMediaDuration(m: UploadedMedia | null | undefined): number {
  const d = m?.metadata?.duration
  return typeof d === 'number' && isFinite(d) && d > 0 ? d : 5
}

const EFFECT_LIST       = Array.from(EFFECT_MODULES.entries()).map(([id, m]) => ({ id, label: m.label }))

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
    generateVideoFilmstrip(media.url, 6, clip.mediaInSec, clip.mediaOutSec, media.storagePath ?? media.id)
      .then(frames => { if (alive) setFilmstrip(frames) })
    return () => { alive = false }
  }, [isVideo, media?.url, media?.storagePath, media?.id, clip.mediaInSec, clip.mediaOutSec])

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
      <BubbleRevealSlider
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
        <label className="vz-ml-insp-toggle vz-cg-enable" title="Enable color grade for this source">
          <IconMorphCheckbox className="vz-ml-insp-toggle-input" checked={grade.enabled}
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
        <DropdownSelect className="az-select vz-ml-insp-sel" value={matchedPreset ?? ''}
          onChange={e => {
            const next = applyColorGradePreset(e.target.value, grade)
            if (next) onChange(next)
          }}>
          {!matchedPreset && <option value="" disabled>Custom…</option>}
          {COLOR_GRADE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </DropdownSelect>
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
    <div className="vz-ml-insp-body" data-help-context="Timeline Background Clip Inspector">
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
            <DropdownSelect className="az-select vz-ml-insp-sel" value={media?.mediaRole ?? 'other'} disabled={!media}
              onChange={e => media && onSetMediaRole(media.id, e.target.value as MediaRole)}>
              {MEDIA_ROLES.map(r => <option key={r} value={r}>{MEDIA_ROLE_LABELS[r]}</option>)}
            </DropdownSelect>
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
            <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.playbackMode}
              onChange={e => onUpdate(clip.id, { playbackMode: e.target.value as VzTimelineClip['playbackMode'] })}>
              <option value="trim">Trim</option>
              <option value="loop">Loop</option>
              <option value="freeze">Freeze</option>
            </DropdownSelect>
            <span className="vz-ml-insp-lbl">Fit</span>
            <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.fitMode}
              onChange={e => onUpdate(clip.id, { fitMode: e.target.value as VzTimelineClip['fitMode'] })}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </DropdownSelect>
          </div>
          <div className="vz-cg-slider-row">
            <span className="vz-cg-slider-lbl">Size</span>
            <BubbleRevealSlider type="range" className="vz-cg-slider" min={10} max={300} step={1}
              value={Math.round((clip.mediaScale ?? 1) * 100)}
              onChange={e => onUpdate(clip.id, { mediaScale: parseInt(e.target.value, 10) / 100 })}
            />
            <span className="vz-cg-slider-val">{Math.round((clip.mediaScale ?? 1) * 100)}%</span>
          </div>
          {media?.type === 'video' && (
            <div className="vz-ml-insp-row">
              <label className="vz-ml-insp-toggle" title={isClipSnapToBpmEnabled(clip) ? 'Lock this video to timeline timing' : 'Play this video at native speed'}>
                <IconMorphCheckbox className="vz-ml-insp-toggle-input" checked={isClipSnapToBpmEnabled(clip)}
                  onChange={e => onUpdate(clip.id, { snapToBpm: e.target.checked })}
                />
                  Snap to BPM
              </label>
            </div>
          )}
          <div className="vz-ml-insp-row">
            <label className="vz-ml-insp-toggle"
              title="When ON, this clip participates in global audio-reactive modulation (Bass Reactivity, Reactive Scale, Master Intensity). Off by default for background videos.">
              <IconMorphCheckbox className="vz-ml-insp-toggle-input"
                checked={resolveClipGlobalFx(clip.enableGlobalFx, media?.mediaRole ?? null)}
                onChange={e => onUpdate(clip.id, { enableGlobalFx: e.target.checked })}
              />
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
            <span className="vz-ml-insp-lbl">Tx In</span>
            <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.transitionIn?.type ?? 'cut'}
              onChange={e => {
                const type = e.target.value as VzTransitionType
                if (type === 'cut') { onUpdate(clip.id, { transitionIn: undefined }); return }
                const def = TRANSITION_DEFAULTS[type]
                onUpdate(clip.id, { transitionIn: { ...def, durationSec: clip.transitionIn?.durationSec ?? def.durationSec } })
              }}>
              {(Object.keys(TRANSITION_LABELS) as VzTransitionType[]).map(t => (
                <option key={t} value={t}>{TRANSITION_LABELS[t]}</option>
              ))}
            </DropdownSelect>
            {clip.transitionIn && clip.transitionIn.type !== 'cut' && (
              <>
                <input type="number" className="vz-ml-insp-num" min={0.1} max={clip.durationSec} step={0.1}
                  value={clip.transitionIn.durationSec} title="Entrance duration (s)"
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v > 0 && clip.transitionIn)
                      onUpdate(clip.id, { transitionIn: { ...clip.transitionIn, durationSec: v } })
                  }}
                />
                <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.transitionIn.easing ?? 'linear'}
                  onChange={e => clip.transitionIn && onUpdate(clip.id, { transitionIn: { ...clip.transitionIn, easing: e.target.value as VzTransitionEasing } })}>
                  <option value="linear">Linear</option>
                  <option value="easeIn">Ease In</option>
                  <option value="easeOut">Ease Out</option>
                  <option value="easeInOut">Ease In/Out</option>
                  <option value="easeInCubic">Cubic In</option>
                  <option value="easeOutCubic">Cubic Out</option>
                  <option value="easeInOutCubic">Cubic In/Out</option>
                </DropdownSelect>
              </>
            )}
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Tx Out</span>
            <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.transitionOut?.type ?? 'cut'}
              onChange={e => {
                const type = e.target.value as VzTransitionType
                if (type === 'cut') { onUpdate(clip.id, { transitionOut: undefined }); return }
                const def = TRANSITION_DEFAULTS[type]
                onUpdate(clip.id, { transitionOut: { ...def, durationSec: clip.transitionOut?.durationSec ?? def.durationSec } })
              }}>
              {(Object.keys(TRANSITION_LABELS) as VzTransitionType[]).map(t => (
                <option key={t} value={t}>{TRANSITION_LABELS[t]}</option>
              ))}
            </DropdownSelect>
            {clip.transitionOut && clip.transitionOut.type !== 'cut' && (
              <>
                <input type="number" className="vz-ml-insp-num" min={0.1} max={clip.durationSec} step={0.1}
                  value={clip.transitionOut.durationSec} title="Exit duration (s)"
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v > 0 && clip.transitionOut)
                      onUpdate(clip.id, { transitionOut: { ...clip.transitionOut, durationSec: v } })
                  }}
                />
                <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.transitionOut.easing ?? 'linear'}
                  onChange={e => clip.transitionOut && onUpdate(clip.id, { transitionOut: { ...clip.transitionOut, easing: e.target.value as VzTransitionEasing } })}>
                  <option value="linear">Linear</option>
                  <option value="easeIn">Ease In</option>
                  <option value="easeOut">Ease Out</option>
                  <option value="easeInOut">Ease In/Out</option>
                  <option value="easeInCubic">Cubic In</option>
                  <option value="easeOutCubic">Cubic Out</option>
                  <option value="easeInOutCubic">Cubic In/Out</option>
                </DropdownSelect>
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
    <div className="vz-ml-insp-body" data-help-context="Timeline Overlay Clip Inspector">
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
            <DropdownSelect className="az-select vz-ml-insp-sel" value={media?.mediaRole ?? 'other'} disabled={!media}
              onChange={e => media && onSetMediaRole(media.id, e.target.value as MediaRole)}>
              {MEDIA_ROLES.map(r => <option key={r} value={r}>{MEDIA_ROLE_LABELS[r]}</option>)}
            </DropdownSelect>
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
            <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.playbackMode}
              onChange={e => onUpdate(clip.id, { playbackMode: e.target.value as VzTimelineClip['playbackMode'] })}>
              <option value="trim">Trim</option>
              <option value="loop">Loop</option>
              <option value="freeze">Freeze</option>
            </DropdownSelect>
            <span className="vz-ml-insp-lbl">Fit</span>
            <DropdownSelect className="az-select vz-ml-insp-sel" value={cfg.fitMode}
              onChange={e => patchCfg({ fitMode: e.target.value as VzOverlayCompositingConfig['fitMode'] })}>
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
            </DropdownSelect>
          </div>
          {media?.type === 'video' && (
            <div className="vz-ml-insp-row">
              <label className="vz-ml-insp-toggle" title={isClipSnapToBpmEnabled(clip) ? 'Lock this video to timeline timing' : 'Play this video at native speed'}>
                <IconMorphCheckbox className="vz-ml-insp-toggle-input" checked={isClipSnapToBpmEnabled(clip)}
                  onChange={e => onUpdate(clip.id, { snapToBpm: e.target.checked })}
                />
                  Snap to BPM
              </label>
            </div>
          )}
          <div className="vz-ml-insp-row">
            <label className="vz-ml-insp-toggle"
              title="When ON, this clip participates in global audio-reactive modulation (Bass Reactivity, Reactive Scale, Master Intensity). On by default for overlay clips.">
              <IconMorphCheckbox className="vz-ml-insp-toggle-input"
                checked={resolveClipGlobalFx(clip.enableGlobalFx, media?.mediaRole ?? null)}
                onChange={e => onUpdate(clip.id, { enableGlobalFx: e.target.checked })}
              />
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
            <BubbleRevealSlider type="range" min={0} max={1} step={0.01}
              value={cfg.opacity}
              onChange={e => patchCfg({ opacity: parseFloat(e.target.value) })}
              style={{ flex: 1 }}
            />
            <span className="vz-ml-insp-val" style={{ minWidth: 28, textAlign: 'right' }}>{Math.round(cfg.opacity * 100)}%</span>
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Blend</span>
            <DropdownSelect className="az-select vz-ml-insp-sel" value={cfg.blendMode}
              onChange={e => patchCfg({ blendMode: e.target.value })}>
              {BLEND_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </DropdownSelect>
          </div>

          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Tx In</span>
            <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.transitionIn?.type ?? 'cut'}
              onChange={e => {
                const type = e.target.value as VzTransitionType
                if (type === 'cut') { onUpdate(clip.id, { transitionIn: undefined }); return }
                const def = TRANSITION_DEFAULTS[type]
                onUpdate(clip.id, { transitionIn: { ...def, durationSec: clip.transitionIn?.durationSec ?? def.durationSec } })
              }}>
              {(Object.keys(TRANSITION_LABELS) as VzTransitionType[]).map(t => (
                <option key={t} value={t}>{TRANSITION_LABELS[t]}</option>
              ))}
            </DropdownSelect>
            {clip.transitionIn && clip.transitionIn.type !== 'cut' && (
              <>
                <input type="number" className="vz-ml-insp-num" min={0.1} max={clip.durationSec} step={0.1}
                  value={clip.transitionIn.durationSec} title="Entrance duration (s)"
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v > 0 && clip.transitionIn)
                      onUpdate(clip.id, { transitionIn: { ...clip.transitionIn, durationSec: v } })
                  }}
                />
                <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.transitionIn.easing ?? 'linear'}
                  onChange={e => clip.transitionIn && onUpdate(clip.id, { transitionIn: { ...clip.transitionIn, easing: e.target.value as VzTransitionEasing } })}>
                  <option value="linear">Linear</option>
                  <option value="easeIn">Ease In</option>
                  <option value="easeOut">Ease Out</option>
                  <option value="easeInOut">Ease In/Out</option>
                  <option value="easeInCubic">Cubic In</option>
                  <option value="easeOutCubic">Cubic Out</option>
                  <option value="easeInOutCubic">Cubic In/Out</option>
                </DropdownSelect>
              </>
            )}
          </div>
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Tx Out</span>
            <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.transitionOut?.type ?? 'cut'}
              onChange={e => {
                const type = e.target.value as VzTransitionType
                if (type === 'cut') { onUpdate(clip.id, { transitionOut: undefined }); return }
                const def = TRANSITION_DEFAULTS[type]
                onUpdate(clip.id, { transitionOut: { ...def, durationSec: clip.transitionOut?.durationSec ?? def.durationSec } })
              }}>
              {(Object.keys(TRANSITION_LABELS) as VzTransitionType[]).map(t => (
                <option key={t} value={t}>{TRANSITION_LABELS[t]}</option>
              ))}
            </DropdownSelect>
            {clip.transitionOut && clip.transitionOut.type !== 'cut' && (
              <>
                <input type="number" className="vz-ml-insp-num" min={0.1} max={clip.durationSec} step={0.1}
                  value={clip.transitionOut.durationSec} title="Exit duration (s)"
                  onChange={e => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v > 0 && clip.transitionOut)
                      onUpdate(clip.id, { transitionOut: { ...clip.transitionOut, durationSec: v } })
                  }}
                />
                <DropdownSelect className="az-select vz-ml-insp-sel" value={clip.transitionOut.easing ?? 'linear'}
                  onChange={e => clip.transitionOut && onUpdate(clip.id, { transitionOut: { ...clip.transitionOut, easing: e.target.value as VzTransitionEasing } })}>
                  <option value="linear">Linear</option>
                  <option value="easeIn">Ease In</option>
                  <option value="easeOut">Ease Out</option>
                  <option value="easeInOut">Ease In/Out</option>
                  <option value="easeInCubic">Cubic In</option>
                  <option value="easeOutCubic">Cubic Out</option>
                  <option value="easeInOutCubic">Cubic In/Out</option>
                </DropdownSelect>
              </>
            )}
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
    <div className="vz-ml-insp-body" data-help-context="Timeline Effect Region Inspector">
      <div className="vz-ml-insp-group">
        <div className="vz-ml-insp-group-hd">
          <span className="vz-ml-insp-group-chevron">▸</span>
          <span className="vz-ml-insp-group-title">Info</span>
        </div>
        <div className="vz-ml-insp-group-body">
          <div className="vz-ml-insp-row">
            <span className="vz-ml-insp-lbl">Effect</span>
            <DropdownSelect className="az-select vz-ml-insp-sel" value={region.effectId}
              onChange={e => onUpdate(region.id, { effectId: e.target.value })}>
              {EFFECT_LIST.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </DropdownSelect>
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
            <DropdownSelect className="az-select vz-ml-insp-sel" value={targetType}
              onChange={e => onUpdate(region.id, {
                targetType: e.target.value as VzTimelineEffectRegion['targetType'],
                targetIds: [],
              })}>
              <option value="global">Global</option>
              <option value="layer">Layer</option>
              <option value="layerItem">Layer Item</option>
              <option value="clip">Clip</option>
            </DropdownSelect>
          </div>

          {targetType === 'layer' && (
            <div className="vz-ml-insp-row">
              <span className="vz-ml-insp-lbl">Layer</span>
              <DropdownSelect className="az-select vz-ml-insp-sel" value={targetId}
                onChange={e => onUpdate(region.id, { targetIds: [e.target.value] })}>
                <option value="" disabled>Select layer…</option>
                {(Object.keys(LAYER_LABELS) as Array<keyof typeof LAYER_LABELS>).map(id => (
                  <option key={id} value={id}>{LAYER_LABELS[id]}</option>
                ))}
              </DropdownSelect>
            </div>
          )}

          {targetType === 'layerItem' && (
            <div className="vz-ml-insp-row">
              <span className="vz-ml-insp-lbl">Item</span>
              <DropdownSelect className="az-select vz-ml-insp-sel" value={targetId}
                onChange={e => onUpdate(region.id, { targetIds: [e.target.value] })}>
                <option value="" disabled>Select item…</option>
                {layerItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {LAYER_LABELS[item.layerId]}: {mediaMap.get(item.mediaId)?.name ?? item.id.slice(0, 8)}
                  </option>
                ))}
              </DropdownSelect>
            </div>
          )}

          {targetType === 'clip' && (
            <div className="vz-ml-insp-row">
              <span className="vz-ml-insp-lbl">Clip</span>
              <DropdownSelect className="az-select vz-ml-insp-sel" value={targetId}
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
              </DropdownSelect>
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

function lyricEditorId(prefix = 'cue'): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function timelineSectionType(type: string): LyricSectionType {
  if (type === 'preDrop') return 'build'
  if (
    type === 'intro' || type === 'verse' || type === 'build' ||
    type === 'drop' || type === 'breakdown' || type === 'bridge' || type === 'outro'
  ) return type
  return 'unknown'
}

function TimelineLyricCueInspector({
  cueId,
  onSeek,
}: {
  cueId: string
  onSeek: (sec: number) => void
}) {
  const engine = useSharedAudio()
  const timelineClock = useVisualStore(state => state.timelineClock)
  const {
    cues,
    globalOffsetMs,
    activeDocumentId,
    isSaving,
    lyricTimingDirty,
    setCues,
    updateCue,
    setCueBounds,
    deleteCue,
    selectCue,
    saveTimingChanges,
  } = useLyricsStore(useShallow(state => ({
    cues: state.cues,
    globalOffsetMs: state.globalOffsetMs,
    activeDocumentId: state.activeDocumentId,
    isSaving: state.isSaving,
    lyricTimingDirty: state.lyricTimingDirty,
    setCues: state.setCues,
    updateCue: state.updateCue,
    setCueBounds: state.setCueBounds,
    deleteCue: state.deleteCue,
    selectCue: state.selectCue,
    saveTimingChanges: state.saveTimingChanges,
  })))

  const manualTrackSectionsByTrackId = useReactStore(state => state.manualTrackSectionsByTrackId)
  const suppressedAutoSectionsByTrackId = useReactStore(state => state.suppressedAutoSectionsByTrackId)

  const cue = cues.find(item => item.id === cueId)
  if (!cue) return <div className="vz-ml-insp-empty">Lyric cue not found</div>

  const ordered = sortLyricCues(cues)
  const selectedIndex = ordered.findIndex(item => item.id === cue.id)
  const durationMs = Math.max(
    1,
    Math.round(engine.duration * 1000),
    ...cues.map(item => item.endMs),
  )
  const currentDisplayTimeMs = Math.round(timelineClock * 1000)
  const canonicalPlayheadMs = Math.max(0, toCanonicalLyricTimeMs(currentDisplayTimeMs, globalOffsetMs))
  const sections = resolveTrackSections({
    analyzedSections: engine.currentAnalysis ? adaptMIAnalysis(engine.currentAnalysis) : [],
    manualSections: engine.currentTrackId ? (manualTrackSectionsByTrackId[engine.currentTrackId] ?? []) : [],
    suppressedIds: engine.currentTrackId ? (suppressedAutoSectionsByTrackId[engine.currentTrackId] ?? []) : [],
    durationSec: Math.max(engine.duration, (engine.currentAnalysis?.durationMs ?? 0) / 1000),
  })
    .filter(section => section.provenance?.authority !== 'fallback')
    .map(section => ({
      id: section.id,
      label: section.label,
      type: timelineSectionType(section.type),
    }))

  const replaceCues = (next: LyricCue[], selectedId: string | null) => {
    setCues(next.map(item => normalizeCue(item, durationMs)))
    selectCue(selectedId)
  }
  const commitPatch = (id: string, patch: Partial<Omit<LyricCue, 'id'>>) => {
    const current = cues.find(item => item.id === id)
    if (!current) return
    const normalized = normalizeCue({ ...current, ...patch, id }, durationMs)
    const { id: _id, ...nextPatch } = normalized
    updateCue(id, nextPatch)
  }
  const addAtPlayhead = () => {
    const added = addCueAtPlayhead(lyricEditorId(), canonicalPlayheadMs, durationMs)
    replaceCues([...cues, added], added.id)
  }
  const duplicate = () => {
    const copy = duplicateCue(cue, lyricEditorId(), durationMs)
    replaceCues([...cues, copy], copy.id)
  }
  const split = () => {
    const result = splitCue(cue, canonicalPlayheadMs, lyricEditorId(), lyricEditorId())
    if (!result) return
    replaceCues(cues.flatMap(item => item.id === cue.id ? result : [item]), result[1].id)
  }
  const merge = (direction: -1 | 1) => {
    const adjacent = ordered[selectedIndex + direction]
    if (!adjacent) return
    const first = direction < 0 ? adjacent : cue
    const second = direction < 0 ? cue : adjacent
    const merged = mergeCues(first, second, cue.id)
    replaceCues(cues.filter(item => item.id !== first.id && item.id !== second.id).concat(merged), merged.id)
  }
  const remove = () => {
    const fallback = ordered[selectedIndex + 1]?.id ?? ordered[selectedIndex - 1]?.id ?? null
    deleteCue(cue.id)
    selectCue(fallback)
  }

  return (
    <div className="vz-ml-insp-body vz-ml-insp-body--lyrics">
      <SharedLyricCueInspector
        cue={cue}
        cues={cues}
        currentTimeMs={canonicalPlayheadMs}
        durationMs={durationMs}
        sections={sections}
        canMergePrevious={selectedIndex > 0}
        canMergeNext={selectedIndex >= 0 && selectedIndex < ordered.length - 1}
        onUpdateCue={commitPatch}
        actions={{
          setStartToPlayhead: () => {
            const bounds = resizeCueStart(cue, canonicalPlayheadMs, durationMs)
            setCueBounds(cue.id, bounds.startMs, bounds.endMs)
          },
          setEndToPlayhead: () => {
            const bounds = resizeCueEnd(cue, canonicalPlayheadMs, durationMs)
            setCueBounds(cue.id, bounds.startMs, bounds.endMs)
          },
          moveToPlayhead: () => {
            commitPatch(cue.id, moveCueToStart(cue, canonicalPlayheadMs, durationMs))
          },
          addAtPlayhead,
          duplicate,
          split,
          mergePrevious: () => merge(-1),
          mergeNext: () => merge(1),
          delete: remove,
        }}
      />
      <div className="vz-ml-lyric-save-row">
        <button
          type="button"
          className="vz-tl-clip-btn"
          onClick={() => onSeek(toEffectiveLyricTimeMs(cue.startMs, globalOffsetMs) / 1000)}
        >
          ⏮ Seek to cue
        </button>
        <button
          type="button"
          className="vz-tl-clip-btn"
          disabled={!lyricTimingDirty || isSaving || !activeDocumentId}
          title={!activeDocumentId ? 'Save the lyric document first to enable persistence' : 'Save lyric edits transactionally'}
          onClick={() => { void saveTimingChanges() }}
        >
          {isSaving ? 'Saving…' : 'Save lyrics'}
        </button>
        {lyricTimingDirty && !isSaving && <span className="vz-ml-insp-hint">Unsaved lyric changes</span>}
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
            <BubbleRevealSlider
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
  onSeekToLyric,
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
  onSeekToLyric: (sec: number) => void
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
      <TimelineLyricCueInspector cueId={cue.id} onSeek={onSeekToLyric} />
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
    cues: lyricCues,
    globalOffsetMs,
    selectedCueId: storeSelectedCueId,
    selectCue,
    updateCue,
    deleteCue,
    clearCues,
  } = useLyricsStore(useShallow(s => ({
    cues: s.cues,
    globalOffsetMs: s.globalOffsetMs,
    selectedCueId: s.selectedCueId,
    selectCue: s.selectCue,
    updateCue: s.updateCue,
    deleteCue: s.deleteCue,
    clearCues: s.clearCues,
  })))
  const engine = useSharedAudio()

  // ── Waveform peaks (prefer engine buffer; fall back to URL fetch) ──────
  const currentTrack = engine.currentIndex >= 0 ? (engine.tracks[engine.currentIndex] ?? null) : null
  const trackUrl     = currentTrack?.url ?? null
  const trackIdTl    = currentTrack?.id ?? null
  const { peaks: waveformPeaks, loading: waveformLoading } = useWaveformPeaks(
    trackIdTl,
    trackIdTl ? engine.getDecodedBuffer(trackIdTl) : undefined,
    trackUrl,
  )

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
    ? Math.max(...lyricCues.map(c => toEffectiveLyricTimeMs(c.endMs, globalOffsetMs) / 1000))
    : 0
  const totalDuration = Math.max(audioDur, visualDur, lyricEndSec, 10)
  const contentWidth  = Math.max(600, timeToPx(totalDuration, pxPerSec) + 120)

  const commitLyricCuePatch = (cueId: string, patch: Partial<Omit<LyricCue, 'id'>>) => {
    const current = lyricCues.find(cue => cue.id === cueId)
    if (!current) return
    const normalized = normalizeCue({ ...current, ...patch, id: cueId }, Math.round(totalDuration * 1000))
    const { id: _id, ...nextPatch } = normalized
    updateCue(cueId, nextPatch)
  }

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
  }, [selected, timelineClips, timelineOverlayClips, timelineEffectRegions, lyricCues, setSelected])

  // Sync Lyric Manager selection → Timeline selection
  useEffect(() => {
    if (!storeSelectedCueId) return
    setSelectedTimelineEntity({ kind: 'lyric', id: storeSelectedCueId })
  }, [storeSelectedCueId, setSelectedTimelineEntity])

  // ── Keyboard delete ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (isKeyboardInputTarget(e.target)) return
      if (!selected) return
      e.preventDefault()
      if (selected.kind === 'bg')      { removeTimelineClip(selected.id);    setSelected(null) }
      if (selected.kind === 'overlay') { removeMediaClip(selected.id);       setSelected(null) }
      if (selected.kind === 'effect')  { removeEffectRegion(selected.id);    setSelected(null) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected, removeTimelineClip, removeMediaClip, removeEffectRegion, setSelected])

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
      onPointerMove={handleDragMove}
      onPointerUp={handleDragUp}
      onPointerCancel={handleDragUp}
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
                  <LyricWaveformCanvas
                    className="vz-ml-waveform-canvas"
                    peaks={waveformPeaks}
                    loading={waveformLoading}
                    durationSec={Math.max(0.001, engine.duration)}
                    currentTimeSec={timelineClock}
                    viewport={{ startSec: 0, endSec: Math.max(0.001, engine.duration) }}
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
              <LyricCueTimeline
                compact
                cues={lyricCues}
                selectedCueId={selected?.kind === 'lyric' ? selected.id : null}
                currentTimeMs={Math.round(timelineClock * 1000)}
                durationMs={Math.round(totalDuration * 1000)}
                zoom={1}
                globalOffsetMs={globalOffsetMs}
                snapContext={{ mode: 'none' }}
                onSelectCue={(cueId) => {
                  selectCue(cueId)
                  setSelected(cueId ? { kind: 'lyric', id: cueId } : null)
                }}
                onSeek={(timeMs) => handleScrub(timeMs / 1000)}
                onCommitCue={commitLyricCuePatch}
                onDeleteCue={(cueId) => {
                  deleteCue(cueId)
                  if (selected?.kind === 'lyric' && selected.id === cueId) setSelected(null)
                }}
              />
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
