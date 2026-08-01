import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/styles.css'
import '../src/styles/reactView.css'
import './pix-grid-marquee-stage3-browser.css'
import { DEFAULT_MI_FRAME } from '../src/features/musicIntelligence/constants'
import { AudioFeatureBus } from '../src/features/musicIntelligence/AudioFeatureBus'
import type { MusicIntelligenceFrame } from '../src/features/musicIntelligence/types'
import { ReactEngineBrowser } from '../src/components/vyzualz/react/ReactEngineBrowser'
import { SelectRow } from '../src/components/vyzualz/react/ReactControlRows'
import type { ReactSectionType, ReactTrackSection } from '../src/components/vyzualz/react/ReactTypes'
import { getSharedPerformanceDiagnostics } from '../src/components/vyzualz/react/SharedPerformanceDiagnosticsStore'
import { PixGridControls } from '../src/components/vyzualz/react/pixGrid/PixGridControls'
import { PixGridDesignPanel } from '../src/components/vyzualz/react/pixGrid/PixGridDesignPanel'
import { getPixGridPerformanceRuntimeStatus } from '../src/components/vyzualz/react/pixGrid/PixGridPerformanceStatus'
import { getPixGridReactivityRuntimeStatus } from '../src/components/vyzualz/react/pixGrid/PixGridReactivityStatus'
import {
  PixGridSurface,
  type PixGridSurfaceRuntimeFrame,
} from '../src/components/vyzualz/react/pixGrid/PixGridSurface'
import { useReactStore } from '../src/stores/reactStore'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const TRACK_ID = 'pix-grid-marquee-real-browser-track'
const BPM = 120
const INITIAL_TIME_SEC = 20

const TRACK_SECTIONS: readonly ReactTrackSection[] = Object.freeze([
  {
    id: 'browser-intro',
    label: 'Intro',
    type: 'intro',
    startSec: 0,
    endSec: 16,
    intensity: 0.36,
    source: 'auto',
    confidence: 1,
    boundaryConfidence: 1,
    labelConfidence: 1,
    gridConfidence: 1,
  },
  {
    id: 'browser-verse',
    label: 'Verse',
    type: 'verse',
    startSec: 16,
    endSec: 32,
    intensity: 0.62,
    source: 'auto',
    confidence: 1,
    boundaryConfidence: 1,
    labelConfidence: 1,
    gridConfidence: 1,
  },
  {
    id: 'browser-drop',
    label: 'Drop',
    type: 'drop',
    startSec: 32,
    endSec: 64,
    intensity: 1,
    source: 'auto',
    confidence: 1,
    boundaryConfidence: 1,
    labelConfidence: 1,
    gridConfidence: 1,
    dropConfidence: 1,
  },
  {
    id: 'browser-breakdown',
    label: 'Breakdown',
    type: 'breakdown',
    startSec: 64,
    endSec: 80,
    intensity: 0.42,
    source: 'auto',
    confidence: 1,
    boundaryConfidence: 1,
    labelConfidence: 1,
    gridConfidence: 1,
  },
  {
    id: 'browser-build',
    label: 'Build',
    type: 'build',
    startSec: 80,
    endSec: 96,
    intensity: 0.76,
    source: 'auto',
    confidence: 1,
    boundaryConfidence: 1,
    labelConfidence: 1,
    gridConfidence: 1,
  },
  {
    id: 'browser-pre-drop',
    label: 'PreDrop',
    type: 'preDrop',
    startSec: 96,
    endSec: 104,
    intensity: 0.9,
    source: 'auto',
    confidence: 1,
    boundaryConfidence: 1,
    labelConfidence: 1,
    gridConfidence: 1,
  },
  {
    id: 'browser-drop-two',
    label: 'Drop 2',
    type: 'drop',
    startSec: 104,
    endSec: 136,
    intensity: 1,
    source: 'auto',
    confidence: 1,
    boundaryConfidence: 1,
    labelConfidence: 1,
    gridConfidence: 1,
    dropConfidence: 1,
  },
  {
    id: 'browser-outro',
    label: 'Outro',
    type: 'outro',
    startSec: 136,
    endSec: 152,
    intensity: 0.2,
    source: 'auto',
    confidence: 1,
    boundaryConfidence: 1,
    labelConfidence: 1,
    gridConfidence: 1,
  },
])

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function sectionAt(timeSec: number): ReactTrackSection {
  return TRACK_SECTIONS.find(section => timeSec >= section.startSec && timeSec < section.endSec)
    ?? TRACK_SECTIONS[TRACK_SECTIONS.length - 1]!
}

