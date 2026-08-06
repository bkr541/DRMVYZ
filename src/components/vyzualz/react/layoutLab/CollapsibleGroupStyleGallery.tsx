import { useState, type CSSProperties } from 'react'

// ── CollapsibleGroupStyleGallery ───────────────────────────────────────────
//
// Layout Lab / Template engine only. A visually distinct treatment of the
// app's standard collapsible group (ReactControlRows' Collapsible —
// bordered card, bold caps header, chevron, rows of controls beneath) so
// restyling it can be judged against a real alternative. Owns its own
// open/closed state, and its five sample rows (two sliders, a select, a
// text input, a toggle) are real, locally-driven controls — not static art
// — so a group with several different control types can be judged together.

const RENDER_MODE_OPTIONS = ['Outline', 'Multi Trace', 'Dots', 'Ribbon']

function SampleSlider({ value, onChange }: { value: number, onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      className="llcg-slider"
      min={0}
      max={100}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      style={{ '--llcg-pct': `${value}%` } as CSSProperties}
    />
  )
}

function SampleSelect({
  value,
  onChange,
  options,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  className?: string
}) {
  return (
    <select className={`llcg-select${className ? ` ${className}` : ''}`} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

function SampleTextInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      type="text"
      className={`llcg-text-input${className ? ` ${className}` : ''}`}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
    />
  )
}

function useGroupRowState() {
  const [intensity, setIntensity] = useState(62)
  const [motion, setMotion] = useState(38)
  const [renderMode, setRenderMode] = useState(RENDER_MODE_OPTIONS[0])
  const [label, setLabel] = useState('DRMVYZ')
  const [autoRotate, setAutoRotate] = useState(false)
  return { intensity, setIntensity, motion, setMotion, renderMode, setRenderMode, label, setLabel, autoRotate, setAutoRotate }
}

// 1 — Accent card: solid left accent bar, gradient wash, dot-marked header
function AccentCardGroup() {
  const [open, setOpen] = useState(true)
  const { intensity, setIntensity, motion, setMotion, renderMode, setRenderMode, label, setLabel, autoRotate, setAutoRotate } = useGroupRowState()

  return (
    <div className={`llcg-accent${open ? ' is-open' : ''}`}>
      <button type="button" className="llcg-accent-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="llcg-accent-dot" aria-hidden="true" />
        <span>Master</span>
        <span className={`llcg-caret${open ? ' is-open' : ''}`} aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="llcg-accent-body">
          <div className="llcg-accent-row">
            <div className="llcg-accent-row-hdr"><span>Intensity</span><span>{intensity}%</span></div>
            <SampleSlider value={intensity} onChange={setIntensity} />
          </div>
          <div className="llcg-accent-row">
            <div className="llcg-accent-row-hdr"><span>Motion</span><span>{motion}%</span></div>
            <SampleSlider value={motion} onChange={setMotion} />
          </div>
          <div className="llcg-accent-row">
            <div className="llcg-accent-row-hdr"><span>Render Mode</span></div>
            <SampleSelect value={renderMode} onChange={setRenderMode} options={RENDER_MODE_OPTIONS} />
          </div>
          <div className="llcg-accent-row">
            <div className="llcg-accent-row-hdr"><span>Label</span></div>
            <SampleTextInput value={label} onChange={setLabel} placeholder="DRMVYZ" />
          </div>
          <div className="llcg-accent-row llcg-accent-row--toggle">
            <span>Auto Rotate</span>
            <button type="button" className={`llcg-toggle${autoRotate ? ' is-on' : ''}`} onClick={() => setAutoRotate(v => !v)}>
              {autoRotate ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'accent', title: '01 · Accent Card', blurb: 'Solid left accent bar, gradient wash, dot-marked header.', Group: AccentCardGroup },
]

export function CollapsibleGroupStyleGallery() {
  return (
    <div className="llcg-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Group />
          </div>
        </div>
      ))}
    </div>
  )
}
