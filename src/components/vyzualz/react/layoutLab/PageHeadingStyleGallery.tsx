import type { CSSProperties, ReactNode } from 'react'

// ── PageHeadingStyleGallery ──────────────────────────────────────────────
//
// Layout Lab / Template engine, middle visualizer only. Eight from-scratch
// concepts for the page-level header heading shown at the top of every view
// (Media Manager, Lyric Manager, REACT, Show Manager, Track Timeline
// Visualizer). Each concept is a full-width header bar that layers surface
// treatment, icon work and CSS-only motion behind/around the title text
// instead of styling the text alone. Presentation only — no store, no
// routing, nothing wired to a real page. Motion stops under
// prefers-reduced-motion.

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

function MediaIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M3 15.5l4.6-4.4 3.6 3.4 3-2.8L21 16" />
      <circle cx="16.5" cy="9" r="1.5" />
    </svg>
  )
}

function LyricIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 6.5h9M4 11h6M4 15.5h5" />
      <path d="M17 5v10.2" />
      <ellipse cx="14.8" cy="16.2" rx="2.3" ry="1.8" />
      <path d="M17 5c1.6.3 3 1.2 3.4 3" />
    </svg>
  )
}

function ShowIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3.5" y="4" width="7.5" height="7.5" rx="1.6" />
      <rect x="13" y="4" width="7.5" height="7.5" rx="1.6" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.6" />
      <path d="M13 17h7.5M16.75 13.5v7" />
    </svg>
  )
}

function ReactIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" />
      <path d="M12 8l4 4-4 4-4-4z" />
    </svg>
  )
}

function TimelineIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3.5 20.5h17" />
      <path d="M6 20.5V13M10 20.5V7M14 20.5v-9M18 20.5V9.5" />
      <path d="M3.5 5h17" strokeDasharray="1.5 2.5" />
    </svg>
  )
}

interface Concept {
  id: string
  title: string
  blurb: string
  Bar: () => ReactNode
}

// ── 01 · Scan Plate ───────────────────────────────────────────────────────
// Angled HUD plate with corner brackets, a scanning light sweep, an icon
// tag and a ticked rule that runs off to the right edge of the header.

function ScanPlate() {
  return (
    <div className="llph-bar llph-c1">
      <span className="llph-c1-corner llph-c1-corner--tl" aria-hidden="true" />
      <span className="llph-c1-corner llph-c1-corner--bl" aria-hidden="true" />
      <div className="llph-c1-plate">
        <span className="llph-c1-icon"><MediaIcon /></span>
        <span className="llph-c1-title">Media Manager</span>
        <span className="llph-c1-sweep" aria-hidden="true" />
      </div>
      <span className="llph-c1-rule" aria-hidden="true" />
    </div>
  )
}

// ── 02 · Halo Icon ────────────────────────────────────────────────────────
// A large icon tile inside a rotating dashed orbit ring and a soft radial
// glow, with a second oversized ghost icon layered behind the title.

function HaloIcon() {
  return (
    <div className="llph-bar llph-c2">
      <span className="llph-c2-glow" aria-hidden="true" />
      <span className="llph-c2-ghost" aria-hidden="true"><LyricIcon /></span>
      <span className="llph-c2-orb" aria-hidden="true">
        <svg className="llph-c2-ring" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="29" />
        </svg>
        <svg className="llph-c2-ring llph-c2-ring--inner" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="22" />
        </svg>
        <span className="llph-c2-icon"><LyricIcon /></span>
      </span>
      <span className="llph-c2-title">Lyric Manager</span>
    </div>
  )
}

// ── 03 · Circuit Trace ────────────────────────────────────────────────────
// Signal traces with pulsing nodes leave the title and run off to the right,
// a light packet travels each trace, and the title carries a drawn underline.

