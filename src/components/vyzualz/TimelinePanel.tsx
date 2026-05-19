import { useMemo } from 'react'
import { useVisualStore } from '../../stores/visualStore'
import { useMediaStore } from '../../stores/mediaStore'
import type { UploadedMedia } from '../../stores/mediaStore'
import type { VzTimelineClip } from '../../types/timeline'
import { getTimelineDuration } from '../../lib/timeline'

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
  const { activeMediaId } = useVisualStore(s => ({ activeMediaId: s.activeMediaId }))

  const mediaMap = useMemo(() => new Map(items.map(m => [m.id, m])), [items])

  const totalDuration = getTimelineDuration(timelineClips)
  const activeMedia = activeMediaId ? (mediaMap.get(activeMediaId) ?? null) : null

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
    <div className="vz-panel">
      <div className="vz-panel-header">
        <span className="vz-panel-title">Timeline</span>
        <span className="vz-panel-meta">{fmtSec(totalDuration)}</span>
        <button className="vz-panel-icon-btn" onClick={clearTimeline} title="Clear timeline">
          Clear
        </button>
      </div>

      <div className="vz-tl-controls">
        <div className="vz-sync-toggle" onClick={() => setTimelineLoop(!timelineLoop)}>
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
          + Add Active
        </button>
      </div>

      {timelineClips.length === 0 ? (
        <div className="vz-tl-empty">No clips — add media to get started.</div>
      ) : (
        <div className="vz-tl-clips">
          {timelineClips.map((clip, idx) => (
            <TimelineClipRow
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
      )}

      {items.length > 0 && (
        <div className="vz-tl-quick-add">
          <span className="vz-tl-quick-label">Quick Add</span>
          <div className="vz-tl-quick-thumbs">
            {items.slice(0, 4).map(m => (
              <button
                key={m.id}
                className="vz-tl-quick-thumb"
                title={m.title ?? m.name}
                onClick={() => addTimelineClip(m.id)}
              >
                {m.thumbnailUrl
                  ? <img src={m.thumbnailUrl} alt={m.name} />
                  : <span>{m.type === 'video' ? '▶' : '◻'}</span>
                }
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TimelineClipRow({
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
    <div className="vz-tl-clip">
      <div className="vz-tl-clip-thumb">
        {media?.thumbnailUrl
          ? <img src={media.thumbnailUrl} alt={media.name} />
          : <span className="vz-tl-thumb-placeholder">{media?.type === 'video' ? '▶' : '◻'}</span>
        }
      </div>

      <div className="vz-tl-clip-info">
        <span className="vz-tl-clip-name" title={media?.title ?? media?.name ?? clip.mediaId}>
          {media?.title ?? media?.name ?? '(missing)'}
        </span>
        <div className="vz-tl-clip-fields">
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
            title="Duration (seconds)"
          />
          <select
            className="az-select vz-tl-mode-select"
            value={clip.playbackMode}
            onChange={e => onUpdate(clip.id, { playbackMode: e.target.value as VzTimelineClip['playbackMode'] })}
          >
            <option value="trim">Trim</option>
            <option value="loop">Loop</option>
            <option value="freeze">Freeze</option>
          </select>
        </div>
      </div>

      <div className="vz-tl-clip-actions">
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
