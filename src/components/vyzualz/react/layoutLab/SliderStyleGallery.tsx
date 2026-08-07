import { useState, type CSSProperties } from 'react'

// ── SliderStyleGallery ──────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Four slider treatments built to mimic
// dropdown_v2's visual language — borderless underline chrome, uppercase
// eyebrow labels, the #4ac7db cyan accent, the dark floating-menu popover
// treatment, and its fade-scale reveal animation — so a winner can be judged
// the same way the dropdown styles were. Fully local, disconnected — each
// owns its own value state.

// 1 — Underline fill: the track IS the underline, no visible chrome until touched
function UnderlineFillSlider() {
  const [value, setValue] = useState(62)
  return (
    <div className="lls-underline">
      <div className="lls-underline-row">
        <span className="lls-underline-eyebrow">Intensity</span>
        <span className="lls-underline-value">{value}%</span>
      </div>
      <input
        type="range"
        className="lls-underline-track"
        min={0}
        max={100}
        value={value}
        onChange={event => setValue(Number(event.target.value))}
        style={{ '--lls-pct': `${value}%` } as CSSProperties}
        aria-label="Intensity"
      />
    </div>
  )
}

// 2 — Bubble reveal: dragging pops a dropdown_v2-menu-styled value bubble above the thumb
function BubbleRevealSlider() {
  const [value, setValue] = useState(38)
  const [active, setActive] = useState(false)
  return (
    <div className="lls-bubble">
      <span className="lls-bubble-eyebrow">Motion</span>
      <div className="lls-bubble-track-wrap">
        {active && (
          <span className="lls-bubble-pop" style={{ left: `${value}%` }}>{value}%</span>
        )}
        <input
          type="range"
          className="lls-bubble-track"
          min={0}
          max={100}
          value={value}
          onChange={event => setValue(Number(event.target.value))}
          onPointerDown={() => setActive(true)}
          onPointerUp={() => setActive(false)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
          style={{ '--lls-pct': `${value}%` } as CSSProperties}
          aria-label="Motion"
        />
      </div>
    </div>
  )
}

// 3 — Tick rail: discrete stops, mimicking the dropdown menu's option list
const TICK_STOPS = [
  { value: 0, label: 'Outline' },
  { value: 25, label: 'Multi Trace' },
  { value: 50, label: 'Dots' },
  { value: 75, label: 'Ribbon' },
  { value: 100, label: 'Bloom' },
]

function TickRailSlider() {
  const [value, setValue] = useState(50)
  const activeLabel = TICK_STOPS.find(stop => stop.value === value)?.label ?? ''
  return (
    <div className="lls-rail">
      <div className="lls-rail-row">
        <span className="lls-rail-eyebrow">Render Mode</span>
        <span className="lls-rail-value">{activeLabel}</span>
      </div>
      <div className="lls-rail-track-wrap">
        <div className="lls-rail-ticks" aria-hidden="true">
          {TICK_STOPS.map(stop => (
            <span key={stop.value} className={`lls-rail-tick${stop.value <= value ? ' is-filled' : ''}`} />
          ))}
        </div>
        <input
          type="range"
          className="lls-rail-track"
          min={0}
          max={100}
          step={25}
          value={value}
          onChange={event => setValue(Number(event.target.value))}
          aria-label="Render Mode"
        />
      </div>
    </div>
  )
}

// 4 — Menu row gauge: the dropdown option row's left-accent-bar turned into a fill gauge
function MenuRowSlider() {
  const [value, setValue] = useState(74)
  return (
    <div className="lls-menurow">
      <span className="lls-menurow-fill" style={{ width: `${value}%` }} aria-hidden="true" />
      <span className="lls-menurow-label">Glow</span>
      <span className="lls-menurow-value">{value}%</span>
      <input
        type="range"
        className="lls-menurow-track"
        min={0}
        max={100}
        value={value}
        onChange={event => setValue(Number(event.target.value))}
        aria-label="Glow"
      />
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'underline', title: '01 · Underline Fill', blurb: 'Borderless track, cyan fill to value, thumb only appears on touch.', Slider: UnderlineFillSlider },
  { id: 'bubble', title: '02 · Bubble Reveal', blurb: 'Dragging pops a dropdown-menu-styled value bubble above the thumb.', Slider: BubbleRevealSlider },
  { id: 'rail', title: '03 · Tick Rail', blurb: 'Discrete stops with dropdown-option-style accent ticks.', Slider: TickRailSlider },
  { id: 'menurow', title: '04 · Menu Row Gauge', blurb: "The dropdown option row's left accent bar, turned into a fill gauge.", Slider: MenuRowSlider },
]

export function SliderStyleGallery() {
  return (
    <div className="lls-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Slider />
          </div>
        </div>
      ))}
    </div>
  )
}
