import { useMemo, useState, type CSSProperties } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { RailTabs, type RailTabOption } from '../../layout/RailTabs'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'
import { UnderlineTabs } from '../controls/UnderlineTabs'
import { Cinema2LayersList } from '../Cinema2LayersPanel'
import { LayoutLabNoticeTab } from './LayoutLabNoticeTab'
import { Collapsible } from '../ReactControlRows'
import { getReactEngineIconComponent } from '../reactEngineIcons'
import { cinema2NativePresetRegistry, compileCinema2NativePreset } from '../../cinema2'

// ── Layout Lab · left window · Cinema 2.0 / Electric Storm ──────────────────
//
// A disconnected mockup of React View's left rail with Cinema 2.0 active: the engine card, the SOURCE / LAYERS tabs,
// the Media Library the Source tab hosts, the Layers list (production's Cinema2LayersList) and, after Layers, a NOTICE tab with production's NoticeCard in each tone. It is built from the same components, markup and classes as production
// (RailWindowHeader, RailTabs, Collapsible, UnderlineTabs, the media sheet card classes), with local state only: no
// stores, media service or runtime. The engine card keeps its production markup but opens nothing.

const LEFT_TABS: RailTabOption<'source' | 'layers' | 'notice'>[] = [
  { id: 'source', label: 'SOURCE' },
  { id: 'layers', label: 'LAYERS' },
  { id: 'notice', label: 'NOTICE' },
]

type LibraryFilter = 'all' | 'collections' | 'favorites' | 'images' | 'videos'
const FILTER_TABS: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'collections', label: 'COLLECTIONS' },
  { id: 'favorites', label: 'FAVORITES' },
  { id: 'images', label: 'IMAGES' },
  { id: 'videos', label: 'VIDEOS' },
]

interface MockMedia { id: string; title: string; badge: string; video?: boolean; favorite?: boolean; tint: [string, string] }

const TINTS: [string, string][] = [
  ['#0b1220', '#6f86b8'], ['#0a0a12', '#b9c4d8'], ['#0b0b1a', '#7a6fd6'], ['#101010', '#a8a8a8'],
  ['#07131f', '#2f8fd1'], ['#04141a', '#31c9c0'], ['#0a0a1c', '#d63fb5'], ['#08140f', '#7be0a4'],
  ['#14081a', '#e04fd0'], ['#1a1704', '#e8d92a'], ['#1c1830', '#8b78e8'], ['#1a1a1a', '#ffffff'],
  ['#0d1a0d', '#58d65a'], ['#06121c', '#5cc7ee'], ['#0f1a18', '#e87a3a'], ['#1a0f08', '#e8963a'],
  ['#14121c', '#c9b7e8'], ['#0b1a14', '#4fd1a0'], ['#1a1a1a', '#d8d8d8'], ['#140b1a', '#d98fe8'],
]
const TITLES: [string, string][] = [
  ['TheKodyRoblnson…', 'BG IMAGE'], ['TheKodyRoblnson…', 'BG IMAGE'], ['TheKodyRoblnson…', 'BG IMAGE'], ['Chrome DVYDRM…', 'BG IMAGE'],
  ['DVYDRM wordmark…', 'BG IMAGE'], ['Luminous Chrome…', 'BG IMAGE'], ['DVYDRM Neon…', 'BG IMAGE'], ['DVYDRM wordmark…', 'BG IMAGE'],
  ['Neon Glitch…', 'LOGO'], ['Glossy DVYDRM…', 'LOGO'], ['Neon-Gold…', 'LOGO'], ['Glossy Purple…', 'LOGO'],
  ['DVYDRM Glitch…', 'BG IMAGE'], ['Chrome DVYDRM…', 'BG IMAGE'], ['Neon Glitch…', 'BG IMAGE'], ['image(2026…', 'BG IMAGE'],
  ['DVYDRM Underground…', 'BG IMAGE'], ['Prismatic DVYDRM…', 'BG IMAGE'], ['DVYDRM wordmark…', 'BG IMAGE'], ['DVYDRM wordmark…', 'BG IMAGE'],
]
const MEDIA: MockMedia[] = [
  ...TITLES.map(([title, badge], index): MockMedia => ({ id: `m${index}`, title, badge, favorite: index % 5 === 2, tint: TINTS[index]! })),
  { id: 'v0', title: 'Tunnel loop', badge: 'BG VIDEO', video: true, tint: ['#05080f', '#2a6fb0'] },
  { id: 'v1', title: 'Cube field', badge: 'VID', video: true, favorite: true, tint: ['#04101a', '#3fd6e8'] },
  { id: 'v2', title: 'Laser sweep', badge: 'VID', video: true, tint: ['#070a18', '#6f6fe8'] },
  { id: 'v3', title: 'Haze drift', badge: 'VID', video: true, tint: ['#0a0f10', '#8fb0b8'] },
]
const SELECTED_ID = 'm17'

// The Layers tab lists what the preset declares: Electric Storm's manifest is compiled with the production compiler, so
// the row (and any layer the preset gains) is exactly what the app's Layers tab shows for it, with no runtime started.
const ELECTRIC_STORM_LAYERS = (() => {
  const manifest = cinema2NativePresetRegistry.list().find(preset => preset.metadata.name === 'Electric Storm')
  return (manifest && compileCinema2NativePreset(manifest).plan?.scene.layers) || []
})()

function thumbnailStyle([dark, light]: [string, string]): CSSProperties {
  return { background: `radial-gradient(ellipse at 50% 38%, ${light}, ${dark} 72%)` }
}

