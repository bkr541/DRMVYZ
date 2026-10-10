import type { ReactNode } from 'react'

/**
 * The left navigation's icon artwork: five drawing systems for the four destinations (React, Show Manager, Lyric Manager, Media Manager), chosen per
 * destination by VyzualzSidebar and compared side by side in Layout Lab (Template, Design tab). Every glyph is drawn on a 32 grid in `currentColor`
 * plus one `llni-accent` shape, which takes the item's `--llni-accent` colour.
 */
export type NavIconKind = 'react' | 'show' | 'lyrics' | 'media'
export type GlyphProps = { kind: NavIconKind }

/** The DVYDRM logo's four-point star: concave sides pinched toward the centre. */
function star(cx: number, cy: number, r: number): string {
  const k = r * 0.14
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`
}

/** Two-tone helpers: `base` follows the item colour, `accent` is the cyan signal colour (brighter when the view is active). */
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const accent = { className: 'llni-accent' } as const

/** 01 · Signal Star: line icons whose one accent is the logo's four-point star, placed where each destination does its work. */
export function SignalStarGlyph({ kind }: GlyphProps) {
  return (
    <g {...base}>
      {kind === 'react' && <>
        <circle cx="15" cy="17" r="11" opacity="0.45" />
        <path d="M8.5 19v3M12 14v8M15.5 10v12M19 15v7M22.5 18v4" strokeWidth="2" />
        <path {...accent} d={star(25, 7, 4.6)} fill="currentColor" strokeWidth="0.8" />
      </>}
      {kind === 'show' && <>
        <rect x="4" y="9.5" width="12" height="4.6" rx="1.5" /><rect x="4" y="16.2" width="8" height="4.6" rx="1.5" /><rect x="4" y="22.9" width="13" height="4.6" rx="1.5" />
        <path {...accent} d="M23 11v17" strokeWidth="1.6" />
        <path {...accent} d={star(23, 6, 4.4)} fill="currentColor" strokeWidth="0.8" />
      </>}
      {kind === 'lyrics' && <>
        <path d="M5 8h22M5 15h11M5 22h16" strokeWidth="2" />
        <path d="M5 28.2h6" opacity="0.45" />
        <path {...accent} d={star(24, 15, 4.8)} fill="currentColor" strokeWidth="0.8" />
      </>}
      {kind === 'media' && <>
        <path d="M4.5 10.5V7a2.5 2.5 0 0 1 2.5-2.5h3.5M21.5 4.5H25A2.5 2.5 0 0 1 27.5 7v3.5M27.5 21.5V25a2.5 2.5 0 0 1-2.5 2.5h-3.5M10.5 27.5H7A2.5 2.5 0 0 1 4.5 25v-3.5" />
        <path d="m13 11.5 8 4.5-8 4.5Z" fill="currentColor" strokeWidth="1" />
        <path {...accent} d={star(22.5, 10, 3.2)} fill="currentColor" strokeWidth="0.7" />
      </>}
    </g>
  )
}

/** The cloud from the DVYDRM logo, as a container: a three-lobed outline with the destination drawn inside it. */
const CLOUD = 'M9.5 25.5a5.8 5.8 0 0 1-.9-11.5A7.6 7.6 0 0 1 22.6 12 6.4 6.4 0 0 1 23.5 25.5Z'

/** 02 · Cloud Mark: the logo's cloud outline carries every icon, so the four read as one family and as DRMVYZ. */
export function CloudMarkGlyph({ kind }: GlyphProps) {
  return (
    <g {...base}>
      <path d={CLOUD} strokeWidth="1.6" />
      {kind === 'react' && <path {...accent} d="M10.5 19.5h2l1.4-4 2.6 7 2-9 1.5 6h1.5" strokeWidth="1.5" />}
      {kind === 'show' && <><path d="M10.5 17.5h5M10.5 21h8" opacity="0.8" /><path {...accent} d="M20 14.5v8" strokeWidth="1.6" /><circle {...accent} cx="20" cy="14" r="1.1" fill="currentColor" stroke="none" /></>}
      {kind === 'lyrics' && <><path d="M10.5 17.5h11M10.5 21h6" /><path {...accent} d="M19.5 20v2.5" strokeWidth="1.8" /></>}
      {kind === 'media' && <path {...accent} d="m14.2 15.6 6 3.4-6 3.4Z" fill="currentColor" strokeWidth="1" />}
    </g>
  )
}

/** 03 · Deck Hardware: each destination drawn as the piece of DJ gear it behaves like (jog wheel, deck screen, pad grid, moving head). */
export function DeckHardwareGlyph({ kind }: GlyphProps) {
  return (
    <g {...base}>
      {kind === 'react' && <>
        <circle cx="16" cy="16" r="12" /><circle cx="16" cy="16" r="7.4" opacity="0.5" strokeDasharray="1.4 2.2" /><circle cx="16" cy="16" r="2.4" fill="currentColor" stroke="none" />
        <path {...accent} d="M16 4v5.2" strokeWidth="2.2" />
      </>}
      {kind === 'show' && <>
        <path d="M8 4.5h16" /><path d="M11 4.5v7M21 4.5v7" /><rect x="10" y="11" width="12" height="8" rx="3.6" />
        <path {...accent} d="M12.4 22.2 8 28M19.6 22.2 24 28M16 22.6V28.5" strokeWidth="1.5" />
      </>}
      {kind === 'lyrics' && <>
        <rect x="3.5" y="5.5" width="25" height="17" rx="3" />
        <path d="M8 10.5h14M8 14h9" opacity="0.7" /><path {...accent} d="M8 18h16" strokeWidth="2.4" />
        <circle cx="10" cy="27" r="1.4" /><circle cx="16" cy="27" r="1.4" /><circle cx="22" cy="27" r="1.4" />
      </>}
      {kind === 'media' && <>
        {[5, 12.5, 20].flatMap(x => [5, 12.5, 20].map(y => (x === 12.5 && y === 12.5)
          ? <rect {...accent} key={`${x}${y}`} x={x} y={y} width="7" height="7" rx="1.8" fill="currentColor" />
          : <rect key={`${x}${y}`} x={x} y={y} width="7" height="7" rx="1.8" opacity={x === 20 && y === 5 ? 1 : 0.75} />))}
      </>}
    </g>
  )
}

/** 04 · Isometric Stack: every icon sits on the same tilted plane, with the destination's meaning stacked or standing on it. */
export function IsometricStackGlyph({ kind }: GlyphProps) {
  const plane = (y: number, props: Record<string, unknown> = {}) => <path d={`M16 ${y}L28 ${y + 6}L16 ${y + 12}L4 ${y + 6}Z`} {...props} />
  return (
    <g {...base}>
      {kind === 'react' && <>
        <path {...accent} d="M4 21.5 16 27.5 28 21.5" opacity="0.9" /><path d="M4 16.5 16 22.5 28 16.5" opacity="0.6" />
        {plane(4)}<path d="M9.5 11.8l2.2-1.1 2.4 2.2 2.8-3 2.4 3.4 2.2-1.2" strokeWidth="1.3" />
      </>}
      {kind === 'show' && <>
        {plane(17)}<path d="M5 4.5h22" /><rect x="8" y="5.5" width="4" height="3.6" rx="1.2" /><rect x="20" y="5.5" width="4" height="3.6" rx="1.2" />
        <path {...accent} d="M8.5 10.5 6 18M11.5 10.5l3 6.5M20.5 10.5l-3 6.5M23.5 10.5 26 18" strokeWidth="1.4" />
      </>}
      {kind === 'lyrics' && <>
        {plane(9)}<path d="M10 14.2l5 2.5M14 12.2l7 3.5M18 10.2 24 13.2" opacity="0.8" />
        <path {...accent} d="M4 22.5 16 28.5 28 22.5" /><path d="M4 18.5 16 24.5" opacity="0.4" />
      </>}
      {kind === 'media' && <>
        <rect x="4" y="12" width="17" height="13" rx="2" opacity="0.4" /><rect x="8" y="8" width="17" height="13" rx="2" opacity="0.7" />
        <rect x="11.5" y="5" width="17" height="13" rx="2" fill="none" /><path {...accent} d="m17.5 8.6 6 3.4-6 3.4Z" fill="currentColor" strokeWidth="1" />
      </>}
    </g>
  )
}

/** 05 · Hex Seal: a hexagon (the Rekordbox/DRMVYZ shape) with a solid, cut-out symbol inside and one accent vertex. */
export function HexSealGlyph({ kind }: GlyphProps) {
  return (
    <g>
      <path d="M16 2.8 27.4 9.4v13.2L16 29.2 4.6 22.6V9.4Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle {...accent} cx="16" cy="2.8" r="1.7" fill="currentColor" />
      <g fill="currentColor" stroke="none">
        {kind === 'react' && <><rect x="9" y="17" width="2.4" height="4" rx="1.2" /><rect x="12.7" y="12" width="2.4" height="9" rx="1.2" /><rect x="16.9" y="9" width="2.4" height="12" rx="1.2" /><rect x="20.6" y="14" width="2.4" height="7" rx="1.2" /></>}
        {kind === 'show' && <><rect x="9" y="10.5" width="7" height="3" rx="1.5" /><rect x="9" y="15" width="11" height="3" rx="1.5" /><rect x="9" y="19.5" width="8" height="3" rx="1.5" /><rect {...accent} x="21" y="9.5" width="2" height="14" rx="1" /></>}
        {kind === 'lyrics' && <><rect x="9" y="10" width="14" height="2.6" rx="1.3" /><rect x="9" y="14.6" width="9" height="2.6" rx="1.3" /><rect x="9" y="19.2" width="12" height="2.6" rx="1.3" /><rect {...accent} x="21.6" y="14" width="2" height="8" rx="1" /></>}
        {kind === 'media' && <path d="m12.6 10.6 9.4 5.4-9.4 5.4Z" />}
      </g>
    </g>
  )
}

/** Wraps a glyph in the 32-grid svg the artwork is drawn for. */
export function NavIconSvg({ children, size = 32 }: { children: ReactNode; size?: number }) {
  return <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">{children}</svg>
}
