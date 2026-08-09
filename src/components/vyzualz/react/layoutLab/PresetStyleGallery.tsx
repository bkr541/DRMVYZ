import type { CSSProperties } from 'react'

// ── PresetStyleGallery ───────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Presets are one of the most-used,
// most-visible surfaces in the app — every engine's library lives here —
// so these three treatments are full-width rows (the real preset library
// is a scrolling list, not a card grid), with a real filled engine badge,
// a clearly distinct type scale between the preset name and the engine
// badge, and a solid tone-filled icon swatch rather than a bare bordered
// circle. Static sample data for now: just a preset's name and engine.

const ENGINE_TONES: Record<string, { label: string; color: string; icon: string }> = {
  cinema: { label: 'Cinema', color: '#b84fc9', icon: '◇' },
  oscilloscope: { label: 'Sound Drawing', color: '#61d6aa', icon: '〜' },
  canvas: { label: 'CANVAS', color: '#4ac7db', icon: '▣' },
  laserDmx: { label: 'LaserDMX', color: '#c0314a', icon: '✦' },
  pixGrid: { label: 'PixGrid', color: '#d8b95a', icon: '▦' },
}

const SAMPLE_PRESETS = [
  { id: 'neon-pulse-grid', name: 'Neon Pulse Grid', engineId: 'pixGrid' },
  { id: 'velvet-constellation', name: 'Velvet Constellation', engineId: 'cinema' },
  { id: 'ribbon-cascade', name: 'Ribbon Cascade', engineId: 'oscilloscope' },
]

function toneStyle(engineId: string): CSSProperties {
  return { '--llps-tone': ENGINE_TONES[engineId].color } as CSSProperties
}

// 1 — Aura Row: a solid tone-filled icon swatch, a large preset name, and a
// filled engine badge pinned to the right. Glows and lifts on hover.
function AuraRowPresets() {
  return (
    <div className="llps-aura-list">
      {SAMPLE_PRESETS.map(preset => {
        const engine = ENGINE_TONES[preset.engineId]
        return (
          <div key={preset.id} className="llps-aura-row" style={toneStyle(preset.engineId)}>
            <span className="llps-aura-glow" aria-hidden="true" />
            <span className="llps-aura-swatch" aria-hidden="true">{engine.icon}</span>
            <span className="llps-aura-name">{preset.name}</span>
            <span className="llps-badge llps-aura-badge">{engine.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// 2 — Signal Row: a tone-colored left rail with a pulsing status dot, a
// solid tone-filled icon swatch, the name large and left-aligned, and a
// filled engine badge on the right.
function SignalRowPresets() {
  return (
    <div className="llps-signal-list">
      {SAMPLE_PRESETS.map(preset => {
        const engine = ENGINE_TONES[preset.engineId]
        return (
          <button key={preset.id} type="button" className="llps-signal-item" style={toneStyle(preset.engineId)}>
            <span className="llps-signal-rail" aria-hidden="true" />
            <span className="llps-signal-swatch" aria-hidden="true">{engine.icon}</span>
            <span className="llps-signal-name">{preset.name}</span>
            <span className="llps-badge llps-signal-badge">
              <span className="llps-signal-dot" aria-hidden="true" />
              {engine.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// 3 — Spotlight Row: a breathing radial spotlight behind a large tone-filled
// icon swatch, the preset name large and center, a filled engine badge
// pinned to the right edge.
function SpotlightRowPresets() {
  return (
    <div className="llps-spotlight-list">
      {SAMPLE_PRESETS.map(preset => {
        const engine = ENGINE_TONES[preset.engineId]
        return (
          <div key={preset.id} className="llps-spotlight-row" style={toneStyle(preset.engineId)}>
            <span className="llps-spotlight-glow" aria-hidden="true" />
            <span className="llps-spotlight-swatch" aria-hidden="true">{engine.icon}</span>
            <span className="llps-spotlight-name">{preset.name}</span>
            <span className="llps-badge llps-spotlight-badge">{engine.label}</span>
          </div>
        )
      })}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'aura', title: '01 · Aura Row', blurb: 'Full-width row: a solid tone-filled icon swatch, a large preset name, and a filled engine badge — glows and lifts on hover.', Presets: AuraRowPresets },
  { id: 'signal', title: '02 · Signal Row', blurb: 'Full-width row with a tone-colored left rail, a pulsing status dot inside the engine badge, closest to a real saved-item list.', Presets: SignalRowPresets },
  { id: 'spotlight', title: '03 · Spotlight Row', blurb: 'Full-width row with a breathing radial spotlight behind a large icon swatch and a filled engine badge on the right edge.', Presets: SpotlightRowPresets },
]

export function PresetStyleGallery() {
  return (
    <div className="llps-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Presets />
          </div>
        </div>
      ))}
    </div>
  )
}
