import { ADDITIONAL_BLUEPRINT_MOTIFS, ADDITIONAL_BLUEPRINT_DRAWINGS, ADDITIONAL_BLUEPRINT_FRAMING } from './Cinema2PresetBlueprintScenes'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { PRESET_BLUEPRINT_STROKE_WIDTH } from './blueprintDrawing'

const useArtworkLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

type FourMotifs = readonly [string, string, string, string]

/** Art direction, not frame recognition: each phrase owns a drawn primary motif. */
export const PRESET_BLUEPRINT_MOTIFS = {
  ...ADDITIONAL_BLUEPRINT_MOTIFS,
  'drmvyz.cinema2.afterhours': ['Fixture banks', 'Crossing laser fans', 'Volumetric beams', 'Stage plane'],
  'drmvyz.cinema2.ancient-machine': ['Layered mechanism', 'Radial locking ribs', 'Oracle aperture', 'Energy sphere'],
  'drmvyz.cinema2.atl-hoe': ['Tiled marquee', 'Raised letterforms', 'Atlanta skyline', 'Roadside foreground'],
  'drmvyz.cinema2.atmosphere-reference': ['Floating crystal', 'Cracked monoliths', 'Spotlight shafts', 'Wet reflections'],
  'drmvyz.cinema2.blockshift': ['Foreground hollow cubes', 'Suspended cube field', 'LED edges', 'Spatial depth'],
  'drmvyz.cinema2.bwc': ['Twin conveyors', 'Cans and creatures', 'Energy reactor', 'Industrial hall'],
  'drmvyz.cinema2.canopy': ['Overhead lattice', 'Suspension cables', 'Waterfall rods', 'Light field'],
  'drmvyz.cinema2.cathedral': ['Pointed arches', 'Gothic ribs', 'Volumetric shafts', 'Nave reflections'],
  'drmvyz.cinema2.constellation': ['Faceted elements', 'Depth clusters', 'Drift trails', 'Spatial volume'],
  'drmvyz.cinema2.depth': ['Square portals', 'Sparse light strips', 'Depth lanes', 'Vanishing-point sphere'],
} as const satisfies Record<string, FourMotifs>

export type AuthoredBlueprintPresetId = keyof typeof PRESET_BLUEPRINT_MOTIFS

export function hasPresetBlueprintArtwork(id: string): id is AuthoredBlueprintPresetId {
  return Object.hasOwn(PRESET_BLUEPRINT_MOTIFS, id)
}

/** Three moving heads: two overhead, one near-left shooting upward. */
function DjLightingFixture({ x, y, angle }: { x: number; y: number; angle: number }) {
  return <g data-art-light-fixture transform={`translate(${x} ${y}) rotate(${angle})`}>
    <path d="M-11-7 5-10 13-4 13 8-3 11-11 5ZM-11-7-3-1 13-4M-3-1V11" fill="currentColor" fillOpacity=".085" />
    <ellipse cx="5" cy="3" rx="4.5" ry="5" />
    <ellipse cx="5" cy="3" rx="2.5" ry="3" opacity=".55" />
    <path d="M-13-1V12L-2 17 15 11V4M-2 17V23M-11 23-2 20 9 23 0 26Z" />
    <path d="M-9-3-5-2M-9 0-5 1" opacity=".55" />
  </g>
}

