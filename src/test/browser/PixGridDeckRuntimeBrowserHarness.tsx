import React from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_REACT_PRESETS, type ReactPreset } from '../../components/vyzualz/react/ReactTypes'
import { PixGridSurface, type PixGridSurfaceRuntimeFrame } from '../../components/vyzualz/react/pixGrid/PixGridSurface'
import { createDefaultPixGridState } from '../../components/vyzualz/react/pixGrid/PixGridDefaults'
import { applyPixGridPresetSettings } from '../../components/vyzualz/react/pixGrid/PixGridState'
import { normalizePixGridState } from '../../components/vyzualz/react/pixGrid/PixGridValidation'
import type { PixGridQualityTier, PixGridState } from '../../components/vyzualz/react/pixGrid/PixGridTypes'
import {
  DEFAULT_PIX_GRID_DECK_CONFIGURATION,
  type PixGridDeckDefinition,
  type PixGridDeckItemDefinition,
} from '../../components/vyzualz/react/pixGrid/PixGridDeckDomain'
import {
  startPixGridDeckCompilerRuntime,
  usePixGridDeckCompilerStore,
} from '../../components/vyzualz/react/pixGrid/PixGridDeckCompilerRuntime'
import { useReactStore } from '../../stores/reactStore'
import { useMediaStore, type UploadedMedia } from '../../stores/mediaStore'

const outputElement = document.querySelector<HTMLElement>('[data-pix-grid-deck-runtime-status]')
const hostElement = document.querySelector<HTMLElement>('[data-pix-grid-deck-runtime-host]')
if (!outputElement || !hostElement) throw new Error('PixGrid Deck runtime browser harness is incomplete.')
const output: HTMLElement = outputElement
const host: HTMLElement = hostElement

const transparentFixtureUrl = new URL('../fixtures/pixGridDeck/transparent.png', import.meta.url).href
const svgFixtureUrl = new URL('../fixtures/pixGridDeck/safe.svg', import.meta.url).href
const deckId = 'browser-runtime-deck'
const generatedPresetId = `pix-grid-deck:${deckId}`

function deckItem(index: number): PixGridDeckItemDefinition {
  const svg = index === 1
  return {
    id: `browser-runtime-item-${index}`,
    mediaId: `browser-runtime-media-${index}`,
    enabled: true,
    order: index,
    revision: 1,
    timingOverrideBeats: null,
    source: {
      mediaRevision: 1,
      fingerprint: `sha256:browser-runtime-${index}`,
      fileName: svg ? 'safe.svg' : 'transparent.png',
      mimeType: svg ? 'image/svg+xml' : 'image/png',
      width: 2,
      height: 2,
      hasAlpha: true,
      transparentBackground: '#123456',
    },
  }
}

const deck: PixGridDeckDefinition = {
  schemaVersion: 1,
  id: deckId,
  name: 'Browser Runtime Deck',
  revision: 1,
  generatedPresetId,
  items: [deckItem(0), deckItem(1)],
  configuration: {
    ...DEFAULT_PIX_GRID_DECK_CONFIGURATION,
    defaultItemDurationBeats: 4,
    transitionPolicy: {
      ...DEFAULT_PIX_GRID_DECK_CONFIGURATION.transitionPolicy,
      mode: 'crossfade',
      style: 'crossfade',
      durationFraction: 0.25,
      durationBeats: 1,
    },
  },
}

function media(index: number): UploadedMedia {
  const svg = index === 1
  return {
    id: `browser-runtime-media-${index}`,
    name: svg ? 'safe.svg' : 'transparent.png',
    type: 'image',
    url: svg ? svgFixtureUrl : transparentFixtureUrl,
    thumbnailUrl: null,
    meta: svg ? 'SVG · 2×2' : 'PNG · 2×2',
    favorite: false,
    mediaRole: 'other',
    tags: [],
    collectionIds: [],
    metadata: {
      width: 2,
      height: 2,
      hasAlpha: true,
      contentFingerprint: `sha256:browser-runtime-${index}`,
      detectedMimeType: svg ? 'image/svg+xml' : 'image/png',
    },
    mimeType: svg ? 'image/svg+xml' : 'image/png',
    revision: 1,
    lifecycleStatus: 'complete',
    uploadPhase: 'complete',
  }
}

