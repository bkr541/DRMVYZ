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
    layerItems, selectedLayerItemId, rendererType,
    selectedTimelineEntity, setSelectedTimelineEntity,
    removeTimelineClip, updateMediaClip, removeMediaClip,
    duplicateTimelineClip, duplicateMediaClip,
    reorderTimelineClips, updateLayerItem,
    updateEffectRegion, removeEffectRegion, clearMediaElementFx,
  } = useVisualStore(useShallow(s => ({
    timelineClips:            s.timelineClips,
    timelineOverlayClips:     s.timelineOverlayClips,
    timelineEffectRegions:    s.timelineEffectRegions,
    layerItems:               s.layerItems,
    selectedLayerItemId:      s.selectedLayerItemId,
    rendererType:             s.rendererType,
    selectedTimelineEntity:   s.selectedTimelineEntity,
    setSelectedTimelineEntity: s.setSelectedTimelineEntity,
    removeTimelineClip:       s.removeTimelineClip,
    updateMediaClip:          s.updateMediaClip,
    removeMediaClip:          s.removeMediaClip,
    duplicateTimelineClip:    s.duplicateTimelineClip,
    duplicateMediaClip:       s.duplicateMediaClip,
    reorderTimelineClips:     s.reorderTimelineClips,
    updateLayerItem:          s.updateLayerItem,
    updateEffectRegion:       s.updateEffectRegion,
    removeEffectRegion:       s.removeEffectRegion,
    clearMediaElementFx:      s.clearMediaElementFx,
  })))

  const { items: mediaItems, setMediaRole } = useMediaStore(useShallow(s => ({
    items: s.items,
    setMediaRole: s.setMediaRole,
  })))

  const lyricCues = useLyricsStore(state => state.cues)

  const mediaMap = useMemo(() => new Map(mediaItems.map(m => [m.id, m])), [mediaItems])
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
      selectedLayerItemId={selectedLayerItemId}
      isGpu={rendererType === 'webgl2'}
      onUpdateClip={updateMediaClip}
      onUpdateLayerItem={updateLayerItem}
      onRemoveBg={id => { removeTimelineClip(id); setSelectedTimelineEntity(null) }}
      onRemoveOverlay={id => { removeMediaClip(id); setSelectedTimelineEntity(null) }}
      onDuplicateBg={duplicateTimelineClip}
      onDuplicateOverlay={duplicateMediaClip}
      onMoveClip={moveBgClip}
      onUpdateEffect={updateEffectRegion}
      onRemoveEffect={id => { removeEffectRegion(id); setSelectedTimelineEntity(null) }}
      onSetMediaRole={setMediaRole}
      onSeekToLyric={onSeekToLyric}
      onClearFx={clearMediaElementFx}
    />
  )
}
