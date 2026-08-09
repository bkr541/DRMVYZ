import { useState } from 'react'
import { BubbleRevealSliderControl, IconMorphToggleControl, TemplateTextInputControl, UnderlineDropdownControl } from './layoutLabWinningControls'

// ── CollapsibleGroupStyleGallery ───────────────────────────────────────────
//
// Layout Lab / Template engine only. Step Indent: pure whitespace and a
// barely-there background tint mark the group's body — no border line, no
// card, no bracket, just indentation. Its rows use this page's winning
// slider/dropdown/toggle controls (Bubble Reveal, Underline, Icon Morph)
// alongside a plain text input. The "Master" group also nests a real
// "Secondary" group of the same styling one level deeper — matching how
// groups actually nest in production (e.g. Cinema Composer's Composition
// Management / Visuals / Masks / Library) — so the full compounded visual
// is judgeable here rather than only ever shown flat.

const RENDER_MODE_OPTIONS = ['Outline', 'Multi Trace', 'Dots', 'Ribbon']

function useGroupRowState() {
  const [intensity, setIntensity] = useState(62)
  const [motion, setMotion] = useState(38)
  const [renderMode, setRenderMode] = useState(RENDER_MODE_OPTIONS[0])
  const [label, setLabel] = useState('DRMVYZ')
  const [autoRotate, setAutoRotate] = useState(false)
  return { intensity, setIntensity, motion, setMotion, renderMode, setRenderMode, label, setLabel, autoRotate, setAutoRotate }
}

// Shared row content for the Master group.
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

// Step Indent: pure whitespace and a barely-there background tint mark the
// body — no line, no card, no bracket, just indentation.
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
  { id: 'step', title: '01 · Step Indent', blurb: 'Pure whitespace and a barely-there background tint mark the body — no line, no card, no bracket, just indentation. Shown with a nested Secondary group inside Master.', Group: StepIndentGroup },
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
