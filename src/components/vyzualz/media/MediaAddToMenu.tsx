import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '../../../stores/mediaStore'
import { useReactStore } from '../../../stores/reactStore'
import { useNotifyCurrentPage, type NotifyOptions } from '../../../stores/notificationStore'
import { ContextMenuItemsList, type ContextActionMenuItem } from '../context-menu/ContextActionMenu'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'

// ── MediaAddToMenu ───────────────────────────────────────────────────────────
//
// Content for the media card right-click menu's "Add To" row (see
// ContextActionMenu.tsx's submenu support). Renders two further hover rows,
// Collection and Pool, each opening a picker listing the existing ones plus
// an inline "New …" input — picking an existing entry or creating a new one
// adds `targetIds` (the right-clicked card, or the whole bulk selection) to
// it, then calls `onDone` to close the whole cascade.
//
// Pools are CANVAS Engine's own reactStore-backed Media Pools
// (CanvasMediaPoolsPanel.tsx) — reused as-is so "the same Pool a user can
// use within Canvas Engine" stays a single source of truth.

interface AddToPickerOption {
  id: string
  name: string
  count?: number
}

function AddToPickerPanel({
  kind,
  options,
  onPick,
  onCreate,
  error,
  emptyHint,
}: {
  kind: 'Collection' | 'Pool'
  options: AddToPickerOption[]
  onPick: (id: string) => void
  /** Omit to render a pick-only list with no "New …" input. */
  onCreate?: (name: string) => void
  error: string | null
  emptyHint?: string
}) {
  const [draft, setDraft] = useState('')

  const submitCreate = () => {
    const name = draft.trim()
    if (!name || !onCreate) return
    onCreate(name)
    setDraft('')
  }

  return (
    <div className="vz-add-to-picker">
      {options.length === 0 ? (
        <div className="vz-add-to-picker__empty">{emptyHint ?? `No ${kind.toLowerCase()}s yet.`}</div>
      ) : (
        options.map(option => (
          <button
            type="button"
            role="menuitem"
            key={option.id}
            className="vz-add-to-picker__option"
            onClick={() => onPick(option.id)}
          >
            <span className="vz-add-to-picker__name">{option.name}</span>
            {option.count !== undefined && <span className="vz-add-to-picker__count">{option.count}</span>}
          </button>
        ))
      )}
      {onCreate && (
        <>
          <div className="vz-add-to-picker__divider" role="separator" />
          <div className="vz-add-to-picker__create" onPointerDown={event => event.stopPropagation()}>
            <DreamVizTextInput
              className="vz-add-to-picker__input"
              value={draft}
              placeholder={`New ${kind}`}
              aria-label={`New ${kind} name`}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') submitCreate()
              }}
            />
          </div>
        </>
      )}
      {error && <div className="vz-add-to-picker__error" role="alert">{error}</div>}
    </div>
  )
}

/**
 * The card for an "Add To" action. `inGroupBefore` / `inGroupAfter` count how many of the `total` targets were already in
 * the Collection or Pool, and are in it now, so a repeat add reports "already there" and a failed write is not called a success.
 */
function describeAddToGroup(kind: 'Collection' | 'Pool', name: string, total: number, inGroupBefore: number, inGroupAfter: number): NotifyOptions {
  const noun = (count: number) => `${count} media item${count === 1 ? '' : 's'}`
  const added = inGroupAfter - inGroupBefore
  if (inGroupAfter < total) {
    return {
      tone: 'error',
      title: `Add to ${kind.toLowerCase()} incomplete`,
      message: `${noun(Math.max(added, 0))} of ${total} ${added === 1 ? 'was' : 'were'} added to "${name}". Try adding the rest again.`,
    }
  }
  if (added === 0) {
    return { tone: 'info', title: `Already in ${kind.toLowerCase()}`, message: total === 1 ? `That media item is already in "${name}".` : `Those ${total} media items are already in "${name}".` }
  }
  return { tone: 'success', title: `Added to ${kind.toLowerCase()}`, message: `${noun(added)} ${added === 1 ? 'was' : 'were'} added to "${name}".` }
}

