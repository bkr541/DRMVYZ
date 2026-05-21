import { useState } from 'react'
import type { VzEffects, Quality } from '../../../stores/visualStore'
import type { UploadedMedia } from '../../../stores/mediaStore'
import type { ModulationRoute } from '../../../lib/audioModulation'
import type { VzTimelineClip } from '../../../types/timeline'
import type { VzLayerConfig, VzLayerItem } from '../../../types/vzLayers'
import { LiveVisualCanvas } from './LiveVisualCanvas'
import { PreviewOverlay } from './PreviewOverlay'

export function LiveVisualPreview({
  analyser, activeMedia, effects, enabledFx,
  isPlaying, onPlay, onPause, onPrev, onNext, onFullscreen,
  bpm, bpmSync,
  quality, onQualityChange,
  canvasWrapRef, audioTime, modulationRoutes,
  timelineEnabled, onToggleTimeline, timelineClips, timelineLoop, mediaItems,
  layerConfigs, layerItems,
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
  modulationRoutes: ModulationRoute[]
  timelineEnabled: boolean; onToggleTimeline: () => void
  timelineClips: VzTimelineClip[]; timelineLoop: boolean
  mediaItems: UploadedMedia[]
  layerConfigs: VzLayerConfig[]
  layerItems: VzLayerItem[]
}) {
  const [liveFps, setLiveFps] = useState(0)

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
          audioTime={audioTime}
          modulationRoutes={modulationRoutes}
          timelineEnabled={timelineEnabled}
          timelineClips={timelineClips}
          timelineLoop={timelineLoop}
          mediaItems={mediaItems}
          layerConfigs={layerConfigs}
          layerItems={layerItems}
          onFpsUpdate={setLiveFps}
        />
        <PreviewOverlay quality={quality} fps={liveFps} />
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

        <div className="az-spacer" />

        <div className="vz-timeline-group">
          <button
            className={`vz-timeline-pill ${timelineEnabled ? 'vz-timeline-pill--on' : ''}`}
            onClick={onToggleTimeline}
            title={timelineEnabled ? 'Timeline mode ON — click to disable' : 'Timeline mode OFF — click to enable'}
          >
            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true">
              <path d="M3 5h18v2H3V5zm0 4h12v2H3V9zm0 4h18v2H3v-2zm0 4h12v2H3v-2z"/>
            </svg>
            <span className="vz-timeline-pill-label">Timeline</span>
            <span className={`vz-timeline-pill-dot${timelineEnabled ? ' vz-timeline-pill-dot--on' : ''}`} />
          </button>
        </div>

        <div className="vz-header-sep" />

        <select className="az-select" value={quality}
          onChange={e => onQualityChange(e.target.value as Quality)}>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
    </div>
  )
}