function CircuitTrace() {
  return (
    <div className="llph-bar llph-c3">
      <span className="llph-c3-chip" aria-hidden="true"><ShowIcon /></span>
      <span className="llph-c3-title">Show Manager</span>
      <svg className="llph-c3-traces" viewBox="0 0 700 92" preserveAspectRatio="xMinYMid slice" aria-hidden="true">
        <path className="llph-c3-trace" d="M0 46 H50 L74 24 H330 L354 46 H700" />
        <path className="llph-c3-trace llph-c3-trace--b" d="M0 46 H120 L144 68 H420 L444 46 H700" />
        <path className="llph-c3-trace llph-c3-trace--c" d="M0 46 H700" />
        <path className="llph-c3-packet" d="M0 46 H50 L74 24 H330 L354 46 H700" />
        <path className="llph-c3-packet llph-c3-packet--b" d="M0 46 H120 L144 68 H420 L444 46 H700" />
        <path className="llph-c3-packet llph-c3-packet--c" d="M0 46 H700" />
        <circle className="llph-c3-node" cx="74" cy="24" r="3.5" />
        <circle className="llph-c3-node llph-c3-node--b" cx="144" cy="68" r="3.5" />
        <circle className="llph-c3-node llph-c3-node--c" cx="354" cy="46" r="3.5" />
      </svg>
    </div>
  )
}

// ── 04 · Brushed Metal ────────────────────────────────────────────────────
// A machined instrument plate: brushed-metal surface with beveled edges,
// corner screws, an engraved title, a recessed icon well and a status LED,
// crossed by a slow specular sheen.

function BrushedMetal() {
  return (
    <div className="llph-bar llph-c4">
      <div className="llph-c4-plate">
        <span className="llph-c4-screw llph-c4-screw--tl" aria-hidden="true" />
        <span className="llph-c4-screw llph-c4-screw--bl" aria-hidden="true" />
        <span className="llph-c4-well" aria-hidden="true"><ReactIcon /></span>
        <span className="llph-c4-title">React</span>
        <span className="llph-c4-led" aria-hidden="true" />
        <span className="llph-c4-screw llph-c4-screw--tr" aria-hidden="true" />
        <span className="llph-c4-screw llph-c4-screw--br" aria-hidden="true" />
        <span className="llph-c4-sheen" aria-hidden="true" />
      </div>
    </div>
  )
}

// ── 05 · Spectrum Echo ────────────────────────────────────────────────────
// A live spectrum field rises from the bottom of the header behind the
// title, which trails a stepped echo of itself in cyan and magenta.

const SPECTRUM_BARS = Array.from({ length: 44 }, (_, index) => index)

function SpectrumEcho() {
  return (
    <div className="llph-bar llph-c5">
      <div className="llph-c5-spectrum" aria-hidden="true">
        {SPECTRUM_BARS.map(index => (
          <span
            key={index}
            className="llph-c5-bar"
            style={{
              '--i': index,
              '--d': `${(0.7 + ((index * 37) % 11) / 9).toFixed(2)}s`,
              '--o': `${(-((index * 53) % 17) / 10).toFixed(2)}s`,
            } as CSSProperties}
          />
        ))}
      </div>
      <span className="llph-c5-icon" aria-hidden="true"><TimelineIcon /></span>
      <span className="llph-c5-title" data-text="Track Timeline">Track Timeline</span>
    </div>
  )
}

// ── 06 · Glitch Signal ────────────────────────────────────────────────────
// Dot-matrix field with a scanline overlay; the title is stacked with red
// and cyan channel copies that tear apart in short bursts, with slash
// glyph chips either side.

function GlitchSignal() {
  return (
    <div className="llph-bar llph-c6">
      <span className="llph-c6-slash" aria-hidden="true">//</span>
      <span className="llph-c6-icon" aria-hidden="true"><MediaIcon /></span>
      <span className="llph-c6-title" data-text="Media Manager">Media Manager</span>
      <span className="llph-c6-slash llph-c6-slash--end" aria-hidden="true">//</span>
      <span className="llph-c6-scan" aria-hidden="true" />
    </div>
  )
}

// ── 07 · Aurora Glass ─────────────────────────────────────────────────────
// Drifting aurora color fields behind a frosted glass card with a rotating
// conic edge light, a glass icon tile with a top reflection and a
// gradient title.

