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

/* ── 16–20: briefed rows. Pads follow production's pad surface (dark tile, 1px border, colour line under the label, lit hit state),
   Presets show configuration, Show combines DJ lighting with a timeline, Lyrics combine a mic with lyric lines and a note, and
   Media shows several media types (image, video, audio, font). ── */
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

/** 16 · Pad console: the production pad's construction at icon scale. */
const PADX = [2, 12, 22]
const console_: Draw = {
  pads: () => [
    P('t', 'ts', sq(PADX, PADX, 8, 8, 2.2, (x, y) => x === 12 && y === 12)),
    P('l', 'a', PADX.flatMap(y => PADX.filter(x => !(x === 12 && y === 12)).map(x => `M${x + 2} ${y + 5.4}h4`)).join('')),
    P('h', 'a', rr(10.7, 10.7, 10.6, 10.6, 3), { style: { opacity: .4 } }),
    P('c', 'ta', rr(12, 12, 8, 8, 2.2)), P('k', 'a', 'M14 17.4h4', { style: { strokeWidth: 2 } }),
  ],
  presets: () => [P('a', 's', rr(3, 4, 26, 24, 3)), P('b', 's', 'M8 11h16M8 16.5h16M8 22h16'), P('c', 'a', 'M8 11h5.5M8 16.5h11.5M8 22h3.5'), P('d', 'fa', `${circle(13.5, 11, 2.3)}${circle(19.5, 16.5, 2.3)}${circle(11.5, 22, 2.3)}`)],
  show: () => [P('a', 's', 'M11 3h10v6H11Z'), P('b', 'a', 'M13 11 8 18M16 11v7M19 11l5 7'), P('c', 's', `${rr(3, 21, 26, 8, 2)}M3 25h26`), P('d', 'ta', rr(5.5, 22.5, 7, 5, 1.2) + rr(15, 22.5, 5, 5, 1.2)), P('e', 'a', 'M23.5 19v12')],
  lyrics: () => [P('a', 's', rr(5, 3, 7, 12, 3.5)), P('b', 's', 'M3.5 12a5 5 0 0 0 10 0M8.5 17v4M5.5 21h6'), P('c', 'a', 'M17 8h11M17 13h8'), P('d', 'fa', circle(20, 25.5, 2.4)), P('e', 'a', 'M22.4 25.5V18l5 1.8')],
  media: () => [P('t', 's', `${rr(3, 3, 12, 12, 2.5)}${rr(17, 3, 12, 12, 2.5)}${rr(3, 17, 12, 12, 2.5)}${rr(17, 17, 12, 12, 2.5)}`), P('i', 'a', `${mediaGlyph('image', 3, 3)}${mediaGlyph('audio', 3, 17)}${mediaGlyph('font', 17, 17)}`), P('v', 'fa', mediaGlyph('video', 17, 3))],
  notifications: () => [P('a', 's', `${bell()}${clapper()}`), P('b', 'ta', circle(24, 8, 3)), P('c', 'a', 'M4 12a12 12 0 0 1 3.2-6.2')],
}

