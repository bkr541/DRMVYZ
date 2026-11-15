import { useId, type ReactElement } from 'react'
import { engineSwitcherSymbol, NAV_MEDALLION_ARTWORK, NAV_MEDALLION_RING } from '../../navMedallionIcons'

/**
 * Ten drawing systems for the left navigation's icons, each with the same six destinations. Every glyph is original
 * path artwork on the navigation's 32 grid, painted in `currentColor` plus one accent colour (`--llni-accent`, the
 * convention production's navigation already uses), so any system can replace the current icons without new styling.
 * A system is a visual language, not a stroke setting: its shapes, construction and materials differ.
 */
export type NavIconDestination = 'pads' | 'presets' | 'show' | 'lyrics' | 'media' | 'notifications'
export const NAV_ICON_DESTINATIONS: readonly { id: NavIconDestination; label: string }[] = Object.freeze([
  { id: 'pads', label: 'Performance Pads' },
  { id: 'presets', label: 'Presets Manager' },
  { id: 'show', label: 'Show Manager' },
  { id: 'lyrics', label: 'Lyric Manager' },
  { id: 'media', label: 'Media Manager' },
  { id: 'notifications', label: 'Notifications' },
])
export type NavIconSystemId = 'hairline' | 'bold' | 'solid' | 'tinted' | 'technical' | 'plotter' | 'offset' | 'badge' | 'medallion' | 'matrix' | 'fragment' | 'misregister' | 'fade' | 'inlay' | 'geometric' | 'console' | 'neon' | 'spec' | 'stamp' | 'chips'
export const NAV_ICON_SYSTEMS: readonly { id: NavIconSystemId; name: string; detail: string }[] = Object.freeze([
  { id: 'hairline', name: 'Hairline duotone', detail: '1.25 stroke · structure at 55% · one live accent' },
  { id: 'bold', name: 'Bold line', detail: '2.4 stroke · simplified silhouettes · round joins' },
  { id: 'solid', name: 'Solid glyph', detail: 'Filled shapes · cut-out details · accent fill' },
  { id: 'tinted', name: 'Tinted fill', detail: '1.4 outline over a translucent fill · stacked planes' },
  { id: 'technical', name: 'Technical cut', detail: 'Mitred corners · chamfers · square terminals' },
  { id: 'plotter', name: 'Plotter dash', detail: 'Dashed construction outline · solid signal strokes' },
  { id: 'offset', name: 'Offset depth', detail: 'Outline over a shifted solid shadow plane' },
  { id: 'badge', name: 'Badge tile', detail: 'Rounded tile container · knocked-out symbol' },
  { id: 'medallion', name: 'Medallion', detail: 'Ring with a lit arc · small centred symbol' },
  { id: 'matrix', name: 'LED matrix', detail: '9 × 9 pixel cells · lit accent pixels' },
  { id: 'fragment', name: 'Hex fragments', detail: 'Broken hexagon frames · 2.2 mitred strokes · accent segments fill the gaps' },
  { id: 'misregister', name: 'Offset duotone', detail: 'Slate outline · accent strokes shifted off the edge like a misregistered print' },
  { id: 'fade', name: 'Fade trail', detail: 'Strokes that fade along their length · ghost echo · one bright accent' },
  { id: 'inlay', name: 'Dark inlay', detail: 'Light outline · tinted dark interior · accent detail inside' },
  { id: 'geometric', name: 'Flat geometry', detail: 'No strokes · circles, bars and triangles in two flat colours' },
  { id: 'console', name: 'Pad console', detail: 'Production pad tiles · 1px border · colour line · lit hit state · sliders, rig and timeline' },
  { id: 'neon', name: 'Neon tube', detail: 'Single-weight tube strokes · glowing accent · knobs, spot beams, ball mic' },
  { id: 'spec', name: 'Spec sheet', detail: 'Chamfered corners · dashed frame · rail pads, parameter table, document tiles' },
  { id: 'stamp', name: 'Solid stamp', detail: 'Filled shapes with knocked-out detail · vertical faders · condenser mic' },
  { id: 'chips', name: 'Chip tags', detail: 'Pill bodies · toggle switches · clip chips · filmstrip' },
])

