import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import { TopEdgeResizeHandle } from '../../../shared/TopEdgeResizeHandle/TopEdgeResizeHandle'
import {
  SECTION_COLORS,
  SectionTimeline,
  buildBarRange,
  buildSectionConfidenceDisplayData,
  buildTimelineCueRowLayout,
  buildTimelineCueTitle,
  computeStaggeredTimelineCueLayout,
  drawBeatGridCanvas,
  drawTimelineRuler,
  formatTimePrecise,
} from '../ReactTrackMapStrip'
import { TrackMapLaneIcon } from '../TrackMapLaneIcon'
import {
  TM_ACTIONS, TM_BEAT_GRID, TM_CUES, TM_DURATION_SEC, TM_MOMENTS, TM_PHRASES, TM_PLAYHEAD_SEC,
  TM_PRESET_ASSIGNED_SECTION_IDS, TM_SECTIONS, type TmCueItem,
} from './layoutLabTrackMapFixture'

// ── Layout Lab · lower workspace · Track Map ────────────────────────────────
//
// A disconnected mirror of the performance timeline workspace under React's visualizer: the toolbar (Track Map /
// Performance Pads, the row-icons key, Cast, Stage Focus and the collapse chevron) and the Track Map surface with its lanes
// in production's order: Beats, Sections, the marker rows (Cues, Phrases, Moments, Actions) and the Time ruler, with the
// shared playhead. It uses production's own pieces where they stand alone (the real SectionTimeline, the beat-grid and ruler
// canvas drawing, the lane icons, the cue row layout and staggering, the section detail overview) and its markup and classes
// elsewhere, fed the placeholder data in layoutLabTrackMapFixture.ts instead of the audio engine and stores. Click a
// section for its detail overview; click a marker to move the playhead. The resize handle on the top edge works as in the app. Boundary dragging, the section editor and context menus are not
// part of the mockup.

// Same bounds as React View's lower workspace.
const DEFAULT_SURFACE_HEIGHT = 263
const MIN_SURFACE_HEIGHT = 96
const MAX_SURFACE_HEIGHT = 640
const MIN_STAGE_HEIGHT = 180
const VIEWPORT = { startSec: 0, endSec: TM_DURATION_SEC }
const CUE_ROW_ICONS: Record<string, { label: string; kind: AppIconKind }> = {
  cues: { label: 'Cues', kind: 'cue' }, phrases: { label: 'Phrases', kind: 'tree' },
  moments: { label: 'Moments', kind: 'star' }, actions: { label: 'Actions', kind: 'route' },
}

type Surface = 'trackMap' | 'performancePads'

