import type { ReactNode } from 'react'
import cloudMaster from '../../../assets/dvydrm_cloud_logo_clean_master.svg?raw'
import wordmarkMaster from '../../../assets/dvydrm_wordmark_clean_master.svg?raw'
import goonzMaster from '../../../assets/goonz_true_vector_master.svg?raw'

/** Scene subjects come from the native manifests and their authored geometry.
 * Coordinates are composed for the shared oversized Engine artwork window:
 * foreground at the right, secondary subjects at the left, open title volume.
 * These drawings never read or trace a rendered frame. */
export const ADDITIONAL_BLUEPRINT_MOTIFS = {
  'drmvyz.cinema2.backstreet': ['Neon wordmark', 'Glass tube returns', 'Brick courses', 'Wall mounts'],
  'drmvyz.cinema2.conduit': ['Chrome feed tubes', 'Cloud core', 'Chamber ribs', 'Segmented energy routes'],
  'drmvyz.cinema2.echoform': ['Headphone bulldog', 'Layered facial contours', 'Triangulated scan', 'Suspended scan points'],
  'drmvyz.cinema2.echowave': ['Wordmark contours', 'Offset depth layers', 'Triangulated letters', 'Four-point focal star'],
  'drmvyz.cinema2.electric-storm': ['Primary lightning', 'Branch discharges', 'Distant strike', 'Illuminated cloud shelves'],
  'drmvyz.cinema2.elevhate': ['Vertical megastructure', 'Stacked crossings', 'Light-lined passages', 'Receding platforms'],
  'drmvyz.cinema2.event-horizon': ['Gravitational aperture', 'Accretion disk', 'Orbiting fragments', 'Polar jets'],
  'drmvyz.cinema2.glassfall': ['Raised triangle facets', 'Layered black panels', 'Edge light inlays', 'Detached foreground triangle'],
  'drmvyz.cinema2.go-to': ['Pearl cloud sculpture', 'Polished outline', 'Turntable', 'Studio light cones'],
  'drmvyz.cinema2.hum-n': ['Faceted portrait', 'Angular shoulders', 'Wire topology', 'Floating face panels'],
  'drmvyz.cinema2.hypnotize': ['Curved turbine vanes', 'Recursive shaft', 'Braided conductors', 'Exterior resonators'],
  'drmvyz.cinema2.ifrit': ['Extruded hex portals', 'Mechanical wall ribs', 'Segmented portal lights', 'Central rift'],
  'drmvyz.cinema2.inertia': ['Dotted spherical core', 'Folding lattice', 'Hinged panel edges', 'Orbiting lattice nodes'],
  'drmvyz.cinema2.mainframe': ['Raised cloud emblem', 'Circuit traces', 'Processor hardware', 'Radar modules'],
  'drmvyz.cinema2.marquee': ['Art Deco canopy', 'Triple-face marquee', 'Vertical light towers', 'Wet street reflections'],
  'drmvyz.cinema2.nightshift': ['Faceted disco ball', 'Dance floor tiles', 'Ceiling LED frame', 'Reflected light rays'],
  'drmvyz.cinema2.psylo': ['Foreground mushroom caps', 'Curved stems and gills', 'Distant grove', 'Spores and mycelium'],
  'drmvyz.cinema2.reactor': ['Procedural reactor core', 'Radial struts', 'Flying shrapnel', 'Impact shockwave'],
  'drmvyz.cinema2.reliquary': ['Cut-crystal cloud', 'Supporting golden tree', 'Vine-wrapped forest', 'Overhead spot rig'],
  'drmvyz.cinema2.say-it': ['Bevelled letter faces', 'Extruded letter sides', 'Independent rotations', 'Assembly registration'],
  'drmvyz.cinema2.sixfold': ['Seven hexagonal cells', 'Mirror carriers', 'Optical iris', 'Structural locks'],
  'drmvyz.cinema2.starters': ['Field case', 'Three capture balls', 'Case latches', 'Ground vegetation'],
  'drmvyz.cinema2.switch-it': ['Horned mask', 'Faceted face', 'Portrait shoulders', 'Reveal fragments'],
  'drmvyz.cinema2.threshold': ['Giant LED monoliths', 'Hanging field', 'Corridor perspective', 'Wet floor mirrors'],
  'drmvyz.cinema2.trippy-bro': ['Optical fan', 'Crossing neon lattice', 'Woven lens', 'Luminous ribbons'],
  'drmvyz.cinema2.vacancy': ['CRT pyramid', 'Rounded screen glass', 'Cabinet hardware', 'Empty brick room'],
  'drmvyz.cinema2.war-of-worlds': ['Tripod invaders', 'Articulated legs', 'City blocks', 'Searchlight beams'],
} as const

type SceneId = keyof typeof ADDITIONAL_BLUEPRINT_MOTIFS
/** Individual subject-plane positions, separate from each camera pose. Keeping
 * the focal geometry inside the slice window avoids losing a face, cap, or lens
 * to cropping while secondary objects still fall into the left-edge fade. */
