import type { ReactElement } from 'react'
import './navMedallionIcons.css'

/**
 * The left navigation's icon artwork: the "Medallion" system chosen in Layout Lab (Nav bar icons, row 09). Each destination sits in a ring
 * with a lit arc, drawn on a 32 grid. Structure follows the item colour (`currentColor`); accent shapes take `--llni-accent`, which the
 * navigation already sets per item (dimmer at rest, brighter when active). Notifications keeps its own control and is not part of this set.
 */
export type NavMedallionKind = 'navReact' | 'navPerformance' | 'navPreset' | 'navShow' | 'navLyrics' | 'navMedia'

const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`
const P = (key: string, cls: string, d: string, extra: Record<string, unknown> = {}): ReactElement => <path key={key} className={cls} d={d} {...extra} />
const EO = { fillRule: 'evenodd' } as const

/** The ring is wider than the 32 grid (radius 16), so the symbol inside keeps its size and sits clear of the ring. */
const RING = [P('r', 'ring', circle(16, 16, 16)), P('r2', 'a', 'M16 0a16 16 0 0 1 13.86 8')]
export const NAV_MEDALLION_RING = RING

/** The Engine switcher symbol (Layout Lab, React options · engine system): the live engine's card in front, the others at the sides. */
export const engineSwitcherSymbol = (): ReactElement[] => [
  P('l', 's', rr(6.5, 12, 5.5, 8.5, 1.5), { style: { opacity: .5 } }),
  P('r', 's', rr(20, 12, 5.5, 8.5, 1.5), { style: { opacity: .5 } }),
  P('c', 'ta', rr(11.2, 9, 9.6, 14, 2)),
  P('w', 'a', 'M12.8 16h1.4l.9-2.4 1.5 4.8.9-2.4h1'),
]
/** React (home): the engine switcher. */
const react = (): ReactElement[] => [...RING, ...engineSwitcherSymbol()]

/** Performance Pads: two rail pads (a colour rail and label per pad), the lower one lit. Elements keep their size; the pair sits clear of the ring. */
const PAD_X = 10
const PAD_ROWS = [3, 12.5]
const pads = (): ReactElement[] => [
  ...RING,
  <g key="p" transform="translate(16 16) scale(.66) translate(-16 -11.25)">
    {[
      P('t', 'ts', rr(PAD_X, PAD_ROWS[0], 12, 7, 2)),
      P('r', 'a', PAD_ROWS.map(y => `M${PAD_X + 2.3} ${y + 1.8}v3.4`).join('')),
      P('l', 's', PAD_ROWS.map(y => `M${PAD_X + 5} ${y + 3.5}h5`).join('')),
      P('c', 'ta', rr(PAD_X, PAD_ROWS[1], 12, 7, 2)),
    ]}
  </g>,
]

/** Preset Manager: three sliders and their knobs. */
const presets = (): ReactElement[] => [
  ...RING,
  <g key="p" transform="translate(16 16) scale(.92) translate(-16 -16.5)">
    {[P('b', 's', 'M8 11h16M8 16.5h16M8 22h16'), P('c', 'a', 'M8 11h5.5M8 16.5h11.5M8 22h3.5'), P('d', 'fa', `${circle(13.5, 11, 2.3)}${circle(19.5, 16.5, 2.3)}${circle(11.5, 22, 2.3)}`)]}
  </g>,
]

/** Show Manager: a light over its beams, on a stage line. */
const show = (): ReactElement[] => [...RING, P('a', 's', 'M12 8h8l1.5 4h-11ZM9 23h14'), P('b', 'a', 'M12 15l-2 4M16 15v4M20 15l2 4')]

/** Lyric Manager: a microphone. */
const lyrics = (): ReactElement[] => [
  ...RING,
  P('a', 's', `${rr(12.5, 7.5, 7, 10.5, 3.5)}M9.8 15a6.2 6.2 0 0 0 12.4 0M16 21.2v3M12.8 24.2h6.4`),
  P('b', 'a', 'M14.2 11.5h3.6M14.2 14.3h3.6'),
]

/** Media Manager: image, video, audio and font tiles. */
const media = (): ReactElement[] => [
  ...RING,
  <g key="m" transform="translate(6.08 6.08) scale(.62)">
    {[
      P('a', 'fs', rr(3, 3, 12, 12, 2.5) + 'M5.5 12.6l3-4.2 2 2.6 1.2-1.4 1.8 3Z' + rr(3, 17, 12, 12, 2.5) + rr(5.5, 22, 1.8, 4, .9) + rr(8.6, 20, 1.8, 8, .9) + rr(11.7, 22.8, 1.8, 3.2, .9) + rr(17, 17, 12, 12, 2.5) + 'M19.6 26.6l3.4-8.2 3.4 8.2h-1.8l-.5-1.4h-2.2l-.5 1.4Z', EO),
      P('b', 'fa', rr(17, 3, 12, 12, 2.5) + 'M21.5 6.4v5.2l4.4-2.6Z', EO),
    ]}
  </g>,
]

export const NAV_MEDALLION_ARTWORK: Record<NavMedallionKind, () => ReactElement[]> = { navReact: react, navPerformance: pads, navPreset: presets, navShow: show, navLyrics: lyrics, navMedia: media }

/** `size` is the symbol's scale (px per 32 grid); the svg is 38/32 larger so the wider ring fits. */
export function NavMedallionIcon({ kind, size = 36 }: { kind: NavMedallionKind; size?: number }) {
  const box = size * 38 / 32
  return (
    <svg className="app-icon nav-medallion" data-app-icon={kind} viewBox="-3 -3 38 38" width={box} height={box} aria-hidden="true">
      {NAV_MEDALLION_ARTWORK[kind]()}
    </svg>
  )
}