function Afterhours() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.afterhours']
  return <>
    <g data-art-motif={words[0]} transform="rotate(2 135 44)">
      <DjLightingFixture x={126} y={40} angle={-18} />
      <DjLightingFixture x={166} y={51} angle={37} />
      <DjLightingFixture x={55} y={103} angle={-155} />
    </g>
    <g data-art-motif={words[1]} transform="rotate(2 135 44)">
      {[[-28, 24], [5, 35], [40, 48], [78, 56]].map(([x, y]) => <path key={x} d={`M132 41 ${x} ${y}`} />)}
      {[[151, 151], [173, 148], [199, 145], [224, 126], [246, 96]].map(([x, y]) => <path key={y} d={`M169 56 ${x} ${y}`} />)}
      {[-28, 0, 28, 56, 84].map(x => <path key={x} d={`M49 99 ${x} 20`} />)}
    </g>
    <g data-art-motif={words[2]} transform="rotate(2 135 44)" opacity=".5">
      <path d="M132 41-28 24 40 48ZM169 56 151 151 199 145Z" fill="currentColor" fillOpacity=".09" />
      <path d="M49 99-28 20 28 20Z" fill="currentColor" fillOpacity=".045" />
    </g>
    <g data-art-motif={words[3]} transform="rotate(3 120 133)" opacity=".25">
      <path d="M-10 141 173 119 249 135M0 150 176 129 248 143M62 136H217M115 126H211" strokeDasharray="3 5" />
    </g>
  </>
}

function AncientMachine() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.ancient-machine']
  const cx = 132, cy = 76
  return <>
    {/* A detached locking wheel occupies the near-left plane, below the name. */}
    <g data-art-secondary="locking-wheel" transform="rotate(17 38 112)">
      <path d="M11 112H0M38 139V151M14 101 3 94M21 133 12 143" opacity=".5" />
      {Array.from({ length: 12 }, (_, index) => <path key={index} transform={`rotate(${index * 30} 38 112)`} d="M34 84H42V90L47 92 44 98H32L29 92 34 90Z" fill="currentColor" fillOpacity=".065" />)}
      <circle cx="38" cy="112" r="20" />
      <circle cx="38" cy="112" r="14" opacity=".55" />
      <path d="M24 112H52M38 98V126M28 102 48 122M28 122 48 102" opacity=".4" />
    </g>
    <g data-art-motif={words[0]} transform="translate(14 -62) rotate(-7 132 76)">
      {[28, 39, 51, 64, 78].map((radius, layer) => <g key={radius} opacity={.95 - layer * .1}>
        {Array.from({ length: 16 }, (_, index) => {
          const a = index * Math.PI / 8 + layer * .05
          const point = (r: number, angle: number) => `${cx + Math.cos(angle) * r} ${cy + Math.sin(angle) * r * .88}`
          return <path key={index} d={`M${point(radius, a - .07)}L${point(radius + 7, a - .06)}L${point(radius + 7, a + .06)}L${point(radius, a + .07)}Z`} fill="currentColor" fillOpacity={layer === 2 ? '.12' : '.065'} />
        })}
        <ellipse cx={cx} cy={cy} rx={radius - 2} ry={(radius - 2) * .88} opacity=".25" />
      </g>)}
    </g>
    <g data-art-motif={words[1]} transform="translate(14 -62) rotate(-7 132 76)" opacity=".5">
      {Array.from({ length: 8 }, (_, index) => <g key={index} transform={`rotate(${index * 45} 132 76)`}>
        <path d="M129 1V49M135 1V49M129 12H135M129 26H135M129 40H135" />
        <path d="M125 4H139V12H125Z" fill="currentColor" fillOpacity=".055" />
      </g>)}
    </g>
    <g data-art-motif={words[2]} transform="translate(20 40) rotate(8 132 76)">
      <ellipse cx="132" cy="76" rx="25" ry="22" />
      <ellipse cx="132" cy="76" rx="21" ry="18" opacity=".45" />
      {Array.from({ length: 6 }, (_, index) => <path key={index} transform={`rotate(${index * 60} 132 76)`} d="M130 51H135L137 60 133 64 128 60Z" fill="currentColor" fillOpacity=".08" />)}
    </g>
    <g data-art-motif={words[3]} transform="translate(20 40) rotate(-12 132 76)">
      <circle cx="132" cy="76" r="16" fill="currentColor" fillOpacity=".12" />
      <path d="M132 60 121 65 117 77 123 88 134 92 146 83 148 71 140 62ZM132 60 130 74 121 65M130 74 117 77M130 74 123 88 134 92 139 79 148 71 140 62M130 74 139 79 132 60M123 88 139 79 146 83" opacity=".6" />
      <ellipse cx="132" cy="76" rx="16" ry="6" opacity=".35" />
    </g>
  </>
}

