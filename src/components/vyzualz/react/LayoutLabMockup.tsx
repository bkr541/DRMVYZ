import { useState, type CSSProperties } from 'react'
import { WorkspaceRail } from '../layout/WorkspaceRail'
import { RailTabs, type RailTabOption } from '../layout/RailTabs'
import { MockEngineDropdown } from './layoutLab/MockEngineDropdown'
import { DropdownStyleGallery } from './layoutLab/DropdownStyleGallery'
import { CollapsibleGroupStyleGallery } from './layoutLab/CollapsibleGroupStyleGallery'
import { SliderStyleGallery } from './layoutLab/SliderStyleGallery'
import { ToggleStyleGallery } from './layoutLab/ToggleStyleGallery'
import { TabStyleGallery } from './layoutLab/TabStyleGallery'
import { EngineDropdownStyleGallery } from './layoutLab/EngineDropdownStyleGallery'
import { NoticeStyleGallery } from './layoutLab/NoticeStyleGallery'
import { NotificationsModalMockup } from './layoutLab/NotificationsModalMockup'
import { MediaLibraryStyleGallery } from './layoutLab/MediaLibraryStyleGallery'
import { ButtonStyleGallery } from './layoutLab/ButtonStyleGallery'
import { PaletteGroupStyleGallery } from './layoutLab/PaletteGroupStyleGallery'
import { TemplateOutputDiagnosticsMockup } from './layoutLab/TemplateOutputDiagnosticsMockup'
import { CanvasMockup } from './layoutLab/CanvasMockup'
import { CanvasRightRailMockup } from './layoutLab/CanvasRightRailMockup'
import { LaserDmxMockup } from './layoutLab/LaserDmxMockup'
import { LaserDmxRightRailMockup } from './layoutLab/LaserDmxRightRailMockup'
import { PixGridMockup } from './layoutLab/PixGridMockup'
import { PixGridRightRailMockup } from './layoutLab/PixGridRightRailMockup'
import { SoundDrawingMockup } from './layoutLab/SoundDrawingMockup'
import { SoundDrawingRightRailMockup } from './layoutLab/SoundDrawingRightRailMockup'
import type { LayoutLabEngineId } from './layoutLab/layoutLabEngineCatalog'
import { resolveLayoutLabComposition } from './layoutLab/layoutLabComposition'
import { useCanvasMockState, type CanvasMockState } from './layoutLab/useCanvasMockState'
import { useLaserDmxMockState, type LaserDmxMockState } from './layoutLab/useLaserDmxMockState'
import { usePixGridMockState, type PixGridMockState } from './layoutLab/usePixGridMockState'
import { useSoundDrawingMockState } from './layoutLab/useSoundDrawingMockState'
import type { ReactLowerSurface } from './reactWorkspaceComposition'

// ── LayoutLabMockup ────────────────────────────────────────────────────────
//
// A disconnected preview of the React View shell for trying out layout ideas
// without mounting production stores, renderers, media services, audio, or
// output runtimes. Pure workspace composition is shared with production so
// engine tabs and lower surfaces cannot drift.

const MOCK_SURFACE_PLACEHOLDER: Record<ReactLowerSurface, string> = {
  trackMap: 'Load a track to generate its beat grid, energy map, sections, and cue lanes.',
  soundDrawing: 'Sound Drawing timeline placeholder.',
  performancePads: 'Performance pads placeholder.',
}

const MOCK_RIGHT_TABS: RailTabOption<'presets' | 'design' | 'react' | 'output'>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'design', label: 'DESIGN' },
  { id: 'react', label: 'REACT' },
  { id: 'output', label: 'OUTPUT' },
]

function MockChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={expanded ? 'm4 12 6-6 6 6' : 'm4 8 6 6 6-6'} />
    </svg>
  )
}

function MockCastIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 15.05C3.96089 15.246 4.84294 15.7202 5.53638 16.4136C6.22982 17.1071 6.70403 17.9891 6.9 18.95M3 11C5.03079 11.2259 6.92428 12.136 8.36911 13.5809M10.95 18.95C10.8756 18.2814 10.7271 17.6277 10.5097 17M3 18.95H3.01M3 8V5H21V8M14 19H21V12" />
    </svg>
  )
}

function MockStageFocusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 7.5v1.25M12 15.25v1.25M7.5 12h1.25M15.25 12h1.25" />
    </svg>
  )
}