function AuroraGlass() {
  return (
    <div className="llph-bar llph-c7">
      <span className="llph-c7-blob llph-c7-blob--a" aria-hidden="true" />
      <span className="llph-c7-blob llph-c7-blob--b" aria-hidden="true" />
      <span className="llph-c7-blob llph-c7-blob--c" aria-hidden="true" />
      <div className="llph-c7-card">
        <span className="llph-c7-edge" aria-hidden="true" />
        <div className="llph-c7-body">
          <span className="llph-c7-tile" aria-hidden="true"><LyricIcon /></span>
          <span className="llph-c7-title">Lyric Manager</span>
        </div>
      </div>
    </div>
  )
}

// ── 08 · Blueprint Stencil ────────────────────────────────────────────────
// Drafting-grid field with a top ruler, corner crosshairs and a dimension
// line. The title is an outline stencil that a solid fill continually wipes
// across, like ink being laid down over the drawing.

function BlueprintStencil() {
  return (
    <div className="llph-bar llph-c8">
      <span className="llph-c8-ruler" aria-hidden="true" />
      <span className="llph-c8-cross llph-c8-cross--tl" aria-hidden="true" />
      <span className="llph-c8-cross llph-c8-cross--br" aria-hidden="true" />
      <span className="llph-c8-icon" aria-hidden="true"><ShowIcon /></span>
      <div className="llph-c8-titlewrap">
        <span className="llph-c8-title">Show Manager</span>
        <span className="llph-c8-fill" aria-hidden="true">Show Manager</span>
        <span className="llph-c8-dim" aria-hidden="true" />
      </div>
    </div>
  )
}

const CONCEPTS: Concept[] = [
  {
    id: 'scan-plate',
    title: '01 · Scan Plate',
    blurb: 'Angled HUD plate with corner brackets, an icon tag, a sweeping scan light and a ticked rule that runs off the header.',
    Bar: ScanPlate,
  },
  {
    id: 'halo-icon',
    title: '02 · Halo Icon',
    blurb: 'Large icon orb in counter-rotating orbit rings with a radial glow and an oversized ghost icon layered behind the title.',
    Bar: HaloIcon,
  },
  {
    id: 'circuit-trace',
    title: '03 · Circuit Trace',
    blurb: 'Signal traces with pulsing nodes leave the title, a light packet travels each line, and the title draws its own underline.',
    Bar: CircuitTrace,
  },
  {
    id: 'brushed-metal',
    title: '04 · Brushed Metal',
    blurb: 'Machined instrument plate: brushed surface, beveled edge, corner screws, engraved title, recessed icon well, status LED and a slow specular sheen.',
    Bar: BrushedMetal,
  },
  {
    id: 'spectrum-echo',
    title: '05 · Spectrum Echo',
    blurb: 'A live spectrum field rises behind the title, which trails a stepped cyan and magenta echo of itself.',
    Bar: SpectrumEcho,
  },
  {
    id: 'glitch-signal',
    title: '06 · Glitch Signal',
    blurb: 'Dot-matrix field with a scanline overlay; red and cyan channel copies of the title tear apart in short bursts.',
    Bar: GlitchSignal,
  },
  {
    id: 'aurora-glass',
    title: '07 · Aurora Glass',
    blurb: 'Drifting aurora fields behind a frosted glass card with a rotating conic edge light and a glass icon tile.',
    Bar: AuroraGlass,
  },
  {
    id: 'blueprint-stencil',
    title: '08 · Blueprint Stencil',
    blurb: 'Drafting grid with ruler, crosshairs and a dimension line; an outline stencil title is repeatedly inked by a solid fill wipe.',
    Bar: BlueprintStencil,
  },
]

export function PageHeadingStyleGallery() {
  return (
    <div className="llcm-gallery lldd-gallery llph-gallery" aria-label="Page heading style concepts">
      {CONCEPTS.map(concept => (
        <div key={concept.id} className="lldd-gallery-row" data-testid={`page-heading-concept-${concept.id}`}>
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{concept.title}</span>
            <span className="lldd-gallery-blurb">{concept.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <concept.Bar />
          </div>
        </div>
      ))}
    </div>
  )
}
