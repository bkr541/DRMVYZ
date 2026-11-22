import { useId, type ReactNode } from 'react'
import { AppIcon } from '../../shared/icons/AppIcon'
import { ReactPresetArtwork } from '../react/ReactPresetCard'
import { ReactPresetThumbnail } from '../react/ReactPresetThumbnail'
import { DEFAULT_REACT_PRESETS, type ReactPreset } from '../react/ReactTypes'
import type { PresetManagerRecord } from './presetManagerCatalog'

const LIVE_ARTWORK_PRESETS = new Map(
  DEFAULT_REACT_PRESETS
    .filter(preset => preset.engine === 'oscilloscope' || preset.engine === 'pixGrid')
    .map(preset => [preset.id, preset]),
)

/**
 * The live artwork behind a preset's card, when it has one: oscilloscope and PixGrid presets render their own thumbnail, and a user-built PixGrid Deck (no
 * shipped artwork) renders one from its first image. Every other preset uses its shipped artwork image, so this returns undefined.
 */
export function presetArtworkBackdrop(preset: PresetManagerRecord): ReactNode | undefined {
  const livePreset = preset.activation === 'react' ? LIVE_ARTWORK_PRESETS.get(preset.sourceId) : undefined
  const deckPreset = preset.custom && preset.artwork === 'pixGrid' ? preset.sourceData as unknown as ReactPreset : undefined
  if (livePreset) return <ReactPresetThumbnail preset={livePreset} />
  if (deckPreset?.pixGridDeck) return <ReactPresetThumbnail preset={deckPreset} generationKey={deckPreset.pixGridDeck.thumbnailFingerprint} />
  return undefined
}

export function PresetLibraryArtwork({ preset, className }: { preset: PresetManagerRecord; className: string }) {
  return <ReactPresetArtwork id={preset.sourceId} className={className} backdrop={presetArtworkBackdrop(preset)} />
}

export function PresetLibraryCard({ preset, active, favorite, onSelect, onToggleFavorite }: { preset: PresetManagerRecord; active: boolean; favorite: boolean; onSelect: () => void; onToggleFavorite: () => void }) {
  const metadataId = useId()
  const capabilities = [
    { label: 'Camera', icon: 'camera', available: preset.hasCamera },
    { label: 'User Media', icon: 'image', available: preset.canIntegrateUserMedia },
    { label: '3D Environment', icon: 'shader', available: preset.is3dEnvironment },
  ] as const

  return (
    <article className={`pmv-card${active ? ' is-active' : ''}`} data-preset-id={preset.sourceId} data-preset-engine={preset.engineName}>
      <button className="pmv-card-main" type="button" onClick={onSelect} aria-label={`Select ${preset.name}`} aria-describedby={metadataId} aria-pressed={active}>
        <PresetLibraryArtwork preset={preset} className="pmv-thumbnail" />
        <span className="pmv-card-copy">
          <strong>{preset.name}</strong>
          <span className="pmv-card-meta" id={metadataId}>
            <span className="pmv-card-type">{preset.engineName}</span>
            <span className="pmv-card-capabilities">
              {capabilities.filter(capability => capability.available).map(({ label, icon }) => (
                <span key={label} className="pmv-capability-badge" role="img" aria-label={label} title={label}>
                  <AppIcon kind={icon} size={12} />
                </span>
              ))}
            </span>
          </span>
        </span>
      </button>
      <button className={`vz-media-star${favorite ? ' vz-media-star--active' : ''}`} type="button" onClick={onToggleFavorite} aria-label={`${favorite ? 'Remove' : 'Add'} ${preset.name} ${favorite ? 'from' : 'to'} favorites`}>
        <AppIcon kind={favorite ? 'star' : 'starOff'} size={13} color="currentColor" />
      </button>
    </article>
  )
}