/** 17 · Neon tube: one weight of glowing stroke; knobs, beams and a ball mic. */
const neon: Draw = {
  pads: () => [P('t', 's', sq([3, 17], [3, 17], 12, 12, 3.5, (x, y) => x === 17 && y === 17)), P('l', 'a', 'M7 12h4M21 12h4M7 26h4'), P('c', 'ta', rr(17, 17, 12, 12, 3.5)), P('k', 'a', 'M21 26h4')],
  presets: () => [P('a', 's', `${circle(10, 10, 5.6)}${circle(22, 10, 5.6)}`), P('b', 'a', 'M10 10l2.8-2.8M22 10l-2.8 2.8'), P('c', 's', rr(4, 20, 13, 7, 3.5)), P('d', 'fa', circle(13.5, 23.5, 2.1)), P('e', 'a', 'M21 22h7M21 26h4.5')],
  show: () => [P('a', 's', `${circle(9, 6, 3)}${circle(23, 6, 3)}`), P('b', 'a', 'M7.2 8.6 3.6 16M10.8 8.6 14.4 16M21.2 8.6 17.6 16M24.8 8.6 28.4 16'), P('c', 's', 'M3 24h26M3 22v4M29 22v4'), P('d', 'fa', 'M9 21.5l2.5 2.5L9 26.5 6.5 24ZM16 21.5l2.5 2.5-2.5 2.5-2.5-2.5ZM23 21.5l2.5 2.5-2.5 2.5-2.5-2.5Z')],
  lyrics: () => [P('a', 's', `${circle(9.5, 8.5, 5)}M7.2 14.3 6 27h7l-1.2-12.7`), P('b', 'a', 'M6 7.5h7M5.6 10h7.8'), P('c', 's', 'M19 6h9M19 11h6'), P('d', 'fa', `${circle(21, 25, 2)}${circle(27, 23, 2)}`), P('e', 'a', 'M23 25V17.5M29 23V15.5M23 17.5l6-2')],
  media: () => [P('a', 's', rr(3, 5, 17, 14, 2.5)), P('b', 'a', 'M6 16l3.4-4 2.6 2.8 1.8-2 3.2 3.2'), P('c', 's', rr(12, 14, 17, 14, 2.5)), P('d', 'fa', 'M19.2 18.4v5.2l4.4-2.6Z')],
  notifications: () => [P('a', 's', `${bell()}${clapper()}`), P('b', 'a', 'M4 11a12 12 0 0 1 3.4-6M28 11a12 12 0 0 0-3.4-6'), P('c', 'fa', circle(24, 8, 2.3))],
}

/** 18 · Spec sheet: chamfered corners, a dashed construction frame, parameter table and folded document tiles. */
const ch = (x: number, y: number, w: number, h: number, c: number) => `M${x + c} ${y}H${x + w}V${y + h - c}L${x + w - c} ${y + h}H${x}V${y + c}Z`
const doc = (x: number, y: number) => `M${x} ${y}h8l4 4v8H${x}ZM${x + 8} ${y}v4h4`
const spec: Draw = {
  pads: () => [P('f', 'd', 'M1.5 1.5h29v29h-29Z'), P('t', 's', [3, 12.5, 22].flatMap(y => [3, 17].filter(x => !(x === 17 && y === 12.5)).map(x => ch(x, y, 12, 7, 2))).join('')), P('l', 'a', 'M5.5 7.2h7M5.5 26.2h7M19.5 7.2h7M19.5 26.2h7M5.5 16.7h7'), P('c', 'ta', ch(17, 12.5, 12, 7, 2)), P('k', 'a', 'M19.5 16.7h7')],
  presets: () => [P('f', 'd', 'M1.5 1.5h29v29h-29Z'), P('a', 's', 'M4 9h8M4 16h8M4 23h8'), P('b', 'a', `${ch(16, 6, 12, 6, 1.4)}${ch(16, 13, 12, 6, 1.4)}${ch(16, 20, 12, 6, 1.4)}`), P('c', 'fa', 'M18.4 9 20 7.6V10.4ZM18.4 16 20 14.6V17.4ZM18.4 23 20 21.6V24.4Z'), P('d', 'a', 'M22 9h4M22 16h4M22 23h4')],
  show: () => [P('a', 's', 'M10 3h12l2 6H8ZM10 9h12'), P('b', 'a', 'M10 12 5 19M16 12v7M22 12l5 7'), P('c', 's', 'M3 25h26M3 22.5v5M9 23.5v3M15 22.5v5M21 23.5v3M27 22.5v5'), P('d', 'ta', 'M4 28.5h8v1.5H4ZM14 28.5h5v1.5h-5Z'), P('e', 'a', 'M24 20v10'), P('f', 'fa', 'M22.2 20h3.6L24 22.4Z')],
  lyrics: () => [P('a', 's', 'M8 3h6l2 2v7l-2 2H8l-2-2V5ZM3.5 11v3l4 4h7l4-4v-3M11 18v6M7 24h8'), P('b', 'a', 'M20 6h8M20 11h6M20 16h8'), P('c', 'fa', 'M19 27l2-2 2 2-2 2Z'), P('d', 'a', 'M23 27V21l5 1.6')],
  media: () => [P('a', 's', `${doc(3, 3)}${doc(17, 3)}${doc(3, 17)}${doc(17, 17)}`), P('b', 'a', `${mediaGlyph('image', 3, 3)}${mediaGlyph('audio', 3, 17)}${mediaGlyph('font', 17, 17)}`), P('c', 'fa', mediaGlyph('video', 17, 3))],
  notifications: () => [P('a', 's', 'M16 4l5 4v7l4 5v2H7v-2l4-5V8ZM13 25h6v2h-6Z'), P('b', 'a', 'M22 3.5h5v5h-5Z'), P('c', 'fa', 'M23 4.5h3v3h-3Z')],
}

