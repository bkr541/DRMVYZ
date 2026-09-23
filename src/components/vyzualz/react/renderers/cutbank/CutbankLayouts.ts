import type { CanvasCutbankLayoutMode } from './CutbankSettings'
import type { CutbankContentItem } from './CutbankContent'
import { resolveCutbankFreedomEnvelope, type CutbankFreedomEnvelope } from './CutbankFreedom'
import { clamp, clamp01, createCutbankRng, lerp } from './CutbankRandom'

export type CutbankLayoutId = Exclude<CanvasCutbankLayoutMode, 'auto'>
export const CUTBANK_LAYOUT_IDS: readonly CutbankLayoutId[] = [
  'hero', 'microtype', 'overscan', 'edgeCrop', 'verticalType', 'poster',
  'stack', 'split', 'tunnel', 'fragment', 'logoHit', 'void',
]
/** Layouts that are meaningless with a single layer and degrade to Hero. */
export const CUTBANK_MULTI_LAYER_LAYOUTS: readonly CutbankLayoutId[] = ['stack', 'split', 'tunnel', 'fragment']

export type CutbankColorRole = 'ink' | 'accent1' | 'accent2'

export interface CutbankMediaElement {
  type: 'media'
  slot: number
  itemKey: string
  /** Window centre and size in canvas fractions; may extend past 0..1 (overscan / edge crop). */
  cx: number
  cy: number
  w: number
  h: number
  /** contain: whole source visible inside the window. cover: source fills the window and is cropped. */
  fit: 'contain' | 'cover'
  /** Extra zoom into the source (>= 1) and which part of it stays in view (0..1). */
  zoom: number
  focusX: number
  focusY: number
  rotation: number
  opacity: number
  /** 0..1 weight of ambient drift/pulse motion for this element. */
  drift: number
}

export interface CutbankTextElement {
  type: 'text'
  slot: number
  itemKey: string
  cx: number
  cy: number
  /** Cap height as a fraction of the canvas height. */
  fontH: number
  rotation: number
  vertical: boolean
  align: 'left' | 'center' | 'right'
  stretchX: number
  stretchY: number
  /** Letter spacing in em. */
  tracking: number
  repeat: number
  /** Offset between repeats as a fraction of fontH. */
  repeatStep: number
  /** Wrap width as a fraction of the canvas width. */
  maxWidth: number
  colorRole: CutbankColorRole
  opacity: number
  drift: number
}

export type CutbankElement = CutbankMediaElement | CutbankTextElement

export interface CutbankComposition {
  seed: number
  layout: CutbankLayoutId
  requestedLayout: CanvasCutbankLayoutMode
  /** Draw order: later entries are on top. */
  elements: CutbankElement[]
  backdrop: 'ink' | 'paper'
  /** Rough fraction of the frame intentionally left empty (used for diagnostics/tests). */
  negativeSpace: number
}

export type CutbankPickWant = 'any' | 'media' | 'text' | 'svg' | 'visual'

export interface CutbankLayoutInput {
  layout: CutbankLayoutId
  requestedLayout: CanvasCutbankLayoutMode
  seed: number
  freedom: number
  complexity: number
  layerCount: number
  /** Deterministic slot pick; `want` restricts kind, returning null when nothing matches. */
  pick: (slot: number, want: CutbankPickWant) => CutbankContentItem | null
}

export function cutbankElementBudget(complexity: number, layerCount: number): number {
  const layers = clamp(Math.round(layerCount), 1, 4)
  return clamp(1 + Math.round(clamp01(complexity) * (layers - 1)), 1, layers)
}

export function resolveEffectiveCutbankLayout(layout: CutbankLayoutId, layerCount: number): CutbankLayoutId {
  return layerCount < 2 && CUTBANK_MULTI_LAYER_LAYOUTS.includes(layout) ? 'hero' : layout
}

type Rng = () => number

const spread = (rng: Rng, env: CutbankFreedomEnvelope) => lerp(env.scaleLo, env.scaleHi, rng())
const jitter = (rng: Rng, max: number) => (rng() * 2 - 1) * max
const isMedia = (item: CutbankContentItem | null): item is CutbankContentItem => item != null && item.kind !== 'text'
const roles: readonly CutbankColorRole[] = ['ink', 'accent1', 'accent2']

