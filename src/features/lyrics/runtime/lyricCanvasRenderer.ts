import type {
  LyricAnimation,
  LyricCue,
  LyricDocument,
  LyricEasingName,
  LyricEffects,
  LyricStyle,
} from '../../../types/lyrics'

export const DEFAULT_LYRIC_CANVAS_STYLE: LyricStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 46, fontWeight: 700,
  color: '#ffffff', opacity: 1,
  strokeColor: '', strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0.85)', shadowBlur: 14, shadowOffsetX: 0, shadowOffsetY: 2,
  x: 0.5, y: 0.82, align: 'center', baseline: 'middle',
  maxWidth: 0.88, letterSpacing: 0, lineHeight: 1.3,
  textTransform: 'none', blendMode: 'source-over',
}

export const DEFAULT_LYRIC_CANVAS_ANIMATION: LyricAnimation = {
  in: 'fade', out: 'fade', inMs: 280, outMs: 180,
  easing: 'easeOut', delayMs: 0, staggerMs: 0,
  direction: 'up', intensity: 1,
}

export const DEFAULT_LYRIC_CANVAS_EFFECTS: LyricEffects = {
  glow: 0,
  glitch: 0,
  rgbSplit: 0,
  blur: 0,
  noise: 0,
  shake: 0,
  bassScale: 0,
  beatPunch: 0,
  opacityPulse: 0,
  hueRotate: 0,
  chroma: 0,
  bloom: 0,
  scanlineReact: 0,
}

export interface ResolvedLyricCanvasPresentation {
  style: LyricStyle
  animation: LyricAnimation
  effects: LyricEffects
}

/**
 * Canonical presentation merge used by the canvas lyric renderer. Keeping this
 * resolution outside LiveVisualCanvas lets fixture/demo surfaces consume the
 * same document-default and cue-override contract without touching runtime stores.
 */
export function resolveLyricCanvasPresentation(
  document: LyricDocument | null,
  cue: LyricCue,
): ResolvedLyricCanvasPresentation {
  return {
    style: { ...DEFAULT_LYRIC_CANVAS_STYLE, ...(document?.defaultStyle ?? {}), ...(cue.style ?? {}) },
    animation: { ...DEFAULT_LYRIC_CANVAS_ANIMATION, ...(document?.defaultAnimation ?? {}), ...(cue.animation ?? {}) },
    effects: { ...DEFAULT_LYRIC_CANVAS_EFFECTS, ...(document?.defaultEffects ?? {}), ...(cue.effects ?? {}) },
  }
}

function lyricEase(name: LyricEasingName, t: number): number {
  switch (name) {
    case 'easeIn':          return t * t
    case 'easeOut':         return 1 - (1 - t) * (1 - t)
    case 'easeInOut':       return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
    case 'easeOutCubic':    return 1 - (1 - t) ** 3
    case 'easeInCubic':     return t ** 3
    case 'easeInOutCubic':  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
    default:                return t
  }
}

function lyricTextTransform(text: string, transform: LyricStyle['textTransform']): string {
  switch (transform) {
    case 'uppercase':  return text.toUpperCase()
    case 'lowercase':  return text.toLowerCase()
    case 'capitalize': return text.replace(/\b\w/g, character => character.toUpperCase())
    default:           return text
  }
}

function wrapLyricText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

export interface DrawLyricCueInput {
  ctx: CanvasRenderingContext2D
  cue: LyricCue
  currentAudioMs: number
  effectiveStartMs: number
  effectiveEndMs: number
  document: LyricDocument | null
  width: number
  height: number
  dpr: number
}

