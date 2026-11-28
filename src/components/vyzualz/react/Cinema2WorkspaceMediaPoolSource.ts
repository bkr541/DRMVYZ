import { useMediaStore } from '../../../stores/mediaStore'
import { useReactStore } from '../../../stores/reactStore'
import type { Cinema2MediaPoolSource } from '../cinema2/media/Cinema2MediaPoolSource'
import { cinema2MediaSourceFromLibraryItem, getCinema2MediaDisabledReason } from './Cinema2LibraryMediaSource'
import { cinema2NativePresetRegistry } from '../cinema2/presets/Cinema2PresetRegistry'
import { cinema2SlotSupportsPool } from '../cinema2/media/Cinema2SourceCapabilities'
import { isUnifiedSvgMediaItem } from '../../../lib/svgMediaEligibility'

import type { Cinema2PresetId } from '../cinema2/contracts/Cinema2NativePresetManifest'

import { getCinema2PresetPoolId } from './Cinema2EverywhereMediaSourceController'

/** The same named pool library used by CANVAS and Media Manager; selection is preset-owned.
 * Signing occurs only for selected feeds, not for every cabinet or frame. */
export function createCinema2WorkspaceMediaPoolSource(presetId?: Cinema2PresetId): Cinema2MediaPoolSource {
  const compiled = presetId ? cinema2NativePresetRegistry.compile(presetId) : null
  const accepts = compiled?.ok ? compiled.plan.manifest.mediaSlots?.find(slot => cinema2SlotSupportsPool(slot.id))?.accepts ?? [] : []
  let previousPool: unknown
  let previousItems: unknown
  let cached: ReturnType<Cinema2MediaPoolSource['getSelection']> = null
  const source: Cinema2MediaPoolSource = {
    getSelection() {
      const state = useReactStore.getState()
      const pool = state.canvasOrchestrationSettings.mediaPools.find(candidate => candidate.id === getCinema2PresetPoolId(state, presetId))
      const items = useMediaStore.getState().items
      if (pool === previousPool && items === previousItems) return cached
      previousPool = pool; previousItems = items
      if (!pool) return (cached = null)
      const byId = new Map(items.map(item => [item.id, item]))
      return (cached = { id: pool.id, mediaIds: pool.mediaIds.filter(id => {
        const item = byId.get(id)
        // A stored asset may not have its signed URL yet. Resolve it on demand.
        return !!item && !item.uploading && item.lifecycleStatus !== 'deletion_pending'
          && accepts.includes(isUnifiedSvgMediaItem(item) ? 'svg' : item.type)
      }) })
    },
    subscribe(listener) {
      let previous = source.getSelection()
      let accountId = useMediaStore.getState().accountId
      const changed = () => {
        const next = source.getSelection()
        const nextAccount = useMediaStore.getState().accountId
        const changedAccount = nextAccount !== accountId
        accountId = nextAccount
        if (next === previous && !changedAccount) return
        const changedMembership = changedAccount || next?.id !== previous?.id || next?.mediaIds.length !== previous?.mediaIds.length
          || next?.mediaIds.some((id, index) => id !== previous?.mediaIds[index])
        previous = next
        if (changedMembership) listener()
      }
      const unsubscribeWorkspace = useReactStore.subscribe(changed)
      const unsubscribeMedia = useMediaStore.subscribe(changed)
      return () => { unsubscribeWorkspace(); unsubscribeMedia() }
    },
    async resolve(mediaId) {
      const accountId = useMediaStore.getState().accountId
      const selected = source.getSelection()
      if (!selected?.mediaIds.includes(mediaId)) return null
      await useMediaStore.getState().ensureMediaSigned([mediaId], 'visible')
      const state = useMediaStore.getState()
      const current = source.getSelection()
      if (state.accountId !== accountId || current?.id !== selected.id || !current.mediaIds.includes(mediaId)) return null
      const item = state.items.find(candidate => candidate.id === mediaId)
      return item && !getCinema2MediaDisabledReason(item, accepts) ? cinema2MediaSourceFromLibraryItem(item) : null
    },
  }
  return source
}
