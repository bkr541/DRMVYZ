import { useState, type ReactNode } from 'react'

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
// The save status, the Show Lyrics toggle and Save are drawn as the SAME kind of
// key as the icon tools in each concept (same size language, borders, hover and
// on-state), so the whole group reads as one control family.
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

const LyricsIcon = () => <svg {...svgProps}><path d="M4 7h16M4 12h10M4 17h13" /></svg>

/** Read-only key: same shape as the tool keys, but not interactive. */
function StatusKey({ className }: { className: string }) {
  return (
    <span className={`${className} llhg-key--wide llhg-key--static`} role="status">
      <i className="llhg-key-dot" aria-hidden="true" />
      Saved 3:27 PM
    </span>
  )
}

/** Show Lyrics as a switch-style key: lit like an active tool when on. */
function LyricsKey({ lyrics, setLyrics, className }: { lyrics: boolean; setLyrics: (value: boolean) => void; className: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={lyrics}
      className={`${className} llhg-key--wide${lyrics ? ' is-on' : ''}`}
      onClick={() => setLyrics(!lyrics)}
    >
      <LyricsIcon />
      Show Lyrics
    </button>
  )
}

function SaveKey({ className }: { className: string }) {
  return (
    <button type="button" className={`${className} llhg-key--wide llhg-key--save`}>
      <SaveIcon />
      Save
    </button>
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
      <StatusKey className="llhg-deck-key" />
      <div className="llhg-deck-seg llhg-deck-seg--tools">
        {TOOLS.map(tool => <ToolKey key={tool.id} tool={tool} on={active.has(tool.id)} onClick={() => toggleTool(tool.id)} className="llhg-deck-key" />)}
      </div>
      <LyricsKey lyrics={lyrics} setLyrics={setLyrics} className="llhg-deck-key" />
      <SaveKey className="llhg-deck-key" />
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
      <StatusKey className="llhg-neon-key" />
      <span className="llhg-neon-sep" aria-hidden="true" />
      <div className="llhg-neon-tools">
        {TOOLS.map(tool => <ToolKey key={tool.id} tool={tool} on={active.has(tool.id)} onClick={() => toggleTool(tool.id)} className="llhg-neon-key" />)}
      </div>
      <span className="llhg-neon-sep" aria-hidden="true" />
      <LyricsKey lyrics={lyrics} setLyrics={setLyrics} className="llhg-neon-key" />
      <SaveKey className="llhg-neon-key" />
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
        <StatusKey className="llhg-capsule-key" />
        <span className="llhg-capsule-dots" aria-hidden="true" />
        <div className="llhg-capsule-tools">
          {TOOLS.map(tool => <ToolKey key={tool.id} tool={tool} on={active.has(tool.id)} onClick={() => toggleTool(tool.id)} className="llhg-capsule-key" />)}
        </div>
        <span className="llhg-capsule-dots" aria-hidden="true" />
        <LyricsKey lyrics={lyrics} setLyrics={setLyrics} className="llhg-capsule-key" />
        <SaveKey className="llhg-capsule-key" />
      </div>
    </div>
  )
}

const CONCEPTS = [
  { id: 'segmented-deck', title: '01 · Segmented Deck', blurb: 'One bordered deck split by hairlines into status | tools | Show Lyrics | Save — every cell is the same key. Reads as a single instrument; an active tool lights its own segment.', Group: SegmentedDeck },
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
