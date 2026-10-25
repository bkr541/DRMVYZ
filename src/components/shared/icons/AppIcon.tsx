import type { SVGProps } from 'react'
import './appIcon.css'
import { CARBON_GLYPHS, type CarbonGlyphKind } from './carbonGlyphs'

/** Custom 32px artwork for icons Carbon has no equivalent for (brand, workspace, lighting and effect icons): 1.5px round strokes, subdued structural lines and cyan functional details. */
const DRAWINGS = {
  brand: ['M8 25q-7-1-5-8 1-4 6-4 0-9 9-9 6 0 8 8 7 0 6 7 0 6-7 6Z', 'M16 10q1 5 6 6-5 1-6 6-1-5-6-6 5-1 6-6Z'],
  rekordbox: ['M16 2 29 9v14l-13 7L3 23V9Z', 'M9 22V10h8a4 4 0 0 1 0 8H9M17 18l7 6'],
  navReact: ['M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26M16 8a8 8 0 1 0 0 16 8 8 0 1 0 0-16M16 14a2 2 0 1 0 0 4 2 2 0 1 0 0-4', 'M16 3v6M23 12l2 1M24 20l-2 1'],
  navPreset: ['M4 17v11h18M7 11v11h18M11 4h18v12H11Z', 'M15 8h10M18 6v4M15 12h6'],
  navShow: ['M4 20 16 26l12-6M4 25l12 6 12-6M4 4h24M8 5v5h5V5M20 5v5h5V5', 'M8 13 5 20M12 13l4 7M20 13l-3 7M24 13l3 7'],
  navLyrics: ['M3 4h26v19H3ZM7 8h18M7 12h12M7 27h3M15 27h3M23 27h3', 'M7 17h18M7 20h12'],
  navMedia: ['M3 15v14h19M7 10v14h19M11 4h18v14H11Z', 'M17 8l6 3-6 3Z'],
  ratio16x9: ['M3 8h26v16H3Z', 'M7 14v-2h5M25 18v2h-5'],
  ratio16x10: ['M3 7h26v18H3Z', 'M7 13v-2h5M25 19v2h-5'],
  ratio4x3: ['M4 7h24v18H4Z', 'M8 13v-2h5M24 19v2h-5'],
  ratio3x2: ['M4 8h24v16H4Z', 'M8 14v-2h5M24 18v2h-5'],
  ratio1x1: ['M5 5h22v22H5Z', 'M9 11V9h5M23 21v2h-5'],
  ratio9x16: ['M9 3h14v26H9Z', 'M12 10V7h4M20 22v3h-4'],
  blackout: ['M4 6h24v20H4Z', 'M5 27 27 5M8 10h8'],
  rhythm: ['M4 26h24M7 23l5-18h8l5 18M10 10h12', 'M16 23 25 8M13 23h6'],
  shader: ['M16 3 29 10v13l-13 7L3 23V10ZM3 10l13 7 13-7M16 17v13', 'M10 13l6-3 6 3M16 4v6'],
  cinema: ['M4 8 16 2l12 6v16l-12 6-12-6ZM4 8l12 7 12-7M16 15v15', 'M12 10l5-3 5 3-5 3Z'],
  canvas: ['M4 12h19v17H4ZM8 7h19v17M12 3h18v17', 'M10 24l4-6 5 6M24 7h2'],
  pixGrid: ['M4 5h24v22H4ZM4 12h24M4 20h24M12 5v22M20 5v22', 'M12 12h8v8h-8Z'],
  headliner: ['M5 27h22M8 23v-4a8 6 0 0 1 16 0v4M16 4a5 5 0 1 0 0 10 5 5 0 1 0 0-10', 'M6 12v5M26 12v5M5 9a11 11 0 0 1 22 0'],
  scope: ['M4 6h24v20H4ZM10 30h12M16 26v4', 'M6 17h4l3-7 5 12 3-8 2 3h3'],
  shape: ['M16 3 28 10v13l-12 7L4 23V10Z', 'M16 11a5 5 0 1 0 0 10 5 5 0 1 0 0-10'],
  orbit: ['M16 10a6 6 0 1 0 0 12 6 6 0 1 0 0-12M3 20Q3 9 21 8t8 7Q29 25 11 25T3 20Z', 'M20 5h.1M7 25h.1'],
  mirror: ['M4 5h10v23H4ZM19 5h10v23H19', 'M14 9l5 3M14 16l5 3M14 23l5 3'],
  constellation: ['M6 21 14 6l13 11-7 11Z', 'M6 19a2 2 0 1 0 0 4 2 2 0 1 0 0-4M14 4a2 2 0 1 0 0 4 2 2 0 1 0 0-4M27 15a2 2 0 1 0 0 4 2 2 0 1 0 0-4M20 26a2 2 0 1 0 0 4 2 2 0 1 0 0-4'],
  corridor: ['M3 4h26v25H3ZM8 9h16v15H8ZM3 4l10 10M29 4 19 14M3 29l10-10M29 29 19 19', 'M13 14h6v5h-6Z'],
  storm: ['M4 13q0-6 7-6 3-7 9-1 8-1 9 7M5 25h6M23 25h5', 'M19 10 11 20h7l-3 10 10-14h-7Z'],
  laser: ['M7 22h18v7H7ZM11 22v-4h10v4', 'M16 18 4 3M16 18 10 2M16 18V2M16 18 22 2M16 18 28 3'],
  movingHead: ['M8 22V12h16v10M11 22h10M9 29h14M16 22v7M12 8h8v10h-8Z', 'M12 8 5 2M20 8l7-6M16 8V1'],
  ledBar: ['M3 12h26v10H3ZM8 22v6M24 22v6', 'M7 15v4M13 15v4M19 15v4M25 15v4'],
  ledTube: ['M12 3h8v26h-8ZM12 7h8M12 25h8', 'M16 10v12'],
  strobe: ['M4 18h24v10H4ZM9 22h14', 'M8 13 5 8M16 12V4M24 13l3-5'],
  blinder: ['M3 8h26v18H3Z', 'M10 11a3 3 0 1 0 0 6 3 3 0 1 0 0-6M22 11a3 3 0 1 0 0 6 3 3 0 1 0 0-6M10 19h.1M22 19h.1'],
  wash: ['M9 18h14v9H9ZM16 27v3', 'M9 18 4 5M23 18l5-13M12 18 10 3M20 18l2-15M16 18V2'],
  videoWall: ['M3 5h26v22H3ZM3 16h26M12 5v22M21 5v22', 'M14 9h5v4h-5M23 19h4v5h-4'],
  haze: ['M3 23h13v6H3ZM7 18h5v5', 'M9 15q-5-6 2-7t9-3M16 19q-3-7 4-7t9-4M22 25q-4-6 2-7t5-3'],
  co2: ['M10 23h12v6H10ZM13 17h6v6', 'M13 17Q3 9 6 3M16 17V2M19 17Q29 9 26 3'],
  particles: ['M4 26 16 30l12-4M5 21l11 4 11-4', 'M7 6h.1M16 3h.1M25 9h.1M11 14h.1M22 18h.1'],
  texture: ['M4 5h24v23H4ZM4 14l9-9M4 23 22 5M9 28 28 9M18 28l10-10', 'M22 28l6-6M4 9l4-4'],
  fx: ['M4 6h24v22H4Z', 'M9 23V12h6M9 17h5M19 13l6 10M25 13l-6 10'],
  apple: ['M21 8q-5-3-8 0Q4 4 4 15q0 11 7 14l5-2 5 2q5-2 7-8-7-3-2-11Z', 'M16 6q0-5 7-5 0 5-7 5Z'],
  windows: ['M3 5l11-2v12H3ZM3 18h11v12L3 28Z', 'M18 3l12-2v14H18ZM18 18h12v13l-12-1Z'],
  google: ['M26 8a13 13 0 1 0 1 17', 'M29 16H17M29 16v9h-7'],
} as const

