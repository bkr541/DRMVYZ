import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { PaletteColorRow } from '../../../components/vyzualz/react/ReactControlRows'
import type { BrandPalette, BrandPaletteRole } from '../BrandKitTypes'
import { BRAND_PALETTE_ROLES } from '../BrandKitTypes'
import { contrastRatio } from '../paletteColorSpace'

const ROLE_LABELS: Record<BrandPaletteRole, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  background: 'Background',
  highlight: 'Highlight',
  text: 'Text',
}

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

function PaletteField({ role, value, resetValue, onChange }: {
  role: BrandPaletteRole
  value: string
  resetValue: string
  onChange: (value: string) => void
}) {
  return <div className="bk-palette-field">
    <PaletteColorRow label={ROLE_LABELS[role]} value={value} onChange={onChange} />
    <IconChipButton className="bk-icon-action" onClick={() => onChange(resetValue)} aria-label={`Reset ${ROLE_LABELS[role]} color`} icon={<AppIcon kind="rotateLeft" size={14} />} />
  </div>
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