const MARQUEE_GLYPHS: Record<string, string> = {
  W: 'M0 0 1 10 4 5 7 10 8 0', A: 'M0 10 4 0 8 10M2 6H6',
  F: 'M8 0H0V10M0 5H6', L: 'M0 0V10H8', E: 'M8 0H0V10H8M0 5H6',
  H: 'M0 0V10M8 0V10M0 5H8', O: 'M2 0H6L8 2V8L6 10H2L0 8V2Z',
  U: 'M0 0V8L2 10H6L8 8V0', S: 'M8 0H2L0 2V4L8 6V8L6 10H0',
}

function AtlHoe() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.atl-hoe']
  return <>
    <g data-art-motif={words[2]} transform="translate(112 155) rotate(5) scale(1.22 1.18) translate(-146 -145)">
      <g data-art-building="crowned-tower" transform="translate(-2 0) rotate(-3 120 145) translate(0 145) scale(1 1.16) translate(0 -145)">
        <path d="M106 145V62L112 51V39L120 20 128 39V51L134 62V145M112 51H128M115 39H125M120 20V10M106 62 120 68 134 62M120 68V145" fill="currentColor" fillOpacity=".085" />
        <path d="M110 70V137M115 66V139M125 66V139M130 70V137M107 87H133M107 109H133M107 131H133" opacity=".55" />
      </g>
      <g data-art-building="stepped-tower" transform="translate(1 -2) rotate(2.5 152 146) translate(0 146) scale(1 1.2) translate(0 -146)">
        <path d="M140 146V55L146 47H158L164 55V146M152 47V32M140 55 152 60 164 55M152 60V146" fill="currentColor" fillOpacity=".085" />
        <path d="M144 64V139M148 62V139M156 62V139M160 64V139M141 80H163M141 101H163M141 122H163" opacity=".55" />
      </g>
      <g data-art-building="pointed-tower" transform="translate(2 0) rotate(-2 180 147) translate(0 147) scale(1 1.24) translate(0 -147)">
        <path d="M170 147V76L180 61 192 76V147M176 67 180 50 185 67M170 76 180 82 192 76M180 82V147" fill="currentColor" fillOpacity=".085" />
        <path d="M174 84V140M186 84V140M171 97H191M171 117H191M171 137H191" opacity=".55" />
      </g>
    </g>
    <g data-art-motif={words[3]} transform="rotate(-2 133 130)" opacity=".3">
      <path d="M-20 137Q120 124 240 137M-20 145Q125 132 240 145M8 140H32M50 137H77M100 136H127M153 137H180M203 140H231" />
    </g>
    <g data-art-tree transform="translate(15 -10) rotate(-5 49 116)" opacity=".55">
      <path d="M47 141 48 116Q36 121 31 111Q20 114 21 102Q12 95 20 87Q17 74 29 72Q33 61 44 66Q55 57 62 69Q76 67 76 80Q88 86 80 98Q84 111 70 112Q62 122 54 115L57 141" />
      <path d="M51 135V96M51 114 34 99M51 105 66 90M51 122 67 109M42 143H62" />
    </g>
    <AtlHoeSign />
  </>
}

/** Compensate the SVG camera so the sign moves exactly 12 screen pixels,
 * even as thumbnail size changes. The building groups never receive this offset. */
