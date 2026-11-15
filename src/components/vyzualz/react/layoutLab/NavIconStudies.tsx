import { useState } from 'react'
import { NAV_ICON_DESTINATIONS, NAV_ICON_SYSTEMS, NavIconArtwork } from './navIconSystems'
import studyStyles from './navIconStudies.css?inline'

/**
 * Ten icon systems for the left navigation, six destinations each. Every cell shows the artwork large (to judge the
 * paths) and as the real navigation item: the collapsed sidebar's 72px column with the 28px icon, the 3px active
 * edge and the active glow. Selection is local to a row.
 */
export function NavIconStudies() {
  const [active, setActive] = useState<Record<string, string>>(Object.fromEntries(NAV_ICON_SYSTEMS.map(system => [system.id, 'pads'])))
  return <div className="ll-ni-studies" aria-label="Navigation icon studies">
    <style>{studyStyles}</style>
    {NAV_ICON_SYSTEMS.map((system, index) => <section key={system.id} className={`ll-ni-row ll-ni-row--${system.id}`} data-nav-icon-study={system.id} aria-labelledby={`ll-ni-${system.id}`}>
      <header className="ll-ni-heading">
        <h2 id={`ll-ni-${system.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{system.name}</h2>
        <p>{system.detail}</p>
      </header>
      <div className="ll-ni-strip" role="group" aria-label={`${system.name} icons`}>
        {NAV_ICON_DESTINATIONS.map(destination => <div className="ll-ni-cell" key={destination.id}>
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
