import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { REVIEW_NOTES_SCREENSHOT_DIR, isReviewNoteKind } from './reviewNotesFormat.ts'
import { ReviewNotesStore } from './reviewNotesStore.ts'

export const REVIEW_NOTES_ROUTE = '/__review-notes'
/** Sent with every write and read; a custom header cannot be sent by another web page without a pre-flight the server never answers. */
export const REVIEW_NOTES_HEADER = 'x-review-notes'
const MAX_BODY = 14 * 1024 * 1024
const SCREENSHOT = /^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => { size += chunk.length; if (size > MAX_BODY) { reject(new Error('That is too large.')); req.destroy() } else chunks.push(chunk) })
    req.on('end', () => { try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(value && typeof value === 'object' ? value as Record<string, unknown> : {}) } catch { reject(new Error('That was not JSON.')) } })
    req.on('error', reject)
  })
}

const text = (value: unknown) => typeof value === 'string' ? value : ''

/**
 * The request handler behind the review notes panel. Development only: it is mounted by the Vite plugin below, which only exists in `vite serve`.
 *   GET    /__review-notes/notes?engine=&presetId=       the notes for one place (a preset, a page of the app, or the whole app)
 *   GET    /__review-notes/all                           every place that has notes, with its notes
 *   POST   /__review-notes/notes                         add a note (text, optional screenshot data URL and context)
 *   POST   /__review-notes/notes/:id/status              mark a note open or done
 *   DELETE /__review-notes/notes/:id?engine=&presetId=   remove a note
 *   GET    /__review-notes/screenshots/<file>            a note's screenshot
 */
export function createReviewNotesHandler(root: string) {
  const store = new ReviewNotesStore(root)
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith(`${REVIEW_NOTES_ROUTE}/`)) return false
    const route = url.pathname.slice(REVIEW_NOTES_ROUTE.length)
    try {
      const shot = /^\/screenshots\/([A-Za-z0-9_.-]+\.(?:png|webp|jpg))$/.exec(route)
      if (req.method === 'GET' && shot) {
        const bytes = await readFile(join(root, REVIEW_NOTES_SCREENSHOT_DIR, shot[1]!))
        res.statusCode = 200; res.setHeader('content-type', `image/${shot[1]!.endsWith('.jpg') ? 'jpeg' : shot[1]!.split('.').pop()}`); res.setHeader('cache-control', 'no-store'); res.end(bytes)
        return true
      }
      if (req.headers[REVIEW_NOTES_HEADER] !== '1') { send(res, 403, { error: 'Missing review notes header.' }); return true }
      const engine = url.searchParams.get('engine') ?? '', presetId = url.searchParams.get('presetId') ?? ''
      if (route === '/notes' && req.method === 'GET') {
        if (!engine || !presetId) { send(res, 400, { error: 'engine and presetId are required.' }); return true }
        send(res, 200, { notes: (await store.read(engine, presetId))?.notes ?? [] }); return true
      }
      if (route === '/all' && req.method === 'GET') {
        const entries = (await store.readAll()).map(({ file }) => ({ engine: file.engine, presetId: file.presetId, presetName: file.presetName, notes: file.notes }))
        send(res, 200, { entries }); return true
      }
      if (route === '/notes' && req.method === 'POST') {
        const body = await readBody(req)
        const bodyEngine = text(body['engine']), bodyPreset = text(body['presetId'])
        if (!bodyEngine || !bodyPreset) { send(res, 400, { error: 'engine and presetId are required.' }); return true }
        const image = typeof body['screenshot'] === 'string' ? SCREENSHOT.exec(body['screenshot']) : null
        if (body['screenshot'] && !image) { send(res, 400, { error: 'The screenshot must be a PNG, WebP or JPEG data URL.' }); return true }
        const context = body['context'] && typeof body['context'] === 'object' && !Array.isArray(body['context']) ? body['context'] as Record<string, unknown> : undefined
        const file = await store.add({
          engine: bodyEngine, presetId: bodyPreset, presetName: text(body['presetName']) || bodyPreset, text: text(body['text']),
          ...(isReviewNoteKind(body['kind']) ? { kind: body['kind'] } : {}), ...(text(body['area']).trim() ? { area: text(body['area']) } : {}),
          ...(context ? { context } : {}),
          ...(image ? { screenshot: { bytes: Buffer.from(image[2]!, 'base64'), extension: image[1] === 'jpeg' ? 'jpg' as const : image[1] as 'png' | 'webp' } } : {}),
        })
        send(res, 200, { notes: file.notes }); return true
      }
      const status = /^\/notes\/([A-Za-z0-9_-]+)\/status$/.exec(route)
      if (status && req.method === 'POST') {
        const body = await readBody(req)
        const next = body['status']
        if (next !== 'open' && next !== 'done') { send(res, 400, { error: 'status must be open or done.' }); return true }
        const file = await store.setStatus(text(body['engine']), text(body['presetId']), status[1]!, next, text(body['resolution']) || undefined)
        send(res, 200, { notes: file.notes }); return true
      }
      const note = /^\/notes\/([A-Za-z0-9_-]+)$/.exec(route)
      if (note && req.method === 'DELETE') {
        const file = await store.remove(engine, presetId, note[1]!)
        send(res, 200, { notes: file?.notes ?? [] }); return true
      }
      send(res, 404, { error: 'Not found.' }); return true
    } catch (error) {
      send(res, 400, { error: error instanceof Error ? error.message : 'Failed.' }); return true
    }
  }
}

/** Mounts the review notes endpoints on the dev server. `apply: 'serve'` keeps it out of builds entirely. */
export function reviewNotesPlugin(): Plugin {
  return {
    name: 'stageless-review-notes',
    apply: 'serve',
    configureServer(server) {
      const handle = createReviewNotesHandler(server.config.root)
      server.middlewares.use((req, res, next) => { void handle(req, res).then(handled => { if (!handled) next() }) })
    },
  }
}
