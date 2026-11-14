/**
 * Mobile App Preview: the real application, running in a phone-sized frame inside its own window. It is a second instance of the app
 * (same origin, so it shares the signed-in session), loaded with `?mobilePreview=1` so that instance knows it is the preview and does
 * not offer a preview of itself. Its viewport is the phone's logical size, so width-based CSS answers as it would on the device.
 */
export const MOBILE_APP_PREVIEW_PARAM = 'mobilePreview'
export const MOBILE_APP_PREVIEW_WINDOW_NAME = 'drmvyz-mobile-app-preview'
/** iPhone 16 logical size. */
export const MOBILE_APP_PREVIEW_SCREEN = { width: 393, height: 852 } as const
const FRAME_PADDING = 28
const WINDOW_CHROME_ALLOWANCE = 90
export const MOBILE_APP_PREVIEW_WINDOW = {
  width: MOBILE_APP_PREVIEW_SCREEN.width + FRAME_PADDING * 2,
  height: MOBILE_APP_PREVIEW_SCREEN.height + FRAME_PADDING * 2 + WINDOW_CHROME_ALLOWANCE,
} as const

/** True inside the preview's own frame. */
export function isMobileAppPreviewFrame(win: Pick<Window, 'location' | 'parent' | 'self'> = window): boolean {
  try {
    return win.parent !== win.self && new URLSearchParams(win.location.search).has(MOBILE_APP_PREVIEW_PARAM)
  } catch {
    return false
  }
}

export function mobileAppPreviewUrl(location: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${location.origin}${location.pathname}?${MOBILE_APP_PREVIEW_PARAM}=1`
}

/** Writes the phone frame and the app frame into an empty window. Returns a function that tears the window's listeners down. */
export function renderMobileAppPreview(popup: Window, url: string): void {
  const doc = popup.document
  doc.title = 'DRMVYZ — Mobile App Preview'
  doc.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    html, body { margin: 0; height: 100%; background: #020304; overflow: auto; }
    body { display: flex; align-items: center; justify-content: center; min-height: 100%; padding: ${FRAME_PADDING}px; box-sizing: border-box; }
    .device { position: relative; flex: none; width: ${MOBILE_APP_PREVIEW_SCREEN.width}px; height: ${MOBILE_APP_PREVIEW_SCREEN.height}px;
      border-radius: 48px; overflow: hidden; background: #000; box-shadow: 0 0 0 1px #ffffff1c, 0 16px 40px #000a; }
    iframe { display: block; width: 100%; height: 100%; border: 0; background: #090d0f; }
    .island { position: absolute; top: 11px; left: 50%; transform: translateX(-50%); width: 126px; height: 37px; border-radius: 22px;
      background: #000; pointer-events: none; z-index: 1; }
    .home { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: 134px; height: 5px; border-radius: 4px;
      background: #e1e7e9; opacity: .85; pointer-events: none; z-index: 1; }
  </style>`
  doc.body.innerHTML = ''
  const device = doc.createElement('div')
  device.className = 'device'
  const frame = doc.createElement('iframe')
  frame.title = 'DRMVYZ on iPhone 16'
  frame.src = url
  // The app needs the microphone, fullscreen and the clipboard, exactly as a top-level page does.
  frame.allow = 'microphone; camera; fullscreen; autoplay; clipboard-read; clipboard-write; display-capture'
  const island = doc.createElement('div'); island.className = 'island'
  const home = doc.createElement('div'); home.className = 'home'
  device.append(frame, island, home)
  doc.body.append(device)
}