function AtlHoeSign() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.atl-hoe']
  const signPose = 'translate(24 18) rotate(-13 48 28) scale(.75)'
  const offsetRef = useRef<SVGGElement>(null)
  useArtworkLayoutEffect(() => {
    const group = offsetRef.current
    const svg = group?.ownerSVGElement
    if (!group || !svg) return
    const updateOffset = () => {
      const matrix = group.getScreenCTM()?.inverse()
      if (matrix) group.setAttribute('transform', `translate(${-12 * matrix.a} ${-12 * matrix.b})`)
    }
    updateOffset()
    const observer = new ResizeObserver(updateOffset)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])
  return <g ref={offsetRef} data-art-sign-offset>
    <g data-art-motif={words[0]} transform={signPose}>
      <path d="M0 0H132V30H0ZM11 35H121V65H11Z" fill="currentColor" fillOpacity=".12" />
      <path d="M0 0 6-5H138L132 0M132 0 138-5V25L132 30M11 35 17 30H127L121 35M121 35 127 30V60L121 65M87 65V145M95 65V145M84 145H98" opacity=".6" />
      {Array.from({ length: 5 }, (_, index) => <path key={index} d={`M${22 + index * 22} 0V30`} opacity=".55" />)}
      {Array.from({ length: 4 }, (_, index) => <path key={index} d={`M${33 + index * 22} 35V65`} opacity=".55" />)}
    </g>
    <g data-art-motif={words[1]} transform={signPose}>
      {'WAFFLE'.split('').map((letter, index) => <path key={`top-${index}`} data-art-sign-row="waffle" d={MARQUEE_GLYPHS[letter]} transform={`translate(${4 + index * 22} 5) scale(1.65 2)`} />)}
      {'HOUSE'.split('').map((letter, index) => <path key={`bottom-${index}`} data-art-sign-row="house" d={MARQUEE_GLYPHS[letter]} transform={`translate(${15 + index * 22} 40) scale(1.65 2)`} />)}
    </g>
  </g>
}

function SatelliteCrystal({ x, y, scale, angle, opacity = 1 }: { x: number; y: number; scale: number; angle: number; opacity?: number }) {
  return <g data-art-satellite-crystal transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} opacity={opacity}>
    <path d="M0-28 13-14 17 9 3 28-12 16-17-7Z" fill="currentColor" fillOpacity=".085" />
    <path d="M0-28-3-4 13-14M-17-7-3-4-12 16M-3-4 6 8 17 9M6 8 3 28-12 16M-3-4 3 28" opacity=".7" />
    <path d="M-3-4 13-14 6 8Z" fill="currentColor" fillOpacity=".055" />
  </g>
}

function Crystalized() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.atmosphere-reference']
  return <>
    <g data-art-motif={words[1]} transform="rotate(-2 128 80)">
      <SatelliteCrystal x={65} y={99} scale={.85} angle={-27} />
      <SatelliteCrystal x={36} y={70} scale={.52} angle={22} opacity={.6} />
      <SatelliteCrystal x={48} y={39} scale={.65} angle={-18} opacity={.55} />
      <SatelliteCrystal x={86} y={37} scale={.57} angle={24} opacity={.5} />
    </g>
    <g data-art-motif={words[3]} transform="rotate(4 130 130)" opacity=".35">
      <path d="M1 124 128 100 241 128 134 151ZM31 134 128 109 216 135M114 121 111 139 129 150 147 140 143 123M111 139 129 135 147 140" fill="currentColor" fillOpacity=".025" />
      <path d="M82 123 78 136M174 125 180 137M34 116 38 126M217 121 222 133" strokeDasharray="3 4" />
    </g>
    <g data-art-motif={words[2]} transform="rotate(3 129 77)" opacity=".4">
      <path d="M180-12 198 124 221 118ZM255 20 220 119 244 124Z" fill="currentColor" fillOpacity=".085" />
      <path d="M180-12 211 122 255 20M180-12 190 108M255 20 244 111" strokeDasharray="3 5" />
    </g>
    <g data-art-motif={words[0]} transform="translate(20 -8) rotate(-18 129 64)">
      <path d="M127 7 143 14 153 34 150 53 155 72 146 91 131 109 115 99 103 79 102 53 111 27Z" fill="currentColor" fillOpacity=".12" />
      <path d="M127 7 123 42 111 27M123 42 143 14 153 34 137 57ZM102 53 123 42 116 75 103 79M116 75 131 109 146 91 137 57 155 72M123 42 137 57 116 75M115 99 116 75M137 57 146 91" opacity=".75" />
      <path d="M123 42 137 57 153 34Z" fill="currentColor" fillOpacity=".05" />
    </g>
  </>
}

