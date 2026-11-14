import { useEffect, useRef, useState } from 'react'
import { AppIcon } from '../../shared/icons/AppIcon'
import {
  MOBILE_APP_PREVIEW_WINDOW,
  MOBILE_APP_PREVIEW_WINDOW_NAME,
  mobileAppPreviewUrl,
  renderMobileAppPreview,
} from './mobileAppPreview'

/** Opens the running application in a phone-sized window. Not shown inside the preview itself. */
export function MobileAppPreviewLauncher() {
  const popupRef = useRef<Window | null>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => () => { popupRef.current?.close() }, [])

  const open = () => {
    if (popupRef.current && !popupRef.current.closed) { popupRef.current.focus(); return }
    const popup = window.open('', MOBILE_APP_PREVIEW_WINDOW_NAME,
      `popup=yes,width=${MOBILE_APP_PREVIEW_WINDOW.width},height=${MOBILE_APP_PREVIEW_WINDOW.height},menubar=no,toolbar=no,location=no,status=no,resizable=yes`)
    if (!popup) { setBlocked(true); return }
    setBlocked(false)
    popupRef.current = popup
    renderMobileAppPreview(popup, mobileAppPreviewUrl())
    popup.focus()
  }

  return <>
    <button type="button" className="fw-mobile-app-preview-launcher az-sidebar-utility" aria-label="Mobile App Preview"
      title="Mobile App Preview — the running app on an iPhone 16" onClick={open}>
      <AppIcon kind="mobileApp" size={20} />
    </button>
    {blocked && <div className="fw-mobile-preview-blocked" role="alert">The preview window was blocked. Allow pop-up windows, then press Mobile App Preview again.</div>}
  </>
}