function textEl(
  item: CutbankContentItem,
  slot: number,
  init: Partial<CutbankTextElement> & Pick<CutbankTextElement, 'cx' | 'cy' | 'fontH'>,
): CutbankTextElement {
  return {
    type: 'text', slot, itemKey: item.key,
    rotation: 0, vertical: false, align: 'center', stretchX: 1, stretchY: 1, tracking: 0,
    repeat: 1, repeatStep: 0.9, maxWidth: 0.9, colorRole: 'ink', opacity: 1, drift: 0.5,
    ...init,
  }
}

function mediaEl(
  item: CutbankContentItem,
  slot: number,
  init: Partial<CutbankMediaElement> & Pick<CutbankMediaElement, 'cx' | 'cy' | 'w' | 'h'>,
): CutbankMediaElement {
  return {
    type: 'media', slot, itemKey: item.key,
    fit: 'contain', zoom: 1, focusX: 0.5, focusY: 0.5, rotation: 0, opacity: 1, drift: 0.5,
    ...init,
  }
}

function rot(rng: Rng, env: CutbankFreedomEnvelope, factor = 1): number {
  return jitter(rng, env.rotation * factor)
}

function pickRole(rng: Rng, env: CutbankFreedomEnvelope): CutbankColorRole {
  // Low freedom keeps type on the primary ink; higher freedom lets accents alternate in.
  return rng() < env.variety * 0.55 ? roles[1 + Math.floor(rng() * 2)] : 'ink'
}

function anyOrText(input: CutbankLayoutInput, slot: number, preferText: boolean): CutbankContentItem | null {
  const first = input.pick(slot, preferText ? 'text' : 'visual')
  return first ?? input.pick(slot, 'any')
}

