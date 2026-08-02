import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useReactStore } from '../../../stores/reactStore'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../react/reactEngineCatalog'
import { PixGridDesignPanel } from '../react/pixGrid/PixGridDesignPanel'
import { PixGridSurface } from '../react/pixGrid/PixGridSurface'
import type { ReactPreset } from '../react/ReactTypes'
import type { PixGridLayer } from '../react/pixGrid/PixGridTypes'
import '../../../styles/reactView.css'
import '../../../styles/showManager.css'

const COMPONENTS = [
  ['▦', 'Pixel Grid', '12'],
  ['▥', 'Bars', '8'],
  ['✦', 'Lights', '16'],
  ['·', 'Particles', '24'],
  ['ϟ', 'Strobe', '6'],
  ['T', 'Text', '10'],
] as const

const ASSETS = [
  ['▧', 'Textures', '28'],
  ['◇', 'Materials', '14'],
  ['▶', 'Media', '36'],
  ['◈', 'Shaders', '18'],
  ['Aa', 'Fonts', '9'],
] as const

const SECTION_SEGMENTS = [
  { label: 'Intro', className: 'is-intro' },
  { label: 'Build', className: 'is-build' },
  { label: 'Drop', className: 'is-drop' },
  { label: 'Breakdown', className: 'is-breakdown' },
] as const