/** A rounded rectangle path. */
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`
/** One bell outline, scaled about (16, 16). */
const bell = (k = 1) => {
  const t = (x: number, y: number) => `${(16 + (x - 16) * k).toFixed(2)} ${(16 + (y - 16) * k).toFixed(2)}`
  return `M${t(16, 4.5)}C${t(12.4, 4.5)} ${t(9.6, 7.4)} ${t(9.6, 11)}V${t(9.6, 15.6).split(' ')[1]}C${t(9.6, 18)} ${t(8.8, 19.4)} ${t(7.4, 21)}C${t(6.8, 21.7)} ${t(7.2, 22.8)} ${t(8.2, 22.8)}H${t(23.8, 22.8)}C${t(24.8, 22.8)} ${t(25.2, 21.7)} ${t(24.6, 21)}C${t(23.2, 19.4)} ${t(22.4, 18)} ${t(22.4, 15.6)}V${t(22.4, 11).split(' ')[1]}C${t(22.4, 7.4)} ${t(19.6, 4.5)} ${t(16, 4.5)}Z`
}
const clapper = (k = 1) => `M${(16 - 3 * k).toFixed(2)} ${(16 + 10 * k).toFixed(2)}a${(3 * k).toFixed(2)} ${(3 * k).toFixed(2)} 0 0 0 ${(6 * k).toFixed(2)} 0`

type Cls = 's' | 'a' | 'fs' | 'fa' | 'ts' | 'ta' | 'd' | 'sh'
const P = (key: string, cls: string, d: string, extra: Record<string, unknown> = {}): ReactElement => <path key={key} className={cls} d={d} {...extra} />
const pixels = (rows: readonly string[], mark: string): string => {
  const cell = 2.8, origin = 3.4
  let d = ''
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === mark) d += `M${(origin + x * cell + .25).toFixed(2)} ${(origin + y * cell + .25).toFixed(2)}h2.3v2.3h-2.3Z` }))
  return d
}

type Draw = Record<NavIconDestination, (uid: string) => ReactElement[]>

/* Every icon below follows the same content brief. Pads follow production's pad surface (dark tile, 1px border, a colour line under
   the label, a lit hit state); Presets show configuration (faders, knobs, toggles, curves); Show combines DJ lighting with a timeline;
   Lyrics combine a mic with lyric lines and a note; Media shows several media types (image, video, audio, font). A system is its
   construction (stroke, fill, tile, dash, pixel), not a re-skin, so no two rows draw a destination the same way. */
const cell = (n: number, size: number, gap: number, origin: number) => Array.from({ length: n }, (_, i) => origin + i * (size + gap))
const sq = (xs: number[], ys: number[], w: number, h: number, r: number, skip: (x: number, y: number) => boolean = () => false) =>
  ys.flatMap(y => xs.filter(x => !skip(x, y)).map(x => rr(x, y, w, h, r))).join('')
/** Media glyphs on a 12 × 12 tile whose top-left is (x, y): image, video, audio and font. */
const mediaGlyph = (kind: 'image' | 'video' | 'audio' | 'font', x: number, y: number) => {
  const m = (px: number, py: number) => `${(x + px).toFixed(1)} ${(y + py).toFixed(1)}`
  if (kind === 'image') return `M${m(2.6, 9.4)}l2.6-3.2 2 2.2 1.4-1.4 1.8 2.4`
  if (kind === 'audio') return `M${m(3.2, 7.6)}v2M${m(5.4, 5.6)}v6M${m(7.6, 6.8)}v3.6M${m(9.8, 4.6)}v6.4`
  if (kind === 'font') return `M${m(2.8, 10.2)}l3.2-7.2 3.2 7.2M${m(4.1, 7.8)}h3.8`
  return `M${m(4.6, 3.8)}v4.8l4.2-2.4Z`
}
const ch = (x: number, y: number, w: number, h: number, c: number) => `M${x + c} ${y}H${x + w}V${y + h - c}L${x + w - c} ${y + h}H${x}V${y + c}Z`
const EO = { fillRule: 'evenodd' } as const
const PADX = [2, 12, 22]
const PAD_FRAME = 'M1.5 1.5h29v29h-29Z'
/** A music note: stem up from a head at (x, y). */
const noteStem = (x: number, y: number, h = 7) => `M${x + 2.2} ${y}V${y - h}l4 1.2`

/** 01 · Hairline duotone: a 1.25 stroke, structure at 55%, one live accent. */
const hairline: Draw = {
  pads: () => [P('a', 's', rr(4, 8, 24, 16, 4)), P('b', 's', 'M11 14h10'), P('c', 'a', 'M10 19.5h12'), P('d', 'a', rr(1.5, 5.5, 29, 21, 6.5), { style: { opacity: .35 } })],
  presets: () => [P('a', 's', `${rr(3, 5, 26, 22, 3)}M9 5v22M16 5v22M23 5v22`), P('b', 'a', 'M5.5 22C10 22 11 10 16 10S22 22 26.5 22'), P('c', 'fa', `${circle(5.5, 22, 1.4)}${circle(16, 10, 1.6)}${circle(26.5, 22, 1.4)}`)],
  show: () => [P('a', 's', 'M5 3v8a6 6 0 0 0 12 0V3'), P('b', 's', rr(8, 8, 6, 8, 2)), P('c', 'a', 'M17 10 29 6M17 14l12 4'), P('d', 's', rr(3, 24, 26, 5, 1.5)), P('e', 'a', 'M19 22v9')],
  lyrics: () => [P('a', 's', `${rr(11, 3, 10, 14, 5)}M7.5 12.5a8.5 8.5 0 0 0 17 0M16 21.5v4M11.5 25.5h9`), P('b', 'a', 'M13.5 8h5M13.5 11.5h5'), P('c', 's', 'M3 7h4M25 7h4'), P('d', 'fa', circle(5.5, 25, 1.8)), P('e', 'a', 'M7.3 25v-5l2.6.8')],
  media: () => [P('a', 's', 'M3 8a2 2 0 0 1 2-2h7l3 3h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'), P('b', 'a', 'M6 22l2.4-3 1.8 1.8 1.2-1.2 1.6 2.4M23 19v3M25 16v9M27 18v5'), P('c', 'fa', 'M15.5 16.5v6l4.8-3Z')],
  notifications: () => [P('a', 's', bell(.88)), P('b', 's', clapper(.88)), P('c', 'a', rr(18, 3, 11, 7, 3.5)), P('d', 'a', 'M21.5 6.5h4')],
}

/** 02 · Bold line: 2.4 stroke, simplified silhouettes. */
const bold: Draw = {
  pads: () => [P('a', 's', `${rr(3, 8, 7.5, 16, 2)}${rr(12.25, 8, 7.5, 16, 2)}${rr(21.5, 8, 7.5, 16, 2)}`), P('b', 'a', 'M5.4 19.5h2.7M14.6 19.5h2.8M23.9 19.5h2.7')],
  presets: () => [P('a', 's', 'M7 4v24M16 4v24M25 4v24'), P('b', 'a', `${rr(4, 9, 6, 5, 1.5)}${rr(13, 17, 6, 5, 1.5)}${rr(22, 11, 6, 5, 1.5)}`)],
  show: () => [P('a', 's', 'M10 3h12l3 8H7ZM4 28h24'), P('b', 'a', 'M10 15 6 21M16 15v7M22 15l4 6M13 25v4')],
  lyrics: () => [P('a', 's', `${rr(5, 3, 8, 13, 4)}M2.5 11a6.5 6.5 0 0 0 13 0M9 18v6`), P('b', 'a', 'M19 6h9M19 11h6'), P('c', 'fa', circle(22, 25, 3)), P('d', 'a', 'M25 25V15l4 1.4')],
  media: () => [P('a', 's', 'M8 8V6a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-2'), P('b', 's', rr(3, 9, 18, 15, 3)), P('c', 'a', 'M10.5 13v6l5-3Z'), P('d', 'a', 'M24 24v3M27 22v7')],
  notifications: () => [P('a', 's', bell(.8)), P('b', 's', clapper(.8)), P('c', 'a', 'M3 10a14 14 0 0 1 3.6-6M29 10a14 14 0 0 0-3.6-6')],
}

/** 03 · Solid glyph: flat silhouettes with accent detail laid over them. */
const solid: Draw = {
  pads: () => [P('a', 'fs', rr(3, 8, 26, 16, 3.5)), P('b', 'fa', rr(9, 18, 14, 2.4, 1.2)), P('c', 'fa', rr(1, 5, 30, 22, 6) + rr(2.6, 6.6, 26.8, 18.8, 4.6), EO)],
  presets: () => [P('a', 'fs', `${rr(5.5, 3, 3, 26, 1.5)}${rr(14.5, 3, 3, 26, 1.5)}${rr(23.5, 3, 3, 26, 1.5)}`), P('b', 'fa', `${rr(3, 9, 8, 5, 1.6)}${rr(21, 15, 8, 5, 1.6)}${rr(12, 21, 8, 5, 1.6)}`)],
  show: () => [P('a', 'fs', 'M9 3h14l-3 6h-8Z'), P('b', 'fa', 'M13 11h6l5 9H8Z'), P('c', 'fs', `${rr(3, 23, 12, 5, 1.5)}${rr(17, 23, 5, 5, 1.5)}${rr(24, 23, 5, 5, 1.5)}`), P('d', 'fa', rr(15, 20, 1.8, 10, .9))],
  lyrics: () => [P('a', 'fs', `${circle(10, 9, 6)}M7.6 14.6 6 28h8l-1.6-13.4Z`), P('b', 'fa', `${rr(5.5, 6.6, 9, 1.3, .65)}${rr(5.5, 9.8, 9, 1.3, .65)}`), P('c', 'fs', `${rr(19, 5, 10, 2.4, 1.2)}${rr(19, 10, 8, 2.4, 1.2)}`), P('d', 'fa', `${circle(21.5, 25, 3)}${rr(23.7, 16.5, 2, 8.5, 1)}M25.7 16.5h3.6l-.8 4h-2.8Z`)],
  media: () => [P('a', 'fs', rr(3, 3, 16, 13, 2.5)), P('b', 'fa', 'M5.6 13.4l3.2-4.2 2.4 2.8 1.6-1.8 2.4 3.2Z'), P('c', 'fa', rr(12, 11, 17, 15, 2.5)), P('d', 'fs', 'M18.6 15.2v6.6l5.4-3.3Z'), P('e', 'fs', `${rr(3.5, 20, 2.4, 7, 1.2)}${rr(7.5, 18.5, 2.4, 10, 1.2)}`)],
  notifications: () => [P('a', 'fs', bell(.84)), P('b', 'fs', 'M13 23.8a3 3 0 0 0 6 0Z'), P('c', 'fa', rr(16, 3, 13, 8, 4)), P('d', 'fs', rr(19.5, 6.1, 6, 1.8, .9))],
}

/** 04 · Tinted fill: stacked translucent planes. */
const tinted: Draw = {
  pads: () => [P('a', 'ts', rr(6, 3, 20, 16, 3.5)), P('b', 'ts', rr(3, 8, 26, 18, 4)), P('c', 's', 'M11 14h10'), P('d', 'a', 'M9 20h14')],
  presets: () => [P('a', 'ts', `${rr(3, 4, 26, 7, 2.5)}${rr(3, 12.5, 26, 7, 2.5)}${rr(3, 21, 26, 7, 2.5)}`), P('b', 'ta', `${circle(10, 7.5, 2.4)}${circle(20, 16, 2.4)}${circle(14, 24.5, 2.4)}`)],
  show: () => [P('a', 'ts', `${rr(4, 6, 24, 6, 1.5)}${rr(4, 14, 14, 6, 1.5)}${rr(12, 22, 16, 6, 1.5)}`), P('b', 'a', 'M22 3.5v25')],
  lyrics: () => [P('a', 'ts', 'M6 3h14l6 6v20H6Z'), P('b', 's', 'M20 3v6h6M10 13h12M10 17h9'), P('c', 'ta', rr(10, 20, 5, 7, 2.5)), P('d', 'a', 'M8.5 24.5a4 4 0 0 0 8 0'), P('e', 'fa', circle(21, 25.5, 1.9)), P('f', 'a', 'M23 25.5V21')],
  media: () => [P('a', 'ts', rr(3, 5, 15, 13, 2.5)), P('b', 'ts', rr(9, 10, 15, 13, 2.5)), P('c', 'ta', rr(14, 15, 15, 13, 2.5)), P('d', 'fa', 'M19.5 19.5v5.5l4.5-2.7Z'), P('e', 'a', 'M4.5 9l2-2.5 2 2M11 16v3M13 14v7')],
  notifications: () => [P('a', 'ts', bell()), P('b', 's', clapper()), P('c', 'ta', circle(24, 8, 3.6)), P('d', 'a', 'M24 6.4v2.2M24 10v.1')],
}

/** 05 · Technical cut: mitred corners, chamfers, square terminals. */
const technical: Draw = {
  pads: () => [P('a', 's', ch(3, 6, 26, 20, 4)), P('b', 's', 'M11 13h10'), P('c', 'a', 'M9 19h14'), P('d', 'a', 'M2 3.5h5M2 3.5v4M30 28.5h-5M30 28.5v-4')],
  presets: () => [P('a', 's', 'M6.5 21a10.5 10.5 0 1 1 19 0M16 4.5v2M7 9.5l1.4 1.4M25 9.5l-1.4 1.4'), P('b', 'a', 'M16 17l5.5-6.5'), P('c', 's', 'M4 28h24'), P('d', 'a', 'M18 25.5v5')],
  show: () => [P('a', 's', 'M3 4h26M3 8h26M3 4l3.5 4L10 4l3.5 4L17 4l3.5 4L24 4l3.5 4'), P('b', 's', 'M5 10h6l-1.2 4H6.2ZM21 10h6l-1.2 4h-3.6Z'), P('c', 'a', 'M8 16v6M24 16v6'), P('d', 's', 'M3 27h26M3 25v4M29 25v4'), P('e', 'a', 'M16 21v10')],
  lyrics: () => [P('a', 's', 'M12 3h8l2 2v8l-2 2h-8l-2-2V5ZM6 11v2l4 4h12l4-4v-2M16 17v6M11 23h10'), P('b', 'a', 'M12 7h8M12 10.5h8'), P('c', 'fa', 'M23 28l2-2 2 2-2 2Z'), P('d', 'a', 'M27 28V21l3 .8')],
  media: () => [P('a', 's', `${ch(3, 4, 26, 7, 2)}${ch(3, 12.5, 26, 7, 2)}${ch(3, 21, 26, 7, 2)}`), P('b', 'a', 'M6 9.5 8 6.5l2 3M11.5 24.5v-2h2M17 8h9M17 16.5h9'), P('c', 'fa', 'M6 14.2v3.6l3.2-1.8Z'), P('d', 'a', 'M6.5 26v-2M8.5 26.5v-4M10.5 26v-3M17 24.5h9')],
  notifications: () => [P('a', 's', 'M9 22v-8l3-7h8l3 7v8ZM6 22h20M13 26h6M16 3.5v3'), P('b', 'a', 'M23 4h5v5'), P('c', 'fa', 'M25.2 6.2h.1')],
}

/** 06 · Plotter dash: dashed construction lines with solid signal strokes. */
const plotter: Draw = {
  pads: () => [P('a', 'd', rr(3, 7, 26, 18, 4)), P('b', 's', 'M11 13h10'), P('c', 'a', 'M9 19h14')],
  presets: () => [P('a', 'd', 'M4 9h24M4 16h24M4 23h24'), P('b', 'a', 'M4 9h8M4 16h17M4 23h11'), P('c', 's', `${circle(14.6, 9, 2.6)}${circle(23.6, 16, 2.6)}${circle(17.6, 23, 2.6)}`)],
  show: () => [P('a', 'd', circle(16, 7, 4)), P('b', 'd', 'M13 10 5 20M19 10l8 10'), P('c', 'a', 'M3 26h26'), P('d', 's', 'M8 24v4M16 24v4M24 24v4'), P('e', 'fa', 'M16 15.4l1.8 1.8-1.8 1.8-1.8-1.8Z')],
  lyrics: () => [P('a', 'd', rr(5, 3, 7, 12, 3.5)), P('b', 's', 'M3.5 12a5 5 0 0 0 10 0M8.5 17v4'), P('c', 'd', 'M17 8h12M17 13h9'), P('d', 'a', 'M23 26v-7.5l5 1.5'), P('e', 'fa', circle(21, 26, 2))],
  media: () => [P('a', 'd', circle(10, 10, 7)), P('b', 's', circle(10, 10, 1.8)), P('c', 'd', rr(15, 15, 14, 12, 2.5)), P('d', 'a', 'M17.5 24l3-4 2.5 3 2-2 2.5 3'), P('e', 'fa', 'M18 3.5v8l7-4Z')],
  notifications: () => [P('a', 's', bell(.8)), P('b', 'a', clapper(.8)), P('c', 'd', circle(16, 16, 13.5))],
}

/** 07 · Offset depth: the outline over the same shape shifted onto a solid plane. */
const offsetShapes: Record<NavIconDestination, { plane: string; line: string; mark: string }> = {
  pads: { plane: `${rr(3, 3, 20, 9, 3)}${rr(3, 15, 20, 9, 3)}`, line: `${rr(3, 3, 20, 9, 3)}${rr(3, 15, 20, 9, 3)}`, mark: 'M8 8h10M8 20h10' },
  presets: { plane: `${circle(10, 10, 6.5)}${rr(3, 20, 21, 5, 2.5)}`, line: `${circle(10, 10, 6.5)}${rr(3, 20, 21, 5, 2.5)}`, mark: 'M10 10l3.4-3.4M7 22.5h6M17 22.5h.1' },
  show: { plane: `${rr(7, 3, 10, 6, 1.5)}${rr(3, 20, 21, 4, 1.5)}`, line: `${rr(7, 3, 10, 6, 1.5)}${rr(3, 20, 21, 4, 1.5)}`, mark: 'M9 11 4 17M12 11v6M15 11l5 6M14 18v8' },
  lyrics: { plane: `${rr(5, 3, 8, 12, 4)}${circle(19.5, 21, 2.6)}`, line: `${rr(5, 3, 8, 12, 4)}M3 11a6 6 0 0 0 12 0M9 17v4`, mark: 'M17 6h6M17 10h4M22 21v-6l3 1' },
  media: { plane: `${rr(3, 3, 14, 12, 2.5)}${rr(9, 11, 14, 12, 2.5)}`, line: `${rr(3, 3, 14, 12, 2.5)}${rr(9, 11, 14, 12, 2.5)}`, mark: 'M5.5 12l3-3.5 2 2.2M13.5 15v5l4-2.5Z' },
  notifications: { plane: `${bell(.78)}${rr(15, 3, 8, 5, 2.5)}`, line: `${bell(.78)}${rr(15, 3, 8, 5, 2.5)}`, mark: `${clapper(.78)}M17.5 5.5h3` },
}
const offset: Draw = Object.fromEntries((Object.keys(offsetShapes) as NavIconDestination[]).map(kind => [kind, () => {
  const { plane, line, mark } = offsetShapes[kind]
  return [
    <g key="sh" className="sh" transform="translate(5 5)"><path className="fs" d={plane} /></g>,
    <g key="top"><path className="s" d={line} /><path className="a" d={mark} /></g>,
  ]
}])) as unknown as Draw

/** 08 · Badge tile: a rounded tile holds a knocked symbol. */
const TILE = rr(3, 3, 26, 26, 6)
const badge: Draw = {
  pads: () => [P('t', 'ts', TILE), P('a', 's', rr(8, 10, 16, 12, 3)), P('b', 's', 'M12 14h8'), P('c', 'a', 'M11.5 18.5h9')],
  presets: () => [P('t', 'ts', TILE), P('a', 's', 'M12 8v16M20 8v16'), P('b', 'fa', `${rr(9.5, 11, 5, 3, 1)}${rr(17.5, 17, 5, 3, 1)}`)],
  show: () => [P('t', 'ts', TILE), P('a', 's', 'M12 8h8l1.5 4h-11ZM9 23h14'), P('b', 'a', 'M12 15l-2 4M16 15v4M20 15l2 4')],
  lyrics: () => [P('t', 'ts', TILE), P('a', 'fs', rr(10.5, 8, 5, 8, 2.5)), P('b', 's', 'M9 14a4 4 0 0 0 8 0M13 18v3'), P('c', 'a', 'M20 11h4M20 15h3'), P('d', 'fa', circle(21.5, 22, 1.6)), P('e', 'a', 'M23.1 22v-3.6')],
  media: () => [P('t', 'ts', TILE), P('a', 's', `${mediaGlyph('image', 7.5, 7)}${mediaGlyph('font', 16.5, 16)}`), P('b', 'a', mediaGlyph('audio', 7.5, 16)), P('c', 'fa', mediaGlyph('video', 16.5, 7))],
  notifications: () => [P('t', 'ts', TILE), P('a', 's', `${bell(.5)}${clapper(.5)}`), P('b', 'a', 'M8 12a8 8 0 0 1 2-3.4M24 12a8 8 0 0 0-2-3.4'), P('c', 'fa', circle(22, 9.5, 2.2))],
}

/** Solid stamp's media artwork (also reused, scaled, inside the medallion ring). */
const STAMP_MEDIA: ReactElement[] = [
  P('a', 'fs', rr(3, 3, 12, 12, 2.5) + 'M5.5 12.6l3-4.2 2 2.6 1.2-1.4 1.8 3Z' + rr(3, 17, 12, 12, 2.5) + rr(5.5, 22, 1.8, 4, .9) + rr(8.6, 20, 1.8, 8, .9) + rr(11.7, 22.8, 1.8, 3.2, .9) + rr(17, 17, 12, 12, 2.5) + 'M19.6 26.6l3.4-8.2 3.4 8.2h-1.8l-.5-1.4h-2.2l-.5 1.4Z', { fillRule: 'evenodd' }),
  P('b', 'fa', rr(17, 3, 12, 12, 2.5) + 'M21.5 6.4v5.2l4.4-2.6Z', { fillRule: 'evenodd' }),
]

/** 09 · Medallion: the production left navigation's artwork (navMedallionIcons.tsx), scaled so its wider ring fits the 32 grid. */
const FIT = 'translate(16 16) scale(.8125) translate(-16 -16)'
const medallion: Draw = Object.fromEntries(Object.entries({ pads: 'navPerformance', presets: 'navPreset', show: 'navShow', lyrics: 'navLyrics', media: 'navMedia' } as const).map(([kind, nav]) => [kind, () => [<g key="m" transform={FIT}>{NAV_MEDALLION_ARTWORK[nav]()}</g>]])) as unknown as Draw
medallion.notifications = () => [<g key="m" transform={FIT}>{[...NAV_MEDALLION_RING, P('a', 's', `${bell(.5)}${clapper(.5)}`), P('b', 'fa', circle(21.4, 10.6, 1.9))]}</g>]

/** 10 · LED matrix: a 9 × 9 grid of lit cells. */
const MATRIX: Record<NavIconDestination, readonly string[]> = {
  pads: ['XX.XX.XX.', 'XX.XX.XX.', '.........', 'XX.AA.XX.', 'XX.AA.XX.', '.........', 'XX.XX.XX.', 'XX.XX.XX.', '.........'],
  presets: ['.X..X..X.', '.X..X.AAA', 'AAA.X..X.', '.X..X..X.', '.X.AAA.X.', '.X..X..X.', '.X..X..X.', '.X..X..X.', '.X..X..X.'],
  show: ['..XXXXX..', '..XXXXX..', '.A..A..A.', 'A...A...A', '.........', 'XXX.XX.XX', 'XXX.XX.XX', '....A....', '....A....'],
  lyrics: ['.XX..XXXX', '.XX......', '.XX..XXX.', 'X.XX.....', '.XX..XX..', '..X....A.', '.XXX...A.', '.......A.', '.....AAA.'],
  media: ['XXXX.A...', 'X..X.AAA.', 'X..X.AAA.', 'XXXX.A...', '.........', '.X.X..XX.', 'XX.X.X..X', 'XX.X.XXXX', 'XXXX.X..X'],
  notifications: ['...XXX.AA', '..X...XAA', '..X...X..', '..X...X..', '.X.....X.', 'XXXXXXXXX', '....X....', '.........', '.........'],
}
const matrix: Draw = Object.fromEntries((Object.keys(MATRIX) as NavIconDestination[]).map(kind => [kind, () => [P('x', 'fs', pixels(MATRIX[kind], 'X')), P('y', 'fa', pixels(MATRIX[kind], 'A'))]])) as unknown as Draw

/** 11 · Hex fragments: a broken hexagon frame holds each symbol; accent segments sit where the frame is open. */
const HEX_GAP_TL = 'M10.8 7 16 4l10.4 6v12L16 28 5.6 22V10'
const HEX_GAP_BR = 'M26.4 22 16 28 5.6 22V10L16 4l10.4 6'
const fragment: Draw = {
  pads: () => [P('h', 's', HEX_GAP_TL), P('g', 'a', 'M6.6 9.4 9.2 7.9'), P('a', 's', 'M10.5 12h11v9h-11Z'), P('b', 's', 'M13.5 15.2h5'), P('c', 'a', 'M12.5 18.4h7')],
  presets: () => [P('h', 's', HEX_GAP_BR), P('g', 'a', 'M26.4 11.5v9'), P('a', 's', circle(16, 16, 4.6)), P('b', 'a', 'M16 16l2.6-2.6'), P('c', 's', 'M16 9.6v1.6')],
  show: () => [P('h', 's', HEX_GAP_TL), P('g', 'a', 'M6.6 9.4 9.2 7.9'), P('a', 's', 'M12 10.5h8l1.5 3h-11Z'), P('b', 'a', 'M12.5 16.5l-2 4M16 16.5v4M19.5 16.5l2 4'), P('c', 's', 'M10.5 23h11')],
  lyrics: () => [P('h', 's', HEX_GAP_BR), P('g', 'a', 'M26.4 11.5v9'), P('a', 's', 'M11.5 10.5h3.5v6h-3.5ZM10 15v1a3.2 3.2 0 0 0 6.4 0v-1M13.2 20v2.5'), P('b', 'a', 'M19 12h3.5M19 15h2.5'), P('c', 'fa', circle(19.5, 21, 1.4)), P('d', 'a', 'M20.9 21v-3.5')],
  media: () => [P('h', 's', HEX_GAP_TL), P('g', 'a', 'M6.6 9.4 9.2 7.9'), P('a', 's', 'M10 10.5h12v8H10Z'), P('b', 'a', 'M12 17l2.5-3 2 2 1.5-1.5 2 2.5'), P('c', 'fa', circle(19.5, 13.2, .9)), P('d', 'a', 'M11 22v1.5M13.5 21v3.5M16 22v1.5')],
  notifications: () => [P('h', 's', HEX_GAP_BR), P('g', 'a', 'M26.4 11.5v9'), P('a', 's', `${bell(.55)}${clapper(.55)}`), P('b', 'a', 'M9 13a8 8 0 0 1 2-3')],
}

/** 12 · Offset duotone: a slate outline with the accent printed slightly off it. */
const misregister: Draw = {
  pads: () => [P('a', 's', rr(5, 7, 22, 17, 4)), P('b', 's', 'M11 13h10'), P('c', 'a', 'M10 20h12'), P('d', 'a', 'M29 14v8a4 4 0 0 1-4 4H11')],
  presets: () => [P('a', 's', 'M5 9h22M5 16h22M5 23h22'), P('b', 'a', `${circle(12, 10, 2.4)}${circle(21, 17, 2.4)}${circle(10, 24, 2.4)}`)],
  show: () => [P('a', 's', 'M11 4h10l2 6H9Z'), P('b', 'a', 'M11 13 7 20M16 13v7M21 13l4 7'), P('c', 's', rr(4, 23, 24, 6, 1.5)), P('d', 'a', 'M20 21v10')],
  lyrics: () => [P('a', 's', `${rr(6, 3, 8, 12, 4)}M3.5 11.5a6.5 6.5 0 0 0 13 0M10 18v4M7 22h6`), P('b', 'a', 'M19 7h9M19 12h6'), P('c', 'a', 'M20 27v-7l5 1.5'), P('d', 'fs', circle(18.2, 27, 1.8))],
  media: () => [P('a', 's', rr(4, 4, 15, 12.5, 2.5)), P('b', 'a', 'M7 14l3-4 2.5 3 1.5-1.5 3 3'), P('c', 's', rr(15, 17, 13, 11, 2.5)), P('d', 'a', 'M19.8 20.5v4.6l4-2.3Z'), P('e', 'a', 'M5 21v4M8 19.5v7M11 21.5v3')],
  notifications: () => [P('a', 's', `${bell(.9)}${clapper(.9)}`), P('b', 'a', rr(19, 3, 9, 6, 3))],
}

/** 13 · Fade trail: strokes taper into the dark and leave a ghost echo; one accent stays bright. */
const FADE = (uid: string) => <defs key="defs"><linearGradient id={`${uid}-fade`} gradientUnits="userSpaceOnUse" x1="4" y1="4" x2="28" y2="28"><stop offset="0" stopColor="currentColor" /><stop offset="1" stopColor="currentColor" stopOpacity=".1" /></linearGradient></defs>
const G = (key: string, d: string, uid: string) => P(key, 'g', d, { style: { stroke: `url(#${uid}-fade)` } })
const fade: Draw = {
  pads: uid => [FADE(uid), G('g', rr(5, 8, 22, 17, 4), uid), P('e', 'echo', rr(8, 5, 22, 17, 4)), P('a', 'a', 'M10 19h12')],
  presets: uid => [FADE(uid), G('g', 'M5 9h22M5 16h22M5 23h22', uid), P('e', 'echo', 'M8 12h22M8 19h22'), P('a', 'a', 'M5 9h8M5 16h15M5 23h6'), P('b', 'fa', `${circle(13.5, 9, 2.2)}${circle(20.5, 16, 2.2)}${circle(11.5, 23, 2.2)}`)],
  show: uid => [FADE(uid), G('g', 'M10 4h12l2 6H8Z', uid), P('e', 'echo', 'M10 7h12l2 6H8Z'), P('a', 'a', 'M10 14 6 21M16 14v7M22 14l4 7'), G('t', 'M3 26h26', uid), P('b', 'a', 'M19 23v7')],
  lyrics: uid => [FADE(uid), G('g', `${rr(5, 3, 7, 12, 3.5)}M3.5 12a5 5 0 0 0 10 0M8.5 17v4`, uid), P('e', 'echo', rr(8, 6, 7, 12, 3.5)), P('a', 'a', 'M17 8h11M17 13h8'), P('b', 'fa', circle(21, 26, 2)), P('c', 'a', 'M23 26v-7l4 1')],
  media: uid => [FADE(uid), G('g', rr(3, 4, 17, 14, 3), uid), P('e', 'echo', rr(6, 7, 17, 14, 3)), P('a', 'a', 'M16 11.5v6l5-3Z'), P('b', 'a', 'M5 25v2M8 23v6M11 24.5v3M14 22v8M19 26h9')],
  notifications: uid => [FADE(uid), G('g', bell(), uid), P('e', 'echo', bell(), { transform: 'translate(-4 2)' }), P('a', 'a', clapper()), P('b', 'a', 'M4 10a14 14 0 0 1 3.6-6M28 10a14 14 0 0 0-3.6-6')],
}

/** 14 · Dark inlay: light outlines around a dark tinted interior with an accent detail inside. */
const inlay: Draw = {
  pads: () => [P('a', 'inl', rr(4, 6, 24, 20, 4)), P('b', 's', 'M11 13h10'), P('c', 'a', 'M9 20h14'), P('d', 'a', 'M10 3.5h12')],
  presets: () => [P('a', 'inl', rr(4, 5, 24, 22, 3.5)), P('b', 'a', `${circle(12, 12, 3.4)}${circle(21, 20, 3.4)}`), P('c', 'a', 'M12 12l2-2M21 20l-2-2')],
  show: () => [P('a', 'inl', rr(4, 16, 24, 12, 3)), P('b', 'a', 'M8 22h6M17 22h8'), P('c', 's', 'M12 3h8l2 5H10Z'), P('d', 'a', 'M12 10.5l-2 3M16 10.5v3M20 10.5l2 3')],
  lyrics: () => [P('a', 'inl', rr(5, 3, 9, 14, 4.5)), P('b', 's', 'M3.5 13a6 6 0 0 0 12 0M9.5 19v4M6 23h7'), P('c', 'inl', rr(18, 5, 11, 13, 2.5)), P('d', 'a', 'M20.5 9.5h6M20.5 13h4'), P('e', 'fa', circle(21, 26, 2)), P('f', 'a', 'M23 26v-6l4 1')],
  media: () => [P('a', 'inl', `${rr(3, 3, 12, 12, 3)}${rr(17, 3, 12, 12, 3)}${rr(3, 17, 12, 12, 3)}${rr(17, 17, 12, 12, 3)}`), P('b', 'a', `${mediaGlyph('image', 3, 3)}${mediaGlyph('audio', 3, 17)}${mediaGlyph('font', 17, 17)}`), P('c', 'fa', mediaGlyph('video', 17, 3))],
  notifications: () => [P('a', 'inl', bell()), P('b', 'a', clapper()), P('c', 'fa', circle(24, 8, 2.8))],
}

/** 15 · Flat geometry: only filled circles, bars and triangles in two flat colours. */
const geometric: Draw = {
  pads: () => [P('a', 'fs', rr(3, 6, 13, 20, 2)), P('b', 'fa', rr(18, 6, 11, 20, 2)), P('c', 'fa', rr(5.5, 19, 8, 2.4, 0)), P('d', 'fs', rr(20, 19, 7, 2.4, 0))],
  presets: () => [P('a', 'fs', `${rr(3, 7, 26, 3, 0)}${rr(3, 15, 26, 3, 0)}${rr(3, 23, 26, 3, 0)}`), P('b', 'fa', `${rr(18, 4, 5, 9, 0)}${rr(8, 12, 5, 9, 0)}${rr(21, 20, 5, 9, 0)}`)],
  show: () => [P('a', 'fs', 'M10 3h12l-3 7h-6Z'), P('b', 'fa', 'M13 11h6l5 10H8Z'), P('c', 'fs', `${rr(3, 24, 10, 5, 0)}${rr(15, 24, 6, 5, 0)}${rr(23, 24, 6, 5, 0)}`)],
  lyrics: () => [P('a', 'fs', `${circle(9, 9, 5)}${rr(8, 14, 2, 8, 0)}${rr(4, 22, 10, 2, 0)}`), P('b', 'fs', `${rr(18, 6, 11, 3, 0)}${rr(18, 12, 8, 3, 0)}`), P('c', 'fa', `${circle(21, 25, 3)}${rr(23, 16, 2, 9, 0)}`)],
  media: () => [P('a', 'fa', circle(9, 9, 6)), P('b', 'fs', 'M17 3l11 6-11 6Z'), P('c', 'fs', rr(3, 19, 12, 10, 0)), P('d', 'fa', 'M17 29l5.5-10 5.5 10h-3l-.8-1.8h-3.4L20 29Z')],
  notifications: () => [P('a', 'fs', 'M16 4l9 18H7Z'), P('b', 'fa', rr(5, 24, 22, 3, 0)), P('c', 'fa', circle(26, 6, 3))],
}

/** 16 · Pad console: the production pad's construction at icon scale. */
const console_: Draw = {
  pads: () => [
    P('t', 'ts', sq(PADX, PADX, 8, 8, 2.2, (x, y) => x === 12 && y === 12)),
    P('l', 'a', PADX.flatMap(y => PADX.filter(x => !(x === 12 && y === 12)).map(x => `M${x + 2} ${y + 5.4}h4`)).join('')),
    P('h', 'a', rr(10.7, 10.7, 10.6, 10.6, 3), { style: { opacity: .4 } }),
    P('c', 'ta', rr(12, 12, 8, 8, 2.2)), P('k', 'a', 'M14 17.4h4', { style: { strokeWidth: 2 } }),
  ],
  presets: () => [P('a', 's', rr(3, 4, 26, 24, 3)), P('b', 's', 'M8 11h16M8 16.5h16M8 22h16'), P('c', 'a', 'M8 11h5.5M8 16.5h11.5M8 22h3.5'), P('d', 'fa', `${circle(13.5, 11, 2.3)}${circle(19.5, 16.5, 2.3)}${circle(11.5, 22, 2.3)}`)],
  show: () => [P('a', 's', 'M3 4h26'), P('b', 's', 'M5 6h6l-1 4H6ZM13 6h6l-1 4h-4ZM21 6h6l-1 4h-4Z'), P('c', 'a', 'M8 12v6M16 12v6M24 12v6'), P('d', 'ts', rr(3, 20, 26, 9, 2)), P('e', 'ta', rr(5, 22, 8, 5, 1) + rr(15, 22, 6, 5, 1)), P('f', 'a', 'M24 18v13')],
  lyrics: () => [P('a', 's', rr(5, 3, 7, 12, 3.5)), P('b', 's', 'M3.5 12a5 5 0 0 0 10 0M8.5 17v4M5.5 21h6'), P('c', 'a', 'M17 8h11M17 13h8'), P('d', 'fa', circle(20, 25.5, 2.4)), P('e', 'a', 'M22.4 25.5V18l5 1.8')],
  media: () => [P('t', 'ts', rr(3, 4, 26, 24, 4)), P('a', 's', 'M14 10.5h11M14 16h11M14 21.5h11'), P('b', 'a', 'M6.5 12.6l2-2.6 1.6 1.7 1.2-1.1 1.5 2M7 22.6v-3M9 24v-6M11 23v-4'), P('c', 'fa', 'M7 14v4.4l3.8-2.2Z')],
  notifications: () => [P('t', 'ts', rr(3, 3, 26, 26, 5)), P('a', 's', `${bell(.55)}${clapper(.55)}`), P('b', 'fa', circle(22, 9.5, 2.3))],
}

/** 17 · Neon tube: one weight of glowing stroke; knobs, beams and a studio mic. */
const neon: Draw = {
  pads: () => [P('t', 's', sq([3, 17], [3, 17], 12, 12, 3.5, (x, y) => x === 17 && y === 17)), P('l', 'a', 'M7 12h4M21 12h4M7 26h4'), P('c', 'ta', rr(17, 17, 12, 12, 3.5)), P('k', 'a', 'M21 26h4')],
  presets: () => [P('a', 's', `${circle(10, 10, 5.6)}${circle(22, 10, 5.6)}`), P('b', 'a', 'M10 10l2.8-2.8M22 10l-2.8 2.8'), P('c', 's', rr(4, 20, 13, 7, 3.5)), P('d', 'fa', circle(13.5, 23.5, 2.1)), P('e', 'a', 'M21 22h7M21 26h4.5')],
  show: () => [P('a', 's', `${circle(9, 6, 3)}${circle(23, 6, 3)}`), P('b', 'a', 'M7.2 8.6 3.6 16M10.8 8.6 14.4 16M21.2 8.6 17.6 16M24.8 8.6 28.4 16'), P('c', 's', 'M3 24h26M3 22v4M29 22v4'), P('d', 'fa', 'M9 21.5l2.5 2.5L9 26.5 6.5 24ZM16 21.5l2.5 2.5-2.5 2.5-2.5-2.5ZM23 21.5l2.5 2.5-2.5 2.5-2.5-2.5Z')],
  lyrics: () => [P('a', 's', `${rr(10, 3, 8, 13, 4)}M7 12a7 7 0 0 0 14 0M14 19v6M10 25h8`), P('b', 'a', 'M11.5 7.5h5M11.5 10.5h5'), P('c', 's', 'M23 6h6M23 11h4'), P('d', 'fa', circle(25, 24, 2)), P('e', 'a', 'M27 24V17l2.4.8')],
  media: () => [P('a', 's', rr(3, 5, 17, 14, 2.5)), P('b', 'a', 'M6 16l3.4-4 2.6 2.8 1.8-2 3.2 3.2'), P('c', 's', rr(12, 14, 17, 14, 2.5)), P('d', 'fa', 'M19.2 18.4v5.2l4.4-2.6Z')],
  notifications: () => [P('a', 's', bell()), P('b', 'a', clapper()), P('c', 'a', 'M4 11a12 12 0 0 1 3.4-6M28 11a12 12 0 0 0-3.4-6'), P('d', 'a', 'M1.5 14.5a15 15 0 0 1 4-8.5M30.5 14.5a15 15 0 0 0-4-8.5')],
}

/** 18 · Spec sheet: chamfered corners and a dashed construction frame. */
const spec: Draw = {
  pads: () => [P('f', 'd', PAD_FRAME), P('t', 's', ch(4, 7, 24, 18, 4)), P('l', 's', 'M11 13h10'), P('c', 'a', 'M9 19h14'), P('n', 'a', 'M22 10h3')],
  presets: () => [P('f', 'd', PAD_FRAME), P('a', 's', 'M7 16.5a9 9 0 1 1 18 0'), P('b', 'a', 'M16 16.5l5-6'), P('c', 's', 'M5 22h22'), P('d', 's', 'M5 26.5h10'), P('e', 'a', 'M18 26.5h9')],
  show: () => [P('f', 'd', PAD_FRAME), P('a', 's', 'M4 5h24M4 8.5h24M4 5l3.5 3.5L11 5l3.5 3.5L18 5l3.5 3.5L25 5l3 3.5'), P('b', 's', 'M6 11h6l-1 4H7ZM20 11h6l-1 4h-4Z'), P('c', 'a', 'M9 17v5M23 17v5'), P('d', 's', 'M4 27h24'), P('e', 'a', 'M15 22v8')],
  lyrics: () => [P('f', 'd', PAD_FRAME), P('a', 's', 'M5 4h6l1.5 1.5v6L11 13H5l-1.5-1.5v-6ZM2.5 14v1l3 3h7l3-3v-1M8 18v5M4.5 23h7'), P('b', 's', 'M18 6h10M18 10h10M18 14h10'), P('c', 'fa', 'M19.5 27l2-2 2 2-2 2Z'), P('d', 'a', 'M23.5 27V19l4.5-1.5')],
  media: () => [P('f', 'd', PAD_FRAME), P('a', 's', `${ch(3.5, 3.5, 25, 10, 2)}M12 3.5v10M20.5 3.5v10${ch(3.5, 17, 25, 11.5, 2)}`), P('b', 'a', 'M5.5 11.5l2-3 2 2.4M22.5 11v-3M24.5 11V6M26.5 11V8.5M6 23h3l1.5-4 3 8 3-10 2.5 8 1.5-2h5'), P('c', 'fa', 'M14.6 6v4.4l3.6-2.2Z')],
  notifications: () => [P('f', 'd', PAD_FRAME), P('a', 's', 'M11 6h10l3 3v9l3 3H5l3-3V9Z'), P('b', 's', 'M13 25h6'), P('c', 'a', 'M23 3h6v6h-6Z')],
}

/** 19 · Solid stamp: filled shapes with the detail knocked out (even-odd). */
const stamp: Draw = {
  pads: () => [
    P('t', 'fs', PADX.flatMap(y => PADX.filter(x => !(x === 12 && y === 12)).map(x => rr(x, y, 8, 8, 2.2) + rr(x + 2, y + 4.8, 4, 1.4, .7))).join(''), EO),
    P('c', 'fa', rr(12, 12, 8, 8, 2.2) + rr(14, 16.8, 4, 1.4, .7), EO),
  ],
  presets: () => [P('a', 'fs', `${circle(10, 10, 6)}M9.2 4.6h1.6V10H9.2Z${circle(22, 10, 6)}M21.2 4.6h1.6V10h-1.6Z`, EO), P('b', 'fs', rr(3, 20, 26, 8, 4)), P('c', 'fa', circle(23.5, 24, 2.8))],
  show: () => [P('a', 'fs', 'M12 3h8v5h-8Z'), P('b', 'fa', 'M12.5 9.5h7L26 20H6Z'), P('c', 'fs', rr(3, 23, 26, 6, 1.5) + rr(5.5, 25.2, 8, 1.6, .8) + rr(15.5, 25.2, 5, 1.6, .8) + rr(22.5, 25.2, 4, 1.6, .8), EO)],
  lyrics: () => [P('a', 'fs', rr(5, 2.5, 8, 12.5, 4) + rr(7, 5.6, 4, 1.2, .6) + rr(7, 8.6, 4, 1.2, .6) + rr(7, 11.6, 4, 1.2, .6), EO), P('b', 'fs', 'M3.5 11h2a3.5 3.5 0 0 0 7 0h2a5.5 5.5 0 0 1-11 0ZM8 18.5h2v4H8ZM5 22.5h8v2.4H5Z'), P('c', 'fs', `${rr(17, 6, 11, 2.4, 1.2)}${rr(17, 11, 8, 2.4, 1.2)}${rr(17, 16, 10, 2.4, 1.2)}`), P('d', 'fa', `${circle(21, 26, 2.6)}${rr(22.6, 19, 1.8, 7, .9)}M24.4 19h4l-.6 4h-3.4Z`)],
  media: () => STAMP_MEDIA,
  notifications: () => [P('a', 'fs', `${bell(.9)}${rr(12.8, 4.2, 6.4, 1.6, .8)}M13 24.4a3 3 0 0 0 6 0Z`, EO), P('b', 'fa', `${circle(24, 8, 4.4)}${circle(24, 8, 1.6)}`, EO)],
}

/** Chip tags' rail pads on the given rows; the pad at (17, 12.5) is the lit one. */
const chipPads = (rows: number[]) => [
  P('t', 'ts', sq([3, 17], rows, 12, 7, 2, (x, y) => x === 17 && y === 12.5)),
  P('r', 'a', rows.flatMap(y => [3, 17].map(x => `M${x + 2.3} ${y + 1.8}v3.4`)).join('')),
  P('l', 's', rows.flatMap(y => [3, 17].map(x => `M${x + 5} ${y + 3.5}h5`)).join('')),
  P('c', 'ta', rr(17, 12.5, 12, 7, 2)),
]

/** 20 · Chip tags: pill bodies, segmented selectors, clip chips and tag chips. */
const chips: Draw = {
  pads: () => chipPads([3, 12.5, 22]),
  presets: () => [P('a', 'ts', `${rr(3, 4, 26, 6.5, 3.25)}${rr(3, 12.8, 26, 6.5, 3.25)}${rr(3, 21.6, 26, 6.5, 3.25)}`), P('b', 'ta', `${rr(3, 4, 10, 6.5, 3.25)}${rr(11, 12.8, 10, 6.5, 3.25)}${rr(19, 21.6, 10, 6.5, 3.25)}`)],
  show: () => [P('a', 's', `${circle(6, 6, 3)}${circle(16, 6, 3)}${circle(26, 6, 3)}`), P('b', 'fa', `${circle(6, 6, 1.1)}${circle(26, 6, 1.1)}`), P('c', 'a', 'M6 11v3M16 11v3M26 11v3'), P('d', 'ts', rr(3, 17.5, 10, 5, 2.5) + rr(24, 17.5, 5, 5, 2.5)), P('e', 'ta', rr(15, 17.5, 7, 5, 2.5)), P('f', 's', rr(3, 25, 26, 3.5, 1.75)), P('g', 'a', 'M19 15v15')],
  lyrics: () => [P('a', 'ts', rr(3, 4, 18, 6, 3)), P('b', 'ta', rr(9, 12, 20, 6, 3)), P('c', 's', 'M6.5 7h9'), P('d', 'a', 'M12.5 15h13'), P('e', 's', rr(4, 21, 5, 7, 2.5)), P('f', 's', 'M2.8 25.3a3.7 3.7 0 0 0 7.4 0'), P('g', 'fa', circle(21, 25.5, 2.2)), P('h', 'a', 'M23.2 25.5V20l3.6 1')],
  media: () => [P('a', 'ts', `${rr(3, 4, 13, 7, 3.5)}${rr(18, 4, 11, 7, 3.5)}${rr(3, 13, 9, 7, 3.5)}${rr(14, 13, 15, 7, 3.5)}${rr(3, 22, 16, 7, 3.5)}`), P('b', 'ta', rr(21, 22, 8, 7, 3.5)), P('c', 'fa', 'M7 6.2v3.2l2.6-1.6Z'), P('d', 'a', 'M20.5 9l1.8-2.2 1.2 1.3 1-1 2 1.9M5.6 16.5v2M7.4 15.5v4M9.2 16.2v2.6M17 18.5l1.8-4 1.8 4M17.8 17h2'), P('e', 'fa', circle(7, 26, 1.4)), P('f', 'a', 'M8.4 26v-3.4l2.4.6')],
  notifications: () => [P('a', 's', `${bell(.7)}${clapper(.7)}`, { transform: 'translate(-6 3)' }), P('b', 'ts', rr(17, 5, 12, 5, 2.5)), P('c', 'ta', rr(17, 12, 12, 5, 2.5)), P('d', 'ts', rr(17, 19, 12, 5, 2.5)), P('e', 'fa', circle(20.5, 14.5, 1))],
}

/** Five options for the Performance Pads symbol inside the production Medallion ring (drawn on the 32 grid, ring radius 16). */
export const NAV_PAD_OPTIONS: readonly { id: string; name: string; detail: string; art: () => ReactElement[] }[] = Object.freeze([
  { id: 'padopt-1', name: 'Single pad', detail: 'One production pad: tile, label bar, colour line', art: () => [P('t', 'ts', rr(9.5, 10, 13, 12, 3)), P('l', 's', 'M13 14.5h6'), P('c', 'a', 'M12 19h8')] },
  { id: 'padopt-2', name: 'Quad pads', detail: 'Four small pads with colour lines · lower right lit', art: () => [P('t', 'ts', `${rr(9, 9, 6.5, 6.5, 1.8)}${rr(16.5, 9, 6.5, 6.5, 1.8)}${rr(9, 16.5, 6.5, 6.5, 1.8)}`), P('l', 'a', 'M10.6 13.4h3.3M18.1 13.4h3.3M10.6 20.9h3.3'), P('c', 'ta', rr(16.5, 16.5, 6.5, 6.5, 1.8)), P('k', 'a', 'M18.1 20.9h3.3')] },
  { id: 'padopt-3', name: 'Nine-pad grid', detail: 'The 3 × 3 pad bank · centre pad lit', art: () => [P('t', 'ts', [8.2, 13.9, 19.6].flatMap(y => [8.2, 13.9, 19.6].filter(x => !(x === 13.9 && y === 13.9)).map(x => rr(x, y, 4.2, 4.2, 1.1))).join('')), P('c', 'ta', rr(13.9, 13.9, 4.2, 4.2, 1.1))] },
  { id: 'padopt-4', name: 'Hit glow', detail: 'A lit pad with the production hit halo spreading out', art: () => [P('h2', 'a', rr(6.5, 7.5, 19, 17, 6.5), { style: { opacity: .22 } }), P('h1', 'a', rr(8.5, 9.5, 15, 13, 4.5), { style: { opacity: .45 } }), P('c', 'ta', rr(11, 12, 10, 8, 2.5)), P('l', 'a', 'M13.5 17h5')] },
  { id: 'padopt-5', name: 'Pad bank', detail: 'Three tall rail pads in a row · middle lit', art: () => [P('t', 'ts', `${rr(7, 9.5, 5, 13, 1.8)}${rr(20, 9.5, 5, 13, 1.8)}`), P('l', 'a', 'M8.6 19.5h1.8M21.6 19.5h1.8'), P('c', 'ta', rr(13.5, 9.5, 5, 13, 1.8)), P('k', 'a', 'M15.1 19.5h1.8')] },
])

/** Five options for the React (home) item's symbol inside the production Medallion ring (32 grid, ring radius 16). */
const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`
export const NAV_REACT_OPTIONS: readonly { id: string; name: string; detail: string; art: () => ReactElement[] }[] = Object.freeze([
  { id: 'reactopt-1', name: 'Pulse line', detail: 'A heartbeat trace: flat lead-in, one live spike', art: () => [P('s', 's', 'M8.5 16h3.5M20 16h3.5'), P('a', 'a', 'M12 16l2.3-6 3.4 12 2.3-6')] },
  { id: 'reactopt-2', name: 'Level bars', detail: 'Five meter bars at different heights · the tallest lit', art: () => [P('b', 'fs', [[7.2, 6], [10.8, 11], [18, 9], [21.6, 5]].map(([x, h]) => rr(x, 16 - h / 2, 2.4, h, 1.2)).join('')), P('c', 'fa', rr(14.4, 8.5, 2.4, 15, 1.2))] },
  { id: 'reactopt-3', name: 'Reactive bolt', detail: 'A lightning bolt: instant response to the music', art: () => [P('a', 'fa', 'M17.6 6.5 10.5 17.2h5l-1.4 8.3 7.4-11.3h-5.2Z')] },
  { id: 'reactopt-4', name: 'Hit ripple', detail: 'A lit centre with two rings spreading, like a kick landing', art: () => [P('o', 's', ellipse(16, 16, 8.6, 8.6), { style: { opacity: .45 } }), P('m', 's', circle(16, 16, 5.2)), P('c', 'fa', circle(16, 16, 2.2))] },
  { id: 'reactopt-5', name: 'Orbit atom', detail: 'Three crossing orbits around a lit core', art: () => [P('e1', 's', ellipse(16, 16, 9, 3.6)), P('e2', 's', ellipse(16, 16, 9, 3.6), { transform: 'rotate(60 16 16)' }), P('e3', 'a', ellipse(16, 16, 9, 3.6), { transform: 'rotate(-60 16 16)' }), P('n', 'fa', circle(16, 16, 1.9))] },
])

/**
 * What React is in the app (docs/react-view-architecture.md): the default live VJ workspace. A centre stage shows the active engine's
 * visual output (Cinema 2.0, Sound Drawing, CANVAS, LaserDMX, PixGrid, HEADLINER) reacting to the shared audio; a lower workspace holds
 * the Track Map and Performance Pads; the audio dock and a visual-output cast control sit beside it. Two option rows follow from that:
 * one draws the live stage itself, the other draws the audio-to-visual reaction.
 */
type ReactOption = { id: string; name: string; detail: string; art: () => ReactElement[] }
const SCREEN = rr(7.5, 9, 17, 12, 2.2)
/** Radial spokes at 45° steps; `keep` picks which of the eight, `outer` is each one's end radius. */
const spokes = (inner: number, outer: number, keep: (k: number) => boolean) => Array.from({ length: 8 }, (_, k) => k).filter(keep).map(k => {
  const a = k * Math.PI / 4, c = Math.cos(a), n = Math.sin(a)
  return `M${(16 + c * inner).toFixed(2)} ${(16 + n * inner).toFixed(2)}L${(16 + c * outer).toFixed(2)} ${(16 + n * outer).toFixed(2)}`
}).join('')
export const NAV_REACT_STAGE_OPTIONS: readonly ReactOption[] = Object.freeze([
  { id: 'reactopt-s1', name: 'Live monitor', detail: 'The centre stage: a monitor showing a live waveform', art: () => [P('m', 's', SCREEN), P('w', 'a', 'M10 15h2l1.5-3.5 2.2 7 1.8-3.5h3'), P('b', 's', 'M16 21v2.5M12.5 24h7')] },
  { id: 'reactopt-s2', name: 'Stage and pads', detail: 'The output stage above the Performance Pads row, middle pad lit', art: () => [P('m', 's', rr(8, 8.5, 16, 9, 2)), P('c', 'fa', circle(16, 13, 2.1)), P('p', 'ts', `${rr(8, 19.5, 4.6, 4, 1)}${rr(19.4, 19.5, 4.6, 4, 1)}`), P('l', 'ta', rr(13.7, 19.5, 4.6, 4, 1))] },
  { id: 'reactopt-s3', name: 'Output cast', detail: 'A monitor with the visual-output cast waves in its corner', art: () => [P('m', 's', SCREEN), P('w', 'a', 'M11 18.5a2.8 2.8 0 0 1 2.8 2.8M11 15.6a5.7 5.7 0 0 1 5.7 5.7'), P('d', 'fa', circle(11, 21, .9))] },
  { id: 'reactopt-s4', name: 'Engine stack', detail: 'Layered stages: the engines you switch between, front one live', art: () => [P('b', 's', rr(11.5, 7.5, 13, 9, 2), { style: { opacity: .45 } }), P('m', 's', rr(9.5, 11, 13, 9, 2), { style: { opacity: .75 } }), P('f', 'ta', rr(7.5, 14.5, 13, 9, 2)), P('d', 'fa', circle(14, 19, 1.7))] },
  { id: 'reactopt-s5', name: 'Stage and dock', detail: 'The output stage over the audio dock waveform', art: () => [P('m', 's', rr(8, 8, 16, 10, 2)), P('c', 'a', circle(16, 13, 2.8)), P('w', 'a', 'M10 22.4v1.2M12.5 21.4v3.2M15 22v2M17.5 20.6v4.8M20 21.8v2.4M22.5 22.4v1.2')] },
])
export const NAV_REACT_AUDIO_OPTIONS: readonly ReactOption[] = Object.freeze([
  { id: 'reactopt-a1', name: 'Wave to shape', detail: 'A waveform on the left turns into a solid shape on the right', art: () => [P('w', 's', 'M7.5 16h1.4l1.6-3.6 2.2 7.2 1.5-3.6'), P('d', 'a', 'M20.5 10.5l4.5 5.5-4.5 5.5-4.5-5.5Z')] },
  { id: 'reactopt-a2', name: 'Beat burst', detail: 'A lit core with spokes thrown out, like a kick', art: () => [P('c', 'fa', circle(16, 16, 2.4)), P('d', 's', spokes(4.6, 6.8, k => k % 2 === 1)), P('o', 'a', spokes(4.6, 8.4, k => k % 2 === 0))] },
  { id: 'reactopt-a3', name: 'Spectrum frame', detail: 'A screen whose floor is a live spectrum', art: () => [P('m', 's', rr(8, 8, 16, 14, 2.5)), P('b', 'fs', [[10.2, 3], [12.8, 6], [18, 5], [20.6, 3.5]].map(([x, h]) => rr(x, 20 - h, 1.6, h, .8)).join('')), P('t', 'fa', rr(15.4, 12, 1.6, 8, .8))] },
  { id: 'reactopt-a4', name: 'Scope dial', detail: 'A round scope carrying the live waveform', art: () => [P('o', 's', circle(16, 16, 7.6)), P('w', 'a', 'M9.6 16h1.6l1.6-3 2.2 6 2.2-6 1.6 3h1.6')] },
  { id: 'reactopt-a5', name: 'Live indicator', detail: 'A screen with a live dot and its title bar', art: () => [P('m', 's', rr(8, 9, 16, 13, 2.5)), P('d', 'fa', circle(12.5, 13.5, 1.8)), P('l', 'a', 'M16 13.5h5'), P('w', 's', 'M10.5 18.5h11')] },
])

/**
 * React's main engine functionality (reactEngineCatalog.ts): one stable shell hosts Cinema 2.0 (composition-native visuals), Sound Drawing and
 * Sound Drawing XY (audio waveform / phosphor-beam drawing), CANVAS (uploaded media layers), LaserDMX (DMX beam matrix), PixGrid (LED-cell
 * artwork) and HEADLINER (camera effects), and switches between them. One row draws five of the engines themselves; the other draws the
 * engine system: the hub of seven, the switcher, the selector, the one-in-many split and the rack.
 */
const pixelCell = (col: number, row: number) => rr(7.7 + col * 4.4, 7.7 + row * 4.4, 3.4, 3.4, .8)
const ring7 = (radius: number) => Array.from({ length: 7 }, (_, k) => {
  const a = -Math.PI / 2 + k * 2 * Math.PI / 7
  return { x: 16 + Math.cos(a) * radius, y: 16 + Math.sin(a) * radius }
})
export const NAV_REACT_ENGINE_OPTIONS: readonly ReactOption[] = Object.freeze([
  { id: 'reactopt-e1', name: 'Cinema 2.0', detail: 'Composition-native visuals: a clapperboard over its frame', art: () => [P('b', 's', rr(8, 13, 16, 10, 2)), P('c', 'a', 'M8 10.6l16-3.2M12.2 9.8l-1.6 3.4M16.6 8.9 15 12.3M21 8l-1.6 3.4'), P('p', 'fa', 'M14.2 16.2v4l3.4-2Z')] },
  { id: 'reactopt-e2', name: 'Sound Drawing', detail: 'The oscilloscope: a screen, its graticule and the live trace', art: () => [P('m', 's', rr(7.5, 9, 17, 14, 3)), P('g', 's', 'M16 9.5v13M8 16h16', { style: { opacity: .3 } }), P('w', 'a', 'M9.5 16h2l1.5-4.5 2.5 9 2-4.5h3')] },
  { id: 'reactopt-e3', name: 'CANVAS', detail: 'Uploaded media in layers: a photo card over the stack', art: () => [P('b', 's', rr(10.5, 8, 13.5, 10, 2), { style: { opacity: .5 } }), P('f', 'ts', rr(8, 12, 13.5, 11, 2)), P('m', 'a', 'M10 20.5l3-4 2.2 2.6 1.8-2 2.4 3.4'), P('s', 'fa', circle(18, 15.6, 1.1))] },
  { id: 'reactopt-e4', name: 'LaserDMX', detail: 'A beam matrix: one source fanning five beams through the haze', art: () => [P('h', 's', 'M8.6 9.8Q16 6.4 23.4 9.8', { style: { opacity: .5 } }), P('b', 'a', 'M16 22L9 11.2M16 22 12.3 9.2M16 22V8.4M16 22l3.7-12.8M16 22l7-10.8'), P('d', 'fa', circle(16, 22.2, 1.7))] },
  { id: 'reactopt-e5', name: 'PixGrid', detail: 'LED-cell artwork: a four-by-four grid with a lit core', art: () => [P('o', 'ts', [0, 1, 2, 3].flatMap(r => [0, 1, 2, 3].filter(c => !(c >= 1 && c <= 2 && r >= 1 && r <= 2)).map(c => pixelCell(c, r))).join('')), P('c', 'fa', [[1, 1], [2, 1], [1, 2], [2, 2]].map(([c, r]) => pixelCell(c, r)).join(''))] },
])
export const NAV_REACT_SYSTEM_OPTIONS: readonly ReactOption[] = Object.freeze([
  { id: 'reactopt-y1', name: 'Engine hub', detail: 'One shell with seven engines around it', art: () => [P('l', 's', ring7(7.2).map(p => `M16 16L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(''), { style: { opacity: .45 } }), P('n', 'fs', ring7(7.2).map(p => circle(Number(p.x.toFixed(2)), Number(p.y.toFixed(2)), 1.6)).join('')), P('c', 'fa', circle(16, 16, 2.7))] },
  { id: 'reactopt-y2', name: 'Engine switcher', detail: 'Cards of engines: the live one in front, the others at the sides', art: engineSwitcherSymbol },
  { id: 'reactopt-y3', name: 'Engine selector', detail: 'The engine dropdown: the current engine and the list below it', art: () => [P('t', 's', rr(8, 8.5, 16, 6.5, 2)), P('w', 'a', 'M10.2 11.8h1.2l.8-1.8 1.2 3.6.8-1.8h.8'), P('v', 'a', 'M19.6 10.8l1.6 1.8 1.6-1.8'), P('o', 's', 'M8.5 18.6h15M8.5 22.2h10')] },
  { id: 'reactopt-y4', name: 'One in, many looks', detail: 'The audio goes in; the engines each turn it into a look', art: () => [P('i', 's', 'M7 17h3.6'), P('p', 'a', 'M11.6 11.4l5.4 10.2H6.2Z'), P('o', 's', 'M16.2 15.6l7.6-3.4M16.6 17.6h7.4M16.2 19.6l7.6 3.4')] },
  { id: 'reactopt-y5', name: 'Engine rack', detail: 'Engines racked as modules, the middle one running', art: () => [P('r', 's', `${rr(8, 8.5, 16, 4.6, 1.5)}${rr(8, 19.9, 16, 4.6, 1.5)}`), P('m', 'ta', rr(8, 14.2, 16, 4.6, 1.5)), P('d', 'fa', `${circle(11, 10.8, .9)}${circle(11, 16.5, .9)}${circle(11, 22.2, .9)}`), P('l', 'a', 'M14 10.8h7M14 16.5h7M14 22.2h7')] },
])

const SYSTEMS: Record<NavIconSystemId, Draw> = { hairline, bold, solid, tinted, technical, plotter, offset, badge, medallion, matrix, fragment, misregister, fade, inlay, geometric, console: console_, neon, spec, stamp, chips }

/** The artwork for one destination in one system, as the children of a 32 × 32 svg. */
export function NavIconArtwork({ system, kind }: { system: NavIconSystemId; kind: NavIconDestination }) {
  const uid = useId().replace(/:/g, '')
  return <>{SYSTEMS[system][kind](uid)}</>
}

export type { Cls as NavIconPartClass }
