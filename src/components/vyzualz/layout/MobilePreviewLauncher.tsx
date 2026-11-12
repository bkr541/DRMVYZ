import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../shared/icons/AppIcon'
import previewStyles from './mobilePreview.css?inline'

export const MOBILE_PREVIEW_WINDOW_NAME = 'drmvyz-mobile-preview'
export const MOBILE_PREVIEW_WIDTH = 393
export const MOBILE_PREVIEW_HEIGHT = 852

/** A separate, blank device-sized design surface; never starts another app or audio runtime. */
export function MobilePreviewLauncher() {
  const popupRef = useRef<Window | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => () => { cleanupRef.current?.(); popupRef.current?.close() }, [])

  const open = () => {
    if (popupRef.current && !popupRef.current.closed) { popupRef.current.focus(); return }
    const popup = window.open('', MOBILE_PREVIEW_WINDOW_NAME,
      `popup=yes,width=${MOBILE_PREVIEW_WIDTH},height=${MOBILE_PREVIEW_HEIGHT},menubar=no,toolbar=no,location=no,status=no,resizable=no`)
    if (!popup) { setBlocked(true); return }
    setBlocked(false)
    popupRef.current = popup
    popup.document.title = 'DRMVYZ — iPhone 16 Preview'
    const style = popup.document.createElement('style')
    style.textContent = previewStyles
    popup.document.head.appendChild(style)
    const viewport = popup.document.createElement('meta')
    viewport.name = 'viewport'
    viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover'
    popup.document.head.appendChild(viewport)
    const root = popup.document.createElement('div')
    popup.document.body.appendChild(root)
    const closed = () => { popupRef.current = null; setContainer(null) }
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') popup.close() }
    popup.addEventListener('beforeunload', closed)
    popup.addEventListener('keydown', keydown)
    cleanupRef.current = () => {
      popup.removeEventListener('beforeunload', closed)
      popup.removeEventListener('keydown', keydown)
    }
    setContainer(root)
    popup.focus()
  }

  return <>
    <button type="button" className="fw-mobile-preview-launcher" aria-label="Mobile Preview" title="Mobile Preview — iPhone 16" aria-haspopup="dialog" onClick={open}>
      <AppIcon kind="mobilePreview" size={20} />
    </button>
    {blocked && <div className="fw-mobile-preview-blocked" role="alert">The preview window was blocked. Allow pop-up windows, then press Mobile Preview again.</div>}
    {container && createPortal(<section className="mobile-preview-screen" aria-label="iPhone 16 preview">
      <div className="mobile-preview-island" aria-hidden="true" />
      <main className="mobile-preview-content" aria-label="Mobile preview canvas" />
      <div className="mobile-preview-home" aria-hidden="true" />
    </section>, container)}
  </>
}
