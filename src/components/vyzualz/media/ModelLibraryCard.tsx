import type { ReactNode } from 'react'
import { AppIcon } from '../../shared/icons/AppIcon'

/** Presentation shared by the production library and isolated visual previews. */
export function ModelLibraryCard({ name, type, view, selected, preview, onSelect, favorite, favoriteDisabled, onToggleFavorite }: {
  name: string
  type: string
  view: 'grid' | 'list'
  selected: boolean
  preview: ReactNode
  onSelect(): void
  favorite?: boolean
  favoriteDisabled?: boolean
  onToggleFavorite?: () => void
}) {
  const grid = view === 'grid'
  return <div className={`mm-model-card ${grid ? 'vz-media-card vz-media-card--sheet' : 'mm-model-card--list'}`}>
    <button type="button" className="mm-model-card-select" aria-label={`Select 3D model ${name}`} aria-pressed={selected} title={name} onClick={onSelect}>
      <span className="mm-model-card-preview">{preview}</span>
      {grid ? <>
        <span className="vz-media-type-badge" title={type}>{type}</span>
        <span className="vz-media-sheet-name">{name}</span>
      </> : <span className="mm-model-card-text">
        <span className="mm-model-card-name" title={name}>{name}</span>
        <span className="mm-model-card-type">{type}</span>
      </span>}
    </button>
    {onToggleFavorite && <button type="button" className="mm-model-favorite" aria-label={`Favorite model ${name}`} aria-pressed={favorite}
      disabled={favoriteDisabled} onClick={onToggleFavorite}><AppIcon kind="star" size={12} /></button>}
  </div>
}
