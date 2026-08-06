import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  type RefObject,
} from 'react'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { RgbWaveformAnalysis } from '../../../../features/waveform/rgbWaveformTypes'
import { useSharedAudio } from '../../../../context/AudioEngineContext'
import {
  drawTrackTimelineCanvas,
  formatTime,
  type PaletteKey,
  type TrackTimelineCanvasSpec,
  type TrackTimelineHitRegion,
} from './trackTimelineCanvas'
import {
  buildTrackTimelineModel,
  TRACK_TIMELINE_BAR_METRICS,
  type TrackTimelineEvent,
  type TrackTimelineModel,
  type TrackTimelinePoint,
} from './trackTimelineModel'
import { TrackTimelineIcon } from './TrackTimelineIcon'
import { MusicIntelligenceDiagnosticsPanel } from '../../modulation/MusicIntelligenceDiagnosticsPanel'
import {
  clampTrackTimelinePlayheadTime,
  resolveTrackTimelinePlayheadRatio,
} from './trackTimelinePlayhead'
import {
  createTrackTimelineViewport,
  estimateTrackTimelineBarDuration,
  moveTrackTimelineViewport,
  normalizeTrackTimelineViewport,
  resolveTrackTimelineViewportRatio,
  zoomTrackTimelineViewport,
  TRACK_TIMELINE_ZOOM_PRESETS,
  type TrackTimelineViewport,
  type TrackTimelineZoomPreset,
} from './trackTimelineViewport'
import './trackTimeline.css'

interface TrackTimelineVisualizerProps {
  analysis: TrackIntelligenceAnalysis
  rgbWaveform: RgbWaveformAnalysis
  filename: string
  channels?: number | null
}

interface RowDefinition {
  label: string
  height: number
  count: number
  spec: TrackTimelineCanvasSpec
}

interface GroupDefinition {
  id: string
  title: string
  summary: string
  defaultCollapsed: boolean
  rows: RowDefinition[]
}

const PREFERRED_EVENT_ORDER = [
  'track_start',
  'track_end',
  'beat',
  'downbeat',
  'bar_start',
  '4_bar_block_start',
  '8_bar_block_start',
  '16_bar_block_start',
  '32_bar_block_start',
  'phrase_boundary',
  'section_start',
  'section_end',
  'section_entry',
  'section_exit',
  'build_start',
  'pre_drop_start',
  'drop_impact',
  'major_impact',
  'breakdown_entry',
  'energy_release',
  'fakeout_candidate',
  'silence_or_stop',
  'selected_boundary',
  'boundary_candidate',
  'alternative_boundary',
  'ranked_boundary_alternative',
  'global_maximum',
  'global_minimum',
  'local_peak',
  'top_bar',
  'rgb_bin_peak',
]

