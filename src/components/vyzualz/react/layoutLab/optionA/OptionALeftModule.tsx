import { useMemo, useState } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { getReactEngineIconComponent } from '../../reactEngineIcons'
import {
  ELECTRIC_STORM_LAYERS, FILTER_TABS, MEDIA, SELECTED_ID, thumbnailStyle, type LibraryFilter,
} from '../LayoutLabElectricStormLeftWindow'
import { OaBank, OaGroup, OaLed, OaSegments } from './oaControls'
import { OaRing } from './oaInstruments'
import { OptionANoticeTab } from './OptionANoticeTab'

// ── Option A · left module ─────────────────────────────────────────────────────────────────────────────────────
//
// The React workspace's left window, rebuilt: a window head with the title set large and light, an engine display (the
// identity ring with the engine and preset), a three-key bank (Source / Layers / Notice) and the tab bodies. The Media
// Library is Option A's own construction: segmented filter keys, an inset search display, two view keys and tiles that
// carry their caption under the picture. Layers are rack rows drawn from the compiled Electric Storm manifest (the same
// data production's Layers tab lists). The Notice tab is Option A's own card (a lit tone tile in an inset well) in every tone.

type LeftTab = 'source' | 'layers' | 'notice'
const LEFT_TABS = [
  { id: 'source', label: 'Source' },
  { id: 'layers', label: 'Layers' },
  { id: 'notice', label: 'Notice' },
] as const

export function OptionALeftModule() {
  const [tab, setTab] = useState<LeftTab>('source')
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
      <header className="oa-window-head">
        <span className="oa-window-head__kicker">Workspace</span>
        <h2 className="oa-window-head__title">React</h2>
        <AppIcon kind="grid" size={16} className="oa-window-head__icon" aria-hidden="true" />
      </header>

      <div className="oa-engine" role="group" aria-label="Selected React engine: Cinema 2.0, preset Electric Storm">
        <OaRing ratio={1} size={84} stroke={2.5} tone="ember" className="oa-engine__ring">
          <span className="oa-engine__icon"><EngineIcon /></span>
        </OaRing>
        <span className="oa-engine__copy">
          <span className="oa-engine__eyebrow">Engine</span>
          <strong className="oa-engine__name">Cinema 2.0</strong>
          <span className="oa-engine__preset"><OaLed on />Electric Storm</span>
        </span>
      </div>

      <OaBank items={LEFT_TABS} value={tab} onChange={setTab} ariaLabel="Cinema 2.0 workspace tabs" />

      <div className="oa-module__body">
        {tab === 'source' ? (
          <OaGroup label="Media Library" count={visible.length}>
            <OaSegments
              items={FILTER_TABS}
              value={filter}
              onChange={setFilter}
              ariaLabel="Media library filter"
            />
            <div className="oa-search">
              <label className="oa-search__field">
                <AppIcon kind="search" size={14} aria-hidden="true" />
                <input type="text" aria-label="Search media" placeholder="Search media" value={query} onChange={event => setQuery(event.target.value)} />
              </label>
              <div className="oa-search__views" role="group" aria-label="View">
                <button type="button" className="oa-iconkey oa-iconkey--sm" data-selected={viewMode === 'grid'} aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} title="Grid view"><AppIcon kind="grid" size={14} color="currentColor" /></button>
                <button type="button" className="oa-iconkey oa-iconkey--sm" data-selected={viewMode === 'list'} aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')} title="List view"><AppIcon kind="list" size={14} color="currentColor" /></button>
              </div>
            </div>
            {filter === 'collections' ? (
              <p className="oa-empty">No collections in this mockup.</p>
            ) : viewMode === 'grid' ? (
              <div className="oa-tiles">
                {visible.map(item => (
                  <button key={item.id} type="button" className="oa-tile" data-selected={selectedId === item.id} data-kind={item.video ? 'video' : 'image'} title={item.title} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}>
                    <span className="oa-tile__picture" style={thumbnailStyle(item.tint)} role="img" aria-label={item.title}>
                      <span className="oa-tile__badge">{item.badge}</span>
                      <OaLed on={selectedId === item.id} className="oa-tile__led" />
                    </span>
                    <span className="oa-tile__name">{item.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="oa-rows">
                {visible.map(item => (
                  <button key={item.id} type="button" className="oa-row" data-selected={selectedId === item.id} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}>
                    <span className="oa-row__thumb" style={thumbnailStyle(item.tint)} aria-hidden="true" />
                    <span className="oa-row__name">{item.title}</span>
                    <span className="oa-row__meta">{item.badge}</span>
                    <OaLed on={selectedId === item.id} />
                  </button>
                ))}
              </div>
            )}
          </OaGroup>
        ) : tab === 'layers' ? (
          <OaGroup label="Layers" count={ELECTRIC_STORM_LAYERS.length}>
            <div className="oa-rows" role="list" aria-label="Cinema 2.0 layers" data-cinema2-layers="scene">
              {ELECTRIC_STORM_LAYERS.map((layer, index) => {
                const role = layer.role ? `${layer.role} · ` : ''
                const status = `${role}${layer.visible ? `${Math.round(layer.opacity * 100)}%` : 'Hidden'} · ${layer.blendMode}`
                return (
                  <div key={layer.id} role="listitem" className="oa-row oa-row--layer" data-selected={index === 0} aria-label={`${layer.label}, ${status}`}>
                    <span className="oa-row__index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="oa-row__stack">
                      <span className="oa-row__name">{layer.label}</span>
                      <span className="oa-row__meta">{status}</span>
                    </span>
                    <OaLed on={layer.visible} />
                  </div>
                )
              })}
            </div>
          </OaGroup>
        ) : (
          <OptionANoticeTab />
        )}
      </div>
    </>
  )
}
