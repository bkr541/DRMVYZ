import { useEffect, useMemo, useRef, useState } from 'react'

const MIN_CLIP_DUR = 0.25
import { useVisualStore } from '../../stores/visualStore'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '../../stores/mediaStore'
import type { UploadedMedia } from '../../stores/mediaStore'
import type { VzTimelineClip, VzTransitionConfig, VzTransitionType, VzTransitionEasing } from '../../types/timeline'
import { getTimelineDuration, TRANSITION_LABELS, TRANSITION_DEFAULTS, DEFAULT_CLIP_DURATION_SEC } from '../../lib/timeline'
import { MEDIA_ROLE_LABELS, MEDIA_ROLE_BADGE_LABELS, MEDIA_ROLES, type MediaRole } from '../../lib/mediaRoles'

function fmtSec(sec: number): string {
  return `${sec.toFixed(1)}s`
}

function resolveMediaClipDuration(media: UploadedMedia | null | undefined): number {
  const d = media?.metadata?.duration
  if (typeof d === 'number' && Number.isFinite(d) && d > 0) return d
  return DEFAULT_CLIP_DURATION_SEC
}

interface TimelinePanelProps {
  onScrub?: (t: number) => void
}

export function TimelinePanel({ onScrub }: TimelinePanelProps) {
  const {
    timelineClips, timelineLoop, activeMediaId, timelineClock,
    setTimelineLoop, addTimelineClip, removeTimelineClip,
    duplicateTimelineClip, reorderTimelineClips, updateTimelineClip, clearTimeline,
  } = useVisualStore(useShallow(s => ({
    timelineClips:          s.timelineClips,
    timelineLoop:           s.timelineLoop,
    activeMediaId:          s.activeMediaId,
    timelineClock:          s.timelineClock,
    setTimelineLoop:        s.setTimelineLoop,
    addTimelineClip:        s.addTimelineClip,
    removeTimelineClip:     s.removeTimelineClip,
    duplicateTimelineClip:  s.duplicateTimelineClip,
    reorderTimelineClips:   s.reorderTimelineClips,
    updateTimelineClip:     s.updateTimelineClip,
    clearTimeline:          s.clearTimeline,
  })))

  const { items, setMediaRole } = useMediaStore(useShallow(s => ({ items: s.items, setMediaRole: s.setMediaRole })))

  const mediaMap = useMemo(() => new Map(items.map(m => [m.id, m])), [items])

  const totalDuration = getTimelineDuration(timelineClips)
  const activeMedia   = activeMediaId ? (mediaMap.get(activeMediaId) ?? null) : null

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)

  const selectedClip  = selectedClipId ? (timelineClips.find(c => c.id === selectedClipId) ?? null) : null
  const selectedMedia = selectedClip   ? (mediaMap.get(selectedClip.mediaId) ?? null) : null

  const handleRemoveClip = (clipId: string) => {
    removeTimelineClip(clipId)
    if (selectedClipId === clipId) setSelectedClipId(null)
  }

  const handleClearTimeline = () => {
    if (timelineClips.length > 1 && !window.confirm(`Remove all ${timelineClips.length} clips from the timeline?`)) return
    clearTimeline()
    setSelectedClipId(null)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = e.target as HTMLElement
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (el.isContentEditable) return
      if (!selectedClipId) return
      e.preventDefault()
      removeTimelineClip(selectedClipId)
      setSelectedClipId(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedClipId, removeTimelineClip])

  const PX_PER_SEC = 80
  const rulerRef   = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('vz/mediaid')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
    }
  }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const mediaId = e.dataTransfer.getData('vz/mediaId')
    if (mediaId) addTimelineClip(mediaId, resolveMediaClipDuration(mediaMap.get(mediaId)))
  }

  const handleScrubPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return
    const rect = rulerRef.current.getBoundingClientRect()
    const t    = Math.max(0, Math.min(totalDuration, (e.clientX - rect.left) / PX_PER_SEC))
    if (onScrub) {
      onScrub(t)
    } else {
      useVisualStore.getState().scrubTimeline(t)
    }
  }

  const moveClip = (clipId: string, dir: -1 | 1) => {
    const idx = timelineClips.findIndex(c => c.id === clipId)
    if (idx === -1) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= timelineClips.length) return
    const ids = timelineClips.map(c => c.id)
    ;[ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]]
    reorderTimelineClips(ids)
  }

  return (
    <div className="vz-tl-bar">
      {/* Left controls sidebar */}
      <div className="vz-tl-sidebar">
        <div className="vz-tl-sidebar-top">
          <span className="vz-tl-title">Timeline</span>
          <span className="vz-tl-duration">{fmtSec(totalDuration)}</span>
        </div>
        <div className="vz-tl-sidebar-actions">
          <div className="vz-sync-toggle vz-tl-loop-toggle" onClick={() => setTimelineLoop(!timelineLoop)}>
            <div className={`vz-sync-track ${timelineLoop ? 'vz-sync-track--on' : ''}`}>
              <div className="vz-sync-thumb" />
            </div>
            <span className="vz-sync-label">Loop</span>
          </div>
          <button
            className="vz-tl-add-btn"
            disabled={!activeMedia}
            onClick={() => activeMedia && addTimelineClip(activeMedia.id, resolveMediaClipDuration(activeMedia))}
            title={activeMedia ? `Add "${activeMedia.title ?? activeMedia.name}"` : 'No active media'}
          >
            + Add
          </button>
          <button
            className="vz-tl-clear-btn"
            onClick={handleClearTimeline}
            disabled={timelineClips.length === 0}
            title="Remove all clips from the timeline"
          >
            Clear Timeline
          </button>
        </div>
      </div>

      {/* Right side: pixel ruler + clip cards */}
      <div
        className={`vz-tl-right${dragOver ? ' vz-tl-right--drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Pixel timeline: ruler + clip blocks + playhead */}
        <div className="vz-tl-timeline-wrap">
          {timelineClips.length === 0 ? (
            <div className="vz-tl-empty">
              {dragOver ? 'Drop to add clip' : 'No clips — drag from deck or click + Add'}
            </div>
          ) : (
            <div
              ref={rulerRef}
              className="vz-tl-pixel-track"
              style={{ width: Math.max(300, totalDuration * PX_PER_SEC + 40) }}
              onPointerDown={handleScrubPointer}
              onPointerMove={e => { if (e.buttons === 1) handleScrubPointer(e) }}
            >
              {/* Second tick marks */}
              {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                <div key={i} className="vz-tl-tick" style={{ left: i * PX_PER_SEC }}>
                  <span className="vz-tl-tick-label">{i}s</span>
                </div>
              ))}

              {/* Clip blocks */}
              {timelineClips.map(clip => (
                <TimelineClipBlock
                  key={clip.id}
                  clip={clip}
                  media={mediaMap.get(clip.mediaId)}
                  pxPerSec={PX_PER_SEC}
                  isSelected={selectedClipId === clip.id}
                  onSelect={setSelectedClipId}
                  onUpdate={updateTimelineClip}
                  onRemove={handleRemoveClip}
                />
              ))}

              {/* Playhead */}
              <div
                className="vz-tl-playhead"
                style={{ left: timelineClock * PX_PER_SEC }}
              />
            </div>
          )}
        </div>

        {/* Clip Inspector — property editing for the selected clip */}
        <div className="vz-tl-inspector">
          <div className="vz-tl-inspector-hd">
            <span className="vz-tl-inspector-label">Clip Inspector</span>
            {selectedMedia && (
              <span className="vz-tl-inspector-clipname">
                {selectedMedia.title ?? selectedMedia.name}
              </span>
            )}
          </div>
          {selectedClip ? (
            <ClipInspector
              clip={selectedClip}
              media={mediaMap.get(selectedClip.mediaId)}
              idx={timelineClips.findIndex(c => c.id === selectedClip.id)}
              total={timelineClips.length}
              onMove={moveClip}
              onRemove={handleRemoveClip}
              onDuplicate={duplicateTimelineClip}
              onUpdate={updateTimelineClip}
              onSetMediaRole={setMediaRole}
            />
          ) : (
            <div className="vz-tl-inspector-empty">Select a clip to inspect</div>
          )}
        </div>
      </div>
    </div>
  )
}

function TimelineClipBlock({
  clip, media, pxPerSec, isSelected, onSelect, onUpdate, onRemove,
}: {
  clip: VzTimelineClip
  media: UploadedMedia | undefined
  pxPerSec: number
  isSelected: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<VzTimelineClip>) => void
  onRemove: (id: string) => void
}) {
  const [resizeDur, setResizeDur] = useState<number | null>(null)
  const dragRef = useRef<{ startX: number; startDur: number } | null>(null)

  const handleResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startDur: clip.durationSec }
    setResizeDur(clip.durationSec)
  }

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const delta = (e.clientX - dragRef.current.startX) / pxPerSec
    const raw = dragRef.current.startDur + delta
    setResizeDur(Math.max(MIN_CLIP_DUR, Math.round(raw * 4) / 4))
  }

  const commitResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const delta = (e.clientX - dragRef.current.startX) / pxPerSec
    const newDur = Math.max(MIN_CLIP_DUR, Math.round((dragRef.current.startDur + delta) * 4) / 4)
    onUpdate(clip.id, { durationSec: newDur })
    dragRef.current = null
    setResizeDur(null)
  }

  const displayDur = resizeDur ?? clip.durationSec
  const isResizing = resizeDur !== null

  const roleBadgeLabel = media?.mediaRole ? MEDIA_ROLE_BADGE_LABELS[media.mediaRole] : 'Unassigned'
  const roleBadgeTitle = media?.mediaRole
    ? `Role: ${MEDIA_ROLE_LABELS[media.mediaRole]} — affects placement and visual behavior`
    : 'Role: Unassigned — select clip and assign a role in the inspector'

  const blockClasses = [
    'vz-tl-clip-block',
    isResizing  ? 'vz-tl-clip-block--resizing' : '',
    isSelected  ? 'vz-tl-clip-block--selected'  : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={blockClasses}
      style={{
        left:  clip.startSec * pxPerSec,
        width: displayDur    * pxPerSec,
      }}
      title={`${media?.title ?? media?.name ?? '(missing)'} — ${clip.durationSec.toFixed(2)}s`}
      onClick={() => onSelect(clip.id)}
    >
      <span className="vz-tl-clip-block-name">
        {media?.title ?? media?.name ?? '(missing)'}
      </span>
      <span className="vz-tl-clip-block-dur">{displayDur.toFixed(2)}s</span>
      <span
        className={`vz-tl-clip-role-badge${!media?.mediaRole ? ' vz-tl-clip-role-badge--unset' : ''}`}
        title={roleBadgeTitle}
      >
        {roleBadgeLabel}
      </span>

      <button
        className="vz-tl-clip-del-btn"
        onClick={e => { e.stopPropagation(); onRemove(clip.id) }}
        onPointerDown={e => e.stopPropagation()}
        title="Delete clip"
        aria-label="Delete clip"
      >✕</button>

      <div
        className="vz-tl-clip-resize-handle"
        onPointerDown={handleResizeDown}
        onPointerMove={handleResizeMove}
        onPointerUp={commitResize}
        onPointerCancel={commitResize}
        title="Drag to resize"
      />
      {isResizing && (
        <div className="vz-tl-clip-resize-tooltip">{displayDur.toFixed(2)}s</div>
      )}
    </div>
  )
}

function ClipInspector({
  clip, media, idx, total,
  onMove, onRemove, onDuplicate, onUpdate, onSetMediaRole,
}: {
  clip: VzTimelineClip
  media: UploadedMedia | undefined
  idx: number
  total: number
  onMove: (id: string, dir: -1 | 1) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onUpdate: (id: string, patch: Partial<VzTimelineClip>) => void
  onSetMediaRole: (mediaId: string, role: MediaRole) => void
}) {
  return (
    <div className="vz-tl-inspector-body">

      {/* Thumbnail */}
      <div className="vz-tl-inspector-thumb">
        {(media?.thumbnailUrl || media?.localThumbnailObjectUrl)
          ? <img src={media.thumbnailUrl ?? media.localThumbnailObjectUrl!} alt={media.name} />
          : <span className="vz-tl-thumb-placeholder">{media?.type === 'video' ? '▶' : '◻'}</span>
        }
      </div>

      {/* Meta: filename + role */}
      <div className="vz-tl-insp-group vz-tl-insp-meta">
        <span className="vz-tl-insp-field-label">File</span>
        <span className="vz-tl-inspector-fname" title={media?.title ?? media?.name ?? clip.mediaId}>
          {media?.title ?? media?.name ?? '(missing)'}
        </span>
        <span
          className="vz-tl-insp-field-label"
          title="Role affects how media is placed and which visual behaviors apply. Audio Reactive controls can override per-clip behavior."
        >Role (?)</span>
        <select
          className="az-select vz-tl-insp-role-select"
          value={media?.mediaRole ?? 'other'}
          disabled={!media}
          onChange={e => media && onSetMediaRole(media.id, e.target.value as MediaRole)}
          title="Role affects placement and visual behavior. Changes apply to all uses of this file."
        >
          {!media && <option value="">Unassigned</option>}
          {MEDIA_ROLES.map(r => (
            <option key={r} value={r}>{MEDIA_ROLE_LABELS[r]}</option>
          ))}
        </select>
        <span className="vz-tl-insp-role-hint">Applies to all uses of this file</span>
      </div>

      {/* Timing: start, duration, source */}
      <div className="vz-tl-insp-group">
        <span className="vz-tl-insp-field-label">Start</span>
        <span className="vz-tl-insp-ro-val">{fmtSec(clip.startSec)}</span>
        <span className="vz-tl-insp-field-label">Dur (s)</span>
        <input
          type="number"
          className="vz-tl-dur-input"
          min={MIN_CLIP_DUR}
          max={3600}
          step={0.25}
          value={clip.durationSec}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v >= MIN_CLIP_DUR) onUpdate(clip.id, { durationSec: v })
          }}
          title="Clip duration (seconds)"
        />
        {media?.type === 'video' && media.metadata?.duration != null && (
          <>
            <span className="vz-tl-insp-field-label">Src</span>
            <span className="vz-tl-insp-ro-val">{media.metadata.duration.toFixed(1)}s</span>
          </>
        )}
      </div>

      {/* In / Out */}
      <div className="vz-tl-insp-group">
        <span className="vz-tl-insp-field-label">In</span>
        <input
          type="number"
          className="vz-tl-inout-input"
          min={0}
          step={0.1}
          value={clip.mediaInSec}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v >= 0) onUpdate(clip.id, { mediaInSec: v })
          }}
          title="Media in-point (seconds)"
        />
        <span className="vz-tl-insp-field-label">Out</span>
        <input
          type="number"
          className="vz-tl-inout-input"
          min={0}
          step={0.1}
          value={clip.mediaOutSec ?? ''}
          placeholder="end"
          onChange={e => {
            const raw = e.target.value.trim()
            if (raw === '') {
              onUpdate(clip.id, { mediaOutSec: undefined })
            } else {
              const v = parseFloat(raw)
              if (!isNaN(v) && v > 0) onUpdate(clip.id, { mediaOutSec: v })
            }
          }}
          title="Media out-point (blank = end)"
        />
      </div>

      {/* Playback mode + Fit mode */}
      <div className="vz-tl-insp-group">
        <span className="vz-tl-insp-field-label">Mode</span>
        <select
          className="az-select vz-tl-mode-select"
          value={clip.playbackMode}
          onChange={e => onUpdate(clip.id, { playbackMode: e.target.value as VzTimelineClip['playbackMode'] })}
          title="Playback mode"
        >
          <option value="trim">Trim</option>
          <option value="loop">Loop</option>
          <option value="freeze">Freeze</option>
        </select>
        <span className="vz-tl-insp-field-label">Fit</span>
        <select
          className="az-select vz-tl-fit-select"
          value={clip.fitMode}
          onChange={e => onUpdate(clip.id, { fitMode: e.target.value as VzTimelineClip['fitMode'] })}
          title="Fit mode"
        >
          <option value="cover">Cover</option>
          <option value="contain">Contain</option>
        </select>
      </div>

      {/* Transition controls */}
      <div className="vz-tl-insp-group vz-tl-insp-transition">
        <span className="vz-tl-insp-field-label">Transition</span>
        <select
          className="az-select vz-tl-tx-select"
          value={clip.transitionOut?.type ?? 'cut'}
          onChange={e => {
            const type = e.target.value as VzTransitionType
            if (type === 'cut') {
              onUpdate(clip.id, { transitionOut: undefined })
            } else {
              const def = TRANSITION_DEFAULTS[type]
              onUpdate(clip.id, {
                transitionOut: {
                  ...def,
                  durationSec: clip.transitionOut?.durationSec ?? def.durationSec,
                },
              })
            }
          }}
          title="Transition out to next clip"
        >
          {(Object.keys(TRANSITION_LABELS) as VzTransitionType[]).map(type => (
            <option key={type} value={type}>{TRANSITION_LABELS[type]}</option>
          ))}
        </select>
        {clip.transitionOut && clip.transitionOut.type !== 'cut' && (
          <>
            <input
              type="number"
              className="vz-tl-tx-dur"
              min={0.1}
              max={clip.durationSec}
              step={0.1}
              value={clip.transitionOut.durationSec}
              onChange={e => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v) && v > 0 && clip.transitionOut) {
                  onUpdate(clip.id, { transitionOut: { ...clip.transitionOut, durationSec: v } })
                }
              }}
              title="Overlap duration (s)"
            />
            <select
              className="az-select vz-tl-tx-easing"
              value={clip.transitionOut.easing ?? 'linear'}
              onChange={e => {
                if (clip.transitionOut) {
                  onUpdate(clip.id, {
                    transitionOut: { ...clip.transitionOut, easing: e.target.value as VzTransitionEasing },
                  })
                }
              }}
              title="Transition easing"
            >
              <option value="linear">Linear</option>
              <option value="easeIn">Ease In</option>
              <option value="easeOut">Ease Out</option>
              <option value="easeInOut">Ease In/Out</option>
              <option value="easeInCubic">Cubic In</option>
              <option value="easeOutCubic">Cubic Out</option>
              <option value="easeInOutCubic">Cubic In/Out</option>
            </select>
            <input
              type="number"
              className="vz-tl-tx-intensity"
              min={0}
              max={1}
              step={0.05}
              value={clip.transitionOut.intensity ?? 1}
              onChange={e => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v) && clip.transitionOut) {
                  onUpdate(clip.id, { transitionOut: { ...clip.transitionOut, intensity: Math.max(0, Math.min(1, v)) } })
                }
              }}
              title="Intensity (0–1)"
            />
          </>
        )}
      </div>

      {/* Actions */}
      <div className="vz-tl-insp-group vz-tl-insp-actions">
        <button className="vz-tl-clip-btn" disabled={idx === 0}
          onClick={() => onMove(clip.id, -1)} title="Move left">‹</button>
        <button className="vz-tl-clip-btn" disabled={idx === total - 1}
          onClick={() => onMove(clip.id, 1)} title="Move right">›</button>
        <button className="vz-tl-clip-btn"
          onClick={() => onDuplicate(clip.id)} title="Duplicate">⧉</button>
        <button className="vz-tl-clip-btn vz-tl-clip-btn--remove"
          onClick={() => onRemove(clip.id)} title="Delete clip">✕</button>
      </div>

    </div>
  )
}
