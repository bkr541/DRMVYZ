import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { SelectRow } from '../src/components/vyzualz/react/ReactControlRows'
import { PixGridDesignPanel } from '../src/components/vyzualz/react/pixGrid/PixGridDesignPanel'
import { composePixGridLogicalFrame } from '../src/components/vyzualz/react/pixGrid/PixGridCompositor'
import { createDefaultPixGridState } from '../src/components/vyzualz/react/pixGrid/PixGridDefaults'
import { PIX_GRID_PRESETS, PIX_GRID_PRESET_BY_ID } from '../src/components/vyzualz/react/pixGrid/PixGridPresets'
import {
  applyPixGridSelectedScenePreviewFrame,
  resolvePixGridPreviewState,
  resolvePixGridSceneSectionType,
} from '../src/components/vyzualz/react/pixGrid/PixGridScenePreview'
import { applyPixGridPresetSettings } from '../src/components/vyzualz/react/pixGrid/PixGridState'
import { normalizePixGridState } from '../src/components/vyzualz/react/pixGrid/PixGridValidation'
import type { PixGridAudioFrame } from '../src/components/vyzualz/react/pixGrid/PixGridTypes'
import {
  initializePixGridStage3Store,
  setPixGridStage3TrackScene,
  useReactStore,
} from './pix-grid-marquee-stage3-react-store-shim'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const INITIAL_PRESET_ID = 'pix-grid-bass-beacon'

function harnessState(presetId: string) {
  const selectedPreset = PIX_GRID_PRESET_BY_ID.get(presetId)!
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), presetId, selectedPreset.pixGridSettings)
  return normalizePixGridState({
    ...applied,
    quality: 'low',
    performance: { ...applied.performance, enabled: false },
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

function fixedFrame(sectionType: PixGridAudioFrame['sectionType']): PixGridAudioFrame {
  return {
    audioTime: 21,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0,
    isPlaying: true,
    beatIndex: 21,
    barIndex: 5,
    beatsSinceSectionStart: 5,
    barsSinceSectionStart: 1.25,
    sectionType,
    motionClockSectionType: sectionType,
    sectionProgress: 0.3125,
    motionClockSectionProgress: 0.3125,
    motionClockTime: 21,
    motionClockBeat: 21,
    motionClockBar: 5.25,
    motionClockSectionBeat: 5,
    motionClockSectionBar: 1.25,
    motionMultiplier: 1,
    transportState: 'playing',
    autoPerformanceEnabled: false,
    inputSource: 'editor-preview',
    sourceValues: {},
  }
}

function LiveLogicalPreview() {
  const state = useReactStore(store => store.pixGridState)
  const trackSceneId = useReactStore(store => store.trackSceneId)
  const runtimeState = resolvePixGridPreviewState(state, trackSceneId)
  const activePreset = PIX_GRID_PRESET_BY_ID.get(runtimeState.selectedPresetId ?? '') ?? PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
  const sectionType = resolvePixGridSceneSectionType(runtimeState) ?? 'verse'
  const frame = applyPixGridSelectedScenePreviewFrame(fixedFrame(sectionType), runtimeState)
  const logical = composePixGridLogicalFrame(activePreset, runtimeState, frame)
  const hash = hashPixels(logical.pixels)
  let activeCells = 0
  for (let offset = 0; offset < logical.pixels.length; offset += 4) {
    if (logical.pixels[offset + 3] > 0 && (logical.pixels[offset] + logical.pixels[offset + 1] + logical.pixels[offset + 2]) > 12) activeCells += 1
  }
  const selectedLayer = runtimeState.layers.find(layer => layer.id === runtimeState.editor.selectedLayerId) ?? null

  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="logical-canvas"]')
    const context = canvas?.getContext('2d')
    if (canvas && context) {
      canvas.width = logical.width
      canvas.height = logical.height
      const image = context.createImageData(logical.width, logical.height)
      image.data.set(logical.pixels)
      context.putImageData(image, 0, 0)
      context.imageSmoothingEnabled = false
    }
    window.__PIXGRID_MARQUEE_STAGE3__ = {
      ready: true,
      selectedPresetId: runtimeState.selectedPresetId,
      runtimeSceneId: runtimeState.selectedSceneId,
      previewMode: runtimeState.editor.scenePreviewMode,
      selectedLayerId: runtimeState.editor.selectedLayerId,
      hash,
      activeCells,
      logicalWidth: logical.width,
      logicalHeight: logical.height,
    }
    document.documentElement.dataset.pixGridMarqueeStage3Ready = 'true'
  }, [activeCells, hash, logical.height, logical.pixels, logical.width, runtimeState.editor.scenePreviewMode, runtimeState.editor.selectedLayerId, runtimeState.selectedSceneId])

  return (
    <section className="stage3-preview" aria-label="Marquee Stage 3 logical preview">
      <div className="stage3-canvas-wrap" data-selected-layer-id={selectedLayer?.id ?? ''}>
        <canvas data-testid="logical-canvas" aria-label="Deterministic PixGrid logical canvas" />
        {selectedLayer && <div data-testid="selected-layer-highlight" className="stage3-selected-layer">{selectedLayer.name}</div>}
      </div>
      <output data-testid="runtime-scene">{runtimeState.selectedSceneId}</output>
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