const builders: Record<CutbankLayoutId, (input: CutbankLayoutInput, rng: Rng, env: CutbankFreedomEnvelope, budget: number) => CutbankElement[]> = {
  hero(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const item = anyOrText(input, 0, rng() < 0.4)
    if (!item) return out
    const s = spread(rng, env)
    const cx = 0.5 + jitter(rng, env.offset * 0.6)
    const cy = 0.5 + jitter(rng, env.offset * 0.6)
    if (item.kind === 'text') {
      out.push(textEl(item, 0, { cx, cy, fontH: clamp(0.16 * s, 0.06, 0.7), rotation: rot(rng, env, 0.35), maxWidth: 0.92, colorRole: pickRole(rng, env), stretchX: 1 + jitter(rng, env.variety * 0.25) }))
    } else {
      const size = clamp(0.74 * s, 0.25, 1.9)
      out.push(mediaEl(item, 0, { cx, cy, w: size, h: size, rotation: rot(rng, env, 0.3), drift: 0.6 }))
    }
    if (budget > 1) {
      const caption = input.pick(1, 'text')
      if (caption) out.push(textEl(caption, 1, { cx: 0.5 + jitter(rng, env.offset), cy: rng() < 0.5 ? 0.92 : 0.08, fontH: lerp(0.03, 0.05, rng()), tracking: 0.3, colorRole: pickRole(rng, env), drift: 0.2 }))
      else {
        const extra = input.pick(1, 'visual')
        if (extra) out.push(mediaEl(extra, 1, { cx: 0.5 + jitter(rng, env.offset), cy: 0.5 + jitter(rng, env.offset), w: lerp(0.12, 0.25, rng()) * spread(rng, env), h: 0.25, fit: 'cover', rotation: rot(rng, env, 0.5) }))
      }
    }
    return out
  },

  microtype(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const text = input.pick(0, 'text')
    const edge = env.offset * 0.9
    const px = 0.5 + jitter(rng, edge)
    const py = 0.5 + jitter(rng, edge)
    if (text) {
      out.push(textEl(text, 0, { cx: px, cy: py, fontH: lerp(0.022, 0.05, rng()) * clamp(env.scaleLo + 0.4, 0.7, 1.2), tracking: lerp(0.15, 0.6, rng()), align: 'center', maxWidth: 0.4, colorRole: pickRole(rng, env), drift: 0.15 }))
    } else {
      const m = input.pick(0, 'visual')
      if (m) out.push(mediaEl(m, 0, { cx: px, cy: py, w: lerp(0.06, 0.16, rng()), h: lerp(0.06, 0.16, rng()), fit: 'cover', drift: 0.2 }))
    }
    if (budget > 1) {
      const other = input.pick(1, 'visual') ?? input.pick(1, 'text')
      if (other) {
        const qx = px > 0.5 ? lerp(0.08, 0.3, rng()) : lerp(0.7, 0.92, rng())
        const qy = py > 0.5 ? lerp(0.08, 0.3, rng()) : lerp(0.7, 0.92, rng())
        if (other.kind === 'text') out.push(textEl(other, 1, { cx: qx, cy: qy, fontH: lerp(0.02, 0.035, rng()), tracking: 0.4, maxWidth: 0.3, drift: 0.1 }))
        else out.push(mediaEl(other, 1, { cx: qx, cy: qy, w: lerp(0.05, 0.11, rng()), h: lerp(0.05, 0.11, rng()), fit: 'cover', drift: 0.15 }))
      }
    }
    return out
  },

  overscan(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const item = input.pick(0, 'visual') ?? input.pick(0, 'any')
    if (!item) return out
    const bleed = 1.12 + env.overscan * lerp(0.6, 1.6, rng())
    if (item.kind === 'text') {
      out.push(textEl(item, 0, { cx: 0.5 + jitter(rng, env.offset * 0.5), cy: 0.5 + jitter(rng, env.offset * 0.5), fontH: clamp(0.5 * bleed, 0.3, 1.3), rotation: rot(rng, env, 0.4), stretchX: 1 + env.variety * 0.4, maxWidth: 1.4, colorRole: pickRole(rng, env) }))
    } else {
      out.push(mediaEl(item, 0, { cx: 0.5 + jitter(rng, env.overscan * 0.5), cy: 0.5 + jitter(rng, env.overscan * 0.5), w: bleed, h: bleed, fit: 'cover', zoom: lerp(1, env.cropZoom, rng()), focusX: rng(), focusY: rng(), rotation: rot(rng, env, 0.35), drift: 0.7 }))
    }
    if (budget > 1) {
      const t = input.pick(1, 'text')
      if (t) out.push(textEl(t, 1, { cx: 0.5 + jitter(rng, env.offset), cy: 0.5 + jitter(rng, env.offset), fontH: clamp(lerp(0.4, 0.9, rng()) * (0.7 + env.overscan), 0.25, 1.2), rotation: rot(rng, env, 0.5), maxWidth: 1.5, colorRole: pickRole(rng, env), opacity: 0.95 }))
    }
    return out
  },

  edgeCrop(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const item = input.pick(0, 'visual') ?? input.pick(0, 'any')
    if (!item) return out
    const visible = lerp(0.72, 0.32, clamp01(env.offset / 0.55))
    const side = Math.floor(rng() * 4)
    const size = clamp(0.8 * spread(rng, env), 0.35, 1.6)
    const off = 0.5 + (0.5 - size * visible * 0.5) * (side % 2 === 0 ? 1 : -1)
    const cx = side < 2 ? off : 0.5 + jitter(rng, env.offset * 0.5)
    const cy = side < 2 ? 0.5 + jitter(rng, env.offset * 0.5) : off
    if (item.kind === 'text') out.push(textEl(item, 0, { cx, cy, fontH: clamp(0.3 * spread(rng, env), 0.1, 0.9), rotation: rot(rng, env, 0.5), align: side === 0 ? 'right' : 'left', maxWidth: 1.2, colorRole: pickRole(rng, env) }))
    else out.push(mediaEl(item, 0, { cx, cy, w: size, h: size, fit: 'cover', zoom: lerp(1, env.cropZoom, rng()), focusX: rng(), focusY: rng(), rotation: rot(rng, env, 0.4) }))
    if (budget > 1) {
      const t = input.pick(1, 'text') ?? input.pick(1, 'visual')
      if (t) {
        const ox = 1 - cx > 0.5 ? lerp(0.7, 0.98, rng()) : lerp(0.02, 0.3, rng())
        const oy = 1 - cy > 0.5 ? lerp(0.7, 0.98, rng()) : lerp(0.02, 0.3, rng())
        if (t.kind === 'text') out.push(textEl(t, 1, { cx: ox, cy: oy, fontH: lerp(0.05, 0.12, rng()), colorRole: pickRole(rng, env), maxWidth: 0.5 }))
        else out.push(mediaEl(t, 1, { cx: ox, cy: oy, w: lerp(0.16, 0.34, rng()), h: lerp(0.16, 0.34, rng()), fit: 'cover' }))
      }
    }
    return out
  },

  verticalType(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const text = input.pick(0, 'text')
    const left = rng() < 0.5
    const cx = left ? lerp(0.12, 0.3, rng()) : lerp(0.7, 0.88, rng())
    if (text) {
      // Low freedom keeps type on an exact quarter turn; higher freedom tilts it.
      out.push(textEl(text, 0, { cx: cx + jitter(rng, env.offset * 0.3), cy: 0.5 + jitter(rng, env.offset * 0.4), fontH: clamp(0.2 * spread(rng, env), 0.08, 0.6), vertical: true, rotation: -Math.PI / 2 + rot(rng, env, 0.25), tracking: lerp(0, 0.35, rng()), maxWidth: 1.1, colorRole: pickRole(rng, env), stretchY: 1 + jitter(rng, env.variety * 0.3) }))
    }
    const m = input.pick(text ? 1 : 0, 'visual')
    if (m && (budget > 1 || !text)) {
      const col = left ? lerp(0.55, 0.72, rng()) : lerp(0.28, 0.45, rng())
      out.push(mediaEl(m, text ? 1 : 0, { cx: col + jitter(rng, env.offset * 0.2), cy: 0.5 + jitter(rng, env.offset * 0.3), w: lerp(0.28, 0.5, rng()) * spread(rng, env), h: lerp(0.7, 1.05, rng()), fit: 'cover', zoom: lerp(1, env.cropZoom, rng()), focusX: rng(), focusY: rng() }))
    }
    return out
  },

  poster(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const m = input.pick(0, 'visual')
    if (m) {
      const w = clamp(lerp(0.6, 0.95, rng()) * lerp(env.scaleLo + 0.1, env.scaleHi, 0.6), 0.4, 1.5)
      out.push(mediaEl(m, 0, { cx: 0.5 + jitter(rng, env.offset * 0.6), cy: 0.5 + jitter(rng, env.offset * 0.5), w, h: clamp(w * lerp(0.8, 1.15, rng()), 0.4, 1.5), fit: 'cover', zoom: lerp(1, env.cropZoom, rng() * 0.8), focusX: rng(), focusY: rng(), rotation: rot(rng, env, 0.15), drift: 0.5 }))
    }
    const head = input.pick(1, 'text')
    if (head) {
      const bottom = rng() < 0.6
      out.push(textEl(head, 1, { cx: 0.5 + jitter(rng, env.offset * 0.4), cy: bottom ? lerp(0.74, 0.88, rng()) : lerp(0.14, 0.28, rng()), fontH: clamp(lerp(0.16, 0.32, rng()) * lerp(0.9, spread(rng, env), 0.6), 0.1, 0.7), stretchX: 1 + env.variety * lerp(0, 0.6, rng()), rotation: rot(rng, env, 0.2), maxWidth: 1.05, colorRole: pickRole(rng, env), align: rng() < 0.5 ? 'left' : 'center' }))
      if (budget > 2) {
        const sub = input.pick(2, 'text')
        if (sub) out.push(textEl(sub, 2, { cx: bottom ? 0.5 : 0.5, cy: bottom ? 0.96 : 0.04, fontH: 0.03, tracking: 0.5, maxWidth: 0.7, drift: 0.1 }))
      }
    } else if (!m) {
      const any = input.pick(0, 'any')
      if (any) out.push(textEl(any, 0, { cx: 0.5, cy: 0.5, fontH: 0.2, maxWidth: 0.9 }))
    }
    return out
  },

  stack(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const n = Math.max(2, budget)
    const step = lerp(0.05, 0.16, env.variety)
    for (let i = 0; i < n; i += 1) {
      const item = i === n - 1 && rng() < 0.6 ? (input.pick(i, 'text') ?? input.pick(i, 'any')) : (input.pick(i, 'visual') ?? input.pick(i, 'any'))
      if (!item) continue
      const cx = 0.5 + (i - (n - 1) / 2) * step + jitter(rng, env.offset * 0.35)
      const cy = 0.5 + (i - (n - 1) / 2) * step * 0.8 + jitter(rng, env.offset * 0.35)
      if (item.kind === 'text') out.push(textEl(item, i, { cx, cy, fontH: clamp(lerp(0.1, 0.22, rng()) * spread(rng, env), 0.05, 0.7), rotation: rot(rng, env, 0.5), colorRole: pickRole(rng, env), maxWidth: 0.9 }))
      else {
        const size = clamp(lerp(0.75, 0.42, i / Math.max(1, n - 1)) * spread(rng, env), 0.2, 1.8)
        out.push(mediaEl(item, i, { cx, cy, w: size, h: size, fit: rng() < 0.5 ? 'cover' : 'contain', zoom: lerp(1, env.cropZoom, rng() * 0.6), focusX: rng(), focusY: rng(), rotation: rot(rng, env, 0.6) }))
      }
    }
    return out
  },

  split(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const n = clamp(Math.max(2, budget), 2, 4)
    const vertical = rng() < 0.5
    const weights = Array.from({ length: n }, () => lerp(1, lerp(0.5, 2.2, rng()), env.variety))
    const total = weights.reduce((a, b) => a + b, 0)
    let cursor = 0
    for (let i = 0; i < n; i += 1) {
      const span = weights[i] / total
      const c = cursor + span / 2
      cursor += span
      const item = input.pick(i, 'visual') ?? input.pick(i, 'any')
      if (!item) continue
      if (item.kind === 'text') {
        out.push(textEl(item, i, { cx: vertical ? c : 0.5, cy: vertical ? 0.5 : c, fontH: clamp(span * (vertical ? 0.5 : 0.9), 0.05, 0.5), vertical: vertical && span < 0.34, rotation: vertical && span < 0.34 ? -Math.PI / 2 : 0, maxWidth: vertical ? span * 1.9 : 1, colorRole: i % 2 === 0 ? 'ink' : pickRole(rng, env) }))
      } else {
        out.push(mediaEl(item, i, { cx: vertical ? c : 0.5, cy: vertical ? 0.5 : c, w: vertical ? span : 1, h: vertical ? 1 : span, fit: 'cover', zoom: lerp(1, env.cropZoom, rng() * 0.7), focusX: rng(), focusY: rng(), drift: 0.4 }))
      }
    }
    return out
  },

  tunnel(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const n = Math.max(2, budget)
    const item = input.pick(0, 'visual') ?? input.pick(0, 'any')
    if (!item) return out
    const ratio = lerp(0.72, 0.5, env.variety)
    const twist = rot(rng, env, 0.4)
    for (let i = 0; i < n; i += 1) {
      const scale = Math.pow(ratio, n - 1 - i) * lerp(0.95, 1.25, clamp01(env.overscan * 2))
      if (item.kind === 'text') {
        out.push(textEl(item, i, { cx: 0.5, cy: 0.5, fontH: clamp(0.34 * scale, 0.03, 1), rotation: twist * (i / n), colorRole: i % 2 === 0 ? 'ink' : pickRole(rng, env), opacity: lerp(0.5, 1, i / Math.max(1, n - 1)), maxWidth: 1.2, drift: 0.9 }))
      } else {
        out.push(mediaEl(item, i, { cx: 0.5, cy: 0.5, w: scale, h: scale, fit: 'cover', zoom: 1 + i * 0.08, rotation: twist * (i / n), opacity: lerp(0.6, 1, i / Math.max(1, n - 1)), drift: 0.9 }))
      }
    }
    return out
  },

  fragment(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const item = input.pick(0, 'visual')
    const tiles = Math.max(2, budget)
    if (!item) {
      const any = input.pick(0, 'any')
      if (any) out.push(textEl(any, 0, { cx: 0.5, cy: 0.5, fontH: 0.2 }))
      return out
    }
    for (let i = 0; i < tiles; i += 1) {
      const w = lerp(0.2, 0.55, rng()) * lerp(0.8, spread(rng, env), 0.5)
      const h = lerp(0.2, 0.6, rng()) * lerp(0.8, spread(rng, env), 0.5)
      out.push(mediaEl(item, i, { cx: 0.5 + jitter(rng, 0.3 + env.offset * 0.6), cy: 0.5 + jitter(rng, 0.3 + env.offset * 0.6), w, h, fit: 'cover', zoom: lerp(1.4, Math.max(1.6, env.cropZoom * 1.4), rng()), focusX: rng(), focusY: rng(), rotation: rot(rng, env, 0.3), drift: 0.6 }))
    }
    return out
  },

  logoHit(input, rng, env, budget) {
    const out: CutbankElement[] = []
    const item = input.pick(0, 'svg') ?? input.pick(0, 'visual') ?? input.pick(0, 'any')
    if (!item) return out
    const size = clamp(lerp(0.42, 0.72, rng()) * lerp(1, spread(rng, env), 0.6), 0.2, 1.4)
    if (item.kind === 'text') out.push(textEl(item, 0, { cx: 0.5, cy: 0.5, fontH: clamp(size * 0.35, 0.1, 0.6), tracking: 0.05, colorRole: pickRole(rng, env) }))
    else out.push(mediaEl(item, 0, { cx: 0.5 + jitter(rng, env.offset * 0.3), cy: 0.5 + jitter(rng, env.offset * 0.3), w: size, h: size, fit: 'contain', rotation: rot(rng, env, 0.15), drift: 0.8 }))
    if (budget > 1) {
      const t = input.pick(1, 'text')
      if (t) out.push(textEl(t, 1, { cx: 0.5, cy: lerp(0.84, 0.94, rng()), fontH: 0.028, tracking: 0.6, maxWidth: 0.6, drift: 0.1 }))
    }
    return out
  },

  void(input, rng, env) {
    const out: CutbankElement[] = []
    const item = input.pick(0, rng() < 0.6 ? 'text' : 'visual') ?? input.pick(0, 'any')
    if (!item) return out
    const reach = 0.12 + env.offset * 0.7
    const cx = clamp(0.5 + (rng() < 0.5 ? -1 : 1) * lerp(0.05, reach, rng()), 0.04, 0.96)
    const cy = clamp(0.5 + (rng() < 0.5 ? -1 : 1) * lerp(0.05, reach, rng()), 0.04, 0.96)
    if (item.kind === 'text') out.push(textEl(item, 0, { cx, cy, fontH: lerp(0.02, 0.04, rng()), tracking: lerp(0.2, 0.7, rng()), maxWidth: 0.35, drift: 0.1, colorRole: pickRole(rng, env) }))
    else out.push(mediaEl(item, 0, { cx, cy, w: lerp(0.05, 0.14, rng()), h: lerp(0.05, 0.14, rng()), fit: 'contain', drift: 0.15 }))
    return out
  },
}

