import type {
  PixGridBuiltInAssetId,
  PixGridBuiltInAssetManifestEntry,
  PixGridPaletteRole,
} from './PixGridTypes'
import { samplePixGridNeonMarqueeFrame } from './PixGridNeonMarqueeFrames'
import { samplePixGridNeonMarqueeComponent } from './PixGridNeonMarqueeMasks'

export interface PixGridAssetSample {
  alpha: number
  role: PixGridPaletteRole
  /** Exact source color for native full-color assets; palette assets leave this undefined. */
  color?: readonly [number, number, number]
}

const COMMON_STATIC = ['static', 'pulse', 'bounce', 'horizontalScroll', 'verticalScroll', 'pingPong', 'rotate', 'paletteCycle', 'blink', 'revealRow', 'revealColumn', 'checkerAlternate', 'audioAmplitudeScale', 'beatStepMovement'] as const
const COMMON_PROCEDURAL = COMMON_STATIC
const COMMON_ANIMATED_PROCEDURAL = [...COMMON_STATIC, 'frameCycle'] as const

function asset(
  id: PixGridBuiltInAssetId,
  name: string,
  category: PixGridBuiltInAssetManifestEntry['category'],
  width: number,
  height: number,
  kind: PixGridBuiltInAssetManifestEntry['kind'],
  roles: readonly PixGridPaletteRole[],
  animationCapabilities: PixGridBuiltInAssetManifestEntry['animationCapabilities'],
  extras: Pick<PixGridBuiltInAssetManifestEntry, 'defaultGroups' | 'frameCount'> = {},
): PixGridBuiltInAssetManifestEntry {
  return {
    id,
    name,
    category,
    nativeSize: { width, height },
    aspectRatio: width / height,
    kind,
    defaultPaletteRoles: roles,
    animationCapabilities,
    ...extras,
  }
}

export const PIX_GRID_BUILT_IN_ASSETS: readonly PixGridBuiltInAssetManifestEntry[] = [
  asset('pix-bass-word', 'BASS', 'typography', 23, 7, 'static', ['primary', 'highlight'], COMMON_STATIC, { defaultGroups: ['body', 'outline'] }),
  asset('pix-bass-letter-b', 'BASS Letter B', 'typography', 5, 7, 'static', ['primary', 'highlight'], COMMON_STATIC, { defaultGroups: ['letter-body'] }),
  asset('pix-bass-letter-a', 'BASS Letter A', 'typography', 5, 7, 'static', ['primary', 'highlight'], COMMON_STATIC, { defaultGroups: ['letter-body'] }),
  asset('pix-bass-letter-s', 'BASS Letter S', 'typography', 5, 7, 'static', ['primary', 'highlight'], COMMON_STATIC, { defaultGroups: ['letter-body'] }),
  asset('pix-five-point-star', 'Five-Point Star', 'symbol', 15, 15, 'procedural', ['primary', 'highlight'], COMMON_PROCEDURAL),
  asset('pix-multi-star-field', 'Multi-Star Field', 'pattern', 32, 18, 'procedural', ['primary', 'secondary', 'accent'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 16, defaultGroups: ['large-stars', 'sparkles'] }),
  asset('pix-equalizer-bars', 'Equalizer Bars', 'motion', 24, 12, 'procedural', ['primary', 'secondary', 'accent'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 14 }),
  asset('pix-concentric-rings', 'Concentric Rings', 'geometry', 24, 24, 'procedural', ['primary', 'secondary'], COMMON_PROCEDURAL),
  asset('pix-checkerboard', 'Checkerboard', 'pattern', 16, 16, 'procedural', ['primary', 'secondary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 2 }),
  asset('pix-diagonal-chevrons', 'Diagonal Chevrons', 'geometry', 24, 12, 'procedural', ['primary', 'accent'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 16 }),
  asset('pix-cross', 'Cross', 'symbol', 15, 15, 'static', ['primary', 'highlight'], COMMON_STATIC),
  asset('pix-diamond', 'Diamond', 'symbol', 15, 15, 'procedural', ['secondary', 'highlight'], COMMON_PROCEDURAL),
  asset('pix-spiral', 'Spiral', 'geometry', 24, 24, 'procedural', ['primary', 'secondary'], COMMON_PROCEDURAL),
  asset('pix-wave-line', 'Wave Line', 'motion', 32, 10, 'procedural', ['accent', 'highlight'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 18 }),
  asset('pix-mascot-face', 'Pixel Pal', 'character', 16, 12, 'frameBased', ['primary', 'secondary', 'highlight'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['face', 'eyes', 'mouth'] }),
  asset('pix-orbiting-dots', 'Orbiting Dots', 'motion', 20, 20, 'frameBased', ['primary', 'secondary', 'accent'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 12 }),
  asset('pix-pixel-burst', 'Pixel Burst', 'geometry', 24, 24, 'procedural', ['accent', 'highlight'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 16 }),
  asset('pix-geometric-tunnel', 'Geometric Tunnel', 'geometry', 32, 18, 'procedural', ['primary', 'secondary', 'accent'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 16 }),
  asset('pix-neon-marquee-cycle', 'Neon Marquee Cycle', 'typography', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['full-frame'] }),
  asset('pix-neon-marquee-structure', 'Marquee Structure', 'typography', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['structure'] }),
  asset('pix-neon-marquee-bulbs-a', 'Marquee Bulbs A', 'motion', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['perimeter', 'chase-a'] }),
  asset('pix-neon-marquee-bulbs-b', 'Marquee Bulbs B', 'motion', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['perimeter', 'chase-b'] }),
  asset('pix-neon-marquee-bulbs-c', 'Marquee Bulbs C', 'motion', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['perimeter', 'chase-c'] }),
  asset('pix-neon-marquee-bulbs-d', 'Marquee Bulbs D', 'motion', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['perimeter', 'chase-d'] }),
  asset('pix-neon-marquee-letter-lights-a', 'Marquee Letter Lights A', 'typography', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['letter-lights', 'travel-a'] }),
  asset('pix-neon-marquee-letter-lights-b', 'Marquee Letter Lights B', 'typography', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['letter-lights', 'travel-b'] }),
  asset('pix-neon-marquee-letter-lights-c', 'Marquee Letter Lights C', 'typography', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['letter-lights', 'travel-c'] }),
  asset('pix-neon-marquee-equalizer-lights', 'Marquee Equalizer Lights', 'motion', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['equalizer'] }),
  asset('pix-neon-marquee-trim-lights', 'Marquee Trim Lights', 'motion', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['trim'] }),
  asset('pix-neon-marquee-focal-lights', 'Marquee Focal Lights', 'character', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['focal'] }),
  asset('pix-neon-marquee-sparkle-lights', 'Marquee Sparkle Lights', 'motion', 160, 90, 'frameBased', ['primary'], COMMON_ANIMATED_PROCEDURAL, { frameCount: 4, defaultGroups: ['sparkles'] }),
] as const

