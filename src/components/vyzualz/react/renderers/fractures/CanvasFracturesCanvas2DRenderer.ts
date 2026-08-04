import {
  CanvasFracturesImagePaletteCache,
  resolveCanvasFracturesFallbackEffect,
  resolveCanvasFracturesPalette,
} from './CanvasFracturesEffects'
import {
  isCanvasFracturesSourceReady,
  resolveCanvasFracturesFitRect,
} from './CanvasFracturesTransforms'
import type {
  CanvasFractureFragment,
  CanvasFracturesPlan,
  CanvasFracturesRenderParams,
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

export class CanvasFracturesCanvas2DRenderer {
  private readonly context: CanvasRenderingContext2D
  private readonly effectCanvas: HTMLCanvasElement | null
  private readonly effectContext: CanvasRenderingContext2D | null
  private readonly paletteCache = new CanvasFracturesImagePaletteCache()
  private plan: CanvasFracturesPlan | null = null
  private orderedFragments: readonly CanvasFractureFragment[] = []
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
    let effectCanvas: HTMLCanvasElement | null = null
    let effectContext: CanvasRenderingContext2D | null = null
    try {
      if (typeof document !== 'undefined') {
        effectCanvas = document.createElement('canvas')
        effectCanvas.width = 1
        effectCanvas.height = 1
        effectContext = effectCanvas.getContext('2d', { alpha: true, willReadFrequently: true })
      }
    } catch {
      effectCanvas = null
      effectContext = null
    }
    this.effectCanvas = effectCanvas
    this.effectContext = effectContext
  }

  setPlan(plan: CanvasFracturesPlan): void {
    if (this.disposed || this.plan?.id === plan.id) return
    this.plan = plan
    this.orderedFragments = [...plan.fragments].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))
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
      context.save()
      context.globalAlpha = outputOpacity * anchor.opacity
      context.translate(fitRect.x + fitRect.width * 0.5, fitRect.y + fitRect.height * 0.5)
      context.scale(anchor.scale, anchor.scale)
      try {
        context.drawImage(source, -fitRect.width * 0.5, -fitRect.height * 0.5, fitRect.width, fitRect.height)
      } catch {
        context.restore()
        context.restore()
        return false
      }
      context.restore()
    }

    for (const fragment of this.orderedFragments) {
      this.drawFragment(fragment, source, dimensions.width, dimensions.height, fitRect, outputOpacity, params, palette)
    }
    context.restore()
    return true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.plan = null
    this.orderedFragments = []
    this.paletteCache.clear()
    this.context.setTransform(1, 0, 0, 1, 0, 0)
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
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
    source: HTMLVideoElement | HTMLImageElement,
    sourceWidth: number,
    sourceHeight: number,
    fitRect: { x: number; y: number; width: number; height: number },
    outputOpacity: number,
    params: CanvasFracturesRenderParams,
    palette: CanvasFracturesResolvedPalette,
  ): void {
    const context = this.context
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
    const centerX = fitRect.x + transform.centerX * fitRect.width
    const centerY = fitRect.y + transform.centerY * fitRect.height

    context.save()
    context.globalAlpha = outputOpacity * fragment.opacity
    context.translate(centerX, centerY)
    context.rotate(transform.rotationDeg * Math.PI / 180)
    context.scale(
      transform.scale * (fragment.mirrorX ? -1 : 1),
      transform.scale * (fragment.mirrorY ? -1 : 1),
    )
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

    const role = resolveCanvasFracturesFallbackEffect(fragment.effectRole)
    const intensity = clamp01(params.effects.intensity)
    try {
      if (role === 'outline') this.drawOutline(source, geometry, palette.primary, intensity, params)
      else if (role === 'glow') this.drawBloom(source, geometry, palette.supporting, intensity, params)
      else if (role === 'glitch') this.drawRgbSplit(source, geometry, fragment, intensity, params)
      else if (role === 'luma') this.drawLuma(source, geometry, palette.accent, intensity, params)
      else if (role === 'displacement') this.drawDisplaced(source, geometry, fragment, intensity, params)
      else if (role === 'texture') this.drawTextured(source, geometry, fragment, palette, intensity, params)
      else this.drawSharp(source, geometry)
    } catch {
      // A source can briefly become unavailable during replacement or seek.
    }
    context.restore()
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
    quality: CanvasFracturesRenderParams['effects']['quality'],
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
    intensity: number,
    params: CanvasFracturesRenderParams,
  ): void {
    const context = this.context
    const amount = intensity * clamp01(params.effects.outlineIntensity)
    const surface = amount > 0 ? this.prepareEffectSurface(source, geometry, params.effects.quality) : null
    if (surface) {
      const [red, green, blue] = hexToRgbBytes(color)
      const sourcePixels = new Uint8ClampedArray(surface.imageData.data)
      const output = surface.imageData.data
      const radius = 1 + Math.round(clamp01(params.effects.outlineThickness) * 3)
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
      context.filter = `blur(${0.4 + clamp01(params.effects.outlineThickness) * 1.8}px)`
      this.drawEffectSurface(surface, geometry)
      context.restore()
    } else if (amount > 0) {
      context.save()
      context.shadowColor = color
      context.shadowBlur = 2 + 22 * clamp01(params.effects.outlineThickness)
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha *= 0.25 + amount * 0.75
      const spread = 1 + 4 * clamp01(params.effects.outlineThickness)
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
    intensity: number,
    params: CanvasFracturesRenderParams,
  ): void {
    const context = this.context
    const amount = intensity * clamp01(params.effects.bloomIntensity)
    const surface = amount > 0 ? this.prepareEffectSurface(source, geometry, params.effects.quality) : null
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
    intensity: number,
    params: CanvasFracturesRenderParams,
  ): void {
    const context = this.context
    const amount = intensity * clamp01(params.effects.rgbSplit)
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
    intensity: number,
    params: CanvasFracturesRenderParams,
  ): void {
    const context = this.context
    const threshold = clamp01(params.effects.lumaThreshold)
    const mode = params.effects.lumaMode
    const surface = this.prepareEffectSurface(source, geometry, params.effects.quality)
    if (surface) {
      const [red, green, blue] = hexToRgbBytes(color)
      const pixels = surface.imageData.data
      const softness = 0.05 + (1 - intensity) * 0.08
      for (let index = 0; index < pixels.length; index += 4) {
        const sourceAlpha = pixels[index + 3] / 255
        const luma = (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) / 255
        const mask = mode === 'shadows'
          ? 1 - smoothstep(threshold - softness, threshold + softness, luma)
          : mode === 'band'
            ? 1 - smoothstep(softness, softness * 3, Math.abs(luma - threshold))
            : smoothstep(threshold - softness, threshold + softness, luma)
        const tint = intensity * 0.45
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
    context.globalAlpha *= 0.4 + intensity * 0.6
    context.shadowColor = color
    context.shadowBlur = 8 * intensity
    this.drawSharp(source, geometry)
    context.restore()
  }

  private drawDisplaced(
    source: CanvasImageSource,
    geometry: FragmentDrawGeometry,
    fragment: CanvasFractureFragment,
    intensity: number,
    params: CanvasFracturesRenderParams,
  ): void {
    const context = this.context
    const amount = intensity * clamp01(params.effects.displacement)
    const horizontal = Math.abs(fragment.effectAssignment.directionX) >= Math.abs(fragment.effectAssignment.directionY)
    const slices = params.effects.quality === 'low' ? 6 : params.effects.quality === 'high' ? 14 : 10
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
    intensity: number,
    params: CanvasFracturesRenderParams,
  ): void {
    const context = this.context
    const pixelAmount = clamp01(params.effects.pixelation) * intensity
    const columns = Math.max(4, Math.round((params.effects.quality === 'high' ? 28 : params.effects.quality === 'low' ? 12 : 20) * (1 - pixelAmount * 0.7)))
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

    const scanlineAmount = clamp01(params.effects.scanlines) * intensity
    if (scanlineAmount > 0 && typeof context.fillRect === 'function') {
      context.save()
      context.globalAlpha *= scanlineAmount * 0.45
      context.fillStyle = palette.supporting
      const spacing = Math.max(3, 5 + Math.round((1 - scanlineAmount) * 7))
      for (let y = -geometry.destinationHeight * 0.5 + fragment.effectAssignment.phase * spacing; y < geometry.destinationHeight * 0.5; y += spacing) {
        context.fillRect(-geometry.destinationWidth * 0.5, y, geometry.destinationWidth, 1)
      }
      context.restore()
    }

    const noiseAmount = clamp01(params.effects.noise) * intensity
    if (noiseAmount > 0 && typeof context.fillRect === 'function') {
      context.save()
      context.globalAlpha *= noiseAmount * 0.35
      context.fillStyle = palette.accent
      const points = params.effects.quality === 'high' ? 48 : params.effects.quality === 'low' ? 16 : 28
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
