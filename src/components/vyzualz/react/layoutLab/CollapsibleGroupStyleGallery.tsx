import { useState } from 'react'
import { BubbleRevealSliderControl, IconMorphToggleControl, TemplateTextInputControl, UnderlineDropdownControl } from './layoutLabWinningControls'

// ── CollapsibleGroupStyleGallery ───────────────────────────────────────────
//
// Layout Lab / Template engine only. Five candidate treatments for the
// app's collapsible group, none using a continuous vertical line to mark
// the indented body (the production Tab Crest treatment's disliked
// "vertical yellow line"). Only the group wrapper's own chrome — header
// and body — differs between them; every variant renders the exact same
// rows via the shared GroupRows below, using this page's winning
// slider/dropdown/toggle controls (Bubble Reveal, Underline, Icon Morph)
// alongside a plain text input. Each "Master" group also nests a real
// "Secondary" group of the same styling one level deeper — matching how
// groups actually nest in production (e.g. Cinema Composer's Composition
// Management / Visuals / Masks / Library) — so the full compounded visual
// (does the treatment still read cleanly two levels deep?) is judgeable
// here rather than only ever shown flat.

const RENDER_MODE_OPTIONS = ['Outline', 'Multi Trace', 'Dots', 'Ribbon']

function useGroupRowState() {
  const [intensity, setIntensity] = useState(62)
  const [motion, setMotion] = useState(38)
  const [renderMode, setRenderMode] = useState(RENDER_MODE_OPTIONS[0])
  const [label, setLabel] = useState('DRMVYZ')
  const [autoRotate, setAutoRotate] = useState(false)
  return { intensity, setIntensity, motion, setMotion, renderMode, setRenderMode, label, setLabel, autoRotate, setAutoRotate }
}

// Shared row content for every group treatment below — only the group
// wrapper's own chrome (header, border, background) differs between them;
// the rows inside are unchanged across all five.
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

// Smaller row set for the nested "Secondary" sub-group — enough to show the
// treatment compounding, without repeating all five Master rows again.
function useNestedRowState() {
  const [depth, setDepth] = useState(45)
  const [loop, setLoop] = useState(true)
  return { depth, setDepth, loop, setLoop }
}

function NestedRows() {
  const { depth, setDepth, loop, setLoop } = useNestedRowState()
  return (
    <>
      <div className="llcg-accent-row">
        <div className="llcg-accent-row-hdr"><span>Depth</span><span>{depth}%</span></div>
        <BubbleRevealSliderControl value={depth} onChange={setDepth} ariaLabel="Depth" />
      </div>
      <div className="llcg-accent-row llcg-accent-row--toggle">
        <span>Loop</span>
        <IconMorphToggleControl value={loop} onChange={setLoop} ariaLabel="Loop" />
      </div>
    </>
  )
}

type NestableGroupProps = {
  label?: string
  nested?: boolean
}

// 1 — Panel Well: the body sits in a recessed, inset panel — depth comes
// from shading (a soft inner shadow, darker fill), not a border line.
function PanelWellGroup({ label = 'Master', nested = false }: NestableGroupProps) {
  const [open, setOpen] = useState(true)
  return (
    <div className={`llcg-well${open ? ' is-open' : ''}`}>
      <button type="button" className="llcg-well-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span>{label}</span>
        <span className="llcg-well-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="llcg-well-body">
          {nested ? <NestedRows /> : <><GroupRows /><PanelWellGroup label="Secondary" nested /></>}
        </div>
      )}
    </div>
  )
}

// 2 — Dot Trail: a single small node dot marks the group instead of a
// running line; the body is simply indented beneath it.
function DotTrailGroup({ label = 'Master', nested = false }: NestableGroupProps) {
  const [open, setOpen] = useState(true)
  return (
    <div className={`llcg-dot${open ? ' is-open' : ''}`}>
      <button type="button" className="llcg-dot-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="llcg-dot-node" aria-hidden="true" />
        <span>{label}</span>
        <span className="llcg-dot-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="llcg-dot-body">
          {nested ? <NestedRows /> : <><GroupRows /><DotTrailGroup label="Secondary" nested /></>}
        </div>
      )}
    </div>
  )
}

// 3 — Card Stack: header and body together form one fully bordered,
// rounded card — a self-contained block rather than a line-marked region.
function CardStackGroup({ label = 'Master', nested = false }: NestableGroupProps) {
  const [open, setOpen] = useState(true)
  return (
    <div className={`llcg-stack${open ? ' is-open' : ''}${nested ? ' llcg-stack--nested' : ''}`}>
      <button type="button" className="llcg-stack-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span>{label}</span>
        <span className="llcg-stack-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="llcg-stack-body">
          {nested ? <NestedRows /> : <><GroupRows /><CardStackGroup label="Secondary" nested /></>}
        </div>
      )}
    </div>
  )
}

// 4 — Corner Bracket: a small L-shaped bracket marks the body's top-left
// corner, like a frame corner, instead of a continuous vertical line.
function CornerBracketGroup({ label = 'Master', nested = false }: NestableGroupProps) {
  const [open, setOpen] = useState(true)
  return (
    <div className={`llcg-bracket${open ? ' is-open' : ''}`}>
      <button type="button" className="llcg-bracket-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span>{label}</span>
        <span className="llcg-bracket-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="llcg-bracket-body">
          <span className="llcg-bracket-corner" aria-hidden="true" />
          {nested ? <NestedRows /> : <><GroupRows /><CornerBracketGroup label="Secondary" nested /></>}
        </div>
      )}
    </div>
  )
}

// 5 — Step Indent: pure whitespace and a barely-there background tint mark
// the body — no line, no card, no bracket, just indentation.
function StepIndentGroup({ label = 'Master', nested = false }: NestableGroupProps) {
  const [open, setOpen] = useState(true)
  return (
    <div className={`llcg-step${open ? ' is-open' : ''}`}>
      <button type="button" className="llcg-step-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span>{label}</span>
        <span className="llcg-step-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="llcg-step-body">
          {nested ? <NestedRows /> : <><GroupRows /><StepIndentGroup label="Secondary" nested /></>}
        </div>
      )}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'well', title: '01 · Panel Well', blurb: 'The body sits in a recessed, inset panel — depth comes from shading (a soft inner shadow, darker fill), not a border line. Shown with a nested Secondary group inside Master.', Group: PanelWellGroup },
  { id: 'dot', title: '02 · Dot Trail', blurb: 'A single small node dot marks the group instead of a running line; the body is simply indented beneath it. Shown with a nested Secondary group inside Master.', Group: DotTrailGroup },
  { id: 'stack', title: '03 · Card Stack', blurb: 'Header and body together form one fully bordered, rounded card — a self-contained block rather than a line-marked region. Shown with a nested Secondary group inside Master.', Group: CardStackGroup },
  { id: 'bracket', title: '04 · Corner Bracket', blurb: "A small L-shaped bracket marks the body's top-left corner, like a frame corner, instead of a continuous vertical line. Shown with a nested Secondary group inside Master.", Group: CornerBracketGroup },
  { id: 'step', title: '05 · Step Indent', blurb: 'Pure whitespace and a barely-there background tint mark the body — no line, no card, no bracket, just indentation. Shown with a nested Secondary group inside Master.', Group: StepIndentGroup },
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
