/**
 * Centralized VYZUALZ timeline transition renderer.
 * Pure canvas operations — no React, no store imports.
 *
 * Each transition receives raw progress (0→1) and applies its own easing
 * internally via getEasedProgress().
 */

import type { VzTransitionConfig, VzTransitionType } from '../types/timeline'
import { getEasedProgress } from './timeline'
import type { SingleClipTransitionState } from './timeline'

// ── Public types ──────────────────────────────────────────────────────────────

export interface DrawRect {
  ox: number
  oy: number
  sw: number
  sh: number
}

export interface TransitionRenderParams {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  /** Outgoing clip source (media element or pre-rendered GPU canvas; null = no media). */
  outEl: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null
  outRect: DrawRect
  /** Incoming clip source (media element or pre-rendered GPU canvas; null = no media / not yet loaded). */
  inEl: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null
  inRect: DrawRect
  config: VzTransitionConfig
  /** Raw linear 0→1 progress. Easing applied internally per transition. */
  progress: number
  /** Elapsed ms from canvas start (for animated/noise effects). */
  time: number
  /** 0–1 hue rotation from active Color Shift effect (0 = no rotate). */
  colorShift: number
  /** 0–1 bass energy (used by bassImpactZoom). */
  bass: number
  /** 0–1 beat pulse energy (used by bassImpactZoom, particleExplosion). */
  beat: number
  /** Canvas globalCompositeOperation for the outgoing clip. */
  outCompositeOp: GlobalCompositeOperation
  /** Canvas globalCompositeOperation for the incoming clip. */
  inCompositeOp: GlobalCompositeOperation
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

/** Deterministic pseudo-random: hash of float → 0..1 */
function h(x: number): number {
  const s = Math.sin(x) * 43758.5453
  return s - Math.floor(s)
}

function withSave(ctx: CanvasRenderingContext2D, fn: () => void): void {
  ctx.save()
  fn()
  ctx.restore()
}

function drawClip(
  ctx: CanvasRenderingContext2D,
  el: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  rect: DrawRect,
  alpha: number,
  compositeOp: GlobalCompositeOperation,
  colorShift: number,
): void {
  withSave(ctx, () => {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
    if (compositeOp !== 'source-over') ctx.globalCompositeOperation = compositeOp
    if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
    ctx.drawImage(el, rect.ox, rect.oy, rect.sw, rect.sh)
    ctx.filter = 'none'
    ctx.globalCompositeOperation = 'source-over'
  })
}

function fillWhite(ctx: CanvasRenderingContext2D, alpha: number, W: number, H: number): void {
  if (alpha <= 0.01) return
  withSave(ctx, () => {
    ctx.globalAlpha = Math.min(1, alpha)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
  })
}

// ── Individual renderers ──────────────────────────────────────────────────────

function renderCut(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
): void {
  // cut should never be called with a non-zero overlap, but handle defensively
  if (p < 1) {
    if (outEl) drawClip(ctx, outEl, outRect, 1, outCompositeOp, colorShift)
  } else {
    if (inEl) drawClip(ctx, inEl, inRect, 1, inCompositeOp, colorShift)
  }
  void W; void H
}

function renderCrossfade(
  { ctx, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
): void {
  if (outEl) drawClip(ctx, outEl, outRect, 1 - p, outCompositeOp, colorShift)
  if (inEl)  drawClip(ctx, inEl,  inRect,  p,     inCompositeOp,  colorShift)
}

function renderFlash(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  if (outEl) drawClip(ctx, outEl, outRect, Math.max(0, 1 - p * 2), outCompositeOp, colorShift)
  if (inEl)  drawClip(ctx, inEl,  inRect,  Math.min(1, Math.max(0, (p - 0.25) * 2)), inCompositeOp, colorShift)
  fillWhite(ctx, Math.sin(p * Math.PI) * 0.88 * str, W, H)
}

function renderGlitch(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  const chaos = Math.sin(p * Math.PI) * str

  if (outEl) {
    drawClip(ctx, outEl, outRect, 1 - chaos * 0.35, outCompositeOp, colorShift)

    // Horizontal slice jitter
    const numSlices = Math.ceil(2 + chaos * 7)
    for (let i = 0; i < numSlices; i++) {
      const sliceY  = Math.floor(h(i * 17.3 + p * 100) * H)
      const sliceHt = Math.max(1, Math.floor(h(i * 31.7 + p * 50) * 22 + 3))
      const jitterX = (h(i * 11.9 + p * 200) - 0.5) * chaos * 55
      withSave(ctx, () => {
        ctx.beginPath()
        ctx.rect(0, sliceY, W, Math.min(sliceHt, H - sliceY))
        ctx.clip()
        ctx.drawImage(outEl, outRect.ox + jitterX, outRect.oy, outRect.sw, outRect.sh)
      })
    }

    // RGB split burst
    if (chaos > 0.2) {
      const shift = chaos * 20
      withSave(ctx, () => {
        ctx.globalCompositeOperation = 'screen'
        ctx.globalAlpha = chaos * 0.55
        ctx.filter = 'sepia(1) saturate(5) hue-rotate(-40deg)'
        ctx.drawImage(outEl, outRect.ox - shift, outRect.oy, outRect.sw, outRect.sh)
        ctx.filter = 'sepia(1) saturate(5) hue-rotate(200deg)'
        ctx.drawImage(outEl, outRect.ox + shift, outRect.oy, outRect.sw, outRect.sh)
        ctx.filter = 'none'
      })
    }
  }

  if (inEl && chaos > 0.45) {
    drawClip(ctx, inEl, inRect, Math.min(1, (chaos - 0.45) * 1.82), inCompositeOp, colorShift)
  }

  if (chaos > 0.6) {
    fillWhite(ctx, (chaos - 0.6) * 2.5 * 0.4, W, H)
  }
}

function renderWipe(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
  dir: 'left' | 'right' | 'up' | 'down',
): void {
  // Draw outgoing full frame
  if (outEl) drawClip(ctx, outEl, outRect, 1, outCompositeOp, colorShift)

  if (!inEl) return

  // Clip region for incoming
  const clipRect = (() => {
    switch (dir) {
      case 'right': return { x: 0,           y: 0, w: p * W,        ht: H }
      case 'left':  return { x: (1 - p) * W, y: 0, w: p * W,        ht: H }
      case 'down':  return { x: 0,           y: 0, w: W,            ht: p * H }
      case 'up':    return { x: 0,           y: (1 - p) * H, w: W,  ht: p * H }
    }
  })()

  withSave(ctx, () => {
    ctx.beginPath()
    ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.ht)
    ctx.clip()
    drawClip(ctx, inEl, inRect, 1, inCompositeOp, colorShift)
  })

  // Bright cyan edge at wipe boundary
  const edgeAlpha = 0.7 * str
  withSave(ctx, () => {
    ctx.strokeStyle = `rgba(74,199,219,${edgeAlpha})`
    ctx.lineWidth = 2
    ctx.beginPath()
    switch (dir) {
      case 'right': ctx.moveTo(p * W, 0); ctx.lineTo(p * W, H); break
      case 'left':  ctx.moveTo((1 - p) * W, 0); ctx.lineTo((1 - p) * W, H); break
      case 'down':  ctx.moveTo(0, p * H); ctx.lineTo(W, p * H); break
      case 'up':    ctx.moveTo(0, (1 - p) * H); ctx.lineTo(W, (1 - p) * H); break
    }
    ctx.stroke()
  })
}

function renderZoomIn(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
): void {
  const cx = W / 2, cy = H / 2

  // Outgoing zooms in and fades
  if (outEl) {
    withSave(ctx, () => {
      ctx.globalAlpha = Math.max(0, 1 - p)
      if (outCompositeOp !== 'source-over') ctx.globalCompositeOperation = outCompositeOp
      if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
      const scale = 1 + p * 0.12
      ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy)
      ctx.drawImage(outEl, outRect.ox, outRect.oy, outRect.sw, outRect.sh)
      ctx.filter = 'none'
    })
  }

