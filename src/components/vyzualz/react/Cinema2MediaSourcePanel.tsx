import { useReactStore } from '../../../stores/reactStore'
import { ContextActionMenu } from '../context-menu/ContextActionMenu'
import { MediaAddToPoolPicker } from '../media/MediaAddToMenu'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { subscribeCinema2MediaDeletion } from '../../../stores/cinema2MediaDeletion'
import { useMediaStore } from '../../../stores/mediaStore'
import type { Cinema2MediaSlotRuntimeSnapshot } from '../cinema2/media/Cinema2MediaSlotRuntime'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { MediaLibraryBrowser, type MediaLibraryCardActionAnchor } from '../media/MediaLibraryBrowser'
import { notify } from '../../../stores/notificationStore'
import { CANVAS_MEDIA_LIBRARY_CAPABILITIES, CANVAS_ENGINE_MEDIA_LIBRARY_CAPABILITIES } from '../media/mediaLibraryCapabilities'
import { SelectRow } from './ReactControlRows'
import { activateCinema2Pool, beginEverywhereMediaRequest, isEverywhereMediaRequestCurrent, resetCinema2Media, setCinema2PoolSelection, getCinema2PresetPoolId } from './Cinema2EverywhereMediaSourceController'
import { captureCinema2WorkspacePresetState } from '../cinema2/runtime/Cinema2WorkspaceSession'
import { Cinema2ActiveSource, Cinema2SourceThumbnail } from './Cinema2ActiveSource'
import { cinema2SlotSupportsPool } from '../cinema2/media/Cinema2SourceCapabilities'
import { isUnifiedSvgMediaItem } from '../../../lib/svgMediaEligibility'
import { cinema2MediaSourceFromLibraryItem, getCinema2MediaDisabledReason } from './Cinema2LibraryMediaSource'

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
export function Cinema2MediaSourcePanel({ runtime }: Cinema2MediaSourcePanelProps) {
  const mediaRuntime = runtime?.getMediaSlotRuntime() ?? null
  const snapshot = useSyncExternalStore(
    mediaRuntime?.subscribe ?? NOOP_SUBSCRIBE,
    mediaRuntime?.getSnapshot ?? (() => EMPTY_MEDIA_SNAPSHOT),
    () => EMPTY_MEDIA_SNAPSHOT,
  )
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')
  const [actionMenu, setActionMenu] = useState<({ mediaId: string } & MediaLibraryCardActionAnchor) | null>(null)
  const selectedSlot = snapshot.slots.find(slot => slot.id === selectedSlotId) ?? snapshot.slots[0]
  const poolCapable = !!selectedSlot && cinema2SlotSupportsPool(selectedSlot.id)
  const presetId = runtime?.getCompiledPresetPlan().presetId
  const activePool = useReactStore(state => poolCapable ? state.canvasOrchestrationSettings.mediaPools.find(pool => pool.id === getCinema2PresetPoolId(state, presetId)) ?? null : null)
  const everywhere = selectedSlot?.id === 'everywhere-screen-media'
  const displayedSource = selectedSlot
    ? mediaRuntime?.getCommittedSource(selectedSlot.id)?.source ?? null
    : null
  const compatiblePoolCount = useMediaStore(state => activePool && selectedSlot
    ? new Set(state.items.filter(item => activePool.mediaIds.includes(item.id) && !item.uploading
      && item.lifecycleStatus !== 'deletion_pending' && selectedSlot.accepts.includes(isUnifiedSvgMediaItem(item) ? 'svg' : item.type)).map(item => item.id)).size
    : 0)
  const previewItem = useMediaStore(state => state.items.find(item => item.id === (activePool?.mediaIds[0] ?? displayedSource?.id)))
  const request = useRef(0)
  const signingId = useRef<string | null>(null)
  const accountId = useMediaStore(state => state.accountId)
  const library = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState(false)
  useLayoutEffect(() => {
    setActionMenu(null); setPending(false); signingId.current = null
    const unsubscribe = subscribeCinema2MediaDeletion(id => {
      if (signingId.current !== id) return
      request.current++; signingId.current = null; setPending(false)
    })
    return () => { unsubscribe(); request.current++ }
  }, [runtime, selectedSlot?.id, accountId])

  useEffect(() => {
    if (snapshot.slots.some(slot => slot.id === selectedSlotId)) return
    setSelectedSlotId(snapshot.slots[0]?.id ?? '')
  }, [selectedSlotId, snapshot.slots])

  if (!runtime) {
    return <div className="rv-ctrl-info" data-cinema2-media-source="unavailable">Cinema 2.0 media is unavailable until the runtime is active.</div>
  }
  if (snapshot.slots.length === 0) {
    return <Cinema2ActiveSource name="Native preset content" type="Built-in content" status="This preset has no replaceable media slots." />
  }

  const makeActive = (mediaId: string) => {
    const ticket = ++request.current
    signingId.current = mediaId
    const generation = beginEverywhereMediaRequest(runtime, selectedSlot.id)
    const accountId = useMediaStore.getState().accountId
    mediaRuntime?.cancelPendingReplacement(selectedSlot.id)
    const current = () => ticket === request.current
      && isEverywhereMediaRequestCurrent(runtime, generation, selectedSlot.id)
      && useMediaStore.getState().accountId === accountId
    const assign = () => {
      if (!current() || !mediaRuntime) return
      setPending(false); signingId.current = null
      const media = useMediaStore.getState().items.find(item => item.id === mediaId)
      if (!media) { notify('react', { tone: 'error', title: 'Media could not be loaded', message: 'Media is unavailable.' }); return }
      const source = cinema2MediaSourceFromLibraryItem(media)
      if (!source || getCinema2MediaDisabledReason(media, selectedSlot.accepts)) {
        notify('react', { tone: 'error', title: 'Media could not be loaded', message: 'Media is unavailable or unsupported.' })
        return
      }
      const replacement = everywhere ? mediaRuntime.replace(selectedSlot.id, source, { fit: 'contain' }) : mediaRuntime.replace(selectedSlot.id, source)
      if (poolCapable) setCinema2PoolSelection(runtime, null)
      else useReactStore.getState().storeCinema2WorkspacePresetState(captureCinema2WorkspacePresetState(runtime))
      void replacement
        .then(slot => {
          if (current()) useReactStore.getState().storeCinema2WorkspacePresetState(captureCinema2WorkspacePresetState(runtime))
          if (slot.error && current()) notify('react', { tone: 'error', title: 'Media could not be loaded', message: `${slot.label}: ${slot.error}` })
        })
        .catch(error => {
          if (current()) notify('react', { tone: 'error', title: 'Media could not be loaded', message: `${selectedSlot.label}: ${error instanceof Error ? error.message : String(error)}` })
        })
    }
    const candidate = useMediaStore.getState().items.find(item => item.id === mediaId)
    if (!poolCapable && !candidate?.storagePath) { assign(); return }
    setActionMenu(null)
    setPending(true)
    void useMediaStore.getState().ensureMediaSigned([mediaId], 'visible').then(assign).catch(error => {
      if (current()) { setPending(false); notify('react', { tone: 'error', title: 'Media could not be loaded', message: String(error) }) }
    })
  }

  return (
    <div className="rv-canvas-engine-panel" data-cinema2-media-source="slots">
      {snapshot.slots.length > 1 && <SelectRow id="cinema2-media-slot" label="Slot" value={selectedSlot.id}
        options={snapshot.slots.map(slot => ({ value: slot.id, label: `${slot.label}${slot.required ? ' · Required' : ''}` }))}
        onChange={setSelectedSlotId} />}
      <Cinema2ActiveSource key={selectedSlot.id} name={activePool?.name ?? displayedSource?.label ?? (selectedSlot.required ? 'Source required' : everywhere ? 'Default Eyes' : 'Native preset content')}
        type={activePool ? 'Media pool' : displayedSource ? displayedSource.kind.toUpperCase() : selectedSlot.required ? 'Required slot' : 'Built-in content'}
        preview={<Cinema2SourceThumbnail url={previewItem?.localThumbnailObjectUrl ?? previewItem?.thumbnailUrl ?? (!activePool && displayedSource?.kind !== 'video' ? displayedSource?.url ?? (everywhere ? '/cinema2/textures/everywhere-eye.webp' : null) : null)} />}
        status={pending || selectedSlot.status === 'loading' ? everywhere ? 'Loading replacement…' : 'Loading media…' : activePool ? `${compatiblePoolCount} media items${!compatiblePoolCount ? everywhere ? ' · Showing default eyes' : ' · Showing native content' : ''}` : selectedSlot.required && !selectedSlot.source ? 'Choose compatible media.' : undefined}
        error={selectedSlot.error} actions={[
          { id: 'replace', label: activePool || displayedSource ? 'Replace source' : 'Choose source', onSelect: () => queueMicrotask(() => (library.current?.querySelector<HTMLElement>('input') ?? library.current?.querySelector<HTMLElement>('button'))?.focus()) },
          ...(!selectedSlot.required && (activePool || selectedSlot.source || pending) ? [{ id: 'reset', label: everywhere ? 'Restore Default Eyes' : 'Remove source / Restore built-in', onSelect: () => { request.current++; setPending(false); setActionMenu(null); resetCinema2Media(runtime, selectedSlot.id, poolCapable) } }] : []),
        ]} />
      <div className="rv-canvas-library-shell" ref={library}>
        <MediaLibraryBrowser
          activeMediaId={poolCapable && activePool ? null : displayedSource?.id ?? null}
          onSelect={makeActive}
          activePoolId={activePool?.id ?? null}
          onActivatePool={poolCapable ? id=>{request.current++;setPending(false);setActionMenu(null);activateCinema2Pool(runtime,selectedSlot.id,id)} : undefined}
          onCardActionRequest={poolCapable ? (mediaId, anchor) => setActionMenu({ mediaId, ...anchor }) : undefined}
          context="canvas"
          title="Media Library"
          capabilities={poolCapable ? CANVAS_ENGINE_MEDIA_LIBRARY_CAPABILITIES : CANVAS_MEDIA_LIBRARY_CAPABILITIES}
          getDisabledReason={media => poolCapable && media.storagePath && !media.uploading && media.lifecycleStatus !== 'deletion_pending' && selectedSlot.accepts.includes(isUnifiedSvgMediaItem(media) ? 'svg' : media.type)
            ? null : getCinema2MediaDisabledReason(media, selectedSlot.accepts)}
        />
      </div>
      {poolCapable && actionMenu && (
        <ContextActionMenu x={actionMenu.x} y={actionMenu.y} ariaLabel="Cinema 2.0 media actions"
          onClose={() => setActionMenu(null)} items={[
            { id: 'make-active', label: 'Make Active', onSelect: () => makeActive(actionMenu.mediaId) },
            { id: 'add-to-pool', label: 'Add to Pool', submenu: <MediaAddToPoolPicker targetIds={[actionMenu.mediaId]}
              onDone={message => { if (message) notify('react', { tone: 'warning', title: 'Pool action', message }); setActionMenu(null) }} /> },
          ]} />
      )}
    </div>
  )
}

export { cinema2MediaSourceFromLibraryItem, getCinema2MediaDisabledReason } from './Cinema2LibraryMediaSource'
