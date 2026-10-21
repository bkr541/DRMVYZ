import { useState } from 'react'
import { AppIconGlyph } from './AppIconGlyph'
import { APP_ICON_INVENTORY } from './appIconInventory'
import './appIconGallery.css'

/** Cinema 2.0 center visualizer: one continuous five-column review sheet. */
export function AppIconGallery() {
  const [query, setQuery] = useState('')
  const search = query.trim().toLocaleLowerCase()
  const icons = search
    ? APP_ICON_INVENTORY.filter(icon => `${icon.label} ${icon.screen}`.toLocaleLowerCase().includes(search))
    : APP_ICON_INVENTORY
  return (
    <section className="llai-gallery" aria-label="Application icon gallery">
      <header className="llai-heading">
        <div>
          <h2>Application icons</h2>
          <p>Rounded linework · layered hardware · cyan signal accents</p>
        </div>
        <span className="llai-count" role="status">{icons.length} / {APP_ICON_INVENTORY.length}</span>
      </header>
      <label className="llai-search">
        <span>Find an icon</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search label or screen…" />
      </label>
      <div className="llai-scroll" tabIndex={0} aria-label="Icon review sheet">
        <div className="llai-grid" role="list">
          {icons.map(icon => (
            <figure className="llai-item" key={icon.id} role="listitem" data-icon-id={icon.id} data-icon-kind={icon.kind}>
              <figcaption className="llai-label">{icon.label}</figcaption>
              <span className="llai-art"><AppIconGlyph kind={icon.kind} /></span>
              <small className="llai-screen">{icon.screen}</small>
            </figure>
          ))}
        </div>
        {icons.length === 0 && <p className="llai-empty">No icons match “{query}”.</p>}
      </div>
    </section>
  )
}
