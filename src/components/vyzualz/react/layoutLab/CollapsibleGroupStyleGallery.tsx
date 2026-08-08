import { useState } from 'react'
import { DualRailCollapsible } from '../DualRailCollapsible'
import { BubbleRevealSliderControl, IconMorphToggleControl, UnderlineDropdownControl } from './layoutLabWinningControls'

// ── CollapsibleGroupStyleGallery ───────────────────────────────────────────
//
// Layout Lab / Template engine only. A visually distinct treatment of the
// app's standard collapsible group (ReactControlRows' Collapsible —
// bordered card, bold caps header, chevron, rows of controls beneath) so
// restyling it can be judged against a real alternative. Its rows use this
// page's winning slider/dropdown/toggle controls (Bubble Reveal, Underline,
// Icon Morph) alongside a plain text input — real, locally-driven controls,
// not static art.

const RENDER_MODE_OPTIONS = ['Outline', 'Multi Trace', 'Dots', 'Ribbon']

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

// 1 — Dual rail: an even blend — Progress Rail's climbing fill and solid
// accent mirrored on both edges, framing Master parameters' two-tone
// header/body split. Uses the real, reusable DualRailCollapsible directly
// so this preview matches production exactly, and its slider/dropdown/
// toggle rows use this page's winning controls (Bubble Reveal, Underline,
// Icon Morph) instead of the plain generic samples.
function DualRailGroup() {
  const { intensity, setIntensity, motion, setMotion, renderMode, setRenderMode, label, setLabel, autoRotate, setAutoRotate } = useGroupRowState()

  return (
    <DualRailCollapsible label="Master">
      <div className="llcg-accent-row">
        <div className="llcg-accent-row-hdr"><span>Intensity</span><span>{intensity}%</span></div>
        <BubbleRevealSliderControl value={intensity} onChange={setIntensity} ariaLabel="Intensity" />
      </div>
      <div className="llcg-accent-row">
        <div className="llcg-accent-row-hdr"><span>Motion</span><span>{motion}%</span></div>
        <BubbleRevealSliderControl value={motion} onChange={setMotion} ariaLabel="Motion" />
      </div>
      <div className="llcg-accent-row">
        <div className="llcg-accent-row-hdr"><span>Render Mode</span></div>
        <UnderlineDropdownControl value={renderMode} onChange={setRenderMode} options={RENDER_MODE_OPTIONS} ariaLabel="Render Mode" />
      </div>
      <div className="llcg-accent-row">
        <div className="llcg-accent-row-hdr"><span>Label</span></div>
        <SampleTextInput value={label} onChange={setLabel} placeholder="DRMVYZ" />
      </div>
      <div className="llcg-accent-row llcg-accent-row--toggle">
        <span>Auto Rotate</span>
        <IconMorphToggleControl value={autoRotate} onChange={setAutoRotate} ariaLabel="Auto Rotate" />
      </div>
    </DualRailCollapsible>
  )
}

const GALLERY_ENTRIES = [
  { id: 'dualtone', title: '01 · Dual Rail', blurb: "An even blend: Progress Rail's climbing fill mirrored on both edges, framing Master parameters' two-tone header/body split.", Group: DualRailGroup },
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
