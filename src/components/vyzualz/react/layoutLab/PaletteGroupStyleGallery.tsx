import { useEffect, useRef, useState } from 'react'
import { BubbleRevealSlider } from '../controls/BubbleRevealSlider'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'

// ── PaletteGroupStyleGallery ─────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Five candidate treatments for a named
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

const PRESET_SWATCHES = [
  '#4ac7db', '#67f7ff', '#6b4cff', '#b84fc9', '#d8b95a', '#61d6aa',
  '#ff6b6b', '#ffa07a', '#e8f4f8', '#9ab2bc', '#0a0d10', '#010208',
]

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

// ── 01 · Native Swatch (current pattern, refined) ────────────────────────────

function NativeSwatchPalette() {
  const [state, setColor] = usePaletteState()
  return (
    <div className="llpg-group llpg-group--cols-2">
      {PALETTE_FIELDS.map(field => (
        <div key={field.key} className="llpg-row">
          <span className="llpg-row-label">{field.label}</span>
          <label className="llpg-native-swatch" style={{ background: state[field.key] }}>
            <input
              type="color"
              value={state[field.key]}
              onChange={event => setColor(field.key, event.target.value)}
              aria-label={field.label}
            />
          </label>
          <span className="llpg-row-hex">{state[field.key].toUpperCase()}</span>
        </div>
      ))}
    </div>
  )
}

// ── 02 · Inline Expand (HSL sliders, accordion-style) ────────────────────────