function groupByType(events: TrackTimelineEvent[]): Record<string, TrackTimelineEvent[]> {
  return events.reduce<Record<string, TrackTimelineEvent[]>>((groups, item) => {
    const group = groups[item.type] ?? []
    group.push(item)
    groups[item.type] = group
    return groups
  }, {})
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

function timelineColorForType(type: string): PaletteKey {
  if (type.includes('drop') || type === 'track_end') return 'red'
  if (type.includes('boundary')) return type === 'selected_boundary' ? 'cyan' : type.includes('alternative') ? 'purple' : 'slate'
  if (type.includes('section')) return 'green'
  if (type.includes('bar') || type.includes('phrase')) return 'teal'
  if (type.includes('maximum') || type.includes('peak') || type.includes('impact')) return 'magenta'
  if (type.includes('minimum')) return 'cyan'
  return 'slate'
}

function curvePoints(model: TrackTimelineModel, key: string): TrackTimelinePoint[] {
  return model.curves[key] ?? []
}

function buildGroups(model: TrackTimelineModel): GroupDefinition[] {
  const energyRows: RowDefinition[] = [
    ['Instant Energy', 'energyCurves.instant', 'cyan'],
    ['Short-Term Energy', 'energyCurves.shortTerm', 'teal'],
    ['Low-Frequency Energy', 'energyCurves.bass', 'orange'],
    ['Dynamic Range', 'barFeatures.dynamicRange', 'yellow'],
    ['Mid Energy', 'energyCurves.mid', 'magenta'],
    ['High Energy', 'energyCurves.high', 'purple'],
  ].flatMap(([label, key, color]) => {
    const points = curvePoints(model, key)
    return points.length ? [{
      label,
      height: 72,
      count: points.length,
      spec: { kind: 'line', points, color: color as PaletteKey, curveName: key, fill: true },
    }] : []
  })

  const harmonicRows: RowDefinition[] = [
    ['Pitch Curve', 'harmonic.pitchCurve', 'purple'],
    ['Melody Contour', 'harmonic.melodyContourCurve', 'magenta'],
    ['Harmonic Change', 'barFeatures.harmonicChange', 'yellow'],
  ].flatMap(([label, key, color]) => {
    const points = curvePoints(model, key)
    return points.length ? [{
      label,
      height: 72,
      count: points.length,
      spec: { kind: 'line', points, color: color as PaletteKey, curveName: key, fill: false },
    }] : []
  })

  const frequencyRows: RowDefinition[] = model.waveform.length ? [
    ['Low-Frequency Energy', 'low', 'orange'],
    ['Mid-Frequency Energy', 'mid', 'cyan'],
    ['High-Frequency Energy', 'high', 'magenta'],
    ['RMS Loudness', 'rms', 'teal'],
  ].map(([label, metric, color]) => ({
    label,
    height: 48,
    count: model.waveform.length,
    spec: {
      kind: 'heat' as const,
      points: model.waveform.map(bin => ({ time: bin.center, value: bin[metric as 'low' | 'mid' | 'high' | 'rms'] })),
      color: color as PaletteKey,
      metric,
    },
  })) : []

  const semanticByType = groupByType(model.semanticMoments)
  const semanticRows = Object.keys(semanticByType).sort().map(type => ({
    label: titleCase(type),
    height: 46,
    count: semanticByType[type]!.length,
    spec: {
      kind: 'events' as const,
      events: semanticByType[type]!,
      eventType: type,
      color: timelineColorForType(type),
    },
  }))

  const timelineByType = groupByType(model.timelineEvents)
  const timelineTypes = Object.keys(timelineByType).sort((a, b) => {
    const ai = PREFERRED_EVENT_ORDER.indexOf(a)
    const bi = PREFERRED_EVENT_ORDER.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b)
  })
  const timelineRows = timelineTypes.map(type => ({
    label: titleCase(type),
    height: 44,
    count: timelineByType[type]!.length,
    spec: {
      kind: 'events' as const,
      events: timelineByType[type]!,
      eventType: type,
      color: timelineColorForType(type),
    },
  }))

  const extremaRows: RowDefinition[] = []
  Object.entries(model.curves).forEach(([name, points]) => {
    if (!points.length || name.startsWith('barFeatures.')) return
    extremaRows.push({
      label: titleCase(name.replace(/^.*\./, '')),
      height: 56,
      count: points.length,
      spec: {
        kind: 'extrema',
        points,
        color: name.startsWith('energyCurves.') ? 'cyan' : name.startsWith('harmonic.') ? 'purple' : 'yellow',
        metric: name,
        style: 'line',
      },
    })
  })

  const waveformExtrema = [
    ['Positive Peaks', 'positive', 'teal'],
    ['Negative Peaks', 'negative', 'red'],
    ['RMS', 'rms', 'cyan'],
    ['Low Energy', 'low', 'orange'],
    ['Mid Energy', 'mid', 'cyan'],
    ['High Energy', 'high', 'magenta'],
  ] as const
  waveformExtrema.forEach(([label, metric, color]) => {
    if (!model.waveform.length) return
    extremaRows.push({
      label,
      height: 54,
      count: model.waveform.length,
      spec: {
        kind: 'extrema',
        points: model.waveform.map(bin => ({ time: bin.center, value: bin[metric] })),
        color,
        metric: `rgbWaveform.${metric}`,
        style: 'heat',
      },
    })
  })

  TRACK_TIMELINE_BAR_METRICS.forEach(metric => {
    const points = curvePoints(model, `barFeatures.${metric}`)
    if (!points.length) return
    extremaRows.push({
      label: titleCase(metric),
      height: 54,
      count: points.length,
      spec: {
        kind: 'extrema',
        points,
        color: 'yellow',
        metric: `barFeatures.${metric}`,
        style: 'heat',
      },
    })
  })

  return [
    { id: 'energy', title: 'Energy', summary: 'Continuous timestamped energy curves', rows: energyRows, defaultCollapsed: false },
    { id: 'harmonic', title: 'Harmonic', summary: 'Pitch, melody contour, and bar-level harmonic change', rows: harmonicRows, defaultCollapsed: false },
    { id: 'frequency', title: 'Frequency Bands', summary: 'RGB-waveform frequency energy rendered as heat bars', rows: frequencyRows, defaultCollapsed: false },
    { id: 'events', title: 'Events', summary: 'Semantic moments positioned at their exact track times', rows: semanticRows, defaultCollapsed: false },
    { id: 'timeline', title: 'Timeline', summary: 'Unified event types aligned to the master beat grid', rows: timelineRows, defaultCollapsed: true },
    { id: 'extrema', title: 'Extrema', summary: 'Derived minimum and maximum landmarks', rows: extremaRows, defaultCollapsed: true },
  ]
}

