import { useState, type CSSProperties } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import studyStyles from './presetCardStudies.css?inline'

// Original, unfiltered frames from the production Cinema 2.0 renderer.
// Refresh with scripts/generate-preset-artwork.mjs; never substitute blueprint art.
// Each preset carries the colour and shortcut numeral a Performance Pad would: the infused studies (06–10) use them for the accent line, the
// outlined numeral and the strike halo.
const PRESETS = [
  { id: 'drmvyz.cinema2.reactor', name: 'Reactor', color: '#5993e8', key: '1' },
  { id: 'drmvyz.cinema2.afterhours', name: 'Afterhours', color: '#df706d', key: '2' },
  { id: 'drmvyz.cinema2.canopy', name: 'CANOPY', color: '#64b98b', key: '3' },
  { id: 'drmvyz.cinema2.psylo', name: 'PSYLO', color: '#d9a35e', key: '4' },
] as const
const DESIGNS = [
  { id: 'poster', name: 'Cinema poster', detail: 'Edge-to-edge image · quiet overlay' },
  { id: 'print', name: 'Framed print', detail: 'Inset image · separate caption' },
  { id: 'gallery', name: 'Gallery tile', detail: 'Title first · uninterrupted image' },
  { id: 'strip', name: 'Compact strip', detail: 'Landscape thumbnail · side caption' },
  { id: 'monitor', name: 'Studio monitor', detail: 'Recessed screen · centered title' },
  // 06–10: the five card treatments above, infused with the Performance Pad styling (accent line, outlined numeral, tinted selection, strike halo).
  { id: 'signal-poster', name: 'Signal poster', detail: 'Poster · centered title over a signal line · outlined numeral', infused: true },
  { id: 'rail-print', name: 'Rail print', detail: 'Framed print · accent rail beside the caption · outlined numeral', infused: true },
  { id: 'underline-gallery', name: 'Underline gallery', detail: 'Title band · long recessed underline · watermark numeral', infused: true },
  { id: 'glow-strip', name: 'Glow strip', detail: 'Compact strip · colour wash · fine lower edge', infused: true },
  { id: 'backlit-monitor', name: 'Backlit monitor', detail: 'Recessed screen · signal line · perimeter halo on strike', infused: true },
] as const

/** Five local design studies; card actions never select a live engine preset. */
export function PresetCardStudies() {
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  // A card is "struck" only while a pointer or key is held on it, exactly like a Performance Pad.
  const [hits, setHits] = useState<Set<string>>(new Set())
  const strike = (key: string) => setHits(current => new Set(current).add(key))
  const release = (key: string) => setHits(current => { if (!current.has(key)) return current; const next = new Set(current); next.delete(key); return next })
  return <div className="ll-preset-studies" aria-label="Preset card design studies">
    <style>{studyStyles}</style>
    {DESIGNS.map((design, index) => <section className={`ll-preset-study ll-preset-study--${design.id}${'infused' in design ? ' ll-preset-study--infused' : ''}`} key={design.id} data-preset-study={design.id} aria-labelledby={`ll-preset-study-${design.id}`}>
      <header className="ll-preset-study-heading">
        <h2 id={`ll-preset-study-${design.id}`}><AppIcon kind="navPreset" size={14} /><span className="ll-preset-study-number">{String(index + 1).padStart(2, '0')}</span>{design.name}</h2>
        <p>{design.detail}</p>
      </header>
      <div className="ll-preset-study-row" role="group" aria-label={`${design.name} preset cards`}>
        {PRESETS.map(preset => {
          const key = `${design.id}:${preset.id}`
          const active = selected[design.id] === preset.id
          const favorite = favorites.has(key)
          return <article className="ll-preset-card" key={preset.id} data-study-preset-id={preset.id} data-selected={active || undefined} data-hit={hits.has(key) || undefined}
            style={{ '--study-card-color': preset.color } as CSSProperties}>
            <button type="button" className="ll-preset-select"
              onPointerDown={event => { if (event.button === 0) strike(key) }} onPointerUp={() => release(key)} onPointerCancel={() => release(key)} onPointerLeave={() => release(key)} onBlur={() => release(key)}
              onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') strike(key) }} onKeyUp={() => release(key)}
              aria-label={`${design.name}: select ${preset.name}`} aria-pressed={active} onClick={() => setSelected(current => ({ ...current, [design.id]: preset.id }))}>
              <span className="ll-preset-image"><img src={new URL(`${import.meta.env.BASE_URL}preset-artwork/${encodeURIComponent(preset.id)}.webp`, window.location.href).href} alt={`${preset.name} — actual Cinema 2.0 render`} loading="lazy" decoding="async" width="480" height="270" /></span>
              <span className="ll-preset-copy"><span className="ll-preset-engine">Cinema 2.0</span><span className="ll-preset-name">{preset.name}</span><span className="ll-preset-selection" aria-hidden="true"><AppIcon kind="check" size={12} /></span><span className="ll-preset-indicator" aria-hidden="true" /></span>
              <span className="ll-preset-key" aria-hidden="true">{preset.key}</span>
            </button>
            <button type="button" className="ll-preset-favorite" aria-label={`${design.name}: ${favorite ? 'remove' : 'add'} ${preset.name} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} onClick={() => setFavorites(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })}><AppIcon kind="star" size={13} /></button>
          </article>
        })}
      </div>
    </section>)}
  </div>
}
