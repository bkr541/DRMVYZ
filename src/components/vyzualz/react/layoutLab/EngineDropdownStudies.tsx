import { useState, type CSSProperties } from 'react'
import { ReactEngineCardContents } from '../ReactEngineBrowser'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../reactEngineCatalog'
import studyStyles from './engineDropdownStudies.css?inline'

/**
 * Five treatments of the engine dropdown's option card. Every row keeps the application's own identity — dark panel
 * surfaces, the cyan primary, 1px hairline borders, the 4px corner, the shared engine eyebrow/label type roles and
 * the blueprint artwork — and every option is the production size (330 × 84px, from the 354px rail's 12px inset).
 * The rows differ in structure: where the artwork sits, how the surface is built, and how selection is signalled.
 * `compact` rows use the shared compact engine label role.
 */
const ROWS = [
  { id: 'rail', name: 'Accent rail', detail: 'Flat panel row · primary rail on the left · small blueprint at right', compact: true },
  { id: 'tile', name: 'Icon tile', detail: 'Blueprint in a framed chip · two-line text block · index', compact: true },
  { id: 'wash', name: 'Spotlight wash', detail: 'Edge-to-edge artwork · strong primary wash · large title', compact: false },
  { id: 'grid', name: 'Drafting grid', detail: 'Full grid field · corner ticks · artwork centred right', compact: true },
  { id: 'inset', name: 'Recessed well', detail: 'Darker inset surface · ghosted artwork · underline that fills on selection', compact: false },
] as const

/** Visual studies only; choosing an option marks it locally and never changes the real engine. */
export function EngineDropdownStudies() {
  const [selected, setSelected] = useState<Record<string, string>>(Object.fromEntries(ROWS.map(row => [row.id, REACT_ENGINE_IDS[0]])))
  return <div className="ll-eng-studies" aria-label="Engine dropdown design studies">
    <style>{studyStyles}</style>
    {ROWS.map(row => <section key={row.id} className={`ll-eng-row ll-eng-row--${row.id}`} data-engine-study={row.id} aria-labelledby={`ll-eng-study-${row.id}`}>
      <header className="ll-eng-heading">
        <h2 id={`ll-eng-study-${row.id}`}>{row.name}</h2>
        <p>{row.detail}</p>
      </header>
      <div className="ll-eng-strip" role="listbox" aria-label={`${row.name} engine options`}>
        {REACT_ENGINE_IDS.map((engineId, index) => <div className="ll-eng-cell" key={engineId}>
          <button type="button" role="option" aria-selected={selected[row.id] === engineId}
            className={`rv-engine-card ll-eng-card${row.compact ? ' rv-engine-card--compact' : ''}`} data-engine={engineId}
            data-engine-study-item={`${row.id}-${engineId}`} title={REACT_ENGINE_CATALOG[engineId].description} style={{ '--i': index } as CSSProperties}
            onClick={() => setSelected(current => ({ ...current, [row.id]: engineId }))}>
            <ReactEngineCardContents engineId={engineId} pixelLabel={engineId === 'pixGrid'} />
            <span className="ll-eng-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}<i>/{String(REACT_ENGINE_IDS.length).padStart(2, '0')}</i></span>
            <span className="ll-eng-mark" aria-hidden="true" />
          </button>
        </div>)}
      </div>
    </section>)}
  </div>
}
