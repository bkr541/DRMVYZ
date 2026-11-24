import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { OutputAspectRatio } from '../../../../native/outputBridge'
import { performanceOutputSize, performancePreviewScale } from './performanceOutputGeometry'

/** The engine remains mounted at one logical size; only its on-screen preview scales. */
export function PerformanceViewport({ aspectRatio, children }: { aspectRatio: OutputAspectRatio | null; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const size = aspectRatio ? performanceOutputSize(aspectRatio) : null
  useLayoutEffect(() => {
    const viewport = ref.current
    const host = viewport?.parentElement
    if (!viewport || !host || !aspectRatio) return
    const output = performanceOutputSize(aspectRatio)
    const measure = () => {
      const scale = performancePreviewScale({ width: host.clientWidth, height: host.clientHeight }, output)
      viewport.style.setProperty('--performance-preview-scale', String(scale))
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(host)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      viewport.style.removeProperty('--performance-preview-scale')
    }
  }, [aspectRatio])
  return <div ref={ref} className="rv-performance-viewport" data-performance-geometry-locked={size ? 'true' : undefined}
    style={size ? { width: size.width, height: size.height } : undefined}>{children}</div>
}
