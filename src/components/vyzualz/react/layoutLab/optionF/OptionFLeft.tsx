import { useMemo, useState } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { ELECTRIC_STORM_LAYERS, FILTER_TABS, MEDIA, SELECTED_ID, thumbnailStyle, type LibraryFilter } from '../LayoutLabElectricStormLeftWindow'
import { TONES } from '../LayoutLabNoticeTab'
import { OfGroup, OfIdentity, OfKey, OfPanelHead, OfSegmented } from './ofControls'

const TONE_ICON = { info: 'info', success: 'check', warning: 'warning', error: 'close' } as const

function Notices() {
  const [dismissed, setDismissed] = useState(new Set<string>())
  return <div data-layout-lab-notices>{TONES.map(sample => <OfGroup title={sample.label} key={sample.tone} icon="info">{['body', 'title', 'dismiss', 'open'].map(variant => {
    const id = `${sample.tone}:${variant}`
    return !dismissed.has(id) && <article key={id} className="of-notice" data-tone={sample.tone}>
      <span className="of-badge"><AppIcon kind={TONE_ICON[sample.tone as keyof typeof TONE_ICON] ?? 'info'} size={16} /></span>
      <div><strong>{variant === 'title' ? sample.titleOnly : sample.title}</strong>{variant !== 'title' && <p>{sample.body}</p>}{variant === 'open' && <button type="button" aria-label="Open details">Open details <AppIcon kind="chevronRight" size={12} /></button>}</div>
      {['dismiss', 'open'].includes(variant) && <OfKey icon="close" label="Dismiss notice" onClick={() => setDismissed(current => new Set(current).add(id))} />}
    </article>
  })}</OfGroup>)}</div>
}

export function OptionFLeft() {
  const [tab, setTab] = useState<'source' | 'layers' | 'notice'>('source')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = useState(SELECTED_ID)
  const visible = useMemo(() => MEDIA.filter(item => !(filter === 'images' && item.video) && !(filter === 'videos' && !item.video) && !(filter === 'favorites' && !item.favorite) && item.title.toLowerCase().includes(query.trim().toLowerCase())), [filter, query])
  return <>
    <OfPanelHead icon="navReact" title="React Workspace" subtitle="Cinema 2.0" />
    <div className="of-engine" aria-label="Selected React engine: Cinema 2.0, preset Electric Storm">
      <OfIdentity icon="cinema" title="Cinema 2.0" subtitle="Electric Storm"><i className="of-led" /></OfIdentity>
    </div>
    <OfSegmented options={[{ id: 'source', label: 'Source', icon: 'navMedia' }, { id: 'layers', label: 'Layers', icon: 'layers' }, { id: 'notice', label: 'Notice', icon: 'info' }]} value={tab} onChange={setTab} label="Cinema 2.0 workspace tabs" />
    <div className="of-left-content of-scroll">{tab === 'source'
      ? <OfGroup title="Media Library" icon="navMedia" detail={String(MEDIA.length)}>
        <div className="of-filter" role="group" aria-label="Media library filter">{FILTER_TABS.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label[0] + item.label.slice(1).toLowerCase()}</button>)}</div>
        <div className="of-library-tools"><label className="of-search"><AppIcon kind="search" size={14} /><input aria-label="Search media" placeholder="Search your media…" value={query} onChange={event => setQuery(event.target.value)} /></label><OfKey icon={mode === 'grid' ? 'list' : 'grid'} label={mode === 'grid' ? 'List view' : 'Grid view'} onClick={() => setMode(value => value === 'grid' ? 'list' : 'grid')} /></div>
        {filter === 'collections' ? <p className="of-empty">No collections in this mockup.</p> : !visible.length ? <p className="of-empty">No media matches “{query}”.</p>
          : <div className={`of-media of-media--${mode}`}>{visible.map(item => <button type="button" className="of-media-item" key={item.id} aria-pressed={selected === item.id} title={item.title} onClick={() => setSelected(item.id)}>
            <span className="of-media-art" style={thumbnailStyle(item.tint)} role="img" aria-label={item.title}><AppIcon kind={item.video ? 'play' : 'navMedia'} size={18} />{selected === item.id && <i><AppIcon kind="check" size={11} /></i>}</span>
            <span className="of-media-copy"><strong>{item.title}</strong><small>{item.badge}{item.favorite && <AppIcon kind="star" size={10} />}</small></span>
          </button>)}</div>}
      </OfGroup>
      : tab === 'layers'
        ? <OfGroup title="Layers" icon="layers" detail={String(ELECTRIC_STORM_LAYERS.length)}><div className="of-layers">{ELECTRIC_STORM_LAYERS.map((layer, index) => <article className="of-layer" key={layer.id}>
          <span className="of-badge"><AppIcon kind="layers" size={17} /></span>
          <div><strong>{layer.label}</strong><p>{layer.role ? `${layer.role} · ` : ''}{layer.visible ? `${Math.round(layer.opacity * 100)}%` : 'Hidden'} · {layer.blendMode}</p></div>
          <span className="of-layer-index">{String(index + 1).padStart(2, '0')}</span><AppIcon kind="eye" size={16} />
        </article>)}</div></OfGroup>
        : <Notices />}</div>
  </>
}