/** 19 · Solid stamp: filled shapes with the detail knocked out (even-odd). */
const EO = { fillRule: 'evenodd' } as const
const stamp: Draw = {
  pads: () => [
    P('t', 'fs', PADX.flatMap(y => PADX.filter(x => !(x === 12 && y === 12)).map(x => rr(x, y, 8, 8, 2.2) + rr(x + 2, y + 4.8, 4, 1.4, .7))).join(''), EO),
    P('c', 'fa', rr(12, 12, 8, 8, 2.2) + rr(14, 16.8, 4, 1.4, .7), EO),
  ],
  presets: () => [P('a', 'fs', `${rr(5.5, 3, 3, 26, 1.5)}${rr(14.5, 3, 3, 26, 1.5)}${rr(23.5, 3, 3, 26, 1.5)}`), P('b', 'fa', `${rr(3, 9, 8, 5, 1.6)}${rr(21, 14, 8, 5, 1.6)}${rr(12, 20.5, 8, 5, 1.6)}`)],
  show: () => [P('a', 'fs', 'M10 3h12l3 7H7Z'), P('r1', 'fa', rr(15, 13, 2, 7, 1), { transform: 'rotate(-38 16 12)' }), P('r2', 'fa', rr(15, 13.5, 2, 7, 1)), P('r3', 'fa', rr(15, 13, 2, 7, 1), { transform: 'rotate(38 16 12)' }), P('c', 'fs', `${rr(3, 23, 10, 5, 1.5)}${rr(15, 23, 6, 5, 1.5)}${rr(23, 23, 6, 5, 1.5)}`), P('d', 'fa', rr(18.5, 20, 2, 10, 1))],
  lyrics: () => [P('a', 'fs', rr(5, 2.5, 8, 12.5, 4) + rr(7, 5.6, 4, 1.2, .6) + rr(7, 8.6, 4, 1.2, .6) + rr(7, 11.6, 4, 1.2, .6), EO), P('b', 'fs', 'M3.5 11h2a3.5 3.5 0 0 0 7 0h2a5.5 5.5 0 0 1-11 0ZM8 18.5h2v4H8ZM5 22.5h8v2.4H5Z'), P('c', 'fs', `${rr(17, 6, 11, 2.4, 1.2)}${rr(17, 11, 8, 2.4, 1.2)}${rr(17, 16, 10, 2.4, 1.2)}`), P('d', 'fa', `${circle(21, 26, 2.6)}${rr(22.6, 19, 1.8, 7, .9)}M24.4 19h4l-.6 4h-3.4Z`)],
  media: () => [
    P('a', 'fs', rr(3, 3, 12, 12, 2.5) + 'M5.5 12.6l3-4.2 2 2.6 1.2-1.4 1.8 3Z' + rr(3, 17, 12, 12, 2.5) + rr(5.5, 22, 1.8, 4, .9) + rr(8.6, 20, 1.8, 8, .9) + rr(11.7, 22.8, 1.8, 3.2, .9) + rr(17, 17, 12, 12, 2.5) + 'M19.6 26.6l3.4-8.2 3.4 8.2h-1.8l-.5-1.4h-2.2l-.5 1.4Z', EO),
    P('b', 'fa', rr(17, 3, 12, 12, 2.5) + 'M21.5 6.4v5.2l4.4-2.6Z', EO),
  ],
  notifications: () => [P('a', 'fs', `${bell(.9)}${rr(12.8, 4.2, 6.4, 1.6, .8)}M13 24.4a3 3 0 0 0 6 0Z`, EO), P('b', 'fa', `${circle(24, 8, 4.4)}${circle(24, 8, 1.6)}`, EO)],
}

