import { useMemo } from 'react'
import { useVisualStore } from '../../../stores/visualStore'
import type { UploadedMedia } from '../../../stores/mediaStore'
import type { VzTimelineClip } from '../../../types/timeline'
import { MEDIA_ROLE_BADGE_LABELS } from '../../../lib/mediaRoles'
import { getActiveTimelineClip } from '../../../lib/timeline'

type Props = {
  timelineEnabled: boolean
  timelineClips: VzTimelineClip[]
  timelineLoop: boolean
  activeMedia: UploadedMedia | null
  mediaItems: UploadedMedia[]
}

type RenderSource =
  | { kind: 'timeline'; name: string; role: string | null }
  | { kind: 'timeline-empty' }
  | { kind: 'deck'; name: string; role: string | null }
  | { kind: 'generative' }

export function RenderSourceBadge({
  timelineEnabled, timelineClips, timelineLoop, activeMedia, mediaItems,
}: Props) {
  // timelineClock is published at ~15fps from the RAF loop — cheap way to track
  // the active clip without touching the render thread.
  const timelineClock = useVisualStore(s => s.timelineClock)

  const source = useMemo<RenderSource>(() => {
    if (timelineEnabled) {
      if (timelineClips.length > 0) {
        const { clip } = getActiveTimelineClip(timelineClips, timelineClock, timelineLoop)
        if (clip) {
          const m = mediaItems.find(x => x.id === clip.mediaId)
          return {
            kind: 'timeline',
            name: m ? (m.title ?? m.name) : '(unknown)',
            role: m?.mediaRole ? MEDIA_ROLE_BADGE_LABELS[m.mediaRole] : null,
          }
        }
      }
      return { kind: 'timeline-empty' }
    }
    if (activeMedia) {
      return {
        kind: 'deck',
        name: activeMedia.title ?? activeMedia.name,
        role: activeMedia.mediaRole ? MEDIA_ROLE_BADGE_LABELS[activeMedia.mediaRole] : null,
      }
    }
    return { kind: 'generative' }
  }, [timelineEnabled, timelineClips, timelineClock, timelineLoop, activeMedia, mediaItems])

  let modeLabel: string
  let name: string | null = null
  let role: string | null = null
  let cls: string

  switch (source.kind) {
    case 'timeline':
      modeLabel = 'Timeline'; name = source.name; role = source.role; cls = 'vz-rsb--timeline'; break
    case 'timeline-empty':
      modeLabel = 'Timeline'; name = 'No active clip'; cls = 'vz-rsb--empty'; break
    case 'deck':
      modeLabel = 'Deck'; name = source.name; role = source.role; cls = 'vz-rsb--deck'; break
    case 'generative':
    default:
      modeLabel = 'Generative'; cls = 'vz-rsb--generative'; break
  }

  return (
    <div className={`vz-render-source-badge ${cls}`}>
      <span className="vz-rsb-mode">{modeLabel}</span>
      {name && <span className="vz-rsb-sep">·</span>}
      {name && <span className="vz-rsb-name" title={name}>{name}</span>}
      {role && <span className="vz-rsb-role">{role}</span>}
    </div>
  )
}
