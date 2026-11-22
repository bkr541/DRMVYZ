import type { ReviewNote, ReviewNoteKind, ReviewNoteStatus } from './reviewNotesFormat'

/** Browser side of the dev-only review notes endpoints (mounted by the Vite plugin; see docs/review-notes.md). */
const ROUTE = '/__review-notes'
const headers = { 'content-type': 'application/json', 'x-review-notes': '1' }

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ROUTE}${path}`, { ...init, headers: { ...headers, ...init.headers } })
  let body: { error?: string } = {}
  try { body = await response.json() as typeof body } catch { /* not JSON */ }
  if (!response.ok) throw new Error(body.error ?? `The review notes server said ${response.status}.`)
  return body as T
}

/** Where a note belongs: a preset (its engine and id), a page of the app (`engine: 'app'`, the page's id) or the whole app (`app` / `general`). */
export interface ReviewNotePlace { engine: string; presetId: string; presetName: string }
export interface ReviewNotesEntry extends ReviewNotePlace { notes: ReviewNote[] }
const query = ({ engine, presetId }: ReviewNotePlace) => `?engine=${encodeURIComponent(engine)}&presetId=${encodeURIComponent(presetId)}`

export const reviewNotesClient = {
  /** Every place that has notes, with its notes. */
  listAll: async (): Promise<ReviewNotesEntry[]> => (await call<{ entries: ReviewNotesEntry[] }>('/all')).entries,
  add: async (place: ReviewNotePlace, text: string, extra: { kind?: ReviewNoteKind; area?: string; screenshot?: string | null; context: Record<string, unknown> }): Promise<void> => {
    await call('/notes', { method: 'POST', body: JSON.stringify({ ...place, text, kind: extra.kind, area: extra.area, context: extra.context, ...(extra.screenshot ? { screenshot: extra.screenshot } : {}) }) })
  },
  setStatus: async (place: ReviewNotePlace, id: string, status: ReviewNoteStatus): Promise<void> => {
    await call(`/notes/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ ...place, status }) })
  },
  remove: async (place: ReviewNotePlace, id: string): Promise<void> => { await call(`/notes/${encodeURIComponent(id)}${query(place)}`, { method: 'DELETE' }) },
  screenshotUrl: (path: string) => `${ROUTE}/screenshots/${path.split('/').pop()}`,
}