function HollowCube({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M0-30 29-14 29 18 0 35-29 18-29-14ZM-29-14 0 2 29-14M0 2V35" fill="currentColor" fillOpacity=".085" />
    <path d="M0-25 25-11 25 15 0 30-25 15-25-11ZM-25-11 0 3 25-11M0 3V30" opacity=".55" />
    <path d="M-29-14-25-11M29-14 25-11M-29 18-25 15M29 18 25 15M0 35V30" opacity=".6" />
  </g>
}

function Blockshift() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.blockshift']
  return <>
    <g data-art-motif={words[0]} transform="rotate(-4 144 80)">
      <HollowCube x={159} y={103} scale={1.13} />
      <HollowCube x={28} y={14} scale={1.15} />
    </g>
    <g data-art-motif={words[1]} transform="rotate(-4 144 80)" opacity=".85">
      <HollowCube x={65} y={78} scale={.65} />
      <HollowCube x={176} y={38} scale={.65} />
      <HollowCube x={218} y={76} scale={.4} />
      <HollowCube x={121} y={79} scale={.35} />
      <HollowCube x={114} y={6} scale={.38} />
    </g>
    <g data-art-motif={words[2]} transform="rotate(-4 144 80)">
      <path d="M126 87 159 105 192 87M162 109V139M-5-3 28 16 61-3M31 20V51M47 69 65 79 82 69M159 29 176 39 194 29M178 42V59" />
    </g>
    <g data-art-motif={words[3]} transform="rotate(7 144 80)" opacity=".2">
      <path d="M7 21 124 77 231 14M5 140 124 77 231 143M124 69V85M116 77H132" strokeDasharray="2 6" />
    </g>
  </>
}

function ProductionCan({ x, y, scale, creature = false }: { x: number; y: number; scale: number; creature?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse rx="5" ry="2" fill="currentColor" fillOpacity=".065" />
    <path d="M-5 0V13Q0 17 5 13V0M-5 11Q0 15 5 11" fill="currentColor" fillOpacity=".09" />
    {creature && <>
      <circle cx="-2" cy="6" r=".65" /><circle cx="2" cy="6" r=".65" />
      <path d="M-2 10H2M-5 9-8 12M5 9 8 12M-2 15V19H-5M2 15V19H5" />
    </>}
  </g>
}

function Bwc() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.bwc']
  return <>
    <g data-art-motif={words[3]} transform="rotate(-2 150 70)" opacity=".5">
      <path d="M0 18 159-4 240 13M0 43 145 15 240 34M0 48 145 20 240 39M0 67 137 38M0 80 137 51M10 45V65M41 39V59M73 33V53M103 27V47" />
      <path d="M9 11 213-5M42 25 233 3M83 36 240 14M9 13 213-3M42 27 233 5M83 38 240 16M8 77V104M44 66V90M80 56V78M224 30V131M228 29V131" />
      <path d="M15 23V35Q15 43 28 43H127Q136 43 136 51M19 23V34Q19 39 30 39H129Q140 39 140 51M187 11V27Q187 35 199 35H238M191 11V25Q191 31 201 31H238" />
    </g>
    <g data-art-motif={words[0]} transform="rotate(2 151 108)">
      <path d="M-8 121 143 76 158 82 23 149ZM103 150 167 82 182 83 157 150Z" fill="currentColor" fillOpacity=".045" />
      <path d="M-8 128 143 80 154 85M113 150 170 86M160 150 182 87M2 111 138 72M2 115 138 76M187 83 218 145M181 83 208 145" opacity=".55" />
    </g>
    <g data-art-motif={words[1]} transform="rotate(2 151 108)">
      {Array.from({ length: 8 }, (_, index) => <ProductionCan key={index} x={15 + index * 17} y={112 - index * 4.7} scale={1.1 - index * .095} />)}
      {Array.from({ length: 8 }, (_, index) => <ProductionCan key={index} x={141 + index * 4} y={135 - index * 7} scale={1.2 - index * .095} creature />)}
    </g>
    <g data-art-motif={words[2]} transform="rotate(-3 163 62)">
      <circle cx="163" cy="62" r="36" fill="currentColor" fillOpacity=".05" />
      <circle cx="163" cy="62" r="31" />
      <circle cx="163" cy="62" r="25" fill="currentColor" fillOpacity=".12" />
      <path d="M142 37 137 32M132 50 126 48M130 67 123 68M141 86 136 92M160 97V104M181 91 185 97M196 74 203 77M199 53 206 51M186 32 190 27M164 25V18" opacity=".6" />
      <path d="M143 64Q151 48 161 63T183 61M150 74Q163 81 178 69" opacity=".4" />
      <circle cx="156" cy="51" r="2" opacity=".4" /><circle cx="174" cy="73" r="2.5" opacity=".4" />
    </g>
  </>
}

