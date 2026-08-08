import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { useEffect, useId, useState } from 'react'
import type { BrandPalette, BrandPaletteRole } from '../BrandKitTypes'
import { BRAND_PALETTE_ROLES } from '../BrandKitTypes'
import { contrastRatio, normalizeHexColor } from '../paletteColorSpace'

const ROLE_LABELS: Record<BrandPaletteRole, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  background: 'Background',
  highlight: 'Highlight',
  text: 'Text',
}

const HEX_RE = /^#[0-9a-f]{6}$/i

function ContrastNotice({ foreground, background, label, threshold }: {
  foreground: string
  background: string
  label: string
  threshold: number
}) {
  const ratio = contrastRatio(foreground, background)
  if (ratio >= threshold) return null
  return (
    <li className="bk-contrast-warning">
      {label} contrast is {ratio.toFixed(1)}:1. It may be difficult to read on stage displays.
    </li>
  )
}

function PaletteField({ role, value, resetValue, onChange, compact }: {
  role: BrandPaletteRole
  value: string
  resetValue: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  const valid = HEX_RE.test(draft)

  useEffect(() => setDraft(value), [value])

  function commit() {
    if (!valid) return
    const normalized = normalizeHexColor(draft)
    setDraft(normalized)
    onChange(normalized)
  }

  return (
    <div className={`bk-palette-field${compact ? ' bk-palette-field--compact' : ''}`}>
      <label htmlFor={`${id}-hex`} className="bk-field-label">{ROLE_LABELS[role]}</label>
      <div className="bk-palette-field-controls">
        <input
          id={`${id}-color`}
          className="bk-color-input"
          type="color"
          value={normalizeHexColor(value)}
          aria-label={`${ROLE_LABELS[role]} color picker`}
          onChange={event => {
            const next = normalizeHexColor(event.target.value)
            setDraft(next)
            onChange(next)
          }}
        />
        <DreamVizTextInput
          id={`${id}-hex`}
          className={`bk-hex-input${valid ? '' : ' bk-hex-input--invalid'}`}
          value={draft}
          maxLength={7}
          aria-invalid={!valid}
          aria-describedby={!valid ? `${id}-error` : undefined}
          onChange={event => setDraft(event.target.value.toUpperCase())}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
          }}
        />
        <span className="bk-swatch-preview" style={{ background: valid ? draft : value }} aria-hidden="true" />
        <button
          type="button"
          className="bk-icon-button"
          onClick={() => {
            setDraft(resetValue)
            onChange(resetValue)
          }}
          aria-label={`Reset ${ROLE_LABELS[role]} color`}
          title={`Reset ${ROLE_LABELS[role]}`}
        >↺</button>
      </div>
      {!valid && <span id={`${id}-error`} className="bk-field-error">Use a six-digit hex color such as #19BFF2.</span>}
    </div>
  )
}

export function BrandKitPaletteEditor({ palette, resetPalette, onChange, compact = false }: {
  palette: BrandPalette
  resetPalette: BrandPalette
  onChange: (palette: BrandPalette) => void
  compact?: boolean
}) {
  return (
    <div className={`bk-palette-editor${compact ? ' bk-palette-editor--compact' : ''}`}>
      <div className="bk-palette-grid">
        {BRAND_PALETTE_ROLES.map(role => (
          <PaletteField
            key={role}
            role={role}
            value={palette[role]}
            resetValue={resetPalette[role]}
            onChange={value => onChange({ ...palette, [role]: value })}
            compact={compact}
          />
        ))}
      </div>
      {!compact && (
        <ul className="bk-contrast-list" aria-label="Palette contrast warnings">
          <ContrastNotice foreground={palette.text} background={palette.background} label="Text on background" threshold={4.5} />
          <ContrastNotice foreground={palette.highlight} background={palette.background} label="Highlight on background" threshold={3} />
          <ContrastNotice foreground={palette.primary} background={palette.background} label="Primary on background" threshold={2.25} />
        </ul>
      )}
    </div>
  )
}
