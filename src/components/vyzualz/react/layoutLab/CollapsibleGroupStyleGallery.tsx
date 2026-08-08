import { useState } from 'react'
import { DualRailCollapsible } from '../DualRailCollapsible'
import { BubbleRevealSliderControl, IconMorphToggleControl, TemplateTextInputControl, UnderlineDropdownControl } from './layoutLabWinningControls'

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
        <TemplateTextInputControl value={label} onChange={setLabel} placeholder="DRMVYZ" />
      </div>
      <div className="llcg-accent-row llcg-accent-row--toggle">
        <span>Auto Rotate</span>
        <IconMorphToggleControl value={autoRotate} onChange={setAutoRotate} ariaLabel="Auto Rotate" />
      </div>
    </DualRailCollapsible>
  )
}

// Shared row content for the three new group treatments below — only the
// group wrapper's own chrome (header, border, background) differs between
// them; the rows inside reuse the same winning controls as Dual Rail.
function GroupRows() {
  const { intensity, setIntensity, motion, setMotion, renderMode, setRenderMode, label, setLabel, autoRotate, setAutoRotate } = useGroupRowState()
  return (
    <>
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
        <TemplateTextInputControl value={label} onChange={setLabel} placeholder="DRMVYZ" />
      </div>
      <div className="llcg-accent-row llcg-accent-row--toggle">
        <span>Auto Rotate</span>
        <IconMorphToggleControl value={autoRotate} onChange={setAutoRotate} ariaLabel="Auto Rotate" />
      </div>
    </>
  )
}

// 2 — Halo Frame: a thin, uniform border with a soft radial glow seated
// behind the header only, so the group's identity reads from a gentle
// emphasis at the top rather than a colored rail or two-tone split.
function HaloFrameGroup() {
  const [open, setOpen] = useState(true)
  return (
    <div className={`llcg-halo${open ? ' is-open' : ''}`}>
      <button type="button" className="llcg-halo-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="llcg-halo-glow" aria-hidden="true" />
        <span>Master</span>
        <span className="llcg-halo-caret" aria-hidden="true">▾</span>
      </button>
      {open && <div className="llcg-halo-body"><GroupRows /></div>}
    </div>
  )
}

// 3 — Ledger Panel: no border or background at all — a bold header with a
// single rule beneath it, rows indented slightly. A flat, utilitarian
// "spec sheet" read instead of a boxed card.
function LedgerPanelGroup() {
  const [open, setOpen] = useState(true)
  return (
    <div className={`llcg-ledger${open ? ' is-open' : ''}`}>
      <button type="button" className="llcg-ledger-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span>Master</span>
        <span className="llcg-ledger-caret" aria-hidden="true">▾</span>
      </button>
      {open && <div className="llcg-ledger-body"><GroupRows /></div>}
    </div>
  )
}

// 4 — Tab Crest: the header sits as a raised tab above the body's top edge,
// like a folder crest, giving the group a layered, physical depth instead
// of a flat rectangle.
function TabCrestGroup() {
  const [open, setOpen] = useState(true)
  return (
    <div className={`llcg-crest${open ? ' is-open' : ''}`}>
      <button type="button" className="llcg-crest-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span>Master</span>
        <span className="llcg-crest-caret" aria-hidden="true">▾</span>
      </button>
      {open && <div className="llcg-crest-body"><GroupRows /></div>}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'dualtone', title: '01 · Dual Rail', blurb: "An even blend: Progress Rail's climbing fill mirrored on both edges, framing Master parameters' two-tone header/body split.", Group: DualRailGroup },
  { id: 'halo', title: '02 · Halo Frame', blurb: 'A thin uniform border with a soft glow seated behind the header only — emphasis from light, not a colored rail.', Group: HaloFrameGroup },
  { id: 'ledger', title: '03 · Ledger Panel', blurb: 'No border or background — a bold header with a single rule beneath it. A flat, utilitarian spec-sheet read.', Group: LedgerPanelGroup },
  { id: 'crest', title: '04 · Tab Crest', blurb: 'The header sits as a raised tab above the body, like a folder crest, giving the group layered depth.', Group: TabCrestGroup },
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