function buildBrowserFrame(timeSec: number, audioLevel: number): MusicIntelligenceFrame {
  const section = sectionAt(timeSec)
  const sectionDuration = Math.max(0.001, section.endSec - section.startSec)
  const sectionProgress = clamp01((timeSec - section.startSec) / sectionDuration)
  const absoluteBeat = timeSec * BPM / 60
  const beatIndex = Math.floor(absoluteBeat)
  const beatPhase = absoluteBeat - beatIndex
  const beatInBar = beatIndex % 4
  const barIndex = Math.floor(beatIndex / 4)
  const eventWindow = beatPhase < 0.08
  const downbeat = eventWindow && beatInBar === 0
  const level = clamp01(audioLevel)
  const sectionType = section.type as ReactSectionType

  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.round(timeSec * 1000) + Math.round(level * 10)),
    sourceId: TRACK_ID,
    trackId: TRACK_ID,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: level * 0.86,
      bass: level,
      lowMid: level * 0.72,
      mid: level * 0.66,
      high: level * 0.58,
      air: level * 0.42,
      volume: level * 0.78,
      normalizedSub: level * 0.86,
      normalizedBass: level,
      normalizedLowMid: level * 0.72,
      normalizedMid: level * 0.66,
      normalizedHigh: level * 0.58,
      normalizedAir: level * 0.42,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: BPM,
      bpmConfidence: 1,
      beatIndex,
      beatPhase,
      beatInBar,
      barIndex,
      beatHit: eventWindow,
      downbeatHit: downbeat,
      kickHit: eventWindow && beatInBar % 2 === 0,
      kickStrength: eventWindow ? level : 0,
      snareHit: eventWindow && beatInBar % 2 === 1,
      snareStrength: eventWindow ? level * 0.9 : 0,
      hatHit: beatPhase < 0.04 || (beatPhase > 0.48 && beatPhase < 0.54),
      hatStrength: level * 0.7,
      transient: eventWindow ? level : level * 0.08,
      transientConfidence: 1,
      phrase4Progress: ((barIndex % 4) + (beatInBar + beatPhase) / 4) / 4,
      phrase8Progress: ((barIndex % 8) + (beatInBar + beatPhase) / 4) / 8,
      phrase16Progress: ((barIndex % 16) + (beatInBar + beatPhase) / 4) / 16,
      phrase32Progress: ((barIndex % 32) + (beatInBar + beatPhase) / 4) / 32,
      phrase4Hit: downbeat && barIndex % 4 === 0,
      phrase8Hit: downbeat && barIndex % 8 === 0,
      phrase16Hit: downbeat && barIndex % 16 === 0,
      phrase32Hit: downbeat && barIndex % 32 === 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: level,
      shortTerm: level * 0.88,
      longTerm: level * 0.72,
      peak: level,
      rms: level * 0.7,
      spectralFlux: eventWindow ? level : level * 0.12,
      delta: eventWindow ? level * 0.6 : 0,
      percentile: section.intensity,
      buildProgress: sectionType === 'build' || sectionType === 'preDrop' ? sectionProgress : 0,
      dropImpact: sectionType === 'drop' && sectionProgress < 0.04 ? 1 - sectionProgress / 0.04 : 0,
      tension: sectionType === 'drop' ? 0.78 : 0.42,
      complexity: sectionType === 'drop' ? 0.86 : 0.56,
      spectralCentroid: 0.5 + level * 0.3,
      spectralSpread: 0.45,
      spectralRolloff: 0.68,
      spectralFlatness: 0.2,
    },
    section: {
      type: sectionType,
      label: section.label,
      startSec: section.startSec,
      endSec: section.endSec,
      progress: sectionProgress,
      intensity: section.intensity,
      confidence: 1,
      source: 'analysis',
    },
    stems: {
      ...DEFAULT_MI_FRAME.stems,
      drums: level,
      bass: level * 0.96,
      instruments: level * 0.68,
      drumEnergy: level,
      bassStemEnergy: level * 0.96,
      instrumentEnergy: level * 0.68,
      drumTransient: eventWindow,
      bassStemTransient: eventWindow && beatInBar % 2 === 0,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: true,
    },
    resolvedSections: TRACK_SECTIONS,
    analysisSource: 'bar_self_similarity',
    analysisRevision: 'pix-grid-marquee-real-browser-analysis-v1',
    timelineRevision: 'pix-grid-marquee-real-browser-timeline-v1',
    analysisCapabilities: {
      reliableBeatGrid: true,
      reliableDownbeatGrid: true,
      barAwareSections: true,
      selfSimilarityAnalysis: true,
      semanticClassification: true,
      phraseHierarchy: true,
      semanticMoments: true,
      legacyFallbackOnly: false,
    },
    confidence: {
      overall: 1,
      rhythm: 1,
      harmonic: 0.8,
      section: 1,
    },
  }
}