export const PIX_GRID_BUILT_IN_ASSET_BY_ID = new Map(PIX_GRID_BUILT_IN_ASSETS.map(item => [item.id, item]))

const BASS_BITMAP = [
  '11110001110001111001111',
  '10001010001010000010000',
  '11110010001011110011110',
  '10001011111000001000001',
  '10001010001000001000001',
  '10001010001010001010001',
  '11110010001011110011110',
] as const

const BASS_LETTER_B_BITMAP = [
  '11110',
  '10001',
  '11110',
  '10001',
  '10001',
  '10001',
  '11110',
] as const

const BASS_LETTER_A_BITMAP = [
  '01110',
  '10001',
  '10001',
  '11111',
  '10001',
  '10001',
  '10001',
] as const

const BASS_LETTER_S_BITMAP = [
  '01111',
  '10000',
  '11110',
  '00001',
  '00001',
  '10001',
  '11110',
] as const

const FACE_BITMAPS = [
  [
    '00111111111100', '01122222222210', '11222222222211', '12211222211221',
    '12211222211221', '12222222222221', '12222111122221', '12221222212221',
    '11222111122211', '01122222222210', '00111111111100', '00001100110000',
  ],
  [
    '00111111111100', '01122222222210', '11222222222211', '12211122111221',
    '12222222222221', '12222222222221', '12222111122221', '12221222212221',
    '11222111122211', '01122222222210', '00111111111100', '00001100110000',
  ],
  [
    '00111111111100', '01122222222210', '11222222222211', '12211222211221',
    '12211222211221', '12222222222221', '12221111112221', '12212222221221',
    '11221111112211', '01122222222210', '00111111111100', '00001100110000',
  ],
  [
    '00111111111100', '01122222222210', '11222222222211', '12211122111221',
    '12222222222221', '12222222222221', '12222111122221', '12222122122221',
    '11222222222211', '01122222222210', '00111111111100', '00001100110000',
  ],
] as const

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function fract(value: number): number {
  return value - Math.floor(value)
}

function hash2(x: number, y: number, seed: number): number {
  let value = (Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1442695041, 2246822519) ^ Math.imul(seed + 31, 3266489917)) >>> 0
  value ^= value >>> 13
  value = Math.imul(value, 1274126177) >>> 0
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff
}

