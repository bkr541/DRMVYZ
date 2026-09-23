import type { CutbankFramePlan } from './CutbankRuntime'
import type {
  CutbankColorRole, CutbankComposition, CutbankElement, CutbankMediaElement, CutbankTextElement,
} from './CutbankLayouts'
import { clamp, clamp01 } from './CutbankRandom'
import type { CutbankRgb } from './CutbankPalette'
import type { CutbankMotionPlan, CutbankTreatmentPlan } from './CutbankTreatment'

export interface CutbankDrawable {
  source: CanvasImageSource
  width: number
  height: number
  /** Mean luminance (0..1) of an SVG's opaque pixels, when known. */
  svgLuma?: number | null
}

export interface CutbankComposeStats {
  drawnElements: number
  missingElements: number
}

type Ctx = CanvasRenderingContext2D

const INK_ON_DARK = '#f4f2ea'
const INK_ON_PAPER = '#0a0a0a'
const BACKDROP_INK = '#050505'
const BACKDROP_PAPER = '#eeeadf'
const FONT_FAMILY = '"Helvetica Neue", "Arial Black", Arial, sans-serif'
const CAP_HEIGHT_RATIO = 0.72

const rgbToCss = (rgb: CutbankRgb) => `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`

/** Cheap deterministic hash in 0..1 for per-frame jitter (never Math.random). */
function hash1(x: number): number {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

const wrapCache = new Map<string, string[]>()

function wrapText(ctx: Ctx, text: string, maxWidthPx: number, font: string): string[] {
  const key = `${font}|${Math.round(maxWidthPx)}|${text}`
  const cached = wrapCache.get(key)
  if (cached) return cached
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > maxWidthPx) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  const result = lines.length > 0 ? lines : ['']
  if (wrapCache.size > 96) wrapCache.clear()
  wrapCache.set(key, result)
  return result
}

function roleColor(role: CutbankColorRole, onPaper: boolean, accent1: CutbankRgb, accent2: CutbankRgb): string {
  if (role === 'accent1') return rgbToCss(accent1)
  if (role === 'accent2') return rgbToCss(accent2)
  return onPaper ? INK_ON_PAPER : INK_ON_DARK
}

interface GroupParams {
  ctx: Ctx
  width: number
  height: number
  composition: CutbankComposition
  resolveDrawable: (mediaId: string) => CutbankDrawable | null
  items: CutbankFramePlan['items']
  motion: CutbankMotionPlan
  treatment: CutbankTreatmentPlan
  accent1: CutbankRgb
  accent2: CutbankRgb
  downbeat: number
  stats: CutbankComposeStats
}

function elementMotion(el: CutbankElement, index: number, motion: CutbankMotionPlan, seed: number, width: number, height: number) {
  const phase = motion.phase + index * 1.7 + (seed % 97) * 0.13
  const weight = el.drift
  const jitterSeed = Math.floor(motion.phase * 6) + index * 13 + (seed % 101)
  return {
    dx: (Math.sin(phase * 0.9) * motion.driftAmp * weight + (hash1(jitterSeed) - 0.5) * 2 * motion.jitterAmp) * width,
    dy: (Math.cos(phase * 0.7) * motion.driftAmp * weight * 0.8 + (hash1(jitterSeed + 7) - 0.5) * 2 * motion.jitterAmp) * height,
    scale: 1 + (motion.scalePulse - 1) * (0.5 + weight * 0.5),
    rotation: motion.rotationKick * (index % 2 === 0 ? 1 : -1) * weight,
  }
}

function drawMedia(g: GroupParams, el: CutbankMediaElement, index: number, onPaper: boolean): void {
  const item = g.items.get(el.itemKey)
  const drawable = item?.mediaId ? g.resolveDrawable(item.mediaId) : null
  if (!drawable || drawable.width <= 0 || drawable.height <= 0) {
    g.stats.missingElements += 1
    return
  }
  const { ctx, width: W, height: H } = g
  const m = elementMotion(el, index, g.motion, g.composition.seed, W, H)
  const winW = el.w * W * m.scale
  const winH = el.h * H * m.scale
  const cx = el.cx * W + m.dx
  const cy = el.cy * H + m.dy
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(el.rotation + m.rotation)
  ctx.globalAlpha *= clamp01(el.opacity)
  let scale: number
  if (el.fit === 'cover') {
    scale = Math.max(winW / drawable.width, winH / drawable.height) * Math.max(1, el.zoom)
    ctx.beginPath()
    ctx.rect(-winW / 2, -winH / 2, winW, winH)
    ctx.clip()
  } else {
    scale = Math.min(winW / drawable.width, winH / drawable.height)
  }
  const dw = drawable.width * scale
  const dh = drawable.height * scale
  const ox = el.fit === 'cover' ? -winW / 2 - (dw - winW) * el.focusX : -dw / 2
  const oy = el.fit === 'cover' ? -winH / 2 - (dh - winH) * el.focusY : -dh / 2
  try {
    const luma = drawable.svgLuma
    if (item?.kind === 'svg' && luma != null && ((!onPaper && luma < 0.35) || (onPaper && luma > 0.65))) {
      // Dark logo on a dark field (or light on paper): draw it as a solid silhouette so it stays legible.
      silhouette(ctx, drawable.source, ox, oy, dw, dh, onPaper ? INK_ON_PAPER : INK_ON_DARK)
    } else {
      ctx.drawImage(drawable.source, ox, oy, dw, dh)
    }
    g.stats.drawnElements += 1
  } catch {
    g.stats.missingElements += 1
  }
  ctx.restore()
}