function canopyRods() {
  return Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8), column = index % 8
    return { x: 24 + column * 23 + row * 7, y: 34 - column * 3 + row * 5,
      hang: 7 + row * 1.8 + Math.sin(row * .75 + column * .18) * 6,
      length: 30 + Math.sin(row * .8 + column * .24) * 10 }
  })
}

function Canopy() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.canopy']
  return <>
    <g data-art-motif={words[0]} transform="rotate(-3 130 50)">
      <path d="M24 34 185 13 234 48 73 69Z" fill="currentColor" fillOpacity=".085" />
      {Array.from({ length: 8 }, (_, index) => <path key={index} d={`M${24 + index * 23} ${34 - index * 3}l49 35M${24 + index * 7} ${34 + index * 5}l161-21`} opacity=".6" />)}
      <path d="M24 30 185 9 234 44M24 34V30M185 13V9M234 48V44M73 69V65M24 30 73 65 234 44" opacity=".45" />
    </g>
    <g data-art-motif={words[1]} transform="rotate(-3 130 50)" opacity=".3">
      {canopyRods().map((rod, index) => <path key={index} d={`M${rod.x} ${rod.y}v${rod.hang}`} />)}
    </g>
    <g data-art-motif={words[2]} transform="rotate(-3 130 50)">
      {canopyRods().map((rod, index) => <g key={index} opacity={.42 + index % 8 / 14}>
        <path d={`M${rod.x} ${rod.y + rod.hang}v${rod.length}l2 1v-${rod.length}Z`} fill="currentColor" fillOpacity=".12" />
        <path d={`M${rod.x} ${rod.y + rod.hang + rod.length}l2 1`} />
      </g>)}
    </g>
    <g data-art-motif={words[3]} transform="rotate(5 128 125)" opacity=".25">
      <ellipse cx="132" cy="125" rx="89" ry="12" strokeDasharray="3 5" />
      <path d="M47 125 79 118M82 136 124 122M138 134 179 120M188 128 216 116M132 111V141" />
    </g>
  </>
}

