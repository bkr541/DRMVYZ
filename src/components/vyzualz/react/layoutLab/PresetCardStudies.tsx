import { useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import studyStyles from './presetCardStudies.css?inline'

// Original, unfiltered frames from the production Cinema 2.0 renderer.
// Refresh with scripts/generate-preset-artwork.mjs; never substitute blueprint art.
const PRESETS = [
  { id: 'drmvyz.cinema2.reactor', name: 'Reactor' },
  { id: 'drmvyz.cinema2.afterhours', name: 'Afterhours' },
  { id: 'drmvyz.cinema2.canopy', name: 'CANOPY' },
  { id: 'drmvyz.cinema2.psylo', name: 'PSYLO' },
] as const
const DESIGNS = [
  { id: 'poster', name: 'Cinema poster', detail: 'Edge-to-edge image · quiet overlay' },
  { id: 'print', name: 'Framed print', detail: 'Inset image · separate caption' },
  { id: 'gallery', name: 'Gallery tile', detail: 'Title first · uninterrupted image' },
  { id: 'strip', name: 'Compact strip', detail: 'Landscape thumbnail · side caption' },
  { id: 'monitor', name: 'Studio monitor', detail: 'Recessed screen · centered title' },
] as const

/** Five local design studies; card actions never select a live engine preset. */
export function PresetCardStudies() {
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  return <div className="ll-preset-studies" aria-label="Preset card design studies">
    <style>{studyStyles}</style>
    {DESIGNS.map((design, index) => <section className={`ll-preset-study ll-preset-study--${design.id}`} key={design.id} data-preset-study={design.id} aria-labelledby={`ll-preset-study-${design.id}`}>
      <header className="ll-preset-study-heading">
        <h2 id={`ll-preset-study-${design.id}`}><AppIcon kind="navPreset" size={14} /><span className="ll-preset-study-number">0{index + 1}</span>{design.name}</h2>
        <p>{design.detail}</p>
      </header>
      <div className="ll-preset-study-row" role="group" aria-label={`${design.name} preset cards`}>
        {PRESETS.map(preset => {
          const key = `${design.id}:${preset.id}`
          const active = selected[design.id] === preset.id
          const favorite = favorites.has(key)
          return <article className="ll-preset-card" key={preset.id} data-study-preset-id={preset.id} data-selected={active || undefined}>
            <button type="button" className="ll-preset-select" aria-label={`${design.name}: select ${preset.name}`} aria-pressed={active} onClick={() => setSelected(current => ({ ...current, [design.id]: preset.id }))}>
              <span className="ll-preset-image"><img src={new URL(`${import.meta.env.BASE_URL}preset-artwork/${encodeURIComponent(preset.id)}.webp`, window.location.href).href} alt={`${preset.name} — actual Cinema 2.0 render`} loading="lazy" decoding="async" width="480" height="270" /></span>
              <span className="ll-preset-copy"><span className="ll-preset-engine">Cinema 2.0</span><span className="ll-preset-name">{preset.name}</span><span className="ll-preset-selection" aria-hidden="true"><AppIcon kind="check" size={12} /></span></span>
            </button>
            <button type="button" className="ll-preset-favorite" aria-label={`${design.name}: ${favorite ? 'remove' : 'add'} ${preset.name} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} onClick={() => setFavorites(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })}><AppIcon kind="star" size={13} /></button>
          </article>
        })}
      </div>
    </section>)}
  </div>
}
