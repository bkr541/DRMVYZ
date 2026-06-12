import { useShallow } from 'zustand/react/shallow'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useReactStore } from '../../../stores/reactStore'
import { ReactPresetBrowser } from './ReactPresetBrowser'
import { ReactControlPanel } from './ReactControlPanel'
import { ReactTrackMapStrip } from './ReactTrackMapStrip'
import { ReactPlaceholderCanvas } from './ReactPlaceholderCanvas'
import { ReactPerformancePads } from './ReactPerformancePads'
import { VyzualzAudioDock } from '../shared/VyzualzAudioDock'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
import '../../../styles/reactView.css'

export function ReactView() {
  const engine   = useSharedAudio()
  const analyser = engine.analyserMaster

  const {
    reactPresets,
    activeReactPresetId,
    reactIntensity,
    reactMotion,
    reactGlow,
    reactBassReactivity,
    reactTrailDecay,
    reactFogDensity,
    reactParticleDensity,
    oscillatorSettings,
    oscillatorGlyphAssets,
    oscillatorGlyphPointCache,
    oscillatorTextPointCache,
    manualTrackSections,
    selectReactPreset,
  } = useReactStore(useShallow(s => ({
    reactPresets:           s.reactPresets,
    activeReactPresetId:    s.activeReactPresetId,
    reactIntensity:         s.reactIntensity,
    reactMotion:            s.reactMotion,
    reactGlow:              s.reactGlow,
    reactBassReactivity:    s.reactBassReactivity,
    reactTrailDecay:        s.reactTrailDecay,
    reactFogDensity:        s.reactFogDensity,
    reactParticleDensity:   s.reactParticleDensity,
    oscillatorSettings:          s.oscillatorSettings,
    oscillatorGlyphAssets:       s.oscillatorGlyphAssets,
    oscillatorGlyphPointCache:   s.oscillatorGlyphPointCache,
    oscillatorTextPointCache:    s.oscillatorTextPointCache,
    manualTrackSections:         s.manualTrackSections,
    selectReactPreset:           s.selectReactPreset,
  })))

  const activePreset = reactPresets.find(p => p.id === activeReactPresetId) ?? reactPresets[0] ?? null

  // Estimated track duration from the audio engine (fallback 180s)
  const audioDurationSec = (engine as { duration?: number }).duration ?? 180

  return (
    <div className="rv-shell">
      <div className="vz-header">
        <div className="vz-header-title-group">
          <div className="vz-header-title">REACT</div>
          <div className="vz-header-sub">Visual Performance Mode</div>
        </div>
        <span className="az-spacer" />
        <VyzualzHeaderActions />
      </div>
      <div className="rv-layout">
        {/* Left — preset / engine browser */}
        <aside className="rv-left-panel">
          <ReactPresetBrowser
            presets={reactPresets}
            activePresetId={activeReactPresetId}
            onSelect={selectReactPreset}
          />
        </aside>

        {/* Center — canvas + pads + track map */}
        <div className="rv-center-col">
          <div className="rv-canvas-wrap">
            <ReactPlaceholderCanvas
              analyser={analyser}
              activePreset={activePreset}
              intensity={reactIntensity}
              motion={reactMotion}
              glow={reactGlow}
              bassReactivity={reactBassReactivity}
              trailDecay={reactTrailDecay}
              fogDensity={reactFogDensity}
              particleDensity={reactParticleDensity}
              oscillatorSettings={oscillatorSettings}
              oscillatorGlyphAssets={oscillatorGlyphAssets}
              oscillatorGlyphPointCache={oscillatorGlyphPointCache}
              oscillatorTextPointCache={oscillatorTextPointCache}
              isPlaying={engine.isPlaying}
              manualSections={manualTrackSections}
              getAudioTime={() => engine.currentTime}
            />
          </div>
          <ReactPerformancePads />
          <ReactTrackMapStrip audioDurationSec={audioDurationSec} />
        </div>

        {/* Right — controls */}
        <aside className="rv-right-panel">
          <ReactControlPanel />
        </aside>
      </div>

      {/* Bottom dock — outside the grid, full width */}
      <VyzualzAudioDock />
    </div>
  )
}