export type AppIconDrawing = keyof typeof DRAWINGS
export type AppIconKind = AppIconDrawing | CarbonGlyphKind

export interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  kind: AppIconKind
  size?: number | string
  /** Allows existing activity animations to target the approved signal artwork. */
  signalClassName?: string
}

function isCarbonGlyph(kind: AppIconKind): kind is CarbonGlyphKind {
  return Object.prototype.hasOwnProperty.call(CARBON_GLYPHS, kind)
}

/** Shared production renderer: Carbon glyphs where Carbon has an equivalent, custom linework otherwise. */
export function AppIcon({ kind, size = 18, className, signalClassName, style, ...props }: AppIconProps) {
  if (isCarbonGlyph(kind)) {
    return (
      <svg
        {...props}
        className={`app-icon app-icon--carbon${className ? ` ${className}` : ''}`}
        data-app-icon={kind}
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="currentColor"
        aria-hidden="true"
        style={{ ...style, fill: 'currentColor', stroke: 'none' }}
      >
        <g className={`app-icon__glyph${signalClassName ? ` ${signalClassName}` : ''}`}>
          {CARBON_GLYPHS[kind].map(d => <path key={d} d={d} />)}
        </g>
      </svg>
    )
  }
  const [structure, signal] = DRAWINGS[kind]
  return (
    <svg
      {...props}
      className={`app-icon${className ? ` ${className}` : ''}`}
      data-app-icon={kind}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ ...style, fill: 'none', strokeWidth: 1.5 }}
    >
      <path d={structure} opacity={0.7} />
      <path d={signal} className={`app-icon__signal${signalClassName ? ` ${signalClassName}` : ''}`} />
    </svg>
  )
}
