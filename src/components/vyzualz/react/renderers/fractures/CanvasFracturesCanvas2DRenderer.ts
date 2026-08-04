import {
  CanvasFracturesImagePaletteCache,
  applyCanvasFracturesPixelTreatment,
  resolveCanvasFracturesDissolveSample,
  resolveCanvasFracturesEffectMacros,
  resolveCanvasFracturesFallbackEffect,
  resolveCanvasFracturesFragmentEffects,
  resolveCanvasFracturesPalette,
  resolveCanvasFracturesTrailBufferSize,
} from './CanvasFracturesEffects'
import {
  isCanvasFracturesSourceReady,
  resolveCanvasFracturesFitRect,
} from './CanvasFracturesTransforms'
import {
  modulateCanvasFracturesFragmentTransform,
  protectCanvasFracturesFragmentEffects,
} from './CanvasFracturesAudio'
import { selectCanvasFracturesStableSubset } from './CanvasFracturesAdaptiveQuality'
import type {
  CanvasFractureBlendMode,
  CanvasFractureFragment,
  CanvasFracturesPlan,
  CanvasFracturesRenderParams,
  CanvasFracturesResolvedEffectSettings,
  CanvasFracturesResolvedFragmentEffects,
  CanvasFracturesResolvedPalette,
} from './CanvasFracturesTypes'

interface FragmentDrawGeometry {
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
  destinationWidth: number
  destinationHeight: number
}

interface CanvasFracturesEffectSurface {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  imageData: ImageData
  width: number
  height: number
}

interface CanvasFracturesPreparedSource {
  source: CanvasImageSource
  geometry: FragmentDrawGeometry
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function sourceSize(source: HTMLVideoElement | HTMLImageElement): { width: number; height: number } {
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: Math.max(1, source.videoWidth), height: Math.max(1, source.videoHeight) }
  }
  const image = source as HTMLImageElement
  return { width: Math.max(1, image.naturalWidth), height: Math.max(1, image.naturalHeight) }
}

function hexToRgbBytes(value: string): readonly [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return [255, 255, 255]
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ]
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export function resolveCanvasFracturesCanvasBlendMode(mode: CanvasFractureBlendMode): GlobalCompositeOperation {
  if (mode === 'additive') return 'lighter'
  if (mode === 'screen') return 'screen'
  if (mode === 'difference') return 'difference'
  if (mode === 'exclusion') return 'exclusion'
  return 'source-over'
}

function createAuxiliaryCanvas(): { canvas: HTMLCanvasElement | null; context: CanvasRenderingContext2D | null } {
  try {
    if (typeof document === 'undefined') return { canvas: null, context: null }
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return { canvas, context: canvas.getContext('2d', { alpha: true, willReadFrequently: true }) }
  } catch {
    return { canvas: null, context: null }
  }
}

export class CanvasFracturesCanvas2DRenderer {
  readonly health = 'ready' as const
  private readonly context: CanvasRenderingContext2D
  private readonly effectCanvas: HTMLCanvasElement | null
  private readonly effectContext: CanvasRenderingContext2D | null
  private readonly treatmentCanvas: HTMLCanvasElement | null
  private readonly treatmentContext: CanvasRenderingContext2D | null
  private readonly historyCanvases: [HTMLCanvasElement | null, HTMLCanvasElement | null]
  private readonly historyContexts: [CanvasRenderingContext2D | null, CanvasRenderingContext2D | null]
  private readonly paletteCache = new CanvasFracturesImagePaletteCache()
  private historyIndex = 0
  private historyWidth = 0
  private historyHeight = 0
  private historyValid = false
  private historyBudgetKey = ''
  private trailsPreviouslyEnabled = false
  private plan: CanvasFracturesPlan | null = null
  private orderedFragments: readonly CanvasFractureFragment[] = []
  private minDepth = 0
  private maxDepth = 1
  private lastFramePositionSec: number | null = null
  private cssWidth = 1
  private cssHeight = 1
  private dpr = 1
  private disposed = false
  private fitCacheSourceWidth = 0
  private fitCacheSourceHeight = 0
  private fitCacheMode: CanvasFracturesRenderParams['fitMode'] | null = null
  private readonly fitRect = { x: 0, y: 0, width: 1, height: 1 }