function LaserDmxCanvasMockup({ state }: { state: LaserDmxMockState }) {
  return (
    <div className="rv-layout-lab-laser-canvas" aria-label="LaserDMX visual mockup">
      <div className="rv-layout-lab-laser-stage">
        <div className="rv-layout-lab-laser-grid" aria-hidden="true" />
        {state.mode === 'matrix' ? state.beams.map((beam, index) => {
          const selected = state.selectedBeamIds.includes(beam.id)
          return (
            <button
              key={beam.id}
              type="button"
              className={selected ? 'rv-layout-lab-laser-beam is-selected' : 'rv-layout-lab-laser-beam'}
              aria-label={`Select beam ${beam.name}`}
              aria-pressed={selected}
              style={{
                left: `${10 + beam.origin.column * 4.9}%`,
                top: `${72 - index * 3}%`,
                width: `${30 + Math.abs(beam.target.column - beam.origin.column) * 2.5}%`,
                transform: `rotate(${beam.target.column >= beam.origin.column ? -24 : -156}deg)`,
              }}
              onClick={event => state.selectBeam(beam.id, event.ctrlKey || event.metaKey || event.shiftKey)}
            />
          )
        }) : state.fixtures.map(fixture => {
          const selected = state.selectedFixtureIds.includes(fixture.id)
          return (
            <button
              key={fixture.id}
              type="button"
              className={selected ? 'rv-layout-lab-laser-fixture is-selected' : 'rv-layout-lab-laser-fixture'}
              aria-label={`Select fixture ${fixture.name}`}
              aria-pressed={selected}
              title={fixture.name}
              style={{ left: `${fixture.position.x * 100}%`, top: `${fixture.position.y * 100}%` }}
              onClick={event => state.selectFixture(fixture.id, event.ctrlKey || event.metaKey || event.shiftKey)}
            >
              <span aria-hidden="true">{fixture.kind === 'laser' ? '⌁' : fixture.kind === 'movingHead' ? '◉' : fixture.kind === 'videoWall' ? '▦' : fixture.kind === 'haze' ? '≋' : '◆'}</span>
            </button>
          )
        })}
      </div>
      <div className="rv-layout-lab-laser-canvas-status">
        <span>{state.mode === 'matrix' ? 'BEAM MATRIX MOCK' : 'SHOW DIRECTOR MOCK'}</span>
        <strong>{state.mode === 'matrix' ? `${state.beams.length} beams · ${state.groups.length} groups` : `${state.fixtures.length} fixtures · local rig`}</strong>
        <small>{state.mode === 'matrix' ? state.selectedBeams.length ? `${state.selectedBeams.length} beam${state.selectedBeams.length === 1 ? '' : 's'} selected` : state.selectedGroup?.name ?? 'Global Matrix' : state.selectedFixtures.length ? `${state.selectedFixtures.length} fixture${state.selectedFixtures.length === 1 ? '' : 's'} selected` : 'No fixture selected'}</small>
      </div>
    </div>
  )
}

function CanvasCanvasMockup({ state }: { state: CanvasMockState }) {
  return (
    <div className="rv-layout-lab-canvas-canvas" aria-label="Canvas visual mockup">
      <div className={`rv-layout-lab-canvas-stage${state.isFractures ? ' is-fractures' : ''}`} aria-hidden="true">
        {state.isFractures ? (
          <div className="rv-layout-lab-canvas-fragments">
            {Array.from({ length: 12 }, (_, index) => <span key={index} style={{ '--fragment-index': index } as CSSProperties} />)}
          </div>
        ) : (
          <div className={`rv-layout-lab-canvas-media-preview is-${state.activeMedia?.type ?? 'empty'}`}>
            <span>{state.activeMedia?.type === 'video' ? '▶' : state.activeMedia?.type === 'svg' ? 'DVYDRM' : state.activeMedia ? 'CANVAS' : 'NO SOURCE'}</span>
          </div>
        )}
      </div>
      <div className="rv-layout-lab-canvas-canvas-status">
        <span>{state.isFractures ? 'FRACTURES MOCK' : 'CANVAS MEDIA MOCK'}</span>
        <strong>{state.activeMedia?.name ?? 'No active media'}</strong>
        <small>{state.activePreset.name} · local deterministic preview</small>
      </div>
    </div>
  )
}