  // Incoming fades in at normal scale (subtle blur at midpoint)
  if (inEl) {
    const blurPx = Math.sin(p * Math.PI) * 4
    withSave(ctx, () => {
      ctx.globalAlpha = p
      if (inCompositeOp !== 'source-over') ctx.globalCompositeOperation = inCompositeOp
      if (colorShift > 0 || blurPx > 0.5) {
        ctx.filter = [
          colorShift > 0 ? `hue-rotate(${colorShift * 360}deg)` : '',
          blurPx > 0.5   ? `blur(${blurPx.toFixed(1)}px)`       : '',
        ].filter(Boolean).join(' ')
      }
      ctx.drawImage(inEl, inRect.ox, inRect.oy, inRect.sw, inRect.sh)
      ctx.filter = 'none'
    })
  }
}

function renderZoomOut(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
): void {
  const cx = W / 2, cy = H / 2

  // Outgoing fades out
  if (outEl) drawClip(ctx, outEl, outRect, Math.max(0, 1 - p), outCompositeOp, colorShift)

  // Incoming starts scaled up and settles to normal
  if (inEl) {
    const scale = 1.12 - p * 0.12
    withSave(ctx, () => {
      ctx.globalAlpha = p
      if (inCompositeOp !== 'source-over') ctx.globalCompositeOperation = inCompositeOp
      if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
      ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy)
      ctx.drawImage(inEl, inRect.ox, inRect.oy, inRect.sw, inRect.sh)
      ctx.filter = 'none'
    })
  }
}

