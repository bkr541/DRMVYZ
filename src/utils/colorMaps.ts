export type ColorMapName = 'cyan-green' | 'fire' | 'ice' | 'mono' | 'rainbow' | 'plasma'

// Each color map is 256 [r, g, b] entries interpolated from gradient stops
type Stop = [number, number, number, number] // [pos 0-1, r, g, b]

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function buildMap(stops: Stop[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let lo = stops[0], hi = stops[stops.length - 1]
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        lo = stops[s]; hi = stops[s + 1]; break
      }
    }
    const span = hi[0] - lo[0]
    const ft = span < 1e-6 ? 0 : (t - lo[0]) / span
    out[i * 3]     = Math.round(lerp(lo[1], hi[1], ft))
    out[i * 3 + 1] = Math.round(lerp(lo[2], hi[2], ft))
    out[i * 3 + 2] = Math.round(lerp(lo[3], hi[3], ft))
  }
  return out
}

const MAPS: Record<ColorMapName, Uint8ClampedArray> = {
  'cyan-green': buildMap([
    [0.0,   0,   0,   0],
    [0.3,   0, 100, 120],
    [0.65,  0, 200, 220],
    [0.85,  0, 229, 255],
    [1.0,   0, 255, 136],
  ]),
  'fire': buildMap([
    [0.0,   0,   0,   0],
    [0.2,  80,   0,   0],
    [0.45, 200,  50,   0],
    [0.7,  255, 160,   0],
    [0.9,  255, 230, 100],
    [1.0,  255, 255, 240],
  ]),
  'ice': buildMap([
    [0.0,   0,   0,   0],
    [0.3,   0,  30,  80],
    [0.6,   0, 100, 200],
    [0.85, 50, 200, 255],
    [1.0, 200, 240, 255],
  ]),
  'mono': buildMap([
    [0.0,   0,   0,   0],
    [1.0, 255, 255, 255],
  ]),
  'rainbow': buildMap([
    [0.0,   0,   0,   0],
    [0.15,  80,   0, 160],
    [0.3,    0,   0, 255],
    [0.45,   0, 200, 200],
    [0.6,    0, 220,   0],
    [0.75, 255, 220,   0],
    [0.88, 255,  80,   0],
    [1.0,  255,   0,   0],
  ]),
  'plasma': buildMap([
    [0.0,   0,   0,   0],
    [0.25,  80,   0, 120],
    [0.5,  180,   0, 180],
    [0.75, 255, 120,   0],
    [1.0,  255, 240,  80],
  ]),
}

export function getColorMap(name: ColorMapName): Uint8ClampedArray {
  return MAPS[name]
}

export function mapColor(map: Uint8ClampedArray, value: number): [number, number, number] {
  const i = Math.max(0, Math.min(255, Math.round(value * 255)))
  return [map[i * 3], map[i * 3 + 1], map[i * 3 + 2]]
}

export function mapColorHex(map: Uint8ClampedArray, value: number): string {
  const [r, g, b] = mapColor(map, value)
  return `rgb(${r},${g},${b})`
}

export const COLOR_MAP_NAMES: ColorMapName[] = ['cyan-green', 'fire', 'ice', 'mono', 'rainbow', 'plasma']