function PixGridCanvasMockup({ state }: { state: PixGridMockState }) {
  const activePreset = state.presets.find(preset => preset.id === state.activePresetId)
  return (
    <div className="rv-layout-lab-pix-grid-canvas" aria-label="PixGrid visual mockup">
      <div className="rv-layout-lab-pix-grid-stage" aria-hidden="true">
        <div className="rv-layout-lab-pix-grid-matrix" />
        <div className="rv-layout-lab-pix-grid-artwork">
          <span>PIX</span>
          <strong>GRID</strong>
        </div>
        {state.selection && (
          <div
            className="rv-layout-lab-pix-grid-selection"
            style={{
              left: `${Math.min(80, state.selection.x / 1.6)}%`,
              top: `${Math.min(70, state.selection.y / 0.9)}%`,
              width: `${Math.max(8, state.selection.width / 1.6)}%`,
              height: `${Math.max(8, state.selection.height / 0.9)}%`,
            }}
          />
        )}
      </div>
      <div className="rv-layout-lab-pix-grid-canvas-status">
        <span>{state.editOpen ? 'PIXGRID EDIT ACTIVE' : 'PIXGRID PREVIEW'}</span>
        <strong>{state.activeScene.name}</strong>
        <small>{state.selectedLayer?.name ?? 'Scene Pixels'} · {activePreset?.name ?? 'No preset'}</small>
      </div>
    </div>
  )
}

