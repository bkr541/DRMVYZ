import type {
  ShaderParamDef,
  ShaderParamValue,
  ShaderDefinition,
  RGBA,
  Vec2,
  GradientStop,
} from '../registry/shaderRegistryTypes'

// ── Safe value extractors ─────────────────────────────────────────────────────

export function toNumberValue(v: ShaderParamValue, fallback = 0): number {
  return typeof v === 'number' ? v : fallback
}

export function toBooleanValue(v: ShaderParamValue): boolean {
  return typeof v === 'boolean' ? v : false
}

export function toStringValue(v: ShaderParamValue): string {
  return typeof v === 'string' ? v : ''
}

export function toRgbaValue(v: ShaderParamValue): RGBA {
  if (Array.isArray(v) && v.length >= 4) {
    return [clamp01(v[0] as number), clamp01(v[1] as number), clamp01(v[2] as number), clamp01(v[3] as number)]
  }
  return [0, 0, 0, 1]
}

export function toVec2Value(v: ShaderParamValue): Vec2 {
  if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
    return [v[0], v[1]] as Vec2
  }
  return [0, 0]
}

export function toGradientValue(v: ShaderParamValue): GradientStop[] {
  if (!Array.isArray(v) || v.length === 0) {
    return [{ position: 0, color: [0, 0, 0, 1] }, { position: 1, color: [1, 1, 1, 1] }]
  }
  const clamped = (v as GradientStop[]).map(s => ({
    position: clamp01(s.position),
    color:    toRgbaValue(s.color),
  }))
  return sortStops(clamped)
}

// ── Numeric clamping ──────────────────────────────────────────────────────────

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function clampFloat(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function clampInteger(v: number, min: number, max: number): number {
  return Math.round(clampFloat(v, min, max))
}

// ── RGBA ↔ hex ────────────────────────────────────────────────────────────────

export function rgbaToHex(rgba: RGBA): string {
  const r = Math.round(rgba[0] * 255).toString(16).padStart(2, '0')
  const g = Math.round(rgba[1] * 255).toString(16).padStart(2, '0')
  const b = Math.round(rgba[2] * 255).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

export function hexToRgba(hex: string, alpha: number): RGBA {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b, clamp01(alpha)]
}

// ── Gradient helpers ──────────────────────────────────────────────────────────

export function sortStops(stops: GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.position - b.position)
}

// ── Parameter grouping ────────────────────────────────────────────────────────

export const PARAM_GROUP_ORDER: string[] = [
  'Geometry', 'Camera', 'Motion', 'Surface', 'Lighting',
  'Color', 'Particles', 'Feedback', 'Distortion', 'Post Processing',
]

export interface ParamGroup {
  name:     string
  params:   ShaderParamDef[]
  advanced: boolean
}

export function groupParams(params: ShaderParamDef[]): ParamGroup[] {
  const ungrouped: ShaderParamDef[] = []
  const advanced:  ShaderParamDef[] = []
  const groups     = new Map<string, ShaderParamDef[]>()

  for (const p of params) {
    if (p.advanced) {
      advanced.push(p)
    } else if (p.group) {
      if (!groups.has(p.group)) groups.set(p.group, [])
      groups.get(p.group)!.push(p)
    } else {
      ungrouped.push(p)
    }
  }

  const result: ParamGroup[] = []

  if (ungrouped.length > 0) {
    result.push({ name: 'Parameters', params: ungrouped, advanced: false })
  }

  const sortedGroupNames = [...groups.keys()].sort((a, b) => {
    const ai = PARAM_GROUP_ORDER.indexOf(a)
    const bi = PARAM_GROUP_ORDER.indexOf(b)
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    return a.localeCompare(b)
  })

  for (const name of sortedGroupNames) {
    result.push({ name, params: groups.get(name)!, advanced: false })
  }

  if (advanced.length > 0) {
    result.push({ name: 'Advanced', params: advanced, advanced: true })
  }

  return result
}

// ── Scene filtering ───────────────────────────────────────────────────────────

export function isDevScene(def: ShaderDefinition): boolean {
  return !!(def.tags?.includes('dev') || def.tags?.includes('internal'))
}

export function getUserFacingScenes(defs: ShaderDefinition[]): ShaderDefinition[] {
  return defs.filter(d => !isDevScene(d))
}
