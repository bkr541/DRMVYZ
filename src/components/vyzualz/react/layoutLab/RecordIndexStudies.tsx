import { useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import { ContextActionMenu } from '../../context-menu/ContextActionMenu'
import { PresetBlueprintImage } from '../PresetBlueprintImage'
import { LibraryViewToggle, type LibraryView } from '../controls/LibraryViewToggle'
import type { PresetManagerRecord } from '../../presetManager/presetManagerCatalog'
import type { SavedAudioTrack } from '../../../../stores/audioStore'
import { LIBRARY_PRESETS, MODELS, TRACKS } from './recordListingData'
import { formatDuration } from './RecordPadStudies'

type Section = 'presets' | 'audio' | 'models'

/**
 * One row for every library. Every record reads the same three lines: an accent eyebrow (artist, engine or file format), the title, then its
 * facts. Most audio has no cover art, so only 3D Models, which always have a preview, carry a thumbnail; the text never depends on it.
 * Rows are separated by hairlines, not boxed; selection is a tint and an inset bar, never colour alone.
 */
function IndexRow({ section, view, selected, label, eyebrow, status, thumb, title, meta, actions, onSelect }: {
  section: Section
  view: LibraryView
  selected: boolean
  label: string
  eyebrow: string
  /** Shown at the end of the eyebrow line, e.g. the loaded track's dot. */
  status?: ReactNode
  /** A preview image; only 3D Models have one. */
  thumb?: ReactNode
  title: string
  meta?: ReactNode
  actions?: ReactNode
  onSelect: () => void
}) {
  return <article className="ll-idx-row" data-idx-row={section} data-view={view} data-selected={selected || undefined}>
    <button type="button" className="ll-idx-main" aria-label={label} aria-pressed={selected} title={title} onClick={onSelect}>
      {thumb && <span className="ll-idx-thumb" aria-hidden="true">{thumb}</span>}
      <span className="ll-idx-text">
        <span className="ll-idx-eyebrow"><span className="ll-idx-eyebrow-text">{eyebrow}</span>{status}</span>
        <strong className="ll-idx-title">{title}</strong>
        {meta}
      </span>
    </button>
    {actions && <span className="ll-idx-actions">{actions}</span>}
  </article>
}

function Fact({ icon, label, value }: { icon: AppIconKind; label: string; value?: string }) {
  return <li className="ll-idx-fact" title={value ? `${label}: ${value}` : label}>
    <AppIcon kind={icon} size={12} />
    {value ? <><span className="ll-idx-hidden">{label}: </span>{value}</> : <span className="ll-idx-hidden">{label}</span>}
  </li>
}

function Star({ name, active, onToggle }: { name: string; active: boolean; onToggle: () => void }) {
  return <button type="button" className="ll-idx-action ll-idx-star" aria-pressed={active} onClick={onToggle}
    aria-label={`${active ? 'Remove' : 'Add'} ${name} ${active ? 'from' : 'to'} favorites`}>
    <AppIcon kind={active ? 'star' : 'starOff'} size={14} color="currentColor" />
  </button>
}

function PresetIndexRow({ preset, view, selected, favorite, onSelect, onToggleFavorite }: {
  preset: PresetManagerRecord; view: LibraryView; selected: boolean; favorite: boolean; onSelect: () => void; onToggleFavorite: () => void
}) {
  const capabilities = [
    { label: 'Camera', icon: 'camera', available: preset.hasCamera },
    { label: 'User Media', icon: 'image', available: preset.canIntegrateUserMedia },
    { label: '3D Environment', icon: 'shader', available: preset.is3dEnvironment },
  ] as const
  const available = capabilities.filter(capability => capability.available)
  return <IndexRow section="presets" view={view} selected={selected} label={`Select ${preset.name}`} eyebrow={preset.engineName} title={preset.name} onSelect={onSelect}
    meta={available.length > 0 && <ul className="ll-idx-facts">{available.map(({ label, icon }) => <Fact key={label} icon={icon} label={label} />)}</ul>}
    actions={<Star name={preset.name} active={favorite} onToggle={onToggleFavorite} />} />
}

function AudioIndexRow({ track, view, selected, loaded, onSelect, onLoad }: {
  track: SavedAudioTrack; view: LibraryView; selected: boolean; loaded: boolean; onSelect: () => void; onLoad: () => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const facts = [
    track.durationSec ? { label: 'Duration', icon: 'clock', value: formatDuration(track.durationSec) } : null,
    track.bpm ? { label: 'BPM', icon: 'rhythm', value: String(track.bpm) } : null,
    track.musicalKey ? { label: 'Key', icon: 'music', value: track.musicalKey } : null,
  ].filter((fact): fact is { label: string; icon: AppIconKind; value: string } => fact !== null)
  return <IndexRow section="audio" view={view} selected={selected} label={`Select ${track.title}`} eyebrow={track.artist ?? 'Unknown artist'} title={track.title} onSelect={onSelect}
    status={loaded && <span className="ll-idx-loaded" role="img" aria-label="Loaded" title="Loaded" />}
    meta={facts.length > 0 && <ul className="ll-idx-facts">{facts.map(fact => <Fact key={fact.label} {...fact} />)}</ul>}
    actions={<>
      <button type="button" className="ll-idx-action" aria-haspopup="menu" title="More actions" aria-label={`More actions for ${track.title}`}
        onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setMenu({ x: rect.right, y: rect.bottom + 4 }) }}>
        <AppIcon kind="more" size={15} color="currentColor" />
      </button>
      {menu && <ContextActionMenu x={menu.x} y={menu.y} ariaLabel={`More actions for ${track.title}`} appearance="lyric-cue" onClose={() => setMenu(null)}
        items={[{ id: 'load', label: loaded ? 'Reload Track' : 'Load Track', onSelect: onLoad }]} />}
    </>} />
}

