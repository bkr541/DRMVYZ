import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { VzEffects, Quality } from '../../../stores/visualStore'
import type { UploadedMedia } from '../../../stores/mediaStore'
import type { VzEffectParams } from '../../../types/effectParams'
import type { ModulationRoute } from '../../../lib/audioModulation'
import type { VzTimelineMediaClip, VzTimelineEffectRegion } from '../../../types/timeline'
import type { VzLayerConfig, VzLayerItem } from '../../../types/vzLayers'
import type { PerformanceStats } from '../../../types/performanceStats'
import { DEFAULT_PERFORMANCE_STATS } from '../../../types/performanceStats'
import { LiveVisualCanvas } from './LiveVisualCanvas'
import { PreviewOverlay } from './PreviewOverlay'
import { RenderSourceBadge } from './RenderSourceBadge'
import { OutputHealthIndicator } from '../layout/OutputHealthIndicator'
import { Dropdown, DropdownSelect } from '../../shared/Dropdown/Dropdown'

function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '--:--.--'
  const m  = Math.floor(secs / 60)
  const s  = Math.floor(secs % 60)
  const cs = Math.floor((secs % 1) * 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export function LiveVisualPreview({
  analyser, activeMedia, effects, enabledFx,
  isPlaying, onPlay, onPause, onPrev, onNext, onFullscreen,
  bpm, bpmSync,
  quality, onQualityChange,
  canvasWrapRef, audioTime, getAudioTime, audioDuration, modulationRoutes,
  timelineEnabled, onToggleTimeline, timelineClips, timelineOverlayClips = [], timelineEffectRegions = [], timelineLoop, mediaItems,
  layerConfigs, layerItems, effectParams, audioReactivityEnabled,
  onSelectVisualizer,
  stageOverlays,
  onCanvasReady,
  onLiveFps,
}: {
  analyser: AnalyserNode | null
  activeMedia: UploadedMedia | null
  effects: VzEffects
  enabledFx: Set<string>
  isPlaying: boolean; onPlay: () => void; onPause: () => void
  onPrev: () => void; onNext: () => void; onFullscreen: () => void
  bpm: number
  bpmSync: boolean
  quality: Quality; onQualityChange: (q: Quality) => void
  canvasWrapRef: React.RefObject<HTMLDivElement>
  audioTime: number
  getAudioTime: () => number
  audioDuration: number
  modulationRoutes: ModulationRoute[]
  timelineEnabled: boolean; onToggleTimeline: () => void
  timelineClips: VzTimelineMediaClip[]
  timelineOverlayClips?: VzTimelineMediaClip[]
  timelineEffectRegions?: VzTimelineEffectRegion[]
  timelineLoop: boolean
  mediaItems: UploadedMedia[]
  layerConfigs: VzLayerConfig[]
  layerItems: VzLayerItem[]
  effectParams: VzEffectParams
  audioReactivityEnabled: boolean
  onSelectVisualizer: () => void
  stageOverlays?: ReactNode
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
}) {
  const [liveStats, setLiveStats] = useState<PerformanceStats>(DEFAULT_PERFORMANCE_STATS)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Track fullscreen state so diagnostic overlays are hidden during program output.
  useEffect(() => {
    function onFullscreenChange() { setIsFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const anyViewActive = timelineEnabled

  return (
    <div className="vz-preview-panel">
      <div className="vz-preview-canvas-wrap" ref={canvasWrapRef}>
        <LiveVisualCanvas
          analyser={analyser}
          activeMedia={activeMedia}
          effects={effects}
          enabledFx={enabledFx}
          isPlaying={isPlaying}
          bpm={bpm}
          bpmSync={bpmSync}
          quality={quality}
          getAudioTime={getAudioTime}
          modulationRoutes={modulationRoutes}
          timelineEnabled={timelineEnabled}
          timelineClips={timelineClips}
          timelineOverlayClips={timelineOverlayClips}
          timelineEffectRegions={timelineEffectRegions}
          timelineLoop={timelineLoop}
          mediaItems={mediaItems}
          layerConfigs={layerConfigs}
          layerItems={layerItems}
          effectParams={effectParams}
          audioReactivityEnabled={audioReactivityEnabled}
          onStatsUpdate={(stats) => { setLiveStats(stats); onLiveFps?.(stats.fps) }}
          onCanvasReady={onCanvasReady}
        />
        {/* Diagnostic overlays are editor-only — hidden during fullscreen program output */}
        {!isFullscreen && (
          <PreviewOverlay quality={quality} fps={liveStats.fps} rendererType={liveStats.rendererType} />
        )}
        {!isFullscreen && (
          <RenderSourceBadge
            timelineEnabled={timelineEnabled}
            timelineClips={timelineClips}
            timelineLoop={timelineLoop}
            activeMedia={activeMedia}
            mediaItems={mediaItems}
          />
        )}
        {/* Editor toast notifications are suppressed during fullscreen output */}
        {!isFullscreen && stageOverlays}
      </div>

      <div className="vz-preview-transport">
        <button className="vz-preview-trans-btn" title="Previous" onClick={onPrev}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
          </svg>
        </button>

        <button className="vz-preview-play-btn" title={isPlaying ? 'Pause' : 'Play'}
          onClick={isPlaying ? onPause : onPlay}>
          {isPlaying
            ? <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>

        <button className="vz-preview-trans-btn" title="Next" onClick={onNext}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>

        <button className="vz-preview-trans-btn" title="Fullscreen Output" onClick={onFullscreen}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
        </button>

        <div className="vz-transport-time">
          <span className="vz-transport-time-current">{fmtTime(audioTime)}</span>
          <span className="vz-transport-time-total">{fmtTime(audioDuration)}</span>
        </div>

        <div className="az-spacer" />

        <Dropdown
          id="visualizer-view"
          value={timelineEnabled ? 'timeline' : 'visualizer'}
          options={[
            { value: 'visualizer', label: 'Visualizer' },
            { value: 'timeline', label: 'Timeline' },
          ]}
          onChange={value => {
            if (value === 'visualizer' && timelineEnabled) onSelectVisualizer()
            if (value === 'timeline' && !timelineEnabled) onToggleTimeline()
          }}
          ariaLabel="View"
          menuLabel="View"
          title="View options"
          size="dense"
          menuWidth={180}
          showDescriptions={false}
          className={`vz-view-dropdown${anyViewActive ? ' vz-view-dropdown--active' : ''}`}
        />

        <div className="vz-header-sep" />

        <OutputHealthIndicator stats={liveStats} />

        <div className="vz-header-sep" />

        <DropdownSelect className="az-select" value={quality}
          onChange={e => onQualityChange(e.target.value as Quality)}>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </DropdownSelect>
      </div>
    </div>
  )
}
