import { useState, type CSSProperties } from 'react'
import { ReactEngineCardContents } from '../ReactEngineBrowser'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS, type ReactLiveEngineId } from '../reactEngineCatalog'
import studyStyles from './engineDropdownStudies.css?inline'

/**
 * Blueprint and image treatments use the production card dimensions and shared engine typography.
 */
const ROWS = [
  { id: 'rail', name: 'Accent rail', detail: 'Flat panel row · primary rail on the left · small blueprint at right', compact: true },
  { id: 'tile', name: 'Icon tile', detail: 'Blueprint in a framed chip · two-line text block · index', compact: true },
  { id: 'wash', name: 'Spotlight wash', detail: 'Edge-to-edge artwork · strong primary wash · large title', compact: false },
  { id: 'grid', name: 'Drafting grid', detail: 'Full grid field · corner ticks · artwork centred right', compact: true },
  { id: 'inset', name: 'Recessed well', detail: 'Darker inset surface · ghosted artwork · underline that fills on selection', compact: false },
  { id: 'cinema-still', name: 'Cinema still', detail: 'Full-bleed color with the title in the shadow', compact: false, artwork: true },
  { id: 'film-gate', name: 'Film gate', detail: 'Warm film frame with a separate title block', compact: true, artwork: true },
  { id: 'sleeve', name: 'Record sleeve', detail: 'Square cover art with a night-blue catalog label', compact: true, artwork: true },
  { id: 'lightbox', name: 'Lightbox', detail: 'Wide illuminated window with a bottom title rail', compact: true, artwork: true },
] as const

const ENGINE_ART: Record<ReactLiveEngineId, { src: string; accent: string; position: string }> = {
  cinema2: { src: '/preset-artwork/drmvyz.cinema2.conduit.webp', accent: '#87b9ff', position: '64% 52%' },
  oscilloscope: { src: '/layout-lab/sound-drawing.jpg', accent: '#76efb4', position: '88% 45%' },
  xyScope: { src: '/layout-lab/sound-drawing-xy.jpg', accent: '#cba7ff', position: '83% 49%' },
  canvas: { src: '/preset-artwork/canvas-fluidity.webp', accent: '#ffb1bb', position: '66% 55%' },
  laserDmx: { src: '/preset-artwork/dubstep-drop-lasers.webp', accent: '#f7a6e9', position: '69% 52%' },
  pixGrid: { src: '/layout-lab/pixgrid.jpg', accent: '#ffb366', position: '83% 68%' },
  headliner: { src: '/layout-lab/headliner.png', accent: '#52eef1', position: '75% 32%' },
}

/** Visual studies only; choosing an option marks it locally and never changes the real engine. */
export function EngineDropdownStudies() {
  const [selected, setSelected] = useState<Record<string, string>>(Object.fromEntries(ROWS.map(row => [row.id, REACT_ENGINE_IDS[0]])))
  return <div className="ll-eng-studies" aria-label="Engine dropdown design studies">
    <style>{studyStyles}</style>
    {ROWS.map(row => <section key={row.id} className={`ll-eng-row ll-eng-row--${row.id}`} data-engine-study={row.id}
      data-engine-study-artwork={'artwork' in row || undefined} aria-labelledby={`ll-eng-study-${row.id}`}>
      <header className="ll-eng-heading">
        <h2 id={`ll-eng-study-${row.id}`}>{row.name}</h2>
        <p>{row.detail}</p>
      </header>
      <div className="ll-eng-strip" role="listbox" aria-label={`${row.name} engine options`}>
        {REACT_ENGINE_IDS.map((engineId, index) => {
          const entry = REACT_ENGINE_CATALOG[engineId], art = ENGINE_ART[engineId]
          return <div className="ll-eng-cell" key={engineId}>
            <button type="button" role="option" aria-selected={selected[row.id] === engineId}
              className={`rv-engine-card ll-eng-card${row.compact ? ' rv-engine-card--compact' : ''}`} data-engine={engineId}
              data-engine-study-item={`${row.id}-${engineId}`} title={entry.description}
              style={{ '--i': index, '--ll-eng-art-accent': art.accent, '--ll-eng-art-position': art.position } as CSSProperties}
              onClick={() => setSelected(current => ({ ...current, [row.id]: engineId }))}>
              {'artwork' in row ? <>
                <span className="ll-eng-art"><img src={art.src} alt="" loading="lazy" decoding="async" /></span>
                <span className="rv-engine-dropdown-copy"><span className="rv-engine-dropdown-eyebrow">Engine</span><span className="rv-engine-dropdown-label">{entry.label}</span></span>
              </> : <>
                <ReactEngineCardContents engineId={engineId} pixelLabel={engineId === 'pixGrid'} />
                <span className="ll-eng-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}<i>/{String(REACT_ENGINE_IDS.length).padStart(2, '0')}</i></span>
              </>}
              <span className="ll-eng-mark" aria-hidden="true" />
            </button>
          </div>
        })}
      </div>
    </section>)}
  </div>
}
