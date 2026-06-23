import { useRef, useEffect, useState, useCallback } from 'react'
import Peaks from 'peaks.js'
import type { PeaksInstance } from 'peaks.js'
import type { AudioEngine } from '../../../hooks/useAudioEngine'
import type { VzCueMarker } from '../../../types/cue'
import { PeaksAudioEngineAdapter } from './peaksAudioEngineAdapter'
import { RgbWaveformCanvas } from './RgbWaveformCanvas'
import type { RgbWaveformAnalysis } from '../../../features/waveform/rgbWaveformTypes'

export interface PeaksWaveformViewProps {
  engine:         AudioEngine
  cueMarkers:     VzCueMarker[]
  waveformZoom:   number
  rgbAnalysis?:   RgbWaveformAnalysis | null
  fallbackPeaks?: number[] | null
}

export function syncCueMarkers(instance: PeaksInstance, markers: VzCueMarker[]): void {
  instance.points.removeAll()
  if (markers.length > 0) {
    instance.points.add(
      markers.map(m => ({
        id:        m.id,
        time:      m.time,
        labelText: m.label,
        color:     m.color ?? '#b84fc9',
        editable:  false,
      })),
    )
  }
}

export function PeaksWaveformView({
  engine,
  cueMarkers,
  waveformZoom,
  rgbAnalysis,
  fallbackPeaks,
}: PeaksWaveformViewProps) {
  const overviewRef = useRef<HTMLDivElement>(null)
  const zoomviewRef = useRef<HTMLDivElement>(null)
  const peaksRef    = useRef<PeaksInstance | null>(null)
  const adapterRef  = useRef<PeaksAudioEngineAdapter | null>(null)
  const engineRef   = useRef<AudioEngine>(engine)
  engineRef.current = engine

  const cueMarkersRef     = useRef(cueMarkers)
  cueMarkersRef.current   = cueMarkers
  const waveformZoomRef   = useRef(waveformZoom)
  waveformZoomRef.current = waveformZoom

  // Generation counter — incremented on every destroyPeaks() to invalidate
  // any in-flight Peaks.init callback (handles StrictMode double-invoke + track change).
  const initGenRef   = useRef(0)
  const mountedRef   = useRef(true)

  const [peaksReady, setPeaksReady] = useState(false)
  const [peaksError, setPeaksError] = useState(false)

  const destroyPeaks = useCallback(() => {
    initGenRef.current += 1
    peaksRef.current?.destroy()
    peaksRef.current = null
    adapterRef.current?.destroy()
    adapterRef.current = null
  }, [])

  const initPeaks = useCallback(() => {
    const overviewEl = overviewRef.current
    const zoomviewEl = zoomviewRef.current
    const eng        = engineRef.current
    const track      = eng.currentTrack
    if (!overviewEl || !zoomviewEl || !track) return

    const buffer = eng.getDecodedBuffer(track.id)
    if (!buffer) return

    destroyPeaks()
    const gen = initGenRef.current

    const adapter = new PeaksAudioEngineAdapter(engineRef)
    adapterRef.current = adapter

    Peaks.init(
      {
        zoomview: {
          container:           zoomviewEl,
          waveformColor:       'rgba(74,199,219,0.45)',
          playedWaveformColor: 'rgba(74,199,219,0.85)',
          playheadColor:       '#4ac7db',
          showPlayheadTime:    false,
          showAxisLabels:      false,
          autoScroll:          true,
          autoScrollOffset:    0.2,
        },
        overview: {
          container:            overviewEl,
          waveformColor:        'rgba(74,199,219,0.35)',
          playedWaveformColor:  'rgba(74,199,219,0.65)',
          playheadColor:        '#4ac7db',
          showPlayheadTime:     false,
          showAxisLabels:       false,
          highlightColor:       'rgba(74,199,219,0.12)',
          highlightStrokeColor: 'rgba(74,199,219,0.32)',
          highlightOpacity:     0.5,
          highlightOffset:      1,
        },
        webAudio: {
          audioBuffer:  buffer,
          multiChannel: false,
        },
        player:        adapter,
        keyboard:      false,
        waveformCache: true,
        zoomLevels:    [2048, 1024, 512, 256, 128],
      },
      // Peaks.js calls (null, instance) on success despite the type saying Error
      (err, instance) => {
        if (!mountedRef.current || initGenRef.current !== gen) {
          instance?.destroy()
          return
        }
        if (err) {
          console.error('[PeaksWaveformView] Peaks.init failed:', err)
          adapterRef.current?.destroy()
          adapterRef.current = null
          setPeaksReady(false)
          setPeaksError(true)
          return
        }
        if (!instance) return

        peaksRef.current = instance
        setPeaksError(false)
        setPeaksReady(true)

        // Seek through the engine when user clicks a cue point marker
        instance.on('points.click', ({ point }) => {
          engineRef.current.seek(point.time ?? 0)
        })

        // Sync any cue markers that arrived before init completed
        syncCueMarkers(instance, cueMarkersRef.current)

        // Apply the current zoom setting
        const dur = engineRef.current.duration
        if (dur > 0) {
          instance.views
            .getView('zoomview')
            ?.setZoom({ seconds: Math.max(1, dur / waveformZoomRef.current) })
        }

        adapter.notifyCanPlay()
      },
    )
  }, [destroyPeaks])

  // ── Init / reinit when the active track or analysis status changes ─────────
  useEffect(() => {
    const trackId = engine.currentTrack?.id
    const status  = engine.currentAnalysisStatus
    // Attempt init once the file has been decoded (status moves past 'queued')
    if (trackId && status !== 'queued') {
      initPeaks()
    }
    if (!trackId) {
      destroyPeaks()
      setPeaksReady(false)
      setPeaksError(false)
    }
  }, [engine.currentTrack?.id, engine.currentAnalysisStatus, initPeaks, destroyPeaks])

  // ── Keep Peaks informed of engine play-state changes ──────────────────────
  useEffect(() => {
    adapterRef.current?.notifyPlayState(engine.isPlaying)
  }, [engine.isPlaying])

  // ── Mirror waveformZoom → Peaks zoomview seconds window ───────────────────
  useEffect(() => {
    const peaks = peaksRef.current
    const dur   = engineRef.current.duration
    if (!peaks || dur <= 0) return
    peaks.views.getView('zoomview')?.setZoom({ seconds: Math.max(1, dur / waveformZoom) })
  }, [waveformZoom])

  // ── Sync VzCueMarkers → Peaks point markers ───────────────────────────────
  useEffect(() => {
    const peaks = peaksRef.current
    if (!peaks) return
    syncCueMarkers(peaks, cueMarkers)
  }, [cueMarkers])

  // ── Resize observer — call fitToContainer() rather than reinitializing ────
  useEffect(() => {
    const overviewEl = overviewRef.current
    const zoomviewEl = zoomviewRef.current
    if (!overviewEl || !zoomviewEl) return
    const ro = new ResizeObserver(() => {
      if (!peaksRef.current) return
      peaksRef.current.views.getView('overview')?.fitToContainer()
      peaksRef.current.views.getView('zoomview')?.fitToContainer()
    })
    ro.observe(overviewEl)
    ro.observe(zoomviewEl)
    return () => ro.disconnect()
  }, [])

  // ── Unmount cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      destroyPeaks()
    }
  }, [destroyPeaks])

  return (
    <div className="vz-peaks-wrap">
      {/* Peaks containers are always in the DOM so Peaks can mount/resize into them */}
      <div className="vz-peaks-overview" ref={overviewRef} />
      <div className="vz-peaks-zoomview" ref={zoomviewRef} />

      {/* Fallback canvas: overlays the Peaks containers until they are ready */}
      {!peaksReady && (
        <div className="vz-peaks-fallback">
          <RgbWaveformCanvas
            analysis={rgbAnalysis}
            fallbackPeaks={fallbackPeaks}
            duration={engine.duration}
            currentTime={engine.currentTime}
            markers={cueMarkers}
            onSeek={engine.currentTrack ? engine.seek : undefined}
            zoom={waveformZoom}
          />
        </div>
      )}
    </div>
  )
}
