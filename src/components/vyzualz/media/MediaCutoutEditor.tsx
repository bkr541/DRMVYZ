import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { DrawerNotice } from '../shared/DrawerNotice'
import { IconChipButton } from '../react/controls/IconChipButton'
import { AppIcon } from '../../shared/icons/AppIcon'
import { MediaZoomControls } from './MediaZoomControls'
import { useZoomPan } from './zoomPan'
import {
  applyCutoutMask,
  copyPixelRegion,
  magicWandMask,
  pastePixelRegion,
  polygonMask,
  softenMaskEdge,
  toleranceToChannelDistance,
  type CutoutMask,
  type CutoutPoint,
  type PixelRect,
} from '../../../features/media/edit/cutout/cutoutPixels'
import { MAX_IMAGE_EXPORT_EDGE } from '../../../features/media/edit/mediaEditImageExport'
import { useMediaEditStore, type MediaEditBackgroundRemoval } from '../../../stores/mediaEditStore'
import { useMediaStore, type UploadedMedia } from '../../../stores/mediaStore'

interface HistoryStep { rect: PixelRect; before: Uint8ClampedArray; after: Uint8ClampedArray }
interface Pixels { width: number; height: number; working: ImageData; original: Uint8ClampedArray }

/** Undo keeps at most this many bytes of before/after pixels; the oldest steps go first. */
const HISTORY_BYTES = 256 * 1024 * 1024

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The image could not be loaded for editing.'))
    image.src = url
  })
}

function readPixels(image: HTMLImageElement, width: number, height: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Image editing is unavailable in this environment.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)
  const data = context.getImageData(0, 0, width, height)
  canvas.width = 0
  canvas.height = 0
  return data
}

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * Select & Remove on the Media Manager stage: Magic Wand (click a colour area) and Lasso (draw around an area) remove or
 * restore pixels of the image, Photoshop-style. It edits the image as it is before rotation, crop and colour edits (those
 * still apply on Save), starting from the Remove Background result when there is one. Restore always brings back the
 * original upload's pixels. Apply hands the transparent PNG to the edit session; nothing is saved until Save.
 */