function ModelIndexRow({ model, view, selected, favorite, onSelect, onToggleFavorite }: {
  model: { id: string; name: string }; view: LibraryView; selected: boolean; favorite: boolean; onSelect: () => void; onToggleFavorite: () => void
}) {
  return <IndexRow section="models" view={view} selected={selected} label={`Select 3D model ${model.name}`} eyebrow="GLB" title={model.name} onSelect={onSelect}
    thumb={<PresetBlueprintImage presetId={model.id} />}
    meta={<ul className="ll-idx-facts"><Fact icon="layers" label="Version" value="v1" /></ul>}
    actions={<Star name={model.name} active={favorite} onToggle={onToggleFavorite} />} />
}

/** The third column: the same three libraries and records, one new row style for all of them. */
export function RecordIndexColumn() {
  const [views, setViews] = useState<Record<Section, LibraryView>>({ presets: 'list', audio: 'list', models: 'list' })
  const [selected, setSelected] = useState({ presets: LIBRARY_PRESETS[0].id, audio: TRACKS[0].id, models: MODELS[0].id })
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set())
  const [loaded, setLoaded] = useState<string | null>(TRACKS[0].id)
  const favorite = (id: string) => setFavorites(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const select = (section: Section, id: string) => setSelected(current => ({ ...current, [section]: id }))
  const group = (section: Section, title: string, icon: 'navPreset' | 'audioTrack' | 'layers', children: ReactNode) => <section className="ll-records-column" aria-labelledby={'ll-idx-' + section} data-idx-section={section} data-view={views[section]}>
    <header className="ll-records-heading">
      <h2 id={'ll-idx-' + section}><AppIcon kind={icon} size={15} />{title}</h2>
      <LibraryViewToggle view={views[section]} onChange={view => setViews(current => ({ ...current, [section]: view }))} />
    </header>
    <div className={'ll-idx-list ll-idx-list--' + views[section]}>{children}</div>
  </section>
  return <>
    {group('presets', 'Presets', 'navPreset', LIBRARY_PRESETS.map(preset => <PresetIndexRow key={preset.id} preset={preset} view={views.presets}
      selected={selected.presets === preset.id} favorite={favorites.has(preset.id)} onSelect={() => select('presets', preset.id)} onToggleFavorite={() => favorite(preset.id)} />))}
    {group('audio', 'Audio Tracks', 'audioTrack', TRACKS.map(track => <AudioIndexRow key={track.id} track={track} view={views.audio}
      selected={selected.audio === track.id} loaded={loaded === track.id} onSelect={() => select('audio', track.id)} onLoad={() => setLoaded(track.id)} />))}
    {group('models', '3D Models', 'layers', MODELS.map(model => <ModelIndexRow key={model.id + model.name} model={model} view={views.models}
      selected={selected.models === model.id} favorite={favorites.has('model-' + model.id)} onSelect={() => select('models', model.id)} onToggleFavorite={() => favorite('model-' + model.id)} />))}
  </>
}