/** Production lyric canvas renderer shared by LiveVisualCanvas and injected previews. */
export function drawLyricCue({
  ctx,
  cue,
  currentAudioMs,
  effectiveStartMs,
  effectiveEndMs,
  document,
  width,
  height,
  dpr,
}: DrawLyricCueInput): void {
  const { style, animation: anim } = resolveLyricCanvasPresentation(document, cue)

  const elapsed = currentAudioMs - effectiveStartMs - anim.delayMs
  const inT = Math.max(0, Math.min(1, elapsed / Math.max(1, anim.inMs)))
  const outT = Math.max(0, Math.min(1, (currentAudioMs - (effectiveEndMs - anim.outMs)) / Math.max(1, anim.outMs)))

  const easedIn = lyricEase(anim.easing, inT)
  const easedOut = lyricEase(anim.easing, outT)
  const visibility = Math.max(0, Math.min(1, easedIn * (1 - easedOut)))
  if (visibility <= 0) return

  let displayText = lyricTextTransform(cue.text, style.textTransform)
  if (anim.in === 'typewriter' && inT < 1) {
    displayText = displayText.slice(0, Math.max(1, Math.ceil(displayText.length * easedIn)))
  } else if (anim.out === 'typewriter' && outT > 0) {
    displayText = displayText.slice(0, Math.max(0, Math.ceil(displayText.length * (1 - easedOut))))
  }

  const fontSize = style.fontSize * dpr
  const shift = 28 * dpr * anim.intensity
  const maxWidth = style.maxWidth > 0 ? style.maxWidth * width : width * 0.9
  const lineHeight = fontSize * style.lineHeight

  let translateX = 0
  let translateY = 0
  let scale = 1
  let blurPx = 0

  const inProgress = 1 - easedIn
  switch (anim.in) {
    case 'fadeUp': translateY -= shift * inProgress; break
    case 'fadeDown': translateY += shift * inProgress; break
    case 'scale': scale *= 0.8 + 0.2 * easedIn; break
    case 'scalePop': scale *= 1 + 0.18 * (1 - easedIn) * Math.sin(easedIn * Math.PI); break
    case 'slide':
      if (anim.direction === 'up') translateY -= shift * inProgress
      else if (anim.direction === 'down') translateY += shift * inProgress
      else if (anim.direction === 'left') translateX -= shift * inProgress
      else translateX += shift * inProgress
      break
    case 'blurIn': blurPx = Math.max(blurPx, (1 - easedIn) * 12 * anim.intensity); break
    case 'glitch':
    case 'glitchOut': translateX += (Math.random() - 0.5) * shift * 0.4 * inProgress; break
    default: break
  }

  const outProgress = easedOut
  switch (anim.out) {
    case 'fadeUp': translateY -= shift * outProgress; break
    case 'fadeDown': translateY += shift * outProgress; break
    case 'scale': scale *= 1 - 0.2 * easedOut; break
    case 'slide':
      if (anim.direction === 'up') translateY -= shift * outProgress
      else if (anim.direction === 'down') translateY += shift * outProgress
      else if (anim.direction === 'left') translateX -= shift * outProgress
      else translateX += shift * outProgress
      break
    case 'blurOut': blurPx = Math.max(blurPx, easedOut * 12 * anim.intensity); break
    case 'glitch':
    case 'glitchOut': translateX += (Math.random() - 0.5) * shift * 0.4 * outProgress; break
    default: break
  }

  ctx.save()
  ctx.globalAlpha = Math.max(0, visibility * style.opacity)
  ctx.globalCompositeOperation = style.blendMode
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`
  ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`
  ctx.textAlign = style.align
  ctx.textBaseline = style.baseline
  if (style.letterSpacing > 0) {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${style.letterSpacing * dpr}px`
  }
  if (style.shadowBlur > 0 || style.shadowOffsetX !== 0 || style.shadowOffsetY !== 0) {
    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur * dpr
    ctx.shadowOffsetX = style.shadowOffsetX * dpr
    ctx.shadowOffsetY = style.shadowOffsetY * dpr
  }

  ctx.translate(style.x * width + translateX, style.y * height + translateY)
  if (scale !== 1) ctx.scale(scale, scale)

  const lines = wrapLyricText(ctx, displayText, maxWidth)
  const totalHeight = lines.length * lineHeight
  const startY = -totalHeight / 2 + lineHeight / 2

  const drawLines = (stroke: boolean) => {
    if (stroke) {
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    }
    lines.forEach((line, index) => {
      if (stroke) ctx.strokeText(line, 0, startY + index * lineHeight)
      else ctx.fillText(line, 0, startY + index * lineHeight)
    })
  }

  ctx.fillStyle = style.color
  drawLines(false)

  if (style.strokeWidth > 0 && style.strokeColor) {
    ctx.strokeStyle = style.strokeColor
    ctx.lineWidth = style.strokeWidth * dpr
    drawLines(true)
  }

  ctx.restore()
}