export function LayoutLabReactTrackMap() {
  const [surface, setSurface] = useState<Surface>('trackMap')
  const [collapsed, setCollapsed] = useState(false)
  const [laneIconsExpanded, setLaneIconsExpanded] = useState(false)
  const [stageFocus, setStageFocus] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(TM_PLAYHEAD_SEC)
  const [surfaceHeight, setSurfaceHeight] = useState<number | null>(null)
  const workspaceRef = useRef<HTMLElement>(null)
  const viewportRef = useRef(VIEWPORT)
  const beatCanvasRef = useRef<HTMLCanvasElement>(null)
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null)

  const items = useMemo<TmCueItem[]>(() => [
    ...TM_ACTIONS,
    ...TM_CUES.map(cue => ({
      id: `${cue.source === 'rekordbox' ? 'rekordbox' : 'transport'}:${cue.id}`, timeSec: cue.time, label: cue.label,
      color: cue.color ?? '#e2364f', kind: 'cue' as const, enabled: true, title: buildTimelineCueTitle(cue),
    })),
    ...TM_PHRASES,
    ...TM_MOMENTS,
  ], [])
  const rows = useMemo(() => {
    const layout = buildTimelineCueRowLayout(items.map(item => item.kind))
    const withItems = layout.map(row => ({ ...row, items: items.filter(item => row.kinds.includes(item.kind)).sort((a, b) => a.timeSec - b.timeSec) }))
    const populated = withItems.filter(row => !row.empty)
    return populated.length > 0 ? populated : withItems.filter(row => row.id === 'actions')
  }, [items])
  const cueLaneHeight = rows.reduce((height, row) => height + row.heightPx, 0)
  const lanesHeight = 26 + 36 + cueLaneHeight + 24

  const getStartHeight = useCallback(
    () => workspaceRef.current?.querySelector<HTMLElement>('.rv-lower-workspace-surface:not([hidden])')?.offsetHeight ?? DEFAULT_SURFACE_HEIGHT,
    [],
  )
  const resizeSurface = useCallback((next: number) => {
    const section = workspaceRef.current
    const column = section?.parentElement
    const toolbarHeight = section?.querySelector<HTMLElement>('.rv-lower-workspace-toolbar')?.offsetHeight ?? 0
    const ceiling = column ? column.clientHeight - toolbarHeight - MIN_STAGE_HEIGHT : MAX_SURFACE_HEIGHT
    setSurfaceHeight(Math.max(MIN_SURFACE_HEIGHT, Math.min(next, ceiling)))
  }, [])

  const visible = surface === 'trackMap' && !collapsed && !stageFocus
  useEffect(() => {
    if (!visible) return
    const beat = beatCanvasRef.current
    const ruler = rulerCanvasRef.current
    if (!beat || !ruler) return
    const draw = () => {
      drawBeatGridCanvas(beat, TM_BEAT_GRID, TM_DURATION_SEC, viewportRef.current)
      drawTimelineRuler(ruler, viewportRef.current)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(beat)
    observer.observe(ruler)
    return () => observer.disconnect()
  }, [visible, laneIconsExpanded])

  const selected = selectedId ? TM_SECTIONS.find(section => section.id === selectedId) ?? null : null
  const selectedBars = selected ? buildBarRange(selected, TM_BEAT_GRID) : null
  const selectedConfidence = selected ? buildSectionConfidenceDisplayData(selected) : null
  const selectedPreset = selected
    ? TM_ACTIONS.find(action => action.kind === 'preset' && action.label.startsWith(`${selected.label} →`))?.label.split('→ ')[1] ?? null
    : null

  const tabs: { id: Surface; label: string }[] = [{ id: 'trackMap', label: 'Track Map' }, { id: 'performancePads', label: 'Performance Pads' }]

  return (
    <section
      ref={workspaceRef}
      className="rv-lower-workspace"
      data-collapsed={collapsed ? 'true' : undefined}
      data-resized={surfaceHeight != null ? 'true' : undefined}
      style={surfaceHeight != null ? ({ '--rv-lower-surface-height': `${surfaceHeight}px` } as CSSProperties) : undefined}
      aria-label="Performance timeline workspace"
    >
      {!collapsed && !stageFocus && (
        <TopEdgeResizeHandle
          label="Resize timeline workspace"
          value={surfaceHeight ?? DEFAULT_SURFACE_HEIGHT}
          min={MIN_SURFACE_HEIGHT}
          max={MAX_SURFACE_HEIGHT}
          getStartValue={getStartHeight}
          onChange={resizeSurface}
        />
      )}
      <div className="rv-lower-workspace-toolbar">
        <button
          type="button"
          className="rv-lower-workspace-row-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand lower workspace' : 'Collapse lower workspace'}
          onClick={() => setCollapsed(value => !value)}
        />
        <div className="rv-lower-workspace-tabs dv-underline-tabs" role="tablist" aria-label="Timeline surfaces">
          {tabs.map(tab => (
            <span key={tab.id} className="rv-lower-workspace-tab-wrap">
              <button
                type="button"
                role="tab"
                aria-selected={surface === tab.id}
                className={`dv-underline-tab${surface === tab.id ? ' is-active' : ''}`}
                onClick={() => { setSurface(tab.id); setCollapsed(false) }}
              >
                {tab.label}
              </button>
            </span>
          ))}
        </div>
        <div className="rv-lower-workspace-actions">
          <div className="rv-lower-workspace-output-actions">
            {surface === 'trackMap' && (
              <button
                type="button"
                className={`rv-track-map-lane-icons-toggle${laneIconsExpanded ? ' is-active' : ''}`}
                aria-label={laneIconsExpanded ? 'Collapse Track Map row icons' : 'Expand Track Map row icons'}
                aria-expanded={laneIconsExpanded}
                aria-pressed={laneIconsExpanded}
                onClick={() => setLaneIconsExpanded(value => !value)}
                title={laneIconsExpanded ? 'Hide Track Map row icons' : 'Show Track Map row icons'}
              >
                <AppIcon kind="list" />
              </button>
            )}
            <button type="button" className="rv-cast-trigger" aria-label="Cast visual output" title="Cast visual output">
              <AppIcon kind="cast" />
            </button>
            <button
              type="button"
              className={`rv-stage-focus-btn${stageFocus ? ' is-active' : ''}`}
              aria-label={stageFocus ? 'Restore workspace rails and timeline' : 'Maximize the live output stage'}
              aria-pressed={stageFocus}
              onClick={() => setStageFocus(value => !value)}
              title={stageFocus ? 'Restore workspace rails and timeline' : 'Maximize the live output stage'}
            >
              <AppIcon kind="cameraFocus" />
            </button>
          </div>
          <span className="rv-lower-workspace-chevron" aria-hidden="true">
            <AppIcon kind={collapsed ? 'chevronDown' : 'chevronUp'} />
          </span>
        </div>
      </div>

      <div hidden={!visible} className="rv-lower-workspace-surface rv-lower-workspace-surface--track-map">
        <div className="rv-track-map-strip rv-track-map-strip--embedded">
          {selected ? (
            <div className="rv-timeline-detail-overview" aria-label="Selected section overview">
              <button type="button" className="rv-timeline-detail-back" onClick={() => setSelectedId(null)} aria-label="Back to full Track Map" title="Back to full Track Map">
                <AppIcon kind="left" />
              </button>
              <span className="rv-timeline-detail-color" style={{ '--section-color': SECTION_COLORS[selected.type] } as CSSProperties} aria-hidden="true" />
              <div className="rv-timeline-detail-title">
                <strong>{selected.label}</strong>
                <span>{selected.type} section</span>
              </div>
              <div className="rv-timeline-detail-meta">
                <span>{formatTimePrecise(selected.startSec)} → {formatTimePrecise(selected.endSec)}</span>
                <span>{Math.max(0, selected.endSec - selected.startSec).toFixed(1)}s</span>
                {selectedBars && <span>Bars {selectedBars}</span>}
                <span>{Math.round(selected.intensity * 100)}%</span>
                <span>{selectedPreset ?? 'No preset'}</span>
                {selectedConfidence && (
                  <span className={`rv-confidence-badge rv-confidence-badge--${selectedConfidence.tier}`} title={selectedConfidence.tooltip}>
                    {selectedConfidence.tier} confidence
                  </span>
                )}
                {selected.interpretation?.familyId && (
                  <span>{selected.interpretation.familyId} · occurrence {selected.interpretation.occurrenceIndex ?? 1}</span>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`rv-timeline-lanes${laneIconsExpanded ? ' rv-timeline-lanes--icons-expanded' : ''}`}
              aria-label="Expandable Track Map timeline lanes"
              style={{
                '--rv-cue-row-grid': rows.map(row => `${row.heightPx}px`).join(' '),
                '--rv-cue-lane-height': `${cueLaneHeight}px`,
                '--rv-timeline-lanes-height': `${lanesHeight}px`,
              } as CSSProperties}
            >
              <div className="rv-timeline-lane rv-timeline-lane--beats" role="group" aria-label="Beat Grid">
                <TrackMapLaneIcon kind="beats" label="Beats" />
                <div className="rv-timeline-lane-content rv-beat-canvas-wrap">
                  <canvas ref={beatCanvasRef} className="rv-beat-canvas" aria-hidden="true" />
                </div>
              </div>

              <div className="rv-timeline-lane rv-timeline-lane--sections" role="group" aria-label="Sections">
                <TrackMapLaneIcon kind="sections" label="Sections" />
                <div className="rv-timeline-lane-content">
                  <SectionTimeline
                    sections={TM_SECTIONS}
                    durationSec={TM_DURATION_SEC}
                    viewport={VIEWPORT}
                    viewportRef={viewportRef}
                    beatGrid={TM_BEAT_GRID}
                    effectiveBpm={129}
                    snapMode="bar"
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onCommitBoundary={() => {}}
                    presetAssignedSectionIds={TM_PRESET_ASSIGNED_SECTION_IDS}
                  />
                </div>
              </div>

              <div className="rv-timeline-lane rv-timeline-lane--cues" role="group" aria-label="Cues and Presets">
                <span
                  className="rv-timeline-lane-icon rv-timeline-lane-icon--cue-rows"
                  role="group"
                  aria-label="Track markers"
                  style={{ gridTemplateRows: rows.map(row => `${row.heightPx}px`).join(' ') }}
                >
                  {rows.map(row => (
                    <span key={row.id} role="img" aria-label={CUE_ROW_ICONS[row.id]!.label} title={CUE_ROW_ICONS[row.id]!.label} data-cue-label-row={row.id} style={{ height: `${row.heightPx}px`, minHeight: `${row.heightPx}px` }}>
                      <AppIcon kind={CUE_ROW_ICONS[row.id]!.kind} size={16} />
                      <span>{CUE_ROW_ICONS[row.id]!.label}</span>
                    </span>
                  ))}
                </span>
                <div className="rv-timeline-lane-content rv-timeline-cue-lane">
                  {rows.map(row => (
                    <div key={row.id} className={`rv-timeline-cue-row rv-timeline-cue-row--${row.id}${row.empty ? ' rv-timeline-cue-row--empty' : ''}`} data-cue-row={row.id}>
                      {row.items.map((item, index) => {
                        const next = row.items[index + 2] ?? null
                        const layout = computeStaggeredTimelineCueLayout(item.timeSec, next?.timeSec ?? null, VIEWPORT)
                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-timeline-cue
                            data-cue-time={item.timeSec}
                            className={`rv-timeline-cue rv-timeline-cue--${item.kind} ${index % 2 ? 'is-low' : 'is-high'}${layout.hoverReveal ? ' is-hover-reveal' : ''}${item.enabled ? '' : ' rv-timeline-cue--disabled'}`}
                            style={{
                              display: layout.visible ? undefined : 'none',
                              left: `${layout.leftPct}%`,
                              width: `${layout.widthPct}%`,
                              '--cue-color': item.color,
                            } as CSSProperties}
                            onClick={() => setPlayhead(item.timeSec)}
                            aria-label={`${item.label}, ${item.kind === 'pixgrid' ? 'PixGrid action cue' : `${item.kind} cue`}, ${formatTimePrecise(item.timeSec)}${item.enabled ? '' : ', disabled'}`}
                            title={item.title}
                          >
                            <span className="rv-timeline-cue-diamond" aria-hidden="true" />
                            <span className="rv-timeline-cue-label">{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rv-timeline-lane rv-timeline-lane--ruler" role="group" aria-label="Visible Range">
                <TrackMapLaneIcon kind="ruler" label="Time" />
                <div className="rv-timeline-lane-content rv-timeline-ruler-content">
                  <canvas ref={rulerCanvasRef} className="rv-timeline-ruler-canvas" aria-hidden="true" />
                </div>
              </div>

              <div className="rv-timeline-playhead-layer" aria-hidden="true">
                <div className="rv-timeline-shared-playhead" style={{ display: 'block', left: `${(playhead / TM_DURATION_SEC) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
      <div hidden={surface !== 'performancePads' || collapsed || stageFocus} className="rv-lower-workspace-surface" />
    </section>
  )
}
