import { useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import { ContextActionMenu } from '../../context-menu/ContextActionMenu'
import { PresetBlueprintImage } from '../PresetBlueprintImage'
import { LibraryViewToggle, type LibraryView } from '../controls/LibraryViewToggle'
import type { PresetManagerRecord } from '../../presetManager/presetManagerCatalog'
import type { SavedAudioTrack } from '../../../../stores/audioStore'
import { LIBRARY_PRESETS, MODELS, TRACKS } from './recordListingData'

type Section = 'presets' | 'audio' | 'models'

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

/**
 * One record row for every library. List view is a dense two/three-line text row (title, secondary line, optional metadata line, supplemental
 * actions at the right). Most records (every audio track) have no cover art, so imagery appears only where the image is the choice: the 3D Models grid. Selection is a border, tint and inset bar,
 * never colour alone; hover and press only change the surface.
 */
function RecordRow({ section, view, selected, label, title, secondary, thumb, meta, actions, onSelect }: {
  section: Section
  view: LibraryView
  selected: boolean
  label: string
  title: string
  secondary: string
  /** Only the 3D Models grid shows imagery; every other row is text. */
  thumb?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  onSelect: () => void
}) {
  return <article className="ll-record-row" data-record-row={section} data-view={view} data-selected={selected || undefined}>
    <button type="button" className="ll-record-row-main" aria-label={label} aria-pressed={selected} title={title} onClick={onSelect}>
      {thumb && <span className="ll-record-row-thumb" aria-hidden="true">{thumb}</span>}
      <span className="ll-record-row-text">
        <strong className="ll-record-row-title">{title}</strong>
        <span className="ll-record-row-secondary">{secondary}</span>
        {meta}
      </span>
    </button>
    {actions && <span className="ll-record-row-actions">{actions}</span>}
  </article>
}

function MetaItem({ icon, label, value }: { icon: AppIconKind; label: string; value?: string }) {
  return <li className="ll-record-row-meta-item" title={value ? `${label}: ${value}` : label}>
    <AppIcon kind={icon} size={12} />
    <span className="ll-record-row-hidden">{label}: </span>
    {value}
  </li>
}

function PadStar({ name, active, onToggle }: { name: string; active: boolean; onToggle: () => void }) {
  return <button type="button" className="ll-record-row-action ll-record-row-star" aria-pressed={active} onClick={onToggle}
    aria-label={`${active ? 'Remove' : 'Add'} ${name} ${active ? 'from' : 'to'} favorites`}>
    <AppIcon kind={active ? 'star' : 'starOff'} size={14} color="currentColor" />
  </button>
}

function PresetPad({ preset, view, selected, favorite, onSelect, onToggleFavorite }: {
  preset: PresetManagerRecord; view: LibraryView; selected: boolean; favorite: boolean; onSelect: () => void; onToggleFavorite: () => void
}) {
  const capabilities = [
    { label: 'Camera', icon: 'camera', available: preset.hasCamera },
    { label: 'User Media', icon: 'image', available: preset.canIntegrateUserMedia },
    { label: '3D Environment', icon: 'shader', available: preset.is3dEnvironment },
  ] as const
  const available = capabilities.filter(capability => capability.available)
  return <RecordRow section="presets" view={view} selected={selected} label={`Select ${preset.name}`} title={preset.name} secondary={preset.engineName} onSelect={onSelect}
    meta={available.length > 0 && <ul className="ll-record-row-meta">{available.map(({ label, icon }) => <MetaItem key={label} icon={icon} label={label} />)}</ul>}
    actions={<PadStar name={preset.name} active={favorite} onToggle={onToggleFavorite} />} />
}

function AudioPad({ track, view, selected, loaded, onSelect, onLoad }: {
  track: SavedAudioTrack; view: LibraryView; selected: boolean; loaded: boolean; onSelect: () => void; onLoad: () => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const stats = [
    track.durationSec ? { label: 'Duration', icon: 'clock', value: formatDuration(track.durationSec) } : null,
    track.bpm ? { label: 'BPM', icon: 'rhythm', value: String(track.bpm) } : null,
    track.musicalKey ? { label: 'Key', icon: 'music', value: track.musicalKey } : null,
  ].filter((stat): stat is { label: string; icon: AppIconKind; value: string } => stat !== null)
  return <RecordRow section="audio" view={view} selected={selected} label={`Select ${track.title}`} title={track.title} secondary={track.artist ?? ''} onSelect={onSelect}
    meta={stats.length > 0 && <ul className="ll-record-row-meta">{stats.map(stat => <MetaItem key={stat.label} {...stat} />)}</ul>}
    actions={<>
      {loaded && <span className="ll-record-row-loaded" role="img" aria-label="Loaded" title="Loaded" />}
      <button type="button" className="ll-record-row-action" aria-haspopup="menu" title="More actions" aria-label={`More actions for ${track.title}`}
        onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setMenu({ x: rect.right, y: rect.bottom + 4 }) }}>
        <AppIcon kind="more" size={15} color="currentColor" />
      </button>
      {menu && <ContextActionMenu x={menu.x} y={menu.y} ariaLabel={`More actions for ${track.title}`} appearance="lyric-cue" onClose={() => setMenu(null)}
        items={[{ id: 'load', label: loaded ? 'Reload Track' : 'Load Track', onSelect: onLoad }]} />}
    </>} />
}