function TrackTimelineCanvas({ model, spec, height }: {
  model: TrackTimelineModel
  spec: TrackTimelineCanvasSpec
  height: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hitsRef = useRef<TrackTimelineHitRegion[]>([])
  const tooltipRef = useRef<HTMLDivElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    hitsRef.current = drawTrackTimelineCanvas(canvas, spec, model, height)
  }, [height, model, spec])

  useLayoutEffect(() => {
    draw()
    const canvas = canvasRef.current
    if (!canvas) return
    const resizeObserver = new ResizeObserver(() => draw())
    resizeObserver.observe(canvas)
    return () => resizeObserver.disconnect()
  }, [draw])

  const handleMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const tooltip = tooltipRef.current
    if (!canvas || !tooltip) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const hit = hitsRef.current.slice().reverse().find(region => (
      x >= region.x1 && x <= region.x2 && y >= region.y1 && y <= region.y2
    ))
    if (!hit) {
      tooltip.hidden = true
      return
    }
    tooltip.textContent = hit.text
    tooltip.hidden = false
    const left = Math.max(8, Math.min(window.innerWidth - tooltip.offsetWidth - 8, event.clientX + 12))
    const top = Math.max(8, Math.min(window.innerHeight - tooltip.offsetHeight - 8, event.clientY + 12))
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${top}px`
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="ttv-canvas"
        style={{ height }}
        onMouseMove={handleMove}
        onMouseLeave={() => {
          if (tooltipRef.current) tooltipRef.current.hidden = true
        }}
      />
      <div ref={tooltipRef} className="ttv-tooltip" role="status" hidden />
    </>
  )
}

type PlayheadScope = 'overview' | 'detail'

function TimelineRow({
  model,
  label,
  count,
  height,
  spec,
  viewport,
  playheadScope = 'detail',
  playheadAnchor = false,
  stickyLabel = false,
  nested = false,
}: RowDefinition & {
  model: TrackTimelineModel
  viewport?: TrackTimelineViewport
  playheadScope?: PlayheadScope
  playheadAnchor?: boolean
  stickyLabel?: boolean
  nested?: boolean
}) {
  const rangedSpec = useMemo<TrackTimelineCanvasSpec>(() => (
    viewport ? { ...spec, viewport } as TrackTimelineCanvasSpec : spec
  ), [spec, viewport])

  return (
    <div className="ttv-timeline-row">
      <div className={`ttv-row-label${stickyLabel ? ' ttv-row-label--sticky' : ''}${nested ? ' ttv-row-label--nested' : ''}`} title={label}>
        <span className="ttv-label-text">{label}</span>
        {nested && <span className="ttv-row-info" aria-hidden="true">i</span>}
        {count > 0 && <small>{count.toLocaleString()}</small>}
      </div>
      <div className={`ttv-canvas-wrap ttv-canvas-wrap--${playheadScope}${playheadAnchor ? ' ttv-canvas-wrap--playhead-anchor' : ''}`}>
        <TrackTimelineCanvas model={model} spec={rangedSpec} height={height} />
      </div>
    </div>
  )
}

function OverviewTimelineRow({
  model,
  height,
  spec,
  playheadAnchor = false,
}: {
  model: TrackTimelineModel
  height: number
  spec: TrackTimelineCanvasSpec
  playheadAnchor?: boolean
}) {
  return (
    <div className="ttv-overview-row">
      <div className={`ttv-canvas-wrap ttv-canvas-wrap--overview${playheadAnchor ? ' ttv-canvas-wrap--playhead-anchor' : ''}`}>
        <TrackTimelineCanvas model={model} spec={spec} height={height} />
      </div>
    </div>
  )
}

function DetailRuler({ model, viewport }: {
  model: TrackTimelineModel
  viewport: TrackTimelineViewport
}) {
  return (
    <div className="ttv-detail-ruler-row">
      <div className="ttv-detail-ruler-label" aria-hidden="true">
        <span>BARS</span>
        <span>BEATS</span>
      </div>
      <div className="ttv-canvas-wrap">
        <TrackTimelineCanvas
          model={model}
          spec={{ kind: 'detailRuler', viewport }}
          height={58}
        />
      </div>
    </div>
  )
}

type RailIconName = 'timeline' | 'detail' | 'expand' | 'collapse' | 'center' | 'settings'

function RailIcon({ name }: { name: RailIconName }) {
  if (name === 'timeline') return <TrackTimelineIcon />
  if (name === 'detail') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4v16M12 4v16M19 4v16M3 8h4M10 15h4M17 10h4" />
        <circle cx="5" cy="8" r="1.6" /><circle cx="12" cy="15" r="1.6" /><circle cx="19" cy="10" r="1.6" />
      </svg>
    )
  }
  if (name === 'expand' || name === 'collapse') {
    const inward = name === 'collapse'
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={inward ? 'M8 4v5H3M16 4v5h5M8 20v-5H3M16 20v-5h5' : 'M3 9h5V4M21 9h-5V4M3 15h5v5M21 15h-5v5'} />
      </svg>
    )
  }
  if (name === 'center') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <circle cx="12" cy="12" r="4.5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" />
    </svg>
  )
}

function TrackTimelineRail({
  onOverview,
  onDetail,
  onExpand,
  onCollapse,
  onCenter,
  onSettings,
}: {
  onOverview: () => void
  onDetail: () => void
  onExpand: () => void
  onCollapse: () => void
  onCenter: () => void
  onSettings: () => void
}) {
  const actions: Array<{ name: RailIconName; label: string; onClick: () => void; active?: boolean }> = [
    { name: 'timeline', label: 'Overview', onClick: onOverview, active: true },
    { name: 'detail', label: 'Detail view', onClick: onDetail },
    { name: 'expand', label: 'Expand all groups', onClick: onExpand },
    { name: 'collapse', label: 'Collapse all groups', onClick: onCollapse },
    { name: 'center', label: 'Center detail on playhead', onClick: onCenter },
  ]

  return (
    <nav className="ttv-tool-rail" aria-label="Track timeline navigation">
      <div className="ttv-tool-rail-main">
        {actions.map(action => (
          <button
            key={action.name}
            type="button"
            className={`ttv-rail-btn${action.active ? ' ttv-rail-btn--active' : ''}`}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            <RailIcon name={action.name} />
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ttv-rail-btn"
        onClick={onSettings}
        aria-label="Analysis settings and track information"
        title="Analysis settings and track information"
      >
        <RailIcon name="settings" />
      </button>
    </nav>
  )
}

function TrackTimelinePlayheadController({
  appShellRef,
  playheadTimeRef,
  durationSec,
  viewport,
}: {
  appShellRef: RefObject<HTMLDivElement>
  playheadTimeRef: RefObject<HTMLSpanElement>
  durationSec: number
  viewport: TrackTimelineViewport
}) {
  const engine = useSharedAudio()
  const engineRef = useRef(engine)
  engineRef.current = engine

  useEffect(() => {
    let animationFrame = 0
    let lastRenderedTime = Number.NaN

    const updatePlayhead = () => {
      const appShell = appShellRef.current
      if (appShell && durationSec > 0) {
        const currentTimeSec = clampTrackTimelinePlayheadTime(
          engineRef.current.getCurrentTime(),
          durationSec,
        )
        const overviewRatio = resolveTrackTimelinePlayheadRatio(currentTimeSec, durationSec)
        const detailRatio = resolveTrackTimelineViewportRatio(currentTimeSec, viewport)
        appShell.style.setProperty('--ttv-overview-playhead-ratio', String(overviewRatio))
        appShell.style.setProperty('--ttv-detail-playhead-ratio', String(detailRatio ?? 0))
        appShell.dataset.overviewPlayheadVisible = 'true'
        appShell.dataset.detailPlayheadVisible = detailRatio === null ? 'false' : 'true'

        if (playheadTimeRef.current && (
          !Number.isFinite(lastRenderedTime) || Math.abs(currentTimeSec - lastRenderedTime) >= 0.025
        )) {
          playheadTimeRef.current.textContent = `${formatTime(currentTimeSec)} / ${formatTime(durationSec)}`
          lastRenderedTime = currentTimeSec
        }
      }
      animationFrame = requestAnimationFrame(updatePlayhead)
    }

    animationFrame = requestAnimationFrame(updatePlayhead)
    return () => cancelAnimationFrame(animationFrame)
  }, [appShellRef, durationSec, playheadTimeRef, viewport])

  return null
}

interface OverviewDragState {
  pointerId: number
  mode: 'move' | 'start' | 'end'
  anchorTimeSec: number
  initialViewport: TrackTimelineViewport
}

function OverviewViewportNavigator({
  viewport,
  durationSec,
  minimumDurationSec,
  label,
  onChange,
}: {
  viewport: TrackTimelineViewport
  durationSec: number
  minimumDurationSec: number
  label: string
  onChange: (viewport: TrackTimelineViewport) => void
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<OverviewDragState | null>(null)
  const duration = Math.max(0.001, durationSec)
  const left = (viewport.startSec / duration) * 100
  const width = ((viewport.endSec - viewport.startSec) / duration) * 100

  const pointerTime = useCallback((clientX: number) => {
    const layer = layerRef.current
    if (!layer) return 0
    const rect = layer.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)))
    return ratio * durationSec
  }, [durationSec])

  const beginDrag = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    mode: OverviewDragState['mode'],
    initialViewport = viewport,
  ) => {
    if (durationSec <= 0) return
    event.preventDefault()
    event.stopPropagation()
    layerRef.current?.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      mode,
      anchorTimeSec: pointerTime(event.clientX),
      initialViewport,
    }
  }, [durationSec, pointerTime, viewport])

  const handleLayerPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || durationSec <= 0) return
    const centerSec = pointerTime(event.clientX)
    const nextViewport = moveTrackTimelineViewport(
      viewport,
      centerSec - (viewport.endSec - viewport.startSec) / 2,
      durationSec,
    )
    onChange(nextViewport)
    beginDrag(event, 'move', nextViewport)
  }, [beginDrag, durationSec, onChange, pointerTime, viewport])

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (durationSec <= 0 || event.deltaY === 0) return
    event.preventDefault()
    const centerSec = pointerTime(event.clientX)
    const factor = Math.pow(1.0015, event.deltaY)
    onChange(zoomTrackTimelineViewport(viewport, durationSec, factor, centerSec, minimumDurationSec))
  }, [durationSec, minimumDurationSec, onChange, pointerTime, viewport])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaSec = pointerTime(event.clientX) - drag.anchorTimeSec
    let nextViewport: TrackTimelineViewport

    if (drag.mode === 'move') {
      nextViewport = moveTrackTimelineViewport(
        drag.initialViewport,
        drag.initialViewport.startSec + deltaSec,
        durationSec,
      )
    } else if (drag.mode === 'start') {
      nextViewport = {
        startSec: Math.max(0, Math.min(
          drag.initialViewport.startSec + deltaSec,
          drag.initialViewport.endSec - minimumDurationSec,
        )),
        endSec: drag.initialViewport.endSec,
      }
    } else {
      nextViewport = {
        startSec: drag.initialViewport.startSec,
        endSec: Math.min(durationSec, Math.max(
          drag.initialViewport.startSec + minimumDurationSec,
          drag.initialViewport.endSec + deltaSec,
        )),
      }
    }

    onChange(nextViewport)
  }, [durationSec, minimumDurationSec, onChange, pointerTime])

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (layerRef.current?.hasPointerCapture(event.pointerId)) {
      layerRef.current.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const viewportDuration = viewport.endSec - viewport.startSec
    const step = Math.max(minimumDurationSec / 4, viewportDuration * 0.1)
    let nextStart: number | null = null
    if (event.key === 'ArrowLeft') nextStart = viewport.startSec - step
    if (event.key === 'ArrowRight') nextStart = viewport.startSec + step
    if (event.key === 'Home') nextStart = 0
    if (event.key === 'End') nextStart = durationSec - viewportDuration
    if (nextStart === null) return
    event.preventDefault()
    onChange(moveTrackTimelineViewport(viewport, nextStart, durationSec))
  }, [durationSec, minimumDurationSec, onChange, viewport])

  return (
    <div
      ref={layerRef}
      className="ttv-overview-viewport-layer"
      onPointerDown={handleLayerPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={handleWheel}
    >
      <div
        className="ttv-overview-viewport"
        style={{ left: `${left}%`, width: `${width}%` }}
        role="slider"
        tabIndex={0}
        aria-label={`Zoomed detail range, ${formatTime(viewport.startSec)} to ${formatTime(viewport.endSec)}`}
        aria-valuemin={0}
        aria-valuemax={Math.round(durationSec * 1000)}
        aria-valuenow={Math.round(viewport.startSec * 1000)}
        onKeyDown={handleKeyDown}
        onPointerDown={event => beginDrag(event, 'move')}
      >
        <button
          type="button"
          className="ttv-viewport-handle ttv-viewport-handle--start"
          aria-label="Resize detail range start"
          onPointerDown={event => beginDrag(event, 'start')}
        />
        <span className="ttv-viewport-label">{label}</span>
        <button
          type="button"
          className="ttv-viewport-handle ttv-viewport-handle--end"
          aria-label="Resize detail range end"
          onPointerDown={event => beginDrag(event, 'end')}
        />
      </div>
    </div>
  )
}

function TimelineGroup({ group, model, collapsed, viewport, onToggle }: {
  group: GroupDefinition
  model: TrackTimelineModel
  collapsed: boolean
  viewport: TrackTimelineViewport
  onToggle: () => void
}) {
  return (
    <section className={`ttv-group${collapsed ? ' ttv-group--collapsed' : ''}`}>
      <button
        type="button"
        className="ttv-group-header"
        aria-expanded={!collapsed}
        title={group.summary}
        onClick={onToggle}
      >
        <span className="ttv-group-title">
          <span className="ttv-chevron">⌄</span>
          <span>{group.title}</span>
          <span className="ttv-group-toggle-mark" aria-hidden="true">{collapsed ? '+' : '−'}</span>
        </span>
        <span className="ttv-group-track" aria-hidden="true" />
      </button>
      {!collapsed && (
        <div className="ttv-group-content">
          {group.rows.length > 0
            ? group.rows.map(row => (
              <TimelineRow
                key={`${group.id}:${row.label}`}
                {...row}
                model={model}
                viewport={viewport}
                playheadScope="detail"
                nested
              />
            ))
            : <div className="ttv-empty-row">No compatible data was found for this group.</div>}
        </div>
      )}
    </section>
  )
}

function zoomPresetLabel(preset: TrackTimelineZoomPreset): string {
  return preset === 'full' ? 'FULL TRACK' : `${preset} BARS`
}

export function TrackTimelineVisualizer(props: TrackTimelineVisualizerProps) {
  const appShellRef = useRef<HTMLDivElement>(null)
  const overviewRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const playheadTimeRef = useRef<HTMLSpanElement>(null)
  const engine = useSharedAudio()
  const engineRef = useRef(engine)
  engineRef.current = engine
  const model = useMemo(() => buildTrackTimelineModel(props), [
    props.analysis,
    props.channels,
    props.filename,
    props.rgbWaveform,
  ])
  const groups = useMemo(() => buildGroups(model), [model])
  const barDuration = useMemo(() => estimateTrackTimelineBarDuration(
    model.bars,
    model.meta.bpm,
    model.meta.timeSignature,
  ), [model.bars, model.meta.bpm, model.meta.timeSignature])
  const minimumViewportDuration = Math.min(model.durationSec || 1, Math.max(1, barDuration * 4))
  const [activeZoom, setActiveZoom] = useState<TrackTimelineZoomPreset | 'custom'>(32)
  const [analysisPanelOpen, setAnalysisPanelOpen] = useState(false)
  const [viewport, setViewport] = useState<TrackTimelineViewport>(() => createTrackTimelineViewport(
    model.durationSec,
    model.bars,
    model.meta.bpm,
    model.meta.timeSignature,
    32,
    0,
  ))
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => Object.fromEntries(
    groups.map(group => [group.id, group.defaultCollapsed]),
  ))

  useEffect(() => {
    const currentTime = clampTrackTimelinePlayheadTime(engineRef.current.getCurrentTime(), model.durationSec)
    setActiveZoom(32)
    setViewport(createTrackTimelineViewport(
      model.durationSec,
      model.bars,
      model.meta.bpm,
      model.meta.timeSignature,
      32,
      currentTime,
    ))
  }, [model.bars, model.durationSec, model.meta.bpm, model.meta.filename, model.meta.timeSignature])

  useEffect(() => {
    setCollapsed(current => Object.fromEntries(groups.map(group => [
      group.id,
      current[group.id] ?? group.defaultCollapsed,
    ])))
  }, [groups])

  const setAllCollapsed = useCallback((value: boolean) => {
    setCollapsed(Object.fromEntries(groups.map(group => [group.id, value])))
  }, [groups])

  const applyZoomPreset = useCallback((preset: TrackTimelineZoomPreset) => {
    const currentTime = clampTrackTimelinePlayheadTime(engineRef.current.getCurrentTime(), model.durationSec)
    setActiveZoom(preset)
    setViewport(createTrackTimelineViewport(
      model.durationSec,
      model.bars,
      model.meta.bpm,
      model.meta.timeSignature,
      preset,
      currentTime,
    ))
  }, [model.bars, model.durationSec, model.meta.bpm, model.meta.timeSignature])

  const updateViewport = useCallback((nextViewport: TrackTimelineViewport) => {
    setActiveZoom('custom')
    setViewport(normalizeTrackTimelineViewport(nextViewport, model.durationSec, minimumViewportDuration))
  }, [minimumViewportDuration, model.durationSec])

  const centerDetailOnPlayhead = useCallback(() => {
    const currentTime = clampTrackTimelinePlayheadTime(engineRef.current.getCurrentTime(), model.durationSec)
    const width = viewport.endSec - viewport.startSec
    setViewport(moveTrackTimelineViewport(viewport, currentTime - width / 2, model.durationSec))
  }, [model.durationSec, viewport])

  const visibleBars = useMemo(() => model.bars.filter(bar => (
    bar.end > viewport.startSec && bar.start < viewport.endSec
  )).length, [model.bars, viewport])

  const viewportLabel = activeZoom === 'custom'
    ? `VIEWPORT · ${visibleBars || 'CUSTOM'}${visibleBars ? ' BARS' : ''}`
    : `VIEWPORT · ${zoomPresetLabel(activeZoom)}`

  const metaValues = [
    formatTime(model.durationSec),
    model.meta.bpm ? `${Math.round(model.meta.bpm)} BPM` : null,
    model.meta.timeSignature ? `${model.meta.timeSignature}/4` : null,
    model.meta.dominantKey || null,
    `${model.beats.length} beats`,
    `${model.sections.length} sections`,
    model.meta.sampleRate ? `${Math.round(model.meta.sampleRate).toLocaleString()} Hz` : null,
  ].filter((value): value is string => Boolean(value))

  const downbeatAvailable = model.beats.some(beat => beat.isDownbeat)
  const analysisStatusText = downbeatAvailable
    ? (model.warnings[0] ?? 'Analysis ready')
    : 'Downbeat unavailable'
  const analysisHasWarning = !downbeatAvailable || model.warnings.length > 0

  const scrollToOverview = useCallback(() => {
    overviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const scrollToDetail = useCallback(() => {
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div
      ref={appShellRef}
      className="ttv-app-shell az-root rv-shell"
      data-overview-playhead-visible="false"
      data-detail-playhead-visible="false"
    >
      <TrackTimelinePlayheadController
        appShellRef={appShellRef}
        playheadTimeRef={playheadTimeRef}
        durationSec={model.durationSec}
        viewport={viewport}
      />

      <div className="ttv-body">
        <TrackTimelineRail
          onOverview={scrollToOverview}
          onDetail={scrollToDetail}
          onExpand={() => setAllCollapsed(false)}
          onCollapse={() => setAllCollapsed(true)}
          onCenter={centerDetailOnPlayhead}
          onSettings={() => setAnalysisPanelOpen(value => !value)}
        />

        <section className="ttv-visualization-shell">
          <div className="ttv-scroll-region">
            <div ref={overviewRef} className="ttv-sticky-timeline">
              <div className="ttv-overview-heading">
                <div className="ttv-overview-copy">
                  <span>OVERVIEW</span>
                  <small>Drag the cyan viewport or its handles to change the detail range.</small>
                </div>
                <div className="ttv-overview-actions">
                  <button
                    type="button"
                    className={`ttv-analysis-status${analysisHasWarning ? ' ttv-analysis-status--warning' : ''}`}
                    onClick={() => setAnalysisPanelOpen(value => !value)}
                    title={model.warnings.length ? model.warnings.join('\n') : analysisStatusText}
                  >
                    <span className="ttv-analysis-status-label">Analysis Status</span>
                    <span className="ttv-analysis-status-value">
                      {analysisHasWarning && <span className="ttv-warning-icon" aria-hidden="true">△</span>}
                      {analysisStatusText}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ttv-icon-btn"
                    onClick={() => setAnalysisPanelOpen(value => !value)}
                    aria-label="Open analysis settings"
                    title="Open analysis settings"
                  >
                    <RailIcon name="settings" />
                  </button>
                  <details className="ttv-overflow-menu">
                    <summary className="ttv-icon-btn" aria-label="Open track information menu" title="Track information">•••</summary>
                    <div className="ttv-overflow-popover ttv-overflow-popover--overview">
                      <strong title={model.meta.filename}>{model.meta.filename}</strong>
                      <div className="ttv-info-rail-pills">
                        {metaValues.map(value => <span key={value} className="ttv-meta-pill">{value}</span>)}
                      </div>
                      {model.warnings.length > 0 && (
                        <div className="ttv-menu-warning">{model.warnings.slice(0, 3).join(' ')}</div>
                      )}
                    </div>
                  </details>
                </div>
              </div>

              <div className="ttv-overview-stack">
                <OverviewTimelineRow
                  model={model}
                  height={86}
                  spec={{ kind: 'beatGrid' }}
                  playheadAnchor
                />
                <OverviewTimelineRow
                  model={model}
                  height={44}
                  spec={{ kind: 'sections', sections: model.sections }}
                />
                <OverviewTimelineRow
                  model={model}
                  height={72}
                  spec={{ kind: 'waveform' }}
                />
                <OverviewViewportNavigator
                  viewport={viewport}
                  durationSec={model.durationSec}
                  minimumDurationSec={minimumViewportDuration}
                  label={viewportLabel}
                  onChange={updateViewport}
                />
              </div>
            </div>

            <main className="ttv-content-area">
              <section ref={detailRef} className="ttv-detail-workspace">
                <header className="ttv-detail-header">
                  <div className="ttv-detail-heading-copy">
                    <span className="ttv-detail-kicker">DETAIL VIEW (ZOOMED)</span>
                    <strong>{formatTime(viewport.startSec)} → {formatTime(viewport.endSec)}</strong>
                    <small>{visibleBars || 'Custom'}{visibleBars ? ' bars' : ' range'}</small>
                    <small>{(viewport.endSec - viewport.startSec).toFixed(2)} seconds</small>
                  </div>
                  <div className="ttv-detail-header-actions">
                    <div className="ttv-toolbar-actions">
                      <button type="button" className="ttv-toolbar-btn" onClick={() => setAllCollapsed(false)}>Expand all</button>
                      <button type="button" className="ttv-toolbar-btn" onClick={() => setAllCollapsed(true)}>Collapse all</button>
                    </div>
                    <button type="button" className="ttv-center-playhead-btn" onClick={centerDetailOnPlayhead}>
                      Center on playhead
                    </button>
                    <details className="ttv-overflow-menu ttv-overflow-menu--detail">
                      <summary className="ttv-icon-btn" aria-label="Open detail range menu" title="Detail range">•••</summary>
                      <div className="ttv-overflow-popover ttv-overflow-popover--detail">
                        <span className="ttv-menu-label">Detail range</span>
                        <div className="ttv-zoom-controls" role="group" aria-label="Detail zoom range">
                          {TRACK_TIMELINE_ZOOM_PRESETS.map(preset => (
                            <button
                              key={preset}
                              type="button"
                              className={`ttv-zoom-btn${activeZoom === preset ? ' ttv-zoom-btn--active' : ''}`}
                              aria-pressed={activeZoom === preset}
                              onClick={() => applyZoomPreset(preset)}
                            >
                              {zoomPresetLabel(preset)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>
                </header>

                <DetailRuler model={model} viewport={viewport} />
                <div className="ttv-detail-playhead-line" aria-hidden="true" />

                {groups.map(group => (
                  <TimelineGroup
                    key={group.id}
                    group={group}
                    model={model}
                    viewport={viewport}
                    collapsed={collapsed[group.id] ?? group.defaultCollapsed}
                    onToggle={() => setCollapsed(current => ({ ...current, [group.id]: !current[group.id] }))}
                  />
                ))}
              </section>
            </main>
          </div>

          {analysisPanelOpen && (
            <aside className="ttv-analysis-panel" aria-label="Track analysis details">
              <header className="ttv-analysis-panel-header">
                <div>
                  <span>TRACK ANALYSIS</span>
                  <strong title={model.meta.filename}>{model.meta.filename}</strong>
                </div>
                <button
                  type="button"
                  className="ttv-icon-btn"
                  onClick={() => setAnalysisPanelOpen(false)}
                  aria-label="Close track analysis details"
                >
                  ×
                </button>
              </header>
              <div className="ttv-analysis-panel-body">
                <div className="ttv-info-rail-pills">
                  {metaValues.map(value => <span key={value} className="ttv-meta-pill">{value}</span>)}
                  <span ref={playheadTimeRef} className="ttv-meta-pill ttv-playhead-time">
                    {formatTime(0)} / {formatTime(model.durationSec)}
                  </span>
                </div>
                {model.warnings.length > 0 && (
                  <div className="ttv-warning-banner">{model.warnings.slice(0, 3).join(' ')}</div>
                )}
                <MusicIntelligenceDiagnosticsPanel />
              </div>
            </aside>
          )}
        </section>
      </div>
    </div>
  )
}
