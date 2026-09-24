import type { CSSProperties } from 'react'
import { Badge } from '../controls/Badge'

// ── PresetCardStyleGallery ────────────────────────────────────────────────
//
// Layout Lab / Template engine only, right rail → PRESETS tab. Candidate
// treatments for a preset card (the shape ReactPresetCard actually renders
// today: a 76×52 thumbnail, a name, up to two chips, a "Modified" badge, and
// a favorite star — no description or palette swatch, since the production
// component never renders those props despite declaring them).
//
// Entries 03–07 carry the page-heading concepts (PageHeadingStyleGallery) down
// to the preset row, static: Scan Plate, Halo Icon, Brushed Metal, Aurora Glass
// and Blueprint Stencil. Same content as the production card, no animation.

interface PresetSample {
  name: string
  chips: string[]
  tone: string
  modified?: boolean
  active?: boolean
  favorite?: boolean
}

const PRESET_SAMPLES: PresetSample[] = [
  { name: 'Clean Playback', chips: ['Source'], tone: '#e8f4f8', active: true, favorite: true },
  { name: 'Particle Aura', chips: ['Particles'], tone: '#4ac7db', modified: true },
  { name: 'Fractures', chips: ['Fragments'], tone: '#8de7ff' },
  { name: 'Laser Image FX', chips: ['Laser'], tone: '#72fff0', favorite: true },
]

function PresetChips({ preset }: { preset: PresetSample }) {
  return (
    <>
      {preset.chips.map(chip => <Badge key={chip} label={chip} tone={preset.tone} />)}
      {preset.modified && <Badge label="Modified" tone="#ffb347" />}
    </>
  )
}

// ── 01 · Filmstrip Row ───────────────────────────────────────────────────────
// The current production shape, refined: a wide thumbnail on the left, name
// and chips stacked on the right, favorite star pinned to the corner.

function FilmstripRows() {
  return (
    <div className="llpc-filmstrip-list">
      {PRESET_SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llpc-filmstrip-card${preset.active ? ' is-active' : ''}`}
        >
          <span className="llpc-filmstrip-thumb" style={{ '--llpc-tone': preset.tone } as CSSProperties} aria-hidden="true" />
          <span className="llpc-filmstrip-body">
            <span className="llpc-filmstrip-name">{preset.name}</span>
            <span className="llpc-filmstrip-meta"><PresetChips preset={preset} /></span>
          </span>
          {preset.favorite && <span className="llpc-filmstrip-fav" aria-hidden="true">★</span>}
        </button>
      ))}
    </div>
  )
}

// ── 02 · Minimal List ────────────────────────────────────────────────────────
// No thumbnail at all — a color dot stands in for it. Highest density,
// suited to long preset libraries where a thumbnail adds little signal.

function MinimalListRows() {
  return (
    <div className="llpc-minimal-list">
      {PRESET_SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llpc-minimal-row${preset.active ? ' is-active' : ''}`}
        >
          <span className="llpc-minimal-dot" style={{ '--llpc-tone': preset.tone } as CSSProperties} aria-hidden="true" />
          <span className="llpc-minimal-name">{preset.name}</span>
          <span className="llpc-minimal-chips"><PresetChips preset={preset} /></span>
          {preset.favorite && <span className="llpc-minimal-fav" aria-hidden="true">★</span>}
        </button>
      ))}
    </div>
  )
}

function PresetGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" />
      <path d="M12 8l4 4-4 4-4-4z" />
    </svg>
  )
}

function toneStyle(preset: PresetSample): CSSProperties {
  return { '--llpc-tone': preset.tone } as CSSProperties
}

// ── 03 · Scan Plate ──────────────────────────────────────────────────────────
// Angled HUD plate: corner brackets, a clipped icon tag, gradient name and a
// ticked rule under the chips.