function ExpandHslPalette() {
  const [state, setColor] = usePaletteState()
  const [openKey, setOpenKey] = useState<PaletteKey | null>(null)

  return (
    <div className="llpg-group llpg-group--cols-2">
      {PALETTE_FIELDS.map(field => {
        const open = openKey === field.key
        const [h, s, l] = hexToHsl(state[field.key])
        const setHsl = (nextH: number, nextS: number, nextL: number) => setColor(field.key, hslToHex(nextH, nextS, nextL))
        return (
          <div key={field.key} className={`llpg-expand-row${open ? ' is-open' : ''}`}>
            <button type="button" className="llpg-expand-hdr" onClick={() => setOpenKey(open ? null : field.key)}>
              <span className="llpg-swatch-dot" style={{ background: state[field.key] }} aria-hidden="true" />
              <span className="llpg-row-label">{field.label}</span>
              <span className="llpg-row-hex">{state[field.key].toUpperCase()}</span>
              <span className="llpg-expand-caret" aria-hidden="true">▾</span>
            </button>
            {open && (
              <div className="llpg-expand-body">
                <div className="llpg-hsl-row">
                  <span>Hue</span>
                  <BubbleRevealSlider min={0} max={360} step={1} value={h} onChange={event => setHsl(Number(event.target.value), s, l)} />
                </div>
                <div className="llpg-hsl-row">
                  <span>Saturation</span>
                  <BubbleRevealSlider min={0} max={100} step={1} value={s} onChange={event => setHsl(h, Number(event.target.value), l)} />
                </div>
                <div className="llpg-hsl-row">
                  <span>Lightness</span>
                  <BubbleRevealSlider min={0} max={100} step={1} value={l} onChange={event => setHsl(h, s, Number(event.target.value))} />
                </div>
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

// ── 03 · Popover Gradient Picker (2D saturation/lightness square + hue) ──────

function GradientPopoverPalette() {
  const [state, setColor] = usePaletteState()
  const [openKey, setOpenKey] = useState<PaletteKey | null>(null)
  const openRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openKey) return
    const onPointerDown = (event: PointerEvent) => {
      if (!openRowRef.current?.contains(event.target as Node)) setOpenKey(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [openKey])

  return (
    <div className="llpg-group llpg-group--cols-3">
      {PALETTE_FIELDS.map(field => {
        const open = openKey === field.key
        const [h, s, l] = hexToHsl(state[field.key])
        return (
          <div key={field.key} ref={open ? openRowRef : undefined} className="llpg-row llpg-row--popover-anchor">
            <span className="llpg-row-label">{field.label}</span>
            <button
              type="button"
              className="llpg-swatch-btn"
              style={{ background: state[field.key] }}
              aria-label={`Choose ${field.label}`}
              onClick={() => setOpenKey(open ? null : field.key)}
            />
            <span className="llpg-row-hex">{state[field.key].toUpperCase()}</span>
            {open && (
              <div className="llpg-popover">
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

// ── 04 · Preset Swatch Grid (curated on-brand colors only) ───────────────────

function PresetGridPalette() {
  const [state, setColor] = usePaletteState()
  const [openKey, setOpenKey] = useState<PaletteKey | null>(null)
  const openCellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openKey) return
    const onPointerDown = (event: PointerEvent) => {
      if (!openCellRef.current?.contains(event.target as Node)) setOpenKey(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [openKey])

  return (
    <div className="llpg-group llpg-group--strip-6">
      {PALETTE_FIELDS.map(field => {
        const open = openKey === field.key
        return (
          <div key={field.key} ref={open ? openCellRef : undefined} className="llpg-cell llpg-cell--popover-anchor">
            <span className="llpg-cell-label">{field.label.replace(' Color', '')}</span>
            <button
              type="button"
              className="llpg-swatch-btn llpg-swatch-btn--cell"
              style={{ background: state[field.key] }}
              aria-label={`Choose ${field.label}`}
              onClick={() => setOpenKey(open ? null : field.key)}
            />
            <span className="llpg-cell-hex">{state[field.key].toUpperCase()}</span>
            {open && (
              <div className="llpg-popover llpg-popover--grid llpg-popover--centered">
                <div className="llpg-preset-grid">
                  {PRESET_SWATCHES.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      className={`llpg-preset-swatch${preset.toLowerCase() === state[field.key].toLowerCase() ? ' is-active' : ''}`}
                      style={{ background: preset }}
                      aria-label={preset}
                      onClick={() => { setColor(field.key, preset); setOpenKey(null) }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 05 · Full-Bleed Swatch (the color fills the cell, label sits on top) ────

function HexFirstPalette() {
  const [state, setColor] = usePaletteState()

  return (
    <div className="llpg-group llpg-group--cols-3">
      {PALETTE_FIELDS.map(field => (
        <div key={field.key} className="llpg-fillcell-wrap">
          <span className="llpg-fillcell-label">{field.label.replace(' Color', '')}</span>
          <label className="llpg-fill-cell" style={{ background: state[field.key] }}>
            <input
              type="color"
              value={state[field.key]}
              onChange={event => setColor(field.key, event.target.value)}
              aria-label={field.label}
            />
          </label>
        </div>
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'native', title: '01 · Native Swatch', blurb: 'The current pattern: a swatch opens the OS color picker, with a live hex readout beside it. Simplest to build, least distinctive.', Palette: NativeSwatchPalette },
  { id: 'expand', title: '02 · Inline Expand', blurb: 'Clicking a row expands it in place — accordion-style — to reveal Hue/Saturation/Lightness sliders and a hex field. No overlay, everything stays in document flow.', Palette: ExpandHslPalette },
  { id: 'gradient', title: '03 · Popover Gradient', blurb: 'Clicking the swatch opens a floating picker with a 2D saturation/lightness square, a hue strip, and a hex field — the fullest, most "real" color-picker experience.', Palette: GradientPopoverPalette },
  { id: 'preset', title: '04 · Preset Grid', blurb: 'Clicking the swatch opens a curated grid of on-brand colors only — no arbitrary color entry. Fastest to pick from, keeps every palette on-brand by construction.', Palette: PresetGridPalette },
  { id: 'hexFirst', title: '05 · Full-Bleed Swatch', blurb: 'The label sits above a full-width color block — no visible hex text or buttons. Clicking anywhere on the color opens the OS picker.', Palette: HexFirstPalette },
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