function formatClock(value: number): string {
  const safe = Number.isFinite(value) && value > 0 ? value : 0
  const minutes = Math.floor(safe / 60)
  const seconds = Math.floor(safe % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function findPixGridPreset(
  presets: readonly ReactPreset[],
  preferredId: string | null,
): ReactPreset | null {
  const pixGridPresets = presets.filter(preset => preset.engine === 'pixGrid')
  return pixGridPresets.find(preset => preset.id === preferredId) ?? pixGridPresets[0] ?? null
}

export function ShowManagerView() {
  const engine = useSharedAudio()
  const reactPresets = useReactStore(state => state.reactPresets)
  const activeReactPresetId = useReactStore(state => state.activeReactPresetId)
  const pixGridState = useReactStore(state => state.pixGridState)
  const reactIntensity = useReactStore(state => state.reactIntensity)
  const reactMotion = useReactStore(state => state.reactMotion)
  const reactGlow = useReactStore(state => state.reactGlow)
  const reactBassReactivity = useReactStore(state => state.reactBassReactivity)
  const pixGridActionCuesByTrackId = useReactStore(state => state.pixGridActionCuesByTrackId)
  const [previewPresetId, setPreviewPresetId] = useState<string | null>(null)
  const [liveFps, setLiveFps] = useState(0)

  const pixGridPresets = useMemo(
    () => reactPresets.filter(preset => preset.engine === 'pixGrid'),
    [reactPresets],
  )

  useEffect(() => {
    const preferred = findPixGridPreset(reactPresets, activeReactPresetId)
    setPreviewPresetId(current => {
      if (current && pixGridPresets.some(preset => preset.id === current)) return current
      return preferred?.id ?? null
    })
  }, [activeReactPresetId, pixGridPresets, reactPresets])

  const activePreset = useMemo(
    () => findPixGridPreset(reactPresets, previewPresetId),
    [previewPresetId, reactPresets],
  )
  const selectedScene = pixGridState.scenes.find(scene => scene.id === pixGridState.selectedSceneId)
    ?? pixGridState.scenes[0]
    ?? null
  const selectedLayers = selectedScene
    ? selectedScene.layerIds
      .map(layerId => pixGridState.layers.find(layer => layer.id === layerId))
      .filter((layer): layer is PixGridLayer => Boolean(layer))
    : []
  const activeCues = engine.currentTrackId
    ? (pixGridActionCuesByTrackId[engine.currentTrackId] ?? [])
    : []
  const durationSec = Number.isFinite(engine.duration) && engine.duration > 0 ? engine.duration : 180
  const playheadPercent = Math.min(100, Math.max(0, (engine.currentTime / durationSec) * 100))
  const sceneLabels = pixGridState.scenes.slice(0, 4).map(scene => scene.name)
  const matrixLabel = `${pixGridState.matrixWidth}×${pixGridState.matrixHeight}`

  return (
    <section className="sm-root" aria-label="Show Manager workspace">
      <header className="sm-topbar">
        <div className="sm-title-block">
          <strong>SHOW MANAGER</strong>
          <span>Preset authoring workspace</span>
        </div>

        <label className="sm-topbar-field">
          <span>Engine</span>
          <select aria-label="Show Manager engine" value="pixGrid" onChange={() => undefined}>
            {REACT_ENGINE_IDS.map(engineId => (
              <option key={engineId} value={engineId} disabled={engineId !== 'pixGrid'}>
                {REACT_ENGINE_CATALOG[engineId].label}{engineId === 'pixGrid' ? '' : ' · Coming later'}
              </option>
            ))}
          </select>
        </label>

        <label className="sm-topbar-field sm-topbar-field--preset">
          <span>Preset</span>
          <select
            aria-label="Show Manager PixGrid preset"
            value={activePreset?.id ?? ''}
            onChange={event => setPreviewPresetId(event.target.value)}
            disabled={pixGridPresets.length === 0}
          >
            {pixGridPresets.length === 0 && <option value="">No PixGrid presets</option>}
            {pixGridPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </label>

        <div className="sm-topbar-spacer" />
        <button type="button" className="sm-header-button" disabled>Show Lyrics</button>
        <button type="button" className="sm-header-button" disabled>Save</button>
        <button type="button" className="sm-header-button sm-header-button--primary" disabled>
          Save + Make Active
        </button>
      </header>

      <div className="sm-workspace">
        <aside className="sm-library" aria-label="Show Manager component library">
          <div className="sm-panel-heading">
            <strong>COMPONENT LIBRARY</strong>
            <span>PixGrid</span>
          </div>
          <label className="sm-search-field">
            <span className="sr-only">Search Show Manager components</span>
            <input type="search" placeholder="Search components…" disabled />
          </label>

          <LibrarySection title="Components" count={COMPONENTS.length}>
            {COMPONENTS.map(([icon, label, count], index) => (
              <button key={label} type="button" className={`sm-library-row${index === 0 ? ' is-active' : ''}`} disabled>
                <span className="sm-library-grip">⋮⋮</span>
                <span className="sm-library-icon">{icon}</span>
                <span>{label}</span>
                <small>{count}</small>
              </button>
            ))}
          </LibrarySection>

          <LibrarySection title="Assets" count={ASSETS.length}>
            {ASSETS.map(([icon, label, count]) => (
              <button key={label} type="button" className="sm-library-row" disabled>
                <span className="sm-library-grip">⋮⋮</span>
                <span className="sm-library-icon">{icon}</span>
                <span>{label}</span>
                <small>{count}</small>
              </button>
            ))}
          </LibrarySection>

          <LibrarySection title="Scenes" count={pixGridState.scenes.length}>
            {pixGridState.scenes.map((scene, index) => (
              <button
                key={scene.id}
                type="button"
                className={`sm-library-row sm-scene-row${scene.id === selectedScene?.id ? ' is-active' : ''}`}
                disabled
              >
                <span className="sm-library-grip">⋮⋮</span>
                <span className="sm-scene-index">{String(index + 1).padStart(2, '0')}</span>
                <span>{scene.name}</span>
                <small>{scene.layerIds.length}</small>
              </button>
            ))}
          </LibrarySection>

          <LibrarySection title="Layers" count={selectedLayers.length} collapsed={false}>
            {selectedLayers.slice(0, 6).map(layer => (
              <button key={layer.id} type="button" className="sm-library-row" disabled>
                <span className="sm-library-grip">⋮⋮</span>
                <span className="sm-layer-dot" />
                <span>{layer.name}</span>
                <small>{layer.visible ? '●' : '○'}</small>
              </button>
            ))}
            {selectedLayers.length === 0 && <div className="sm-library-empty">No layers in this scene.</div>}
          </LibrarySection>
        </aside>

        <main className="sm-center">
          <div className="sm-stage-header">
            <div>
              <strong>PixGrid</strong>
              <span>{activePreset?.name ?? 'Preset preview'}</span>
            </div>
            <div className="sm-stage-tools" aria-label="Show Manager stage tools">
              {['↖', '✥', '↻', '⌗', '▦', '◫', '20'].map(tool => (
                <button key={tool} type="button" disabled>{tool}</button>
              ))}
            </div>
          </div>

          <div className="sm-stage-frame">
            <PixGridSurface
              analyser={engine.analyserMaster}
              activePreset={activePreset}
              pixGridState={pixGridState}
              pixGridActionCues={activeCues}
              intensity={reactIntensity}
              motion={reactMotion}
              glow={reactGlow}
              bassReactivity={reactBassReactivity}
              isPlaying={engine.isPlaying}
              isPaused={!engine.isPlaying}
              trackIdentity={engine.currentTrackId}
              durationSec={durationSec}
              audioTimeSec={engine.currentTime}
              getAudioTime={engine.getCurrentTime}
              effectiveBpm={engine.currentEffectiveBpm ?? undefined}
              onLiveFps={setLiveFps}
            />
            <div className="sm-stage-status">
              <span>PixGrid {matrixLabel}</span>
              <span>FPS {liveFps > 0 ? liveFps.toFixed(1) : '—'}</span>
            </div>
            <button type="button" className="sm-fit-button" disabled>Fit⌄</button>
          </div>

          <ShowManagerTimeline
            currentTime={engine.currentTime}
            duration={durationSec}
            playheadPercent={playheadPercent}
            sceneLabels={sceneLabels}
          />
        </main>

        <aside className="sm-inspector" aria-label="Show Manager PixGrid inspector">
          <div className="sm-panel-heading sm-panel-heading--inspector">
            <strong>INSPECTOR</strong>
            <span>PixGrid parameters</span>
          </div>
          <div className="sm-inspector-scroll">
            <div className="sm-inspector-context">
              <div>
                <span>Component</span>
                <strong>Pixel Grid</strong>
              </div>
              <div>
                <span>Matrix</span>
                <strong>{matrixLabel}</strong>
              </div>
            </div>
            <PixGridDesignPanel />
            <section className="sm-validation-card">
              <header><strong>VALIDATION</strong><span>OK</span></header>
              <p>No blocking PixGrid issues detected.</p>
              <p>Preset controls are connected to the existing PixGrid state.</p>
            </section>
            <section className="sm-document-stats">
              <header>DOCUMENT STATS</header>
              <div><span>Scenes</span><strong>{pixGridState.scenes.length}</strong></div>
              <div><span>Layers</span><strong>{pixGridState.layers.length}</strong></div>
              <div><span>Groups</span><strong>{pixGridState.groups.length}</strong></div>
              <div><span>Cues</span><strong>{activeCues.length}</strong></div>
            </section>
          </div>
        </aside>
      </div>
    </section>
  )
}

function LibrarySection({
  title,
  count,
  collapsed = false,
  children,
}: {
  title: string
  count: number
  collapsed?: boolean
  children: ReactNode
}) {
  return (
    <section className="sm-library-section">
      <header>
        <span>{collapsed ? '›' : '⌄'}</span>
        <strong>{title}</strong>
        <small>{count}</small>
      </header>
      {!collapsed && <div className="sm-library-section-body">{children}</div>}
    </section>
  )
}

function ShowManagerTimeline({
  currentTime,
  duration,
  playheadPercent,
  sceneLabels,
}: {
  currentTime: number
  duration: number
  playheadPercent: number
  sceneLabels: readonly string[]
}) {
  return (
    <section className="sm-timeline" aria-label="Show Manager track map preview">
      <header className="sm-timeline-tabs">
        <button type="button" className="is-active" disabled>Track Map</button>
        <button type="button" disabled>Cues</button>
        <button type="button" disabled>Automation</button>
        <button type="button" disabled>Clips</button>
        <button type="button" disabled>Events</button>
        <span className="sm-timeline-meta">Snap 1/4</span>
      </header>
      <div className="sm-timeline-grid">
        <div className="sm-timeline-ruler">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index}>{formatClock((duration / 6) * index)}</span>
          ))}
        </div>
        <TimelineRow label="Section">
          <div className="sm-segment-row">
            {SECTION_SEGMENTS.map(segment => (
              <span key={segment.label} className={segment.className}>{segment.label}</span>
            ))}
          </div>
        </TimelineRow>
        <TimelineRow label="Scenes">
          <div className="sm-segment-row sm-segment-row--scenes">
            {SECTION_SEGMENTS.map((segment, index) => (
              <span key={segment.label}>{sceneLabels[index] ?? segment.label}</span>
            ))}
          </div>
        </TimelineRow>
        <TimelineRow label="Cues">
          <div className="sm-cue-row">
            {[8, 18, 31, 43, 55, 69, 82, 94].map(position => <i key={position} style={{ left: `${position}%` }} />)}
          </div>
        </TimelineRow>
        <TimelineRow label="Glow">
          <svg className="sm-automation-curve" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,14 12,13 25,11 38,5 50,10 63,12 76,6 88,9 100,13" />
          </svg>
        </TimelineRow>
        <TimelineRow label="Intensity">
          <svg className="sm-automation-curve is-green" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,15 16,15 30,12 45,7 58,9 72,5 84,9 100,14" />
          </svg>
        </TimelineRow>
        <TimelineRow label="Motion">
          <svg className="sm-automation-curve is-purple" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,13 14,12 28,12 43,8 57,13 70,10 84,6 100,11" />
          </svg>
        </TimelineRow>
        <TimelineRow label="Audio">
          <div className="sm-waveform" aria-hidden="true">
            {Array.from({ length: 96 }, (_, index) => (
              <i key={index} style={{ height: `${22 + ((index * 17) % 68)}%` }} />
            ))}
          </div>
        </TimelineRow>
        <div className="sm-playhead" style={{ left: `calc(${playheadPercent}% + ${76 * (1 - playheadPercent / 100)}px)` }}>
          <span>{formatClock(currentTime)}</span>
        </div>
      </div>
    </section>
  )
}

function TimelineRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sm-timeline-row">
      <strong>{label}</strong>
      <div>{children}</div>
    </div>
  )
}