  static create(canvas: HTMLCanvasElement): CanvasFracturesCanvas2DRenderer | null {
    const context = canvas.getContext('2d', { alpha: true })
    return context ? new CanvasFracturesCanvas2DRenderer(canvas, context) : null
  }

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
  ) {
    this.context = context
    this.context.imageSmoothingEnabled = true
    this.context.imageSmoothingQuality = 'high'
    const effect = createAuxiliaryCanvas()
    const treatment = createAuxiliaryCanvas()
    const historyA = createAuxiliaryCanvas()
    const historyB = createAuxiliaryCanvas()
    this.effectCanvas = effect.canvas
    this.effectContext = effect.context
    this.treatmentCanvas = treatment.canvas
    this.treatmentContext = treatment.context
    this.historyCanvases = [historyA.canvas, historyB.canvas]
    this.historyContexts = [historyA.context, historyB.context]
  }

  setPlan(plan: CanvasFracturesPlan): void {
    if (this.disposed || this.plan?.id === plan.id) return
    const invalidatesFeedback = Boolean(this.plan && (
      this.plan.sourceIdentity !== plan.sourceIdentity
      || this.plan.mediaRevision !== plan.mediaRevision
      || this.plan.topologyIdentity !== plan.topologyIdentity
    ))
    this.plan = plan
    this.orderedFragments = [...plan.fragments].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))
    this.minDepth = this.orderedFragments[0]?.depth ?? 0
    this.maxDepth = this.orderedFragments[this.orderedFragments.length - 1]?.depth ?? this.minDepth + 1
    if (invalidatesFeedback) this.invalidateFeedback()
  }

  get planIdentity(): string | null {
    return this.plan?.id ?? null
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (this.disposed) return
    const nextCssWidth = Math.max(1, Math.round(cssWidth))
    const nextCssHeight = Math.max(1, Math.round(cssHeight))
    const nextDpr = Math.min(2, Math.max(1, dpr || 1))
    const pixelWidth = Math.max(1, Math.round(nextCssWidth * nextDpr))
    const pixelHeight = Math.max(1, Math.round(nextCssHeight * nextDpr))
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth
      this.canvas.height = pixelHeight
      this.invalidateFeedback()
    }
    if (this.cssWidth !== nextCssWidth || this.cssHeight !== nextCssHeight) this.fitCacheMode = null
    this.cssWidth = nextCssWidth
    this.cssHeight = nextCssHeight
    this.dpr = nextDpr
  }

  render(params: CanvasFracturesRenderParams): boolean {
    if (this.disposed || !this.plan) return false
    const context = this.context
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    context.clearRect(0, 0, this.cssWidth, this.cssHeight)
    if (!isCanvasFracturesSourceReady(params.source)) return false

    const source = params.source
    const dimensions = sourceSize(source)
    const framePositionSec = typeof params.framePositionSec === 'number' && Number.isFinite(params.framePositionSec)
      ? Math.max(0, params.framePositionSec)
      : null
    if (framePositionSec !== null && this.lastFramePositionSec !== null) {
      const delta = framePositionSec - this.lastFramePositionSec
      if (delta < -0.05 || delta > 1) this.invalidateFeedback()
    }
    const resolved = resolveCanvasFracturesEffectMacros(params.effects)
    const activeFragments = selectCanvasFracturesStableSubset(this.orderedFragments, params.effects.activeFragmentCap ?? this.orderedFragments.length)
    const trailsEnabled = resolved.trailOpacity > 1e-4 && this.ensureHistorySurfaces(resolved)
    if (!trailsEnabled && this.trailsPreviouslyEnabled) this.invalidateFeedback()
    this.trailsPreviouslyEnabled = trailsEnabled

    if (trailsEnabled && this.historyValid) {
      const history = this.historyCanvases[this.historyIndex]
      if (history) {
        context.save()
        context.globalCompositeOperation = 'source-over'
        context.globalAlpha = resolved.trailOpacity
        context.filter = 'none'
        context.drawImage(history, 0, 0, this.cssWidth, this.cssHeight)
        context.restore()
      }
    }

    const fitRect = this.resolveFitRect(dimensions.width, dimensions.height, params.fitMode)
    const outputOpacity = clamp01(params.outputOpacity ?? 1)
    const sampled = params.effects.colorSourceMode === 'imageSampled'
      ? this.paletteCache.sample(source, this.plan.sourceIdentity, this.plan.mediaRevision)
      : []
    const palette = resolveCanvasFracturesPalette({
      mode: params.effects.colorSourceMode,
      manualPrimary: params.effects.manualPrimaryColor,
      manualSupporting: params.effects.manualSupportingColor,
      brandKit: params.brandKit,
      sampled,
    })

    context.save()
    context.translate(
      this.cssWidth * 0.5 + this.cssWidth * (params.sourceTransform.positionX / 100),
      this.cssHeight * 0.5 + this.cssHeight * (params.sourceTransform.positionY / 100),
    )
    context.rotate(params.sourceTransform.rotation * Math.PI / 180)
    context.scale(Math.max(0.01, params.sourceTransform.scale), Math.max(0.01, params.sourceTransform.scale))
    context.translate(-this.cssWidth * 0.5, -this.cssHeight * 0.5)
    context.globalCompositeOperation = 'source-over'
    context.filter = 'none'

    const anchor = this.plan.anchor
    if (anchor.visible && anchor.opacity > 0) {
      const vocalProtection = clamp01(params.audio?.vocalProtection ?? 0)
      context.save()
      context.globalAlpha = outputOpacity * clamp01(anchor.opacity + vocalProtection * 0.18)
      context.translate(fitRect.x + fitRect.width * 0.5, fitRect.y + fitRect.height * 0.5)
      const anchorScale = anchor.scale * (1 + vocalProtection * 0.025)
      context.scale(anchorScale, anchorScale)
      try {
        context.drawImage(source, -fitRect.width * 0.5, -fitRect.height * 0.5, fitRect.width, fitRect.height)
      } catch {
        context.restore()
        context.restore()
        return false
      }
      context.restore()
    }

    for (let ordinal = 0; ordinal < activeFragments.length; ordinal += 1) {
      this.drawFragment(
        activeFragments[ordinal],
        ordinal,
        source,
        dimensions.width,
        dimensions.height,
        fitRect,
        outputOpacity,
        palette,
        resolved,
        params,
      )
    }
    context.restore()

    if (trailsEnabled) this.captureHistory(resolved)
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = 1
    context.filter = 'none'
    this.lastFramePositionSec = framePositionSec
    return true
  }

  invalidateFeedback(): void {
    this.historyValid = false
    this.lastFramePositionSec = null
    for (let index = 0; index < 2; index += 1) {
      const canvas = this.historyCanvases[index]
      const context = this.historyContexts[index]
      if (!canvas || !context) continue
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.plan = null
    this.orderedFragments = []
    this.paletteCache.clear()
    this.invalidateFeedback()
    this.context.setTransform(1, 0, 0, 1, 0, 0)
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private ensureHistorySurfaces(resolved: CanvasFracturesResolvedEffectSettings): boolean {
    const size = resolveCanvasFracturesTrailBufferSize({
      pixelWidth: this.canvas.width,
      pixelHeight: this.canvas.height,
      budget: resolved.budget,
    })
    if (
      !this.historyCanvases[0]
      || !this.historyCanvases[1]
      || !this.historyContexts[0]
      || !this.historyContexts[1]
    ) return false
    const budgetKey = [
      resolved.quality,
      resolved.budget.trailScale,
      resolved.budget.trailMaxWidth,
      resolved.budget.trailMaxHeight,
    ].join('|')
    if (
      this.historyWidth === size.width
      && this.historyHeight === size.height
      && this.historyBudgetKey === budgetKey
    ) return true
    this.historyWidth = size.width
    this.historyHeight = size.height
    this.historyBudgetKey = budgetKey
    for (const canvas of this.historyCanvases) {
      if (!canvas) continue
      canvas.width = size.width
      canvas.height = size.height
    }
    this.historyIndex = 0
    this.invalidateFeedback()
    return true
  }

  private captureHistory(resolved: CanvasFracturesResolvedEffectSettings): void {
    const nextIndex = this.historyIndex === 0 ? 1 : 0
    const nextCanvas = this.historyCanvases[nextIndex]
    const nextContext = this.historyContexts[nextIndex]
    if (!nextCanvas || !nextContext) return
    nextContext.setTransform(1, 0, 0, 1, 0, 0)
    nextContext.globalCompositeOperation = 'source-over'
    nextContext.filter = 'none'
    nextContext.globalAlpha = 1
    nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height)
    if (this.historyValid) {
      const current = this.historyCanvases[this.historyIndex]
      if (current) {
        nextContext.globalAlpha = resolved.trailPersistence
        nextContext.drawImage(current, 0, 0, nextCanvas.width, nextCanvas.height)
      }
    }
    nextContext.globalAlpha = 1
    nextContext.drawImage(this.canvas, 0, 0, nextCanvas.width, nextCanvas.height)
    this.historyIndex = nextIndex
    this.historyValid = true
  }

  private resolveFitRect(
    sourceWidth: number,
    sourceHeight: number,
    fitMode: CanvasFracturesRenderParams['fitMode'],
  ): { x: number; y: number; width: number; height: number } {
    if (
      this.fitCacheSourceWidth === sourceWidth
      && this.fitCacheSourceHeight === sourceHeight
      && this.fitCacheMode === fitMode
      && this.fitRect.width > 0
      && this.fitRect.height > 0
    ) return this.fitRect

    const resolved = resolveCanvasFracturesFitRect({
      outputWidth: this.cssWidth,
      outputHeight: this.cssHeight,
      sourceWidth,
      sourceHeight,
      fitMode,
    })
    this.fitCacheSourceWidth = sourceWidth
    this.fitCacheSourceHeight = sourceHeight
    this.fitCacheMode = fitMode
    Object.assign(this.fitRect, resolved)
    return this.fitRect
  }

  private drawFragment(
    fragment: CanvasFractureFragment,
    ordinal: number,
    source: HTMLVideoElement | HTMLImageElement,
    sourceWidth: number,
    sourceHeight: number,
    fitRect: { x: number; y: number; width: number; height: number },
    outputOpacity: number,
    palette: CanvasFracturesResolvedPalette,
    resolved: CanvasFracturesResolvedEffectSettings,
    params: CanvasFracturesRenderParams,
  ): void {
    const crop = fragment.crop
    const transform = fragment.currentTransform
    const geometry: FragmentDrawGeometry = {
      destinationWidth: Math.max(0.5, fitRect.width * crop.width),
      destinationHeight: Math.max(0.5, fitRect.height * crop.height),
      sourceX: Math.max(0, Math.min(sourceWidth, crop.x * sourceWidth)),
      sourceY: Math.max(0, Math.min(sourceHeight, crop.y * sourceHeight)),
      sourceWidth: 0,
      sourceHeight: 0,
    }
    geometry.sourceWidth = Math.max(1e-4, Math.min(sourceWidth - geometry.sourceX, crop.width * sourceWidth))
    geometry.sourceHeight = Math.max(1e-4, Math.min(sourceHeight - geometry.sourceY, crop.height * sourceHeight))
    const effects = protectCanvasFracturesFragmentEffects({
      fragment,
      effects: resolveCanvasFracturesFragmentEffects({
        assignment: fragment.effectAssignment,
        settings: resolved,
        fragmentOrdinal: ordinal,
      }),
      audio: params.audio,
    })
    const prepared = this.prepareTreatmentSource(source, geometry, fragment, effects, palette, resolved)
    const depthSpan = Math.max(1, this.maxDepth - this.minDepth)
    const depthNorm = clamp01((fragment.depth - this.minDepth) / depthSpan)
    const depthBias = depthNorm - 0.5
    const baseCenterX = fitRect.x + transform.centerX * fitRect.width
      + fragment.effectAssignment.directionX * resolved.parallaxPx * depthBias
    const baseCenterY = fitRect.y + transform.centerY * fitRect.height
      + fragment.effectAssignment.directionY * resolved.parallaxPx * depthBias
    const baseScale = transform.scale * (1 + depthBias * resolved.depthScale)
    const audioTransform = modulateCanvasFracturesFragmentTransform({
      fragment,
      centerX: baseCenterX,
      centerY: baseCenterY,
      scale: baseScale,
      fitWidth: fitRect.width,
      fitHeight: fitRect.height,
      framePositionSec: params.framePositionSec,
      audio: params.audio,
    })
    const centerX = audioTransform.centerX
    const centerY = audioTransform.centerY
    const scale = audioTransform.scale
    const baseOpacity = outputOpacity * fragment.opacity

    if (effects.shadow > 1e-4) {
      this.drawShadow(
        fragment,
        centerX + fragment.effectAssignment.directionX * effects.shadowOffsetPx,
        centerY + fragment.effectAssignment.directionY * effects.shadowOffsetPx,
        scale,
        baseOpacity * resolved.shadowOpacity * effects.shadow,
        effects.shadowBlurPx,
        palette.primary,
      )
    }

    for (let copy = effects.duplicateCount; copy >= 1; copy -= 1) {
      const distance = effects.copyOffsetPx * copy
      const perpendicularX = -fragment.effectAssignment.directionY
      const perpendicularY = fragment.effectAssignment.directionX
      const side = (fragment.effectAssignment.seed + copy) % 2 === 0 ? 1 : -1
      this.drawFragmentInstance({
        fragment,
        source: prepared.source,
        geometry: prepared.geometry,
        centerX: centerX + fragment.effectAssignment.directionX * distance + perpendicularX * distance * 0.25 * side,
        centerY: centerY + fragment.effectAssignment.directionY * distance + perpendicularY * distance * 0.25 * side,
        scale: scale * Math.max(0.82, 1 - copy * 0.035),
        opacity: baseOpacity * effects.copyOpacity / (1 + copy * 0.32),
        palette,
        resolved,
        effects,
        copyHueDeg: side * copy * 18,
      })
    }

    this.drawFragmentInstance({
      fragment,
      source: prepared.source,
      geometry: prepared.geometry,
      centerX,
      centerY,
      scale,
      opacity: baseOpacity,
      palette,
      resolved,
      effects,
      copyHueDeg: 0,
    })
  }

  private drawShadow(
    fragment: CanvasFractureFragment,
    centerX: number,
    centerY: number,
    scale: number,
    opacity: number,
    blurPx: number,
    color: string,
  ): void {
    const context = this.context
    if (typeof context.fill !== 'function') return
    context.save()
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = clamp01(opacity)
    context.filter = blurPx > 0 ? `blur(${Math.min(24, blurPx)}px)` : 'none'
    const [red, green, blue] = hexToRgbBytes(color)
    context.fillStyle = `rgb(${Math.round(red * 0.14)}, ${Math.round(green * 0.14)}, ${Math.round(blue * 0.14)})`
    context.translate(centerX, centerY)
    context.rotate(fragment.currentTransform.rotationDeg * Math.PI / 180)
    context.scale(scale, scale)
    context.beginPath()
    for (let index = 0; index < fragment.localCorners.length; index += 1) {
      const corner = fragment.localCorners[index]
      const x = (corner.x - 0.5) * Math.max(0.5, this.fitRect.width * fragment.crop.width)
      const y = (corner.y - 0.5) * Math.max(0.5, this.fitRect.height * fragment.crop.height)
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.closePath()
    context.fill()
    context.restore()
  }

  private drawFragmentInstance(input: {
    fragment: CanvasFractureFragment
    source: CanvasImageSource
    geometry: FragmentDrawGeometry
    centerX: number
    centerY: number
    scale: number
    opacity: number
    palette: CanvasFracturesResolvedPalette
    resolved: CanvasFracturesResolvedEffectSettings
    effects: CanvasFracturesResolvedFragmentEffects
    copyHueDeg: number
  }): void {
    const context = this.context
    const { fragment, geometry } = input
    context.save()
    context.globalAlpha = clamp01(input.opacity)
    context.globalCompositeOperation = resolveCanvasFracturesCanvasBlendMode(input.effects.blendMode)
    context.translate(input.centerX, input.centerY)
    context.rotate(fragment.currentTransform.rotationDeg * Math.PI / 180)
    context.scale(input.scale, input.scale)
    context.beginPath()
    for (let index = 0; index < fragment.localCorners.length; index += 1) {
      const corner = fragment.localCorners[index]
      const x = (corner.x - 0.5) * geometry.destinationWidth
      const y = (corner.y - 0.5) * geometry.destinationHeight
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.closePath()
    context.clip()
    const filters: string[] = []
    if (input.effects.blur > 1e-4) filters.push(`blur(${Math.min(12, 1 + input.effects.blur * 8)}px)`)
    if (input.effects.flash > 1e-4) filters.push(`brightness(${1 + input.effects.flash * 1.4})`)
    if (input.copyHueDeg !== 0) filters.push(`hue-rotate(${input.copyHueDeg}deg)`)
    context.filter = filters.length > 0 ? filters.join(' ') : 'none'

    const role = resolveCanvasFracturesFallbackEffect(fragment.effectRole)
    try {
      if (role === 'outline') this.drawOutline(input.source, geometry, input.palette.primary, input.resolved)
      else if (role === 'glow') this.drawBloom(input.source, geometry, input.palette.supporting, input.resolved)
      else if (role === 'glitch') this.drawRgbSplit(input.source, geometry, fragment, input.resolved)
      else if (role === 'luma') this.drawLuma(input.source, geometry, input.palette.accent, input.resolved)
      else if (role === 'displacement') this.drawDisplaced(input.source, geometry, fragment, input.resolved)
      else if (role === 'texture') this.drawTextured(input.source, geometry, fragment, input.palette, input.resolved)
      else this.drawSharp(input.source, geometry)
    } catch {
      // Media can briefly become unavailable during replacement or seek.
    }
    context.restore()
  }

  private prepareTreatmentSource(
    source: CanvasImageSource,
    geometry: FragmentDrawGeometry,
    fragment: CanvasFractureFragment,
    effects: CanvasFracturesResolvedFragmentEffects,
    palette: CanvasFracturesResolvedPalette,
    resolved: CanvasFracturesResolvedEffectSettings,
  ): CanvasFracturesPreparedSource {
    const requiresTreatment = fragment.mirrorX
      || fragment.mirrorY
      || effects.posterization > 1e-4
      || Math.abs(effects.hueShift) > 1e-4
      || effects.duotone > 1e-4
      || effects.sharpen > 1e-4
      || effects.dissolve > 1e-4
      || effects.flash > 1e-4
    const canvas = this.treatmentCanvas
    const context = this.treatmentContext
    if (!requiresTreatment || !canvas || !context) return { source, geometry }

    const limit = resolved.quality === 'low' ? 96 : resolved.quality === 'high' ? 320 : 192
    const aspect = geometry.sourceWidth / Math.max(1e-4, geometry.sourceHeight)
    const width = Math.max(8, Math.round(aspect >= 1 ? limit : limit * aspect))
    const height = Math.max(8, Math.round(aspect >= 1 ? limit / aspect : limit))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const preparedGeometry: FragmentDrawGeometry = {
      ...geometry,
      sourceX: 0,
      sourceY: 0,
      sourceWidth: width,
      sourceHeight: height,
    }
    try {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      context.filter = 'none'
      context.clearRect(0, 0, width, height)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = resolved.quality === 'low' ? 'low' : 'high'
      context.drawImage(
        source,
        geometry.sourceX,
        geometry.sourceY,
        geometry.sourceWidth,
        geometry.sourceHeight,
        0,
        0,
        width,
        height,
      )
      const imageData = context.getImageData(0, 0, width, height)
      const sourcePixels = new Uint8ClampedArray(imageData.data)
      const output = imageData.data
      const primary = hexToRgbBytes(palette.primary).map(value => value / 255) as [number, number, number]
      const supporting = hexToRgbBytes(palette.supporting).map(value => value / 255) as [number, number, number]
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const sourceX = fragment.mirrorX ? width - 1 - x : x
          const sourceY = fragment.mirrorY ? height - 1 - y : y
          const sourceIndex = (sourceY * width + sourceX) * 4
          const outputIndex = (y * width + x) * 4
          const pattern = resolveCanvasFracturesDissolveSample(fragment.effectAssignment.seed, x, y)
          const dissolveMask = effects.dissolve <= 1e-4
            ? 1
            : smoothstep(effects.dissolve - 0.08, effects.dissolve + 0.08, pattern)
          const treated = applyCanvasFracturesPixelTreatment({
            rgba: [
              sourcePixels[sourceIndex],
              sourcePixels[sourceIndex + 1],
              sourcePixels[sourceIndex + 2],
              sourcePixels[sourceIndex + 3],
            ],
            posterization: effects.posterization,
            posterizeLevels: effects.posterizeLevels,
            hueShift: effects.hueShift,
            duotone: effects.duotone,
            primary,
            supporting,
            dissolveMask,
          })
          output[outputIndex] = Math.round(treated[0] + (255 - treated[0]) * effects.flash)
          output[outputIndex + 1] = Math.round(treated[1] + (255 - treated[1]) * effects.flash)
          output[outputIndex + 2] = Math.round(treated[2] + (255 - treated[2]) * effects.flash)
          output[outputIndex + 3] = treated[3]
        }
      }
      if (effects.sharpen > 1e-4) this.applySharpen(imageData, width, height, effects.sharpen)
      context.putImageData(imageData, 0, 0)
      return { source: canvas, geometry: preparedGeometry }
    } catch {
      try {
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, width, height)
        context.save()
        context.translate(fragment.mirrorX ? width : 0, fragment.mirrorY ? height : 0)
        context.scale(fragment.mirrorX ? -1 : 1, fragment.mirrorY ? -1 : 1)
        const fallbackFilters: string[] = []
        if (Math.abs(effects.hueShift) > 1e-4) fallbackFilters.push(`hue-rotate(${effects.hueShift * 360}deg)`)
        if (effects.flash > 1e-4) fallbackFilters.push(`brightness(${1 + effects.flash})`)
        context.filter = fallbackFilters.length > 0 ? fallbackFilters.join(' ') : 'none'
        context.drawImage(
          source,
          geometry.sourceX,
          geometry.sourceY,
          geometry.sourceWidth,
          geometry.sourceHeight,
          0,
          0,
          width,
          height,
        )
        context.restore()
        return { source: canvas, geometry: preparedGeometry }
      } catch {
        return { source, geometry }
      }
    }
  }

  private applySharpen(imageData: ImageData, width: number, height: number, amount: number): void {
    const source = new Uint8ClampedArray(imageData.data)
    const output = imageData.data
    const strength = clamp01(amount) * 0.72
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = (y * width + x) * 4
        for (let channel = 0; channel < 3; channel += 1) {
          const neighbor = (
            source[index - 4 + channel]
            + source[index + 4 + channel]
            + source[index - width * 4 + channel]
            + source[index + width * 4 + channel]
          ) * 0.25
          output[index + channel] = Math.max(0, Math.min(255, Math.round(source[index + channel] + (source[index + channel] - neighbor) * strength * 2)))
        }
        output[index + 3] = source[index + 3]
      }
    }
  }

  private drawSharp(source: CanvasImageSource, geometry: FragmentDrawGeometry, dx = 0, dy = 0): void {
    this.context.drawImage(
      source,
      geometry.sourceX,
      geometry.sourceY,
      geometry.sourceWidth,
      geometry.sourceHeight,
      -geometry.destinationWidth * 0.5 + dx,
      -geometry.destinationHeight * 0.5 + dy,
      geometry.destinationWidth,
      geometry.destinationHeight,
    )
  }

  private prepareEffectSurface(
    source: CanvasImageSource,
    geometry: FragmentDrawGeometry,
    quality: CanvasFracturesResolvedEffectSettings['quality'],
  ): CanvasFracturesEffectSurface | null {
    const canvas = this.effectCanvas
    const context = this.effectContext
    if (!canvas || !context) return null
    const limit = quality === 'low' ? 64 : quality === 'high' ? 160 : 96
    const aspect = geometry.sourceWidth / Math.max(1e-4, geometry.sourceHeight)
    const width = Math.max(8, Math.round(aspect >= 1 ? limit : limit * aspect))
    const height = Math.max(8, Math.round(aspect >= 1 ? limit / aspect : limit))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    try {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      context.filter = 'none'
      context.clearRect(0, 0, width, height)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = quality === 'low' ? 'low' : 'high'
      context.drawImage(
        source,
        geometry.sourceX,
        geometry.sourceY,
        geometry.sourceWidth,
        geometry.sourceHeight,
        0,
        0,
        width,
        height,
      )
      return { canvas, context, imageData: context.getImageData(0, 0, width, height), width, height }
    } catch {
      return null
    }
  }

  private drawEffectSurface(surface: CanvasFracturesEffectSurface, geometry: FragmentDrawGeometry): void {
    surface.context.putImageData(surface.imageData, 0, 0)
    this.context.drawImage(
      surface.canvas,
      -geometry.destinationWidth * 0.5,
      -geometry.destinationHeight * 0.5,
      geometry.destinationWidth,
      geometry.destinationHeight,
    )
  }

  private drawOutline(
    source: CanvasImageSource,
    geometry: FragmentDrawGeometry,
    color: string,
    resolved: CanvasFracturesResolvedEffectSettings,
  ): void {
    const context = this.context
    const amount = resolved.outlineIntensity
    const surface = amount > 0 ? this.prepareEffectSurface(source, geometry, resolved.quality) : null
    if (surface) {
      const [red, green, blue] = hexToRgbBytes(color)
      const sourcePixels = new Uint8ClampedArray(surface.imageData.data)
      const output = surface.imageData.data
      const radius = 1 + Math.round(clamp01(resolved.outlineThickness) * 3)
      const lumaAt = (x: number, y: number): number => {
        const index = (y * surface.width + x) * 4
        const alpha = sourcePixels[index + 3] / 255
        return (0.2126 * sourcePixels[index] + 0.7152 * sourcePixels[index + 1] + 0.0722 * sourcePixels[index + 2]) / 255 * alpha
      }
      for (let y = 0; y < surface.height; y += 1) {
        for (let x = 0; x < surface.width; x += 1) {
          const index = (y * surface.width + x) * 4
          let edge = 0
          if (x >= radius && y >= radius && x < surface.width - radius && y < surface.height - radius) {
            const centerAlpha = sourcePixels[index + 3] / 255
            const centerLuma = lumaAt(x, y)
            const neighborOffsets = [[-radius, 0], [radius, 0], [0, -radius], [0, radius]] as const
            for (const [offsetX, offsetY] of neighborOffsets) {
              const neighborIndex = ((y + offsetY) * surface.width + x + offsetX) * 4
              const neighborAlpha = sourcePixels[neighborIndex + 3] / 255
              edge = Math.max(edge, Math.abs(centerAlpha - neighborAlpha), Math.abs(centerLuma - lumaAt(x + offsetX, y + offsetY)) * 1.8)
            }
          }
          output[index] = red
          output[index + 1] = green
          output[index + 2] = blue
          output[index + 3] = Math.round(clamp01(edge * (1.2 + amount * 1.8)) * 255)
        }
      }
      context.save()
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha *= 0.45 + amount * 0.55
      context.filter = `blur(${0.4 + clamp01(resolved.outlineThickness) * 1.8}px)`
      this.drawEffectSurface(surface, geometry)
      context.restore()
    } else if (amount > 0) {
      context.save()
      context.shadowColor = color
      context.shadowBlur = 2 + 22 * clamp01(resolved.outlineThickness)
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha *= 0.25 + amount * 0.75
      const spread = 1 + 4 * clamp01(resolved.outlineThickness)
      this.drawSharp(source, geometry, -spread, 0)
      this.drawSharp(source, geometry, spread, 0)
      this.drawSharp(source, geometry, 0, -spread)
      this.drawSharp(source, geometry, 0, spread)
      context.restore()
    }
    this.drawSharp(source, geometry)
  }

  private drawBloom(
    source: CanvasImageSource,
    geometry: FragmentDrawGeometry,
    color: string,
    resolved: CanvasFracturesResolvedEffectSettings,
  ): void {
    const context = this.context
    const amount = resolved.bloomIntensity
    const surface = amount > 0 ? this.prepareEffectSurface(source, geometry, resolved.quality) : null
    if (surface) {
      const [red, green, blue] = hexToRgbBytes(color)
      const pixels = surface.imageData.data
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3] / 255
        const luma = (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) / 255
        const emissive = clamp01(Math.max(0, luma - 0.04) * alpha * amount)
        pixels[index] = red
        pixels[index + 1] = green
        pixels[index + 2] = blue
        pixels[index + 3] = Math.round(emissive * 255)
      }
      context.save()
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha *= 0.45 + amount * 0.65
      context.filter = `blur(${3 + amount * 18}px)`
      this.drawEffectSurface(surface, geometry)
      context.restore()
    } else if (amount > 0) {
      context.save()
      context.shadowColor = color
      context.shadowBlur = 6 + 30 * amount
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha *= 0.25 + amount * 0.65
      this.drawSharp(source, geometry)
      context.restore()
    }
    this.drawSharp(source, geometry)
  }

  private drawRgbSplit(
    source: CanvasImageSource,
    geometry: FragmentDrawGeometry,
    fragment: CanvasFractureFragment,
    resolved: CanvasFracturesResolvedEffectSettings,
  ): void {
    const context = this.context
    const amount = resolved.rgbSplit
    const distance = (1 + amount * 16) * (0.65 + fragment.effectAssignment.phase * 0.7)
    const dx = fragment.effectAssignment.directionX * distance
    const dy = fragment.effectAssignment.directionY * distance
    context.save()
    context.globalCompositeOperation = 'screen'
    context.globalAlpha *= 0.7
    context.filter = 'sepia(1) saturate(8) hue-rotate(-35deg)'
    this.drawSharp(source, geometry, dx, dy)
    context.filter = 'sepia(1) saturate(8) hue-rotate(145deg)'
    this.drawSharp(source, geometry, -dx, -dy)
    context.restore()
    this.drawSharp(source, geometry)
  }

  private drawLuma(
    source: CanvasImageSource,
    geometry: FragmentDrawGeometry,
    color: string,
    resolved: CanvasFracturesResolvedEffectSettings,
  ): void {
    const context = this.context
    const threshold = clamp01(resolved.lumaThreshold)
    const mode = resolved.lumaMode
    const surface = this.prepareEffectSurface(source, geometry, resolved.quality)
    if (surface) {
      const [red, green, blue] = hexToRgbBytes(color)
      const pixels = surface.imageData.data
      const softness = 0.05 + (1 - resolved.intensity) * 0.08
      for (let index = 0; index < pixels.length; index += 4) {
        const sourceAlpha = pixels[index + 3] / 255
        const luma = (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) / 255
        const mask = mode === 'shadows'
          ? 1 - smoothstep(threshold - softness, threshold + softness, luma)
          : mode === 'band'
            ? 1 - smoothstep(softness, softness * 3, Math.abs(luma - threshold))
            : smoothstep(threshold - softness, threshold + softness, luma)
        const tint = resolved.intensity * 0.45
        pixels[index] = Math.round(pixels[index] * (1 - tint) + red * tint)
        pixels[index + 1] = Math.round(pixels[index + 1] * (1 - tint) + green * tint)
        pixels[index + 2] = Math.round(pixels[index + 2] * (1 - tint) + blue * tint)
        pixels[index + 3] = Math.round(sourceAlpha * mask * 255)
      }
      context.save()
      context.globalCompositeOperation = 'screen'
      this.drawEffectSurface(surface, geometry)
      context.restore()
      return
    }

    context.save()
    context.filter = mode === 'shadows'
      ? `grayscale(1) invert(1) contrast(${2 + threshold * 5})`
      : mode === 'band'
        ? `grayscale(1) contrast(${3 + threshold * 6}) brightness(${0.75 + threshold * 0.5})`
        : `grayscale(1) contrast(${2 + threshold * 5}) brightness(${0.55 + threshold})`
    context.globalCompositeOperation = 'screen'
    context.globalAlpha *= 0.4 + resolved.intensity * 0.6
    context.shadowColor = color
    context.shadowBlur = 8 * resolved.intensity
    this.drawSharp(source, geometry)
    context.restore()
  }

  private drawDisplaced(
    source: CanvasImageSource,
    geometry: FragmentDrawGeometry,
    fragment: CanvasFractureFragment,
    resolved: CanvasFracturesResolvedEffectSettings,
  ): void {
    const context = this.context
    const amount = resolved.displacement
    const horizontal = Math.abs(fragment.effectAssignment.directionX) >= Math.abs(fragment.effectAssignment.directionY)
    const slices = resolved.quality === 'low' ? 6 : resolved.quality === 'high' ? 14 : 10
    for (let index = 0; index < slices; index += 1) {
      const sign = ((fragment.effectAssignment.seed + index * 17) & 1) === 0 ? -1 : 1
      const offset = sign * amount * (3 + 20 * ((index + fragment.effectAssignment.phase) % 1))
      if (horizontal) {
        const sourceSliceHeight = geometry.sourceHeight / slices
        const destinationSliceHeight = geometry.destinationHeight / slices
        context.drawImage(
          source,
          geometry.sourceX,
          geometry.sourceY + sourceSliceHeight * index,
          geometry.sourceWidth,
          sourceSliceHeight + 0.5,
          -geometry.destinationWidth * 0.5 + offset,
          -geometry.destinationHeight * 0.5 + destinationSliceHeight * index,
          geometry.destinationWidth,
          destinationSliceHeight + 0.5,
        )
      } else {
        const sourceSliceWidth = geometry.sourceWidth / slices
        const destinationSliceWidth = geometry.destinationWidth / slices
        context.drawImage(
          source,
          geometry.sourceX + sourceSliceWidth * index,
          geometry.sourceY,
          sourceSliceWidth + 0.5,
          geometry.sourceHeight,
          -geometry.destinationWidth * 0.5 + destinationSliceWidth * index,
          -geometry.destinationHeight * 0.5 + offset,
          destinationSliceWidth + 0.5,
          geometry.destinationHeight,
        )
      }
    }
  }

  private drawTextured(
    source: CanvasImageSource,
    geometry: FragmentDrawGeometry,
    fragment: CanvasFractureFragment,
    palette: CanvasFracturesResolvedPalette,
    resolved: CanvasFracturesResolvedEffectSettings,
  ): void {
    const context = this.context
    const pixelAmount = resolved.pixelation
    const columns = Math.max(4, Math.round((resolved.quality === 'high' ? 28 : resolved.quality === 'low' ? 12 : 20) * (1 - pixelAmount * 0.7)))
    const rows = Math.max(3, Math.round(columns * geometry.destinationHeight / Math.max(1, geometry.destinationWidth)))
    const previousSmoothing = context.imageSmoothingEnabled
    context.imageSmoothingEnabled = false
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const sx = geometry.sourceX + geometry.sourceWidth * ((x + 0.5) / columns)
        const sy = geometry.sourceY + geometry.sourceHeight * ((y + 0.5) / rows)
        const dx = -geometry.destinationWidth * 0.5 + geometry.destinationWidth * x / columns
        const dy = -geometry.destinationHeight * 0.5 + geometry.destinationHeight * y / rows
        context.drawImage(
          source,
          sx,
          sy,
          Math.max(1, geometry.sourceWidth / columns * 0.1),
          Math.max(1, geometry.sourceHeight / rows * 0.1),
          dx,
          dy,
          geometry.destinationWidth / columns + 0.5,
          geometry.destinationHeight / rows + 0.5,
        )
      }
    }
    context.imageSmoothingEnabled = previousSmoothing

    if (resolved.scanlines > 0 && typeof context.fillRect === 'function') {
      context.save()
      context.globalAlpha *= resolved.scanlines * 0.45
      context.fillStyle = palette.supporting
      const spacing = Math.max(3, 5 + Math.round((1 - resolved.scanlines) * 7))
      for (let y = -geometry.destinationHeight * 0.5 + fragment.effectAssignment.phase * spacing; y < geometry.destinationHeight * 0.5; y += spacing) {
        context.fillRect(-geometry.destinationWidth * 0.5, y, geometry.destinationWidth, 1)
      }
      context.restore()
    }

    if (resolved.noise > 0 && typeof context.fillRect === 'function') {
      context.save()
      context.globalAlpha *= resolved.noise * 0.35
      context.fillStyle = palette.accent
      const points = resolved.quality === 'high' ? 48 : resolved.quality === 'low' ? 16 : 28
      for (let index = 0; index < points; index += 1) {
        const hash = Math.imul(fragment.effectAssignment.seed ^ (index * 0x45d9f3b), 0x45d9f3b) >>> 0
        const x = (hash & 0xffff) / 0xffff
        const y = ((hash >>> 16) & 0xffff) / 0xffff
        context.fillRect(
          -geometry.destinationWidth * 0.5 + x * geometry.destinationWidth,
          -geometry.destinationHeight * 0.5 + y * geometry.destinationHeight,
          1 + (hash & 3),
          1,
        )
      }
      context.restore()
    }
  }
}
