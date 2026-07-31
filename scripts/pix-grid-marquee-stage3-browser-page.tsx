import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_MI_FRAME } from '../src/features/musicIntelligence/constants'
import { buildSharedPerformanceContext } from '../src/features/performanceCore'
import type { ReactSectionType, ReactTrackSection } from '../src/components/vyzualz/react/ReactTypes'
import { SelectRow } from '../src/components/vyzualz/react/ReactControlRows'
import { PixGridDesignPanel } from '../src/components/vyzualz/react/pixGrid/PixGridDesignPanel'
import { createPixGridAudioFrame } from '../src/components/vyzualz/react/pixGrid/PixGridAudioRouting'
import { composePixGridLogicalFrame } from '../src/components/vyzualz/react/pixGrid/PixGridCompositor'
import { createDefaultPixGridState } from '../src/components/vyzualz/react/pixGrid/PixGridDefaults'
import { PIX_GRID_PRESETS, PIX_GRID_PRESET_BY_ID } from '../src/components/vyzualz/react/pixGrid/PixGridPresets'
import { resolvePixGridSceneSectionType } from '../src/components/vyzualz/react/pixGrid/PixGridScenePreview'
import { applyPixGridPresetSettings } from '../src/components/vyzualz/react/pixGrid/PixGridState'
import { resolvePixGridSurfacePerformanceFrame } from '../src/components/vyzualz/react/pixGrid/PixGridSurfaceRuntime'
import { PixGridUnifiedPerformanceRuntime } from '../src/components/vyzualz/react/pixGrid/PixGridUnifiedPerformanceRuntime'
import { normalizePixGridState } from '../src/components/vyzualz/react/pixGrid/PixGridValidation'
import type { PixGridState } from '../src/components/vyzualz/react/pixGrid/PixGridTypes'
import {
  initializePixGridStage3Store,
  setPixGridStage3TrackScene,
  useReactStore,
} from './pix-grid-marquee-stage3-react-store-shim'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const INITIAL_PRESET_ID = 'pix-grid-bass-beacon'
const AUDIO_TIME = 21

function harnessState(presetId: string) {
  const selectedPreset = PIX_GRID_PRESET_BY_ID.get(presetId)!
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), presetId, selectedPreset.pixGridSettings)
  return normalizePixGridState({
    ...applied,
    quality: 'low',
    performance: { ...applied.performance, enabled: presetId === PRESET_ID },
    editor: { ...applied.editor, scenePreviewMode: 'followTrack' },
  })
}

const initialState = harnessState(INITIAL_PRESET_ID)
initializePixGridStage3Store(initialState, initialState.selectedSceneId)

