import { useState, type CSSProperties } from 'react'
import studyStyles from './performancePadStudies.css?inline'

const DESIGNS = [
  { id: 'edge', name: 'Edge glow' },
  { id: 'signal', name: 'Signal strip' },
  { id: 'hardware', name: 'Hardware keys' },
  { id: 'cut', name: 'Cut corners' },
  { id: 'type', name: 'Type grid' },
] as const
const PADS = [
  { id: 'reactor', name: 'Reactor', key: '1', color: '#5993e8' },
  { id: 'drop-cage', name: 'Drop Cage', key: '2', color: '#df706d' },
  { id: 'infinity', name: 'Infinity', key: '3', color: '#64b98b' },
  { id: 'tunnel', name: 'Tunnel', key: '4', color: '#d9a35e' },
] as const

/** Visual studies only; selection stays local and never triggers a production pad. */
export function PerformancePadStudies() {
  const [selected, setSelected] = useState<Record<string, string>>({ edge: 'reactor', signal: 'reactor', hardware: 'reactor', cut: 'reactor', type: 'reactor' })
  return <div className="ll-pad-studies" aria-label="Performance pad design studies">
    <style>{studyStyles}</style>
    {DESIGNS.map((design, index) => <section className={`ll-pad-study ll-pad-study--${design.id}`} key={design.id} data-pad-study={design.id} aria-labelledby={`ll-pad-study-${design.id}`}>
      <header className="ll-pad-study-heading">
        <h2 id={`ll-pad-study-${design.id}`}><svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor"><rect x="2" y="2" width="5" height="5" /><rect x="12" y="2" width="5" height="5" /><rect x="2" y="12" width="5" height="5" /><rect x="12" y="12" width="5" height="5" /></svg>{String(index + 1).padStart(2, '0')} · {design.name}</h2>
      </header>
      <div className="ll-pad-study-row" role="group" aria-label={`${design.name} performance pads`}>
        {PADS.map(pad => <button key={pad.id} type="button" className="ll-study-pad" aria-pressed={selected[design.id] === pad.id} aria-label={`${design.name}: ${pad.name}, shortcut ${pad.key}`} style={{ '--study-pad-color': pad.color } as CSSProperties} data-pad-study-item={`${design.id}-${pad.id}`} onClick={() => setSelected(current => ({ ...current, [design.id]: pad.id }))}>
          <span className="ll-study-pad-indicator" aria-hidden="true" />
          <span className="ll-study-pad-label">{pad.name}</span>
          <span className="ll-study-pad-key">{pad.key}</span>
          <span className="ll-study-pad-status" aria-hidden="true">{selected[design.id] === pad.id ? 'Selected' : 'Ready'}</span>
        </button>)}
      </div>
    </section>)}
  </div>
}
