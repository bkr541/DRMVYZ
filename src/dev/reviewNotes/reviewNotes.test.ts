import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { newReviewNoteId, parseReviewNotes, renderReviewNotesIndex, reviewNotesSlug, serializeReviewNotes, type ReviewNotesFile } from './reviewNotesFormat'
import { createReviewNotesHandler, REVIEW_NOTES_HEADER } from './reviewNotesPlugin'
import { ReviewNotesStore } from './reviewNotesStore'

const file = (): ReviewNotesFile => ({
  engine: 'cinema2', presetId: 'drmvyz.cinema2.inertia', presetName: 'Inertia',
  notes: [
    { id: 'n_one', status: 'open', createdAt: '2026-11-22T10:15:00.000Z', text: 'Make the core rotate faster.\n\n### Note: with a heading --> and <!-- a comment', context: { playing: true, bpm: 120.4, canvas: { width: 1280, height: 720 } } },
    { id: 'n_two', status: 'done', createdAt: '2026-11-22T11:00:00.000Z', text: 'Dust is too faint.', screenshot: '.review-notes/screenshots/n_two.png', resolution: 'Raised the dust gain.' },
  ],
})

describe('review notes format', () => {
  it('writes a readable markdown file and reads every note back exactly, including awkward text', () => {
    const markdown = serializeReviewNotes(file())
    expect(markdown).toContain('# Review notes — Inertia')
    expect(markdown).toContain('1 open, 1 done')
    expect(markdown).toContain('### [open] n_one')
    expect(markdown).toContain('Make the core rotate faster.')
    expect(markdown).toContain('Context: playing, 120 BPM, canvas 1280x720')
    expect(markdown).toContain('Screenshot: `.review-notes/screenshots/n_two.png`')
    expect(markdown).toContain('Resolved: Raised the dust gain.')
    expect(parseReviewNotes(markdown)).toEqual(file())
  })

  it('skips a line it cannot read without losing the others, and rejects a file that is not a review notes file', () => {
    const markdown = serializeReviewNotes(file()).replace('<!-- note: {"id":"n_two"', '<!-- note: {not json "id":"n_two"')
    expect(parseReviewNotes(markdown)!.notes.map(note => note.id)).toEqual(['n_one'])
    expect(parseReviewNotes('# some other file')).toBeNull()
  })

  it('makes safe file names, and ids that are unique and URL-safe', () => {
    expect(reviewNotesSlug('cinema2', 'drmvyz.cinema2.inertia')).toBe('cinema2__drmvyz.cinema2.inertia')
    expect(reviewNotesSlug('../etc', '../../passwd')).not.toMatch(/[/\\]|\.\./)
    expect(reviewNotesSlug('', '')).toBe('unnamed__unnamed')
    const ids = new Set(Array.from({ length: 500 }, () => newReviewNoteId()))
    expect(ids.size).toBeGreaterThan(490)
    for (const id of ids) expect(id).toMatch(/^n_[a-z0-9]+$/)
  })

  it('builds an index that lists what is open, where, and how to work through it', () => {
    const done = { ...file(), presetId: 'x', presetName: 'Finished', notes: [file().notes[1]!] }
    const index = renderReviewNotesIndex([{ fileName: 'cinema2__a.md', file: file() }, { fileName: 'cinema2__x.md', file: done }])
    expect(index).toContain('## Open (1)')
    expect(index).toContain('Inertia — 1 open (`cinema2__a.md`)')
    expect(index).toContain('`n_one` Make the core rotate faster.')
    expect(index).toContain('npm run review-notes -- done <id>')
    expect(index).toContain('Finished (`cinema2__x.md`): 1 done')
    expect(renderReviewNotesIndex([])).toContain('Nothing open.')
  })
})

