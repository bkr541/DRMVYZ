import { AppIcon } from '../../shared/icons/AppIcon'
import { useState } from 'react'
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
import { PaletteGroupStyleGallery } from './layoutLab/PaletteGroupStyleGallery'
import { BadgeStyleGallery } from './layoutLab/BadgeStyleGallery'
import { LayerRowStyleGallery } from './layoutLab/LayerRowStyleGallery'
import { PresetCardStyleGallery } from './layoutLab/PresetCardStyleGallery'
import { PresetTwoColumnConceptsGallery } from './layoutLab/PresetTwoColumnConceptsGallery'
import { NumericInputStyleGallery } from './layoutLab/NumericInputStyleGallery'
import { TemplateAudioDockMockup } from './layoutLab/TemplateAudioDockMockup'
import { Cinema2StillsFilmstripMockup } from './layoutLab/Cinema2StillsFilmstripMockup'
import { Cinema2CanvasMockup } from './layoutLab/Cinema2CanvasMockup'
import { Cinema2RightRailMockup } from './layoutLab/Cinema2RightRailMockup'
import { PresetManagerCardStyleGallery } from './layoutLab/PresetManagerCardStyleGallery'
import { TemplateHeaderRowMockups } from './layoutLab/TemplateHeaderRowMockups'
import { FontPairingMockups } from './layoutLab/FontPairingMockups'
import type { LayoutLabEngineId } from './layoutLab/layoutLabEngineCatalog'
import { resolveLayoutLabComposition } from './layoutLab/layoutLabComposition'
import { useCinema2MockState } from './layoutLab/useCinema2MockState'
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

const EMPTY_ENGINE_MOCKUPS = new Set<LayoutLabEngineId>(['canvas', 'pixGrid', 'oscilloscope', 'laserDmx'])

function MockChevron({ expanded }: { expanded: boolean }) { return <AppIcon kind={expanded ? 'chevronUp' : 'chevronDown'} /> }

function MockCastIcon() { return <AppIcon kind="cast" /> }

function MockStageFocusIcon() { return <AppIcon kind="cameraFocus" /> }

export function LayoutLabMockup() {
  const [engineId, setEngineId] = useState<LayoutLabEngineId>('cinema2')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [dockCollapsed, setDockCollapsed] = useState(false)
  const [templateRightTab, setTemplateRightTab] = useState<'presets' | 'design' | 'react' | 'output'>('design')
  const [clearedRightTab, setClearedRightTab] = useState<'presets' | 'design' | 'react' | 'output'>('design')
  const composition = engineId === 'template' || engineId === 'lyricManager' || EMPTY_ENGINE_MOCKUPS.has(engineId)
    ? null
    : resolveLayoutLabComposition(engineId)
  const [activeSurface, setActiveSurface] = useState<ReactLowerSurface>('trackMap')
  const cinema2State = useCinema2MockState()

  const handleSelectEngine = (id: LayoutLabEngineId) => {
    if (id === 'template' || id === 'lyricManager' || EMPTY_ENGINE_MOCKUPS.has(id)) {
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
          {engineId === 'cinema2' ? (
            <Cinema2StillsFilmstripMockup engineId={engineId} onSelectEngine={handleSelectEngine} state={cinema2State} />
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
                      <PaletteGroupStyleGallery />
                      <BadgeStyleGallery />
                      <LayerRowStyleGallery />
                      <NumericInputStyleGallery />
                    </div>
                  </div>
                )}
                {engineId === 'pixGrid' && (
                  <div className="rv-left-tab-body">
                    <div className="rv-engine-viewport rv-inspector rv-inspector-scroll">
                      <FontPairingMockups />
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </WorkspaceRail>

        <div className="rv-center-col">
          <div className="rv-canvas-wrap">
            {engineId === 'template' && <TemplateHeaderRowMockups />}
            {engineId === 'cinema2' && <Cinema2CanvasMockup state={cinema2State} />}
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
                {templateRightTab === 'presets' && (
                  <div className="rv-inspector rv-inspector-scroll">
                    <PresetCardStyleGallery />
                    <PresetTwoColumnConceptsGallery />
                  </div>
                )}
                {templateRightTab === 'design' && (
                  <div className="rv-inspector rv-inspector-scroll">
                    <PresetManagerCardStyleGallery />
                  </div>
                )}
                {/* React and Output are intentionally blank in the Template engine. */}
              </div>
            </>
          ) : EMPTY_ENGINE_MOCKUPS.has(engineId) ? (
            <>
              <RailTabs
                tabs={MOCK_RIGHT_TABS}
                activeTab={clearedRightTab}
                onChange={setClearedRightTab}
                ariaLabel={engineId === 'laserDmx'
                  ? 'LaserDMX inspector tabs'
                  : engineId === 'canvas'
                    ? 'Canvas inspector tabs'
                    : engineId === 'pixGrid'
                      ? 'PixGrid inspector tabs'
                      : 'Sound Drawing inspector tabs'}
              />
              <div className="vz-panel-body" />
            </>
          ) : engineId === 'cinema2' ? (
            <Cinema2RightRailMockup state={cinema2State} />
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

      {/* Bottom dock mockup — outside the grid, full width, matches production placement */}
      {engineId === 'template' && <TemplateAudioDockMockup />}
    </div>
  )
}
