import { useState, type ReactNode } from 'react'
import { Badge } from '../controls/Badge'
import { IconChipButton } from '../controls/IconChipButton'
import { IconMorphToggle } from '../controls/IconMorphToggle'

// ── HeaderControlGroupStyleGallery ───────────────────────────────────────
//
// Layout Lab / Cinema engine, middle visualizer only. Five concepts for the
// standardized control group that sits in the MIDDLE of every page header row
// (React, Media Manager, Lyric Manager, Show Manager) — the buttons, toggles,
// status and save actions that today live in a different spot and style on each
// page. Every concept shows the same content (save status, five icon tools, a
// Show Lyrics toggle, Save) so the styles can be compared like for like, drawn
// inside a 60px mock header with the page heading on the left and the profile
// avatar on the right. Interactive so hover/active/on states can be judged.
// Presentation only — nothing is wired to a store, page or output.

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const TOOLS: { id: string; label: string; icon: ReactNode }[] = [
  { id: 'power', label: 'Output power', icon: <svg {...svgProps}><path d="M12 3.5v8" /><path d="M7 6.6a7 7 0 1 0 10 0" /></svg> },
  { id: 'preview', label: 'Preview', icon: <svg {...svgProps}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></svg> },
  { id: 'hide', label: 'Hide output', icon: <svg {...svgProps}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><path d="M4 4l16 16" /></svg> },
  { id: 'layout', label: 'Layout', icon: <svg {...svgProps}><rect x="3.5" y="4" width="17" height="6" rx="1.5" /><rect x="3.5" y="14" width="17" height="6" rx="1.5" /></svg> },
  { id: 'copy', label: 'Copy', icon: <svg {...svgProps}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg> },
]

const SaveIcon = () => <svg {...svgProps}><path d="M5 3.5h12l2 2v15H5z" /><path d="M8 3.5v6h8v-6M8 20.5v-7h8v7" /></svg>