function bitmapSample(bitmap: readonly string[], u: number, v: number, roles: readonly PixGridPaletteRole[]): PixGridAssetSample {
  const height = bitmap.length
  const width = bitmap[0]?.length ?? 0
  const x = Math.max(0, Math.min(width - 1, Math.floor(u * width)))
  const y = Math.max(0, Math.min(height - 1, Math.floor(v * height)))
  const code = Number(bitmap[y]?.[x] ?? '0')
  return code <= 0 ? { alpha: 0, role: roles[0] ?? 'primary' } : { alpha: 1, role: roles[Math.min(roles.length - 1, code - 1)] ?? 'primary' }
}

function lineBand(distance: number, thickness: number): number {
  return clamp01(1 - distance / Math.max(0.0001, thickness))
}

export function samplePixGridBuiltInAsset(
  assetId: PixGridBuiltInAssetId,
  u: number,
  v: number,
  frameIndex = 0,
  seed = 1,
): PixGridAssetSample {
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return { alpha: 0, role: 'primary' }
  const x = u - 0.5
  const y = v - 0.5
  const radius = Math.hypot(x, y)
  const angle = Math.atan2(y, x)

  switch (assetId) {
    case 'pix-bass-word':
      return bitmapSample(BASS_BITMAP, u, v, ['primary', 'highlight'])
    case 'pix-bass-letter-b':
      return bitmapSample(BASS_LETTER_B_BITMAP, u, v, ['primary', 'highlight'])
    case 'pix-bass-letter-a':
      return bitmapSample(BASS_LETTER_A_BITMAP, u, v, ['primary', 'highlight'])
    case 'pix-bass-letter-s':
      return bitmapSample(BASS_LETTER_S_BITMAP, u, v, ['primary', 'highlight'])
    case 'pix-five-point-star': {
      const points = 5
      const sector = Math.PI / points
      const folded = Math.abs(((angle + Math.PI / 2 + sector) % (sector * 2)) - sector)
      const edge = 0.21 + 0.25 * Math.cos(folded * points)
      const alpha = lineBand(Math.max(0, radius - edge), 0.045) * (radius <= edge + 0.045 ? 1 : 0)
      return { alpha, role: radius < edge * 0.62 ? 'highlight' : 'primary' }
    }
    case 'pix-multi-star-field': {
      const columns = 32
      const rows = 18
      const cellX = Math.floor(u * columns)
      const cellY = Math.floor(v * rows)
      const localX = fract(u * columns) - 0.5
      const localY = fract(v * rows) - 0.5
      const chance = hash2(cellX, cellY, seed)
      if (chance < 0.79) return { alpha: 0, role: 'primary' }
      const twinkle = 0.55 + 0.45 * Math.sin((frameIndex + hash2(cellY, cellX, seed) * 12) * 0.9)
      const star = lineBand(Math.min(Math.abs(localX), Math.abs(localY)), 0.12) * lineBand(Math.hypot(localX, localY), chance > 0.95 ? 0.38 : 0.22)
      return { alpha: star * twinkle, role: chance > 0.94 ? 'accent' : chance > 0.86 ? 'secondary' : 'primary' }
    }
    case 'pix-equalizer-bars': {
      const bars = 16
      const bar = Math.floor(u * bars)
      const level = 0.18 + hash2(bar, frameIndex % 7, seed) * 0.72
      const active = v >= 1 - level && fract(u * bars) > 0.18 && fract(u * bars) < 0.82
      return { alpha: active ? 1 : 0, role: bar % 3 === 0 ? 'accent' : bar % 2 === 0 ? 'secondary' : 'primary' }
    }
    case 'pix-concentric-rings': {
      const band = Math.abs(fract(radius * 8) - 0.5)
      return { alpha: lineBand(band, 0.13), role: Math.floor(radius * 8) % 2 === 0 ? 'primary' : 'secondary' }
    }
    case 'pix-checkerboard': {
      const cx = Math.floor(u * 12)
      const cy = Math.floor(v * 12)
      return { alpha: 1, role: (cx + cy + frameIndex) % 2 === 0 ? 'primary' : 'secondary' }
    }
    case 'pix-diagonal-chevrons': {
      const phase = fract((u * 3 + Math.abs(y) * 5) + frameIndex * 0.08)
      const chevron = lineBand(Math.abs(phase - 0.5), 0.14)
      return { alpha: chevron, role: y > 0 ? 'accent' : 'primary' }
    }
    case 'pix-cross': {
      const body = Math.abs(x) < 0.12 || Math.abs(y) < 0.12
      const outline = Math.abs(x) < 0.17 || Math.abs(y) < 0.17
      return { alpha: outline ? 1 : 0, role: body ? 'highlight' : 'primary' }
    }
    case 'pix-diamond': {
      const diamond = Math.abs(x) + Math.abs(y)
      return { alpha: lineBand(Math.abs(diamond - 0.34), 0.055), role: diamond < 0.34 ? 'highlight' : 'secondary' }
    }
    case 'pix-spiral': {
      const spiral = Math.abs(fract(radius * 5 - angle / (Math.PI * 2)) - 0.5)
      return { alpha: lineBand(spiral, 0.08) * clamp01(1 - radius * 1.7), role: angle > 0 ? 'secondary' : 'primary' }
    }
    case 'pix-wave-line': {
      const waveY = 0.5 + Math.sin((u * Math.PI * 4) + frameIndex * 0.35) * 0.25
      return { alpha: lineBand(Math.abs(v - waveY), 0.075), role: Math.sin(u * Math.PI * 4) > 0 ? 'highlight' : 'accent' }
    }
    case 'pix-mascot-face':
      return bitmapSample(FACE_BITMAPS[Math.abs(frameIndex) % FACE_BITMAPS.length], u, v, ['primary', 'secondary', 'highlight'])
    case 'pix-orbiting-dots': {
      const count = 8
      let alpha = 0
      let role: PixGridPaletteRole = 'primary'
      for (let index = 0; index < count; index += 1) {
        const theta = ((index + frameIndex / 12) / count) * Math.PI * 2
        const px = Math.cos(theta) * 0.32
        const py = Math.sin(theta) * 0.32
        const dot = lineBand(Math.hypot(x - px, y - py), index % 3 === 0 ? 0.075 : 0.055)
        if (dot > alpha) {
          alpha = dot
          role = index % 3 === 0 ? 'accent' : index % 2 === 0 ? 'secondary' : 'primary'
        }
      }
      return { alpha, role }
    }
    case 'pix-pixel-burst': {
      const ray = Math.abs(Math.sin(angle * 8))
      const radialGate = fract(radius * 7 + frameIndex * 0.08)
      return { alpha: lineBand(ray, 0.22) * lineBand(Math.abs(radialGate - 0.5), 0.34) * clamp01(1 - radius * 1.55), role: radius < 0.22 ? 'highlight' : 'accent' }
    }
    case 'pix-geometric-tunnel': {
      const diamond = Math.abs(x) + Math.abs(y)
      const band = Math.abs(fract(diamond * 8 + frameIndex * 0.08) - 0.5)
      const rails = Math.min(Math.abs(Math.abs(x) - Math.abs(y)), Math.abs(x), Math.abs(y))
      return { alpha: Math.max(lineBand(band, 0.11), lineBand(rails, 0.025)), role: Math.floor(diamond * 8) % 3 === 0 ? 'accent' : diamond > 0.28 ? 'secondary' : 'primary' }
    }
    case 'pix-neon-marquee-cycle':
      return samplePixGridNeonMarqueeFrame(u, v, frameIndex)
    case 'pix-neon-marquee-structure':
      return samplePixGridNeonMarqueeComponent('structure', u, v, frameIndex)
    case 'pix-neon-marquee-bulbs-a':
      return samplePixGridNeonMarqueeComponent('bulbs-a', u, v, frameIndex)
    case 'pix-neon-marquee-bulbs-b':
      return samplePixGridNeonMarqueeComponent('bulbs-b', u, v, frameIndex)
    case 'pix-neon-marquee-bulbs-c':
      return samplePixGridNeonMarqueeComponent('bulbs-c', u, v, frameIndex)
    case 'pix-neon-marquee-bulbs-d':
      return samplePixGridNeonMarqueeComponent('bulbs-d', u, v, frameIndex)
    case 'pix-neon-marquee-letter-lights-a':
      return samplePixGridNeonMarqueeComponent('letter-a', u, v, frameIndex)
    case 'pix-neon-marquee-letter-lights-b':
      return samplePixGridNeonMarqueeComponent('letter-b', u, v, frameIndex)
    case 'pix-neon-marquee-letter-lights-c':
      return samplePixGridNeonMarqueeComponent('letter-c', u, v, frameIndex)
    case 'pix-neon-marquee-equalizer-lights':
      return samplePixGridNeonMarqueeComponent('equalizer', u, v, frameIndex)
    case 'pix-neon-marquee-trim-lights':
      return samplePixGridNeonMarqueeComponent('trim', u, v, frameIndex)
    case 'pix-neon-marquee-focal-lights':
      return samplePixGridNeonMarqueeComponent('focal', u, v, frameIndex)
    case 'pix-neon-marquee-sparkle-lights':
      return samplePixGridNeonMarqueeComponent('sparkle', u, v, frameIndex)
  }
}

export function hasPixGridBuiltInAsset(assetId: string): assetId is PixGridBuiltInAssetId {
  return PIX_GRID_BUILT_IN_ASSET_BY_ID.has(assetId as PixGridBuiltInAssetId)
}
