import { useRef, useEffect, useState, useCallback, useLayoutEffect, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import Peaks from 'peaks.js'
import type { PeaksInstance } from 'peaks.js'
import type { AudioEngine } from '../../../hooks/useAudioEngine'
import type { VzCueMarker } from '../../../types/cue'
import { PeaksAudioEngineAdapter } from './peaksAudioEngineAdapter'
import { RgbWaveformCanvas } from './RgbWaveformCanvas'
import type { RgbWaveformAnalysis } from '../../../features/waveform/rgbWaveformTypes'
import { computeWaveformViewport } from '../../../features/timeline/timelineViewport'
import type { BeatMarkerMI } from '../../../features/musicIntelligence/types'
import {
  buildWaveformCueRequest,
  formatCueBeatReference,
  waveformClientXToTime,
  type WaveformCueCreateRequest,
} from '../../../features/timeline/waveformCuePoint'

export interface PeaksWaveformViewProps {
  engine:         AudioEngine
  cueMarkers:     VzCueMarker[]
  waveformZoom:   number
  rgbAnalysis?:   RgbWaveformAnalysis | null
  fallbackPeaks?: number[] | null
  /** Keep the zoom view locked to the same centered viewport used by Track Map. */
  followTimelineViewport?: boolean
  /** Visual treatment for both Peaks.js and the canvas fallback. */
  appearance?: 'rgb' | 'deck'
  /** Effective beat grid used to attach musical position metadata to new cues. */
  beatGrid?: readonly BeatMarkerMI[] | null
  /** Enables the waveform context menu for authoring manual cue points. */
  onCreateCuePoint?: (request: WaveformCueCreateRequest) => void
  /** IDs that belong to editable/manual cues. Imported metadata remains read-only. */
  editableCueMarkerIds?: readonly string[]
  /** Updates an existing editable cue from the waveform context menu. */
  onUpdateCuePoint?: (id: string, patch: Partial<Omit<VzCueMarker, 'id'>>) => void
  /** Deletes an existing editable cue from the waveform context menu. */
  onDeleteCuePoint?: (id: string) => void
}

export function syncCueMarkers(instance: PeaksInstance, markers: VzCueMarker[]): void {
  instance.points.removeAll()
  if (markers.length > 0) {
    instance.points.add(
      markers.map(m => ({
        id:        m.id,
        time:      m.time,
        labelText: m.label,
        color:     m.color ?? '#e2364f',
        editable:  false,
      })),
    )
  }
}


type WaveformViewport = { startSec: number; endSec: number }

type WaveformContextMenuState = {
  x: number
  y: number
  authoredTimeSec: number
  beat: ReturnType<typeof buildWaveformCueRequest>['beat']
  cueMarker: VzCueMarker | null
  cueEditable: boolean
}

const WAVEFORM_CONTEXT_MENU_MARGIN = 12
const WAVEFORM_CUE_HIT_TOLERANCE_PX = 14

function formatWaveformCueTime(timeSec: number): string {
  const totalMs = Math.max(0, Math.round(timeSec * 1000))
  const minutes = Math.floor(totalMs / 60_000)
  const seconds = Math.floor((totalMs % 60_000) / 1000)
  const milliseconds = totalMs % 1000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

function clampWaveformContextMenu(
  element: HTMLElement,
  point: Pick<WaveformContextMenuState, 'x' | 'y'>,
): { x: number; y: number } {
  if (typeof window === 'undefined') return point
  const rect = element.getBoundingClientRect()
  const maxX = Math.max(WAVEFORM_CONTEXT_MENU_MARGIN, window.innerWidth - rect.width - WAVEFORM_CONTEXT_MENU_MARGIN)
  const maxY = Math.max(WAVEFORM_CONTEXT_MENU_MARGIN, window.innerHeight - rect.height - WAVEFORM_CONTEXT_MENU_MARGIN)
  return {
    x: Math.round(Math.max(WAVEFORM_CONTEXT_MENU_MARGIN, Math.min(maxX, point.x))),
    y: Math.round(Math.max(WAVEFORM_CONTEXT_MENU_MARGIN, Math.min(maxY, point.y))),
  }
}

function contextTargetRect(
  clientY: number,
  root: HTMLDivElement,
  overview: HTMLDivElement | null,
  zoomview: HTMLDivElement | null,
): { rect: DOMRect; fullTrack: boolean } {
  if (overview && typeof window !== 'undefined' && window.getComputedStyle(overview).display !== 'none') {
    const overviewRect = overview.getBoundingClientRect()
    if (clientY >= overviewRect.top && clientY <= overviewRect.bottom) {
      return { rect: overviewRect, fullTrack: true }
    }
  }
  if (zoomview) return { rect: zoomview.getBoundingClientRect(), fullTrack: false }
  return { rect: root.getBoundingClientRect(), fullTrack: false }
}

export function findCueMarkerNearClientX(
  markers: readonly VzCueMarker[],
  clientX: number,
  rect: Pick<DOMRect, 'left' | 'width'>,
  viewport: WaveformViewport,
  tolerancePx = WAVEFORM_CUE_HIT_TOLERANCE_PX,
): VzCueMarker | null {
  const spanSec = viewport.endSec - viewport.startSec
  if (rect.width <= 0 || spanSec <= 0 || !Number.isFinite(clientX)) return null

  let nearest: VzCueMarker | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const marker of markers) {
    if (!Number.isFinite(marker.time) || marker.time < viewport.startSec || marker.time > viewport.endSec) continue
    const markerX = rect.left + ((marker.time - viewport.startSec) / spanSec) * rect.width
    const distance = Math.abs(clientX - markerX)
    if (distance <= tolerancePx && distance < nearestDistance) {
      nearest = marker
      nearestDistance = distance
    }
  }
  return nearest
}

export function PeaksWaveformView({
  engine,
  cueMarkers,
  waveformZoom,
  rgbAnalysis,
  fallbackPeaks,
  followTimelineViewport = false,
  appearance = 'rgb',
  beatGrid = null,
  onCreateCuePoint,
  editableCueMarkerIds = [],
  onUpdateCuePoint,
  onDeleteCuePoint,
}: PeaksWaveformViewProps) {
  const waveformRootRef = useRef<HTMLDivElement>(null)
  const overviewRef = useRef<HTMLDivElement>(null)
  const zoomviewRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const peaksRef    = useRef<PeaksInstance | null>(null)
  const adapterRef  = useRef<PeaksAudioEngineAdapter | null>(null)
  const engineRef   = useRef<AudioEngine>(engine)
  engineRef.current = engine

  const cueMarkersRef     = useRef(cueMarkers)
  cueMarkersRef.current   = cueMarkers
  const waveformZoomRef   = useRef(waveformZoom)
  waveformZoomRef.current = waveformZoom
  const followTimelineViewportRef = useRef(followTimelineViewport)
  followTimelineViewportRef.current = followTimelineViewport

  // Generation counter — incremented on every destroyPeaks() to invalidate
  // any in-flight Peaks.init callback (handles StrictMode double-invoke + track change).
  const initGenRef   = useRef(0)
  const mountedRef   = useRef(true)

  const [peaksReady, setPeaksReady] = useState(false)
  const [peaksError, setPeaksError] = useState(false)
  const [contextMenu, setContextMenu] = useState<WaveformContextMenuState | null>(null)

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

    // Don't reinitialize an already-active instance for this track.
    // The cleanup effect guarantees peaksRef is null before the first init attempt
    // after a track change, so this only fires on spurious status-change re-runs.
    if (peaksRef.current) return

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
          autoScroll:          !followTimelineViewportRef.current,
          autoScrollOffset:    0,
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
        zoomLevels:    [128, 256, 512, 1024, 2048],
      },
      // Peaks.js calls (null, instance) on success despite the type saying Error
      (err, instance) => {
        if (!mountedRef.current || initGenRef.current !== gen) {
          instance?.destroy()
          return
        }
        if (err) {
          console.error('[PeaksWaveformView] Peaks.init failed:', err)
          instance?.destroy()
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
          const zoomview = instance.views.getView('zoomview')
          zoomview?.setZoom({ seconds: Math.max(1, dur / waveformZoomRef.current) })
          if (followTimelineViewportRef.current) {
            const currentTime = engineRef.current.getCurrentTime()
            zoomview?.setStartTime(
              computeWaveformViewport(dur, currentTime, waveformZoomRef.current).startSec,
            )
          }
        }

        adapter.notifyCanPlay()
      },
    )
  }, [destroyPeaks])

  // Derived flag: becomes true when the engine buffer for the current track is
  // available.  Used as an effect dep so Peaks retries if the buffer arrives
  // while currentAnalysisStatus hasn't changed (e.g. stays 'decoding').
  const currentTrackId = engine.currentTrack?.id ?? null
  const hasBuffer      = currentTrackId ? !!engine.getDecodedBuffer(currentTrackId) : false

  // ── Tear down immediately on track change to prevent the previous waveform ──
  // from remaining visible while the next buffer is being decoded.
  // Runs before the init effect on the same render, so initPeaks always starts
  // from a clean state and the fallback canvas shows as soon as track changes.
  useEffect(() => {
    destroyPeaks()
    setPeaksReady(false)
    setPeaksError(false)
    setContextMenu(null)
  }, [currentTrackId, destroyPeaks])

  // ── Init / reinit when the active track, status, or buffer availability changes ─
  useEffect(() => {
    if (appearance === 'deck') {
      destroyPeaks()
      setPeaksReady(false)
      setPeaksError(false)
      return
    }
    const status = engine.currentAnalysisStatus
    // Require status past 'queued' AND the buffer in the engine cache.
    // initPeaks() still guards internally against a missing buffer or duplicate init.
    if (currentTrackId && status !== 'queued' && hasBuffer) {
      initPeaks()
    }
  }, [appearance, currentTrackId, engine.currentAnalysisStatus, hasBuffer, initPeaks, destroyPeaks])

  // ── Keep Peaks informed of engine play-state changes ──────────────────────
  useEffect(() => {
    adapterRef.current?.notifyPlayState(engine.isPlaying)
  }, [engine.isPlaying])

  // ── Mirror waveformZoom → Peaks zoomview seconds window ───────────────────
  useEffect(() => {
    const peaks = peaksRef.current
    const dur   = engineRef.current.duration
    if (!peaks || dur <= 0) return
    const zoomview = peaks.views.getView('zoomview')
    zoomview?.setZoom({ seconds: Math.max(1, dur / waveformZoom) })
    if (followTimelineViewport) {
      zoomview?.setStartTime(
        computeWaveformViewport(dur, engineRef.current.getCurrentTime(), waveformZoom).startSec,
      )
    }
  }, [waveformZoom, followTimelineViewport])

  // Peaks' built-in auto-scroll positions the playhead by pixel threshold, while
  // Track Map follows a centered time viewport. In unified mode, explicitly lock
  // the Peaks zoom view to the shared viewport every frame so both surfaces show
  // the same start/end time and the playhead lands at the same horizontal ratio.
  useEffect(() => {
    if (!followTimelineViewport) return

    let rafId = 0
    let lastStartSec = Number.NaN
    const tick = () => {
      const peaks = peaksRef.current
      const eng   = engineRef.current
      const dur   = eng.duration
      if (peaks && dur > 0) {
        const startSec = computeWaveformViewport(
          dur,
          eng.getCurrentTime(),
          waveformZoomRef.current,
        ).startSec
        if (!Number.isFinite(lastStartSec) || Math.abs(startSec - lastStartSec) > 0.002) {
          peaks.views.getView('zoomview')?.setStartTime(startSec)
          lastStartSec = startSec
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [followTimelineViewport, currentTrackId])

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

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return
    const next = clampWaveformContextMenu(contextMenuRef.current, contextMenu)
    if (next.x === contextMenu.x && next.y === contextMenu.y) return
    setContextMenu(current => current ? { ...current, ...next } : current)
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu) return
    const closeOnPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('.vz-waveform-context-menu')) return
      setContextMenu(null)
    }
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('pointerdown', closeOnPointerDown)
    window.addEventListener('keydown', closeOnKeyDown)
    return () => {
      window.removeEventListener('pointerdown', closeOnPointerDown)
      window.removeEventListener('keydown', closeOnKeyDown)
    }
  }, [contextMenu])

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const root = waveformRootRef.current
    const duration = engineRef.current.duration
    const hasCueMenuActions = Boolean(onCreateCuePoint || onUpdateCuePoint || onDeleteCuePoint)
    if (!root || !hasCueMenuActions || duration <= 0 || !engineRef.current.currentTrack) return
    event.preventDefault()
    event.stopPropagation()

    const target = contextTargetRect(event.clientY, root, overviewRef.current, zoomviewRef.current)
    const activeZoomView = peaksRef.current?.views.getView('zoomview') as unknown as {
      getStartTime?: () => number
      getEndTime?: () => number
    } | null
    const peaksStartSec = activeZoomView?.getStartTime?.()
    const peaksEndSec = activeZoomView?.getEndTime?.()
    const viewport: WaveformViewport = target.fullTrack
      ? { startSec: 0, endSec: duration }
      : Number.isFinite(peaksStartSec) && Number.isFinite(peaksEndSec) && (peaksEndSec ?? 0) > (peaksStartSec ?? 0)
        ? { startSec: peaksStartSec ?? 0, endSec: peaksEndSec ?? duration }
        : computeWaveformViewport(duration, engineRef.current.getCurrentTime(), waveformZoomRef.current)
    const authoredTimeSec = waveformClientXToTime(event.clientX, target.rect, viewport, duration)
    const request = buildWaveformCueRequest(authoredTimeSec, beatGrid, false)
    const cueMarker = findCueMarkerNearClientX(cueMarkersRef.current, event.clientX, target.rect, viewport)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      authoredTimeSec,
      beat: request.beat,
      cueMarker,
      cueEditable: cueMarker ? editableCueMarkerIds.includes(cueMarker.id) : false,
    })
  }

  const createCue = (snapToBeat: boolean) => {
    if (!contextMenu || !onCreateCuePoint) return
    onCreateCuePoint(buildWaveformCueRequest(contextMenu.authoredTimeSec, beatGrid, snapToBeat))
    setContextMenu(null)
  }

  const jumpToCue = () => {
    if (!contextMenu?.cueMarker) return
    engineRef.current.seek(contextMenu.cueMarker.time)
    setContextMenu(null)
  }

  const updateContextCue = (snapToBeat: boolean) => {
    if (!contextMenu?.cueMarker || !contextMenu.cueEditable || !onUpdateCuePoint) return
    const request = buildWaveformCueRequest(contextMenu.authoredTimeSec, beatGrid, snapToBeat)
    onUpdateCuePoint(contextMenu.cueMarker.id, {
      time: request.timeSec,
      authoredTime: request.authoredTimeSec,
      beatIndex: request.beat?.beatIndex,
      barIndex: request.beat?.barIndex,
      beatInBar: request.beat?.beatInBar,
      beatTime: request.beat?.beatTimeSec,
      beatOffsetSec: request.beat?.offsetSec,
      snappedToBeat: request.snappedToBeat,
    })
    setContextMenu(null)
  }

  const renameContextCue = () => {
    if (!contextMenu?.cueMarker || !contextMenu.cueEditable || !onUpdateCuePoint || typeof window === 'undefined') return
    const nextLabel = window.prompt('Cue point name', contextMenu.cueMarker.label)?.trim()
    if (!nextLabel || nextLabel === contextMenu.cueMarker.label) return
    onUpdateCuePoint(contextMenu.cueMarker.id, { label: nextLabel.slice(0, 48) })
    setContextMenu(null)
  }

  const deleteContextCue = () => {
    if (!contextMenu?.cueMarker || !contextMenu.cueEditable || !onDeleteCuePoint) return
    onDeleteCuePoint(contextMenu.cueMarker.id)
    setContextMenu(null)
  }

  const contextMenuPortal = contextMenu && typeof document !== 'undefined' && createPortal((
    <div
      ref={contextMenuRef}
      className="rv-show-director-context-menu vz-waveform-context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y } as CSSProperties}
      role="menu"
      aria-label="Waveform cue point menu"
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="vz-waveform-context-menu__meta">
        <strong>{contextMenu.cueMarker?.label ?? formatWaveformCueTime(contextMenu.authoredTimeSec)}</strong>
        <span>
          {contextMenu.cueMarker
            ? `${formatWaveformCueTime(contextMenu.cueMarker.time)} · ${formatCueBeatReference(contextMenu.beat) ?? 'No beat grid available'}`
            : formatCueBeatReference(contextMenu.beat) ?? 'No beat grid available'}
        </span>
        {contextMenu.cueMarker && (
          <em>{contextMenu.cueEditable ? 'Editable cue point' : `${contextMenu.cueMarker.source ?? 'Imported'} cue · read only`}</em>
        )}
      </div>
      <span className="rv-show-director-context-menu__divider" role="separator" />
      {contextMenu.cueMarker && (
        <>
          <button type="button" role="menuitem" onClick={jumpToCue}>Jump to Cue</button>
          {contextMenu.cueEditable && onUpdateCuePoint && (
            <>
              <button type="button" role="menuitem" onClick={renameContextCue}>Rename Cue…</button>
              <button type="button" role="menuitem" onClick={() => updateContextCue(false)}>Move Cue Here</button>
              <button type="button" role="menuitem" disabled={!contextMenu.beat} onClick={() => updateContextCue(true)}>Snap Cue to Nearest Beat</button>
            </>
          )}
          {contextMenu.cueEditable && onDeleteCuePoint && (
            <button
              type="button"
              role="menuitem"
              className="rv-show-director-context-menu__danger"
              onClick={deleteContextCue}
            >
              Delete Cue Point
            </button>
          )}
          {onCreateCuePoint && <span className="rv-show-director-context-menu__divider" role="separator" />}
        </>
      )}
      {onCreateCuePoint && (
        <>
          <button type="button" role="menuitem" onClick={() => createCue(false)}>
            {contextMenu.cueMarker ? 'Set New Cue Point Here' : 'Set Cue Point Here'}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!contextMenu.beat}
            onClick={() => createCue(true)}
          >
            {contextMenu.cueMarker ? 'Set New Cue on Nearest Beat' : 'Set Cue on Nearest Beat'}
          </button>
        </>
      )}
    </div>
  ), document.body)

  if (appearance === 'deck') {
    return (
      <>
        <div
          ref={waveformRootRef}
          className="vz-peaks-wrap vz-peaks-wrap--deck"
          onContextMenu={handleContextMenu}
        >
          <RgbWaveformCanvas
            analysis={rgbAnalysis}
            fallbackPeaks={fallbackPeaks}
            duration={engine.duration}
            currentTime={engine.currentTime}
            markers={cueMarkers}
            onSeek={engine.currentTrack ? engine.seek : undefined}
            zoom={waveformZoom}
            monochrome
          />
        </div>
        {contextMenuPortal}
      </>
    )
  }

  return (
    <>
      <div
        ref={waveformRootRef}
        className={`vz-peaks-wrap${followTimelineViewport ? ' vz-peaks-wrap--unified' : ''}`}
        onContextMenu={handleContextMenu}
      >
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
      {contextMenuPortal}
    </>
  )
}
