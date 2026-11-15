import { useId, type ReactElement } from 'react'

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
export type NavIconSystemId = 'hairline' | 'bold' | 'solid' | 'tinted' | 'technical' | 'plotter' | 'offset' | 'badge' | 'medallion' | 'matrix' | 'fragment' | 'misregister' | 'fade' | 'inlay' | 'geometric'
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

/** 01 · Hairline duotone. */
const hairline: Draw = {
  pads: () => [P('a', 's', `${rr(4, 4, 10, 10, 2.5)}${rr(18, 4, 10, 10, 2.5)}${rr(4, 18, 10, 10, 2.5)}`), P('b', 'a', rr(18, 18, 10, 10, 2.5)), P('c', 'fa', circle(23, 23, 1.5))],
  presets: () => [P('a', 's', 'M5 9h22M5 16h22M5 23h22'), P('b', 'a', `${circle(11, 9, 2.6)}${circle(21, 16, 2.6)}${circle(14, 23, 2.6)}`)],
  show: () => [P('a', 's', `${rr(4, 5, 24, 22, 2.5)}M8 12h9M8 17h13M8 22h7`), P('b', 'a', 'M23 8v16M21 8h4')],
  lyrics: () => [P('a', 's', 'M5 8h22M5 14h14M5 20h18M5 26h8'), P('b', 'a', 'M25 15v9')],
  media: () => [P('a', 's', rr(4, 6, 24, 20, 3)), P('b', 'a', 'M13.5 11.5 21 16l-7.5 4.5Z')],
  notifications: () => [P('a', 's', `${bell()}${clapper()}`), P('b', 'fa', circle(24, 8, 2.6))],
}

/** 02 · Bold line. */
const bold: Draw = {
  pads: () => [P('a', 's', 'M5 5h8v8H5ZM19 5h8v8h-8ZM5 19h8v8H5Z'), P('b', 'a', 'M19 19h8v8h-8Z')],
  presets: () => [P('a', 's', 'M8 5h16v22l-8-6-8 6Z'), P('b', 'a', 'M12.5 11h7')],
  show: () => [P('a', 's', 'M9 5h14l-3.5 8h-7ZM16 13v14M10.5 27h11'), P('b', 'a', 'M5 18l3-2M27 18l-3-2')],
  lyrics: () => [P('a', 's', 'M5 6h22v15H15l-5 5v-5H5Z'), P('b', 'a', 'M10 12h12M10 16h7')],
  media: () => [P('a', 's', 'M5 7h22v18H5Z'), P('b', 'a', 'M13 11l8 5-8 5Z')],
  notifications: () => [P('a', 's', 'M8 22h16c-2-2-2.5-4-2.5-8a5.5 5.5 0 0 0-11 0c0 4-.5 6-2.5 8ZM13.5 26.5h5'), P('b', 'fa', circle(24, 7, 2.8))],
}

/** 03 · Solid glyph. */
const solid: Draw = {
  pads: () => [P('a', 'fs', `${rr(4, 4, 10, 10, 2)}${rr(18, 4, 10, 10, 2)}${rr(4, 18, 10, 10, 2)}`), P('b', 'fa', rr(18, 18, 10, 10, 2))],
  presets: () => [P('a', 'fs', `${rr(4, 7, 24, 2.4, 1.2)}${rr(4, 15, 24, 2.4, 1.2)}${rr(4, 23, 24, 2.4, 1.2)}`), P('b', 'fa', `${circle(10, 8.2, 3.8)}${circle(21, 16.2, 3.8)}${circle(13, 24.2, 3.8)}`)],
  show: () => [P('a', 'fs', `${rr(4, 6, 10, 5, 1.5)}${rr(4, 13.5, 16, 5, 1.5)}${rr(4, 21, 12, 5, 1.5)}`), P('b', 'fa', rr(23, 4, 3.2, 24, 1.6))],
  lyrics: () => [P('a', 'fs', `${rr(4, 6, 24, 3.2, 1.6)}${rr(4, 12.5, 16, 3.2, 1.6)}${rr(4, 19, 20, 3.2, 1.6)}`), P('b', 'fa', rr(24, 12, 2.8, 12, 1.4))],
  media: () => [P('a', 'fs', `${rr(3, 6, 26, 20, 3)}M13 11.5v9l8-4.5Z`, { fillRule: 'evenodd' }), P('b', 'fa', circle(8.6, 10.6, 1.7))],
  notifications: () => [P('a', 'fs', `${bell()}M12.6 24.6a3.4 3.4 0 0 0 6.8 0Z`), P('b', 'fa', circle(24, 8, 3.8))],
}

