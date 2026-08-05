import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { RgbWaveformAnalysis } from '../../../../features/waveform/rgbWaveformTypes'
import { TrackTimelineVisualizer } from './TrackTimelineVisualizer'

const POPUP_NAME = 'drmvyz-track-timeline'
const POPUP_FEATURES = 'width=1600,height=1000,menubar=no,toolbar=no,location=no,status=no'

function cloneAppStylesInto(targetDocument: Document) {
  document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
    targetDocument.head.appendChild(node.cloneNode(true))
  })

  const sourceRoot = document.documentElement
  for (const attribute of ['data-theme', 'data-brand-accent', 'data-accent-color']) {
    const value = sourceRoot.getAttribute(attribute)
    if (value) targetDocument.documentElement.setAttribute(attribute, value)
  }
  targetDocument.documentElement.style.cssText = sourceRoot.style.cssText
}

export function TrackTimelineModal({
  onClose,
  analysis,
  rgbWaveform,
  filename,
  channels,
}: {
  onClose: () => void
  analysis: TrackIntelligenceAnalysis
  rgbWaveform: RgbWaveformAnalysis
  filename: string
  channels?: number | null
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const popupRef = useRef<Window | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const popup = window.open('', POPUP_NAME, POPUP_FEATURES)
    if (!popup) {
      onCloseRef.current()
      return
    }

    popupRef.current = popup
    popup.document.title = 'DRMVYZ — Track Timeline Visualizer'
    popup.document.documentElement.style.background = 'var(--color-background, #090d0f)'
    popup.document.body.style.margin = '0'
    popup.document.body.style.minHeight = '100vh'
    cloneAppStylesInto(popup.document)

    const root = popup.document.createElement('div')
    root.className = 'ttv-popup-root'
    popup.document.body.appendChild(root)
    setContainer(root)

    const handleUnload = () => onCloseRef.current()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') popup.close()
    }
    popup.addEventListener('beforeunload', handleUnload)
    popup.addEventListener('keydown', handleKeyDown)

    return () => {
      popup.removeEventListener('beforeunload', handleUnload)
      popup.removeEventListener('keydown', handleKeyDown)
      setContainer(null)
      if (!popup.closed) popup.close()
      popupRef.current = null
    }
  }, [])

  if (!container) return null
  return createPortal(
    <TrackTimelineVisualizer
      analysis={analysis}
      rgbWaveform={rgbWaveform}
      filename={filename}
      channels={channels}
    />,
    container,
  )
}
