import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutLabMockup } from './LayoutLabMockup'

const POPUP_NAME = 'drmvyz-layout-lab'
// Matches the main DRMVYZ window's own dimensions (electron/main.cjs
// createMainWindow) so the mockup previews at the exact size production
// renders at, not a scaled-down approximation.
const POPUP_FEATURES = 'width=1600,height=1000,menubar=no,toolbar=no,location=no,status=no'

function cloneAppStylesInto(targetDocument: Document) {
  const nodes = document.querySelectorAll('link[rel="stylesheet"], style')
  nodes.forEach(node => {
    targetDocument.head.appendChild(node.cloneNode(true))
  })
}

export function LayoutLabModal({ onClose }: { onClose: () => void }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const popupRef = useRef<Window | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const popup = window.open('', POPUP_NAME, POPUP_FEATURES)
    if (!popup) {
      // Popup blocked — fall back to closing immediately rather than a
      // silently broken trigger.
      onCloseRef.current()
      return
    }

    popupRef.current = popup
    popup.document.title = 'DRMVYZ — Layout Lab'
    popup.document.documentElement.style.background = '#060d10'
    popup.document.body.style.margin = '0'
    popup.document.body.style.height = '100vh'
    popup.document.body.style.overflow = 'hidden'
    cloneAppStylesInto(popup.document)

    const root = popup.document.createElement('div')
    root.style.height = '100%'
    popup.document.body.appendChild(root)
    setContainer(root)

    const handleUnload = () => onCloseRef.current()
    popup.addEventListener('beforeunload', handleUnload)
    popup.addEventListener('keydown', event => {
      if (event.key === 'Escape') popup.close()
    })

    return () => {
      popup.removeEventListener('beforeunload', handleUnload)
      setContainer(null)
      popup.close()
      popupRef.current = null
    }
  }, [])

  if (!container) return null

  return createPortal(<LayoutLabMockup />, container)
}