export function LayoutLabElectricStormLeftWindow({ appearance }: { appearance?: 'midnight' } = {}) {
  const displayTabs = <T extends { label: string }>(tabs: T[]) => appearance === 'midnight' ? tabs.map(item => ({ ...item, label: item.label[0] + item.label.slice(1).toLowerCase() })) : tabs
  const [tab, setTab] = useState<'source' | 'layers' | 'notice'>('source')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedId, setSelectedId] = useState(SELECTED_ID)
  const EngineIcon = getReactEngineIconComponent('cinema2')

  const visible = useMemo(() => MEDIA.filter(item => {
    if (filter === 'images' && item.video) return false
    if (filter === 'videos' && !item.video) return false
    if (filter === 'favorites' && !item.favorite) return false
    return !query.trim() || item.title.toLowerCase().includes(query.trim().toLowerCase())
  }), [filter, query])

  return (
    <>
      <RailWindowHeader
        side="left"
        icon={<AppIcon kind="grid" size={15} color="currentColor" aria-hidden="true" />}
        label="React Workspace"
      />
      <div className="rv-left-workspace-shell" data-description-density="compact">
        <section className="rv-context-workspace" aria-label="Cinema 2.0 workspace">
          <header className="rv-context-workspace-header">
            <div className="rv-engine-dropdown">
              <div className="rv-engine-dropdown-trigger" aria-label="Selected React engine: Cinema 2.0, preset Electric Storm">
                <span className="rv-engine-dropdown-glow" aria-hidden="true" />
                <span className="rv-engine-dropdown-icon" aria-hidden="true"><EngineIcon /></span>
                <span className="rv-engine-dropdown-copy">
                  <span className="rv-engine-dropdown-eyebrow">Engine</span>
                  <span className="rv-engine-dropdown-label">Cinema 2.0</span>
                  <span className="rv-engine-dropdown-preset">Electric Storm</span>
                </span>
              </div>
            </div>
          </header>
          <div className="rv-workspace-tabs-wrap">
            <RailTabs
              tabs={displayTabs(LEFT_TABS)}
              activeTab={tab}
              onChange={setTab}
              ariaLabel="Cinema 2.0 workspace tabs"
              className="rv-context-workspace-tabs"
              variant="underline"
            />
          </div>
          <div className="rv-left-tab-body">
            <div className="rv-engine-viewport rv-inspector rv-inspector-scroll">
              {tab === 'source' ? (
                <div className="rv-ctrl-group">
                  <div className="rv-canvas-engine-panel">
                    <div className="rv-canvas-library-shell">
                      <div className="vz-panel vz-media-browser" style={{ flex: 1, minHeight: 0 }}>
                        <Collapsible label="Media Library" defaultOpen bodyClassName="vz-media-browser-collapsible-body">
                          <UnderlineTabs
                            tabs={displayTabs(FILTER_TABS)}
                            activeTab={filter}
                            onChange={setFilter}
                            ariaLabel="Media library filter"
                            className="vz-filter-tabs dv-underline-tabs--scroll"
                          />
                          <div className="vz-md-search-row">
                            <div className="vz-md-search-wrap">
                              <AppIcon kind="search" className="vz-md-search-icon" size="12" />
                              <DreamVizTextInput
                                className="vz-md-search-input"
                                type="text"
                                aria-label="Search media"
                                placeholder="Search media…"
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                              />
                            </div>
                            <div className="vz-md-view-toggles">
                              <button type="button" className={`vz-md-view-btn${viewMode === 'grid' ? ' vz-md-view-btn--active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view">
                                <AppIcon kind="grid" size={13} color="currentColor" />
                              </button>
                              <button type="button" className={`vz-md-view-btn${viewMode === 'list' ? ' vz-md-view-btn--active' : ''}`} onClick={() => setViewMode('list')} title="List view">
                                <AppIcon kind="list" size={13} color="currentColor" />
                              </button>
                            </div>
                          </div>
                          <div className="vz-media-scroll">
                            {filter === 'collections' ? (
                              <div className="vz-media-empty">No collections in this mockup.</div>
                            ) : viewMode === 'grid' ? (
                              <div className="vz-media-virtual">
                                <div className="vz-media-sheet ll-media-sheet" style={{ '--vz-sheet-tile': 'auto' } as CSSProperties}>
                                  {visible.map(item => (
                                    <div
                                      key={item.id}
                                      className={`vz-media-card vz-media-card--sheet vz-media-card--${item.video ? 'video' : 'image'}${selectedId === item.id ? ' vz-media-card--active' : ''}`}
                                      title={item.title}
                                      onClick={() => setSelectedId(item.id)}
                                    >
                                      <div className="vz-media-sheet-picture" style={thumbnailStyle(item.tint)} role="img" aria-label={item.title} />
                                      <span className="vz-media-type-badge">{item.badge}</span>
                                      <span className="vz-media-sheet-name">{item.title}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="vz-media-virtual">
                                <div className="vz-media-list">
                                  {visible.map(item => (
                                    <div key={item.id} className={`vz-media-row${selectedId === item.id ? ' vz-media-row--active' : ''}`} onClick={() => setSelectedId(item.id)}>
                                      <div className="vz-media-row-thumb"><div className="vz-media-sheet-picture" style={thumbnailStyle(item.tint)} /></div>
                                      <div className="vz-media-row-info">
                                        <span className="vz-media-row-name">{item.title}</span>
                                        <span className="vz-media-row-meta">{item.badge}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </Collapsible>
                      </div>
                    </div>
                  </div>
                </div>
              ) : tab === 'layers' ? (
                <Cinema2LayersList layers={ELECTRIC_STORM_LAYERS} />
              ) : (
                <LayoutLabNoticeTab />
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
