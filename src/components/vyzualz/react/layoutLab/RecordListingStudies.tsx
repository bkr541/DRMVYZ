import { useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { ReactPresetCard } from '../ReactPresetCard'
import { PresetBlueprintImage } from '../PresetBlueprintImage'
import { AudioTrackCard } from '../../media/AudioTrackCard'
import { ModelLibraryCard } from '../../media/ModelLibraryCard'
import { LibraryViewToggle, type LibraryView } from '../controls/LibraryViewToggle'
import type { SavedAudioTrack } from '../../../../stores/audioStore'
import appearance from '../../../../styles/appearance.css?inline'
import mediaStyles from '../../../../styles/vyzualz.css?inline'
import presetStyles from '../../../../styles/reactView.css?inline'
import modelStyles from '../../../../styles/mediaManager.css?inline'
import lyricStyles from '../../../../styles/lyricManager.css?inline'
import headerStyles from '../../layout/HeaderControlGroup.css?inline'
import viewStyles from '../controls/LibraryViewToggle.css?inline'
import styles from './recordListingStudies.css?inline'

const RECORDS = [
  { id: 'drmvyz.cinema2.reactor', name: 'Reactor' },
  { id: 'drmvyz.cinema2.glassfall', name: 'GLASSFALL' },
  { id: 'drmvyz.cinema2.bwc', name: 'BWC' },
  { id: 'drmvyz.cinema2.chamber', name: 'CHAMBER' },
]
const TRACKS: SavedAudioTrack[] = ['Afterhours', 'Midnight Circuit', 'Signal Drift', 'Closing Time'].map((title, index) => ({
  id: 'lab-audio-' + index, dbId: 'lab-audio-' + index, title, artist: 'DVYDRM',
  fileName: title + '.wav', storagePath: null, durationSec: 240 + index * 27,
  sampleRate: 48000, channels: 2, fileSizeByte: null, mimeType: 'audio/wav',
  transcriptionAssets: null, genre: 'Electronic', bpm: 124 + index * 2,
  musicalKey: ['Am', 'Fm', 'Cm', 'Dm'][index], createdAt: '2026-01-01T00:00:00Z',
}))
const MODELS = [RECORDS[3], { ...RECORDS[0], name: 'Reactor Assembly' }, { id: 'drmvyz.cinema2.crate-moire-orb', name: 'Moire Orb' }, { ...RECORDS[1], name: 'Glass Sculpture' }]
// Scope the actual production CSS to this study. Production controls share
// presentation, while all data, selection and actions stay local to the lab.
const productionStyles = '@scope (.ll-records) {' + [appearance, mediaStyles, presetStyles, modelStyles, lyricStyles, headerStyles, viewStyles].join('\n').replaceAll(':root', ':scope') + '}'

export function RecordListingStudies() {
  const fontStylesheet = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com/css2"]')?.href
  const [views, setViews] = useState<Record<string, LibraryView>>({ presets: 'grid', audio: 'list', models: 'grid' })
  const [selected, setSelected] = useState({ presets: RECORDS[0].id, audio: TRACKS[0].id, models: MODELS[0].id })
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set())
  const [loaded, setLoaded] = useState<string | null>(null)
  const favorite = (id: string) => setFavorites(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const select = (section: keyof typeof selected, id: string) => setSelected(current => ({ ...current, [section]: id }))
  const heading = (id: string, title: string, icon: 'navPreset' | 'audioTrack' | 'layers') => <header className="ll-records-heading">
    <h2 id={'ll-records-' + id}><AppIcon kind={icon} size={15} />{title}</h2>
    <LibraryViewToggle view={views[id]} onChange={view => setViews(current => ({ ...current, [id]: view }))} />
  </header>
  return <div className="ll-records" data-theme="dark" aria-label="Record Listing studies">
    {fontStylesheet && <link rel="stylesheet" href={fontStylesheet} />}
    <style>{productionStyles + styles}</style>
    <section className="ll-records-column" aria-labelledby="ll-records-presets" data-record-section="presets" data-view={views.presets}>
      {heading('presets', 'Presets', 'navPreset')}
      <div className={'ll-records-items ll-records-items--' + views.presets} data-preset-grid data-preset-columns={views.presets === 'grid' ? 2 : 1}>
        {RECORDS.map(preset => <ReactPresetCard key={preset.id} id={preset.id} title={preset.name} description="Cinema 2.0" layout={views.presets === 'grid' ? 'poster' : 'row'}
          thumbnail={<PresetBlueprintImage presetId={preset.id} />} chips={[{ label: 'Cinema 2.0' }]}
          isActive={selected.presets === preset.id} isFavorite={favorites.has(preset.id)} activateLabel={'Preview ' + preset.name}
          onActivate={() => select('presets', preset.id)} onToggleFavorite={() => favorite(preset.id)} />)}
      </div>
    </section>
    <section className="ll-records-column" aria-labelledby="ll-records-audio" data-record-section="audio" data-view={views.audio}>
      {heading('audio', 'Audio Tracks', 'audioTrack')}
      <div className={views.audio === 'list' ? 'lmv-left-rail ll-records-audio-context' : 'll-records-audio-context'}>
        <div className={'ll-records-items ll-records-items--' + views.audio + (views.audio === 'list' ? ' lmv-track-grid' : '')}>
          {TRACKS.map(track => <div key={track.id} className={views.audio === 'list' ? 'lmv-track-group' : undefined}>
            <AudioTrackCard track={track} onSelect={() => select('audio', track.id)} isActive={selected.audio === track.id}
              onLoad={() => setLoaded(track.id)} loading={false} loaded={loaded === track.id} loadedDot playing={false}
              canLoad canOpenLyrics={false} canRemove={false} listRow={views.audio === 'list'} artistFirst={views.audio === 'list'} metadataIcons selectedBadge />
          </div>)}
        </div>
      </div>
    </section>
    <section className="ll-records-column" aria-labelledby="ll-records-models" data-record-section="models" data-view={views.models}>
      {heading('models', '3D Models', 'layers')}
      <div className={'ll-records-items ll-records-items--' + views.models + (views.models === 'grid' ? ' vz-media-sheet' : ' vz-media-list mm-model-card-list')}>
        {MODELS.map(model => <ModelLibraryCard key={model.id} name={model.name} type="GLB · v1" view={views.models} selected={selected.models === model.id}
          onSelect={() => select('models', model.id)} preview={<PresetBlueprintImage presetId={model.id} />}
          favorite={favorites.has('model-' + model.id)} onToggleFavorite={() => favorite('model-' + model.id)} />)}
      </div>
    </section>
  </div>
}
