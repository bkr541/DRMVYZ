import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { RgbWaveformAnalysis } from '../../../../features/waveform/rgbWaveformTypes'
import { useSharedAudio } from '../../../../context/AudioEngineContext'
import { VyzualzAudioDock } from '../../shared/VyzualzAudioDock'
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
import {
  clampTrackTimelinePlayheadTime,
  resolveTrackTimelinePlayheadRatio,
} from './trackTimelinePlayhead'
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
    ['Bass Energy', 'energyCurves.bass', 'orange'],
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

function TimelineRow({ model, label, count, height, spec }: RowDefinition & { model: TrackTimelineModel }) {
  return (
    <div className="ttv-timeline-row">
      <div className="ttv-row-label" title={label}>
        <span className="ttv-label-text">{label}</span>
        <small>{count.toLocaleString()}</small>
      </div>
      <div className="ttv-canvas-wrap">
        <TrackTimelineCanvas model={model} spec={spec} height={height} />
      </div>
    </div>
  )
}

function TrackTimelinePlayheadController({
  appShellRef,
  playheadTimeRef,
  durationSec,
}: {
  appShellRef: RefObject<HTMLDivElement>
  playheadTimeRef: RefObject<HTMLSpanElement>
  durationSec: number
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
        const ratio = resolveTrackTimelinePlayheadRatio(currentTimeSec, durationSec)
        appShell.style.setProperty('--ttv-playhead-ratio', String(ratio))
        appShell.dataset.playheadVisible = 'true'

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
  }, [appShellRef, durationSec, playheadTimeRef])

  return null
}

function TimelineGroup({ group, model, collapsed, onToggle }: {
  group: GroupDefinition
  model: TrackTimelineModel
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <section className={`ttv-group${collapsed ? ' ttv-group--collapsed' : ''}`}>
      <button
        type="button"
        className="ttv-group-header"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <span className="ttv-group-title">
          <span className="ttv-chevron">⌄</span>
          <span>{group.title}</span>
        </span>
        <span className="ttv-group-summary">
          <span className="ttv-summary-copy">{group.summary}</span>
          <span className="ttv-count-badge">{group.rows.length}</span>
        </span>
      </button>
      {!collapsed && (
        <div className="ttv-group-content">
          {group.rows.length > 0
            ? group.rows.map(row => <TimelineRow key={`${group.id}:${row.label}`} {...row} model={model} />)
            : <div className="ttv-empty-row">No compatible data was found for this group.</div>}
        </div>
      )}
    </section>
  )
}

export function TrackTimelineVisualizer(props: TrackTimelineVisualizerProps) {
  const appShellRef = useRef<HTMLDivElement>(null)
  const playheadTimeRef = useRef<HTMLSpanElement>(null)
  const model = useMemo(() => buildTrackTimelineModel(props), [props])
  const groups = useMemo(() => buildGroups(model), [model])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => Object.fromEntries(
    groups.map(group => [group.id, group.defaultCollapsed]),
  ))

  const setAllCollapsed = useCallback((value: boolean) => {
    setCollapsed(Object.fromEntries(groups.map(group => [group.id, value])))
  }, [groups])

  const metaValues = [
    formatTime(model.durationSec),
    model.meta.bpm ? `${Math.round(model.meta.bpm)} BPM` : null,
    model.meta.timeSignature ? `${model.meta.timeSignature}/4` : null,
    model.meta.dominantKey || null,
    `${model.beats.length} beats`,
    `${model.sections.length} sections`,
    model.meta.sampleRate ? `${Math.round(model.meta.sampleRate).toLocaleString()} Hz` : null,
  ].filter((value): value is string => Boolean(value))

  return (
    <div ref={appShellRef} className="ttv-app-shell az-root rv-shell" data-playhead-visible="false">
      <TrackTimelinePlayheadController
        appShellRef={appShellRef}
        playheadTimeRef={playheadTimeRef}
        durationSec={model.durationSec}
      />

      <header className="ttv-window-header">
        <div className="ttv-title-row">
          <div className="ttv-logo-mark"><TrackTimelineIcon /></div>
          <div>
            <h1>DRMVYZ Track Timeline Visualizer</h1>
            <p>Live Audio Intelligence from the currently loaded track. No JSON or Excel import layer.</p>
          </div>
        </div>
        <div className="ttv-ready-pill">
          <span /> Analysis ready · {model.meta.analysisVersion}
        </div>
      </header>

      <section className="ttv-visualization-shell">
        <div className="ttv-scroll-region">
          <div className="ttv-sticky-timeline">
            <div className="ttv-track-toolbar">
              <div className="ttv-track-meta">
                <span className="ttv-track-name" title={model.meta.filename}>{model.meta.filename}</span>
                {metaValues.map(value => <span key={value} className="ttv-meta-pill">{value}</span>)}
                <span ref={playheadTimeRef} className="ttv-meta-pill ttv-playhead-time">
                  {formatTime(0)} / {formatTime(model.durationSec)}
                </span>
              </div>
              <div className="ttv-toolbar-actions">
                <button type="button" className="ttv-toolbar-btn" onClick={() => setAllCollapsed(false)}>Expand all</button>
                <button type="button" className="ttv-toolbar-btn" onClick={() => setAllCollapsed(true)}>Collapse all</button>
              </div>
            </div>
            <div className="ttv-timeline-row">
              <div className="ttv-row-label ttv-row-label--sticky"><span className="ttv-label-text">WAVEFORM</span></div>
              <div className="ttv-canvas-wrap ttv-canvas-wrap--playhead-anchor">
                <TrackTimelineCanvas model={model} spec={{ kind: 'waveform' }} height={82} />
              </div>
            </div>
            <div className="ttv-timeline-row">
              <div className="ttv-row-label ttv-row-label--sticky"><span className="ttv-label-text">BEAT GRID</span></div>
              <div className="ttv-canvas-wrap">
                <TrackTimelineCanvas model={model} spec={{ kind: 'beatGrid' }} height={54} />
              </div>
            </div>
          </div>

          {model.warnings.length > 0 && (
            <div className="ttv-warning-banner">{model.warnings.slice(0, 3).join(' ')}</div>
          )}

          <main className="ttv-content-area">
            <section className="ttv-sections-block">
              <TimelineRow
                model={model}
                label="TRACK SECTIONS"
                count={model.sections.length}
                height={64}
                spec={{ kind: 'sections', sections: model.sections }}
              />
            </section>
            {groups.map(group => (
              <TimelineGroup
                key={group.id}
                group={group}
                model={model}
                collapsed={collapsed[group.id] ?? group.defaultCollapsed}
                onToggle={() => setCollapsed(current => ({ ...current, [group.id]: !current[group.id] }))}
              />
            ))}
          </main>
        </div>
      </section>

      <VyzualzAudioDock
        deckLabel="TRACK TIMELINE"
        expandable
        waveformAppearance="deck"
      />
    </div>
  )
}
