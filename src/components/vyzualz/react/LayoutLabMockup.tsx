import { useState } from 'react'
import { WorkspaceRail } from '../layout/WorkspaceRail'
import { RailTabs, type RailTabOption } from '../layout/RailTabs'
import { MockEngineDropdown } from './layoutLab/MockEngineDropdown'
import { SoundDrawingMockup } from './layoutLab/SoundDrawingMockup'
import { SoundDrawingRightRailMockup } from './layoutLab/SoundDrawingRightRailMockup'
import { useSoundDrawingMockState } from './layoutLab/useSoundDrawingMockState'
import type { ReactEngineId } from './ReactTypes'

// ── LayoutLabMockup ────────────────────────────────────────────────────────
//
// A static, disconnected preview of the React View shell for trying out
// layout ideas before building a real engine. Every piece of state here is
// local to this component — there is no store, persistence, audio,
// analyser, or renderer wiring, and the surface-visibility table below is a
// plain copied snapshot of resolveReactWorkspaceComposition's rules
// (reactWorkspaceComposition.ts), not an import of it. Nothing in this file
// is reachable from production navigation.

type MockLowerSurface = 'trackMap' | 'soundDrawing' | 'performancePads'

const MOCK_LOWER_SURFACE_LABELS: Record<MockLowerSurface, string> = {
  trackMap: 'Track Map',
  soundDrawing: 'Sound Drawing',
  performancePads: 'Performance Pads',
}

const MOCK_LOWER_SURFACES_BY_ENGINE: Record<ReactEngineId, MockLowerSurface[]> = {
  shaderPads: ['trackMap'],
  cinematicPortal: ['trackMap', 'performancePads'],
  oscilloscope: ['trackMap', 'soundDrawing', 'performancePads'],
  canvas: ['trackMap', 'performancePads'],
  laserDmx: ['trackMap', 'performancePads'],
  pixGrid: ['trackMap', 'performancePads'],
}

const MOCK_SURFACE_PLACEHOLDER: Record<MockLowerSurface, string> = {
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

export function LayoutLabMockup() {
  const [engineId, setEngineId] = useState<ReactEngineId>('cinematicPortal')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [dockCollapsed, setDockCollapsed] = useState(false)
  const surfaces = MOCK_LOWER_SURFACES_BY_ENGINE[engineId]
  const [activeSurface, setActiveSurface] = useState<MockLowerSurface>(surfaces[0])
  const soundDrawingState = useSoundDrawingMockState()

  const handleSelectEngine = (id: ReactEngineId) => {
    setEngineId(id)
    setActiveSurface(MOCK_LOWER_SURFACES_BY_ENGINE[id][0])
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
          ) : (
            <div className="rv-left-workspace-shell" data-description-density="compact">
              <section className="rv-context-workspace">
                <header className="rv-context-workspace-header">
                  <MockEngineDropdown engineId={engineId} onSelect={handleSelectEngine} />
                </header>
              </section>
            </div>
          )}
        </WorkspaceRail>

        <div className="rv-center-col">
          <div className="rv-canvas-wrap" />

          <section className="rv-lower-workspace" data-collapsed={dockCollapsed ? 'true' : undefined}>
            <div className="rv-lower-workspace-toolbar">
              <button
                type="button"
                className="rv-lower-workspace-row-toggle"
                aria-expanded={!dockCollapsed}
                aria-label={dockCollapsed ? 'Expand lower workspace' : 'Collapse lower workspace'}
                onClick={() => setDockCollapsed(value => !value)}
              />
              <div className="rv-lower-workspace-tabs" role="tablist" aria-label="Timeline surfaces (mockup)">
                {surfaces.map(surface => (
                  <span key={surface} className="rv-lower-workspace-tab-wrap">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeSurface === surface}
                      className={activeSurface === surface ? 'is-active' : ''}
                      onClick={() => {
                        setActiveSurface(surface)
                        setDockCollapsed(false)
                      }}
                    >
                      {MOCK_LOWER_SURFACE_LABELS[surface]}
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

            {surfaces.map(surface => (
              <div
                key={surface}
                hidden={activeSurface !== surface || dockCollapsed}
                className={
                  'rv-lower-workspace-surface'
                  + (surface === 'trackMap' ? ' rv-lower-workspace-surface--track-map' : '')
                  + (surface === 'soundDrawing' ? ' rv-lower-workspace-surface--sound-drawing' : '')
                }
              >
                <div className="rv-strip-empty">{MOCK_SURFACE_PLACEHOLDER[surface]}</div>
              </div>
            ))}
          </section>
        </div>

        <WorkspaceRail
          side="right"
          label="Layout Lab right rail"
          collapsed={rightCollapsed}
          onToggleCollapsed={() => setRightCollapsed(value => !value)}
        >
          {engineId === 'oscilloscope' ? (
            <SoundDrawingRightRailMockup state={soundDrawingState} />
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
