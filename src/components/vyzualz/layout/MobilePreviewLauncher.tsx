import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../shared/icons/AppIcon'
import { MobilePerformanceMockup } from './MobilePerformanceMockup'
import previewStyles from './mobilePreview.css?inline'
import { mobilePreviewProductionStyles, mirrorMobilePreviewAppearance } from './mobilePreviewProductionStyles'

export const MOBILE_PREVIEW_WINDOW_NAME = 'drmvyz-mobile-preview'
export const MOBILE_PREVIEW_WIDTH = 1200
export const MOBILE_PREVIEW_HEIGHT = 1000

const MOBILE_VIEWS = [1, 2, 3, 4].map(number => ({ id: `option-${number}`, label: `Option ${number}`, icon: 'mobilePreview' as const }))

function MobilePreviewWorkspace() {
  const [active, setActive] = useState('option-1')
  const view = MOBILE_VIEWS.find(option => option.id === active)!


  return <div className="mobile-preview-workspace">
    <aside className="mobile-preview-sidebar">
      <h1 className="mobile-preview-heading"><AppIcon kind="mobilePreview" size={18} />Mobile Preview</h1>
      <nav className="mobile-preview-nav" aria-label="Mobile preview views">
        {MOBILE_VIEWS.map(option => <button key={option.id} type="button" aria-current={active === option.id ? 'page' : undefined} onClick={() => setActive(option.id)}>
          <AppIcon kind={option.icon} size={20} /><span>{option.label}</span>
        </button>)}
      </nav>
    </aside>
    <section className="mobile-preview-stage-panel" aria-label="Phone preview workspace">
      <header className="mobile-preview-toolbar"><span>{view.label}</span><span>iPhone 16 · 393 × 852</span></header>
      <div className="mobile-preview-stage">
        <div className="mobile-preview-device-frame">
          <section className="mobile-preview-screen" aria-label="iPhone 16 preview">
            <div className="mobile-preview-island" aria-hidden="true" />
            <main className="mobile-preview-content" aria-label="Mobile preview canvas" data-mobile-view={active}>
              <MobilePerformanceMockup key={active} variant={Number(active.slice(-1))} />
            </main>
            <div className="mobile-preview-home" aria-hidden="true" />
          </section>
        </div>
      </div>
    </section>
  </div>
}

/** Desktop preview workspace; never starts another app or audio runtime. */
export function MobilePreviewLauncher() {
  const popupRef = useRef<Window | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => () => { cleanupRef.current?.(); popupRef.current?.close() }, [])

  const open = () => {
    if (popupRef.current && !popupRef.current.closed) { popupRef.current.focus(); return }
    const popup = window.open('', MOBILE_PREVIEW_WINDOW_NAME,
      `popup=yes,width=${MOBILE_PREVIEW_WIDTH},height=${MOBILE_PREVIEW_HEIGHT},menubar=no,toolbar=no,location=no,status=no,resizable=yes`)
    if (!popup) { setBlocked(true); return }
    setBlocked(false)
    popupRef.current = popup
    popup.document.title = 'DRMVYZ — Mobile Preview'
    const style = popup.document.createElement('style')
    style.textContent = `${mobilePreviewProductionStyles}\n${previewStyles}`
    popup.document.head.appendChild(style)
    const stopMirroring = mirrorMobilePreviewAppearance(document, popup.document)
    const viewport = popup.document.createElement('meta')
    viewport.name = 'viewport'
    viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover'
    popup.document.head.appendChild(viewport)
    const root = popup.document.createElement('div')
    popup.document.body.appendChild(root)
    const closed = () => { cleanupRef.current?.(); popupRef.current = null; setContainer(null) }
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') popup.close() }
    popup.addEventListener('beforeunload', closed)
    popup.addEventListener('keydown', keydown)
    cleanupRef.current = () => {
      stopMirroring()
      popup.removeEventListener('beforeunload', closed)
      popup.removeEventListener('keydown', keydown)
    }
    setContainer(root)
    popup.focus()
  }

  return <>
    <button type="button" className="fw-mobile-preview-launcher az-sidebar-utility" aria-label="Mobile Preview" title="Mobile Preview — iPhone 16" aria-haspopup="dialog" onClick={open}>
      <AppIcon kind="mobilePreview" size={20} />
    </button>
    {blocked && <div className="fw-mobile-preview-blocked" role="alert">The preview window was blocked. Allow pop-up windows, then press Mobile Preview again.</div>}
    {container && createPortal(<MobilePreviewWorkspace />, container)}
  </>
}
