import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import { MediaEditRenderer } from '../../../features/media/edit/MediaEditGlRenderer'
import { createDefaultMediaEdit, type MediaEditState } from '../../../features/media/edit/mediaEditModel'

/** The preview never needs more than this many pixels on its long edge. */
export const PREVIEW_MAX_EDGE = 1600

interface MediaEditPreviewProps {
  canvasRef: RefObject<HTMLCanvasElement>
  /** The one real <img>/<video>: playback, seeking and the timeline stay on it. */
  sourceRef: RefObject<HTMLImageElement | HTMLVideoElement>
  kind: 'image' | 'video'
  edit: MediaEditState
  /** Show the whole frame (crop off) so the crop overlay has something to sit on. */
  ignoreCrop: boolean
  /** Changes when the underlying content changes, forcing a texture re-upload. */
  sourceKey: string
  className: string
  /** Called once if the GPU renderer cannot run, so the stage can fall back to the plain source. */
  onFault: (message: string) => void
}

/**
 * Draws the edit live with the same renderer Save uses. It renders the existing
 * media element — it never creates a second video — so playback state and the
 * timeline keep working.
 */
export function MediaEditPreview({ canvasRef, sourceRef, kind, edit, ignoreCrop, sourceKey, className, onFault }: MediaEditPreviewProps) {
  const rendererRef = useRef<MediaEditRenderer | null>(null)
  const uploadedKeyRef = useRef<string | null>(null)
  const effectiveEdit = useMemo(
    () => (ignoreCrop ? { ...edit, crop: createDefaultMediaEdit().crop } : edit),
    [edit, ignoreCrop],
  )
  const editRef = useRef(effectiveEdit)
  editRef.current = effectiveEdit
  const faultRef = useRef(onFault)
  faultRef.current = onFault

  const draw = useCallback(() => {
    const renderer = rendererRef.current
    const source = sourceRef.current
    if (!renderer || !source) return
    let width: number
    let height: number
    if (kind === 'video') {
      const video = source as HTMLVideoElement
      if (video.readyState < 2 || !video.videoWidth) return
      width = video.videoWidth
      height = video.videoHeight
    } else {
      const image = source as HTMLImageElement
      if (!image.complete || !image.naturalWidth) return
      width = image.naturalWidth
      height = image.naturalHeight
    }
    // A still image only needs uploading once per content; video uploads every frame.
    const upload = kind === 'video' || uploadedKeyRef.current !== sourceKey
    const geometry = renderer.render({
      source,
      sourceWidth: width,
      sourceHeight: height,
      edit: editRef.current,
      geometry: { maxEdge: PREVIEW_MAX_EDGE },
      uploadSource: upload,
    })
    if (geometry) uploadedKeyRef.current = sourceKey
    else if (renderer.lastError) faultRef.current(renderer.lastError.message)
  }, [kind, sourceKey, sourceRef])

  // One renderer per canvas element. It must NOT be rebuilt when `draw` changes (new signed URL,
  // for example): disposing releases the canvas's WebGL context, and a released context cannot
  // be re-acquired on the same element.
  const drawRef = useRef(draw)
  drawRef.current = draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = MediaEditRenderer.create(canvas)
    if (!renderer) {
      faultRef.current('Live edit preview needs GPU (WebGL2) rendering, which is unavailable here.')
      return
    }
    rendererRef.current = renderer
    uploadedKeyRef.current = null
    drawRef.current()
    return () => {
      renderer.dispose()
      rendererRef.current = null
    }
  }, [canvasRef])

  // Any change to the edit repaints immediately.
  useEffect(() => { draw() }, [draw, effectiveEdit])

  // New frames / a finished image load repaint too.
  useEffect(() => {
    const source = sourceRef.current
    if (!source) return
    const events = kind === 'video' ? ['loadeddata', 'seeked', 'timeupdate', 'pause', 'play'] : ['load']
    for (const type of events) source.addEventListener(type, draw)
    let handle: number | null = null
    let cancelled = false
    const video = kind === 'video' ? (source as HTMLVideoElement) : null
    const loop = () => {
      if (cancelled || !video) return
      // Fallback path only: skip painting while paused; rVFC already fires only on new frames.
      if (typeof video.requestVideoFrameCallback === 'function' || !video.paused) draw()
      handle = typeof video.requestVideoFrameCallback === 'function'
        ? video.requestVideoFrameCallback(loop)
        : requestAnimationFrame(loop)
    }
    if (video) loop()
    return () => {
      cancelled = true
      for (const type of events) source.removeEventListener(type, draw)
      if (handle !== null && video) {
        if (typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(handle)
        else cancelAnimationFrame(handle)
      }
    }
  }, [draw, kind, sourceRef])

  return <canvas ref={canvasRef} className={`${className} mms-edit-canvas`} aria-label="Edited preview" />
}
