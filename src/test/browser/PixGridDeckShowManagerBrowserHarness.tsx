import React from 'react'
import { createRoot } from 'react-dom/client'
import { AudioEngineProvider, useSharedAudio } from '../../context/AudioEngineContext'
import { VyzualzView } from '../../components/vyzualz/VyzualzView'
import {
  startPixGridDeckCompilerRuntime,
  usePixGridDeckCompilerStore,
} from '../../components/vyzualz/react/pixGrid/PixGridDeckCompilerRuntime'
import { useReactStore } from '../../stores/reactStore'
import {
  exportCurrentPixGridDeckProjectMediaBundle,
  importPixGridDeckProjectMediaBundleIntoStore,
} from '../../components/vyzualz/react/pixGrid/PixGridDeckProjectPortability'
import {
  useMediaStore,
  type CanonicalVisualUploadOptions,
  type CanonicalVisualUploadResult,
  type UploadedMedia,
} from '../../stores/mediaStore'

const statusTarget = document.querySelector<HTMLElement>('[data-pix-grid-deck-show-manager-status]')
const rootTarget = document.getElementById('root')
if (!statusTarget || !rootTarget) throw new Error('PixGrid Deck release browser harness is incomplete.')
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
let audioSnapshot = {
  trackId: null as string | null,
  trackName: null as string | null,
  analysisStatus: 'not_analyzed' as string,
  analyzedBpm: null as number | null,
}
let portabilitySnapshot: {
  exportedSourceCount: number
  importedMediaCount: number
  missingMediaIds: string[]
  errorCount: number
  sourceIdsChanged: boolean
} | null = null

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
  const id = `browser-release-media-${++uploadCounter}`
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
    localObjectUrlKey: `browser-release:${id}`,
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
    audio: audioSnapshot,
    portability: portabilitySnapshot,
  }
}

function publishStatus(result = 'ready') {
  statusElement.dataset.result = result
  statusElement.textContent = JSON.stringify(snapshot())
}

async function roundTripProject() {
  const beforeMediaIds = useReactStore.getState().pixGridDecks
    .flatMap(deck => deck.items.map(item => item.mediaId))
  const bundle = await exportCurrentPixGridDeckProjectMediaBundle({
    readSource: async item => {
      if (item.uploadSourceFile) return item.uploadSourceFile
      const response = await fetch(item.url)
      if (!response.ok) throw new Error(`Harness source read failed with status ${response.status}.`)
      return new File([await response.blob()], item.name, { type: item.mimeType ?? undefined })
    },
  })

  useReactStore.getState().replacePixGridDeckProject([])
  for (const item of useMediaStore.getState().items) {
    if (item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url)
      localUrls.delete(item.url)
    }
  }
  useMediaStore.setState({ items: [], queryItemIds: [], loadError: null })

  const result = await importPixGridDeckProjectMediaBundleIntoStore(bundle)
  const afterMediaIds = result.decks.flatMap(deck => deck.items.map(item => item.mediaId))
  portabilitySnapshot = {
    exportedSourceCount: bundle.manifest.sources.length,
    importedMediaCount: Object.keys(result.mediaIdMap).length,
    missingMediaIds: result.missingMediaIds,
    errorCount: result.errors.length,
    sourceIdsChanged: beforeMediaIds.length === afterMediaIds.length
      && beforeMediaIds.some((mediaId, index) => mediaId !== afterMediaIds[index]),
  }
  publishStatus()
  return portabilitySnapshot
}

function HarnessContent() {
  const audio = useSharedAudio()
  React.useEffect(() => {
    audioSnapshot = {
      trackId: audio.currentTrackId,
      trackName: audio.currentTrack?.name ?? null,
      analysisStatus: audio.currentAnalysisStatus,
      analyzedBpm: audio.currentAnalyzedBpm,
    }
    publishStatus()
  }, [audio.currentAnalysisStatus, audio.currentAnalyzedBpm, audio.currentTrack?.name, audio.currentTrackId])
  return <VyzualzView activeView="vyzualz" onNavigate={() => {}} initialAppView="showManager" />
}

const unsubscribeReact = useReactStore.subscribe(() => publishStatus())
const unsubscribeCompiler = usePixGridDeckCompilerStore.subscribe(() => publishStatus())
const unsubscribeMedia = useMediaStore.subscribe(() => publishStatus())

const releaseApi = { snapshot, roundTripProject }
Object.assign(window, {
  __DRMVYZ_PIX_GRID_DECK_RELEASE__: releaseApi,
})

createRoot(rootElement).render(
  <React.StrictMode>
    <AudioEngineProvider>
      <HarnessContent />
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