const PAPER_LAYOUTS: readonly CutbankLayoutId[] = ['void', 'microtype', 'poster', 'logoHit']

function estimateNegativeSpace(elements: readonly CutbankElement[]): number {
  let covered = 0
  for (const el of elements) {
    if (el.type === 'media') covered += clamp01(Math.min(1, el.w) * Math.min(1, el.h))
    else covered += clamp01(el.fontH * el.fontH * 4)
  }
  return clamp01(1 - covered)
}

export function buildCutbankComposition(input: CutbankLayoutInput): CutbankComposition {
  const env = resolveCutbankFreedomEnvelope(input.freedom)
  const layout = resolveEffectiveCutbankLayout(input.layout, input.layerCount)
  const rng = createCutbankRng(input.seed ^ 0x9e3779b9)
  const budget = cutbankElementBudget(input.complexity, input.layerCount)
  const built = builders[layout](input, rng, env, budget)
  const maxElements = clamp(Math.round(input.layerCount), 1, 4)
  const elements = built.slice(0, maxElements)
  const backdrop = PAPER_LAYOUTS.includes(layout) && rng() < env.variety * 0.35 ? 'paper' : 'ink'
  return {
    seed: input.seed,
    layout,
    requestedLayout: input.requestedLayout,
    elements,
    backdrop,
    negativeSpace: estimateNegativeSpace(elements),
  }
}
