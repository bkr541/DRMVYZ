import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '../../../stores/mediaStore'
import { useReactStore } from '../../../stores/reactStore'
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

  const [collectionError, setCollectionError] = useState<string | null>(null)
  const [poolError, setPoolError] = useState<string | null>(null)

  const addToCollection = async (collectionId: string) => {
    await addMediaToCollection(collectionId, targetIds)
    onDone()
  }

  const createAndAddCollection = async (name: string) => {
    setCollectionError(null)
    const id = await createCollection(name)
    if (!id) {
      setCollectionError('Could not create collection.')
      return
    }
    await addMediaToCollection(id, targetIds)
    onDone()
  }

  const addToPool = (poolId: string) => {
    for (const mediaId of targetIds) addCanvasMediaToPool(poolId, mediaId)
    onDone()
  }

  const createAndAddPool = (name: string) => {
    setPoolError(null)
    const result = createCanvasMediaPool(name)
    if (!result.ok) {
      setPoolError(result.message)
      return
    }
    for (const mediaId of targetIds) addCanvasMediaToPool(result.pool.id, mediaId)
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
