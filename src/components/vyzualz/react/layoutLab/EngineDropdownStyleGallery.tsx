import { useEffect, useRef, useState, type CSSProperties } from 'react'

// ── EngineDropdownStyleGallery ──────────────────────────────────────────────
//
// Layout Lab / Template engine only. A hero-scale treatment for the main
// engine switcher (ReactEngineBrowser's .rv-engine-dropdown — the icon +
// label + description card in the top-left of every engine's left window).
// This is the single most load-bearing control in the app, so it's
// full-width, keeps the engine name large, and carries real motion — an
// ambient idle animation on the card itself plus a staggered entrance for
// the menu. The supporting description is clamped to two lines everywhere
// (trigger and menu options) so the card holds a fixed size regardless of
// which engine is selected. Uses the same five real engines/icons/
// descriptions from reactEngineCatalog as sample data. Fully local,
// disconnected — owns its own open state and selection.

const SAMPLE_ENGINES = [
  { id: 'cinema', label: 'Cinema', icon: '◇', description: 'Composition-native visual graphs with one canonical Cinema runtime.' },
  { id: 'oscilloscope', label: 'Sound Drawing', icon: '〜', description: 'Live audio waveform drawing with glyph, SVG and text rendering.' },
  { id: 'canvas', label: 'CANVAS', icon: '▣', description: 'Uploaded videos, images, and SVGs for audio-reactive shows.' },
  { id: 'laserDmx', label: 'LaserDMX', icon: '✦', description: 'DMX Beam Matrix control with cues, fog, and audio-reactive looks.' },
  { id: 'pixGrid', label: 'PixGrid', icon: '▦', description: 'Programmable LED-cell artwork, animation, and full-song pixel choreography.' },
]

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (event: PointerEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return
      onClose()
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [open, onClose])
  return ref
}

// Radial spotlight: a soft radial glow breathes behind the icon, menu
// options pop in with a spring stagger, the active row's icon pulses
function RadialSpotlightEngineDropdown() {
  const [open, setOpen] = useState(false)
  const [valueId, setValueId] = useState('oscilloscope')
  const rootRef = useOutsideClose(open, () => setOpen(false))
  const active = SAMPLE_ENGINES.find(engine => engine.id === valueId) ?? SAMPLE_ENGINES[0]

  return (
    <div className="lled-spotlight" ref={rootRef}>
      <button type="button" className={`lled-spotlight-trigger${open ? ' is-open' : ''}`} aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <span className="lled-spotlight-glow" aria-hidden="true" />
        <span className="lled-spotlight-icon" aria-hidden="true">{active.icon}</span>
        <span className="lled-spotlight-copy">
          <span className="lled-spotlight-eyebrow">Engine</span>
          <span className="lled-spotlight-label">{active.label}</span>
          <span className="lled-spotlight-description">{active.description}</span>
        </span>
      </button>
      {open && (
        <div className="lled-spotlight-menu" role="listbox">
          {SAMPLE_ENGINES.map((engine, index) => (
            <button
              key={engine.id}
              type="button"
              role="option"
              aria-selected={engine.id === valueId}
              className={`lled-spotlight-option${engine.id === valueId ? ' is-active' : ''}`}
              style={{ '--lled-i': index } as CSSProperties}
              onClick={() => { setValueId(engine.id); setOpen(false) }}
            >
              <span className="lled-spotlight-option-icon" aria-hidden="true">{engine.icon}</span>
              <span className="lled-spotlight-option-copy">
                <span>{engine.label}</span>
                <small>{engine.description}</small>
              </span>
              {engine.id === valueId && <span className="lled-spotlight-option-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'spotlight', title: '01 · Radial Spotlight', blurb: "A soft radial glow breathes behind the icon; menu options pop in with a spring stagger and the active row's icon pulses.", Dropdown: RadialSpotlightEngineDropdown },
]

export function EngineDropdownStyleGallery() {
  return (
    <div className="lled-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Dropdown />
          </div>
        </div>
      ))}
    </div>
  )
}
