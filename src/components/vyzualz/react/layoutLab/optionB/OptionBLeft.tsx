import { useMemo, useState } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { ELECTRIC_STORM_LAYERS, FILTER_TABS, MEDIA, SELECTED_ID, thumbnailStyle, type LibraryFilter } from '../LayoutLabElectricStormLeftWindow'
import { TONES } from '../LayoutLabNoticeTab'
import { NoticeCard } from '../../controls/NoticeCard'
import { ObGroup, ObKey, ObTabs } from './obControls'

function Notices() {
  const [dismissed, setDismissed] = useState(new Set<string>())
  return <div data-layout-lab-notices>{TONES.map(sample => <ObGroup key={sample.tone} title={sample.label} icon="info">
    {['body', 'title', 'dismiss', 'open'].map(variant => {
      const id = `${sample.tone}:${variant}`
      return !dismissed.has(id) && <NoticeCard key={id} tone={sample.tone} title={variant === 'title' ? sample.titleOnly : sample.title} onDismiss={['dismiss', 'open'].includes(variant) ? () => setDismissed(current => new Set(current).add(id)) : undefined} onOpen={variant === 'open' ? () => {} : undefined} openLabel="Open details" dismissLabel="Dismiss notice">{variant === 'title' ? sample.supportingText : sample.body}</NoticeCard>
    })}
  </ObGroup>)}</div>
}

export function OptionBLeft() {
  const [tab, setTab] = useState<'source' | 'layers' | 'notice'>('source')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = useState(SELECTED_ID)
  const visible = useMemo(() => MEDIA.filter(item => !(filter === 'images' && item.video) && !(filter === 'videos' && !item.video) && !(filter === 'favorites' && !item.favorite) && item.title.toLowerCase().includes(query.trim().toLowerCase())), [filter, query])
  return <>
    <header className="ob-panel-heading"><div><span className="ob-eyebrow">CREATE / 01</span><h2>Workspace</h2></div><AppIcon kind="grid" size={18} /></header>
    <div className="ob-engine" aria-label="Selected React engine: Cinema 2.0, preset Electric Storm"><span className="ob-engine-icon"><AppIcon kind="cinema" size={25} /></span><div><small>VISUAL ENGINE</small><strong>Cinema 2.0</strong><span><i className="ob-dot" />Electric Storm</span></div><span className="ob-engine-number">02</span></div>
    <ObTabs options={[{ id: 'source', label: 'Source' }, { id: 'layers', label: 'Layers' }, { id: 'notice', label: 'Notice' }]} value={tab} onChange={setTab} label="Cinema 2.0 workspace tabs" />
    <div className="ob-left-content ob-scroll">
      {tab === 'source' ? <ObGroup title="Media Library" icon="navMedia" index={String(MEDIA.length)}>
        <div className="ob-library-filters" role="group" aria-label="Media library filter">{FILTER_TABS.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label[0] + item.label.slice(1).toLowerCase()}</button>)}</div>
        <div className="ob-library-tools"><label className="ob-search"><AppIcon kind="search" size={14} /><input aria-label="Search media" placeholder="Find media…" value={query} onChange={event => setQuery(event.target.value)} /></label><ObKey icon={mode === 'grid' ? 'list' : 'grid'} label={mode === 'grid' ? 'List view' : 'Grid view'} onClick={() => setMode(value => value === 'grid' ? 'list' : 'grid')} /></div>
        {filter === 'collections' ? <p className="ob-empty">No collections in this mockup.</p> : !visible.length ? <p className="ob-empty">No media matches “{query}”.</p> : <div className={`ob-media ob-media--${mode}`}>{visible.map((item, index) => <button type="button" className="ob-media-item" key={item.id} aria-pressed={selected === item.id} data-kind={item.video ? 'video' : 'image'} title={item.title} onClick={() => setSelected(item.id)}>
          <span className="ob-media-art" style={thumbnailStyle(item.tint)} role="img" aria-label={item.title}><AppIcon kind={item.video ? 'play' : 'navMedia'} size={22} /><span>{String(index + 1).padStart(2, '0')}</span>{selected === item.id && <i><AppIcon kind="check" size={12} /></i>}</span>
          <span className="ob-media-copy"><strong>{item.title}</strong><small>{item.badge}{item.favorite && <AppIcon kind="star" size={10} />}</small></span>
        </button>)}</div>}
      </ObGroup> : tab === 'layers' ? <ObGroup title="Layers" icon="layers" index={String(ELECTRIC_STORM_LAYERS.length).padStart(2, '0')}><div className="ob-layer-list">{ELECTRIC_STORM_LAYERS.map((layer, index) => <div className="ob-layer" key={layer.id}><span>0{index + 1}</span><AppIcon kind="layers" size={18} /><div><strong>{layer.label}</strong><small>{layer.role ? `${layer.role} · ` : ''}{layer.visible ? `${Math.round(layer.opacity * 100)}%` : 'Hidden'} · {layer.blendMode}</small></div><AppIcon kind="eye" size={16} /></div>)}</div></ObGroup> : <Notices />}
    </div>
    <footer className="ob-panel-foot"><i className="ob-dot" /><span>Local design session</span><span>OPTION B</span></footer>
  </>
}
