import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { usePixGridDeckCompilerStore } from './PixGridDeckCompilerRuntime'
import {
  PIX_GRID_DECK_MAX_ITEMS,
  PIX_GRID_DECK_MIN_ITEMS,
  createPixGridDeckItemId,
  type PixGridDeckDefinition,
  type PixGridDeckUpdatePatch,
} from './PixGridDeckDomain'
import { ingestPixGridDeckSourceFiles } from './PixGridDeckMediaService'
import { createPixGridDeckGeneratedPreset, resolvePixGridDeckPresetReadiness } from './PixGridDeckPreset'
import { exportPixGridDeckProjectMediaBundle } from './PixGridDeckProjectMedia'
import { createDirectoryHandleWriter, exportPixGridShippedDeck, pixGridShippedDeckSlug } from './PixGridShippedDeckExport'

/** What the upload control shows. The Deck Builder library renders it as-is. */
export interface PixGridDeckUploadUiState {
  active: boolean
  phase: string
  error: string | null
  warnings: readonly string[]
}

const READY_UPLOAD_STATE: PixGridDeckUploadUiState = { active: false, phase: 'Ready', error: null, warnings: [] }

/** State of the team-only "Export for shipping" action. */
export interface PixGridDeckShipUiState {
  busy: boolean
  message: string | null
  error: string | null
}

export interface PixGridDeckBuilderOptions {
  /** Runs after the builder closes (on the next task), so the host can return keyboard focus to its own Create or Edit control. */
  onExit?: (returnTarget: 'create' | 'edit') => void
  /** Runs when Create Preset succeeded, just before the builder closes. */
  onPresetCreated?: (generatedPresetId: string) => void
  /** Runs when a confirmed Deck deletion succeeded, just before the builder closes. */
  onDeleted?: (deckId: string) => void
  /** Create Preset keeps the builder open on a confirmation (`created`) instead of closing it; the host closes it with `exit`. */
  confirmCreation?: boolean
}

/**
 * Musical time the builder preview shows: where the selected image sits in the Deck's beat timeline, inside its transition window.
 * With no Deck open it returns the fallback time. A small offset keeps the clock off the exact boundary.
 */
export function resolvePixGridDeckPreviewTime(input: {
  deck: PixGridDeckDefinition | null
  previewItemId: string | null
  transitionProgress: number
  bpm: number | null | undefined
  fallbackTimeSec: number
}): number {
  const { deck } = input
  if (!deck) return input.fallbackTimeSec
  const enabled = deck.items.filter(item => item.enabled)
  const index = Math.max(0, enabled.findIndex(item => item.id === input.previewItemId))
  const beatsOf = (item: PixGridDeckDefinition['items'][number] | undefined) => item?.timingOverrideBeats ?? deck.configuration.defaultItemDurationBeats
  const priorBeats = enabled.slice(0, index).reduce((sum, item) => sum + beatsOf(item), 0)
  const itemBeats = enabled[index] ? beatsOf(enabled[index]) : deck.configuration.defaultItemDurationBeats
  const transition = deck.configuration.transitionPolicy.durationFraction ?? 0.25
  const bpm = input.bpm && input.bpm > 0 ? input.bpm : 120
  return (priorBeats + itemBeats * (1 - transition + input.transitionProgress * transition)) * 60 / bpm + 0.01
}

/**
 * Everything the PixGrid Deck Builder needs except its screens: which Deck is open, the draft name, upload state (with cancel), the image list
 * operations, the preview position, Create Preset and confirmed delete. Hosts (Show Manager, Preset Manager) render
 * `PixGridDeckBuilderLibrary`, `PixGridDeckBuilderInspector` and `PixGridDeckSequenceStrip` from this controller, so there is one implementation.
 */
