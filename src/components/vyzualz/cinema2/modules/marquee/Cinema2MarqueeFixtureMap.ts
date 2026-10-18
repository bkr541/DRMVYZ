import type { Cinema2MarqueeFixtureKind } from './Cinema2MarqueeDomain'

/**
 * Maps authored GLB node names to MARQUEE's controllable families. The V2 reconstruction (`DVYDRM_Marquee_HighFidelity_v2.glb`) renamed most
 * fixtures relative to the original blockout, so both naming schemes are understood here and the rest of the runtime never matches a string.
 *
 *   family            V2 name                                         legacy (blockout) name
 *   marquee-front…    bulbs.marquee.<face>.<top|bottom|start|end>.NN  bulbs.marquee.<face>.NN
 *   canopy            bulbs.canopy.rowRR.positionPP                   bulbs.canopy.rRR.bPP
 *   tower-left/right  bulbs.tower.<-1|1>.<border|arch|lens|glass>…    bulbs.tower.<left|right>.…
 *   led-left/right    leds.<side>.rRR.cCC                             (same)
 *   neon-red/amber/…  any non-LED mesh using mat.neon_<colour>        neon.<colour>.…, roof_neon…
 */
export type Cinema2MarqueeFace = 'front' | 'left' | 'right'

export interface Cinema2MarqueeFixtureDescriptor {
  readonly kind: Cinema2MarqueeFixtureKind
  /** Which physical sub-group of the family the node belongs to (marquee edge, tower part, …). */
  readonly part: string
  /** Position inside the family as authored in the name, when the name carries one. */
  readonly index: number | null
  readonly rowIndex: number | null
  readonly columnIndex: number | null
}

export type Cinema2MarqueeNodeClass =
  | Readonly<{ role: 'sign'; face: Cinema2MarqueeFace }>
  | Readonly<{ role: 'fixture'; fixture: Cinema2MarqueeFixtureDescriptor }>
  | Readonly<{ role: 'static' }>

const SIGN_NAMES: Readonly<Record<string, Cinema2MarqueeFace>> = Object.freeze({
  'marquee.front.TEXT_SURFACE': 'front',
  'marquee.left.TEXT_SURFACE': 'left',
  'marquee.right.TEXT_SURFACE': 'right',
})

const fixture = (kind: Cinema2MarqueeFixtureKind, part: string, index: number | null = null, rowIndex: number | null = null, columnIndex: number | null = null): Cinema2MarqueeNodeClass =>
  Object.freeze({ role: 'fixture', fixture: Object.freeze({ kind, part, index, rowIndex, columnIndex }) })

const STATIC: Cinema2MarqueeNodeClass = Object.freeze({ role: 'static' })

export function classifyCinema2MarqueeNode(authoredName: string, materialName: string): Cinema2MarqueeNodeClass {
  const sign = SIGN_NAMES[authoredName]
  if (sign) return Object.freeze({ role: 'sign', face: sign })

  let match = /^bulbs\.marquee\.(front|left|right)\.(top|bottom|start|end)\.(\d+)$/.exec(authoredName)
  if (match) return fixture(`marquee-${match[1] as Cinema2MarqueeFace}`, match[2]!, Number(match[3]))
  match = /^bulbs\.marquee\.(front|left|right)\.(\d+)$/.exec(authoredName)
  if (match) return fixture(`marquee-${match[1] as Cinema2MarqueeFace}`, 'perimeter', Number(match[2]))

  match = /^bulbs\.canopy\.row(\d+)\.position(\d+)$/.exec(authoredName)
  if (match) return fixture('canopy', 'underside', null, Number(match[1]), Number(match[2]))
  match = /^bulbs\.canopy\.r(\d+)\.b(\d+)$/.exec(authoredName)
  if (match) return fixture('canopy', 'underside', null, Number(match[1]), Number(match[2]))

  match = /^bulbs\.tower\.(-1|1|left|right)\.(border|arch|lens|glass)?/.exec(authoredName)
  if (match) return fixture(match[1] === '-1' || match[1] === 'left' ? 'tower-left' : 'tower-right', match[2] ?? 'bulb')

  match = /^leds\.(left|right)\.r(\d+)\.c(\d+)$/.exec(authoredName)
  if (match) return fixture(match[1] === 'left' ? 'led-left' : 'led-right', 'cell', null, Number(match[2]), Number(match[3]))

  match = /^crowd\.flash\.(\d+)$/.exec(authoredName)
  if (match) return fixture('crowd-flash', 'camera', Number(match[1]))

  // Neon is recognised by its material, so a renamed tube is still controllable; LED cells are the only other neon-material meshes.
  const neon = /^mat\.neon_(red|amber|blue)$/.exec(materialName) ?? /^Neon · (red|amber|blue)$/.exec(materialName)
  if (neon) return fixture(`neon-${neon[1] as 'red' | 'amber' | 'blue'}`, 'tube')
  if (/^neon\.(red|amber|blue)\./.test(authoredName)) return fixture(`neon-${/^neon\.(red|amber|blue)\./.exec(authoredName)![1] as 'red' | 'amber' | 'blue'}`, 'tube')
  return STATIC
}

/** Perimeter order of a marquee face: top edge left to right, right end down, bottom edge right to left, left end up. */
export const CINEMA2_MARQUEE_PERIMETER_ORDER = Object.freeze(['top', 'end', 'bottom', 'start'] as const)

/** 0..1 progress of a marquee bulb around its sign, given how many bulbs each edge has. */
export function marqueePerimeterProgress(part: string, index: number, counts: Readonly<Record<string, number>>): number {
  const total = CINEMA2_MARQUEE_PERIMETER_ORDER.reduce((sum, edge) => sum + (counts[edge] ?? 0), 0)
  if (total <= 0 || !(part in counts)) return 0.5
  let before = 0
  for (const edge of CINEMA2_MARQUEE_PERIMETER_ORDER) {
    if (edge === part) break
    before += counts[edge] ?? 0
  }
  const along = counts[part]! <= 1 ? 0 : index / (counts[part]! - 1)
  // The bottom and left edges are travelled against their authored index order.
  const directed = part === 'bottom' || part === 'start' ? 1 - along : along
  return Math.min(1, (before + directed * Math.max(0, counts[part]! - 1)) / Math.max(1, total - 1))
}

/** Crease angle (degrees) used when deriving normals for a mesh that has none; 180 gives fully smooth round fixtures. */
export function marqueeCreaseDegrees(materialName: string, authoredName = ''): number {
  if (/^(crown|neon|roof\.neon|tower\.-?\d+\.(fixture|housing))/.test(authoredName) || /rounded|arch|scallop|lens|glass/.test(authoredName)) return authoredName.startsWith('crown.') ? 75 : 180
  if (/incandescent|neon/i.test(materialName)) return 180
  if (/velvet|curtain|carpet|crowd/i.test(materialName)) return 70
  if (/metal|brass|red_painted/i.test(materialName)) return 55
  return 38
}
