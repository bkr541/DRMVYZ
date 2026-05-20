import { useMemo, useRef } from 'react'
import { useVisualStore } from '../../stores/visualStore'
import { useMediaStore } from '../../stores/mediaStore'
import type { UploadedMedia } from '../../stores/mediaStore'
import type { VzTimelineClip, VzTransitionConfig, VzTransitionType, VzTransitionEasing } from '../../types/timeline'
import { getTimelineDuration, TRANSITION_LABELS, TRANSITION_DEFAULTS } from '../../lib/timeline'

function fmtSec(sec: number): string {
  return `${sec.toFixed(1)}s`
}

export function TimelinePanel() {
  const {
    timelineClips, timelineLoop,
    setTimelineLoop, addTimelineClip, removeTimelineClip,
    duplicateTimelineClip, reorderTimelineClips, updateTimelineClip, clearTimeline,
  } = useVisualStore()

  const { items } = useMediaStore()
  const activeMediaId  = useVisualStore(s => s.activeMediaId)
  const timelineClock  = useVisualStore(s => s.timelineClock)

  const mediaMap = useMemo(() => new Map(items.map(m => [m.id, m])), [items])

  const totalDuration = getTimelineDuration(timelineClips)
  const activeMedia   = activeMediaId ? (mediaMap.get(activeMediaId) ?? null) : null

  const PX_PER_SEC = 80
  const rulerRef   = useRef<HTMLDivElement>(null)

  const handleScrubPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return
    const rect = rulerRef.current.getBoundingClientRect()
    const t    = (e.clientX - rect.left) / PX_PER_SEC
    useVisualStore.getState().scrubTimeline(Math.max(0, Math.min(totalDuration, t)))
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
            onClick={() => activeMedia && addTimelineClip(activeMedia.id)}
            title={activeMedia ? `Add "${activeMedia.title ?? activeMedia.name}"` : 'No active media'}
          >
            + Add
          </button>
          <button
            className="vz-tl-clear-btn"
            onClick={clearTimeline}
            disabled={timelineClips.length === 0}
            title="Clear all clips"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Right side: pixel ruler + clip cards */}
      <div className="vz-tl-right">
        {/* Pixel timeline: ruler + clip blocks + playhead */}
        <div className="vz-tl-timeline-wrap">
          {timelineClips.length === 0 ? (
            <div className="vz-tl-empty">No clips — click + Add to get started</div>
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
              {timelineClips.map(clip => {
                const media = mediaMap.get(clip.mediaId)
                return (
                  <div
                    key={clip.id}
                    className="vz-tl-clip-block"
                    style={{
                      left:  clip.startSec    * PX_PER_SEC,
                      width: clip.durationSec * PX_PER_SEC,
                    }}
                    title={`${media?.title ?? media?.name ?? '(missing)'} — ${clip.durationSec.toFixed(1)}s`}
                  >
                    <span className="vz-tl-clip-block-name">
                      {media?.title ?? media?.name ?? '(missing)'}
                    </span>
                    <span className="vz-tl-clip-block-dur">{clip.durationSec.toFixed(1)}s</span>
                  </div>
                )
              })}

              {/* Playhead */}
              <div
                className="vz-tl-playhead"
                style={{ left: timelineClock * PX_PER_SEC }}
              />
            </div>
          )}
        </div>

        {/* Clip cards — per-clip property editing */}
        <div className="vz-tl-track">
          {timelineClips.map((clip, idx) => (
            <TimelineClipCard
              key={clip.id}
              clip={clip}
              media={mediaMap.get(clip.mediaId)}
              idx={idx}
              total={timelineClips.length}
              onMove={moveClip}
              onRemove={removeTimelineClip}
              onDuplicate={duplicateTimelineClip}
              onUpdate={updateTimelineClip}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TimelineClipCard({
  clip, media, idx, total,
  onMove, onRemove, onDuplicate, onUpdate,
}: {
  clip: VzTimelineClip
  media: UploadedMedia | undefined
  idx: number
  total: number
  onMove: (id: string, dir: -1 | 1) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onUpdate: (id: string, patch: Partial<VzTimelineClip>) => void
}) {
  return (
    <div className="vz-tl-card">
      <div className="vz-tl-card-thumb">
        {media?.thumbnailUrl
          ? <img src={media.thumbnailUrl} alt={media.name} />
          : <span className="vz-tl-thumb-placeholder">{media?.type === 'video' ? '▶' : '◻'}</span>
        }
      </div>

      <span className="vz-tl-card-name" title={media?.title ?? media?.name ?? clip.mediaId}>
        {media?.title ?? media?.name ?? '(missing)'}
      </span>

      <input
        type="number"
        className="vz-tl-dur-input"
        min={0.1}
        max={3600}
        step={0.5}
        value={clip.durationSec}
        onChange={e => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v) && v > 0) onUpdate(clip.id, { durationSec: v })
        }}
        title="Clip duration (seconds)"
      />

      {/* Source range: In / Out */}
      <div className="vz-tl-inout-row">
        <label className="vz-tl-inout-label">In</label>
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
        <label className="vz-tl-inout-label">Out</label>
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
          title="Media out-point (seconds, blank = end)"
        />
      </div>

      {/* Playback mode + Fit mode on same row */}
      <div className="vz-tl-mode-row">
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
      <div className="vz-tl-transition-row">
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
                  // Preserve existing duration if user already customised it
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

      <div className="vz-tl-card-actions">
        <button className="vz-tl-clip-btn" disabled={idx === 0}
          onClick={() => onMove(clip.id, -1)} title="Move left">‹</button>
        <button className="vz-tl-clip-btn" disabled={idx === total - 1}
          onClick={() => onMove(clip.id, 1)} title="Move right">›</button>
        <button className="vz-tl-clip-btn"
          onClick={() => onDuplicate(clip.id)} title="Duplicate">⧉</button>
        <button className="vz-tl-clip-btn vz-tl-clip-btn--remove"
          onClick={() => onRemove(clip.id)} title="Remove">✕</button>
      </div>
    </div>
  )
}