/** 04 · Tinted fill. */
const tinted: Draw = {
  pads: () => [P('a', 'ts', [4, 13, 22].flatMap(y => [4, 13, 22].filter(x => !(x === 13 && y === 13)).map(x => rr(x, y, 6, 6, 1.5))).join('')), P('b', 'ta', rr(13, 13, 6, 6, 1.5))],
  presets: () => [P('a', 'ts', 'M4 16l12 6 12-6M4 22l12 6 12-6', { style: { fill: 'none' } }), P('b', 'ta', 'M16 4l12 6-12 6-12-6Z')],
  show: () => [P('a', 'ts', `${rr(4, 6, 24, 6, 1.5)}${rr(4, 14, 14, 6, 1.5)}${rr(12, 22, 16, 6, 1.5)}`), P('b', 'a', 'M22 3.5v25')],
  lyrics: () => [P('a', 'ts', 'M7 4h13l5 5v19H7Z'), P('b', 's', 'M20 4v5h5M11 14h10M11 18h10'), P('c', 'a', 'M11 22.5h6', { strokeWidth: 2.2 })],
  media: () => [P('a', 'ts', rr(4, 12, 17, 13, 2)), P('b', 'ta', rr(10, 6, 18, 14, 2)), P('c', 'fa', 'M16.5 10.5v6l5-3Z')],
  notifications: () => [P('a', 'ts', `${bell()}`), P('b', 's', clapper()), P('c', 'ta', circle(24, 8, 3))],
}

/** 05 · Technical cut. */
const technical: Draw = {
  pads: () => [P('a', 's', 'M4 4h10v10H4ZM18 4h10v10H18ZM4 18h10v10H4Z'), P('b', 'a', 'M18 18h7l3 3v7H18Z')],
  presets: () => [P('a', 's', 'M4 8h24M4 16h24M4 24h24'), P('b', 'a', 'M10 5v6M22 13v6M14 21v6')],
  show: () => [P('a', 's', 'M4 5h24v4H4ZM4 23h24v4H4Z'), P('b', 'a', 'M9 9l7 14M23 9l-7 14M16 9v14')],
  lyrics: () => [P('a', 's', 'M4 6h10v8l-3.5 6H7l3-6H4ZM18 6h10v8l-3.5 6H21l3-6h-6Z'), P('b', 'a', 'M4 26h24')],
  media: () => [P('a', 's', 'M4 6h24v20H4ZM4 21l7-6 6 5 4-3 7 6'), P('b', 'a', 'M20 9.5h4v4h-4Z')],
  notifications: () => [P('a', 's', 'M16 4l5 4v7l4 5v2H7v-2l4-5V8ZM13 25h6v2h-6Z'), P('b', 'a', 'M22 3.5h5v5h-5Z')],
}

/** 06 · Plotter dash. */
const plotter: Draw = {
  pads: () => [P('a', 'd', `${circle(9, 9, 5)}${circle(23, 9, 5)}${circle(9, 23, 5)}`), P('b', 'a', circle(23, 23, 5))],
  presets: () => [P('a', 'd', `${circle(10, 16, 6.5)}${circle(23, 16, 4.5)}`), P('b', 'a', 'M10 16l3.4-3.4M23 16v-3.2')],
  show: () => [P('a', 'd', rr(3, 5, 26, 22, 3)), P('b', 's', 'M7 12h10M7 17h14M7 22h8'), P('c', 'a', 'M24 8v18')],
  lyrics: () => [P('a', 'd', 'M5 8h22M5 14h22M5 20h22'), P('b', 'a', 'M5 26h12')],
  media: () => [P('a', 'd', rr(4, 6, 24, 20, 3)), P('b', 'a', 'M13 11l8 5-8 5Z')],
  notifications: () => [P('a', 'd', `${bell(.9)}`), P('b', 'a', clapper(.9)), P('c', 'a', 'M4 12a12 12 0 0 1 3.2-6.2M28 12a12 12 0 0 0-3.2-6.2')],
}