/** 20 · Chip tags: pill bodies, toggle switches, clip chips and a filmstrip. */
const chips: Draw = {
  pads: () => [P('t', 'ts', sq([3, 17], [3, 12.5, 22], 12, 7, 2, (x, y) => x === 17 && y === 12.5)), P('r', 'a', [3, 12.5, 22].flatMap(y => [3, 17].map(x => `M${x + 2.3} ${y + 1.8}v3.4`)).join('')), P('l', 's', [3, 12.5, 22].flatMap(y => [3, 17].map(x => `M${x + 5} ${y + 3.5}h5`)).join('')), P('c', 'ta', rr(17, 12.5, 12, 7, 2))],
  presets: () => [P('a', 's', `${rr(3, 4, 13, 6.5, 3.25)}${rr(3, 12.8, 13, 6.5, 3.25)}${rr(3, 21.6, 13, 6.5, 3.25)}`), P('b', 'fa', `${circle(12.75, 7.25, 1.9)}${circle(6.25, 16.05, 1.9)}${circle(12.75, 24.85, 1.9)}`), P('c', 'a', 'M20 7.25h9M20 24.85h9'), P('d', 's', 'M20 16h9')],
  show: () => [P('a', 's', `${circle(6, 6, 3)}${circle(16, 6, 3)}${circle(26, 6, 3)}`), P('b', 'fa', `${circle(6, 6, 1.1)}${circle(26, 6, 1.1)}`), P('c', 'a', 'M6 11v3M16 11v3M26 11v3'), P('d', 'ts', rr(3, 17.5, 10, 5, 2.5) + rr(24, 17.5, 5, 5, 2.5)), P('e', 'ta', rr(15, 17.5, 7, 5, 2.5)), P('f', 's', rr(3, 25, 26, 3.5, 1.75)), P('g', 'a', 'M19 15v15')],
  lyrics: () => [P('a', 's', rr(3.5, 3, 7, 11, 3.5)), P('b', 's', 'M2.5 11.5a5.5 5.5 0 0 0 9 4'), P('c', 'ts', rr(15, 4, 14, 5, 2.5)), P('d', 'ta', rr(15, 11, 10, 5, 2.5)), P('e', 'fa', circle(7, 24.5, 2.4)), P('f', 'a', 'M9.4 24.5V18.6l4 1.2'), P('g', 's', 'M17 24h12')],
  media: () => [P('a', 's', rr(3, 3, 26, 12, 2.5)), P('b', 'ts', rr(6, 6.4, 5, 5.2, 1) + rr(13.5, 6.4, 5, 5.2, 1)), P('c', 'ta', rr(21, 6.4, 5, 5.2, 1)), P('d', 'fa', `${circle(8.5, 4.7, .6)}${circle(16, 4.7, .6)}${circle(23.5, 4.7, .6)}${circle(8.5, 13.3, .6)}${circle(16, 13.3, .6)}${circle(23.5, 13.3, .6)}`), P('e', 's', `${rr(3, 18, 12, 11, 2.5)}${rr(17, 18, 12, 11, 2.5)}`), P('f', 'a', `${mediaGlyph('audio', 3, 17.5)}${mediaGlyph('font', 17, 17.5)}`)],
  notifications: () => [P('a', 's', `${bell(.92)}${clapper(.92)}`), P('b', 'ta', rr(18, 2.5, 10, 6, 3)), P('c', 'a', 'M21 5.5h4')],
}

const SYSTEMS: Record<NavIconSystemId, Draw> = { hairline, bold, solid, tinted, technical, plotter, offset, badge, medallion, matrix, fragment, misregister, fade, inlay, geometric, console: console_, neon, spec, stamp, chips }

/** The artwork for one destination in one system, as the children of a 32 × 32 svg. */
export function NavIconArtwork({ system, kind }: { system: NavIconSystemId; kind: NavIconDestination }) {
  const uid = useId().replace(/:/g, '')
  return <>{SYSTEMS[system][kind](uid)}</>
}

export type { Cls as NavIconPartClass }
