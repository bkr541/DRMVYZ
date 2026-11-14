import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../shared/icons/AppIcon'
import { MobileProductionMockup, MOBILE_PRODUCTION_PAGES, type MobileProductionPage } from './MobileProductionMockup'
import previewStyles from './mobilePreview.css?inline'
import { mobilePreviewProductionStyles, mirrorMobilePreviewAppearance } from './mobilePreviewProductionStyles'
import { mobileAppPreviewUrl } from './mobileAppPreview'

export const MOBILE_PREVIEW_WINDOW_NAME = 'drmvyz-mobile-preview'
export const MOBILE_PREVIEW_WIDTH = 1200
export const MOBILE_PREVIEW_HEIGHT = 1000

// The production mockup: the real screens of the app at phone size. Auth is the sign-in screen; the rest are the signed-in pages.
const MOBILE_CHILDREN = [
  { id: 'mobile-auth', label: 'Auth', icon: 'lock' as const },
  ...MOBILE_PRODUCTION_PAGES.map(page => ({ id: `mobile-${page.id.toLowerCase()}`, label: page.label, icon: page.icon })),
]
const mobilePageOf = (id: string): MobileProductionPage | null => MOBILE_PRODUCTION_PAGES.find(page => `mobile-${page.id.toLowerCase()}` === id)?.id ?? null

function MobilePreviewWorkspace() {
  const [active, setActive] = useState('mobile-auth')
  const [mobileOpen, setMobileOpen] = useState(true)
  const label = `Mobile · ${MOBILE_CHILDREN.find(child => child.id === active)?.label}`
  const mobilePage = mobilePageOf(active)

  return <div className="mobile-preview-workspace">
    <aside className="mobile-preview-sidebar">
      <h1 className="mobile-preview-heading"><AppIcon kind="mobilePreview" size={18} />Mobile Preview</h1>
      <nav className="mobile-preview-nav" aria-label="Mobile preview views">
        <button type="button" className="mobile-preview-nav-parent" aria-expanded={mobileOpen} aria-controls="mobile-preview-submenu" data-active="true"
          onClick={() => setMobileOpen(open => !open)}>
          <AppIcon kind="mobileApp" size={20} /><span>Mobile</span><AppIcon kind={mobileOpen ? 'chevronDown' : 'chevronRight'} size={12} />
        </button>
        {mobileOpen && <div id="mobile-preview-submenu" className="mobile-preview-submenu" role="group" aria-label="Mobile screens">
          {MOBILE_CHILDREN.map(child => <button key={child.id} type="button" aria-current={active === child.id ? 'page' : undefined} onClick={() => setActive(child.id)}>
            <AppIcon kind={child.icon} size={16} /><span>{child.label}</span>
          </button>)}
        </div>}
      </nav>
    </aside>
    <section className="mobile-preview-stage-panel" aria-label="Phone preview workspace">
      <header className="mobile-preview-toolbar"><span>{label}</span><span>iPhone 16 · 393 × 852</span></header>
      <div className="mobile-preview-stage">
        <div className="mobile-preview-device-frame">
          <section className="mobile-preview-screen" aria-label="iPhone 16 preview">
            <div className="mobile-preview-island" aria-hidden="true" />
            {active === 'mobile-auth'
              ? <main className="mobile-preview-content mobile-preview-content--app" aria-label="Mobile preview canvas" data-mobile-view={active}>
                  <iframe className="mobile-preview-app-frame" title="DRMVYZ sign-in on iPhone 16" src={mobileAppPreviewUrl(window.location, 'auth')} />
                </main>
              : <main className="mobile-preview-content" aria-label="Mobile preview canvas" data-mobile-view={active}>
                  {mobilePage && <MobileProductionMockup page={mobilePage} onPageChange={next => setActive(`mobile-${next.toLowerCase()}`)} />}
                </main>}
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
    // Escape closes an open Notifications drawer first; only with none open does it close the preview window.
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !popup.document.querySelector('.vz-notifications-drawer')) popup.close() }
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
