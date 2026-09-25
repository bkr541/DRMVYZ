import { useState } from 'react'
import { BubbleRevealSlider } from '../controls/BubbleRevealSlider'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'

// ── PaletteGroupStyleGallery ─────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Candidate treatments for a named
// color-slot group (Background / Primary / Secondary / Accent / Foreground /
// Highlight — the shape of Cinema's per-layer Palette group) that actually
// let the user pick a color per row, not just read one. Each entry owns its
// own independent color state so judging one doesn't disturb the others.

const PALETTE_FIELDS = [
  { key: 'background', label: 'Background Color', value: '#010208' },
  { key: 'primary', label: 'Primary Color', value: '#4ac7db' },
  { key: 'secondary', label: 'Secondary Color', value: '#6b4cff' },
  { key: 'accent', label: 'Accent Color', value: '#d8b95a' },
  { key: 'foreground', label: 'Foreground Color', value: '#e8f4f8' },
  { key: 'highlight', label: 'Highlight Color', value: '#e8fbff' },
] as const

type PaletteKey = typeof PALETTE_FIELDS[number]['key']
type PaletteState = Record<PaletteKey, string>

function usePaletteState(): [PaletteState, (key: PaletteKey, value: string) => void] {
  const [state, setState] = useState<PaletteState>(() => {
    const initial = {} as PaletteState
    for (const field of PALETTE_FIELDS) initial[field.key] = field.value
    return initial
  })
  const setColor = (key: PaletteKey, value: string) => setState(current => ({ ...current, [key]: value }))
  return [state, setColor]
}

// ── Color math (hex <-> HSL, only what the popover/expand variants need) ────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim()
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.padStart(6, '0')
  const value = Number.parseInt(full, 16) || 0
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
}

function hexToHsl(hex: string): [number, number, number] {
  const [r0, g0, b0] = hexToRgb(hex).map(v => v / 255)
  const max = Math.max(r0, g0, b0)
  const min = Math.min(r0, g0, b0)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r0) h = ((g0 - b0) / d) % 6
    else if (max === g0) h = (b0 - r0) / d + 2
    else h = (r0 - g0) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

function isValidHex(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
}

// ── 01 · Inline Expand (gradient picker, accordion-style) ────────────────────

function ExpandHslPalette() {
  const [state, setColor] = usePaletteState()
  const [openKey, setOpenKey] = useState<PaletteKey | null>(null)

  return (
    <div className="llpg-group llpg-group--cols-2">
      {PALETTE_FIELDS.map(field => {
        const open = openKey === field.key
        const [h, s, l] = hexToHsl(state[field.key])
        return (
          <div key={field.key} className={`llpg-expand-row${open ? ' is-open' : ''}`}>
            <button type="button" className="llpg-expand-hdr" onClick={() => setOpenKey(open ? null : field.key)}>
              <span className="llpg-swatch-dot" style={{ background: state[field.key] }} aria-hidden="true" />
              <span className="llpg-row-label">{field.label}</span>
              <span className="llpg-expand-caret" aria-hidden="true">▾</span>
            </button>
            {open && (
              <div className="llpg-expand-body">
                <div
                  className="llpg-gradient-square"
                  style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))` }}
                  onPointerDown={event => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    const move = (clientX: number, clientY: number) => {
                      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
                      const nextS = x * 100
                      const nextL = (1 - y) * 100
                      setColor(field.key, hslToHex(h, nextS, nextL))
                    }
                    move(event.clientX, event.clientY)
                    const onMove = (moveEvent: PointerEvent) => move(moveEvent.clientX, moveEvent.clientY)
                    const onUp = () => window.removeEventListener('pointermove', onMove)
                    window.addEventListener('pointermove', onMove)
                    window.addEventListener('pointerup', onUp, { once: true })
                  }}
                >
                  <span className="llpg-gradient-thumb" style={{ left: `${s}%`, top: `${100 - l}%` }} aria-hidden="true" />
                </div>
                <BubbleRevealSlider
                  className="llpg-hue-slider"
                  min={0} max={360} step={1}
                  value={h}
                  onChange={event => setColor(field.key, hslToHex(Number(event.target.value), s, l))}
                />
                <DreamVizTextInput
                  className="llpg-hex-input"
                  value={state[field.key]}
                  onChange={event => { if (isValidHex(event.target.value)) setColor(field.key, event.target.value) }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'expand', title: '01 · Palette Group - ReactControlRows.tsx', blurb: 'Collapsed rows show only the label and swatch — no hex readout. Clicking a row expands it in place — accordion-style — to reveal a saturation/lightness gradient square, a hue strip, and a hex field. No overlay, everything stays in document flow.', Palette: ExpandHslPalette },
]

export function PaletteGroupStyleGallery() {
  return (
    <div className="llpg-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Palette />
          </div>
        </div>
      ))}
    </div>
  )
}
