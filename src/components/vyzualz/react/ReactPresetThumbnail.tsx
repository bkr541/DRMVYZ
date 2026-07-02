import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactPreset } from './ReactTypes'
import {
  readCachedReactPresetThumbnail,
  renderReactPresetThumbnail,
} from './renderers/ReactPresetThumbnailRenderer'

const THUMB_W = 112
const THUMB_H = 64
const THUMBNAIL_PRELOAD_MARGIN_PX = 240

export function ReactPresetThumbnail({
  preset,
  className = '',
  generationKey = '',
}: {
  preset: ReactPreset
  className?: string
  generationKey?: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(() => (
    readCachedReactPresetThumbnail(preset, { width: THUMB_W, height: THUMB_H })
  ))
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    dataUrl ? 'ready' : 'idle',
  )

  const background = useMemo(
    () => `linear-gradient(135deg, ${preset.palette.background}, ${preset.palette.primary}33 55%, ${preset.palette.secondary}40)`,
    [preset.palette.background, preset.palette.primary, preset.palette.secondary],
  )

  useEffect(() => {
    const cached = readCachedReactPresetThumbnail(preset, { width: THUMB_W, height: THUMB_H })
    if (cached) {
      setDataUrl(cached)
      setLoadState('ready')
      return
    }

    setDataUrl(null)
    setLoadState('idle')

    const host = hostRef.current
    if (!host) return

    let disposed = false
    let started = false
    let observer: IntersectionObserver | null = null
    let removeFallbackListeners = () => {}
    const requestController = new AbortController()

    const startRender = () => {
      if (disposed || started) return
      started = true
      observer?.disconnect()
      removeFallbackListeners()
      setLoadState('loading')

      void renderReactPresetThumbnail(preset, {
        width: THUMB_W,
        height: THUMB_H,
        signal: requestController.signal,
      }).then(url => {
        if (disposed || requestController.signal.aborted) return
        if (url) {
          setDataUrl(url)
          setLoadState('ready')
        } else {
          setLoadState('error')
        }
      })
    }

    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting || entry.intersectionRatio > 0)) {
          startRender()
        }
      }, {
        root: null,
        rootMargin: `${THUMBNAIL_PRELOAD_MARGIN_PX}px 0px`,
        threshold: 0,
      })
      observer.observe(host)
    } else {
      const checkViewport = () => {
        if (isElementNearViewport(host, THUMBNAIL_PRELOAD_MARGIN_PX)) startRender()
      }
      const onViewportChange = () => checkViewport()
      if (typeof window !== 'undefined') {
        window.addEventListener('scroll', onViewportChange, { passive: true, capture: true })
        window.addEventListener('resize', onViewportChange)
        removeFallbackListeners = () => {
          window.removeEventListener('scroll', onViewportChange, { capture: true })
          window.removeEventListener('resize', onViewportChange)
        }
      }
      checkViewport()
    }

    return () => {
      disposed = true
      observer?.disconnect()
      removeFallbackListeners()
      requestController.abort()
    }
  }, [preset, generationKey])

  return (
    <div
      ref={hostRef}
      className={`rv-preset-thumb${className ? ` ${className}` : ''}${loadState === 'ready' ? ' rv-preset-thumb--ready' : ''}`}
      aria-hidden="true"
      data-thumbnail-state={loadState}
      style={{ background }}
    >
      {dataUrl ? (
        <img className="rv-preset-thumb-img" src={dataUrl} alt="" loading="lazy" />
      ) : (
        <div className="rv-preset-thumb-fallback">
          <span className="rv-preset-thumb-fallback-grid" />
          <span className="rv-preset-thumb-fallback-grid" />
          <span className="rv-preset-thumb-fallback-glow" style={{ background: preset.palette.primary }} />
          <span className="rv-preset-thumb-fallback-glow rv-preset-thumb-fallback-glow--secondary" style={{ background: preset.palette.secondary }} />
        </div>
      )}
    </div>
  )
}

export function isElementNearViewport(element: Element, marginPx: number): boolean {
  if (typeof window === 'undefined') return false
  const rect = element.getBoundingClientRect()
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  return rect.bottom >= -marginPx
    && rect.right >= -marginPx
    && rect.top <= viewportHeight + marginPx
    && rect.left <= viewportWidth + marginPx
}