function ModelPad({ model, view, selected, favorite, onSelect, onToggleFavorite }: {
  model: { id: string; name: string }; view: LibraryView; selected: boolean; favorite: boolean; onSelect: () => void; onToggleFavorite: () => void
}) {
  return <RecordRow section="models" view={view} selected={selected} label={`Select 3D model ${model.name}`} title={model.name} secondary="GLB · v1" onSelect={onSelect}
    thumb={view === 'grid' ? <PresetBlueprintImage presetId={model.id} /> : undefined}
    actions={<PadStar name={model.name} active={favorite} onToggle={onToggleFavorite} />} />
}

/** The restyled column: the same three libraries and records as the production column beside it, drawn as rows. */
export function RecordPadColumn() {
  const [views, setViews] = useState<Record<Section, LibraryView>>({ presets: 'list', audio: 'list', models: 'grid' })
  const [selected, setSelected] = useState({ presets: LIBRARY_PRESETS[0].id, audio: TRACKS[0].id, models: MODELS[0].id })
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set())
  const [loaded, setLoaded] = useState<string | null>(null)
  const favorite = (id: string) => setFavorites(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const select = (section: Section, id: string) => setSelected(current => ({ ...current, [section]: id }))
  const group = (section: Section, title: string, icon: 'navPreset' | 'audioTrack' | 'layers', children: ReactNode) => <section className="ll-records-column" aria-labelledby={'ll-pads-' + section} data-record-row-section={section} data-view={views[section]}>
    <header className="ll-records-heading">
      <h2 id={'ll-pads-' + section}><AppIcon kind={icon} size={15} />{title}</h2>
      <LibraryViewToggle view={views[section]} onChange={view => setViews(current => ({ ...current, [section]: view }))} />
    </header>
    <div className={'ll-record-row-list ll-record-row-list--' + views[section]}>{children}</div>
  </section>
  return <>
    {group('presets', 'Presets', 'navPreset', LIBRARY_PRESETS.map(preset => <PresetPad key={preset.id} preset={preset} view={views.presets}
      selected={selected.presets === preset.id} favorite={favorites.has(preset.id)} onSelect={() => select('presets', preset.id)} onToggleFavorite={() => favorite(preset.id)} />))}
    {group('audio', 'Audio Tracks', 'audioTrack', TRACKS.map(track => <AudioPad key={track.id} track={track} view={views.audio}
      selected={selected.audio === track.id} loaded={loaded === track.id} onSelect={() => select('audio', track.id)} onLoad={() => setLoaded(track.id)} />))}
    {group('models', '3D Models', 'layers', MODELS.map(model => <ModelPad key={model.id + model.name} model={model} view={views.models}
      selected={selected.models === model.id} favorite={favorites.has('model-' + model.id)} onSelect={() => select('models', model.id)} onToggleFavorite={() => favorite('model-' + model.id)} />))}
  </>
}