export function usePixGridDeckBuilder(options: PixGridDeckBuilderOptions = {}) {
  const pixGridDecks = useReactStore(state => state.pixGridDecks)
  const renamePixGridDeck = useReactStore(state => state.renamePixGridDeck)
  const updatePixGridDeck = useReactStore(state => state.updatePixGridDeck)
  const deletePixGridDeck = useReactStore(state => state.deletePixGridDeck)
  const createPixGridDeckPreset = useReactStore(state => state.createPixGridDeckPreset)
  const compilerStatuses = usePixGridDeckCompilerStore(state => state.statuses)
  const transitionStatuses = usePixGridDeckCompilerStore(state => state.transitionStatuses)

  const [active, setActive] = useState(false)
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null)
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [created, setCreated] = useState(false)
  const [draftName, setDraftName] = useState('Untitled Deck')
  const [nameError, setNameError] = useState<string | null>(null)
  const [previewItemId, setPreviewItemId] = useState<string | null>(null)
  const [previewTransitionProgress, setPreviewTransitionProgress] = useState(0)
  const [upload, setUpload] = useState<PixGridDeckUploadUiState>(READY_UPLOAD_STATE)
  const [pendingDelete, setPendingDelete] = useState<{ id: string } | null>(null)
  const [ship, setShip] = useState<PixGridDeckShipUiState>({ busy: false, message: null, error: null })
  const headingRef = useRef<HTMLDivElement | null>(null)
  const returnTargetRef = useRef<'create' | 'edit'>('create')
  const uploadAbortRef = useRef<AbortController | null>(null)
  const uploadOperationRef = useRef(0)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const deck = useMemo(() => pixGridDecks.find(candidate => candidate.id === editingDeckId) ?? null, [editingDeckId, pixGridDecks])
  const readiness = useMemo(() => deck
    ? resolvePixGridDeckPresetReadiness(deck, compilerStatuses[deck.id], transitionStatuses[deck.id])
    : null, [compilerStatuses, deck, transitionStatuses])
  const previewPreset = useMemo(() => deck ? createPixGridDeckGeneratedPreset(deck) : null, [deck])
  const enabledItems = useMemo(() => deck?.items.filter(item => item.enabled) ?? [], [deck])

  // A Deck edit (rename, enable/disable, reorder) keeps the draft name and a valid preview image in step.
  useEffect(() => {
    if (!active) return
    setDraftName(deck?.name ?? 'Untitled Deck')
    setNameError(null)
    setPreviewItemId(current => (
      deck?.items.some(item => item.id === current && item.enabled) ? current : deck?.items.find(item => item.enabled)?.id ?? null
    ))
  }, [active, deck])

  useEffect(() => {
    if (active) headingRef.current?.focus()
  }, [active])

  // An upload still running when the host unmounts must not write into a Deck nobody is editing.
  useEffect(() => () => {
    uploadOperationRef.current += 1
    uploadAbortRef.current?.abort()
  }, [])

  const cancelUpload = () => {
    uploadOperationRef.current += 1
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
  }

  /** Opens the builder for a new Deck (no id) or an existing one. */
  const enter = (deckId: string | null) => {
    cancelUpload()
    returnTargetRef.current = deckId ? 'edit' : 'create'
    setMode(deckId ? 'edit' : 'create')
    setCreated(false)
    setEditingDeckId(deckId)
    setActive(true)
    setUpload(READY_UPLOAD_STATE)
  }

  const exit = () => {
    cancelUpload()
    const returnTarget = returnTargetRef.current
    setActive(false)
    setCreated(false)
    setEditingDeckId(null)
    setPreviewItemId(null)
    window.setTimeout(() => optionsRef.current.onExit?.(returnTarget), 0)
  }

  const addFiles = async (files: File[]) => {
    const name = draftName.trim()
    if (!deck && !name) {
      setNameError('Deck name is required.')
      return
    }

    uploadAbortRef.current?.abort()
    const controller = new AbortController()
    const operationId = uploadOperationRef.current + 1
    uploadOperationRef.current = operationId
    uploadAbortRef.current = controller
    setUpload({ active: true, phase: 'Validating…', error: null, warnings: [] })

    const result = await ingestPixGridDeckSourceFiles({
      target: deck ? { kind: 'append', deckId: deck.id } : { kind: 'create', name },
      files,
      signal: controller.signal,
      onUploadPhase: (fileName, phase) => {
        if (uploadOperationRef.current !== operationId || controller.signal.aborted) return
        setUpload(current => ({ ...current, phase: `${fileName}: ${phase}` }))
      },
    })
    if (uploadOperationRef.current !== operationId) return
    uploadAbortRef.current = null

    if (!result.ok) {
      const phase = result.error.code === 'cancelled'
        ? 'Cancelled'
        : result.error.code === 'project-replaced' || result.error.code === 'deck-conflict'
          ? 'Conflict'
          : 'Failed'
      setUpload({ active: false, phase, error: result.error.message, warnings: [] })
      return
    }
    setEditingDeckId(result.deckId)
    setNameError(null)
    const warnings = result.rejected?.map(entry => `${entry.fileName}: ${entry.message}`) ?? []
    setUpload({ active: false, phase: warnings.length > 0 ? 'Ready with warnings' : 'Ready', error: null, warnings })
  }

  const rename = () => {
    if (!deck || draftName.trim() === deck.name) return
    const result = renamePixGridDeck(deck.id, draftName)
    if (!result.ok) setNameError(result.error.message)
    else setNameError(null)
  }

  const update = (patch: PixGridDeckUpdatePatch) => {
    if (!deck) return
    const result = updatePixGridDeck(deck.id, patch)
    if (!result.ok) setUpload(current => ({ ...current, error: result.error.message }))
  }

  const sortedItems = () => deck ? [...deck.items].sort((left, right) => left.order - right.order) : []
  const commitItems = (items: PixGridDeckDefinition['items']) => update({ items: items.map((item, order) => ({ ...item, order })) })

  const moveItem = (itemId: string, direction: -1 | 1) => {
    const items = sortedItems()
    const index = items.findIndex(item => item.id === itemId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target]!, items[index]!]
    commitItems(items)
  }

  const reorderItems = (sourceItemId: string, targetItemId: string) => {
    const items = sortedItems()
    const sourceIndex = items.findIndex(item => item.id === sourceItemId)
    if (sourceIndex < 0 || !items.some(item => item.id === targetItemId)) return
    const [sourceItem] = items.splice(sourceIndex, 1)
    const targetIndex = items.findIndex(item => item.id === targetItemId)
    if (!sourceItem || targetIndex < 0) return
    items.splice(targetIndex, 0, sourceItem)
    commitItems(items)
  }

  const toggleItem = (itemId: string) => {
    if (!deck) return
    update({ items: deck.items.map(item => item.id === itemId ? { ...item, enabled: !item.enabled } : item) })
  }

  /** One image's own duration in beats, or null to follow the Deck's default. Kept in the Deck's allowed range. */
  const setItemTiming = (itemId: string, beats: number | null) => {
    if (!deck) return
    const value = beats == null || !Number.isFinite(beats) ? null : Math.min(1024, Math.max(0.25, beats))
    update({ items: deck.items.map(item => item.id === itemId ? { ...item, timingOverrideBeats: value } : item) })
  }

  const removeItem = (itemId: string) => {
    if (!deck || deck.items.length <= PIX_GRID_DECK_MIN_ITEMS) return
    update({ items: deck.items.filter(item => item.id !== itemId) })
  }

  const duplicateItem = (itemId: string) => {
    if (!deck || deck.items.length >= PIX_GRID_DECK_MAX_ITEMS) return
    const items = sortedItems()
    const sourceIndex = items.findIndex(item => item.id === itemId)
    const source = items[sourceIndex]
    if (!source || sourceIndex < 0) return
    items.splice(sourceIndex + 1, 0, { ...source, id: createPixGridDeckItemId(), revision: 1 })
    commitItems(items)
  }

  const currentPreviewIndex = Math.max(0, enabledItems.findIndex(item => item.id === previewItemId))
  const stepPreview = (direction: -1 | 1) => {
    if (enabledItems.length === 0) return
    setPreviewItemId(enabledItems[(currentPreviewIndex + direction + enabledItems.length) % enabledItems.length]?.id ?? null)
  }

  /** The preview clock for the open Deck at this tempo (the fallback time while none is open). */
  const previewTimeFor = (bpm: number | null | undefined, fallbackTimeSec: number) => resolvePixGridDeckPreviewTime({
    deck, previewItemId, transitionProgress: previewTransitionProgress, bpm, fallbackTimeSec,
  })

  const createPreset = () => {
    if (!deck || !readiness) return
    const result = createPixGridDeckPreset(deck.id, readiness)
    if (!result.ok) {
      setUpload(current => ({ ...current, error: result.error.message }))
      return
    }
    optionsRef.current.onPresetCreated?.(deck.generatedPresetId)
    if (optionsRef.current.confirmCreation) setCreated(true)
    else exit()
  }

  /**
   * Development builds only: writes this Deck into the repository as a shipped preset (manifest plus resized images) in a folder the team member picks,
   * normally the repository root. The Deck must be compiled and ready first.
   */
  const exportForShipping = async () => {
    if (!deck || !readiness?.ready || ship.busy) return
    const picker = (window as unknown as { showDirectoryPicker?: (options?: { mode?: 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker
    if (!picker) {
      setShip({ busy: false, message: null, error: 'This browser cannot write to a folder. Use Chrome or the desktop app.' })
      return
    }
    try {
      const root = await picker({ mode: 'readwrite', id: 'drmvyz-repository' })
      setShip({ busy: true, message: 'Reading and resizing images…', error: null })
      const bundle = await exportPixGridDeckProjectMediaBundle([deck])
      if (bundle.manifest.missingMediaIds.length > 0) throw new Error(`${bundle.manifest.missingMediaIds.length} source image(s) could not be read.`)
      const result = await exportPixGridShippedDeck({
        deck,
        files: new Map(bundle.files.map(entry => [entry.mediaId, entry.file])),
        writer: createDirectoryHandleWriter(root),
        slug: pixGridShippedDeckSlug(deck.name),
      })
      setShip({ busy: false, message: `Wrote ${result.manifestPath} and ${result.imagePaths.length} image(s). Restart the dev server to see it as a built-in preset.`, error: null })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setShip({ busy: false, message: null, error: null })
      else setShip({ busy: false, message: null, error: error instanceof Error ? error.message : 'Export failed.' })
    }
  }

  const requestDelete = () => {
    if (deck) setPendingDelete({ id: deck.id })
  }
  const cancelDelete = () => setPendingDelete(null)
  const confirmDelete = () => {
    const target = pendingDelete
    setPendingDelete(null)
    if (!target) return
    const result = deletePixGridDeck(target.id)
    if (!result.ok) {
      setUpload(current => ({ ...current, error: result.error.message }))
      return
    }
    optionsRef.current.onDeleted?.(target.id)
    exit()
  }

  return {
    active, mode, created, deck, readiness, previewPreset, enabledItems,
    draftName, setDraftName, nameError, upload,
    previewItemId, setPreviewItemId, previewTransitionProgress, setPreviewTransitionProgress, previewTimeFor, stepPreview,
    headingRef, pendingDelete,
    enter, exit, addFiles, rename, update, moveItem, reorderItems, toggleItem, removeItem, duplicateItem, setItemTiming,
    createPreset, requestDelete, cancelDelete, confirmDelete,
    /** Present only in development builds. */
    ship: import.meta.env.DEV ? { ...ship, onExport: exportForShipping } : null,
  }
}

export type PixGridDeckBuilderController = ReturnType<typeof usePixGridDeckBuilder>