interface BrowserSnapshot {
  ready: boolean
  audioTimeSec: number
  audioLevel: number
  activeReactEngineId: string
  activeReactPresetId: string | null
  selectedPresetId: string | null
  selectedSceneId: string | null
  previewMode: string
  selectedLayerId: string | null
  quality: string
  qualityMode: string
  performanceEnabled: boolean
  runtimeFrame: PixGridSurfaceRuntimeFrame | null
  performance: ReturnType<typeof getPixGridPerformanceRuntimeStatus>
  reactivity: ReturnType<typeof getPixGridReactivityRuntimeStatus>
  sharedPerformance: ReturnType<typeof getSharedPerformanceDiagnostics>
}

declare global {
  interface Window {
    __PIXGRID_MARQUEE_REAL_BROWSER__?: BrowserSnapshot
    __setPixGridMarqueeTime?: (timeSec: number) => void
    __setPixGridMarqueeAudioLevel?: (level: number) => void
  }
}

function RealPixGridBrowserShell() {
  const activeReactEngineId = useReactStore(state => state.activeReactEngineId)
  const activeReactPresetId = useReactStore(state => state.activeReactPresetId)
  const reactPresets = useReactStore(state => state.reactPresets)
  const pixGridState = useReactStore(state => state.pixGridState)
  const selectReactPreset = useReactStore(state => state.selectReactPreset)
  const reactIntensity = useReactStore(state => state.reactIntensity)
  const reactMotion = useReactStore(state => state.reactMotion)
  const reactGlow = useReactStore(state => state.reactGlow)
  const reactBassReactivity = useReactStore(state => state.reactBassReactivity)
  const [editingContextOpen, setEditingContextOpen] = useState(false)
  const [audioTimeSec, setAudioTimeSec] = useState(INITIAL_TIME_SEC)
  const [audioLevel, setAudioLevel] = useState(0.92)
  const [runtimeFrame, setRuntimeFrame] = useState<PixGridSurfaceRuntimeFrame | null>(null)
  const timeRef = useRef(audioTimeSec)
  const audioLevelRef = useRef(audioLevel)
  const runtimeFingerprintRef = useRef('')

  const activePreset = useMemo(
    () => reactPresets.find(preset => preset.id === activeReactPresetId) ?? null,
    [activeReactPresetId, reactPresets],
  )
  const pixGridPresets = useMemo(
    () => reactPresets.filter(preset => preset.engine === 'pixGrid'),
    [reactPresets],
  )
  const selectedLayer = pixGridState.layers.find(layer => layer.id === pixGridState.editor.selectedLayerId) ?? null

  const publishAudioFrame = useCallback((nextTime = timeRef.current, nextLevel = audioLevelRef.current) => {
    AudioFeatureBus.setFrame(buildBrowserFrame(nextTime, nextLevel), 'pix-grid-marquee-real-browser')
  }, [])

  useEffect(() => {
    useReactStore.getState().resetReactView()
    publishAudioFrame()
    const timer = window.setInterval(() => publishAudioFrame(), 40)
    return () => window.clearInterval(timer)
  }, [publishAudioFrame])

  useEffect(() => {
    window.__setPixGridMarqueeTime = nextTime => {
      const safeTime = Math.max(0, Math.min(63.999, Number.isFinite(nextTime) ? nextTime : 0))
      timeRef.current = safeTime
      setAudioTimeSec(safeTime)
      publishAudioFrame(safeTime, audioLevelRef.current)
    }
    window.__setPixGridMarqueeAudioLevel = nextLevel => {
      const safeLevel = clamp01(nextLevel)
      audioLevelRef.current = safeLevel
      setAudioLevel(safeLevel)
      publishAudioFrame(timeRef.current, safeLevel)
    }
    return () => {
      delete window.__setPixGridMarqueeTime
      delete window.__setPixGridMarqueeAudioLevel
    }
  }, [publishAudioFrame])

  const handleRuntimeFrame = useCallback((next: PixGridSurfaceRuntimeFrame) => {
    const fingerprint = JSON.stringify(next)
    if (runtimeFingerprintRef.current === fingerprint) return
    runtimeFingerprintRef.current = fingerprint
    setRuntimeFrame(next)
  }, [])

  useEffect(() => {
    window.__PIXGRID_MARQUEE_REAL_BROWSER__ = {
      ready: activeReactEngineId === 'pixGrid' && activeReactPresetId === PRESET_ID && runtimeFrame != null,
      audioTimeSec,
      audioLevel,
      activeReactEngineId,
      activeReactPresetId,
      selectedPresetId: pixGridState.selectedPresetId,
      selectedSceneId: pixGridState.selectedSceneId,
      previewMode: pixGridState.editor.scenePreviewMode,
      selectedLayerId: pixGridState.editor.selectedLayerId,
      quality: pixGridState.quality,
      qualityMode: pixGridState.qualityMode,
      performanceEnabled: pixGridState.performance.enabled,
      runtimeFrame,
      performance: getPixGridPerformanceRuntimeStatus(),
      reactivity: getPixGridReactivityRuntimeStatus(),
      sharedPerformance: getSharedPerformanceDiagnostics('pixGrid'),
    }
    document.documentElement.dataset.pixGridMarqueeRealReady = window.__PIXGRID_MARQUEE_REAL_BROWSER__.ready ? 'true' : 'false'
  })

  return (
    <main className="real-browser-shell">
      <aside className="real-browser-controls" aria-label="Production PixGrid controls">
        <ReactEngineBrowser />
        {activeReactEngineId === 'pixGrid' && (
          <>
            <SelectRow
              label="PixGrid Preset"
              value={activeReactPresetId ?? ''}
              options={pixGridPresets.map(preset => ({ value: preset.id, label: preset.name }))}
              onChange={selectReactPreset}
            />
            <PixGridControls />
            <button
              type="button"
              className="real-browser-editing-toggle"
              aria-expanded={editingContextOpen}
              aria-controls="real-browser-editing-context"
              onClick={() => setEditingContextOpen(open => !open)}
            >
              Editing Context
            </button>
            {editingContextOpen && (
              <section id="real-browser-editing-context" aria-label="Editing Context panel">
                <PixGridDesignPanel />
              </section>
            )}
          </>
        )}
      </aside>

      <section className="real-browser-output" aria-label="Real PixGrid runtime output">
        {activeReactEngineId === 'pixGrid' && activePreset ? (
          <div
            className="real-browser-surface-wrap"
            data-testid="real-pix-grid-surface-wrap"
            data-selected-layer-id={selectedLayer?.id ?? ''}
          >
            <PixGridSurface
              analyser={null}
              activePreset={activePreset}
              pixGridState={pixGridState}
              pixGridActionCues={[]}
              intensity={reactIntensity}
              motion={reactMotion}
              glow={reactGlow}
              bassReactivity={reactBassReactivity}
              isPlaying
              isPaused={false}
              trackSections={TRACK_SECTIONS}
              trackIdentity={TRACK_ID}
              durationSec={64}
              audioTimeSec={audioTimeSec}
              getAudioTime={() => timeRef.current}
              effectiveBpm={BPM}
              onRuntimeFrame={handleRuntimeFrame}
            />
            {selectedLayer && (
              <div className="real-browser-selected-layer" data-testid="selected-layer-highlight">
                {selectedLayer.name}
              </div>
            )}
          </div>
        ) : (
          <div className="real-browser-empty" data-testid="non-pix-grid-engine">Select PixGrid to mount the production surface.</div>
        )}
        <div className="real-browser-probe" aria-live="polite">
          <output data-testid="runtime-scene">{runtimeFrame?.sceneId ?? 'pending'}</output>
          <output data-testid="runtime-renderer">{runtimeFrame?.rendererPath ?? 'pending'}</output>
          <output data-testid="runtime-logical-size">{runtimeFrame ? `${runtimeFrame.logicalWidth}x${runtimeFrame.logicalHeight}` : 'pending'}</output>
          <output data-testid="runtime-active-cells">{runtimeFrame?.activeCellCount ?? 0}</output>
          <output data-testid="runtime-pixel-hash">{runtimeFrame?.pixelHash ?? 'pending'}</output>
          <output data-testid="runtime-sign-frame">{runtimeFrame?.signFrameIndex ?? -1}</output>
          <output data-testid="runtime-transition-progress">{runtimeFrame?.signTransitionProgress ?? -1}</output>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<RealPixGridBrowserShell />)
