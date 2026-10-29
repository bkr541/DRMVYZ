import type { ReactNode } from 'react'
import { AppIcon } from '../../shared/icons/AppIcon'
import type { StoreArtSpec, StoreItem } from './storeCatalog'

export const COMING_SOON = 'Checkout and downloads are coming soon'

/** Generated placeholder art: layered hue gradient plus a motif, so no image assets are required. */
/** `fit: 'contain'` shows the whole motif instead of cropping it to a wide frame. */
export function StoreArt({ art, className = '', fit = 'cover' }: { art: StoreArtSpec; className?: string; fit?: 'cover' | 'contain' }) {
  const mono = art.hue === 0 && art.accentHue === 0
  const base = (lightness: number, sat = 70) => mono ? `hsl(0 0% ${lightness}%)` : `hsl(${art.hue} ${sat}% ${lightness}%)`
  const accent = (lightness: number) => mono ? `hsl(0 0% ${lightness}%)` : `hsl(${art.accentHue} 90% ${lightness}%)`
  const stroke = accent(68)
  const motif = (() => {
    switch (art.motif) {
      case 'triangle': return <path d="M50 14 86 78H14Z M50 34 69 68H31Z" />
      case 'ring': return <><circle cx="50" cy="50" r="26" strokeWidth="4" /><circle cx="50" cy="50" r="17" opacity=".55" /></>
      case 'crystal': return <path d="M50 12 78 40 62 88H38L22 40Z M22 40H78 M50 12 38 88 M50 12 62 88" />
      case 'cube': return <path d="M50 14 82 32V68L50 86 18 68V32Z M18 32 50 50 82 32 M50 50V86" />
      case 'peaks': return <><path d="M0 74 24 48 38 62 58 36 78 60 100 44" strokeWidth="3" /><path d="M50 12 74 52H26Z" opacity=".7" /></>
      case 'waves': return <path d="M0 40Q25 20 50 40T100 40 M0 56Q25 36 50 56T100 56 M0 72Q25 52 50 72T100 72" />
      case 'frame': return <><rect x="22" y="24" width="56" height="52" strokeWidth="3.5" /><rect x="32" y="34" width="36" height="32" opacity=".6" /></>
      default: return <path d="M8 30 30 20 52 34 74 22 92 32 M6 52 28 44 50 58 72 46 94 54 M10 76 32 66 54 80 76 68 90 76" opacity=".8" />
    }
  })()
  return (
    <span
      className={`pms-art${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={{ background: `radial-gradient(120% 90% at 70% 20%, ${base(26)} 0%, ${base(10, 60)} 55%, hsl(${art.hue} 40% 4%) 100%)` }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio={fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${accent(55)})` }}>
        {motif}
      </svg>
    </span>
  )
}

export function InertButton({ className, children, label }: { className: string; children: ReactNode; label: string }) {
  return (
    <button type="button" className={className} aria-disabled="true" title={COMING_SOON} aria-label={label} onClick={event => { event.preventDefault(); event.stopPropagation() }}>
      {children}
    </button>
  )
}


export function StarButton({ item, favorite, onToggle }: { item: Pick<StoreItem, 'name'>; favorite: boolean; onToggle: () => void }) {
  return (
    <button
      className={`vz-media-star pms-star${favorite ? ' vz-media-star--active' : ''}`}
      type="button"
      onClick={event => { event.stopPropagation(); onToggle() }}
      aria-pressed={favorite}
      aria-label={`${favorite ? 'Remove' : 'Add'} ${item.name} ${favorite ? 'from' : 'to'} wishlist`}
    >
      <AppIcon kind={favorite ? 'starOff' : 'star'} size={12} color="currentColor" />
    </button>
  )
}
