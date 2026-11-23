import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { ReactBackgroundedContext } from './reactBackground'
import './ReactViewKeepAlive.css'

/**
 * Hosts the React view at one fixed place in the tree, so it is not torn down when the user opens another page while casting.
 *
 * The cast is a copy of the visualizer's canvas; when the React view unmounted, the visualizer, the cast stream and the cast itself ended with it. While `foreground` the host adds no
 * box of its own (`display: contents`), so the page lays out exactly as before. In the background it is moved off screen at the size the view last had, hidden, and made inert; the
 * view keeps rendering, and its header controls, popovers and hotkeys stand down (useReactBackgrounded).
 */
export function ReactViewKeepAlive({ foreground, children }: { foreground: boolean; children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const lastSize = useRef<{ width: number; height: number } | null>(null)
  const stageSize = useRef<{ width: number; height: number } | null>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (foreground) host.removeAttribute('inert')
    else host.setAttribute('inert', '')
  }, [foreground])

  // Remember the size the view has on its own page: it is the size the visualizer keeps while hidden, so the cast does not change resolution when the user leaves.
  useEffect(() => {
    if (!foreground) return
    const content = hostRef.current?.firstElementChild
    if (!content || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const { width, height } = content.getBoundingClientRect()
      if (width > 0 && height > 0) lastSize.current = { width: Math.round(width), height: Math.round(height) }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)

    // The visualizer panel's own size, kept for the same reason (ReactViewKeepAlive.css locks it while hidden). The panel appears once the lazy view has loaded, so look for it
    // for a few seconds and then rely on the observer.
    const stageObserver = new ResizeObserver(entries => {
      const { width, height } = entries[entries.length - 1].target.getBoundingClientRect()
      if (width > 0 && height > 0) stageSize.current = { width: Math.round(width), height: Math.round(height) }
    })
    let frame = 0
    let attempts = 0
    const attach = () => {
      const stage = hostRef.current?.querySelector('.rv-canvas-wrap')
      if (stage) stageObserver.observe(stage)
      else if (attempts++ < 300) frame = requestAnimationFrame(attach)
    }
    attach()
    return () => { observer.disconnect(); stageObserver.disconnect(); cancelAnimationFrame(frame) }
  }, [foreground])

  const locked = !foreground && stageSize.current !== null
  const style: CSSProperties = foreground
    ? { display: 'contents' }
    : {
        ...(stageSize.current ? { '--rv-hidden-stage-width': `${stageSize.current.width}px`, '--rv-hidden-stage-height': `${stageSize.current.height}px` } : {}),
        position: 'fixed', left: -100_000, top: 0, display: 'flex', flexDirection: 'column',
        width: lastSize.current?.width ?? Math.round(window.innerWidth * 0.8), height: lastSize.current?.height ?? Math.round(window.innerHeight * 0.8),
        visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden',
      }

  return (
    <div ref={hostRef} className="vz-react-host" data-workspace-layout="floating" data-app-workspace="react" data-backgrounded={foreground ? undefined : 'true'} data-stage-locked={locked ? 'true' : undefined} aria-hidden={foreground ? undefined : true} style={style}>
      <ReactBackgroundedContext.Provider value={!foreground}>{children}</ReactBackgroundedContext.Provider>
    </div>
  )
}