const canonicalPreset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'pix-grid-bass-beacon')!

function runtimeState(quality: PixGridQualityTier): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), canonicalPreset.id, canonicalPreset.pixGridSettings)
  const baseLayer = applied.layers[0]!
  const layerId = 'browser-runtime-deck-layer'
  const sceneId = 'browser-runtime-deck-scene'
  return normalizePixGridState({
    ...applied,
    quality,
    selectedPresetId: generatedPresetId,
    selectedSceneId: sceneId,
    pattern: 'mediaDeck',
    layers: [{
      ...baseLayer,
      id: layerId,
      name: 'Browser Runtime Deck Layer',
      frameSource: { kind: 'deck', deckId },
      mediaId: null,
      visible: true,
      opacity: 1,
      position: { x: 0.5, y: 0.5 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      animations: [],
      audioReactivity: undefined,
      densityRank: 0,
    }],
    scenes: [{ id: sceneId, name: 'Browser Runtime Scene', layerIds: [layerId], pixelOverrides: [] }],
    groups: [],
    audioAssignments: [],
    pixelOverrides: [],
    performance: { ...applied.performance, enabled: false },
    editor: { ...applied.editor, selectedLayerId: layerId },
  })
}

function runtimePreset(state: PixGridState): ReactPreset {
  return {
    ...canonicalPreset,
    id: generatedPresetId,
    name: 'Browser Runtime Deck Fixture',
    pixGridSettings: {
      ...canonicalPreset.pixGridSettings,
      pattern: 'mediaDeck',
      layers: state.layers,
      groups: [],
      audioAssignments: [],
    },
  }
}

function builtInState(quality: PixGridQualityTier): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), canonicalPreset.id, canonicalPreset.pixGridSettings)
  return normalizePixGridState({
    ...applied,
    quality,
    performance: { ...applied.performance, enabled: false },
  })
}

const root = createRoot(host)
let state = runtimeState('draft')
let preset = runtimePreset(state)
let audioTimeSec = 0.5
let motion = 1
let paused = true
let liveClockBaseSec = audioTimeSec
let liveClockStartedAtMs = performance.now()
let decks: readonly PixGridDeckDefinition[] = [deck]
let pendingFrame: ((frame: PixGridSurfaceRuntimeFrame) => void) | null = null
let latestFrame: PixGridSurfaceRuntimeFrame | null = null
let projectStateMutationCount = 0

function onRuntimeFrame(frame: PixGridSurfaceRuntimeFrame): void {
  latestFrame = frame
  pendingFrame?.(frame)
}

function sampledAudioTime(): number {
  return paused
    ? audioTimeSec
    : liveClockBaseSec + Math.max(0, performance.now() - liveClockStartedAtMs) / 1_000
}

function setAudioTime(timeSec: number, nextPaused = paused): void {
  audioTimeSec = timeSec
  paused = nextPaused
  liveClockBaseSec = timeSec
  liveClockStartedAtMs = performance.now()
}

function render(): void {
  root.render(
    <PixGridSurface
      analyser={null}
      activePreset={preset}
      pixGridState={state}
      pixGridDecks={decks}
      intensity={1}
      motion={motion}
      glow={0}
      bassReactivity={0}
      isPlaying
      isPaused={paused}
      audioTimeSec={audioTimeSec}
      durationSec={16}
      trackIdentity="browser-runtime-track"
      getAudioTime={sampledAudioTime}
      onRuntimeFrame={onRuntimeFrame}
    />,
  )
}

function waitForFrame(
  predicate: (frame: PixGridSurfaceRuntimeFrame) => boolean,
  timeoutMs = 15_000,
): Promise<PixGridSurfaceRuntimeFrame> {
  if (latestFrame && predicate(latestFrame)) return Promise.resolve(latestFrame)
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingFrame = null
      reject(new Error('Timed out waiting for a PixGrid Deck runtime frame.'))
    }, timeoutMs)
    pendingFrame = frame => {
      if (!predicate(frame)) return
      window.clearTimeout(timer)
      pendingFrame = null
      resolve(frame)
    }
  })
}

