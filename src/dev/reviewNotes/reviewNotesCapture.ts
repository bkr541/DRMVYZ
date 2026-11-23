const IGNORE = '[data-review-notes]'
const MAX_WIDTH = 1600
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

async function captureElectron(capturePage: () => Promise<string | null>): Promise<string | null> {
  const style = document.createElement('style')
  style.textContent = `${IGNORE} { visibility: hidden !important; }`
  document.head.appendChild(style)
  try {
    // Let Chromium paint the window with the review controls hidden before capturing its pixels.
    await nextFrame()
    await nextFrame()
    return await capturePage()
  } catch {
    return null
  } finally {
    style.remove()
  }
}

async function captureBrowser(): Promise<string | null> {
  const restore: (() => void)[] = []
  const omittedMedia = new WeakSet<Element>()
  try {
    const { toCanvas } = await import('html-to-image')
    const width = window.innerWidth, height = window.innerHeight

    // Copy WebGL while the renderer's current frame is still readable.
    await nextFrame()
    const copy = document.createElement('canvas')
    const context = copy.getContext('2d')
    if (!context) return null
    for (const media of document.querySelectorAll('canvas, video')) {
      if (media.closest(IGNORE)) continue
      if (!media.getClientRects().length) {
        omittedMedia.add(media)
        continue
      }
      try {
        if (media instanceof HTMLCanvasElement) {
          if (!media.width || !media.height) continue
          copy.width = media.width
          copy.height = media.height
          context.drawImage(media, 0, 0)
          const url = copy.toDataURL('image/png')
          const original = Object.getOwnPropertyDescriptor(media, 'toDataURL')
          Object.defineProperty(media, 'toDataURL', { value: () => url, configurable: true })
          restore.push(() => {
            if (original) Object.defineProperty(media, 'toDataURL', original)
            else delete (media as { toDataURL?: unknown }).toDataURL
          })
        } else if (media instanceof HTMLVideoElement) {
          // html-to-image reads video frames itself. Check they are drawable and origin-clean first.
          if (media.currentSrc) {
            copy.width = copy.height = 1
            context.drawImage(media, 0, 0, 1, 1)
            context.getImageData(0, 0, 1, 1)
          } else if (!media.poster) {
            omittedMedia.add(media)
          }
        }
      } catch {
        // An unreadable media element must not discard the rest of the window.
        omittedMedia.add(media)
      }
    }

    const scale = Math.min(1, MAX_WIDTH / width)
    const filter = (node: Node) => !(node instanceof Element && (node.closest(IGNORE) || omittedMedia.has(node)))
    const options = {
      width, height, canvasWidth: Math.max(1, Math.round(width * scale)), canvasHeight: Math.max(1, Math.round(height * scale)),
      pixelRatio: 1, filter, backgroundColor: getComputedStyle(document.body).backgroundColor || '#090d0f', cacheBust: true,
    }
    try {
      return (await toCanvas(document.body, options)).toDataURL('image/png')
    } catch {
      return (await toCanvas(document.body, { ...options, skipFonts: true })).toDataURL('image/png')
    }
  } catch {
    return null
  } finally {
    for (const undo of restore) undo()
  }
}

export async function captureWindow(): Promise<string | null> {
  const bridge = window.drmvyzNative?.reviewNotes
  return (bridge && await captureElectron(bridge.capturePage)) || captureBrowser()
}