/** 07 · Offset depth: an outline drawn over the same shape shifted onto a solid plane. */
const offsetShapes: Record<NavIconDestination, { plane: string; line: string; mark: string }> = {
  pads: { plane: `${rr(3, 3, 10, 10, 2)}${rr(16, 3, 10, 10, 2)}${rr(3, 16, 10, 10, 2)}${rr(16, 16, 10, 10, 2)}`, line: `${rr(3, 3, 10, 10, 2)}${rr(16, 3, 10, 10, 2)}${rr(3, 16, 10, 10, 2)}`, mark: rr(16, 16, 10, 10, 2) },
  presets: { plane: rr(3, 4, 20, 8, 2.5) + rr(3, 15, 20, 8, 2.5), line: `${rr(3, 4, 20, 8, 2.5)}${rr(3, 15, 20, 8, 2.5)}`, mark: 'M8 8h8M8 19h5' },
  show: { plane: rr(3, 4, 21, 18, 2.5), line: `${rr(3, 4, 21, 18, 2.5)}M7 10h7M7 14h10`, mark: 'M19 8v10' },
  lyrics: { plane: 'M3 4h21v14H13l-5 5v-5H3Z', line: 'M3 4h21v14H13l-5 5v-5H3Z', mark: 'M8 9h11M8 13h6' },
  media: { plane: rr(3, 4, 21, 18, 2.5), line: rr(3, 4, 21, 18, 2.5), mark: 'M11 8.5l7 4.5-7 4.5Z' },
  notifications: { plane: bell(.82), line: `${bell(.82)}`, mark: clapper(.82) },
}
const offset: Draw = Object.fromEntries((Object.keys(offsetShapes) as NavIconDestination[]).map(kind => [kind, () => {
  const { plane, line, mark } = offsetShapes[kind]
  return [
    <g key="sh" className="sh" transform="translate(5 5)"><path className="fs" d={plane} /></g>,
    <g key="top" transform="translate(0 0)"><path className="s" d={line} /><path className="a" d={mark} /></g>,
  ]
}])) as unknown as Draw

/** 08 · Badge tile. */
const TILE = rr(3, 3, 26, 26, 6)
const badge: Draw = {
  pads: () => [P('t', 'ts', TILE), P('a', 'fs', `${rr(8.5, 8.5, 6, 6, 1.4)}${rr(17.5, 8.5, 6, 6, 1.4)}${rr(8.5, 17.5, 6, 6, 1.4)}`), P('b', 'fa', rr(17.5, 17.5, 6, 6, 1.4))],
  presets: () => [P('t', 'ts', TILE), P('a', 's', 'M9 12h14M9 20h14', { strokeWidth: 1.8 }), P('b', 'fa', `${circle(13, 12, 2.4)}${circle(19.5, 20, 2.4)}`)],
  show: () => [P('t', 'ts', TILE), P('a', 'fs', `${rr(8, 9, 8, 3, 1.5)}${rr(8, 14.5, 12, 3, 1.5)}${rr(8, 20, 7, 3, 1.5)}`), P('b', 'fa', rr(21.5, 8, 2.2, 16, 1.1))],
  lyrics: () => [P('t', 'ts', TILE), P('a', 's', 'M9 11h14M9 16h14M9 21h7', { strokeWidth: 1.8 }), P('b', 'a', 'M21 19v4', { strokeWidth: 2 })],
  media: () => [P('t', 'ts', TILE), P('a', 'fa', 'M12.8 10v12l10-6Z')],
  notifications: () => [P('t', 'ts', TILE), P('a', 'fs', `${bell(.55)}M13.4 22.3a2.6 2.6 0 0 0 5.2 0Z`), P('b', 'fa', circle(22.6, 9.6, 2.5))],
}

