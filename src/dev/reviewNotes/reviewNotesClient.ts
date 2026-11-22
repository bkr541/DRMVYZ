import type { ReviewNote, ReviewNoteStatus } from './reviewNotesFormat'

/** Browser side of the dev-only review notes endpoints (mounted by the Vite plugin; see docs/review-notes.md). */
const ROUTE = '/__review-notes'
const headers = { 'content-type': 'application/json', 'x-review-notes': '1' }

async function request(path: string, init: RequestInit = {}): Promise<ReviewNote[]> {
  const response = await fetch(`${ROUTE}${path}`, { ...init, headers: { ...headers, ...init.headers } })
  let body: { notes?: ReviewNote[]; error?: string } = {}
  try { body = await response.json() as typeof body } catch { /* not JSON */ }
  if (!response.ok) throw new Error(body.error ?? `The review notes server said ${response.status}.`)
  return body.notes ?? []
}

export interface ReviewNotePreset { engine: string; presetId: string; presetName: string }
const query = ({ engine, presetId }: ReviewNotePreset) => `?engine=${encodeURIComponent(engine)}&presetId=${encodeURIComponent(presetId)}`

export const reviewNotesClient = {
  list: (preset: ReviewNotePreset) => request(`/notes${query(preset)}`),
  add: (preset: ReviewNotePreset, text: string, screenshot: string | null, context: Record<string, unknown>) =>
    request('/notes', { method: 'POST', body: JSON.stringify({ ...preset, text, context, ...(screenshot ? { screenshot } : {}) }) }),
  setStatus: (preset: ReviewNotePreset, id: string, status: ReviewNoteStatus) =>
    request(`/notes/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ ...preset, status }) }),
  remove: (preset: ReviewNotePreset, id: string) => request(`/notes/${encodeURIComponent(id)}${query(preset)}`, { method: 'DELETE' }),
  screenshotUrl: (path: string) => `${ROUTE}/screenshots/${path.split('/').pop()}`,
}

/**
 * A still of a canvas. A WebGL canvas only keeps its picture until the browser shows it, so the copy is made in the next animation frame, after the stage has drawn
 * the frame for that tick (its own frame callback was queued first) and before the picture is presented. Scaled down to at most `maxWidth` wide. Resolves null if
 * the canvas cannot be read.
 */
export function captureCanvasStill(canvas: HTMLCanvasElement, maxWidth = 1600): Promise<string | null> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      try {
        if (!canvas.width || !canvas.height) { resolve(null); return }
        const scale = Math.min(1, maxWidth / canvas.width)
        const copy = document.createElement('canvas')
        copy.width = Math.max(1, Math.round(canvas.width * scale)); copy.height = Math.max(1, Math.round(canvas.height * scale))
        const context = copy.getContext('2d')
        if (!context) { resolve(null); return }
        context.drawImage(canvas, 0, 0, copy.width, copy.height)
        resolve(copy.toDataURL('image/png'))
      } catch { resolve(null) }
    })
  })
}
