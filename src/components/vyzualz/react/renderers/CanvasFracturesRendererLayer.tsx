import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type { CanvasFitMode, CanvasMediaItemType, CanvasPresetSettings } from '../ReactTypes'
import { generateCanvasFracturesPlan } from './fractures/CanvasFracturesPlan'
import { CanvasFracturesRenderer } from './fractures/CanvasFracturesRenderer'
import type {
  CanvasFracturesSourceElement,
  CanvasFracturesSourceTransform,
} from './fractures/CanvasFracturesTypes'

export interface CanvasFracturesRendererLayerProps {
  active: boolean
  sourceRef: RefObject<CanvasFracturesSourceElement | null>
  sourceIdentity: string
  mediaType: CanvasMediaItemType
  mediaRevision: number
  trackIdentity?: string | null
  fitMode: CanvasFitMode
  sourceTransform: CanvasFracturesSourceTransform
  settings: CanvasPresetSettings
  outputOpacity?: number
  onPreviewReady?: (ready: boolean) => void
  onStatusChange?: (message: string | null) => void
}

export function CanvasFracturesRendererLayer({
  active,
  sourceRef,
  sourceIdentity,
  mediaType,
  mediaRevision,
  trackIdentity,
  fitMode,
  sourceTransform,
  settings,
  outputOpacity = 1,
  onPreviewReady,
  onStatusChange,
}: CanvasFracturesRendererLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const renderParamsRef = useRef({ fitMode, sourceTransform, outputOpacity })
  renderParamsRef.current = { fitMode, sourceTransform, outputOpacity }
  const plan = useMemo(() => generateCanvasFracturesPlan({
    presetId: 'canvas-fractures',
    sourceIdentity,
    mediaType,
    mediaRevision,
    trackIdentity,
    // Stage two intentionally keeps one arrangement across transport time. The
    // topology/layout revisions are the deterministic reconstruction identity.
    transportPositionSec: 0,
    variationSeed: settings.fractureVariationSeed,
    topologyRevision: settings.fractureTopologyRevision,
    layoutRevision: settings.fractureLayoutRevision,
    mode: settings.fractureMode,
    intensity: settings.fractureIntensity,
    focusProtection: settings.fractureFocusProtection,
    focusX: settings.fractureFocusX,
    focusY: settings.fractureFocusY,
    composition: settings.fractureComposition,
    placementMode: settings.fracturePlacementMode,
    quality: settings.fractureQuality,
    anchorMode: settings.fractureAnchorMode,
  }), [
    mediaRevision,
    mediaType,
    settings.fractureAnchorMode,
    settings.fractureComposition,
    settings.fractureFocusProtection,
    settings.fractureFocusX,
    settings.fractureFocusY,
    settings.fractureIntensity,
    settings.fractureLayoutRevision,
    settings.fractureMode,
    settings.fracturePlacementMode,
    settings.fractureQuality,
    settings.fractureTopologyRevision,
    settings.fractureVariationSeed,
    sourceIdentity,
    trackIdentity,
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    onPreviewReady?.(false)
    onStatusChange?.(null)
    if (!active || !canvas) return

    const result = CanvasFracturesRenderer.create(canvas)
    if (!result.renderer) {
      onStatusChange?.(result.error)
      return
    }
    const renderer = result.renderer
    renderer.setPlan(plan)
    let frameId = 0
    let previewReady = false

    const draw = () => {
      const bounds = canvas.parentElement?.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.round(bounds?.width || 1280))
      const cssHeight = Math.max(1, Math.round(bounds?.height || 720))
      renderer.resize(cssWidth, cssHeight, window.devicePixelRatio || 1)
      const renderParams = renderParamsRef.current
      const rendered = renderer.render({
        source: sourceRef.current,
        fitMode: renderParams.fitMode,
        sourceTransform: renderParams.sourceTransform,
        outputOpacity: renderParams.outputOpacity,
      })
      if (rendered && !previewReady) {
        previewReady = true
        onPreviewReady?.(true)
      }
      frameId = window.requestAnimationFrame(draw)
    }

    draw()
    return () => {
      window.cancelAnimationFrame(frameId)
      renderer.dispose()
      onPreviewReady?.(false)
      onStatusChange?.(null)
    }
  }, [active, onPreviewReady, onStatusChange, plan, sourceRef])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="rv-canvas-fractures-renderer-layer"
      data-renderer-kind="fragmentCollage"
      data-renderer-backend="canvas2d"
      data-fractures-plan-id={plan.id}
      data-fractures-topology-id={plan.topologyIdentity}
      data-fractures-layout-id={plan.layoutIdentity}
      data-fractures-source-path={plan.sourcePath}
      data-fractures-media-revision={plan.mediaRevision}
      data-fractures-fragment-count={plan.fragments.length}
      data-fractures-anchor-mode={plan.anchor.mode}
      aria-hidden="true"
    />
  )
}