/** 09 · Medallion. */
const RING = circle(16, 16, 13)
const medallion: Draw = {
  pads: () => [P('r', 's ring', RING), P('r2', 'a', 'M16 3a13 13 0 0 1 11.3 6.5'), P('a', 's', `${rr(10, 10, 5, 5, 1)}${rr(17, 10, 5, 5, 1)}${rr(10, 17, 5, 5, 1)}`), P('b', 'fa', rr(17, 17, 5, 5, 1))],
  presets: () => [P('r', 's ring', RING), P('r2', 'a', 'M16 3a13 13 0 0 1 11.3 6.5'), P('a', 's', 'M10.5 12.5h11M10.5 19.5h11'), P('b', 'fa', `${circle(14, 12.5, 2)}${circle(19, 19.5, 2)}`)],
  show: () => [P('r', 's ring', RING), P('r2', 'a', 'M16 3a13 13 0 0 1 11.3 6.5'), P('a', 's', 'M10 12h6M10 16h8M10 20h5'), P('b', 'a', 'M22 10.5v11')],
  lyrics: () => [P('r', 's ring', RING), P('r2', 'a', 'M16 3a13 13 0 0 1 11.3 6.5'), P('a', 's', 'M10 12h12M10 16h8M10 20h10'), P('b', 'a', 'M22 14.5v3.5')],
  media: () => [P('r', 's ring', RING), P('r2', 'a', 'M16 3a13 13 0 0 1 11.3 6.5'), P('a', 'a', 'M13.2 11.2 21.6 16l-8.4 4.8Z')],
  notifications: () => [P('r', 's ring', RING), P('r2', 'a', 'M16 3a13 13 0 0 1 11.3 6.5'), P('a', 's', `${bell(.5)}${clapper(.5)}`), P('b', 'fa', circle(21.4, 10.6, 1.9))],
}

/** 10 · LED matrix. */
const MATRIX: Record<NavIconDestination, readonly string[]> = {
  pads: ['XXXX.XXXX', 'XXXX.XXXX', 'XXXX.XXXX', 'XXXX.XXXX', '.........', 'XXXX.AAAA', 'XXXX.AAAA', 'XXXX.AAAA', 'XXXX.AAAA'],
  presets: ['XXXXXXXXX', '..AA.....', '..AA.....', '.........', 'XXXXXXXXX', '......AA.', '......AA.', '.........', 'XXXXXXXXX'],
  show: ['XXXX.A...', 'XXXX.A...', '.....A...', '.XXXXAXX.', '.XXXXAXX.', '.....A...', 'XXXXXA...', 'XXXXXA...', '.....A...'],
  lyrics: ['XXXXXXXXX', '.........', 'XXXXXXX..', '.........', 'XXXXXXXAA', '.........', 'XXXXX....', '.........', 'XXXXXXX..'],
  media: ['XXXXXXXXX', 'X.......X', 'X.A.....X', 'X.AAA...X', 'X.AAAAA.X', 'X.AAA...X', 'X.A.....X', 'X.......X', 'XXXXXXXXX'],
  notifications: ['....X..AA', '...XXX.AA', '..XXXXX..', '..XXXXX..', '.XXXXXXX.', '.XXXXXXX.', 'XXXXXXXXX', '.........', '....X....'],
}
const matrix: Draw = Object.fromEntries((Object.keys(MATRIX) as NavIconDestination[]).map(kind => [kind, () => [P('x', 'fs', pixels(MATRIX[kind], 'X')), P('y', 'fa', pixels(MATRIX[kind], 'A'))]])) as unknown as Draw

/** 11 · Hex fragments: a broken hexagon frame holds each symbol; accent segments sit where the frame is open. */
const HEX_GAP_TL = 'M10.8 7 16 4l10.4 6v12L16 28 5.6 22V10'
const HEX_GAP_BR = 'M26.4 22 16 28 5.6 22V10L16 4l10.4 6'
const fragment: Draw = {
  pads: () => [P('h', 's', HEX_GAP_TL), P('g', 'a', 'M6.6 9.4 9.2 7.9'), P('a', 'fs', `${rr(10.5, 10.5, 4.6, 4.6, 0)}${rr(16.9, 10.5, 4.6, 4.6, 0)}${rr(10.5, 16.9, 4.6, 4.6, 0)}`), P('b', 'fa', rr(16.9, 16.9, 4.6, 4.6, 0))],
  presets: () => [P('h', 's', HEX_GAP_BR), P('g', 'a', 'M26.4 11.5v9'), P('a', 's', 'M11 13.5h10M11 19.5h10'), P('b', 'fa', `${circle(14, 13.5, 1.9)}${circle(18.5, 19.5, 1.9)}`)],
  show: () => [P('h', 's', HEX_GAP_TL), P('g', 'a', 'M6.6 9.4 9.2 7.9'), P('a', 's', 'M10.5 12.5h6M10.5 16h9M10.5 19.5h5'), P('b', 'a', 'M21.5 11.5v9')],
  lyrics: () => [P('h', 's', HEX_GAP_BR), P('g', 'a', 'M26.4 11.5v9'), P('a', 's', 'M10.5 12.5h10M10.5 16h7M10.5 19.5h9'), P('b', 'a', 'M21 17.5v4')],
  media: () => [P('h', 's', HEX_GAP_TL), P('g', 'a', 'M6.6 9.4 9.2 7.9'), P('a', 'a', 'M13 11.5 21 16l-8 4.5Z')],
  notifications: () => [P('h', 's', HEX_GAP_BR), P('g', 'a', 'M26.4 11.5v9'), P('a', 's', `${bell(.5)}${clapper(.5)}`), P('b', 'fa', circle(26.4, 10, 2.1))],
}

