import { useEffect, useState, useSyncExternalStore } from 'react'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { useMediaStore } from '../../../stores/mediaStore'
import type { Cinema2MediaKind, Cinema2MediaSlotId } from '../cinema2/contracts/Cinema2NativePresetManifest'
import type { Cinema2MediaSlotRuntimeSnapshot, Cinema2MediaSource } from '../cinema2/media/Cinema2MediaSlotRuntime'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { MediaDeckPanel } from '../media/MediaDeckPanel'
import { CtrlSection, SelectRow } from './ReactControlRows'
import { IconChipButton } from './controls/IconChipButton'
import { isUnifiedSvgMediaItem } from './svgSourceLifecycle'

export interface Cinema2MediaSourcePanelProps {
  runtime: Cinema2Runtime | null
  onOpenMediaManager?: () => void
}

const EMPTY_MEDIA_SNAPSHOT: Readonly<Cinema2MediaSlotRuntimeSnapshot> = Object.freeze({
  slotCount: 0,
  readyResourceCount: 0,
  loadingCount: 0,
  errorCount: 0,
  missingRequiredCount: 0,
  slots: Object.freeze([]),
})
const NOOP_SUBSCRIBE = () => () => {}

/** Generic Source surface for native Cinema 2.0 media slots. */
export function Cinema2MediaSourcePanel({ runtime, onOpenMediaManager }: Cinema2MediaSourcePanelProps) {
  const mediaRuntime = runtime?.getMediaSlotRuntime() ?? null
  const snapshot = useSyncExternalStore(
    mediaRuntime?.subscribe ?? NOOP_SUBSCRIBE,
    mediaRuntime?.getSnapshot ?? (() => EMPTY_MEDIA_SNAPSHOT),
    () => EMPTY_MEDIA_SNAPSHOT,
  )
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')

  useEffect(() => {
    if (snapshot.slots.some(slot => slot.id === selectedSlotId)) return
    setSelectedSlotId(snapshot.slots[0]?.id ?? '')
  }, [selectedSlotId, snapshot.slots])

  if (!runtime) {
    return <div className="rv-ctrl-info" data-cinema2-media-source="unavailable">Cinema 2.0 media is unavailable until the runtime is active.</div>
  }
  if (snapshot.slots.length === 0) {
    return <div className="rv-ctrl-info" data-cinema2-media-source="empty">This Cinema 2.0 preset does not declare media slots.</div>
  }

  const selectedSlot = snapshot.slots.find(slot => slot.id === selectedSlotId) ?? snapshot.slots[0]
  const status = mediaStatusCopy(selectedSlot)

  return (
    <div data-cinema2-media-source="slots">
      <CtrlSection label="Media" />
      {snapshot.slots.length > 1 && (
        <SelectRow
          id="cinema2-media-slot"
          label="Slot"
          value={selectedSlot.id}
          options={snapshot.slots.map(slot => ({
            value: slot.id,
            label: `${slot.label}${slot.required ? ' · Required' : ''}`,
          }))}
          onChange={setSelectedSlotId}
        />
      )}
      <div className="rv-ctrl-info" role="status" aria-live="polite" data-cinema2-media-status={selectedSlot.status}>
        <strong>{selectedSlot.label}</strong> · {status}
        {selectedSlot.error ? ` ${selectedSlot.error}` : ''}
      </div>
      {selectedSlot.source && (
        <div className="rv-ctrl-row">
          <span className="rv-ctrl-label">Source</span>
          <span className="rv-ctrl-description">{selectedSlot.source.label}</span>
          <IconChipButton onClick={() => mediaRuntime?.remove(selectedSlot.id)}>Remove</IconChipButton>
        </div>
      )}
      <MediaDeckPanel
        mode="react"
        activeMediaId={selectedSlot.source?.id ?? null}
        onOpenMediaManager={onOpenMediaManager}
        title={`${selectedSlot.label} Media`}
        getDisabledReason={media => getCinema2MediaDisabledReason(media, selectedSlot.accepts)}
        onSelect={mediaId => {
          const media = useMediaStore.getState().items.find(item => item.id === mediaId)
          if (!media || !mediaRuntime) return
          const source = cinema2MediaSourceFromLibraryItem(media)
          if (!source) return
          void mediaRuntime.replace(selectedSlot.id as Cinema2MediaSlotId, source)
        }}
      />
    </div>
  )
}

export function cinema2MediaSourceFromLibraryItem(media: UploadedMedia): Readonly<Cinema2MediaSource> | null {
  const url = (media.proxyUrl ?? media.url ?? '').trim()
  if (!url) return null
  const kind: Cinema2MediaKind = isUnifiedSvgMediaItem(media) ? 'svg' : media.type
  return Object.freeze({
    id: media.id,
    revision: media.revision ?? `${media.storagePath ?? media.id}:${media.urlExpiresAt ?? 0}`,
    label: media.title?.trim() || media.name,
    kind,
    url,
    mimeType: media.mimeType ?? media.metadata.detectedMimeType ?? null,
    ...(typeof media.metadata.width === 'number' ? { width: media.metadata.width } : {}),
    ...(typeof media.metadata.height === 'number' ? { height: media.metadata.height } : {}),
    ...(typeof media.metadata.duration === 'number' ? { durationSec: media.metadata.duration } : {}),
  })
}

function getCinema2MediaDisabledReason(media: UploadedMedia, accepts: readonly Cinema2MediaKind[]): string | null {
  if (media.uploading) return 'This media is still uploading.'
  if (media.lifecycleStatus === 'deletion_pending') return 'This media is pending deletion.'
  const source = cinema2MediaSourceFromLibraryItem(media)
  if (!source) return 'This media does not currently have a loadable runtime source.'
  return accepts.includes(source.kind) ? null : `This slot accepts ${accepts.join(', ')} media.`
}

function mediaStatusCopy(slot: Cinema2MediaSlotRuntimeSnapshot['slots'][number]): string {
  if (slot.status === 'ready') return 'Ready'
  if (slot.status === 'loading') return 'Loading…'
  if (slot.status === 'error') return 'Load failed.'
  if (slot.status === 'missing-required') return 'Required source missing.'
  return 'Optional source not selected.'
}