const SUBJECT_PLANES: Record<SceneId, readonly [string, string, string, string]> = {
  'drmvyz.cinema2.backstreet': ['translate(-15 8)', 'translate(-15 8)', 'translate(12 -10)', 'translate(0 22)'],
  'drmvyz.cinema2.conduit': ['translate(-15 5)', 'translate(-21 18)', 'translate(-27 20)', 'translate(0 -5)'],
  'drmvyz.cinema2.echoform': ['translate(140 72) scale(.82) translate(-165 -40)', 'translate(140 72) scale(.82) translate(-165 -40)', 'translate(-25 25)', 'translate(10 -16)'],
  'drmvyz.cinema2.echowave': ['translate(133 42) scale(.85) translate(-150 -30)', 'translate(133 42) scale(.85) translate(-150 -30)', 'translate(-12 12)', 'translate(0 -15)'],
  'drmvyz.cinema2.electric-storm': ['translate(-35 10)', 'translate(-35 10)', 'translate(30 -12)', 'translate(0 -8)'],
  'drmvyz.cinema2.elevhate': ['translate(-25 0)', '', '', 'translate(10 -6)'],
  'drmvyz.cinema2.event-horizon': ['translate(-25 25)', 'translate(-25 25)', 'translate(8 -17)', 'translate(-25 25)'],
  'drmvyz.cinema2.glassfall': ['', '', '', 'translate(10 -18)'],
  'drmvyz.cinema2.go-to': ['translate(-25 30)', 'translate(-25 30)', 'translate(-15 -20)', 'translate(10 0)'],
  'drmvyz.cinema2.hum-n': ['translate(-25 38)', 'translate(-25 0)', 'translate(-25 38)', 'translate(10 -16)'],
  'drmvyz.cinema2.hypnotize': ['translate(-25 35)', 'translate(-25 35)', '', 'translate(8 -17)'],
  'drmvyz.cinema2.ifrit': ['translate(-30 25)', 'translate(-15 0)', 'translate(-30 25)', 'translate(-30 25)'],
  'drmvyz.cinema2.inertia': ['translate(-25 30)', 'translate(-25 15)', 'translate(-25 0)', 'translate(0 -12)'],
  'drmvyz.cinema2.mainframe': ['translate(-30 30)', 'translate(-25 20)', 'translate(10 -18)', 'translate(-10 20)'],
  'drmvyz.cinema2.marquee': ['translate(-25 30)', 'translate(-25 30)', 'translate(-15 0)', 'translate(10 -15)'],
  'drmvyz.cinema2.nightshift': ['translate(-25 35)', 'translate(0 -20)', 'translate(0 10)', 'translate(-25 20)'],
  'drmvyz.cinema2.psylo': ['translate(-35 55)', 'translate(5 -17)', 'translate(0 14)', 'translate(5 -8)'],
  'drmvyz.cinema2.reactor': ['translate(-28 30)', 'translate(-28 30)', 'translate(10 -18)', 'translate(-28 30)'],
  'drmvyz.cinema2.reliquary': ['translate(-25 28)', 'translate(-25 -10)', 'translate(10 -20)', 'translate(-10 25)'],
  'drmvyz.cinema2.say-it': ['translate(-10 18)', 'translate(-10 18)', 'translate(10 -17)', 'translate(5 0)'],
  'drmvyz.cinema2.sixfold': ['translate(-28 35)', 'translate(-28 35)', 'translate(-28 35)', 'translate(10 -18)'],
  'drmvyz.cinema2.starters': ['translate(-15 20)', '', 'translate(-25 28)', 'translate(5 -12)'],
  'drmvyz.cinema2.switch-it': ['translate(-25 40)', 'translate(-25 40)', 'translate(-25 10)', 'translate(10 -16)'],
  'drmvyz.cinema2.threshold': ['', 'translate(0 28)', '', 'translate(5 -18)'],
  'drmvyz.cinema2.trippy-bro': ['translate(-25 35)', 'translate(-10 25)', 'translate(-32 -5)', 'translate(10 -15)'],
  'drmvyz.cinema2.vacancy': ['translate(142 88) scale(.78) translate(-160 -75)', 'translate(10 -18)', 'translate(-15 -17)', 'translate(5 -10)'],
  'drmvyz.cinema2.war-of-worlds': ['', '', 'translate(10 -23)', 'translate(-20 10)'],
}

function Scene({ id, children }: { id: SceneId; children: readonly [ReactNode, ReactNode, ReactNode, ReactNode] }) {
  return <>{children.map((child, i) => <g key={i} data-art-motif={ADDITIONAL_BLUEPRINT_MOTIFS[id][i]} transform={`${SUBJECT_PLANES[id][i]} ${['rotate(-3 150 45)', 'rotate(2 150 115)', 'rotate(-2 60 110)', 'rotate(4 160 35)'][i]}`}>{child}</g>)}</>
}

const vectorPaths = (raw: string, ids?: RegExp) => [...raw.matchAll(/<path\b([^>]+)>/g)].flatMap(match => {
  const id = match[1].match(/\bid="([^"]+)"/)?.[1] ?? ''
  const d = match[1].match(/\bd="([^"]+)"/)?.[1]
  return d && (!ids || ids.test(id)) ? [{ id, d }] : []
})
const cloudPaths = vectorPaths(cloudMaster)
const wordmarkPaths = vectorPaths(wordmarkMaster)
const bulldogPaths = vectorPaths(goonzMaster, /outline|cup-outer|ear-silver-shape|eye-socket|iris-border|nose-bridge-silver-outer|jowl-black|mouth-inner|chin-silver/)
function Cloud({ x, y, width = 78 }: { x: number; y: number; width?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${width / 1195})`}>{cloudPaths.map(({ id, d }) => <path key={id} d={d} fill="currentColor" fillOpacity={id === 'cloud-body' ? '.085' : '.025'} />)}</g>
}
function Wordmark({ x, y, width = 128 }: { x: number; y: number; width?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${width / 2006})`}>{wordmarkPaths.map(({ id, d }) => <path key={id} d={d} fill="currentColor" fillOpacity={id.includes('body') ? '.085' : '.025'} />)}</g>
}
function Hex({ x, y, r, depth = 0 }: { x: number; y: number; r: number; depth?: number }) {
  const points = Array.from({ length: 6 }, (_, i) => [x + r * Math.cos(Math.PI / 3 * i - Math.PI / 2), y + r * Math.sin(Math.PI / 3 * i - Math.PI / 2)])
  const path = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join('') + 'Z'
  return <g><path d={path} fill="currentColor" fillOpacity=".085" />{depth > 0 && <><path d={path} transform={`translate(${depth} ${-depth})`} opacity=".5" />{points.map(([px, py], i) => <path key={i} d={`M${px} ${py}l${depth}-${depth}`} opacity=".55" />)}</>}</g>
}
function Shard({ x, y, scale = 1, angle = 0 }: { x: number; y: number; scale?: number; angle?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}><path d="M0-12 13-4 8 13-9 8-12-5ZM0-12 2 2 13-4M2 2 8 13M2 2-9 8-12-5Z" fill="currentColor" fillOpacity=".085" /></g>
}
function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M-5 35-2 6-14-9-21-32M2 7 13-10 19-30M-2 1-6-23 2-47M-14-9-28-17M13-10 27-16M-2-5 9-26M-5 35-19 43M-5 35 12 41M-3 29 22 34" /><path d="M-5 29Q9 16 0 7T-9-16M-7 17Q10 9 9-8" opacity=".45" /></g>
}

