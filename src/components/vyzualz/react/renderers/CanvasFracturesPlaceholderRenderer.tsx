import { useEffect, useRef, type RefObject } from 'react'
import type { CanvasFitMode, CanvasPresetSettings } from '../ReactTypes'

export interface CanvasFracturesSourceTransform {
  scale: number
  positionX: number
  positionY: number
  rotation: number
}

export interface CanvasFracturesPlaceholderRendererProps {
  active: boolean
  sourceRef: RefObject<HTMLVideoElement | HTMLImageElement | null>
  fitMode: CanvasFitMode
  sourceTransform: CanvasFracturesSourceTransform
  settings: CanvasPresetSettings
  onPreviewReady?: (ready: boolean) => void
}

function isSourceReady(source: HTMLVideoElement | HTMLImageElement): boolean {
  if (source instanceof HTMLVideoElement) return source.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  return source.complete && source.naturalWidth > 0 && source.naturalHeight > 0
}

function getSourceSize(source: HTMLVideoElement | HTMLImageElement): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) {
    return { width: Math.max(1, source.videoWidth), height: Math.max(1, source.videoHeight) }
  }
  return { width: Math.max(1, source.naturalWidth), height: Math.max(1, source.naturalHeight) }
}

/**
 * Stage-one Fractures renderer boundary.
 *
 * It deliberately draws a neutral, synchronized source frame while later
 * patches add deterministic fragment planning and interpolation. Keeping this
 * as a dedicated renderer proves the production selection contract without
 * routing Fractures through the generic whole-image FX path.
 */
export function CanvasFracturesPlaceholderRenderer({
  active,
  sourceRef,
  fitMode,
  sourceTransform,
  settings,
  onPreviewReady,
}: CanvasFracturesPlaceholderRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    onPreviewReady?.(false)
    if (!active || !canvas) return

    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return

    let frameId = 0
    let previewReady = false
    const draw = () => {
      const source = sourceRef.current
      const bounds = canvas.parentElement?.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.round(bounds?.width || 1280))
      const cssHeight = Math.max(1, Math.round(bounds?.height || 720))
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      const targetWidth = Math.max(1, Math.round(cssWidth * dpr))
      const targetHeight = Math.max(1, Math.round(cssHeight * dpr))
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth
        canvas.height = targetHeight
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, cssWidth, cssHeight)

      if (source && isSourceReady(source)) {
        const sourceSize = getSourceSize(source)
        const sourceAspect = sourceSize.width / Math.max(1, sourceSize.height)
        const canvasAspect = cssWidth / Math.max(1, cssHeight)
        let drawWidth = cssWidth
        let drawHeight = cssHeight
        if (fitMode === 'contain') {
          if (sourceAspect > canvasAspect) drawHeight = cssWidth / sourceAspect
          else drawWidth = cssHeight * sourceAspect
        } else if (fitMode === 'cover') {
          if (sourceAspect > canvasAspect) drawWidth = cssHeight * sourceAspect
          else drawHeight = cssWidth / sourceAspect
        }

        context.save()
        context.translate(
          cssWidth * 0.5 + cssWidth * (sourceTransform.positionX / 100),
          cssHeight * 0.5 + cssHeight * (sourceTransform.positionY / 100),
        )
        context.rotate(sourceTransform.rotation * Math.PI / 180)
        context.scale(sourceTransform.scale, sourceTransform.scale)
        context.globalAlpha = 1
        context.globalCompositeOperation = 'source-over'
        context.filter = 'none'
        try {
          context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
          if (!previewReady) {
            previewReady = true
            onPreviewReady?.(true)
          }
        } catch {
          // Preserve the renderer surface while a browser source transitions.
        }
        context.restore()
      }

      frameId = window.requestAnimationFrame(draw)
    }

    draw()
    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [active, fitMode, onPreviewReady, sourceRef, sourceTransform.positionX, sourceTransform.positionY, sourceTransform.rotation, sourceTransform.scale])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="rv-canvas-fractures-placeholder-layer"
      data-renderer-kind="fragmentCollage"
      data-fractures-schema-version={settings.schemaVersion}
      data-fractures-seed={settings.fractureVariationSeed}
      aria-hidden="true"
    />
  )
}