function Cathedral() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.cathedral']
  return <>
    <g data-art-motif={words[0]} transform="rotate(-3 145 76)">
      {Array.from({ length: 7 }, (_, index) => <g key={index} transform={`translate(146 77) scale(${.72 ** index}) translate(-146 -77)`} opacity={1 - index * .1}>
        <path d="M8 153V63C8 22 74 3 119-17C164 3 230 22 230 63V153M16 153V64C16 29 78 11 119-8C160 11 222 29 222 64V153" />
        <path d="M8 65 16 66V153H8ZM222 66 230 65V153H222Z" fill="currentColor" fillOpacity=".1" />
      </g>)}
    </g>
    <g data-art-motif={words[1]} transform="rotate(-3 145 76)" opacity=".4">
      <path d="M8 63 146 77 230 63M119-17 146 77M16 153 146 77 222 153M34 41Q146 48 212 41M56 26Q146 39 190 26" />
      <path d="M4 66H21M219 66H235M4 73H21M219 73H235M4 148H21M219 148H235" />
    </g>
    <g data-art-motif={words[2]} transform="rotate(4 146 77)">
      <path d="M27 18 104 144 134 139ZM214 14 159 142 184 145Z" fill="currentColor" fillOpacity=".09" opacity=".45" />
      <path d="M17 69V142M219 66V142M62 67V119M194 66V120" />
    </g>
    <g data-art-motif={words[3]} transform="rotate(-5 146 126)" opacity=".3">
      <path d="M14 148 146 77 231 149M50 149 146 77 199 149M85 149 146 77 171 149M7 129H234M30 110H221M59 94H200" />
      <path d="M23 130 36 117M207 132 199 118M62 119 78 106M189 119 181 108" strokeDasharray="3 4" />
    </g>
  </>
}

