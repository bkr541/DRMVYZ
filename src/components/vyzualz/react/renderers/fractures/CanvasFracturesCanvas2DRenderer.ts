import {
  isCanvasFracturesSourceReady,
  resolveCanvasFracturesFitRect,
} from './CanvasFracturesTransforms'
import type {
  CanvasFractureFragment,
  CanvasFracturesPlan,
  CanvasFracturesRenderParams,
} from './CanvasFracturesTypes'

export class CanvasFracturesCanvas2DRenderer {
  private readonly context: CanvasRenderingContext2D
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
    if (this.cssWidth !== nextCssWidth || this.cssHeight !== nextCssHeight) {
      this.fitCacheMode = null
    }
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
    const sourceWidth = source instanceof HTMLVideoElement ? Math.max(1, source.videoWidth) : Math.max(1, source.naturalWidth)
    const sourceHeight = source instanceof HTMLVideoElement ? Math.max(1, source.videoHeight) : Math.max(1, source.naturalHeight)
    const fitRect = this.resolveFitRect(sourceWidth, sourceHeight, params.fitMode)
    const outputOpacity = Math.min(1, Math.max(0, params.outputOpacity ?? 1))

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
      this.drawFragment(fragment, source, sourceWidth, sourceHeight, fitRect, outputOpacity)
    }
    context.restore()
    return true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.plan = null
    this.orderedFragments = []
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
    this.fitRect.x = resolved.x
    this.fitRect.y = resolved.y
    this.fitRect.width = resolved.width
    this.fitRect.height = resolved.height
    return this.fitRect
  }

  private drawFragment(
    fragment: CanvasFractureFragment,
    source: HTMLVideoElement | HTMLImageElement,
    sourceWidth: number,
    sourceHeight: number,
    fitRect: { x: number; y: number; width: number; height: number },
    outputOpacity: number,
  ): void {
    const context = this.context
    const crop = fragment.crop
    const transform = fragment.currentTransform
    const destinationWidth = Math.max(0.5, fitRect.width * crop.width)
    const destinationHeight = Math.max(0.5, fitRect.height * crop.height)
    const sourceX = Math.max(0, Math.min(sourceWidth, crop.x * sourceWidth))
    const sourceY = Math.max(0, Math.min(sourceHeight, crop.y * sourceHeight))
    const sourceCropWidth = Math.max(1e-4, Math.min(sourceWidth - sourceX, crop.width * sourceWidth))
    const sourceCropHeight = Math.max(1e-4, Math.min(sourceHeight - sourceY, crop.height * sourceHeight))
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
      const x = (corner.x - 0.5) * destinationWidth
      const y = (corner.y - 0.5) * destinationHeight
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.closePath()
    context.clip()
    try {
      context.drawImage(
        source,
        sourceX,
        sourceY,
        sourceCropWidth,
        sourceCropHeight,
        -destinationWidth * 0.5,
        -destinationHeight * 0.5,
        destinationWidth,
        destinationHeight,
      )
    } catch {
      // A source can briefly become unavailable during replacement or seek.
    }
    context.restore()
  }
}
