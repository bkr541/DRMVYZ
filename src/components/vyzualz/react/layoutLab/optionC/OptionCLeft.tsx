import { useMemo, useState } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { ELECTRIC_STORM_LAYERS, FILTER_TABS, MEDIA, SELECTED_ID, thumbnailStyle, type LibraryFilter } from '../LayoutLabElectricStormLeftWindow'
import { TONES } from '../LayoutLabNoticeTab'
import { OcGroup, OcKey, OcTabs } from './ocControls'

function Notices() {
  const [dismissed, setDismissed] = useState(new Set<string>())
  return <div data-layout-lab-notices>{TONES.map(sample => <OcGroup title={sample.label} key={sample.tone} icon="info">{['body', 'title', 'dismiss', 'open'].map(variant => {
    const id = `${sample.tone}:${variant}`
    return !dismissed.has(id) && <article key={id} className="oc-notice" data-tone={sample.tone}><i /><div><strong>{variant === 'title' ? sample.titleOnly : sample.title}</strong>{variant !== 'title' && <p>{sample.body}</p>}{variant === 'open' && <button type="button" aria-label="Open details">Open details <AppIcon kind="chevronRight" size={12} /></button>}</div>{['dismiss', 'open'].includes(variant) && <OcKey icon="close" label="Dismiss notice" onClick={() => setDismissed(current => new Set(current).add(id))} />}</article>
  })}</OcGroup>)}</div>
}
export function OptionCLeft() {
  const [tab, setTab] = useState<'source' | 'layers' | 'notice'>('source')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = useState(SELECTED_ID)
  const visible = useMemo(() => MEDIA.filter(item => !(filter === 'images' && item.video) && !(filter === 'videos' && !item.video) && !(filter === 'favorites' && !item.favorite) && item.title.toLowerCase().includes(query.trim().toLowerCase())), [filter, query])
  return <><header className="oc-panel-head"><span className="oc-caption">REACT WORKSPACE</span><h2>Make it move.</h2></header>
    <div className="oc-engine" aria-label="Selected React engine: Cinema 2.0, preset Electric Storm"><span><AppIcon kind="cinema" size={24} /></span><div><small>VISUAL ENGINE</small><strong>Cinema 2.0</strong><p><i className="oc-led" />Electric Storm</p></div></div>
    <OcTabs options={[{ id: 'source', label: 'Source', icon: 'navMedia' }, { id: 'layers', label: 'Layers', icon: 'layers' }, { id: 'notice', label: 'Notice', icon: 'info' }]} value={tab} onChange={setTab} label="Cinema 2.0 workspace tabs" />
    <div className="oc-left-content oc-scroll">{tab === 'source' ? <><OcGroup title="Media Library" icon="navMedia" detail={String(MEDIA.length)}>
      <div className="oc-filter" role="group" aria-label="Media library filter">{FILTER_TABS.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label[0] + item.label.slice(1).toLowerCase()}</button>)}</div>
      <div className="oc-library-tools"><label className="oc-search"><AppIcon kind="search" size={14} /><input aria-label="Search media" placeholder="Search your media…" value={query} onChange={event => setQuery(event.target.value)} /></label><OcKey icon={mode === 'grid' ? 'list' : 'grid'} label={mode === 'grid' ? 'List view' : 'Grid view'} onClick={() => setMode(value => value === 'grid' ? 'list' : 'grid')} /></div>
      {filter === 'collections' ? <p className="oc-empty">No collections in this mockup.</p> : !visible.length ? <p className="oc-empty">No media matches “{query}”.</p> : <div className={`oc-media oc-media--${mode}`}>{visible.map(item => <button type="button" className="oc-media-item" key={item.id} aria-pressed={selected === item.id} title={item.title} onClick={() => setSelected(item.id)}><span className="oc-media-art" style={thumbnailStyle(item.tint)} role="img" aria-label={item.title}><AppIcon kind={item.video ? 'play' : 'navMedia'} size={20} />{selected === item.id && <i><AppIcon kind="check" size={11} /></i>}</span><span className="oc-media-copy"><strong>{item.title}</strong><small>{item.badge}{item.favorite && <AppIcon kind="star" size={10} />}</small></span></button>)}</div>}
    </OcGroup></> : tab === 'layers' ? <OcGroup title="Layers" icon="layers" detail={String(ELECTRIC_STORM_LAYERS.length)}><div className="oc-layers">{ELECTRIC_STORM_LAYERS.map((layer, index) => <article className="oc-layer" key={layer.id}><span className="oc-layer-index">{String(index + 1).padStart(2, '0')}</span><div><AppIcon kind="layers" size={24} /><strong>{layer.label}</strong><p>{layer.role ? `${layer.role} · ` : ''}{layer.visible ? `${Math.round(layer.opacity * 100)}%` : 'Hidden'} · {layer.blendMode}</p></div><AppIcon kind="eye" size={16} /></article>)}</div></OcGroup> : <Notices />}</div>
    <footer className="oc-panel-foot"><i className="oc-led" /><span>Local design session</span></footer></>
}