describe('review notes store and dev endpoints', () => {
  let root: string, server: Server, base: string
  const headers = { 'content-type': 'application/json', [REVIEW_NOTES_HEADER]: '1' }
  const call = async (method: string, path: string, body?: unknown, extra: Record<string, string> = headers) => {
    const response = await fetch(`${base}${path}`, { method, headers: extra, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, json: response.headers.get('content-type')?.includes('json') ? await response.json() as { notes?: Array<{ id: string; status: string; screenshot?: string; resolution?: string }>; error?: string } : null, response }
  }
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  const preset = { engine: 'cinema2', presetId: 'drmvyz.cinema2.inertia', presetName: 'Inertia' }
  const q = `?engine=${preset.engine}&presetId=${preset.presetId}`

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'review-notes-'))
    const handle = createReviewNotesHandler(root)
    server = createServer((req, res) => { void handle(req, res).then(handled => { if (!handled) { res.statusCode = 404; res.end('next') } }) })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterEach(async () => { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }) })

  it('saves a note to one file per preset, with its context, and lists it back', async () => {
    const added = await call('POST', '/__review-notes/notes', { ...preset, text: '  The camera sways too far.  ', context: { playing: true, bpm: 128 } })
    expect(added.status).toBe(200)
    expect(added.json!.notes).toHaveLength(1)
    const second = await call('POST', '/__review-notes/notes', { engine: 'cinema2', presetId: 'drmvyz.cinema2.other', presetName: 'Other', text: 'Different preset.' })
    expect(second.status).toBe(200)
    expect((await readdir(join(root, '.review-notes'))).sort()).toEqual(['INDEX.md', 'cinema2__drmvyz.cinema2.inertia.md', 'cinema2__drmvyz.cinema2.other.md'])
    const markdown = await readFile(join(root, '.review-notes/cinema2__drmvyz.cinema2.inertia.md'), 'utf8')
    expect(markdown).toContain('The camera sways too far.')
    expect(markdown).toContain('Context: playing, 128 BPM')
    const listed = await call('GET', `/__review-notes/notes${q}`)
    expect(listed.json!.notes!.map(note => note.status)).toEqual(['open'])
    const index = await readFile(join(root, '.review-notes/INDEX.md'), 'utf8')
    expect(index).toContain('## Open (2)')
  })

  it('attaches a screenshot as a file beside the notes, serves it back, and removes it with the note', async () => {
    const added = await call('POST', '/__review-notes/notes', { ...preset, text: 'See the picture.', screenshot: png })
    const note = added.json!.notes![0]!
    expect(note.screenshot).toBe(`.review-notes/screenshots/${note.id}.png`)
    expect((await stat(join(root, note.screenshot!))).size).toBeGreaterThan(20)
    const served = await fetch(`${base}/__review-notes/screenshots/${note.id}.png`)
    expect(served.status).toBe(200); expect(served.headers.get('content-type')).toBe('image/png')
    expect((await served.arrayBuffer()).byteLength).toBe((await stat(join(root, note.screenshot!))).size)
    const removed = await call('DELETE', `/__review-notes/notes/${note.id}${q}`)
    expect(removed.json!.notes).toEqual([])
    await expect(stat(join(root, note.screenshot!))).rejects.toThrow()
    await expect(stat(join(root, '.review-notes/cinema2__drmvyz.cinema2.inertia.md'))).rejects.toThrow()
    expect(await readFile(join(root, '.review-notes/INDEX.md'), 'utf8')).toContain('Nothing open.')
  })

  it('marks a note done with what was changed, reopens it, and the command line tool sees the same file', async () => {
    const id = (await call('POST', '/__review-notes/notes', { ...preset, text: 'Brighter please.' })).json!.notes![0]!.id
    const done = await call('POST', `/__review-notes/notes/${id}/status`, { ...preset, status: 'done', resolution: 'Raised exposure.' })
    expect(done.json!.notes![0]).toMatchObject({ status: 'done', resolution: 'Raised exposure.' })
    expect(await readFile(join(root, '.review-notes/INDEX.md'), 'utf8')).toContain('Nothing open.')
    const store = new ReviewNotesStore(root)
    expect((await store.find(id))!.note.resolution).toBe('Raised exposure.')
    await store.setStatus(preset.engine, preset.presetId, id, 'open')
    const reopened = await call('GET', `/__review-notes/notes${q}`)
    expect(reopened.json!.notes![0]).toMatchObject({ status: 'open' })
    expect(reopened.json!.notes![0]!.resolution).toBeUndefined()
  })

  it('refuses requests without the header, bad input, oversized or non-image screenshots, and unknown notes', async () => {
    expect((await call('GET', `/__review-notes/notes${q}`, undefined, {})).status).toBe(403)
    expect((await call('POST', '/__review-notes/notes', { ...preset, text: 'x' }, { 'content-type': 'application/json' })).status).toBe(403)
    expect((await call('POST', '/__review-notes/notes', { ...preset, text: '   ' })).status).toBe(400)
    expect((await call('POST', '/__review-notes/notes', { text: 'no preset' })).status).toBe(400)
    expect((await call('POST', '/__review-notes/notes', { ...preset, text: 'x', screenshot: 'data:text/html;base64,PGI+' })).status).toBe(400)
    expect((await call('POST', '/__review-notes/notes', { ...preset, text: 'x'.repeat(20_001) })).status).toBe(400)
    expect((await call('POST', '/__review-notes/notes/n_nope/status', { ...preset, status: 'done' })).status).toBe(400)
    expect((await call('POST', '/__review-notes/notes/n_nope/status', { ...preset, status: 'weird' })).status).toBe(400)
    expect((await call('DELETE', `/__review-notes/notes/n_nope${q}`)).status).toBe(400)
    expect((await call('GET', '/__review-notes/nothing')).status).toBe(404)
    expect((await fetch(`${base}/__review-notes/screenshots/..%2f..%2fpackage.json`)).status).not.toBe(200)
    expect((await fetch(`${base}/not-ours`)).status).toBe(404)
    expect(await readdir(root)).toEqual([])
  })

  it('keeps every note when saves arrive at the same moment', async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) => call('POST', '/__review-notes/notes', { ...preset, text: `Note ${i}` })))
    const notes = (await call('GET', `/__review-notes/notes${q}`)).json!.notes!
    expect(notes).toHaveLength(12)
    expect(new Set(notes.map(note => note.id)).size).toBe(12)
  })
})
