const IGNORE = '[data-review-notes]'
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

/**
 * A screenshot of the current window, as a PNG data URL no wider than `maxWidth`. The page is drawn from its own elements (the notes panel itself is left out), and the
 * visualizer's WebGL canvases, which a page capture cannot see, are copied while the stage's frame is still on screen and put in place, so the picture is what is
 * showing, with everything that sits over the stage still over it. Resolves null if the page cannot be drawn.
 */
export async function captureWindow(maxWidth = 1600): Promise<string | null> {
  const { toCanvas } = await import('html-to-image')
  const width = window.innerWidth, height = window.innerHeight
  const restore: (() => void)[] = []
  try {
    // One animation frame: the stage has drawn this tick's frame (its callback was queued first) and not yet presented it, so the canvases can be read now.
    await nextFrame()
    for (const canvas of document.querySelectorAll('canvas')) {
      if (canvas.closest(IGNORE) || !canvas.width || !canvas.height) continue
      try {
        const copy = document.createElement('canvas')
        copy.width = canvas.width; copy.height = canvas.height
        copy.getContext('2d')!.drawImage(canvas, 0, 0)
        const url = copy.toDataURL('image/png')
        // The page capture asks each canvas for its picture; hand it the copy.
        Object.defineProperty(canvas, 'toDataURL', { value: () => url, configurable: true })
        restore.push(() => { delete (canvas as { toDataURL?: unknown }).toDataURL })
      } catch { /* a canvas that cannot be read is left as it is */ }
    }
    const filter = (node: Node) => !(node instanceof Element && node.closest(IGNORE))
    const background = getComputedStyle(document.body).backgroundColor || '#090d0f'
    const options = { width, height, pixelRatio: 1, filter, backgroundColor: background, cacheBust: true }
    let drawn: HTMLCanvasElement
    try { drawn = await toCanvas(document.documentElement, options) } catch { drawn = await toCanvas(document.documentElement, { ...options, skipFonts: true }) }
    const scale = Math.min(1, maxWidth / drawn.width)
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(drawn.width * scale)); out.height = Math.max(1, Math.round(drawn.height * scale))
    out.getContext('2d')!.drawImage(drawn, 0, 0, out.width, out.height)
    return out.toDataURL('image/png')
  } catch { return null } finally { for (const undo of restore) undo() }
}