export function MediaCutoutEditor({ media, backgroundRemoval }: { media: UploadedMedia; backgroundRemoval: MediaEditBackgroundRemoval | null }) {
  const tool = useMediaEditStore(state => state.cutoutTool)
  const action = useMediaEditStore(state => state.cutoutAction)
  const tolerance = useMediaEditStore(state => state.cutoutTolerance)
  const contiguous = useMediaEditStore(state => state.cutoutContiguous)

  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pixelsRef = useRef<Pixels | null>(null)
  const historyRef = useRef<HistoryStep[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const historyIndexRef = useRef(0)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [fit, setFit] = useState<{ width: number; height: number } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [lasso, setLasso] = useState<CutoutPoint[] | null>(null)
  const lassoRef = useRef<CutoutPoint[] | null>(null)
  const [altHeld, setAltHeld] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const zoom = useZoomPan(viewportRef, contentRef, size !== null)

  const effectiveAction = altHeld ? (action === 'remove' ? 'restore' : 'remove') : action

  // Load the image once, as it was when Select & Remove opened.
  const startingRemoval = useRef(backgroundRemoval).current
  const mediaRef = useRef(media)
  mediaRef.current = media
  useEffect(() => {
    const media = mediaRef.current
    let cancelled = false
    void (async () => {
      try {
        await useMediaStore.getState().ensureMediaSigned([media.id], 'visible')
        const fresh = useMediaStore.getState().items.find(item => item.id === media.id) ?? media
        if (!fresh.url) throw new Error('The image is unavailable.')
        const [original, starting] = await Promise.all([loadImage(fresh.url), startingRemoval ? loadImage(startingRemoval.url) : Promise.resolve(null)])
        if (cancelled) return
        const scale = Math.min(1, MAX_IMAGE_EXPORT_EDGE / Math.max(original.naturalWidth, original.naturalHeight))
        const width = startingRemoval?.width ?? Math.max(1, Math.round(original.naturalWidth * scale))
        const height = startingRemoval?.height ?? Math.max(1, Math.round(original.naturalHeight * scale))
        const originalPixels = readPixels(original, width, height)
        const working = starting ? readPixels(starting, width, height) : new ImageData(originalPixels.data.slice(), width, height)
        pixelsRef.current = { width, height, working, original: originalPixels.data }
        setSize({ width, height })
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'The image could not be loaded for editing.')
      }
    })()
    return () => { cancelled = true }
    // Only the image's identity matters: a refreshed signed link must not reload (and lose) the edits.
  }, [media.id, startingRemoval])

  // Draw the working pixels once the canvas exists at the image size.
  useEffect(() => {
    const pixels = pixelsRef.current, canvas = canvasRef.current
    if (!size || !pixels || !canvas) return
    canvas.width = size.width
    canvas.height = size.height
    canvas.getContext('2d')?.putImageData(pixels.working, 0, 0)
  }, [size])

  // The fitted display size: the whole image inside the viewport.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !size) return
    const measure = () => {
      const scale = Math.min(viewport.clientWidth / size.width, viewport.clientHeight / size.height)
      if (scale > 0) setFit({ width: size.width * scale, height: size.height * scale })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(viewport)
    return () => observer?.disconnect()
  }, [size])

  const setIndex = useCallback((index: number) => {
    historyIndexRef.current = index
    setHistoryIndex(index)
    useMediaEditStore.getState().setCutoutDirty(index > 0)
  }, [])

  const redraw = (rect: PixelRect) => {
    const pixels = pixelsRef.current
    canvasRef.current?.getContext('2d')?.putImageData(pixels!.working, 0, 0, rect.x, rect.y, rect.width, rect.height)
  }

  const commit = (mask: CutoutMask | null, mode: 'remove' | 'restore') => {
    const pixels = pixelsRef.current
    if (!mask || !pixels) return
    const softened = softenMaskEdge(mask, pixels.width, pixels.height)
    const rect = softened.bounds
    const before = copyPixelRegion(pixels.working.data, pixels.width, rect)
    if (!applyCutoutMask(pixels.working.data, pixels.original, pixels.width, softened, mode)) return
    const history = historyRef.current
    history.length = historyIndexRef.current
    history.push({ rect, before, after: copyPixelRegion(pixels.working.data, pixels.width, rect) })
    let bytes = history.reduce((sum, step) => sum + step.before.byteLength * 2, 0)
    let dropped = 0
    while (bytes > HISTORY_BYTES && history.length > 1) { bytes -= history.shift()!.before.byteLength * 2; dropped += 1 }
    // Dropped steps can no longer be undone, but the image still differs from where it started.
    setIndex(history.length)
    if (dropped) useMediaEditStore.getState().setCutoutDirty(true)
    redraw(rect)
  }

  const undo = useCallback(() => {
    const pixels = pixelsRef.current, index = historyIndexRef.current
    if (!pixels || index === 0) return
    const step = historyRef.current[index - 1]!
    pastePixelRegion(pixels.working.data, pixels.width, step.rect, step.before)
    canvasRef.current?.getContext('2d')?.putImageData(pixels.working, 0, 0, step.rect.x, step.rect.y, step.rect.width, step.rect.height)
    setIndex(index - 1)
  }, [setIndex])

  const redo = useCallback(() => {
    const pixels = pixelsRef.current, index = historyIndexRef.current
    if (!pixels || index >= historyRef.current.length) return
    const step = historyRef.current[index]!
    pastePixelRegion(pixels.working.data, pixels.width, step.rect, step.after)
    canvasRef.current?.getContext('2d')?.putImageData(pixels.working, 0, 0, step.rect.x, step.rect.y, step.rect.width, step.rect.height)
    setIndex(index + 1)
  }, [setIndex])

  const cancel = useCallback(() => useMediaEditStore.getState().setCutoutMode(false), [])

  const apply = useCallback(() => {
    const canvas = canvasRef.current, pixels = pixelsRef.current
    if (applying) return
    if (!canvas || !pixels || historyIndexRef.current === 0) { cancel(); return }
    setApplying(true)
    canvas.toBlob(blob => {
      setApplying(false)
      if (!blob) { setLoadError('The edited image could not be prepared.'); return }
      useMediaEditStore.getState().applyCutout({ blob, width: pixels.width, height: pixels.height })
    }, 'image/png')
  }, [applying, cancel])

  /** Image pixel under a client point (the canvas rect includes the zoom transform). */
  const imagePoint = (clientX: number, clientY: number): CutoutPoint | null => {
    const canvas = canvasRef.current, pixels = pixelsRef.current
    if (!canvas || !pixels) return null
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return { x: (clientX - rect.left) / rect.width * pixels.width, y: (clientY - rect.top) / rect.height * pixels.height }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button === 1 || (event.button === 0 && spaceHeld)) { zoom.startPan(event); return }
    if (event.button !== 0 || applying || !pixelsRef.current) return
    const point = imagePoint(event.clientX, event.clientY)
    if (!point) return
    const pixels = pixelsRef.current
    const mode = event.altKey ? (action === 'remove' ? 'restore' : 'remove') : action
    if (tool === 'wand') {
      // Remove picks the colour you see; Restore picks it from the original, where the area is still there.
      const source = mode === 'remove' ? pixels.working.data : pixels.original
      commit(magicWandMask(source, pixels.width, pixels.height, point.x, point.y, { tolerance: toleranceToChannelDistance(tolerance), contiguous, skipTransparent: mode === 'remove' }), mode)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    lassoRef.current = [point]
    setLasso([point])
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const points = lassoRef.current
    if (!points) return
    const point = imagePoint(event.clientX, event.clientY)
    const last = points[points.length - 1]!
    const canvas = canvasRef.current
    // Keep a point roughly every 2 screen pixels.
    const minStep = canvas ? 2 * pixelsRef.current!.width / canvas.getBoundingClientRect().width : 1
    if (!point || Math.hypot(point.x - last.x, point.y - last.y) < minStep) return
    points.push(point)
    setLasso([...points])
  }

  const finishLasso = (event: ReactPointerEvent<HTMLDivElement>) => {
    const points = lassoRef.current
    if (!points) return
    lassoRef.current = null
    setLasso(null)
    const pixels = pixelsRef.current
    if (!pixels || event.type === 'pointercancel') return
    const mode = event.altKey ? (action === 'remove' ? 'restore' : 'remove') : action
    commit(polygonMask(points, pixels.width, pixels.height), mode)
  }

  // Shortcuts: ⌘/Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo, W / L tools, Alt flips Remove ↔ Restore while held, Space pans,
  // + / − / 0 zoom, Enter applies, Escape drops a lasso in progress (or closes Select & Remove).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setAltHeld(true)
      if (isTyping(event.target)) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (mod && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if (mod && key === 'y') { event.preventDefault(); redo(); return }
      if (mod) return
      if (event.key === ' ') { event.preventDefault(); setSpaceHeld(true); return }
      if (key === 'w') useMediaEditStore.getState().setCutoutTool('wand')
      else if (key === 'l') useMediaEditStore.getState().setCutoutTool('lasso')
      else if (event.key === '+' || event.key === '=') zoom.zoomIn()
      else if (event.key === '-') zoom.zoomOut()
      else if (event.key === '0') zoom.fit()
      else if (event.key === 'Enter') { event.preventDefault(); apply() }
      else if (event.key === 'Escape') {
        if (lassoRef.current) { lassoRef.current = null; setLasso(null) } else cancel()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setAltHeld(false)
      if (event.key === ' ') setSpaceHeld(false)
    }
    const reset = () => { setAltHeld(false); setSpaceHeld(false) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', reset)
    }
  }, [undo, redo, apply, cancel, zoom])

  // Leaving Select & Remove (or the image) never leaves the session marked as having open changes.
  useEffect(() => () => useMediaEditStore.getState().setCutoutDirty(false), [])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < historyRef.current.length
  const hint = tool === 'wand'
    ? `Click an area to ${effectiveAction === 'remove' ? 'remove' : 'restore'} it. Hold Alt to ${effectiveAction === 'remove' ? 'restore' : 'remove'} instead.`
    : `Draw around an area to ${effectiveAction === 'remove' ? 'remove' : 'restore'} it. Hold Alt to ${effectiveAction === 'remove' ? 'restore' : 'remove'} instead.`
  const cursorClass = zoom.panning ? ' mmce-viewport--panning' : spaceHeld ? ' mmce-viewport--pan' : ''

  return (
    <div className="mmce-root" aria-label="Select and remove">
      <div
        ref={viewportRef}
        className={`mmce-viewport${cursorClass}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishLasso}
        onPointerCancel={finishLasso}
        onContextMenu={event => event.preventDefault()}
      >
        {loadError ? (
          <DrawerNotice tone="error" role="alert" title="Select & Remove unavailable">{loadError}</DrawerNotice>
        ) : !size ? (
          <div className="mmce-loading" role="status"><AppIcon kind="loading" size={16} className="app-icon--spinning" /> Preparing the image…</div>
        ) : (
          <div ref={contentRef} className={`mmce-content${fit && fit.width / size.width * zoom.view.scale >= 3 ? ' mmce-content--pixels' : ''}`} style={{ width: fit?.width, height: fit?.height, ...zoom.contentStyle }}>
            <canvas ref={canvasRef} className="mmce-canvas" aria-label={`${media.title ?? media.name}, editable`} />
            {lasso && lasso.length > 1 && (
              <svg className="mmce-lasso" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden="true">
                <polygon points={lasso.map(point => `${point.x},${point.y}`).join(' ')} />
              </svg>
            )}
          </div>
        )}
      </div>
      {size && !loadError && <MediaZoomControls zoom={zoom} />}
      <div className="mms-crop-toolbar" role="toolbar" aria-label="Select and remove">
        <span className="mms-crop-hint">{hint}</span>
        <IconChipButton icon={<AppIcon kind="undo" size={14} />} disabled={!canUndo || applying} onClick={undo} title="Undo (⌘Z)" aria-label="Undo" />
        <IconChipButton icon={<AppIcon kind="redo" size={14} />} disabled={!canRedo || applying} onClick={redo} title="Redo (⇧⌘Z)" aria-label="Redo" />
        <IconChipButton onClick={cancel} disabled={applying}>Cancel</IconChipButton>
        <IconChipButton tone="primary" onClick={apply} disabled={applying || !!loadError || !size}>{applying ? 'Applying…' : 'Apply'}</IconChipButton>
      </div>
    </div>
  )
}