function renderBlurCrossfade(
  { ctx, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  const blurPx = Math.sin(p * Math.PI) * 10 * str

  const buildFilter = (shift: number, blur: number): string =>
    [shift > 0 ? `hue-rotate(${shift * 360}deg)` : '', blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : '']
      .filter(Boolean).join(' ') || 'none'

  if (outEl) {
    withSave(ctx, () => {
      ctx.globalAlpha = Math.max(0, 1 - p)
      if (outCompositeOp !== 'source-over') ctx.globalCompositeOperation = outCompositeOp
      ctx.filter = buildFilter(colorShift, blurPx)
      ctx.drawImage(outEl, outRect.ox, outRect.oy, outRect.sw, outRect.sh)
      ctx.filter = 'none'
    })
  }

  if (inEl) {
    withSave(ctx, () => {
      ctx.globalAlpha = p
      if (inCompositeOp !== 'source-over') ctx.globalCompositeOperation = inCompositeOp
      ctx.filter = buildFilter(colorShift, blurPx)
      ctx.drawImage(inEl, inRect.ox, inRect.oy, inRect.sw, inRect.sh)
      ctx.filter = 'none'
    })
  }
}

function renderLumaFade(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  // Outgoing darkens and fades
  if (outEl) {
    withSave(ctx, () => {
      ctx.globalAlpha = Math.max(0, 1 - p)
      if (outCompositeOp !== 'source-over') ctx.globalCompositeOperation = outCompositeOp
      const brightness = 1 - p * 0.55
      const hue = colorShift > 0 ? `hue-rotate(${colorShift * 360}deg) ` : ''
      ctx.filter = `${hue}brightness(${brightness.toFixed(2)})`
      ctx.drawImage(outEl, outRect.ox, outRect.oy, outRect.sw, outRect.sh)
      ctx.filter = 'none'
    })
  }

  // White luma threshold flash at midpoint
  fillWhite(ctx, Math.sin(p * Math.PI) * 0.55 * str, W, H)

  // Incoming brightens in
  if (inEl) {
    withSave(ctx, () => {
      ctx.globalAlpha = p
      if (inCompositeOp !== 'source-over') ctx.globalCompositeOperation = inCompositeOp
      const brightness = 1 + (1 - p) * 0.35
      const hue = colorShift > 0 ? `hue-rotate(${colorShift * 360}deg) ` : ''
      ctx.filter = `${hue}brightness(${brightness.toFixed(2)})`
      ctx.drawImage(inEl, inRect.ox, inRect.oy, inRect.sw, inRect.sh)
      ctx.filter = 'none'
    })
  }
}

function renderAdditiveBlend(
  { ctx, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift, config }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  // Outgoing fades slightly
  if (outEl) drawClip(ctx, outEl, outRect, 1 - p * 0.5, outCompositeOp, colorShift)

  if (!inEl) return

  // Additive pass (lighter blend)
  const blendOp = (config.blendMode ?? 'lighter') as GlobalCompositeOperation
  withSave(ctx, () => {
    ctx.globalCompositeOperation = blendOp
    ctx.globalAlpha = p * str * 0.85
    if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
    ctx.drawImage(inEl, inRect.ox, inRect.oy, inRect.sw, inRect.sh)
    ctx.filter = 'none'
  })

  // Second pass: opaque incoming overtakes in the second half
  if (p > 0.4) {
    drawClip(ctx, inEl, inRect, (p - 0.4) / 0.6, inCompositeOp, colorShift)
  }
}

function renderRgbTear(
  { ctx, W, H, outEl, outRect, inEl, inRect, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  const numBands = 10

  // Draw outgoing with horizontal tear bands
  if (outEl) {
    for (let i = 0; i < numBands; i++) {
      const phase = i / numBands
      const tearOffset = Math.sin(p * Math.PI * 3 + phase * 6.28) * str * 28 * (1 - p)
      withSave(ctx, () => {
        const bandH = H / numBands
        ctx.beginPath()
        ctx.rect(0, i * bandH, W, bandH)
        ctx.clip()
        ctx.drawImage(outEl, outRect.ox + tearOffset, outRect.oy, outRect.sw, outRect.sh)
      })
    }

    // RGB channel split on outgoing
    if (p < 0.8) {
      const rgbShift = p * str * 18
      withSave(ctx, () => {
        ctx.globalCompositeOperation = 'screen'
        ctx.globalAlpha = (1 - p) * 0.45
        ctx.filter = 'sepia(1) saturate(5) hue-rotate(-40deg)'
        ctx.drawImage(outEl, outRect.ox - rgbShift, outRect.oy, outRect.sw, outRect.sh)
        ctx.filter = 'sepia(1) saturate(5) hue-rotate(200deg)'
        ctx.drawImage(outEl, outRect.ox + rgbShift, outRect.oy, outRect.sw, outRect.sh)
        ctx.filter = 'none'
      })
    }
  }

  // Incoming fades in
  if (inEl) drawClip(ctx, inEl, inRect, p, inCompositeOp, colorShift)
}

function renderDatamoshCut(
  { ctx, outEl, outRect, inEl, inRect, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  const ghostCount = 5

  // Ghost copies of outgoing smeared around
  if (outEl) {
    for (let i = 0; i < ghostCount; i++) {
      const offX = Math.sin(i * 1.37 + p * 11) * p * str * 22
      const offY = Math.cos(i * 0.91 + p * 7)  * p * str * 9
      withSave(ctx, () => {
        ctx.globalAlpha = (1 - p) * 0.22 * (1 - i / ghostCount)
        ctx.globalCompositeOperation = 'lighter'
        if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
        ctx.drawImage(outEl, outRect.ox + offX, outRect.oy + offY, outRect.sw, outRect.sh)
        ctx.filter = 'none'
      })
    }

    // Primary outgoing fades
    drawClip(ctx, outEl, outRect, Math.max(0, 1 - p * 1.3), 'source-over', colorShift)
  }

  // Incoming fades in with slight entry smear
  if (inEl) {
    if (p > 0.15) {
      drawClip(ctx, inEl, inRect, Math.min(1, (p - 0.15) / 0.85), inCompositeOp, colorShift)
    }
  }
}

function renderScanlineWipe(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  // Draw outgoing base
  if (outEl) drawClip(ctx, outEl, outRect, 1, outCompositeOp, colorShift)
  if (!inEl) return

  const bandH = 4
  const numBands = Math.ceil(H / bandH)
  const phases = [0, 0.1, 0.2]  // 3-cycle stagger

  // Reveal incoming through staggered scanline bands
  withSave(ctx, () => {
    ctx.beginPath()
    for (let i = 0; i < numBands; i++) {
      const delay = phases[i % 3]
      const scale = 1 - delay
      const lp = scale > 0 ? Math.min(1, Math.max(0, (p - delay) / scale)) : 1
      if (lp <= 0) continue
      const ly = i * bandH
      ctx.rect(0, ly, W, Math.min(bandH, H - ly))
    }
    ctx.clip()
    drawClip(ctx, inEl, inRect, 1, inCompositeOp, colorShift)
  })

  // Cyan scanline highlights at wipe front
  withSave(ctx, () => {
    ctx.strokeStyle = `rgba(74,199,219,${0.5 * str})`
    ctx.lineWidth = 1
    for (let i = 0; i < numBands; i += 4) {
      const delay = phases[i % 3]
      const scale = 1 - delay
      const lp = scale > 0 ? Math.min(1, Math.max(0, (p - delay) / scale)) : 1
      if (lp <= 0 || lp >= 1) continue
      const ly = i * bandH
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke()
    }
  })
}

function renderPixelSort(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
): void {
  // Base outgoing
  if (outEl) drawClip(ctx, outEl, outRect, 1, outCompositeOp, colorShift)
  if (!inEl) return

  const stripW = 4
  const numStrips = Math.ceil(W / stripW)

  // Reveal incoming via vertical strips with random phase
  withSave(ctx, () => {
    ctx.beginPath()
    for (let i = 0; i < numStrips; i++) {
      const phase  = h(i * 7.31) * 0.6
      const lp     = Math.min(1, Math.max(0, p > phase ? (p - phase) / (1 - phase * 0.5) : 0))
      if (lp <= 0) continue
      const sx = i * stripW
      const revealH = lp * H
      // Random direction per strip
      if (h(i * 3.17) > 0.5) {
        ctx.rect(sx, 0, stripW, revealH)
      } else {
        ctx.rect(sx, H - revealH, stripW, revealH)
      }
    }
    ctx.clip()
    drawClip(ctx, inEl, inRect, 1, inCompositeOp, colorShift)
  })
}

function renderRadialWipe(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  const cx = W / 2, cy = H / 2
  const maxR = Math.max(W, H)
  const startAngle = -Math.PI / 2
  const endAngle   = startAngle + p * Math.PI * 2

  if (outEl) drawClip(ctx, outEl, outRect, 1, outCompositeOp, colorShift)
  if (!inEl) return

  // Incoming through angular sector
  withSave(ctx, () => {
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, maxR, startAngle, endAngle)
    ctx.closePath()
    ctx.clip()
    drawClip(ctx, inEl, inRect, 1, inCompositeOp, colorShift)
  })

  // Bright radial edge at sweep boundary (only mid-transition)
  if (p > 0.02 && p < 0.98) {
    withSave(ctx, () => {
      ctx.strokeStyle = `rgba(74,199,219,${0.65 * str})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(endAngle) * maxR, cy + Math.sin(endAngle) * maxR)
      ctx.stroke()
    })
  }
}

function renderCircleIris(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  const cx = W / 2, cy = H / 2
  const maxR = Math.hypot(W, H) / 2 * 1.05
  const r = p * maxR

  if (outEl) drawClip(ctx, outEl, outRect, 1, outCompositeOp, colorShift)
  if (!inEl) return

  // Incoming through expanding circle
  withSave(ctx, () => {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    drawClip(ctx, inEl, inRect, 1, inCompositeOp, colorShift)
  })

  // Glowing ring at edge (skip near start/end)
  if (r > 2 && p < 0.97) {
    for (const [lw, alpha] of [[8, 0.15], [4, 0.45], [2, 0.85]] as [number, number][]) {
      withSave(ctx, () => {
        ctx.strokeStyle = `rgba(74,199,219,${alpha * str})`
        ctx.lineWidth = lw
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      })
    }
  }
}

function renderBassImpactZoom(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift, bass, beat }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  const cx = W / 2, cy = H / 2
  // Impact energy: use bass/beat if available, fall back to intensity
  const energy = Math.max(bass, beat) > 0 ? Math.max(bass, beat) : str

  // Front-loaded punch: strongest at start, gone by p=0.5
  const punch = Math.max(0, 1 - p * 2) * energy * str

  // Flash on impact
  fillWhite(ctx, punch * 0.65, W, H)

  // Outgoing: zoom + fade
  if (outEl) {
    withSave(ctx, () => {
      ctx.globalAlpha = Math.max(0, 1 - p * 1.5)
      if (outCompositeOp !== 'source-over') ctx.globalCompositeOperation = outCompositeOp
      if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
      const s = 1 + p * 0.1
      ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy)
      ctx.drawImage(outEl, outRect.ox, outRect.oy, outRect.sw, outRect.sh)
      ctx.filter = 'none'
    })
  }

  // Incoming: slams in with slight overshoot then settles
  if (inEl) {
    const inScale = p < 0.5
      ? 1.08 - p * 0.08          // 1.08 → 1.04
      : 1.04 + (p - 0.5) * 0.0   // settles to ~1.04 then snap to 1
    withSave(ctx, () => {
      ctx.globalAlpha = Math.min(1, p * 2)
      if (inCompositeOp !== 'source-over') ctx.globalCompositeOperation = inCompositeOp
      if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
      ctx.translate(cx, cy); ctx.scale(inScale, inScale); ctx.translate(-cx, -cy)
      ctx.drawImage(inEl, inRect.ox, inRect.oy, inRect.sw, inRect.sh)
      ctx.filter = 'none'
    })

    // Shake ghost: subtle translated copy
    if (punch > 0.1) {
      const sx = Math.sin(p * 53.7) * punch * 7
      const sy = Math.cos(p * 37.1) * punch * 5
      withSave(ctx, () => {
        ctx.globalAlpha = 0.12
        ctx.translate(sx, sy)
        ctx.drawImage(inEl, inRect.ox, inRect.oy, inRect.sw, inRect.sh)
      })
    }
  }
}

function renderShockwaveReveal(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  const cx = W / 2, cy = H / 2
  const maxR  = Math.hypot(W, H) * 0.75
  const waveR = p * maxR * 1.35
  const waveBand = maxR * 0.22

  if (outEl) drawClip(ctx, outEl, outRect, 1, outCompositeOp, colorShift)
  if (!inEl) return

  // Incoming reveals inside the wave front
  const innerR = Math.max(0, waveR - waveBand)
  if (innerR > 0) {
    withSave(ctx, () => {
      ctx.beginPath()
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
      ctx.clip()
      drawClip(ctx, inEl, inRect, 1, inCompositeOp, colorShift)
    })
  }

  // Shockwave ring glow
  const ringAlpha = Math.sin(p * Math.PI) * str
  if (ringAlpha > 0.03 && waveR > 0) {
    withSave(ctx, () => {
      const grd = ctx.createRadialGradient(cx, cy, Math.max(0, waveR - waveBand), cx, cy, waveR)
      grd.addColorStop(0,   `rgba(74,199,219,0)`)
      grd.addColorStop(0.45, `rgba(74,199,219,${ringAlpha * 0.7})`)
      grd.addColorStop(0.75, `rgba(255,255,255,${ringAlpha * 0.4})`)
      grd.addColorStop(1,   `rgba(74,199,219,0)`)
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(cx, cy, waveR, 0, Math.PI * 2)
      ctx.fill()
    })
  }
}

function renderParticleExplosion(
  { ctx, W, H, outEl, outRect, inEl, inRect, outCompositeOp, inCompositeOp, colorShift }: TransitionRenderParams,
  p: number,
  str: number,
): void {
  const cx = W / 2, cy = H / 2
  const baseSize = Math.max(2, Math.min(W, H) * 0.005)

  // Outgoing fades out quickly
  if (outEl) drawClip(ctx, outEl, outRect, Math.max(0, 1 - p * 1.6), outCompositeOp, colorShift)

  // Incoming fades in
  if (inEl && p > 0.1) {
    drawClip(ctx, inEl, inRect, Math.min(1, (p - 0.1) / 0.9), inCompositeOp, colorShift)
  }

  // Particle burst — deterministic based on progress
  const particleLife = 0.75
  if (p < particleLife) {
    const lp = p / particleLife  // 0→1 within particle lifetime
    const numParticles = 128

    for (let i = 0; i < numParticles; i++) {
      const angle  = h(i * 13.7)  * Math.PI * 2
      const speed  = 0.3 + h(i * 23.1 + 5.3) * 0.7
      const size   = baseSize * (1 + h(i * 7.4 + 11.2) * 2.5)
      const dist   = speed * lp * Math.min(W, H) * 0.42
      const px     = cx + Math.cos(angle) * dist
      const py     = cy + Math.sin(angle) * dist
      const fade   = (1 - lp) * (0.5 + h(i * 5.9) * 0.5) * str

      if (fade < 0.02) continue

      // Cyan / magenta / white color cycle
      const cs = h(i * 5.91)
      const color = cs < 0.33
        ? `rgba(74,199,219,${fade})`
        : cs < 0.66
        ? `rgba(200,74,219,${fade})`
        : `rgba(255,255,255,${fade})`

      withSave(ctx, () => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(
          Math.max(size, Math.min(W - size, px)),
          Math.max(size, Math.min(H - size, py)),
          size, 0, Math.PI * 2,
        )
        ctx.fill()
      })
    }
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Renders the appropriate timeline transition to `ctx`.
 * Applies easing to `params.progress` internally — pass the raw linear value.
 * Safe to call when inEl is null (renders outgoing only or skips gracefully).
 */
export function renderTimelineTransition(params: TransitionRenderParams): void {
  const { config } = params
  const p   = Math.max(0, Math.min(1, getEasedProgress(params.progress, config.easing)))
  const str = Math.max(0, Math.min(1, config.intensity ?? 1))

  switch (config.type as VzTransitionType) {
    case 'cut':              return renderCut(params, p)
    case 'crossfade':        return renderCrossfade(params, p)
    case 'flash':            return renderFlash(params, p, str)
    case 'glitch':           return renderGlitch(params, p, str)
    case 'wipeLeft':         return renderWipe(params, p, str, 'left')
    case 'wipeRight':        return renderWipe(params, p, str, 'right')
    case 'wipeUp':           return renderWipe(params, p, str, 'up')
    case 'wipeDown':         return renderWipe(params, p, str, 'down')
    case 'zoomIn':           return renderZoomIn(params, p)
    case 'zoomOut':          return renderZoomOut(params, p)
    case 'blurCrossfade':    return renderBlurCrossfade(params, p, str)
    case 'lumaFade':         return renderLumaFade(params, p, str)
    case 'additiveBlend':    return renderAdditiveBlend(params, p, str)
    case 'rgbTear':          return renderRgbTear(params, p, str)
    case 'datamoshCut':      return renderDatamoshCut(params, p, str)
    case 'scanlineWipe':     return renderScanlineWipe(params, p, str)
    case 'pixelSort':        return renderPixelSort(params, p)
    case 'radialWipe':       return renderRadialWipe(params, p, str)
    case 'circleIris':       return renderCircleIris(params, p, str)
    case 'bassImpactZoom':   return renderBassImpactZoom(params, p, str)
    case 'shockwaveReveal':  return renderShockwaveReveal(params, p, str)
    case 'particleExplosion':return renderParticleExplosion(params, p, str)
    default:
      // Runtime fallback for unknown saved values (old sessions)
      return renderCrossfade(params, p)
  }
}

// ── Single-element transition renderer ───────────────────────────────────────
//
// Used for per-clip transitionIn / transitionOut.
// Unlike renderTimelineTransition, only ONE element is rendered — the clip
// whose entrance or exit animation is playing.  No second element exists.
//
// Semantics:
//   kind === 'in'  → progress 0→1 means the clip is appearing
//   kind === 'out' → progress 0→1 means the clip is disappearing

export interface SingleElementTransitionParams {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  /** The clip element to animate. */
  el: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  /** Draw rect for el (already computed by the caller). */
  rect: DrawRect
  state: SingleClipTransitionState
  /** Elapsed ms from canvas start (for animated effects). */
  time: number
  /** 0–1 hue rotation from active Color Shift effect. */
  colorShift: number
  /** 0–1 bass energy. */
  bass: number
  /** 0–1 beat pulse energy. */
  beat: number
  /** Canvas globalCompositeOperation for this clip. */
  compositeOp: GlobalCompositeOperation
  /** 0–1 opacity from compositingConfig (or 1 for bg clips). Multiplied into transition alpha. */
  baseOpacity: number
}

// ── helpers shared by single-element renderers ────────────────────────────────

function seDrawFull(
  ctx: CanvasRenderingContext2D,
  el: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  rect: DrawRect,
  alpha: number,
  compositeOp: GlobalCompositeOperation,
  colorShift: number,
  extraFilter?: string,
): void {
  if (alpha <= 0) return
  withSave(ctx, () => {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
    if (compositeOp !== 'source-over') ctx.globalCompositeOperation = compositeOp
    const parts: string[] = []
    if (colorShift > 0) parts.push(`hue-rotate(${colorShift * 360}deg)`)
    if (extraFilter) parts.push(extraFilter)
    if (parts.length) ctx.filter = parts.join(' ')
    ctx.drawImage(el, rect.ox, rect.oy, rect.sw, rect.sh)
    ctx.filter = 'none'
  })
}

/** Returns the canvas-clip rect for a wipe reveal at progress p. */
function seWipeClipRect(
  p: number,
  W: number,
  H: number,
  dir: 'left' | 'right' | 'up' | 'down',
  kind: 'in' | 'out',
): { x: number; y: number; w: number; h: number } {
  // For 'in': p=0 → nothing visible, p=1 → full frame
  // For 'out': p=0 → full frame visible, p=1 → nothing visible
  const reveal = kind === 'in' ? p : 1 - p
  switch (dir) {
    case 'right': return { x: 0,              y: 0, w: reveal * W, h: H }
    case 'left':  return { x: (1 - reveal) * W, y: 0, w: reveal * W, h: H }
    case 'down':  return { x: 0,              y: 0, w: W,           h: reveal * H }
    case 'up':    return { x: 0, y: (1 - reveal) * H, w: W,         h: reveal * H }
  }
}

function seGetWipeDir(type: VzTransitionType): 'left' | 'right' | 'up' | 'down' {
  if (type === 'wipeLeft')  return 'left'
  if (type === 'wipeUp')    return 'up'
  if (type === 'wipeDown')  return 'down'
  return 'right'
}

function seGetZoomScale(type: VzTransitionType, p: number, kind: 'in' | 'out'): number {
  // zoomIn entrance: element zooms FROM large → normal (scale 1.12→1)
  // zoomIn exit: element zooms TO large and fades (scale 1→1.12)
  // zoomOut entrance: element comes FROM far → normal (scale 0.88→1)
  // zoomOut exit: element recedes (scale 1→0.88)
  if (type === 'zoomIn') {
    return kind === 'in' ? 1.12 - p * 0.12 : 1 + p * 0.12
  }
  // zoomOut
  return kind === 'in' ? 0.88 + p * 0.12 : 1 - p * 0.12
}

/**
 * Renders a single-element entrance or exit transition onto `ctx`.
 * The caller must already have drawn the "background" state for this frame
 * (or rely on canvas compositing if bg is transparent).
 *
 * For 'in' transitions the element appears; for 'out' it disappears.
 * `baseOpacity` is multiplied into all alpha values so compositing config
 * (e.g. overlay opacity) is respected throughout the transition.
 */
export function renderSingleElementTransition(params: SingleElementTransitionParams): void {
  const { ctx, W, H, el, rect, state, time, colorShift, bass, beat, compositeOp, baseOpacity } = params
  const { kind, config } = state
  const rawP = getEasedProgress(state.progress, config.easing)
  const p    = Math.max(0, Math.min(1, rawP))
  const str  = Math.max(0, Math.min(1, config.intensity ?? 1))
  // For 'in': alpha 0→1. For 'out': alpha 1→0.
  const alpha = (kind === 'in' ? p : 1 - p) * baseOpacity

  void time; void bass; void beat  // used by specific effects only

  switch (config.type as VzTransitionType) {
    case 'cut':
      // cut = instant — just draw at full opacity in 'in' direction
      seDrawFull(ctx, el, rect, baseOpacity, compositeOp, colorShift)
      return

    case 'crossfade':
    case 'blurCrossfade': {
      const blurPx = config.type === 'blurCrossfade'
        ? Math.sin(p * Math.PI) * 8 * str
        : 0
      seDrawFull(ctx, el, rect, alpha, compositeOp, colorShift,
        blurPx > 0.5 ? `blur(${blurPx.toFixed(1)}px)` : undefined)
      return
    }

    case 'flash': {
      const clipAlpha = kind === 'in'
        ? Math.min(1, Math.max(0, (p - 0.25) * 2)) * baseOpacity
        : Math.max(0, 1 - p * 2) * baseOpacity
      seDrawFull(ctx, el, rect, clipAlpha, compositeOp, colorShift)
      fillWhite(ctx, Math.sin(p * Math.PI) * 0.88 * str, W, H)
      return
    }

    case 'glitch': {
      const chaos = Math.sin(p * Math.PI) * str
      seDrawFull(ctx, el, rect, alpha * (1 - chaos * 0.3), compositeOp, colorShift)
      // Horizontal slice jitter
      const numSlices = Math.ceil(2 + chaos * 6)
      for (let i = 0; i < numSlices; i++) {
        const sliceY  = Math.floor(h(i * 17.3 + p * 100) * H)
        const sliceHt = Math.max(1, Math.floor(h(i * 31.7 + p * 50) * 18 + 2))
        const jitterX = (h(i * 11.9 + p * 200) - 0.5) * chaos * 40
        withSave(ctx, () => {
          ctx.beginPath()
          ctx.rect(0, sliceY, W, Math.min(sliceHt, H - sliceY))
          ctx.clip()
          ctx.globalAlpha = alpha * (1 - chaos * 0.3)
          ctx.drawImage(el, rect.ox + jitterX, rect.oy, rect.sw, rect.sh)
        })
      }
      if (chaos > 0.6) fillWhite(ctx, (chaos - 0.6) * 2.5 * 0.35, W, H)
      return
    }

    case 'wipeLeft':
    case 'wipeRight':
    case 'wipeUp':
    case 'wipeDown': {
      const dir = seGetWipeDir(config.type)
      const cr  = seWipeClipRect(p, W, H, dir, kind)
      withSave(ctx, () => {
        ctx.beginPath()
        ctx.rect(cr.x, cr.y, cr.w, cr.h)
        ctx.clip()
        seDrawFull(ctx, el, rect, baseOpacity, compositeOp, colorShift)
      })
      // Edge accent
      if (p > 0.02 && p < 0.98) {
        const edgePos = kind === 'in' ? p : 1 - p
        withSave(ctx, () => {
          ctx.strokeStyle = `rgba(74,199,219,${0.65 * str})`
          ctx.lineWidth = 2
          ctx.beginPath()
          switch (dir) {
            case 'right': ctx.moveTo(edgePos * W, 0); ctx.lineTo(edgePos * W, H); break
            case 'left':  ctx.moveTo((1 - edgePos) * W, 0); ctx.lineTo((1 - edgePos) * W, H); break
            case 'down':  ctx.moveTo(0, edgePos * H); ctx.lineTo(W, edgePos * H); break
            case 'up':    ctx.moveTo(0, (1 - edgePos) * H); ctx.lineTo(W, (1 - edgePos) * H); break
          }
          ctx.stroke()
        })
      }
      return
    }

    case 'zoomIn':
    case 'zoomOut': {
      const cx = W / 2, cy = H / 2
      const scale = seGetZoomScale(config.type, p, kind)
      const blurPx = config.type === 'zoomIn' ? Math.sin(p * Math.PI) * 3 : 0
      withSave(ctx, () => {
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
        if (compositeOp !== 'source-over') ctx.globalCompositeOperation = compositeOp
        const parts: string[] = []
        if (colorShift > 0) parts.push(`hue-rotate(${colorShift * 360}deg)`)
        if (blurPx > 0.5)   parts.push(`blur(${blurPx.toFixed(1)}px)`)
        if (parts.length)   ctx.filter = parts.join(' ')
        ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy)
        ctx.drawImage(el, rect.ox, rect.oy, rect.sw, rect.sh)
        ctx.filter = 'none'
      })
      return
    }

    case 'lumaFade': {
      const brightness = kind === 'in'
        ? 1 + (1 - p) * 0.35
        : 1 - p * 0.55
      seDrawFull(ctx, el, rect, alpha, compositeOp, colorShift,
        `brightness(${brightness.toFixed(2)})`)
      fillWhite(ctx, Math.sin(p * Math.PI) * 0.45 * str, W, H)
      return
    }

    case 'additiveBlend': {
      const blendOp = (config.blendMode ?? 'lighter') as GlobalCompositeOperation
      withSave(ctx, () => {
        ctx.globalCompositeOperation = blendOp
        ctx.globalAlpha = alpha * str * 0.85
        if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
        ctx.drawImage(el, rect.ox, rect.oy, rect.sw, rect.sh)
        ctx.filter = 'none'
      })
      if (p > 0.4) seDrawFull(ctx, el, rect, ((p > 0.4 ? (p - 0.4) / 0.6 : 0) * (kind === 'in' ? 1 : 1 - p)) * baseOpacity, compositeOp, colorShift)
      return
    }

    case 'rgbTear': {
      seDrawFull(ctx, el, rect, alpha, compositeOp, colorShift)
      if (p < 0.8) {
        const rgbShift = p * str * 14
        withSave(ctx, () => {
          ctx.globalCompositeOperation = 'screen'
          ctx.globalAlpha = alpha * 0.4
          ctx.filter = 'sepia(1) saturate(5) hue-rotate(-40deg)'
          ctx.drawImage(el, rect.ox - rgbShift, rect.oy, rect.sw, rect.sh)
          ctx.filter = 'sepia(1) saturate(5) hue-rotate(200deg)'
          ctx.drawImage(el, rect.ox + rgbShift, rect.oy, rect.sw, rect.sh)
          ctx.filter = 'none'
        })
      }
      return
    }

    case 'datamoshCut': {
      seDrawFull(ctx, el, rect, alpha, compositeOp, colorShift)
      const ghostCount = 4
      for (let i = 0; i < ghostCount; i++) {
        const offX = Math.sin(i * 1.37 + p * 11) * p * str * 18
        const offY = Math.cos(i * 0.91 + p * 7)  * p * str * 7
        withSave(ctx, () => {
          ctx.globalAlpha = (1 - p) * 0.18 * (1 - i / ghostCount) * baseOpacity
          ctx.globalCompositeOperation = 'lighter'
          if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
          ctx.drawImage(el, rect.ox + offX, rect.oy + offY, rect.sw, rect.sh)
          ctx.filter = 'none'
        })
      }
      return
    }

    case 'scanlineWipe': {
      const bandH   = 4
      const numBands = Math.ceil(H / bandH)
      const phases  = [0, 0.1, 0.2]
      withSave(ctx, () => {
        ctx.beginPath()
        for (let i = 0; i < numBands; i++) {
          const delay = phases[i % 3]
          const scale = 1 - delay
          const rawBandP = scale > 0 ? Math.min(1, Math.max(0, (p - delay) / scale)) : 1
          const bandP = kind === 'in' ? rawBandP : 1 - rawBandP
          if (bandP <= 0) continue
          const ly = i * bandH
          ctx.rect(0, ly, W, Math.min(bandH, H - ly))
        }
        ctx.clip()
        seDrawFull(ctx, el, rect, baseOpacity, compositeOp, colorShift)
      })
      return
    }

    case 'pixelSort': {
      const stripW   = 4
      const numStrips = Math.ceil(W / stripW)
      withSave(ctx, () => {
        ctx.beginPath()
        for (let i = 0; i < numStrips; i++) {
          const phase  = h(i * 7.31) * 0.6
          const rawLp  = Math.min(1, Math.max(0, p > phase ? (p - phase) / (1 - phase * 0.5) : 0))
          const lp     = kind === 'in' ? rawLp : 1 - rawLp
          if (lp <= 0) continue
          const sx = i * stripW
          const revealH = lp * H
          if (h(i * 3.17) > 0.5) {
            ctx.rect(sx, 0, stripW, revealH)
          } else {
            ctx.rect(sx, H - revealH, stripW, revealH)
          }
        }
        ctx.clip()
        seDrawFull(ctx, el, rect, baseOpacity, compositeOp, colorShift)
      })
      return
    }

    case 'radialWipe': {
      const cx = W / 2, cy = H / 2
      const maxR = Math.max(W, H)
      const startAngle = -Math.PI / 2
      const sweepP = kind === 'in' ? p : 1 - p
      const endAngle = startAngle + sweepP * Math.PI * 2
      withSave(ctx, () => {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, maxR, startAngle, endAngle)
        ctx.closePath()
        ctx.clip()
        seDrawFull(ctx, el, rect, baseOpacity, compositeOp, colorShift)
      })
      if (p > 0.02 && p < 0.98) {
        withSave(ctx, () => {
          ctx.strokeStyle = `rgba(74,199,219,${0.65 * str})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Math.cos(endAngle) * maxR, cy + Math.sin(endAngle) * maxR)
          ctx.stroke()
        })
      }
      return
    }

    case 'circleIris': {
      const cx = W / 2, cy = H / 2
      const maxR = Math.hypot(W, H) / 2 * 1.05
      const irisP = kind === 'in' ? p : 1 - p
      const r = irisP * maxR
      if (r <= 0) return
      withSave(ctx, () => {
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.clip()
        seDrawFull(ctx, el, rect, baseOpacity, compositeOp, colorShift)
      })
      if (r > 2 && irisP < 0.97) {
        for (const [lw, a] of [[8, 0.15], [4, 0.45], [2, 0.85]] as [number, number][]) {
          withSave(ctx, () => {
            ctx.strokeStyle = `rgba(74,199,219,${a * str})`
            ctx.lineWidth = lw
            ctx.beginPath()
            ctx.arc(cx, cy, r, 0, Math.PI * 2)
            ctx.stroke()
          })
        }
      }
      return
    }

    case 'bassImpactZoom': {
      const cx = W / 2, cy = H / 2
      const energy = Math.max(bass, beat) > 0 ? Math.max(bass, beat) : str
      if (kind === 'in') {
        const punch = Math.max(0, 1 - p * 2) * energy * str
        fillWhite(ctx, punch * 0.55, W, H)
        const scale = p < 0.5 ? 1.08 - p * 0.08 : 1.04
        withSave(ctx, () => {
          ctx.globalAlpha = Math.min(1, p * 2) * baseOpacity
          if (compositeOp !== 'source-over') ctx.globalCompositeOperation = compositeOp
          if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
          ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy)
          ctx.drawImage(el, rect.ox, rect.oy, rect.sw, rect.sh)
          ctx.filter = 'none'
        })
      } else {
        const punch = Math.max(0, 1 - (1 - p) * 2) * energy * str
        fillWhite(ctx, punch * 0.55, W, H)
        const scale = 1 + p * 0.1
        withSave(ctx, () => {
          ctx.globalAlpha = Math.max(0, 1 - p * 1.5) * baseOpacity
          if (compositeOp !== 'source-over') ctx.globalCompositeOperation = compositeOp
          if (colorShift > 0) ctx.filter = `hue-rotate(${colorShift * 360}deg)`
          ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy)
          ctx.drawImage(el, rect.ox, rect.oy, rect.sw, rect.sh)
          ctx.filter = 'none'
        })
      }
      return
    }

    case 'shockwaveReveal': {
      const cx = W / 2, cy = H / 2
      const maxR  = Math.hypot(W, H) * 0.75
      const revealP = kind === 'in' ? p : 1 - p
      const waveR = revealP * maxR * 1.35
      const waveBand = maxR * 0.22
      const innerR = Math.max(0, waveR - waveBand)
      if (innerR > 0) {
        withSave(ctx, () => {
          ctx.beginPath()
          ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
          ctx.clip()
          seDrawFull(ctx, el, rect, baseOpacity, compositeOp, colorShift)
        })
      }
      const ringAlpha = Math.sin(p * Math.PI) * str
      if (ringAlpha > 0.03 && waveR > 0) {
        withSave(ctx, () => {
          const grd = ctx.createRadialGradient(cx, cy, Math.max(0, waveR - waveBand), cx, cy, waveR)
          grd.addColorStop(0,    `rgba(74,199,219,0)`)
          grd.addColorStop(0.45, `rgba(74,199,219,${ringAlpha * 0.7})`)
          grd.addColorStop(0.75, `rgba(255,255,255,${ringAlpha * 0.4})`)
          grd.addColorStop(1,    `rgba(74,199,219,0)`)
          ctx.fillStyle = grd
          ctx.beginPath()
          ctx.arc(cx, cy, waveR, 0, Math.PI * 2)
          ctx.fill()
        })
      }
      return
    }

    case 'particleExplosion': {
      seDrawFull(ctx, el, rect, alpha, compositeOp, colorShift)
      const particleLife = 0.75
      const effectP = kind === 'in' ? state.progress : 1 - state.progress
      if (effectP < particleLife) {
        const cx = W / 2, cy = H / 2
        const lp = effectP / particleLife
        const baseSize = Math.max(2, Math.min(W, H) * 0.005)
        const numParticles = 96
        for (let i = 0; i < numParticles; i++) {
          const angle  = h(i * 13.7) * Math.PI * 2
          const speed  = 0.3 + h(i * 23.1 + 5.3) * 0.7
          const size   = baseSize * (1 + h(i * 7.4 + 11.2) * 2.5)
          const dist   = speed * lp * Math.min(W, H) * 0.38
          const px     = cx + Math.cos(angle) * dist
          const py     = cy + Math.sin(angle) * dist
          const fade   = (1 - lp) * (0.5 + h(i * 5.9) * 0.5) * str
          if (fade < 0.02) continue
          const cs = h(i * 5.91)
          const color = cs < 0.33 ? `rgba(74,199,219,${fade})`
            : cs < 0.66          ? `rgba(200,74,219,${fade})`
            :                      `rgba(255,255,255,${fade})`
          withSave(ctx, () => {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(
              Math.max(size, Math.min(W - size, px)),
              Math.max(size, Math.min(H - size, py)),
              size, 0, Math.PI * 2,
            )
            ctx.fill()
          })
        }
      }
      return
    }

    default:
      // Unknown type: fall back to crossfade
      seDrawFull(ctx, el, rect, alpha, compositeOp, colorShift)
  }
}