let silhouetteCanvas: HTMLCanvasElement | null = null

/** Frees the shared scratch canvas and text-wrap cache; called when CUTBANK is left. */
export function releaseCutbankComposeScratch(): void {
  if (silhouetteCanvas) {
    silhouetteCanvas.width = 0
    silhouetteCanvas.height = 0
    silhouetteCanvas = null
  }
  wrapCache.clear()
}
function silhouette(ctx: Ctx, source: CanvasImageSource, x: number, y: number, w: number, h: number, color: string): void {
  if (typeof document === 'undefined') { ctx.drawImage(source, x, y, w, h); return }
  const sw = Math.max(1, Math.ceil(w))
  const sh = Math.max(1, Math.ceil(h))
  silhouetteCanvas ??= document.createElement('canvas')
  if (silhouetteCanvas.width !== sw || silhouetteCanvas.height !== sh) {
    silhouetteCanvas.width = sw
    silhouetteCanvas.height = sh
  }
  const sctx = silhouetteCanvas.getContext('2d')
  if (!sctx) { ctx.drawImage(source, x, y, w, h); return }
  sctx.globalCompositeOperation = 'source-over'
  sctx.clearRect(0, 0, sw, sh)
  sctx.drawImage(source, 0, 0, sw, sh)
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = color
  sctx.fillRect(0, 0, sw, sh)
  ctx.drawImage(silhouetteCanvas, x, y, w, h)
}

function drawText(g: GroupParams, el: CutbankTextElement, index: number, onPaper: boolean): void {
  const item = g.items.get(el.itemKey)
  const text = item?.text
  if (!text) {
    g.stats.missingElements += 1
    return
  }
  const { ctx, width: W, height: H } = g
  const m = elementMotion(el, index, g.motion, g.composition.seed, W, H)
  const px = Math.max(4, (el.fontH * H * m.scale) / CAP_HEIGHT_RATIO)
  const font = `800 ${px.toFixed(1)}px ${FONT_FAMILY}`
  ctx.save()
  ctx.font = font
  const limit = (Math.abs(el.rotation) > 1.2 && Math.abs(el.rotation) < 1.95 ? H : W) * el.maxWidth / Math.max(0.2, el.stretchX)
  const tracking = el.tracking + g.downbeat * 0.12 * g.motion.motionScale
  const letterSpacing = `${(tracking * px).toFixed(1)}px`
  ;(ctx as unknown as { letterSpacing?: string }).letterSpacing = letterSpacing
  const lines = wrapText(ctx, text, limit, font)
  // Keep a single long word inside its frame unless the layout deliberately bleeds (maxWidth > 1).
  let widest = 0
  for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width)
  const fit = el.maxWidth <= 1 && widest > limit * 1.04 ? (limit * 1.04) / widest : 1
  const lineHeight = px * 0.98
  const total = lines.length * lineHeight
  ctx.textBaseline = 'middle'
  ctx.textAlign = el.align
  ctx.translate(el.cx * W + m.dx, el.cy * H + m.dy)
  ctx.rotate(el.rotation + m.rotation)
  ctx.scale(el.stretchX * fit, el.stretchY * fit)
  const color = roleColor(el.colorRole, onPaper, g.accent1, g.accent2)
  const signal = g.treatment.signal
  const jitter = g.treatment.jitter
  const frame = Math.floor(g.motion.phase * 5)
  for (let r = 0; r < el.repeat; r += 1) {
    ctx.globalAlpha = clamp01(el.opacity) * (r === 0 ? 1 : Math.max(0.15, 0.6 - r * 0.15))
    ctx.fillStyle = color
    const repeatShift = r * el.repeatStep * px * 0.55
    lines.forEach((line, li) => {
      const y = li * lineHeight - total / 2 + lineHeight / 2 + repeatShift
      // Signal damage → per-line offset; jitter → per-character wobble.
      const lineOffset = signal > 0.02 ? (hash1(frame + li * 3.1 + index) - 0.5) * signal * px * 0.35 : 0
      const x = el.align === 'left' ? -limit / 2 : el.align === 'right' ? limit / 2 : 0
      if (jitter > 0.25 && line.length <= 28) {
        let cursor = x - (ctx.measureText(line).width) / 2
        ctx.textAlign = 'left'
        for (let c = 0; c < line.length; c += 1) {
          const ch = line[c]
          const jx = (hash1(frame + c * 1.7 + li) - 0.5) * jitter * px * 0.12
          const jy = (hash1(frame + c * 2.3 + li + 9) - 0.5) * jitter * px * 0.16
          ctx.fillText(ch, cursor + jx + lineOffset, y + jy)
          cursor += ctx.measureText(ch).width
        }
        ctx.textAlign = el.align
      } else {
        ctx.fillText(line, x + lineOffset, y)
      }
    })
  }
  ctx.restore()
  g.stats.drawnElements += 1
}