function FacetedElement({ x, y, radius, angle = 0 }: { x: number; y: number; radius: number; angle?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${radius})`}>
    <path d="M0-1 .72-.65 1 .15 .5 .9-.45 .9-1 .1-.65-.65Z" fill="currentColor" fillOpacity=".1" />
    <path d="M0-1-.15-.1 .72-.65M-.15-.1 1 .15 .5 .9M-.15-.1-.45 .9-1 .1ZM-.65-.65-.15-.1 .5 .9M0-1 .5 .9" opacity=".6" />
    <path d="M-.15-.1 1 .15 .5 .9Z" fill="currentColor" fillOpacity=".045" />
  </g>
}

function Constellation() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.constellation']
  return <>
    <g data-art-motif={words[3]} transform="rotate(-12 140 75)" opacity=".2">
      <ellipse cx="141" cy="78" rx="79" ry="47" strokeDasharray="2 6" />
      <path d="M56 78H227M141 13V142M137 16H145M137 139H145M61 74V82M223 74V82" />
    </g>
    <g data-art-motif={words[2]} transform="rotate(8 141 78)" opacity=".3">
      <path d="M104 6Q80 37 118 52M143 118Q129 134 148 147M195 42Q232 56 218 80" strokeDasharray="2 4" />
    </g>
    <g data-art-motif={words[1]}>
      <FacetedElement x={95} y={15} radius={10} angle={-12} />
      <FacetedElement x={123} y={43} radius={8} angle={19} />
      <FacetedElement x={128} y={104} radius={6} angle={-18} />
      <FacetedElement x={141} y={118} radius={9} angle={6} />
      <FacetedElement x={158} y={138} radius={8} angle={-26} />
      <FacetedElement x={111} y={92} radius={5} angle={33} />
    </g>
    <g data-art-motif={words[0]} transform="rotate(9 185 67)">
      <FacetedElement x={185} y={67} radius={31} angle={-16} />
      <FacetedElement x={168} y={14} radius={15} angle={28} />
      <FacetedElement x={210} y={122} radius={18} angle={-7} />
    </g>
  </>
}

function Depth() {
  const words = PRESET_BLUEPRINT_MOTIFS['drmvyz.cinema2.depth']
  return <>
    <g data-art-motif={words[0]} transform="rotate(-8 147 76)">
      {Array.from({ length: 10 }, (_, index) => <g key={index} transform={`translate(147 76) scale(${.72 ** index}) translate(-147 -76)`} opacity={1 - index * .075}>
        <path d="M10-25H230V175H10ZM15-20V170H225V-20Z" fill="currentColor" fillOpacity=".085" fillRule="evenodd" />
        <path d="M18-17H222V167H18Z" opacity=".35" />
      </g>)}
    </g>
    <g data-art-motif={words[2]} transform="rotate(-8 147 76)" opacity=".35">
      <path d="M10-25 147 76 230-25M10 175 147 76 230 175M10 75H147M230 75H147" />
    </g>
    <g data-art-motif={words[1]} transform="rotate(-8 147 76)">
      <path d="M20-21H173M69 172H213M13 40V105M228 3V54" />
      {[.72, .373, .193, .1].map((scale, index) => <g key={index} transform={`translate(147 76) scale(${scale}) translate(-147 -76)`} opacity={.9 - index * .14}>
        <path d="M27-21H112M135 172H210M13 11V61M228 90V138" />
      </g>)}
    </g>
    <g data-art-motif={words[3]} transform="rotate(5 147 76)">
      <circle cx="147" cy="76" r="5" fill="currentColor" fillOpacity=".08" />
      <ellipse cx="147" cy="76" rx="5" ry="2" opacity=".35" />
      <path d="M142 76H152M147 71V81" strokeDasharray="1 2" opacity=".3" />
    </g>
  </>
}

const ILLUSTRATIONS = {
  ...ADDITIONAL_BLUEPRINT_DRAWINGS,
  'drmvyz.cinema2.afterhours': Afterhours,
  'drmvyz.cinema2.ancient-machine': AncientMachine,
  'drmvyz.cinema2.atl-hoe': AtlHoe,
  'drmvyz.cinema2.atmosphere-reference': Crystalized,
  'drmvyz.cinema2.blockshift': Blockshift,
  'drmvyz.cinema2.bwc': Bwc,
  'drmvyz.cinema2.canopy': Canopy,
  'drmvyz.cinema2.cathedral': Cathedral,
  'drmvyz.cinema2.constellation': Constellation,
  'drmvyz.cinema2.depth': Depth,
} satisfies Record<AuthoredBlueprintPresetId, () => JSX.Element>

/** Individual camera poses: deliberately overscan the card, with separate
 * motif planes above preserving a different foreground/background angle. */
const ARTWORK_FRAMING = {
  ...ADDITIONAL_BLUEPRINT_FRAMING,
  'drmvyz.cinema2.afterhours': 'translate(112 73) rotate(-7) scale(1.04) translate(-120 -75)',
  'drmvyz.cinema2.ancient-machine': 'translate(117 77) rotate(-8) scale(1.04) translate(-120 -75)',
  'drmvyz.cinema2.atl-hoe': 'translate(123 86) rotate(-5) scale(1.02) translate(-120 -75)',
  'drmvyz.cinema2.atmosphere-reference': 'translate(117 81) rotate(-7) scale(1.08) translate(-120 -75)',
  'drmvyz.cinema2.blockshift': 'translate(111 81) rotate(-8) scale(1.07) translate(-120 -75)',
  'drmvyz.cinema2.bwc': 'translate(108 83) rotate(-6) scale(1.08) translate(-120 -75)',
  'drmvyz.cinema2.canopy': 'translate(117 70) rotate(-8) scale(1.08) translate(-120 -75)',
  'drmvyz.cinema2.cathedral': 'translate(109 83) rotate(-7) scale(1.1) translate(-120 -75)',
  'drmvyz.cinema2.constellation': 'translate(102 78) rotate(-13) scale(1.03) translate(-120 -75)',
  'drmvyz.cinema2.depth': 'translate(114 78) rotate(-14) scale(1.06) translate(-120 -75)',
} satisfies Record<AuthoredBlueprintPresetId, string>

export function PresetBlueprintArtwork({ presetId }: { presetId: AuthoredBlueprintPresetId }) {
  const Illustration = ILLUSTRATIONS[presetId]
  return (
    <svg
      className="rv-preset-blueprint-artwork"
      viewBox="0 0 240 150"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      focusable="false"
      aria-hidden="true"
      data-thumbnail-kind="authored-blueprint"
      data-artwork-preset={presetId}
    >
      <g stroke="currentColor" strokeWidth={PRESET_BLUEPRINT_STROKE_WIDTH} transform={ARTWORK_FRAMING[presetId]} data-art-composition>
        <Illustration />
      </g>
    </svg>
  )
}