function hashPixels(pixels: Uint8Array): string {
  let hash = 0x811c9dc5
  for (const value of pixels) {
    hash ^= value
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function trackSectionType(state: PixGridState, trackSceneId: string | null): ReactSectionType {
  if (!trackSceneId) return 'verse'
  return resolvePixGridSceneSectionType({ ...state, selectedSceneId: trackSceneId }) ?? 'verse'
}

function browserContext(sectionType: ReactSectionType) {
  const absoluteBeat = AUDIO_TIME * 2
  const beatIndex = Math.floor(absoluteBeat)
  const section: ReactTrackSection = {
    id: `browser-track-${sectionType}`,
    label: sectionType,
    type: sectionType,
    startSec: 0,
    endSec: 64,
    intensity: sectionType === 'drop' ? 1 : 0.6,
    source: 'auto',
    confidence: 1,
  }
  const frame = {
    ...DEFAULT_MI_FRAME,
    timeSec: AUDIO_TIME,
    frameId: 1260,
    sourceId: 'browser-track',
    trackId: 'browser-track',
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 1,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 1,
      rhythm: 1,
      section: 1,
    },
  }
  return buildSharedPerformanceContext({
    audioTimeSec: AUDIO_TIME,
    frame,
    resolvedSections: [section],
    durationSec: 64,
    trackIdentity: 'browser-track',
  })
}

function LiveLogicalPreview() {
  const state = useReactStore(store => store.pixGridState)
  const trackSceneId = useReactStore(store => store.trackSceneId)
  const runtimeRef = useRef(new PixGridUnifiedPerformanceRuntime())
  const ownershipIdentityRef = useRef('')
  const ownershipIdentity = state.editor.scenePreviewMode === 'selectedScene'
    ? `${state.selectedPresetId}:selected:${state.selectedSceneId}`
    : `${state.selectedPresetId}:followTrack`
  if (ownershipIdentityRef.current !== ownershipIdentity) {
    ownershipIdentityRef.current = ownershipIdentity
    runtimeRef.current.reset('browser-track')
  }

  const context = browserContext(trackSectionType(state, trackSceneId))
  const surfaceFrame = resolvePixGridSurfacePerformanceFrame({
    authoredState: state,
    trackSceneId,
    context,
    audioFrame: createPixGridAudioFrame(context, {
      isPlaying: true,
      deltaTimeSec: 1 / 60,
      autoPerformanceEnabled: state.performance.enabled,
    }),
    presetId: state.selectedPresetId,
    cues: [],
    runtime: runtimeRef.current,
    trackId: 'browser-track',
  })
  const runtimeState = surfaceFrame.resolvedRuntime.state
  const activePreset = PIX_GRID_PRESET_BY_ID.get(runtimeState.selectedPresetId ?? '') ?? PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
  const logical = composePixGridLogicalFrame(
    activePreset,
    runtimeState,
    surfaceFrame.previewAudioFrame,
    undefined,
    null,
    undefined,
    surfaceFrame.resolvedRuntime.transition,
    surfaceFrame.resolvedRuntime.groupEffects,
    undefined,
    surfaceFrame.resolvedRuntime.choreography,
  )
  const hash = hashPixels(logical.pixels)
  let activeCells = 0
  for (let offset = 0; offset < logical.pixels.length; offset += 4) {
    if (logical.pixels[offset + 3] > 0 && (logical.pixels[offset] + logical.pixels[offset + 1] + logical.pixels[offset + 2]) > 12) activeCells += 1
  }
  const selectedLayer = runtimeState.layers.find(layer => layer.id === runtimeState.editor.selectedLayerId) ?? null
  const activePlan = surfaceFrame.resolvedRuntime.performance.snapshot.activeSectionPlanId ?? 'none'

  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="logical-canvas"]')
    const canvasContext = canvas?.getContext('2d')
    if (canvas && canvasContext) {
      canvas.width = logical.width
      canvas.height = logical.height
      const image = canvasContext.createImageData(logical.width, logical.height)
      image.data.set(logical.pixels)
      canvasContext.putImageData(image, 0, 0)
      canvasContext.imageSmoothingEnabled = false
    }
    window.__PIXGRID_MARQUEE_STAGE3__ = {
      ready: true,
      selectedPresetId: runtimeState.selectedPresetId,
      runtimeSceneId: runtimeState.selectedSceneId,
      previewMode: runtimeState.editor.scenePreviewMode,
      selectedLayerId: runtimeState.editor.selectedLayerId,
      activePlan,
      hash,
      activeCells,
      logicalWidth: logical.width,
      logicalHeight: logical.height,
    }
    document.documentElement.dataset.pixGridMarqueeStage3Ready = 'true'
  }, [activeCells, activePlan, hash, logical.height, logical.pixels, logical.width, runtimeState.editor.scenePreviewMode, runtimeState.editor.selectedLayerId, runtimeState.selectedPresetId, runtimeState.selectedSceneId])

  return (
    <section className="stage3-preview" aria-label="Marquee Stage 3 logical preview">
      <div className="stage3-canvas-wrap" data-selected-layer-id={selectedLayer?.id ?? ''}>
        <canvas data-testid="logical-canvas" aria-label="Deterministic PixGrid logical canvas" />
        {selectedLayer && <div data-testid="selected-layer-highlight" className="stage3-selected-layer">{selectedLayer.name}</div>}
      </div>
      <output data-testid="runtime-scene">{runtimeState.selectedSceneId}</output>
      <output data-testid="active-plan">{activePlan}</output>
      <output data-testid="logical-hash">{hash}</output>
      <output data-testid="active-cells">{activeCells}</output>
    </section>
  )
}

function App() {
  const state = useReactStore(store => store.pixGridState)
  const setState = useReactStore(store => store.setPixGridState)
  return (
    <main className="stage3-layout">
      <aside>
        <SelectRow
          label="PixGrid Preset"
          value={state.selectedPresetId ?? INITIAL_PRESET_ID}
          options={PIX_GRID_PRESETS.map(candidate => ({ value: candidate.id, label: candidate.name }))}
          onChange={presetId => {
            const next = harnessState(presetId)
            setState(next)
            const nextPreset = PIX_GRID_PRESET_BY_ID.get(presetId)!
            setPixGridStage3TrackScene(nextPreset.sectionMappings.find(mapping => mapping.sectionType === 'verse')?.sceneId ?? next.selectedSceneId)
          }}
        />
        <PixGridDesignPanel />
      </aside>
      <LiveLogicalPreview />
    </main>
  )
}

declare global {
  interface Window {
    __PIXGRID_MARQUEE_STAGE3__?: {
      ready: boolean
      selectedPresetId: string | null
      runtimeSceneId: string | null
      previewMode: string
      selectedLayerId: string | null
      activePlan: string
      hash: string
      activeCells: number
      logicalWidth: number
      logicalHeight: number
    }
    __setPixGridMarqueeTrackScene?: (sceneId: string | null) => void
  }
}

window.__setPixGridMarqueeTrackScene = setPixGridStage3TrackScene
createRoot(document.getElementById('root')!).render(<App />)
