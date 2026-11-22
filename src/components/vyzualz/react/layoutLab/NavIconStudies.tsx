import { useEffect, useState } from 'react'
import { NAV_ICON_DESTINATIONS, NAV_ICON_SYSTEMS, NavIconArtwork, type NavIconDestination } from './navIconSystems'
import studyStyles from './navIconStudies.css?inline'

const REACT_DESTINATION = { id: 'react', label: 'React' } as const
/** Only these systems are shown for now: 01 Hairline duotone and 02 Production bell style. The other systems' artwork stays in `navIconSystems.tsx`. */
const SHOWN_SYSTEMS = ['hairline', 'production'] as const
const STUDY_ROWS = SHOWN_SYSTEMS.map(id => NAV_ICON_SYSTEMS.find(system => system.id === id)!).map(system => ({
  ...system,
  destinations: [REACT_DESTINATION, ...NAV_ICON_DESTINATIONS.slice(1)],
}))

export const NAV_ICON_KEEP_STORAGE_KEY = 'drmvyz.layoutLab.navIcons.keep.v1'

/** The icons marked "keep", as `system-destination` ids. Unchecked icons are the ones to redo. */
function readKept(): ReadonlySet<string> {
  try {
    const value = JSON.parse(window.localStorage.getItem(NAV_ICON_KEEP_STORAGE_KEY) ?? 'null')
    if (value?.version === 1 && Array.isArray(value.kept)) {
      // The retired pad's Keep choice does not apply to its React replacement.
      return new Set(value.kept.filter((id: unknown): id is string => typeof id === 'string' && id !== 'hairline-pads'))
    }
  } catch { /* Unavailable or invalid storage starts with nothing kept. */ }
  return new Set()
}

/**
 * The icon system for the left navigation (01 Hairline duotone), six destinations. Every cell shows the artwork large (to judge the
 * paths) and as the real navigation item: the collapsed sidebar's 72px column with the 28px icon, the 3px active
 * edge and the active glow. Selection is local to a row.
 */
export function NavIconStudies() {
  const [active, setActive] = useState<Record<string, NavIconDestination>>(() => Object.fromEntries(STUDY_ROWS.map(row => [row.id, row.destinations[0].id])))
  const [kept, setKept] = useState(readKept)
  const [saveFailed, setSaveFailed] = useState(false)
  useEffect(() => {
    try { window.localStorage.setItem(NAV_ICON_KEEP_STORAGE_KEY, JSON.stringify({ version: 1, kept: [...kept] })); setSaveFailed(false) } catch { setSaveFailed(true) }
  }, [kept])
  const toggle = (id: string) => setKept(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const total = STUDY_ROWS.reduce((count, row) => count + row.destinations.length, 0)
  // Choices saved for rows that are no longer shown are kept in storage but not counted.
  const keptShown = STUDY_ROWS.reduce((count, row) => count + row.destinations.filter(d => kept.has(`${row.id}-${d.id}`)).length, 0)
  return <div className="ll-ni-studies" aria-label="Navigation icon studies">
    <style>{studyStyles}</style>
    <p className="ll-ni-summary" role="status" data-nav-icon-summary>
      <strong>{keptShown} of {total}</strong> kept · {total - keptShown} unchecked to redo
      {saveFailed && <span> · Choices could not be saved in this browser and will last only for this session.</span>}
    </p>
    {STUDY_ROWS.map((system, index) => <section key={system.id} className={`ll-ni-row ll-ni-row--${system.id}`} data-nav-icon-study={system.id} aria-labelledby={`ll-ni-${system.id}`}>
      <header className="ll-ni-heading">
        <h2 id={`ll-ni-${system.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{system.name}</h2>
        <p>{system.detail}<b className="ll-ni-count" data-nav-icon-count={system.id}>{system.destinations.filter(d => kept.has(`${system.id}-${d.id}`)).length}/{system.destinations.length} kept</b></p>
      </header>
      <div className="ll-ni-strip" role="group" aria-label={`${system.name} icons`}>
        {system.destinations.map(destination => <div className={`ll-ni-cell${kept.has(`${system.id}-${destination.id}`) ? ' is-kept' : ''}`} key={destination.id}>
          <label className="ll-ni-keep"><input type="checkbox" checked={kept.has(`${system.id}-${destination.id}`)} onChange={() => toggle(`${system.id}-${destination.id}`)}
            aria-label={`Keep ${destination.label}, ${system.name}`} data-nav-icon-keep={`${system.id}-${destination.id}`} /><span>Keep</span></label>
          <svg className="ll-ni-large" viewBox="0 0 32 32" width="64" height="64" aria-hidden="true"><NavIconArtwork system={system.id} kind={destination.id} /></svg>
          <button type="button" className={`ll-ni-nav${active[system.id] === destination.id ? ' is-active' : ''}`} aria-pressed={active[system.id] === destination.id}
            aria-label={`${destination.label}, ${system.name}`} title={destination.label} data-nav-icon-item={`${system.id}-${destination.id}`}
            onClick={() => setActive(current => ({ ...current, [system.id]: destination.id }))}>
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><NavIconArtwork system={system.id} kind={destination.id} /></svg>
          </button>
          <span className="ll-ni-label">{destination.label}</span>
        </div>)}
      </div>
    </section>)}
  </div>
}