function ScanPlateRows() {
  return (
    <div className="llpc-hud-list">
      {PRESET_SAMPLES.map(preset => (
        <button type="button" key={preset.name} className={`llpc-hud-card${preset.active ? ' is-active' : ''}`} style={toneStyle(preset)}>
          <span className="llpc-hud-corner llpc-hud-corner--tl" aria-hidden="true" />
          <span className="llpc-hud-corner llpc-hud-corner--bl" aria-hidden="true" />
          <span className="llpc-hud-icon" aria-hidden="true"><PresetGlyph /></span>
          <span className="llpc-hud-body">
            <span className="llpc-hud-name">{preset.name}</span>
            <span className="llpc-hud-meta"><PresetChips preset={preset} /></span>
          </span>
          {preset.favorite && <span className="llpc-fav" aria-hidden="true">★</span>}
          <span className="llpc-hud-rule" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

// ── 04 · Halo Icon ───────────────────────────────────────────────────────────
// The thumbnail becomes an icon orb inside two dashed rings and a radial glow,
// with an oversized ghost glyph behind the name.

function HaloIconRows() {
  return (
    <div className="llpc-halo-list">
      {PRESET_SAMPLES.map(preset => (
        <button type="button" key={preset.name} className={`llpc-halo-card${preset.active ? ' is-active' : ''}`} style={toneStyle(preset)}>
          <span className="llpc-halo-glow" aria-hidden="true" />
          <span className="llpc-halo-ghost" aria-hidden="true"><PresetGlyph /></span>
          <span className="llpc-halo-orb" aria-hidden="true">
            <svg className="llpc-halo-ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" /></svg>
            <svg className="llpc-halo-ring llpc-halo-ring--inner" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" /></svg>
            <span className="llpc-halo-icon"><PresetGlyph /></span>
          </span>
          <span className="llpc-halo-body">
            <span className="llpc-halo-name">{preset.name}</span>
            <span className="llpc-halo-meta"><PresetChips preset={preset} /></span>
          </span>
          {preset.favorite && <span className="llpc-fav" aria-hidden="true">★</span>}
        </button>
      ))}
    </div>
  )
}

// ── 05 · Brushed Metal ───────────────────────────────────────────────────────
// A machined instrument plate: brushed surface, beveled edge, corner screws,
// engraved name, recessed icon well and a status LED for the active preset.

function BrushedMetalRows() {
  return (
    <div className="llpc-metal-list">
      {PRESET_SAMPLES.map(preset => (
        <button type="button" key={preset.name} className={`llpc-metal-card${preset.active ? ' is-active' : ''}`} style={toneStyle(preset)}>
          <span className="llpc-metal-screw llpc-metal-screw--tl" aria-hidden="true" />
          <span className="llpc-metal-screw llpc-metal-screw--bl" aria-hidden="true" />
          <span className="llpc-metal-screw llpc-metal-screw--tr" aria-hidden="true" />
          <span className="llpc-metal-screw llpc-metal-screw--br" aria-hidden="true" />
          <span className="llpc-metal-well" aria-hidden="true"><PresetGlyph /></span>
          <span className="llpc-metal-body">
            <span className="llpc-metal-name">{preset.name}</span>
            <span className="llpc-metal-meta"><PresetChips preset={preset} /></span>
          </span>
          {preset.favorite && <span className="llpc-fav llpc-metal-fav" aria-hidden="true">★</span>}
          <span className="llpc-metal-led" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

// ── 06 · Aurora Glass ────────────────────────────────────────────────────────
// Soft aurora color fields behind a frosted glass card with a bright rim, a
// glass icon tile with a top reflection and a gradient name.

function AuroraGlassRows() {
  return (
    <div className="llpc-glass-list">
      {PRESET_SAMPLES.map(preset => (
        <button type="button" key={preset.name} className={`llpc-glass-card${preset.active ? ' is-active' : ''}`} style={toneStyle(preset)}>
          <span className="llpc-glass-blob llpc-glass-blob--a" aria-hidden="true" />
          <span className="llpc-glass-blob llpc-glass-blob--b" aria-hidden="true" />
          <span className="llpc-glass-pane">
            <span className="llpc-glass-tile" aria-hidden="true"><PresetGlyph /></span>
            <span className="llpc-glass-body">
              <span className="llpc-glass-name">{preset.name}</span>
              <span className="llpc-glass-meta"><PresetChips preset={preset} /></span>
            </span>
            {preset.favorite && <span className="llpc-fav" aria-hidden="true">★</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── 07 · Blueprint Stencil ───────────────────────────────────────────────────
// Drafting grid with a ruler, crosshairs and a dimension line; the icon sits in
// a dashed frame and the name is an outline stencil (solid when active).

function BlueprintRows() {
  return (
    <div className="llpc-blue-list">
      {PRESET_SAMPLES.map(preset => (
        <button type="button" key={preset.name} className={`llpc-blue-card${preset.active ? ' is-active' : ''}`} style={toneStyle(preset)}>
          <span className="llpc-blue-ruler" aria-hidden="true" />
          <span className="llpc-blue-cross llpc-blue-cross--tl" aria-hidden="true" />
          <span className="llpc-blue-cross llpc-blue-cross--br" aria-hidden="true" />
          <span className="llpc-blue-icon" aria-hidden="true"><PresetGlyph /></span>
          <span className="llpc-blue-body">
            <span className="llpc-blue-namewrap">
              <span className="llpc-blue-name">{preset.name}</span>
              <span className="llpc-blue-dim" aria-hidden="true" />
            </span>
            <span className="llpc-blue-meta"><PresetChips preset={preset} /></span>
          </span>
          {preset.favorite && <span className="llpc-fav" aria-hidden="true">★</span>}
        </button>
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'filmstrip', title: '01 · Preset Card - ReactPresetCard.tsx', blurb: 'The current production shape, refined — a wide thumbnail on the left, name and chips stacked on the right, favorite star pinned to the corner.', Rows: FilmstripRows },
  { id: 'minimal', title: '02 · Preset Card - ReactPresetCard.tsx', blurb: 'No thumbnail at all — a color dot stands in for it. The highest-density option, suited to long preset libraries where a thumbnail adds little signal.', Rows: MinimalListRows },
  { id: 'scan-plate', title: '03 · Preset Card - Scan Plate style', blurb: 'Angled HUD plate with corner brackets, a clipped icon tag, a gradient name and a ticked rule. Static version of the Scan Plate heading.', Rows: ScanPlateRows },
  { id: 'halo-icon', title: '04 · Preset Card - Halo Icon style', blurb: 'The thumbnail becomes an icon orb in dashed rings with a radial glow and a ghost glyph behind the name. Static version of the Halo Icon heading.', Rows: HaloIconRows },
  { id: 'brushed-metal', title: '05 · Preset Card - Brushed Metal style', blurb: 'Machined instrument plate: brushed surface, beveled edge, corner screws, engraved name, recessed icon well and a status LED. Static version of the Brushed Metal heading.', Rows: BrushedMetalRows },
  { id: 'aurora-glass', title: '06 · Preset Card - Aurora Glass style', blurb: 'Aurora color fields behind a frosted glass card with a bright rim, a glass icon tile and a gradient name. Static version of the Aurora Glass heading.', Rows: AuroraGlassRows },
  { id: 'blueprint-stencil', title: '07 · Preset Card - Blueprint Stencil style', blurb: 'Drafting grid with ruler, crosshairs and a dimension line; dashed icon frame and an outline stencil name. Static version of the Blueprint Stencil heading.', Rows: BlueprintRows },
]

export function PresetCardStyleGallery() {
  return (
    <div className="llpc-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Rows />
          </div>
        </div>
      ))}
    </div>
  )
}
