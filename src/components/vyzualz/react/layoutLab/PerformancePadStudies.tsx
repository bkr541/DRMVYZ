import { useState } from 'react'
import { PerformancePad } from '../controls/PerformancePad'
import { getPerformancePadColor } from '../ReactPerformancePads'
import { DEFAULT_PERFORMANCE_PADS } from '../ReactTypes'
import padStyles from '../controls/performancePad.css?inline'
import studyStyles from './performancePadStudies.css?inline'

/**
 * The production performance pad, and only that: the same `PerformancePad` component, in the same `.rv-pads-section` / `.rv-pads-grid` wrappers and with the same
 * default pads, colours and shortcuts the React workspace uses, at its two sizes: Full (the Performance Manager's expanded pads) and Compact (React's own footprint).
 * Selection stays local to each size and never triggers a production pad.
 */
const SIZES = [
  { id: 'full', name: 'Full', density: 'expanded', note: 'Expanded: the Performance Manager\'s pads, 94px minimum rows' },
  { id: 'compact', name: 'Compact', density: 'compact', note: 'Compact: React\'s own footprint, 40px rows' },
] as const
/** The first row of the production grid: five pads, four with a destination and one empty slot. */
const ROW = DEFAULT_PERFORMANCE_PADS.slice(0, 5)

export function PerformancePadStudies() {
  const [selected, setSelected] = useState<Record<string, string>>({ full: ROW[0]!.id, compact: ROW[0]!.id })
  return <div className="ll-pad-studies" aria-label="Performance pads, full and compact">
    {/* Layout Lab is a separate popup window that receives no app stylesheets, so the production pad's own CSS travels with the study. */}
    <style>{padStyles}</style>
    <style>{studyStyles}</style>
    {SIZES.map(size => <section className="ll-pad-study" key={size.id} data-pad-study={size.id} aria-labelledby={`ll-pad-study-${size.id}`}>
      <header className="ll-pad-study-heading">
        <h2 id={`ll-pad-study-${size.id}`}>{size.name}</h2>
        <p>{size.note}</p>
      </header>
      <div className={`rv-pads-section rv-pads-section--embedded${size.density === 'expanded' ? ' rv-pads-section--expanded' : ''}`}>
        <div className="rv-pads-grid" role="group" aria-label={`${size.name} performance pads`}>
          {ROW.map((pad, index) => {
            const hasDestination = Boolean(pad.presetId)
            return <PerformancePad key={pad.id} density={size.density} label={pad.label} shortcut={pad.keyBinding.toUpperCase()} color={getPerformancePadColor(pad, index)}
              data-pad-study-item={`${size.id}-${pad.id}`} data-empty={!hasDestination || undefined} className={!hasDestination ? 'rv-pad--empty' : ''}
              selected={hasDestination && selected[size.id] === pad.id} disabled={!hasDestination} aria-disabled={!hasDestination} title={hasDestination ? `${pad.label} [${pad.keyBinding.toUpperCase()}]` : 'Empty pad'}
              onActivate={() => setSelected(current => ({ ...current, [size.id]: pad.id }))} />
          })}
        </div>
      </div>
    </section>)}
  </div>
}