function Backstreet() {
  return <Scene id="drmvyz.cinema2.backstreet">
    <g transform="rotate(-9 125 40)"><Wordmark x={45} y={9} width={170} /></g>
    <g transform="rotate(-9 125 40)" opacity=".5"><Wordmark x={46} y={13} width={170} /><path d="M68 65V70H75M173 59V65H184" /></g>
    <g opacity=".4"><path d="M-20 24H36M-20 48H57M-20 104H71M-20 128H220M19 24V48M3 104V128M40 128V153M95 128V153M150 128V153M205 128V153M193 73H250M202 49V73M229 73V99M195 99H250M0 153H250" /></g>
    <g><path d="M61 18 55 12V-12M183 16 189 8V-12M29 108H44V118H29ZM33 113H40" fill="currentColor" fillOpacity=".085" /></g>
  </Scene>
}
function Conduit() {
  return <Scene id="drmvyz.cinema2.conduit">
    <g><path d="M-15 4H108Q126 4 126 23V29M-15 10H105Q120 10 120 24V29M251 12H196Q181 12 181 28V34M251 18H198Q187 18 187 30V34M252 128H199Q181 128 181 110V92M252 134H197Q175 134 175 111V92M-15 138H103Q125 138 125 115V104M-15 144H105Q131 144 131 115V104" fill="currentColor" fillOpacity=".085" /></g>
    <g transform="rotate(-10 160 55)"><Cloud x={114} y={31} width={91} /></g>
    <g opacity=".5">{[40, 52, 64].map(r => <circle key={r} cx="166" cy="57" r={r} />)}<path d="M19-10 45 30M228-10 199 23M18 152 47 112M228 152 205 113" /></g>
    <g>{[20, 35, 50, 65, 80].map(x => <path key={x} d={`M${x} 0v14M${x} 133v16M${270 - x} 9v14M${270 - x} 123v16`} opacity=".55" />)}<path d="M32 113H43V124H32Z" fill="currentColor" fillOpacity=".09" /></g>
  </Scene>
}
function Echoform() {
  return <Scene id="drmvyz.cinema2.echoform">
    <g transform="translate(113 -13) rotate(9 50 50) scale(.135)">{bulldogPaths.map(({ id, d }) => <path key={id} d={d} fill="currentColor" fillOpacity=".085" />)}</g>
    <g opacity=".4" transform="translate(119 -9) rotate(9 50 50) scale(.135)">{bulldogPaths.slice(0, 7).map(({ id, d }) => <path key={id} d={d} />)}</g>
    <g opacity=".45"><path d="M136 24 158 10 179 23 163 39ZM163 39 185 45 178 62 155 58ZM155 58 144 76 172 87 178 62M136 24 128 48 155 58M185 45 204 34 208 60 188 75 178 62" /></g>
    <g opacity=".65">{Array.from({ length: 22 }, (_, i) => <circle key={i} cx={25 + i * 9} cy={i % 2 ? 124 + i % 7 : 6 + i % 5 * 3} r={i % 3 ? '.65' : '1.5'} />)}<path d="M42 107 50 112 46 122 35 119Z" fill="currentColor" fillOpacity=".085" /></g>
  </Scene>
}
function Echowave() {
  return <Scene id="drmvyz.cinema2.echowave">
    <g transform="rotate(-11 145 34)"><Wordmark x={73} y={6} width={157} /></g>
    <g opacity=".45" transform="rotate(-11 145 34)"><Wordmark x={77} y={12} width={157} /><Wordmark x={81} y={18} width={157} /></g>
    <g opacity=".6"><path d="M90 14 109 30 101 43 120 50 139 37 153 47 169 31 185 39 201 24M109 30 120 50 126 21 139 37M153 47 159 18 169 31M185 39 191 11 201 24M28 117 43 105 57 118 42 135Z" fill="currentColor" fillOpacity=".085" /></g>
    <g><path d="M165 110 170 123 184 127 170 132 165 146 160 132 146 127 160 123Z" fill="currentColor" fillOpacity=".12" /><path d="M27 11H59M44 3V19M26 125H58M42 109V141" opacity=".35" /></g>
  </Scene>
}
function ElectricStorm() {
  return <Scene id="drmvyz.cinema2.electric-storm">
    <g><path d="M251-12 208 4 214 13 184 29 194 38 158 49 171 58 140 63 154 70 130 74M184 29 201 28 195 42 220 55 211 68 237 89 228 103 255 131" /><path d="M248-9 211 6 217 14 188 30 197 39 162 50" opacity=".45" /></g>
    <g opacity=".65"><path d="M194 38 220 33 234 41 251 39M211 68 188 73 200 84 176 93 191 107 181 119 205 142M154 70 150 94 162 102M208 4 187 1 178-13" /></g>
    <g opacity=".6"><path d="M-16 5 4 24-1 33 19 47 12 58 35 65 27 79 45 98 38 119 52 144" /></g>
    <g opacity=".4"><path d="M-16 16Q20-2 61 15T134 12M-15 139Q42 113 79 137T168 133M188-8Q219 2 255-12" fill="currentColor" fillOpacity=".085" /></g>
  </Scene>
}
function Elevhate() {
  return <Scene id="drmvyz.cinema2.elevhate">
    <g><path d="M107-22H142V175H107ZM149-22H184V175H149ZM110-22V175M139-22V175M152-22V175M181-22V175" fill="currentColor" fillOpacity=".085" /></g>
    <g>{[-7, 28, 113, 148].map(y => <path key={y} d={`M-20 ${y}H250V${y + 10}H-20ZM-20 ${y + 3}H250`} fill="currentColor" fillOpacity=".085" />)}</g>
    <g opacity=".65"><path d="M99-20V39H40M192-20V45H250M99 176V103H23M192 176V105H250M42 18H92V-20M205 126H250M35 137H92V176" /></g>
    <g opacity=".5"><path d="M-12 17 65 36H104M185 36H212L252 17M-12 140 65 120H104M185 120H212L252 140M22 9V28M34 129V151" /></g>
  </Scene>
}
function EventHorizon() {
  return <Scene id="drmvyz.cinema2.event-horizon">
    <g transform="rotate(-18 158 47)"><ellipse cx="158" cy="47" rx="37" ry="30" fill="currentColor" fillOpacity=".085" /><ellipse cx="158" cy="47" rx="29" ry="24" /><path d="M122 37Q158-6 194 38M122 55Q158 99 194 55" opacity=".55" /></g>
    <g transform="rotate(-18 158 47)">{[0, 5, 11].map(n => <ellipse key={n} cx="158" cy="47" rx={84 + n} ry={13 + n * .45} opacity={.9 - n * .04} />)}<path d="M79 45Q128 32 135 43M181 51Q213 61 239 51" /></g>
    <g>{[[34, 115, .7], [203, 116, .55], [84, 7, .5]].map(([x, y, scale]) => <Shard key={x} x={x} y={y} scale={scale} angle={x} />)}</g>
    <g opacity=".5"><path d="M157 17 162-24M166 18 179-24M150 76 129 155M158 78 143 155" /><path d="M143 12 172 17 168 28Z" fill="currentColor" fillOpacity=".09" /></g>
  </Scene>
}
function Glassfall() {
  const tiles = [{ x: 85, y: 43, r: 30 }, { x: 145, y: 39, r: 34 }, { x: 204, y: 49, r: 30 }, { x: 170, y: 111, r: 32 }, { x: 227, y: 104, r: 31 }]
  return <Scene id="drmvyz.cinema2.glassfall">
    <g>{tiles.map(({ x, y, r }, i) => <g key={i} transform={`translate(${x} ${y}) rotate(${i % 2 ? 180 : 0})`}><path d={`M0 ${-r} ${r * .87} ${r * .5} ${-r * .87} ${r * .5}Z`} fill="currentColor" fillOpacity=".085" /><path d={`M0 ${-r} 0 0 ${r * .87} ${r * .5}M0 0 ${-r * .87} ${r * .5}`} opacity=".5" /></g>)}</g>
    <g opacity=".45"><path d="M58-18 243-5 257 58 78 45ZM143 83 256 79 263 156 158 149ZM-12 120 54 103 67 154-9 164Z" fill="currentColor" fillOpacity=".085" /></g>
    <g>{tiles.map(({ x, y, r }, i) => <path key={i} transform={`translate(${x} ${y}) rotate(${i % 2 ? 180 : 0})`} d={`M0 ${-r + 4} ${r * .87 - 4} ${r * .5 - 3}H${-r * .87 + 4}Z`} opacity=".6" />)}</g>
    <g transform="translate(43 119) rotate(-20)"><path d="M0-20 19 13H-19ZM0-20 5-24 24 9 19 13M5-24-14 9-19 13" fill="currentColor" fillOpacity=".085" /></g>
  </Scene>
}
function GoTo() {
  return <Scene id="drmvyz.cinema2.go-to">
    <g transform="rotate(-12 165 40)"><Cloud x={116} y={-9} width={98} /></g>
    <g opacity=".5" transform="rotate(-12 165 40)"><Cloud x={113} y={-12} width={104} /></g>
    <g><ellipse cx="160" cy="127" rx="68" ry="15" fill="currentColor" fillOpacity=".085" /><path d="M92 127V134Q160 162 228 134V127M97 130Q160 151 222 130" /><ellipse cx="160" cy="127" rx="53" ry="10" opacity=".5" /></g>
    <g opacity=".45"><path d="M24-12 40-6 96 141 69 137ZM234-12 218-6 197 138 224 133Z" fill="currentColor" fillOpacity=".085" /><path d="M24 20 33 38M32 45 41 63" strokeDasharray="3 5" /></g>
  </Scene>
}
function HumN() {
  return <Scene id="drmvyz.cinema2.hum-n">
    <g><path d="M151-11 171-5 182 13 179 39 169 53 151 49 140 34 138 11ZM151-11 155 11 138 11M155 11 171-5 182 13 162 24ZM162 24 179 39 169 53 153 32 140 34M155 11 162 24 153 32 151 49" fill="currentColor" fillOpacity=".085" /></g>
    <g><path d="M150 49 143 60 122 67 112 105 106 160H204L200 103 185 64 170 54 169 48M143 60 158 72 185 64M158 72 141 107 121 72M158 72 179 104 200 103M141 107 158 144 179 104M112 105 141 107 106 160M158 144 204 160M143 60 170 54" fill="currentColor" fillOpacity=".085" /></g>
    <g opacity=".55"><path d="M144 16 154 19 159 14 174 18M154 19 153 28 163 30M148 39 165 42M141 107 125 127 158 144 179 104 188 127 204 160M158 72 166 91 179 104M155 11 151-11" /></g>
    <g opacity=".6"><Shard x={40} y={119} scale={.8} angle={-23} /><Shard x={44} y={20} scale={.6} angle={31} /><path d="M24 115 30 99M38 140 43 133" strokeDasharray="2 4" /></g>
  </Scene>
}
function Hypnotize() {
  return <Scene id="drmvyz.cinema2.hypnotize">
    <g>{Array.from({ length: 18 }, (_, i) => <path key={i} transform={`rotate(${i * 20} 163 32)`} d="M163-13Q190-5 183 20L173 23Q178 5 163-5Z" fill="currentColor" fillOpacity=".085" />)}</g>
    <g>{[13, 19, 27, 49, 55].map(r => <ellipse key={r} cx="163" cy="32" rx={r} ry={r * .85} />)}</g>
    <g opacity=".65"><path d="M211 14Q240 48 217 80T218 153M216 11Q247 48 223 80T224 153M24-13Q58 20 30 54M29-13Q64 20 35 54" /><path d="M216 72 225 72M216 95 224 95M217 120 223 120" /></g>
    <g>{[[40, 120, 13], [216, 111, 12], [88, 1, 10]].map(([x, y, r]) => <g key={x}><circle cx={x} cy={y} r={r} fill="currentColor" fillOpacity=".085" /><circle cx={x} cy={y} r={r - 4} /><path d={`M${x - r - 3} ${y}h6M${x} ${y - r - 3}v6`} /></g>)}</g>
  </Scene>
}
function Ifrit() {
  return <Scene id="drmvyz.cinema2.ifrit">
    <g>{[68, 52, 39, 29, 20].map(r => <Hex key={r} x={171} y={42} r={r} depth={5} />)}</g>
    <g opacity=".5"><path d="M112-22 171 42 246-12M235 149 171 42 151 159M6-13 66 39M13-20 73 32M17 142 57 117 67 125M22 151 60 127 72 134" /></g>
    <g>{Array.from({ length: 6 }, (_, i) => <path key={i} transform={`rotate(${i * 60} 171 42)`} d="M162-17H180M165-2H177M168 11H174" />)}</g>
    <g><path d="M169 25 177 33 174 42 181 52 169 60 173 49 165 41 172 34Z" fill="currentColor" fillOpacity=".085" /></g>
  </Scene>
}
function Inertia() {
  return <Scene id="drmvyz.cinema2.inertia">
    <g>{Array.from({ length: 7 }, (_, i) => <ellipse key={i} cx="157" cy="36" rx={25 * Math.sin((i + 1) / 8 * Math.PI)} ry="25" transform={`rotate(${i * 25} 157 36)`} strokeDasharray="1 3" />)}</g>
    <g transform="rotate(13 157 36)"><path d="M111-22 199-13 217 77 123 91ZM111-22 91 9 104 109 123 91M199-13 184 14 104 109M184 14 217 77M91 9 184 14" fill="currentColor" fillOpacity=".085" />{[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${113 + i * 18} ${-22 + i * 2}l12 111M${113 + i * 2} ${i * 22}l92-13`} opacity=".5" />)}</g>
    <g><path d="M91 9 82 16 93 116 104 109M104 109 123 91 217 77 223 84M20 126 43 110 58 126 35 144Z" fill="currentColor" fillOpacity=".085" /></g>
    <g opacity=".6">{[[111, -22], [199, -13], [217, 77], [104, 109], [35, 144], [20, 126]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2" />)}</g>
  </Scene>
}
function Mainframe() {
  return <Scene id="drmvyz.cinema2.mainframe">
    <g transform="rotate(9 159 30)"><Cloud x={111} y={-7} width={99} /></g>
    <g>{Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${119 + i * 15} 40v${65 - i * 5}l${i % 2 ? 14 : -14} 14v48M${119 + i * 15} 2v-25M${108 - i * 3} ${9 + i * 6}H${67 - i * 6}l-18-18H-20M${204 + i * 2} ${16 + i * 7}h22l18-18h20`} />)}</g>
    <g><path d="M22 109H56V136H22ZM26 113H52V132H26ZM191 111H223V141H191Z" fill="currentColor" fillOpacity=".085" />{Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${25 + i * 6} 104v5M${25 + i * 6} 136v5M${195 + i * 6} 107v4M${195 + i * 6} 141v5`} />)}</g>
    <g>{[[80, 20], [226, 42], [66, 140]].map(([x, y]) => <g key={x}><circle cx={x} cy={y} r="10" /><circle cx={x} cy={y} r="6" fill="currentColor" fillOpacity=".085" /><path d={`M${x} ${y}l7-7`} /></g>)}</g>
  </Scene>
}
function Marquee() {
  return <Scene id="drmvyz.cinema2.marquee">
    <g><path d="M85 18 164-6 233 23 167 52ZM85 18V33L167 67 233 39V23M85 33 167 56 233 30M93 36 167 61 227 36" fill="currentColor" fillOpacity=".085" /></g>
    <g><path d="M89 19 165 42 229 22M89 19V31L165 56 229 34V22M165 42V56M99 25 155 43M177 43 218 29" />{Array.from({ length: 12 }, (_, i) => <circle key={i} cx={95 + i * 10} cy={36 + Math.min(i, 7) * 3 - Math.max(0, i - 7) * 6} r="1" />)}</g>
    <g>{[106, 205].map(x => <g key={x}><path d={`M${x}-20h18V148h-18ZM${x + 4}-20V148M${x + 14}-20V148`} fill="currentColor" fillOpacity=".085" /><path d={`M${x + 9}-15V148`} strokeDasharray="2 5" /></g>)}<path d="M125 4 134-19 154 4M142 1 148-28 166-2" /></g>
    <g opacity=".4"><path d="M17 145 159 103 242 147M47 153 159 113 217 154M31 132H231M112 126 105 149M199 126 209 151M31 121V135M28 121H34" /></g>
  </Scene>
}
function Nightshift() {
  return <Scene id="drmvyz.cinema2.nightshift">
    <g><circle cx="157" cy="22" r="33" fill="currentColor" fillOpacity=".085" />{[-22, -11, 0, 11, 22].map(n => <g key={n}><ellipse cx="157" cy="22" rx={Math.sqrt(33 ** 2 - n ** 2)} ry="5" transform={`translate(0 ${n})`} /><ellipse cx="157" cy="22" rx="5" ry="33" transform={`translate(${n} 0)`} /></g>)}<path d="M157-11V-30" /></g>
    <g><path d="M-16 150 136 102 253 150Z" fill="currentColor" fillOpacity=".085" />{[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${-16 + i * 55} 150 136 102M${-16 + i * 24} ${150 - i * 9}H${253 - i * 22}`} />)}</g>
    <g><path d="M-18-9 60 22H230L253-9M-18-3 60 28H230L253-3M64 22V-15M224 22V-15" /></g>
    <g opacity=".45"><path d="M126 33 35 133M181 41 222 147M181 10 250-9M130 2 20-9M28 115l4 6 8-1-5 5 2 7-7-3-6 4 1-8-6-4Z" fill="currentColor" fillOpacity=".085" /></g>
  </Scene>
}
function Mushroom({ x, y, size, angle = 0 }: { x: number; y: number; size: number; angle?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}><path d="M-24 0Q-17-31 0-30Q17-29 24 0Q0 12-24 0ZM-6 7Q-3 24-8 45Q1 51 8 45Q3 22 5 7" fill="currentColor" fillOpacity=".085" /><path d="M-24 0Q0-8 24 0M0 7V0M-16 4-10-2M16 4 10-2M-8-19-5-16M7-10 10-9M3-25 5-22" opacity=".65" /></g>
}
function Psylo() {
  return <Scene id="drmvyz.cinema2.psylo">
    <g><Mushroom x={168} y={10} size={1.45} angle={12} /><Mushroom x={214} y={91} size={1.1} angle={-13} /></g>
    <g><Mushroom x={53} y={117} size={.7} angle={-18} /><path d="M174 25Q190 45 176 75M157 12 172 10 185 16M200 92Q219 87 236 100" /></g>
    <g opacity=".65">{[[39, 20], [87, 17], [123, 7], [107, 133], [150, 127]].map(([x, y]) => <Mushroom key={x} x={x} y={y} size={.28} angle={x / 4} />)}</g>
    <g opacity=".5"><path d="M-10 155 50 136 96 147 151 132 222 149M52 137 32 148M52 137 80 151M150 132 125 151" />{Array.from({ length: 18 }, (_, i) => <circle key={i} cx={15 + i * 13} cy={i % 2 ? 47 + i % 5 * 10 : 111 + i % 7 * 3} r=".7" />)}</g>
  </Scene>
}
function Reactor() {
  return <Scene id="drmvyz.cinema2.reactor">
    <g><circle cx="161" cy="34" r="26" fill="currentColor" fillOpacity=".12" /><path d="M161 8 180 16 185 39 170 59 148 52 136 33 145 16ZM161 8 156 28 180 16M156 28 170 59 185 39M156 28 136 33 148 52" /></g>
    <g>{Array.from({ length: 12 }, (_, i) => <path key={i} transform={`rotate(${i * 30} 161 34)`} d="M158 5 156-22 165-22 164 5M159-9H163" fill="currentColor" fillOpacity=".085" />)}</g>
    <g>{[[41, 113, .8, 40], [215, 99, .6, 17], [83, 1, .5, 65], [198, 133, .45, -20]].map(([x, y, scale, angle]) => <Shard key={x} x={x} y={y} scale={scale} angle={angle} />)}</g>
    <g transform="rotate(-17 161 34)" opacity=".65"><ellipse cx="161" cy="34" rx="77" ry="42" /><ellipse cx="161" cy="34" rx="83" ry="46" /><path d="M35 110Q44 99 55 104M31 115Q45 97 60 107" /></g>
  </Scene>
}
function Reliquary() {
  return <Scene id="drmvyz.cinema2.reliquary">
    <g transform="rotate(-9 164 34)"><Cloud x={114} y={-7} width={101} /><path d="M131 9 158 25 148 46 185 51M158 25 179 4 199 26 185 51M148 46 168 54 158 25" opacity=".6" /></g>
    <g><Tree x={165} y={104} scale={1.15} /><path d="M161 129 132 147M164 128 181 151M168 127 211 139M158 127 107 140" /></g>
    <g opacity=".65"><Tree x={35} y={100} scale={1.5} /><Tree x={224} y={104} scale={1.7} /></g>
    <g opacity=".4"><path d="M67-24 75-22 146 64 135 66ZM217-24 224-22 187 65 175 63Z" fill="currentColor" fillOpacity=".085" /><path d="M73-20H215M79-20V-8M105-20V-8M132-20V-8M159-20V-8M186-20V-8M213-20V-8" /></g>
  </Scene>
}
function SayIt() {
  return <Scene id="drmvyz.cinema2.say-it">
    <g transform="translate(115 -5) rotate(12)"><path d="M0 0H28V10H10V20H28V50H0V40H18V30H0ZM37 50 49 0H61L73 50H62L59 37H49L46 50ZM51 27H57L54 12ZM82 0H93V19L102 0H114L93 32V50H82V32L69 0H80L87 18" fill="currentColor" fillOpacity=".085" /></g>
    <g transform="translate(115 -5) rotate(12)" opacity=".6"><path d="M0 0 6-6H34L28 0M28 10 34 4V24L28 30M28 50 34 44V24M61 0 67-6 79 44 73 50M93 0 99-6H88L82 0" /></g>
    <g transform="translate(39 111) rotate(-24)"><path d="M0-20H11V20H0ZM24-20H59V-9H47V20H36V-9H24Z" fill="currentColor" fillOpacity=".085" /><path d="M11-20 16-25V15L11 20M24-20 29-25H64L59-20M47-9 52-14V15L47 20" opacity=".55" /></g>
    <g opacity=".35"><path d="M100-20H238V58M22 99H76V147M25 104H30M25 143H30M221 67V76M217 72H226" strokeDasharray="3 5" /></g>
  </Scene>
}
function Sixfold() {
  const cells = [[161, 24, 30], [212, -6, 30], [212, 54, 30], [161, 84, 30], [110, -6, 30], [110, 54, 30], [161, -36, 30]]
  return <Scene id="drmvyz.cinema2.sixfold">
    <g>{cells.map(([x, y, r]) => <Hex key={`${x}:${y}`} x={x} y={y} r={r} depth={3} />)}</g>
    <g>{cells.map(([x, y, r]) => <Hex key={`${x}:${y}`} x={x} y={y} r={r - 6} />)}</g>
    <g>{Array.from({ length: 12 }, (_, i) => <path key={i} transform={`rotate(${i * 30} 161 24)`} d="M160 7 170 12 166 22 160 19Z" fill="currentColor" fillOpacity=".12" />)}</g>
    <g><Hex x={38} y={121} r={17} depth={3} /><path d="M35 103H41V110H35ZM24 126 20 130M54 126 58 130M204 85 213 91 208 99 199 93Z" fill="currentColor" fillOpacity=".085" /></g>
  </Scene>
}
function CaptureBall({ x, y, r }: { x: number; y: number; r: number }) {
  return <g><circle cx={x} cy={y} r={r} fill="currentColor" fillOpacity=".085" /><path d={`M${x - r} ${y}Q${x} ${y + r * .6} ${x + r} ${y}M${x - r} ${y - 3}Q${x} ${y + r * .6 - 3} ${x + r} ${y - 3}`} /><circle cx={x} cy={y + 2} r={r / 5} /><path d={`M${x - r / 2} ${y - r / 2}q4-5 9-4`} opacity=".5" /></g>
}
function Starters() {
  return <Scene id="drmvyz.cinema2.starters">
    <g transform="rotate(8 161 45)"><path d="M98 13 179-6 224 16 143 37ZM98 13V59L143 84 224 61V16M143 37V84M99 26 143 51 224 30M104 55 142 76 218 55" fill="currentColor" fillOpacity=".085" /><path d="M128 7V0L163-8 177-2V4M133 6V2L163-4 170-1V3" /></g>
    <g><CaptureBall x={55} y={100} r={17} /><CaptureBall x={128} y={108} r={16} /><CaptureBall x={174} y={100} r={14} /></g>
    <g><path d="M118 36 125 40V49L118 45ZM179 36 187 34V44L179 46ZM152 50 158 48V58L152 60Z" fill="currentColor" fillOpacity=".085" /></g>
    <g opacity=".5"><path d="M-10 152 65 136 125 145 205 124 251 145M9 150l3-9 4 7M78 140l3-8 4 7M224 139l2-10 6 11M93 5l3-9 4 8" /></g>
  </Scene>
}
function SwitchIt() {
  return <Scene id="drmvyz.cinema2.switch-it">
    <g><path d="M139 5Q123 1 126-20Q94-10 113 23L137 35M180 7Q197 1 191-21Q222-10 207 21L184 37M128-15 118-8 116 2 123 14 136 21M191-15 202-7 204 3 197 15 185 22" fill="currentColor" fillOpacity=".085" /></g>
    <g><path d="M139-6 158-13 178-4 188 18 182 40 170 56 147 54 133 39 130 17ZM139-6 147 13 130 17M147 13 158-13 169 12 178-4M147 13 158 27 169 12 188 18M133 39 147 32 147 54M147 32 170 56 177 32 182 40M158 27 177 32 169 12M147 23 138 20 140 29 149 29M167 25 178 19 176 28 167 31M155 32 151 40 163 40ZM149 47H169M155 43V52M161 44V52" fill="currentColor" fillOpacity=".085" /></g>
    <g><path d="M148 54V66L123 80 109 129 205 145 197 83 171 67V55M148 66 162 84 171 67M123 80 162 84 143 112 109 129M162 84 182 110 205 145M143 112 162 136 182 110" fill="currentColor" fillOpacity=".085" /></g>
    <g opacity=".6"><Shard x={36} y={119} scale={.8} angle={30} /><Shard x={52} y={15} scale={.6} angle={-21} /><path d="M28 139 44 144M40 98 49 91" strokeDasharray="3 4" /></g>
  </Scene>
}
function Threshold() {
  return <Scene id="drmvyz.cinema2.threshold">
    <g>{[[-3, 1, 16, 160], [115, -22, 24, 176], [165, -17, 29, 177]].map(([x, y, w, h]) => <g key={x}><path d={`M${x} ${y}h${w}v${h}h-${w}ZM${x + w} ${y}l7-5v${h}l-7 5M${x + 3} ${y}v${h}`} fill="currentColor" fillOpacity=".085" /></g>)}</g>
    <g opacity=".65">{[31, 55, 79, 103].map((x, i) => <path key={x} d={`M${x}-16v${48 - i * 6}h8v-${48 - i * 6}M${x}-16l4-4h8v${48 - i * 6}l-4 4`} fill="currentColor" fillOpacity=".085" />)}</g>
    <g opacity=".35"><path d="M-15 153 135 94 251 153M38 156 135 94 219 156M74 157 135 94 184 157M21 134H233M68 115H196" /></g>
    <g opacity=".45"><path d="M129 151 127 166M153 151 158 166M193 150 190 166M218 149 228 166M25 130l4-8 2 8" /></g>
  </Scene>
}
function TrippyBro() {
  return <Scene id="drmvyz.cinema2.trippy-bro">
    <g>{Array.from({ length: 13 }, (_, i) => <path key={i} transform={`rotate(${i * 12 - 72} 170 34)`} d="M170 34 173-28 182-25Z" fill="currentColor" fillOpacity=".085" />)}</g>
    <g opacity=".65">{Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${70 + i * 20}-16l95 70M${102 + i * 20}-16l-72 70`} />)}</g>
    <g transform="rotate(-15 204 111)"><ellipse cx="204" cy="111" rx="33" ry="23" fill="currentColor" fillOpacity=".085" />{[-12, -6, 0, 6, 12].map(n => <path key={n} d={`M173 ${111 + n}Q204 ${80 + n} 235 ${111 + n}M${204 + n} 89Q${177 + n} 111 ${204 + n} 134`} opacity=".6" />)}</g>
    <g opacity=".6"><path d="M-16-12Q82 5 42 48M-16-6Q88 11 48 54M18 151Q28 112 64 113M24 153Q34 118 70 119M36 121 45 107 57 119 45 135Z" fill="currentColor" fillOpacity=".085" /></g>
  </Scene>
}
function Crt({ x, y, size = 1, angle = 0 }: { x: number; y: number; size?: number; angle?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}><path d="M-17-12H17V12H-17ZM17-12 22-16H-12L-17-12M17-12 22-16V8L17 12" fill="currentColor" fillOpacity=".085" /><path d="M-12-8Q0-10 10-8Q13 0 10 8Q0 10-12 8Q-14 0-12-8ZM13-5H15M13 0H15M13 5H15" /><path d="M-10-3H8M-11 1H10M-8 5H7" opacity=".35" /></g>
}
function Vacancy() {
  return <Scene id="drmvyz.cinema2.vacancy">
    <g><Crt x={165} y={5} size={1.05} angle={-5} /><Crt x={142} y={36} size={1.05} angle={3} /><Crt x={187} y={36} size={1.1} angle={-3} /><Crt x={124} y={67} size={1.05} angle={-4} /><Crt x={166} y={68} size={1.05} angle={3} /><Crt x={208} y={69} size={1.05} angle={7} /><Crt x={140} y={107} size={1.05} angle={1} /><Crt x={185} y={109} size={1.05} angle={-4} /></g>
    <g opacity=".6"><Crt x={44} y={123} size={.8} angle={-13} /><path d="M131-8 139-18M140-8 153-20M137-8V-1" /></g>
    <g opacity=".6"><path d="M117 124H212V134H117ZM120 128H209M123 134V141M205 134V141" fill="currentColor" fillOpacity=".085" /></g>
    <g opacity=".35"><path d="M-10 153 112 118 253 153M-10 10H69M-10 37H79M-10 64H52M14 10V37M43 37V64M0 146H234M44 136H216" /></g>
  </Scene>
}
function Tripod({ x, y, size = 1, angle = 0 }: { x: number; y: number; size?: number; angle?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}><path d="M-20 0Q-17-16 0-17Q17-16 20 0L10 8H-10ZM-20 0Q0-6 20 0M-12-6 0-12 12-6M-8 7-19 28-30 55M0 8 7 29 2 62M10 8 23 27 37 45M-19 28-14 31M7 29 12 30M23 27 28 27" fill="currentColor" fillOpacity=".085" /></g>
}
function WarOfWorlds() {
  return <Scene id="drmvyz.cinema2.war-of-worlds">
    <g><Tripod x={135} y={58} size={1.5} angle={9} /><Tripod x={45} y={47} size={.65} angle={-14} /></g>
    <g opacity=".65"><path d="M152 27 123 49 108 97M180 25 214 53 231 106M53 37 24 66 18 91" /></g>
    <g>{Array.from({ length: 7 }, (_, i) => <g key={i} transform={`translate(${i * 32 - 12} ${132 + i % 3 * 4})`}><path d="M0 0V-18L13-24 25-17V6L12 13 0 6ZM0-18 12-11 25-17M12-11V13" fill="currentColor" fillOpacity=".085" /><path d="M4-12V3M9-8V6M16-7V7M21-10V4" opacity=".4" /></g>)}</g>
    <g opacity=".5"><path d="M163 25 172 25 113 151 89 144ZM48 37 53 37 31 109 20 105Z" fill="currentColor" fillOpacity=".085" /></g>
  </Scene>
}

export const ADDITIONAL_BLUEPRINT_DRAWINGS = {
  'drmvyz.cinema2.backstreet': Backstreet, 'drmvyz.cinema2.conduit': Conduit,
  'drmvyz.cinema2.echoform': Echoform, 'drmvyz.cinema2.echowave': Echowave,
  'drmvyz.cinema2.electric-storm': ElectricStorm, 'drmvyz.cinema2.elevhate': Elevhate,
  'drmvyz.cinema2.event-horizon': EventHorizon, 'drmvyz.cinema2.glassfall': Glassfall,
  'drmvyz.cinema2.go-to': GoTo, 'drmvyz.cinema2.hum-n': HumN,
  'drmvyz.cinema2.hypnotize': Hypnotize, 'drmvyz.cinema2.ifrit': Ifrit,
  'drmvyz.cinema2.inertia': Inertia, 'drmvyz.cinema2.mainframe': Mainframe,
  'drmvyz.cinema2.marquee': Marquee, 'drmvyz.cinema2.nightshift': Nightshift,
  'drmvyz.cinema2.psylo': Psylo, 'drmvyz.cinema2.reactor': Reactor,
  'drmvyz.cinema2.reliquary': Reliquary, 'drmvyz.cinema2.say-it': SayIt,
  'drmvyz.cinema2.sixfold': Sixfold, 'drmvyz.cinema2.starters': Starters,
  'drmvyz.cinema2.switch-it': SwitchIt, 'drmvyz.cinema2.threshold': Threshold,
  'drmvyz.cinema2.trippy-bro': TrippyBro, 'drmvyz.cinema2.vacancy': Vacancy,
  'drmvyz.cinema2.war-of-worlds': WarOfWorlds,
} satisfies Record<SceneId, () => JSX.Element>

/** Small, distinct camera poses preserve hand-placed open title volumes. */
export const ADDITIONAL_BLUEPRINT_FRAMING = {
  'drmvyz.cinema2.backstreet': 'translate(115 79) rotate(-5) scale(1.01) translate(-120 -75)',
  'drmvyz.cinema2.conduit': 'translate(113 80) rotate(-7) scale(1.02) translate(-120 -75)',
  'drmvyz.cinema2.echoform': 'translate(112 83) rotate(-6) scale(1.03) translate(-120 -75)',
  'drmvyz.cinema2.echowave': 'translate(110 84) rotate(-8) scale(1.02) translate(-120 -75)',
  'drmvyz.cinema2.electric-storm': 'translate(114 80) rotate(-9) scale(1.01) translate(-120 -75)',
  'drmvyz.cinema2.elevhate': 'translate(113 80) rotate(-5) scale(1.04) translate(-120 -75)',
  'drmvyz.cinema2.event-horizon': 'translate(112 82) rotate(-4) scale(1.03) translate(-120 -75)',
  'drmvyz.cinema2.glassfall': 'translate(114 81) rotate(-7) scale(1.02) translate(-120 -75)',
  'drmvyz.cinema2.go-to': 'translate(112 78) rotate(-6) scale(1.04) translate(-120 -75)',
  'drmvyz.cinema2.hum-n': 'translate(109 82) rotate(-5) scale(1.02) translate(-120 -75)',
  'drmvyz.cinema2.hypnotize': 'translate(113 79) rotate(-7) scale(1.01) translate(-120 -75)',
  'drmvyz.cinema2.ifrit': 'translate(112 84) rotate(-8) scale(1.03) translate(-120 -75)',
  'drmvyz.cinema2.inertia': 'translate(111 81) rotate(-9) scale(1.01) translate(-120 -75)',
  'drmvyz.cinema2.mainframe': 'translate(113 83) rotate(-5) scale(1.03) translate(-120 -75)',
  'drmvyz.cinema2.marquee': 'translate(112 82) rotate(-8) scale(1.01) translate(-120 -75)',
  'drmvyz.cinema2.nightshift': 'translate(114 80) rotate(-6) scale(1.02) translate(-120 -75)',
  'drmvyz.cinema2.psylo': 'translate(111 82) rotate(-7) scale(1.04) translate(-120 -75)',
  'drmvyz.cinema2.reactor': 'translate(113 81) rotate(-8) scale(1.03) translate(-120 -75)',
  'drmvyz.cinema2.reliquary': 'translate(111 80) rotate(-5) scale(1.01) translate(-120 -75)',
  'drmvyz.cinema2.say-it': 'translate(111 79) rotate(-7) scale(1.02) translate(-120 -75)',
  'drmvyz.cinema2.sixfold': 'translate(112 81) rotate(-6) scale(1.04) translate(-120 -75)',
  'drmvyz.cinema2.starters': 'translate(110 83) rotate(-7) scale(1.01) translate(-120 -75)',
  'drmvyz.cinema2.switch-it': 'translate(110 80) rotate(-4) scale(1.02) translate(-120 -75)',
  'drmvyz.cinema2.threshold': 'translate(113 82) rotate(-6) scale(1.01) translate(-120 -75)',
  'drmvyz.cinema2.trippy-bro': 'translate(111 81) rotate(-5) scale(1.03) translate(-120 -75)',
  'drmvyz.cinema2.vacancy': 'translate(112 80) rotate(-7) scale(1.04) translate(-120 -75)',
  'drmvyz.cinema2.war-of-worlds': 'translate(113 82) rotate(-8) scale(1.01) translate(-120 -75)',
} satisfies Record<SceneId, string>