function waitForCompiler(qualityState: PixGridState, timeoutMs = 20_000): Promise<void> {
  const ready = () => {
    const runtime = usePixGridDeckCompilerStore.getState()
    return runtime.statuses[deckId]?.ready === true
      && runtime.statuses[deckId]?.width === qualityState.matrixWidth
      && runtime.statuses[deckId]?.height === qualityState.matrixHeight
      && runtime.transitionStatuses[deckId]?.ready === true
  }
  if (ready()) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      unsubscribe()
      reject(new Error('Timed out waiting for Deck compile and transition caches.'))
    }, timeoutMs)
    const unsubscribe = usePixGridDeckCompilerStore.subscribe(() => {
      if (!ready()) return
      window.clearTimeout(timer)
      unsubscribe()
      resolve()
    })
  })
}

function updateStore(nextState: PixGridState, nextDecks: readonly PixGridDeckDefinition[] = [deck]): void {
  useReactStore.setState({ pixGridState: nextState, pixGridDecks: [...nextDecks] })
}

async function run(): Promise<void> {
  useMediaStore.setState({ items: [media(0), media(1)] })
  updateStore(state)
  const unsubscribeStoreAudit = useReactStore.subscribe((next, previous) => {
    if (next.pixGridState !== previous.pixGridState || next.pixGridDecks !== previous.pixGridDecks) {
      projectStateMutationCount += 1
    }
  })
  const stopCompiler = startPixGridDeckCompilerRuntime()
  try {
    await waitForCompiler(state)
    render()
    const webgl = await waitForFrame(frame => frame.rendererPath === 'webgl2' && frame.deckRuntimeStatus === 'ready')
    const gpuCanvas = host.querySelector<HTMLCanvasElement>('.rv-pix-grid-surface--gpu')
    if (!gpuCanvas) throw new Error('The real PixGridSurface did not mount its WebGL canvas.')
    gpuCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    const canvas = await waitForFrame(frame => frame.rendererPath === 'canvas2d-fallback' && frame.deckRuntimeStatus === 'ready')

    setAudioTime(4.5, true)
    render()
    const looped = await waitForFrame(frame => frame.rendererPath === 'canvas2d-fallback'
      && frame.deckRuntimeStatus === 'ready'
      && frame.audioTimeSec === audioTimeSec)

    setAudioTime(1.75, true)
    render()
    const transition = await waitForFrame(frame => frame.rendererPath === 'canvas2d-fallback'
      && frame.deckRuntimeStatus === 'ready'
      && frame.audioTimeSec === audioTimeSec)

    setAudioTime(2.5, true)
    render()
    const sought = await waitForFrame(frame => frame.deckRuntimeStatus === 'ready' && frame.audioTimeSec === audioTimeSec)

    const mutationsBeforeLivePlayback = projectStateMutationCount
    motion = 0
    setAudioTime(0.5, false)
    render()
    const frozenStart = await waitForFrame(frame => frame.deckRuntimeStatus === 'ready' && frame.audioTimeSec >= 0.5)
    const frozenLater = await waitForFrame(frame => frame.deckRuntimeStatus === 'ready'
      && frame.audioTimeSec >= frozenStart.audioTimeSec + 0.6)

    motion = 1
    render()
    const resumed = await waitForFrame(frame => frame.deckRuntimeStatus === 'ready'
      && frame.audioTimeSec >= frozenLater.audioTimeSec + 2.1
      && (frame.deckSequenceFrameId !== frozenLater.deckSequenceFrameId || frame.pixelHash !== frozenLater.pixelHash))
    const playbackStoreMutationFree = projectStateMutationCount === mutationsBeforeLivePlayback
    setAudioTime(resumed.audioTimeSec, true)
    const previousState = state
    state = runtimeState('low')
    preset = runtimePreset(state)
    updateStore(state)
    setAudioTime(1.75, true)
    render()
    const qualityPending = await waitForFrame(frame => frame.logicalWidth === state.matrixWidth
      && (frame.deckRuntimeStatus === 'resolution-mismatch' || frame.deckRuntimeStatus === 'not-ready'))
    await waitForCompiler(state)
    render()
    const qualityReady = await waitForFrame(frame => frame.deckRuntimeStatus === 'ready'
      && frame.logicalWidth === state.matrixWidth
      && frame.logicalHeight === state.matrixHeight)

    const lowDeckState = state
    const lowDeckPreset = preset
    state = builtInState('low')
    preset = canonicalPreset
    updateStore(state)
    render()
    const switchedAway = await waitForFrame(frame => frame.deckRuntimeStatus === null
      && frame.logicalWidth === state.matrixWidth)
    state = lowDeckState
    preset = lowDeckPreset
    updateStore(state)
    render()
    const switchedBack = await waitForFrame(frame => frame.deckRuntimeStatus === 'ready'
      && frame.logicalWidth === state.matrixWidth)

    decks = []
    updateStore(state, [])
    render()
    const deleted = await waitForFrame(frame => frame.deckRuntimeStatus === 'missing-deck')

    decks = [deck]
    state = previousState
    preset = runtimePreset(state)
    updateStore(state)
    render()
    await waitForCompiler(state)
    setAudioTime(0.5, true)
    render()
    const restored = await waitForFrame(frame => frame.deckRuntimeStatus === 'ready'
      && frame.logicalWidth === state.matrixWidth
      && frame.audioTimeSec === audioTimeSec)

    const result = {
      webgl,
      canvas,
      looped,
      transition,
      sought,
      frozenStart,
      frozenLater,
      resumed,
      qualityPending,
      qualityReady,
      switchedAway,
      switchedBack,
      deleted,
      restored,
      parity: webgl.pixelHash === canvas.pixelHash,
      loopReconstructed: looped.deckSequenceFrameId === canvas.deckSequenceFrameId
        && looped.pixelHash === canvas.pixelHash,
      motionFrozen: frozenStart.pixelHash === frozenLater.pixelHash
        && frozenStart.deckSequenceFrameId === frozenLater.deckSequenceFrameId,
      motionResumed: resumed.deckSequenceFrameId !== frozenLater.deckSequenceFrameId
        || resumed.pixelHash !== frozenLater.pixelHash,
      playbackStoreMutationFree,
      seekChangedFrame: transition.deckSequenceFrameId !== sought.deckSequenceFrameId
        || transition.pixelHash !== sought.pixelHash,
      generatedGroupCount: restored.deckGeneratedGroupIds.length,
      presetSwitchSafe: switchedAway.deckGeneratedGroupIds.length === 0
        && switchedBack.deckRuntimeStatus === 'ready',
      deletedSafe: deleted.activeCellCount === 0,
    }
    output.dataset.result = Object.values({
      parity: result.parity,
      loopReconstructed: result.loopReconstructed,
      motionFrozen: result.motionFrozen,
      motionResumed: result.motionResumed,
      playbackStoreMutationFree: result.playbackStoreMutationFree,
      seekChangedFrame: result.seekChangedFrame,
      generatedGroups: result.generatedGroupCount === 6,
      qualityPending: result.qualityPending.deckRuntimeStatus !== 'ready',
      qualityReady: result.qualityReady.deckRuntimeStatus === 'ready',
      presetSwitchSafe: result.presetSwitchSafe,
      deletedSafe: result.deletedSafe,
      restored: result.restored.deckRuntimeStatus === 'ready',
    }).every(Boolean) ? 'ready' : 'invalid'
    output.textContent = JSON.stringify(result)
  } finally {
    unsubscribeStoreAudit()
    stopCompiler()
  }
}

run().catch(error => {
  output.dataset.result = 'failed'
  output.textContent = JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
})

window.addEventListener('pagehide', () => root.unmount(), { once: true })