export function MediaAddToSubmenu({
  targetIds,
  onDone,
}: {
  targetIds: string[]
  onDone: () => void
}) {
  const { collections, createCollection, addMediaToCollection } = useMediaStore(useShallow(state => ({
    collections: state.collections,
    createCollection: state.createCollection,
    addMediaToCollection: state.addMediaToCollection,
  })))
  const { mediaPools, createCanvasMediaPool, addCanvasMediaToPool } = useReactStore(useShallow(state => ({
    mediaPools: state.canvasOrchestrationSettings.mediaPools,
    createCanvasMediaPool: state.createCanvasMediaPool,
    addCanvasMediaToPool: state.addCanvasMediaToPool,
  })))

  const notifyPage = useNotifyCurrentPage()
  const [collectionError, setCollectionError] = useState<string | null>(null)
  const [poolError, setPoolError] = useState<string | null>(null)

  const collectionMemberCount = (collectionId: string, ids: string[]) => {
    const items = useMediaStore.getState().items
    return ids.filter(id => items.find(item => item.id === id)?.collectionIds.includes(collectionId)).length
  }

  const addToCollection = async (collectionId: string, collectionName?: string) => {
    const name = collectionName ?? collections.find(collection => collection.id === collectionId)?.name ?? 'the collection'
    const alreadyIn = collectionMemberCount(collectionId, targetIds)
    await addMediaToCollection(collectionId, targetIds)
    notifyPage(describeAddToGroup('Collection', name, targetIds.length, alreadyIn, collectionMemberCount(collectionId, targetIds)))
    onDone()
  }

  const createAndAddCollection = async (name: string) => {
    setCollectionError(null)
    const id = await createCollection(name)
    if (!id) {
      setCollectionError('Could not create collection.')
      return
    }
    notifyPage({ tone: 'success', title: 'Collection created', message: `"${name}" was added to your collections.` })
    await addToCollection(id, name)
  }

  const addToPool = (poolId: string) => {
    const pool = mediaPools.find(candidate => candidate.id === poolId)
    const alreadyIn = pool ? targetIds.filter(mediaId => pool.mediaIds.includes(mediaId)).length : 0
    const failed = targetIds.filter(mediaId => !addCanvasMediaToPool(poolId, mediaId).ok).length
    notifyPage(describeAddToGroup('Pool', pool?.name ?? 'the pool', targetIds.length, alreadyIn, targetIds.length - failed))
    onDone()
  }

  const createAndAddPool = (name: string) => {
    setPoolError(null)
    const result = createCanvasMediaPool(name)
    if (!result.ok) {
      setPoolError(result.message)
      return
    }
    notifyPage({ tone: 'success', title: 'Pool created', message: `"${result.pool.name}" was added to your media pools.` })
    for (const mediaId of targetIds) addCanvasMediaToPool(result.pool.id, mediaId)
    notifyPage(describeAddToGroup('Pool', result.pool.name, targetIds.length, 0, targetIds.length))
    onDone()
  }

  const items: ContextActionMenuItem[] = [
    {
      id: 'add-to-collection',
      label: 'Collection',
      submenu: (
        <AddToPickerPanel
          kind="Collection"
          options={collections.map(collection => ({ id: collection.id, name: collection.name }))}
          onPick={id => { void addToCollection(id) }}
          onCreate={name => { void createAndAddCollection(name) }}
          error={collectionError}
        />
      ),
    },
    {
      id: 'add-to-pool',
      label: 'Pool',
      submenu: (
        <AddToPickerPanel
          kind="Pool"
          options={mediaPools.map(pool => ({ id: pool.id, name: pool.name, count: pool.mediaIds.length }))}
          onPick={addToPool}
          onCreate={createAndAddPool}
          error={poolError}
        />
      ),
    },
  ]

  return <ContextMenuItemsList items={items} />
}

/** Pick-only list of the CANVAS Engine Media Pools, for the CANVAS library's
 * "Add to Pool" flyout. Pools are created from the library's Pools tab. */
export function MediaAddToPoolPicker({
  targetIds,
  onDone,
}: {
  targetIds: string[]
  onDone: (message: string | null) => void
}) {
  const { mediaPools, addCanvasMediaToPool } = useReactStore(useShallow(state => ({
    mediaPools: state.canvasOrchestrationSettings.mediaPools,
    addCanvasMediaToPool: state.addCanvasMediaToPool,
  })))

  const addToPool = (poolId: string) => {
    let failure: string | null = null
    for (const mediaId of targetIds) {
      const result = addCanvasMediaToPool(poolId, mediaId)
      if (!result.ok) failure = result.message
    }
    onDone(failure)
  }

  return (
    <AddToPickerPanel
      kind="Pool"
      options={mediaPools.map(pool => ({ id: pool.id, name: pool.name, count: pool.mediaIds.length }))}
      onPick={addToPool}
      error={null}
      emptyHint="No pools yet. Create one in the Pools tab."
    />
  )
}
