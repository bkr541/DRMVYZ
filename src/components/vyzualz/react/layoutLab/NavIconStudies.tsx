import { useEffect, useState } from 'react'
import { NAV_ICON_DESTINATIONS, NAV_ICON_SYSTEMS, NAV_PAD_OPTIONS, NAV_REACT_AUDIO_OPTIONS, NAV_REACT_ENGINE_OPTIONS, NAV_REACT_OPTIONS, NAV_REACT_STAGE_OPTIONS, NAV_REACT_SYSTEM_OPTIONS, NavIconArtwork } from './navIconSystems'
import { NAV_MEDALLION_RING } from '../../navMedallionIcons'
import studyStyles from './navIconStudies.css?inline'

/** Option rows below the system rows: candidate symbols inside the production ring for one left-nav item each. */
const OPTION_SETS = [
  { key: 'pad', destination: 'Performance Pads', title: 'Performance Pads options', blurb: 'Five replacements for the symbol inside the left navigation\'s pads ring · production ring and size', options: NAV_PAD_OPTIONS },
  { key: 'react', destination: 'React', title: 'React options · first round', blurb: 'Five replacements for the React (home) item · production ring and size', options: NAV_REACT_OPTIONS },
  { key: 'react-stage', destination: 'React', title: 'React options · live stage', blurb: 'React is the live workspace: its centre stage, output and pads, drawn as the stage itself', options: NAV_REACT_STAGE_OPTIONS },
  { key: 'react-audio', destination: 'React', title: 'React options · audio reaction', blurb: 'React is visuals reacting to the music: the audio-to-visual step, drawn as the reaction itself', options: NAV_REACT_AUDIO_OPTIONS },
  { key: 'react-engine', destination: 'React', title: 'React options · engine marks', blurb: 'React hosts the engines: Cinema 2.0, Sound Drawing, CANVAS, LaserDMX and PixGrid, each drawn as what it does', options: NAV_REACT_ENGINE_OPTIONS },
  { key: 'react-system', destination: 'React', title: 'React options · engine system', blurb: 'React is one shell for seven engines: the hub, the switcher, the selector, one in many looks, and the rack', options: NAV_REACT_SYSTEM_OPTIONS },
] as const

export const NAV_ICON_KEEP_STORAGE_KEY = 'drmvyz.layoutLab.navIcons.keep.v1'

/** The icons marked "keep", as `system-destination` ids. Unchecked icons are the ones to redo. */
function readKept(): ReadonlySet<string> {
  try {
    const value = JSON.parse(window.localStorage.getItem(NAV_ICON_KEEP_STORAGE_KEY) ?? 'null')
    if (value?.version === 1 && Array.isArray(value.kept)) return new Set(value.kept.filter((id: unknown): id is string => typeof id === 'string'))
  } catch { /* Unavailable or invalid storage starts with nothing kept. */ }
  return new Set()
}

/**
 * Ten icon systems for the left navigation, six destinations each. Every cell shows the artwork large (to judge the
 * paths) and as the real navigation item: the collapsed sidebar's 72px column with the 28px icon, the 3px active
 * edge and the active glow. Selection is local to a row.
 */
export function NavIconStudies() {
  const [active, setActive] = useState<Record<string, string>>(Object.fromEntries(NAV_ICON_SYSTEMS.map(system => [system.id, 'pads'])))
  const [kept, setKept] = useState(readKept)
  const [activeOption, setActiveOption] = useState<Record<string, string>>({ pad: NAV_PAD_OPTIONS[0].id, react: NAV_REACT_OPTIONS[0].id, 'react-stage': NAV_REACT_STAGE_OPTIONS[0].id, 'react-audio': NAV_REACT_AUDIO_OPTIONS[0].id, 'react-engine': NAV_REACT_ENGINE_OPTIONS[0].id, 'react-system': NAV_REACT_SYSTEM_OPTIONS[0].id })
  const [saveFailed, setSaveFailed] = useState(false)
  useEffect(() => {
    try { window.localStorage.setItem(NAV_ICON_KEEP_STORAGE_KEY, JSON.stringify({ version: 1, kept: [...kept] })); setSaveFailed(false) } catch { setSaveFailed(true) }
  }, [kept])
  const toggle = (id: string) => setKept(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const total = NAV_ICON_SYSTEMS.length * NAV_ICON_DESTINATIONS.length
  return <div className="ll-ni-studies" aria-label="Navigation icon studies">
    <style>{studyStyles}</style>
    <p className="ll-ni-summary" role="status" data-nav-icon-summary>
      <strong>{kept.size} of {total}</strong> kept · {total - kept.size} unchecked to redo
      {saveFailed && <span> · Choices could not be saved in this browser and will last only for this session.</span>}
    </p>
    {NAV_ICON_SYSTEMS.map((system, index) => <section key={system.id} className={`ll-ni-row ll-ni-row--${system.id}`} data-nav-icon-study={system.id} aria-labelledby={`ll-ni-${system.id}`}>
      <header className="ll-ni-heading">
        <h2 id={`ll-ni-${system.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{system.name}</h2>
        <p>{system.detail}<b className="ll-ni-count" data-nav-icon-count={system.id}>{NAV_ICON_DESTINATIONS.filter(d => kept.has(`${system.id}-${d.id}`)).length}/{NAV_ICON_DESTINATIONS.length} kept</b></p>
      </header>
      <div className="ll-ni-strip" role="group" aria-label={`${system.name} icons`}>
        {NAV_ICON_DESTINATIONS.map(destination => <div className={`ll-ni-cell${kept.has(`${system.id}-${destination.id}`) ? ' is-kept' : ''}`} key={destination.id}>
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
    {OPTION_SETS.map((set, setIndex) => <section key={set.key} className="ll-ni-row ll-ni-row--medallion" {...{ [`data-nav-${set.key}-options`]: '' }} aria-labelledby={`ll-ni-${set.key}opts`}>
      <header className="ll-ni-heading">
        <h2 id={`ll-ni-${set.key}opts`}><span>{String(NAV_ICON_SYSTEMS.length + 1 + setIndex).padStart(2, '0')}</span>{set.title}</h2>
        <p>{set.blurb}<b className="ll-ni-count">{set.options.filter(option => kept.has(option.id)).length}/{set.options.length} kept</b></p>
      </header>
      <div className="ll-ni-strip" role="group" aria-label={set.title}>
        {set.options.map(option => <div className={`ll-ni-cell${kept.has(option.id) ? ' is-kept' : ''}`} key={option.id}>
          <label className="ll-ni-keep"><input type="checkbox" checked={kept.has(option.id)} onChange={() => toggle(option.id)}
            aria-label={`Keep ${option.name}`} {...{ [`data-nav-${set.key}-option-keep`]: option.id }} /><span>Keep</span></label>
          <svg className="ll-ni-large" viewBox="-3 -3 38 38" width="76" height="76" aria-hidden="true">{NAV_MEDALLION_RING}{option.art()}</svg>
          <button type="button" className={`ll-ni-nav${activeOption[set.key] === option.id ? ' is-active' : ''}`} aria-pressed={activeOption[set.key] === option.id}
            aria-label={`${set.destination}, ${option.name}`} title={option.detail} {...{ [`data-nav-${set.key}-option`]: option.id }}
            onClick={() => setActiveOption(current => ({ ...current, [set.key]: option.id }))}>
            <svg viewBox="-3 -3 38 38" width="43" height="43" aria-hidden="true">{NAV_MEDALLION_RING}{option.art()}</svg>
          </button>
          <span className="ll-ni-label">{option.name}</span>
        </div>)}
      </div>
    </section>)}
  </div>
}