/** Shared, self-contained state so every concept behaves the same way. */
function useGroupState() {
  const [active, setActive] = useState<Set<string>>(new Set(['preview']))
  const [lyrics, setLyrics] = useState(true)
  const toggleTool = (id: string) => setActive(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return { active, toggleTool, lyrics, setLyrics }
}

function Status({ className = '' }: { className?: string }) {
  return <Badge className={className} label="Saved 3:27 PM" tone="#61d6aa" />
}

function LyricsToggle({ lyrics, setLyrics, className = '' }: { lyrics: boolean; setLyrics: (value: boolean) => void; className?: string }) {
  return (
    <label className={`llhg-toggle${className ? ` ${className}` : ''}`}>
      <span className="llhg-toggle-label">Show Lyrics</span>
      <IconMorphToggle checked={lyrics} onCheckedChange={setLyrics} aria-label="Show Lyrics" />
    </label>
  )
}

/** Mock 60px header the concepts are drawn in: page heading left, group centered, avatar right. */
function HeaderFrame({ children }: { children: ReactNode }) {
  return (
    <div className="llhg-frame">
      <span className="llhg-frame-title" aria-hidden="true">PAGE HEADING</span>
      <div className="llhg-frame-slot">{children}</div>
      <span className="llhg-frame-avatar" aria-hidden="true" />
    </div>
  )
}

function ToolKey({ tool, on, onClick, className }: { tool: (typeof TOOLS)[number]; on: boolean; onClick: () => void; className: string }) {
  return (
    <button type="button" className={`${className}${on ? ' is-on' : ''}`} aria-label={tool.label} aria-pressed={on} title={tool.label} onClick={onClick}>
      {tool.icon}
    </button>
  )
}

// ── 01 · Segmented Deck ───────────────────────────────────────────────────
// One bordered deck split into segments by hairlines: status | tools | toggle |
// save. Reads as a single instrument; the active tool lights its own segment.

function SegmentedDeck() {
  const { active, toggleTool, lyrics, setLyrics } = useGroupState()
  return (
    <div className="llhg-deck" role="toolbar" aria-label="Header controls (Segmented Deck)">
      <div className="llhg-deck-seg"><Status /></div>
      <div className="llhg-deck-seg llhg-deck-seg--tools">
        {TOOLS.map(tool => <ToolKey key={tool.id} tool={tool} on={active.has(tool.id)} onClick={() => toggleTool(tool.id)} className="llhg-deck-key" />)}
      </div>
      <div className="llhg-deck-seg"><LyricsToggle lyrics={lyrics} setLyrics={setLyrics} /></div>
      <div className="llhg-deck-seg llhg-deck-seg--end"><IconChipButton tone="primary" icon={<SaveIcon />}>Save</IconChipButton></div>
    </div>
  )
}

// ── 02 · Floating Islands ─────────────────────────────────────────────────
// Three separate rounded glass islands with air between them — status, tools,
// actions — so each job reads on its own and the group adapts by dropping an
// island rather than squeezing everything.

function FloatingIslands() {
  const { active, toggleTool, lyrics, setLyrics } = useGroupState()
  return (
    <div className="llhg-islands" role="toolbar" aria-label="Header controls (Floating Islands)">
      <div className="llhg-island"><Status /></div>
      <div className="llhg-island llhg-island--tools">
        {TOOLS.map(tool => <ToolKey key={tool.id} tool={tool} on={active.has(tool.id)} onClick={() => toggleTool(tool.id)} className="llhg-island-key" />)}
      </div>
      <div className="llhg-island">
        <LyricsToggle lyrics={lyrics} setLyrics={setLyrics} />
        <IconChipButton tone="primary" icon={<SaveIcon />}>Save</IconChipButton>
      </div>
    </div>
  )
}

// ── 03 · Hardware Console ─────────────────────────────────────────────────
// A machined strip: square keys with a tiny LED under each that lights when the
// tool is on, engraved-style labels and a recessed status window.

function HardwareConsole() {
  const { active, toggleTool, lyrics, setLyrics } = useGroupState()
  return (
    <div className="llhg-console" role="toolbar" aria-label="Header controls (Hardware Console)">
      <div className="llhg-console-window"><span className="llhg-console-led" aria-hidden="true" /><span>Saved 3:27 PM</span></div>
      <div className="llhg-console-keys">
        {TOOLS.map(tool => (
          <span key={tool.id} className="llhg-console-cell">
            <ToolKey tool={tool} on={active.has(tool.id)} onClick={() => toggleTool(tool.id)} className="llhg-console-key" />
            <span className={`llhg-console-pilot${active.has(tool.id) ? ' is-on' : ''}`} aria-hidden="true" />
          </span>
        ))}
      </div>
      <LyricsToggle lyrics={lyrics} setLyrics={setLyrics} className="llhg-toggle--console" />
      <IconChipButton tone="primary" icon={<SaveIcon />}>Save</IconChipButton>
    </div>
  )
}

// ── 04 · Neon Underline ───────────────────────────────────────────────────
// No boxes: a glowing hairline runs under the whole group, the active tool gets
// a cyan underline notch, and angled end caps echo the Scan Plate page heading.

function NeonUnderline() {
  const { active, toggleTool, lyrics, setLyrics } = useGroupState()
  return (
    <div className="llhg-neon" role="toolbar" aria-label="Header controls (Neon Underline)">
      <span className="llhg-neon-cap llhg-neon-cap--start" aria-hidden="true" />
      <Status />
      <span className="llhg-neon-sep" aria-hidden="true" />
      <div className="llhg-neon-tools">
        {TOOLS.map(tool => <ToolKey key={tool.id} tool={tool} on={active.has(tool.id)} onClick={() => toggleTool(tool.id)} className="llhg-neon-key" />)}
      </div>
      <span className="llhg-neon-sep" aria-hidden="true" />
      <LyricsToggle lyrics={lyrics} setLyrics={setLyrics} />
      <IconChipButton tone="primary" icon={<SaveIcon />}>Save</IconChipButton>
      <span className="llhg-neon-cap llhg-neon-cap--end" aria-hidden="true" />
    </div>
  )
}

// ── 05 · Command Capsule ──────────────────────────────────────────────────
// One rounded capsule with a gradient rim and frosted fill; circular tool
// buttons, dotted dividers and the primary Save as a filled pill at the end.

function CommandCapsule() {
  const { active, toggleTool, lyrics, setLyrics } = useGroupState()
  return (
    <div className="llhg-capsule" role="toolbar" aria-label="Header controls (Command Capsule)">
      <div className="llhg-capsule-body">
        <Status />
        <span className="llhg-capsule-dots" aria-hidden="true" />
        <div className="llhg-capsule-tools">
          {TOOLS.map(tool => <ToolKey key={tool.id} tool={tool} on={active.has(tool.id)} onClick={() => toggleTool(tool.id)} className="llhg-capsule-key" />)}
        </div>
        <span className="llhg-capsule-dots" aria-hidden="true" />
        <LyricsToggle lyrics={lyrics} setLyrics={setLyrics} />
        <IconChipButton tone="primary" icon={<SaveIcon />}>Save</IconChipButton>
      </div>
    </div>
  )
}

const CONCEPTS = [
  { id: 'segmented-deck', title: '01 · Segmented Deck', blurb: 'One bordered deck split by hairlines into status | tools | toggle | save. Reads as a single instrument; an active tool lights its own segment.', Group: SegmentedDeck },
  { id: 'floating-islands', title: '02 · Floating Islands', blurb: 'Three separate rounded glass islands — status, tools, actions — with air between them, so each job reads on its own.', Group: FloatingIslands },
  { id: 'hardware-console', title: '03 · Hardware Console', blurb: 'Machined strip: square keys with a pilot LED that lights when the tool is on, and a recessed status window.', Group: HardwareConsole },
  { id: 'neon-underline', title: '04 · Neon Underline', blurb: 'No boxes: a glowing hairline runs under the group, the active tool gets a cyan underline, angled end caps echo the Scan Plate heading.', Group: NeonUnderline },
  { id: 'command-capsule', title: '05 · Command Capsule', blurb: 'One rounded capsule with a gradient rim and frosted fill, circular tool buttons, dotted dividers and a filled Save pill.', Group: CommandCapsule },
]

export function HeaderControlGroupStyleGallery() {
  return (
    <div className="llcm-gallery lldd-gallery llhg-gallery" aria-label="Header control group concepts">
      {CONCEPTS.map(concept => (
        <section key={concept.id} className="lldd-gallery-row" data-testid={`header-control-concept-${concept.id}`}>
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{concept.title}</span>
            <span className="lldd-gallery-blurb">{concept.blurb}</span>
          </div>
          <HeaderFrame><concept.Group /></HeaderFrame>
        </section>
      ))}
    </div>
  )
}
