import { useMemo, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useVisualStore } from '../../../stores/visualStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { useLyricsStore } from '../../../stores/lyricsStore'
import { TimelineInspector } from '../TimelinePanel'
import type { SelectedTimelineEntity } from '../../../stores/visualStore'

export function TimelineInspectorPanel({ onSeekToLyric }: { onSeekToLyric: (sec: number) => void }) {
  const {
    timelineClips, timelineOverlayClips, timelineEffectRegions,
    layerItems,
    selectedTimelineEntity, setSelectedTimelineEntity,
    removeTimelineClip, updateMediaClip, removeMediaClip,
    duplicateTimelineClip, duplicateMediaClip,
    reorderTimelineClips,
    updateEffectRegion, removeEffectRegion,
  } = useVisualStore(useShallow(s => ({
    timelineClips:            s.timelineClips,
    timelineOverlayClips:     s.timelineOverlayClips,
    timelineEffectRegions:    s.timelineEffectRegions,
    layerItems:               s.layerItems,
    selectedTimelineEntity:   s.selectedTimelineEntity,
    setSelectedTimelineEntity: s.setSelectedTimelineEntity,
    removeTimelineClip:       s.removeTimelineClip,
    updateMediaClip:          s.updateMediaClip,
    removeMediaClip:          s.removeMediaClip,
    duplicateTimelineClip:    s.duplicateTimelineClip,
    duplicateMediaClip:       s.duplicateMediaClip,
    reorderTimelineClips:     s.reorderTimelineClips,
    updateEffectRegion:       s.updateEffectRegion,
    removeEffectRegion:       s.removeEffectRegion,
  })))

  const { items: mediaItems, setMediaRole } = useMediaStore(useShallow(s => ({
    items: s.items,
    setMediaRole: s.setMediaRole,
  })))

  const {
    cues: lyricCues,
    globalOffsetMs,
    activeDocumentId: lyricDocumentId,
    updateCueTiming,
    saveTimingChanges,
    lyricTimingDirty,
    isSaving: lyricSaving,
  } = useLyricsStore(useShallow(s => ({
    cues:              s.cues,
    globalOffsetMs:    s.globalOffsetMs,
    activeDocumentId:  s.activeDocumentId,
    updateCueTiming:   s.updateCueTiming,
    saveTimingChanges: s.saveTimingChanges,
    lyricTimingDirty:  s.lyricTimingDirty,
    isSaving:          s.isSaving,
  })))

  const mediaMap = useMemo(() => new Map(mediaItems.map(m => [m.id, m])), [mediaItems])
  const globalOffsetSec = globalOffsetMs / 1000
  const selected = selectedTimelineEntity as SelectedTimelineEntity | null

  const moveBgClip = useCallback((clipId: string, dir: -1 | 1) => {
    const idx = timelineClips.findIndex(c => c.id === clipId)
    if (idx === -1) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= timelineClips.length) return
    const ids = timelineClips.map(c => c.id)
    ;[ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]]
    reorderTimelineClips(ids)
  }, [timelineClips, reorderTimelineClips])

  return (
    <TimelineInspector
      selected={selected}
      bgClips={timelineClips}
      overlayClips={timelineOverlayClips}
      effectRegions={timelineEffectRegions}
      lyricCues={lyricCues}
      mediaMap={mediaMap}
      layerItems={layerItems}
      onUpdateClip={updateMediaClip}
      onRemoveBg={id => { removeTimelineClip(id); setSelectedTimelineEntity(null) }}
      onRemoveOverlay={id => { removeMediaClip(id); setSelectedTimelineEntity(null) }}
      onDuplicateBg={duplicateTimelineClip}
      onDuplicateOverlay={duplicateMediaClip}
      onMoveClip={moveBgClip}
      onUpdateEffect={updateEffectRegion}
      onRemoveEffect={id => { removeEffectRegion(id); setSelectedTimelineEntity(null) }}
      onSetMediaRole={setMediaRole}
      onUpdateLyricTiming={updateCueTiming}
      onSeekToLyric={onSeekToLyric}
      onSaveLyricTiming={saveTimingChanges}
      lyricTimingDirty={lyricTimingDirty}
      lyricSaving={lyricSaving}
      hasLyricDocument={!!lyricDocumentId}
      globalOffsetSec={globalOffsetSec}
    />
  )
}