export function LayoutLabMockup() {
  const [engineId, setEngineId] = useState<LayoutLabEngineId>('cinematicPortal')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [dockCollapsed, setDockCollapsed] = useState(false)
  const [templateRightTab, setTemplateRightTab] = useState<'presets' | 'design' | 'react' | 'output'>('design')
  const composition = engineId === 'template' ? null : resolveLayoutLabComposition(engineId)
  const [activeSurface, setActiveSurface] = useState<ReactLowerSurface>('trackMap')
  const soundDrawingState = useSoundDrawingMockState()
  const pixGridState = usePixGridMockState()
  const laserDmxState = useLaserDmxMockState()
  const canvasState = useCanvasMockState()

  const handleSelectEngine = (id: LayoutLabEngineId) => {
    if (id === 'template') {
      setEngineId(id)
      return
    }
    const nextComposition = resolveLayoutLabComposition(id)
    setEngineId(id)
    setActiveSurface(nextComposition.lowerSurfaces[0]?.id ?? 'trackMap')
  }

  return (
    <div className="rv-shell">
      <div
        className="rv-layout"
        data-left-collapsed={leftCollapsed ? 'true' : undefined}
        data-right-collapsed={rightCollapsed ? 'true' : undefined}
      >
        <WorkspaceRail
          side="left"
          label="Layout Lab left rail"
          collapsed={leftCollapsed}
          onToggleCollapsed={() => setLeftCollapsed(value => !value)}
        >
          {engineId === 'oscilloscope' ? (
            <SoundDrawingMockup engineId={engineId} onSelectEngine={handleSelectEngine} state={soundDrawingState} />
          ) : engineId === 'pixGrid' ? (
            <PixGridMockup engineId={engineId} onSelectEngine={handleSelectEngine} state={pixGridState} />
          ) : engineId === 'laserDmx' ? (
            <LaserDmxMockup engineId={engineId} onSelectEngine={handleSelectEngine} state={laserDmxState} />
          ) : engineId === 'canvas' ? (
            <CanvasMockup engineId={engineId} onSelectEngine={handleSelectEngine} state={canvasState} />
          ) : (
            <div className="rv-left-workspace-shell" data-description-density="compact">
              <section className="rv-context-workspace">
                <header className="rv-context-workspace-header">
                  <MockEngineDropdown engineId={engineId} onSelect={handleSelectEngine} />
                </header>
                {engineId === 'template' && (
                  <div className="rv-left-tab-body">
                    <div className="rv-engine-viewport rv-inspector rv-inspector-scroll">
                      <DropdownStyleGallery />
                      <CollapsibleGroupStyleGallery />
                      <SliderStyleGallery />
                      <ToggleStyleGallery />
                      <TabStyleGallery />
                      <EngineDropdownStyleGallery />
                      <NoticeStyleGallery />
                      <NotificationsModalMockup />
                      <MediaLibraryStyleGallery />
                      <ButtonStyleGallery />
                      <PaletteGroupStyleGallery />
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </WorkspaceRail>

        <div className="rv-center-col">
          <div className="rv-canvas-wrap">
            {engineId === 'pixGrid' && <PixGridCanvasMockup state={pixGridState} />}
            {engineId === 'laserDmx' && <LaserDmxCanvasMockup state={laserDmxState} />}
            {engineId === 'canvas' && <CanvasCanvasMockup state={canvasState} />}
          </div>

          {composition && <section className="rv-lower-workspace" data-collapsed={dockCollapsed ? 'true' : undefined}>
            <div className="rv-lower-workspace-toolbar">
              <button
                type="button"
                className="rv-lower-workspace-row-toggle"
                aria-expanded={!dockCollapsed}
                aria-label={dockCollapsed ? 'Expand lower workspace' : 'Collapse lower workspace'}
                onClick={() => setDockCollapsed(value => !value)}
              />
              <div className="rv-lower-workspace-tabs" role="tablist" aria-label="Timeline surfaces (mockup)">
                {composition.lowerSurfaces.map(surface => (
                  <span key={surface.id} className="rv-lower-workspace-tab-wrap">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeSurface === surface.id}
                      data-lower-surface={surface.id}
                      className={activeSurface === surface.id ? 'is-active' : ''}
                      onClick={() => {
                        setActiveSurface(surface.id)
                        setDockCollapsed(false)
                      }}
                    >
                      {surface.label}
                    </button>
                  </span>
                ))}
              </div>
              <div className="rv-lower-workspace-actions">
                <div className="rv-lower-workspace-output-actions">
                  <button type="button" className="rv-stage-focus-btn" aria-label="Cast output (mockup)">
                    <MockCastIcon />
                  </button>
                  <button type="button" className="rv-stage-focus-btn" aria-label="Maximize stage (mockup)">
                    <MockStageFocusIcon />
                  </button>
                </div>
                <span className="rv-lower-workspace-chevron" aria-hidden="true">
                  <MockChevron expanded={!dockCollapsed} />
                </span>
              </div>
            </div>

            {composition.lowerSurfaces.map(surface => (
              <div
                key={surface.id}
                hidden={activeSurface !== surface.id || dockCollapsed}
                data-lower-surface-panel={surface.id}
                className={
                  'rv-lower-workspace-surface'
                  + (surface.id === 'trackMap' ? ' rv-lower-workspace-surface--track-map' : '')
                  + (surface.id === 'soundDrawing' ? ' rv-lower-workspace-surface--sound-drawing' : '')
                }
              >
                <div className="rv-strip-empty">{MOCK_SURFACE_PLACEHOLDER[surface.id]}</div>
              </div>
            ))}
          </section>}
        </div>

        <WorkspaceRail
          side="right"
          label="Layout Lab right rail"
          collapsed={rightCollapsed}
          onToggleCollapsed={() => setRightCollapsed(value => !value)}
        >
          {engineId === 'template' ? (
            <>
              <RailTabs
                tabs={MOCK_RIGHT_TABS}
                activeTab={templateRightTab}
                onChange={setTemplateRightTab}
                ariaLabel="Layout Lab inspector tabs"
              />
              <div className="vz-panel-body">
                {templateRightTab === 'output' && (
                  <div className="rv-inspector rv-inspector-scroll">
                    <TemplateOutputDiagnosticsMockup />
                  </div>
                )}
              </div>
            </>
          ) : engineId === 'oscilloscope' ? (
            <SoundDrawingRightRailMockup state={soundDrawingState} />
          ) : engineId === 'pixGrid' ? (
            <PixGridRightRailMockup state={pixGridState} onSelectEngine={handleSelectEngine} />
          ) : engineId === 'laserDmx' ? (
            <LaserDmxRightRailMockup state={laserDmxState} />
          ) : engineId === 'canvas' ? (
            <CanvasRightRailMockup state={canvasState} onSelectEngine={handleSelectEngine} />
          ) : (
            <>
              <RailTabs
                tabs={MOCK_RIGHT_TABS}
                activeTab="design"
                onChange={() => {}}
                ariaLabel="Layout Lab inspector tabs"
              />
              <div className="vz-panel-body" />
            </>
          )}
        </WorkspaceRail>
      </div>
    </div>
  )
}