/** 12 · Offset duotone: a slate outline with the accent printed slightly off it. */
const misregister: Draw = {
  pads: () => [P('a', 's', `${rr(5, 5, 9, 9, 2.5)}${rr(18, 5, 9, 9, 2.5)}${rr(5, 18, 9, 9, 2.5)}`), P('b', 'a', 'M19 27h6.5a2.5 2.5 0 0 0 2.5-2.5V19'), P('c', 'fs', rr(20.5, 20.5, 4, 4, 1))],
  presets: () => [P('a', 's', rr(5, 5, 22, 22, 4)), P('b', 'a', 'M10 12.5h9M10 19.5h12'), P('c', 'a', `${circle(22.5, 12.5, 2.2)}${circle(12, 19.5, 2.2)}`)],
  show: () => [P('a', 's', `${rr(5, 7, 22, 19, 3)}M5 12.5h22M10 4.5v5M22 4.5v5`), P('b', 'a', 'M10 18.5h5M10 22h9M21 16v7')],
  lyrics: () => [P('a', 's', rr(7, 4, 18, 22, 2.5)), P('b', 'a', 'M11 11h10M11 15h10M11 19h6M7 28.5h18')],
  media: () => [P('a', 's', rr(4, 8, 18, 16, 3)), P('b', 'a', 'M22 14l6-3v10l-6-3'), P('c', 's', 'M11 13l5 3-5 3Z')],
  notifications: () => [P('a', 's', `${bell(1.02)}`), P('b', 'a', `M9.6 11a6.4 6.4 0 0 1 3.2-5.5${clapper()}`)],
}

/** 13 · Fade trail: strokes taper into the dark and leave a ghost echo; one accent stays bright. */
const FADE = (uid: string) => <defs key="defs"><linearGradient id={`${uid}-fade`} gradientUnits="userSpaceOnUse" x1="4" y1="4" x2="28" y2="28"><stop offset="0" stopColor="currentColor" /><stop offset="1" stopColor="currentColor" stopOpacity=".1" /></linearGradient></defs>
const G = (key: string, d: string, uid: string) => P(key, 'g', d, { stroke: `url(#${uid}-fade)` })
const fade: Draw = {
  pads: uid => [FADE(uid), G('g', `${rr(5, 5, 9, 9, 3)}${rr(18, 5, 9, 9, 3)}${rr(5, 18, 9, 9, 3)}`, uid), P('e', 'echo', circle(20, 20, 6)), P('a', 'a', circle(22.5, 22.5, 5))],
  presets: uid => [FADE(uid), G('g', 'M5 10h22M5 22h22', uid), P('e', 'echo', `${circle(10, 10, 3)}${circle(19, 22, 3)}`), P('a', 'a', `${circle(12, 10, 3)}${circle(21, 22, 3)}`)],
  show: uid => [FADE(uid), G('g', rr(4, 6, 24, 20, 3), uid), P('e', 'echo', 'M9 12.5l3 3 3-3.5 3 3.5'), P('a', 'a', 'M10 14l3 3 3-3.5 3 3.5M5 21h22')],
  lyrics: uid => [FADE(uid), G('g', 'M6 8h20M6 14h15M6 20h18', uid), P('e', 'echo', 'M4 26h9'), P('a', 'a', 'M6 26h9'), P('b', 'fa', circle(24, 26, 1.9))],
  media: uid => [FADE(uid), G('g', circle(16, 16, 11.5), uid), P('e', 'echo', circle(13, 15, 11.5)), P('a', 'a', 'M13.5 11.5 21 16l-7.5 4.5Z')],
  notifications: uid => [FADE(uid), G('g', `${bell()}${clapper()}`, uid), P('e', 'echo', `${bell(.96)}`, { transform: 'translate(-3 1)' }), P('a', 'a', 'M4 11a12 12 0 0 1 3.4-6M28 11a12 12 0 0 0-3.4-6'), P('b', 'fa', circle(24, 8, 2.4))],
}