function drawGroup(g: GroupParams): void {
  const { ctx, width: W, height: H, composition } = g
  const onPaper = composition.backdrop === 'paper'
  ctx.save()
  ctx.fillStyle = onPaper ? BACKDROP_PAPER : BACKDROP_INK
  ctx.fillRect(0, 0, W, H)
  composition.elements.forEach((el, index) => {
    ctx.save()
    if (el.type === 'media') drawMedia(g, el, index, onPaper)
    else drawText(g, el, index, onPaper)
    ctx.restore()
  })
  ctx.restore()
}

export interface CutbankComposeInput {
  plan: CutbankFramePlan
  width: number
  height: number
  resolveDrawable: (mediaId: string) => CutbankDrawable | null
}

/**
 * Canvas2D compositor for CUTBANK's editorial frame: media windows, native text,
 * and the two-composition transition handoff (reusing the CanvasTransitions
 * visual state, plus CUTBANK's wipe / collapse processing for the styles that
 * Canvas has no equivalent for). Post-processing lives in the GL treat pass.
 */
export function composeCutbankFrame(ctx: Ctx, input: CutbankComposeInput): CutbankComposeStats {
  const { plan, width: W, height: H } = input
  const stats: CutbankComposeStats = { drawnElements: 0, missingElements: 0 }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = BACKDROP_INK
  ctx.fillRect(0, 0, W, H)

  const base = {
    ctx, width: W, height: H, resolveDrawable: input.resolveDrawable, items: plan.items, motion: plan.motion,
    treatment: plan.treatment, accent1: plan.palette.accent1, accent2: plan.palette.accent2,
    downbeat: plan.impulses.downbeat, stats,
  }
  const current = plan.current
  if (!current) { ctx.restore(); return stats }
  const outgoing = plan.outgoing
  const t = plan.transition

  if (!t || !outgoing) {
    drawGroup({ ...base, composition: current })
    ctx.restore()
    return stats
  }

  const v = t.visual
  const wipe = t.spec.wipe
  const withTransform = (offX: number, offY: number, scale: number, rot: number, alpha: number, draw: () => void) => {
    ctx.save()
    ctx.globalAlpha = clamp01(alpha)
    ctx.translate(W / 2 + offX * W, H / 2 + offY * H)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.scale(scale, scale)
    ctx.translate(-W / 2, -H / 2)
    draw()
    ctx.restore()
  }

  if (wipe === 'collapse') {
    drawGroup({ ...base, composition: current })
    const p = t.progress
    withTransform(0, 0, Math.max(0.05, 1 - 0.9 * p), -14 * p, 1 - p * 0.6, () => drawGroup({ ...base, composition: outgoing }))
  } else if (wipe === 'vertical' || wipe === 'horizontalBands') {
    drawGroup({ ...base, composition: outgoing })
    const p = t.progress
    ctx.save()
    ctx.beginPath()
    if (wipe === 'vertical') {
      ctx.rect(0, 0, W * p, H)
    } else {
      const bands = 8
      for (let i = 0; i < bands; i += 1) {
        const bp = clamp(p * 1.7 - (i / bands) * 0.7, 0, 1)
        const bh = H / bands
        ctx.rect(i % 2 === 0 ? 0 : W * (1 - bp), i * bh, W * bp, bh + 1)
      }
    }
    ctx.clip()
    drawGroup({ ...base, composition: current })
    ctx.restore()
  } else {
    // Crossfade-style handoff: while both are partial the outgoing stays solid so mid-fade does not dim.
    const crossing = v.incomingOpacity > 0 && v.outgoingOpacity > 0
    withTransform(v.outgoingOffsetX, v.outgoingOffsetY, v.outgoingScale, v.outgoingRotation, crossing ? 1 : v.outgoingOpacity, () => drawGroup({ ...base, composition: outgoing }))
    withTransform(v.incomingOffsetX, v.incomingOffsetY, v.incomingScale, v.incomingRotation, v.incomingOpacity, () => drawGroup({ ...base, composition: current }))
  }
  ctx.restore()
  return stats
}
