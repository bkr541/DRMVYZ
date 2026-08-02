import React from 'react'
import { createRoot } from 'react-dom/client'
import { AudioEngineProvider } from '../../context/AudioEngineContext'
import { VyzualzView } from '../../components/vyzualz/VyzualzView'
import {
  startPixGridDeckCompilerRuntime,
  usePixGridDeckCompilerStore,
} from '../../components/vyzualz/react/pixGrid/PixGridDeckCompilerRuntime'
import { useReactStore } from '../../stores/reactStore'
import {
  useMediaStore,
  type CanonicalVisualUploadOptions,
  type CanonicalVisualUploadResult,
  type UploadedMedia,
} from '../../stores/mediaStore'

const statusTarget = document.querySelector<HTMLElement>('[data-pix-grid-deck-show-manager-status]')
const rootTarget = document.getElementById('root')
if (!statusTarget || !rootTarget) throw new Error('Stage 8 Show Manager browser harness is incomplete.')
const statusElement = statusTarget
const rootElement = rootTarget

try {
  localStorage.clear()
} catch {
  // Browser storage is optional in the isolated harness.
}

useReactStore.getState().resetReactView()
useReactStore.getState().selectReactEngine('pixGrid')
useMediaStore.setState({ items: [], queryItemIds: [], loadError: null })

let uploadCounter = 0
const localUrls = new Set<string>()

function fileMeta(file: File, metadata: CanonicalVisualUploadOptions['metadata']): string {
  const width = metadata?.width
  const height = metadata?.height
  const dimensions = width && height ? `${width}×${height}` : 'image'
  return `${file.type || 'image'} · ${dimensions}`
}

/**
 * Browser acceptance keeps the real Deck ingestion, validation, preflight,
 * compiler worker, media store, and source resolver. Only the authenticated
 * remote persistence boundary is replaced with deterministic local blob URLs.
 */
async function uploadLocalVisual(
  file: File,
  options: CanonicalVisualUploadOptions = {},
): Promise<CanonicalVisualUploadResult> {
  if (options.signal?.aborted) return { ok: false, error: 'Upload cancelled.', phase: 'failed' }
  options.onPhase?.('preparing')
  await Promise.resolve()
  options.onPhase?.('uploading_original')
  const id = `browser-stage8-media-${++uploadCounter}`
  const url = URL.createObjectURL(file)
  localUrls.add(url)
  const item: UploadedMedia = {
    id,
    name: file.name,
    title: options.title ?? file.name.replace(/\.[^.]+$/, ''),
    description: options.description,
    type: 'image',
    url,
    thumbnailUrl: null,
    meta: fileMeta(file, options.metadata),
    favorite: false,
    mediaRole: options.role ?? 'other',
    tags: [...(options.tags ?? [])],
    collectionIds: [...(options.collectionIds ?? [])],
    metadata: { ...(options.metadata ?? {}) },
    mimeType: file.type || null,
    revision: 1,
    lifecycleStatus: 'complete',
    uploadPhase: 'complete',
    uploadSourceFile: file,
    localObjectUrlKey: `browser-stage8:${id}`,
  }
  useMediaStore.setState(state => ({
    items: [item, ...state.items.filter(candidate => candidate.id !== id)],
    queryItemIds: [id, ...state.queryItemIds.filter(candidateId => candidateId !== id)],
    loadError: null,
  }))
  options.onPhase?.('complete')
  return { ok: true, item }
}

useMediaStore.setState({ uploadCanonicalVisualFile: uploadLocalVisual })
const stopCompiler = startPixGridDeckCompilerRuntime()

function snapshot() {
  const react = useReactStore.getState()
  const compiler = usePixGridDeckCompilerStore.getState()
  const deck = react.pixGridDecks[0] ?? null
  return {
    deckCount: react.pixGridDecks.length,
    deck: deck ? {
      id: deck.id,
      name: deck.name,
      revision: deck.revision,
      itemCount: deck.items.length,
      enabledItemCount: deck.items.filter(item => item.enabled).length,
      presetCreated: deck.presetCreated === true,
      generatedPresetId: deck.generatedPresetId,
    } : null,
    generatedPreset: deck
      ? react.reactPresets.find(preset => preset.id === deck.generatedPresetId)?.pixGridDeck ?? null
      : null,
    activeReactPresetId: react.activeReactPresetId,
    pixGridOrigin: react.pixGridState.configuration.origin,
    mediaCount: useMediaStore.getState().items.length,
    compile: deck ? compiler.statuses[deck.id] ?? null : null,
    transitions: deck ? compiler.transitionStatuses[deck.id] ?? null : null,
  }
}

function publishStatus(result = 'ready') {
  statusElement.dataset.result = result
  statusElement.textContent = JSON.stringify(snapshot())
}

const unsubscribeReact = useReactStore.subscribe(() => publishStatus())
const unsubscribeCompiler = usePixGridDeckCompilerStore.subscribe(() => publishStatus())
const unsubscribeMedia = useMediaStore.subscribe(() => publishStatus())

Object.assign(window, {
  __DRMVYZ_PIX_GRID_DECK_STAGE8__: {
    snapshot,
  },
})

createRoot(rootElement).render(
  <React.StrictMode>
    <AudioEngineProvider>
      <VyzualzView activeView="vyzualz" onNavigate={() => {}} initialAppView="showManager" />
    </AudioEngineProvider>
  </React.StrictMode>,
)

publishStatus()

window.addEventListener('beforeunload', () => {
  unsubscribeReact()
  unsubscribeCompiler()
  unsubscribeMedia()
  stopCompiler()
  localUrls.forEach(url => URL.revokeObjectURL(url))
})