/** 14 · Dark inlay: light outlines around a dark tinted interior with an accent detail inside. */
const inlay: Draw = {
  pads: () => [P('a', 'inl', rr(4, 4, 24, 24, 6)), P('b', 'a', 'M12 9v14M20 9v14M9 12h14M9 20h14')],
  presets: () => [<g key="c" transform="rotate(10 17 17)"><path className="inl" d={rr(10, 9, 17, 18, 3)} /><path className="a" d="M14.5 18h8M18.5 14v8" /></g>, P('a', 's', 'M5 24V8a3 3 0 0 1 3-3h9')],
  show: () => [P('a', 'inl', `${rr(4, 10, 24, 17, 3)}`), P('h', 's', 'M12 10V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3'), P('b', 'a', rr(12, 16, 8, 4, 2))],
  lyrics: () => [P('a', 'inl', 'M8 4h12l6 6v18H8Z'), P('b', 's', 'M20 4v6h6'), P('c', 'a', 'M12 15.5h10M12 19.5h10M12 23.5h6')],
  media: () => [P('a', 'inl', rr(4, 6, 24, 20, 4)), P('b', 'fa', 'M13 11.5 21 16l-8 4.5Z')],
  notifications: () => [P('a', 'inl', `${bell()}`), P('b', 'a', clapper()), P('c', 'fa', circle(24, 8, 2.8))],
}

/** 15 · Flat geometry: only filled circles, bars and triangles in two flat colours. */
const geometric: Draw = {
  pads: () => [P('a', 'fa', circle(9, 9, 5)), P('b', 'fs', `${rr(18, 4, 10, 10, 0)}M4 18h10v10Z`), P('c', 'fa', 'M18 18h10v10H18Z M23 18v10')],
  presets: () => [P('a', 'fs', [8, 16, 24].flatMap(y => [8, 16, 24].filter(x => !(x === 24 && y >= 16) && !(x === 16 && y === 24)).map(x => circle(x, y, 2.7))).join('')), P('b', 'fa', `${circle(24, 16, 2.7)}${circle(16, 24, 2.7)}${circle(24, 24, 2.7)}`)],
  show: () => [P('a', 'fa', `${rr(4, 6, 24, 4.5, 0)}${rr(4, 21.5, 12, 4.5, 0)}`), P('b', 'fs', `${rr(4, 13.75, 16, 4.5, 0)}${rr(22, 21.5, 4.5, 4.5, 0)}`)],
  lyrics: () => [P('a', 'fs', `${rr(4, 6, 20, 3.4, 0)}${rr(4, 14.3, 14, 3.4, 0)}${rr(4, 22.6, 18, 3.4, 0)}`), P('b', 'fa', 'M23 12.5a5 5 0 0 1 0 10Z')],
  media: () => [P('a', 'fa', circle(16, 16, 12.5)), P('b', 'fs', 'M13.2 10.4v11.2l9.4-5.6Z')],
  notifications: () => [P('a', 'fs', `M7 21a9 9 0 0 1 18 0Z${rr(4, 21.5, 24, 3, 0)}`), P('b', 'fa', `${circle(16, 27.5, 2.3)}${circle(24, 8, 3.6)}`)],
}

const SYSTEMS: Record<NavIconSystemId, Draw> = { hairline, bold, solid, tinted, technical, plotter, offset, badge, medallion, matrix, fragment, misregister, fade, inlay, geometric }

/** The artwork for one destination in one system, as the children of a 32 × 32 svg. */
export function NavIconArtwork({ system, kind }: { system: NavIconSystemId; kind: NavIconDestination }) {
  const uid = useId().replace(/:/g, '')
  return <>{SYSTEMS[system][kind](uid)}</>
}

export type { Cls as NavIconPartClass }
