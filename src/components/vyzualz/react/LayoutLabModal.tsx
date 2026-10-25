import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutLabMockup } from './LayoutLabMockup'

const POPUP_NAME = 'drmvyz-layout-lab'
// Matches the main DRMVYZ window's own dimensions (electron/main.cjs
// createMainWindow) so the mockup previews at the exact size production
// renders at, not a scaled-down approximation.
const POPUP_FEATURES = 'width=1600,height=1000,menubar=no,toolbar=no,location=no,status=no'

export function mirrorAppStylesInto(targetDocument: Document): () => void {
  const mirrors = new Map<Element, { clone: Element; markup: string }>()
  const sync = () => {
    const sources = new Set(document.querySelectorAll('link[rel="stylesheet"], style'))
    for (const [source, mirror] of mirrors) if (!sources.has(source)) { mirror.clone.remove(); mirrors.delete(source) }
    for (const source of sources) {
      const previous = mirrors.get(source), markup = source.outerHTML
      if (previous?.markup === markup) continue
      const clone = source.cloneNode(true) as Element
      if (previous) previous.clone.replaceWith(clone)
      else targetDocument.head.appendChild(clone)
      mirrors.set(source, { clone, markup })
    }
  }
  sync()
  // Lazy workspace modules may load styles after the popup has opened.
  const observer = new MutationObserver(sync)
  observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true })
  return () => observer.disconnect()
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
    popup.document.documentElement.dataset.theme = document.documentElement.dataset.theme ?? 'dark'
    const stopMirroringStyles = mirrorAppStylesInto(popup.document)

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
      stopMirroringStyles()
      popup.removeEventListener('beforeunload', handleUnload)
      setContainer(null)
      popup.close()
      popupRef.current = null
    }
  }, [])

  if (!container) return null

  return createPortal(<LayoutLabMockup />, container)
}
