import { useState, type CSSProperties } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import studyStyles from './presetCardStudies.css?inline'

// Original, unfiltered frames from the production Cinema 2.0 renderer.
// Refresh with scripts/generate-preset-artwork.mjs; never substitute blueprint art.
// Each preset carries the colour and shortcut numeral a Performance Pad would: the infused studies (06–10) use them for the accent line, the
// outlined numeral and the strike halo.
const PRESETS = [
  { id: 'drmvyz.cinema2.reactor', name: 'Reactor', color: '#5993e8', key: '1', wrap: false },
  { id: 'drmvyz.cinema2.ancient-machine', name: 'Ancient Machine', color: '#c69d67', key: '2', wrap: true },
  { id: 'drmvyz.cinema2.canopy', name: 'CANOPY', color: '#64b98b', key: '3', wrap: false },
  { id: 'drmvyz.cinema2.electric-storm', name: 'Electric Storm', color: '#88b8e8', key: '4', wrap: true },
] as const
const DESIGNS = [
  { id: 'poster', name: 'Cinema classic', detail: 'Full-width thumbnail · name below the image', captioned: true },
  { id: 'print', name: 'Matte frame', detail: 'Full-bleed thumbnail · charcoal title fade', captioned: true },
  { id: 'gallery', name: 'Accent gallery', detail: 'Wide thumbnail · color seam', captioned: true },
  { id: 'strip', name: 'Light folio', detail: 'Panoramic thumbnail · light title band', captioned: true },
  { id: 'monitor', name: 'Studio panel', detail: 'Recessed thumbnail · inset rail', captioned: true },
  // 06–10: legacy Performance Pad treatments (accent line, outlined numeral, tinted selection, strike halo).
  { id: 'signal-poster', name: 'Signal poster', detail: 'Poster · centered title over a signal line · outlined numeral', infused: true },
  { id: 'rail-print', name: 'Rail print', detail: 'Framed print · accent rail · outlined numeral', infused: true },
  { id: 'underline-gallery', name: 'Underline gallery', detail: 'Title band · long recessed underline · watermark numeral', infused: true },
  { id: 'glow-strip', name: 'Glow strip', detail: 'Compact strip · colour wash · fine lower edge', infused: true },
  { id: 'backlit-monitor', name: 'Backlit monitor', detail: 'Recessed screen · signal line · perimeter halo on strike', infused: true },
  { id: 'asset-library', name: 'Asset library', detail: 'Full preview · charcoal frame', fresh: true },
  { id: 'compact-library', name: 'Compact library', detail: 'Square thumbnail · dense browsing', fresh: true },
  { id: 'immersive-library', name: 'Immersive gallery', detail: 'Large preview · contrast scrim · floating actions', fresh: true },
  // 14–16: the original production poster tile with three overlay legibility treatments.
  { id: 'poster-scrim', name: 'Poster · soft scrim', detail: 'Production poster · a dark scrim behind the title, clear at the edges', legible: true },
  { id: 'poster-plate', name: 'Poster · frosted band', detail: 'Production poster · a feathered band blurs the strip behind the title', legible: true },
  { id: 'poster-bar', name: 'Poster · outlined title', detail: 'Production poster · no background, a dark outline on the letters', legible: true },
  // 17–21: independent browsing layouts with different preview shapes and frames.
  { id: 'split-aperture', name: 'Split aperture', detail: 'Circular scene window · offset preview', fresh: true },
  { id: 'index-ticket', name: 'Index ticket', detail: 'Numbered spine · perforated divider', fresh: true },
  { id: 'panorama-dossier', name: 'Panorama dossier', detail: 'Panoramic scene · steel frame', fresh: true },
  { id: 'offset-sleeve', name: 'Offset sleeve', detail: 'Tilted image sleeve · layered backing', fresh: true },
  { id: 'lens-badge', name: 'Lens badge', detail: 'Centered circular preview · concentric frame', fresh: true },
] as const

/** Local design studies; card actions never select a live engine preset. */
export function PresetCardStudies() {
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  // A card is "struck" only while a pointer or key is held on it, exactly like a Performance Pad.
  const [hits, setHits] = useState<Set<string>>(new Set())
  const strike = (key: string) => setHits(current => new Set(current).add(key))
  const release = (key: string) => setHits(current => { if (!current.has(key)) return current; const next = new Set(current); next.delete(key); return next })
  return <div className="ll-preset-studies" aria-label="Preset card design studies">
    <style>{studyStyles}</style>
    {DESIGNS.map((design, index) => <section className={`ll-preset-study ll-preset-study--${design.id}${'infused' in design ? ' ll-preset-study--infused' : ''}${'captioned' in design ? ' ll-preset-study--captioned' : ''}`} key={design.id} data-preset-study={design.id} aria-labelledby={`ll-preset-study-${design.id}`}>
      <header className="ll-preset-study-heading">
        <h2 id={`ll-preset-study-${design.id}`}><AppIcon kind="navPreset" size={14} /><span className="ll-preset-study-number">{String(index + 1).padStart(2, '0')}</span>{design.name}</h2>
        <p>{design.detail}</p>
      </header>
      <div className="ll-preset-study-row" role="group" aria-label={`${design.name} preset cards`}>
        {PRESETS.map(preset => {
          const fresh = 'fresh' in design
          const key = `${design.id}:${preset.id}`
          const active = selected[design.id] === preset.id
          const favorite = favorites.has(key)
          return <article className={fresh ? 'll-library-card' : 'll-preset-card'} key={preset.id} data-study-preset-id={preset.id} data-selected={active || undefined} data-hit={hits.has(key) || undefined}
            style={{ '--study-card-color': preset.color } as CSSProperties}>
            <button type="button" className={fresh ? 'll-library-select' : 'll-preset-select'}
              onPointerDown={event => { if (event.button === 0) strike(key) }} onPointerUp={() => release(key)} onPointerCancel={() => release(key)} onPointerLeave={() => release(key)} onBlur={() => release(key)}
              onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') strike(key) }} onKeyUp={() => release(key)}
              aria-label={`${design.name}: select ${preset.name}`} aria-pressed={active} onClick={() => setSelected(current => ({ ...current, [design.id]: preset.id }))}>
              {design.id === 'index-ticket' && <span className="ll-library-index" aria-hidden="true">{preset.key.padStart(2, '0')}</span>}
              <span className={fresh ? 'll-library-preview' : 'll-preset-image'}><img src={new URL(`${import.meta.env.BASE_URL}preset-artwork/${encodeURIComponent(preset.id)}.webp`, window.location.href).href} alt="" loading="lazy" decoding="async" width="480" height="270" /></span>
              <span className={fresh ? 'll-library-copy' : 'll-preset-copy'}>
                <span className="ll-preset-name" data-two-line={preset.wrap || undefined}>{preset.name}</span>
                <span className={fresh ? 'll-library-selection' : 'll-preset-selection'} aria-hidden="true"><AppIcon kind="check" size={12} /></span>
                {!fresh && <span className="ll-preset-indicator" aria-hidden="true" />}
              </span>
              {!fresh && <span className="ll-preset-key" aria-hidden="true">{preset.key}</span>}
            </button>
            <button type="button" className={fresh ? 'll-library-favorite' : 'll-preset-favorite'} aria-label={`${design.name}: ${favorite ? 'remove' : 'add'} ${preset.name} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} onClick={() => setFavorites(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })}><AppIcon kind="star" size={13} /></button>
          </article>
        })}
      </div>
    </section>)}
  </div>
}
